import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def recreate_admin():
    mongo_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME")
    
    print(f"📡 Connecting to MongoDB Atlas...")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    users_col = db.users
    
    # Delete existing admin
    result = await users_col.delete_many({"email": "admin@goodzwork.com"})
    print(f"🗑️ Deleted {result.deleted_count} existing admin(s)")
    
    # Create admin user with bcrypt hash
    admin_user = {
        "email": "admin@goodzwork.com",
        "hashed_password": hash_password("admin123"),
        "full_name": "Super Admin",
        "role": "super_admin",
        "status": "active",
        "face_registered": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await users_col.insert_one(admin_user)
    
    print("✅ Super Admin recreated successfully!")
    print("=" * 40)
    print(f"📧 Email: admin@goodzwork.com")
    print(f"🔑 Password: admin123")
    print(f"🆔 ID: {result.inserted_id}")
    print("=" * 40)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(recreate_admin())
