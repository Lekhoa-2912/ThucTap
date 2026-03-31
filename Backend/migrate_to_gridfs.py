"""
Migration Script: Move files from local filesystem to MongoDB GridFS.
Run once after deploying the new code.

Usage: python migrate_to_gridfs.py
"""
import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime

# Add parent dir so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "goodzwork")
UPLOADS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
FACE_DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_data")


async def migrate():
    print("=" * 60)
    print("  GoodZWork - Migrate Local Files to MongoDB GridFS")
    print("=" * 60)
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    bucket = AsyncIOMotorGridFSBucket(db)
    users_col = db["users"]
    attendance_col = db["attendance_logs"]
    
    stats = {"avatars": 0, "faces": 0, "attendance": 0, "errors": 0, "deleted_files": 0}
    
    # ============ 1. Migrate Avatar Images ============
    print("\n📸 [1/3] Migrating avatar images...")
    
    async for user in users_col.find({"avatar": {"$regex": "^/uploads/"}}):
        avatar_path = user["avatar"]  # e.g. "/uploads/avatar_xxx.png"
        local_filename = avatar_path.replace("/uploads/", "")
        local_path = os.path.join(UPLOADS_PATH, local_filename)
        
        if not os.path.exists(local_path):
            print(f"  ⚠ File not found, skipping: {local_path}")
            continue
        
        try:
            with open(local_path, "rb") as f:
                data = f.read()
            
            # Detect content type
            ext = local_filename.rsplit(".", 1)[-1].lower()
            content_types = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "gif": "image/gif"}
            content_type = content_types.get(ext, "image/jpeg")
            
            # Upload to GridFS
            file_id = await bucket.upload_from_stream(
                local_filename,
                data,
                metadata={
                    "type": "avatar",
                    "user_id": str(user["_id"]),
                    "content_type": content_type,
                    "migrated_from": avatar_path,
                    "uploaded_at": datetime.utcnow()
                }
            )
            
            # Update user document
            new_url = f"/api/files/{str(file_id)}"
            await users_col.update_one(
                {"_id": user["_id"]},
                {"$set": {"avatar": new_url}}
            )
            
            # Delete local file
            os.remove(local_path)
            stats["deleted_files"] += 1
            
            stats["avatars"] += 1
            print(f"  ✅ {local_filename} → GridFS ({file_id})")
            
        except Exception as e:
            stats["errors"] += 1
            print(f"  ❌ Error migrating {local_filename}: {e}")
    
    # ============ 2. Migrate Face Reference Images ============
    print("\n🧑 [2/3] Migrating face reference images...")
    
    if os.path.exists(FACE_DATA_PATH):
        for user_dir in os.listdir(FACE_DATA_PATH):
            user_face_dir = os.path.join(FACE_DATA_PATH, user_dir)
            if not os.path.isdir(user_face_dir):
                continue
            
            face_image_ids = []
            
            for img_file in sorted(os.listdir(user_face_dir)):
                img_path = os.path.join(user_face_dir, img_file)
                if not os.path.isfile(img_path):
                    continue
                
                try:
                    with open(img_path, "rb") as f:
                        data = f.read()
                    
                    file_id = await bucket.upload_from_stream(
                        f"face_ref_{user_dir}_{img_file}",
                        data,
                        metadata={
                            "type": "face_reference",
                            "user_id": user_dir,
                            "content_type": "image/jpeg",
                            "uploaded_at": datetime.utcnow()
                        }
                    )
                    face_image_ids.append(str(file_id))
                    stats["faces"] += 1
                    
                    # Delete local file
                    os.remove(img_path)
                    stats["deleted_files"] += 1
                    
                except Exception as e:
                    stats["errors"] += 1
                    print(f"  ❌ Error migrating {img_path}: {e}")
            
            if face_image_ids:
                # Update user with GridFS IDs
                try:
                    await users_col.update_one(
                        {"_id": ObjectId(user_dir)},
                        {"$set": {"face_image_ids": face_image_ids}}
                    )
                    print(f"  ✅ User {user_dir}: {len(face_image_ids)} face images → GridFS")
                except Exception:
                    print(f"  ⚠ User {user_dir}: uploaded images but failed to update DB")
            
            # Remove empty directory
            try:
                os.rmdir(user_face_dir)
            except OSError:
                pass
    
    # ============ 3. Migrate Attendance Photos ============
    print("\n📋 [3/3] Migrating attendance photos...")
    
    attendance_dir = os.path.join(UPLOADS_PATH, "attendance")
    if os.path.exists(attendance_dir):
        for img_file in os.listdir(attendance_dir):
            img_path = os.path.join(attendance_dir, img_file)
            if not os.path.isfile(img_path):
                continue
            
            try:
                with open(img_path, "rb") as f:
                    data = f.read()
                
                # Parse user_id and check_type from filename
                # Format: {user_id}_{check_type}_{timestamp}.jpg
                parts = img_file.rsplit(".", 1)[0].split("_")
                user_id = parts[0] if len(parts) >= 3 else "unknown"
                check_type = parts[1] if len(parts) >= 3 else "unknown"
                
                file_id = await bucket.upload_from_stream(
                    img_file,
                    data,
                    metadata={
                        "type": "attendance",
                        "user_id": user_id,
                        "check_type": check_type,
                        "content_type": "image/jpeg",
                        "timestamp": datetime.utcnow(),
                        "uploaded_at": datetime.utcnow()
                    }
                )
                
                new_url = f"/api/files/{str(file_id)}"
                old_url = f"/uploads/attendance/{img_file}"
                
                # Update attendance log if found
                await attendance_col.update_many(
                    {"face_image": old_url},
                    {"$set": {"face_image": new_url}}
                )
                
                # Delete local file
                os.remove(img_path)
                stats["deleted_files"] += 1
                
                stats["attendance"] += 1
                
            except Exception as e:
                stats["errors"] += 1
                print(f"  ❌ Error migrating {img_file}: {e}")
        
        print(f"  ✅ {stats['attendance']} attendance photos migrated")
        
        # Remove empty attendance directory
        try:
            os.rmdir(attendance_dir)
        except OSError:
            pass
    
    # Try to clean up empty directories
    for dir_path in [FACE_DATA_PATH, UPLOADS_PATH]:
        try:
            if os.path.exists(dir_path) and not os.listdir(dir_path):
                os.rmdir(dir_path)
                print(f"  🗑️ Removed empty directory: {dir_path}")
        except OSError:
            pass
    
    # ============ Summary ============
    print("\n" + "=" * 60)
    print("  Migration Complete!")
    print("=" * 60)
    print(f"  Avatars migrated:    {stats['avatars']}")
    print(f"  Face images migrated: {stats['faces']}")
    print(f"  Attendance photos:    {stats['attendance']}")
    print(f"  Files deleted:        {stats['deleted_files']}")
    print(f"  Errors:               {stats['errors']}")
    print("=" * 60)
    
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
