from datetime import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from bson import ObjectId

from ..database import get_users_collection
from ..models.user import UserResponse, UserProfileUpdate, UserStatus, UserRole
from ..services.face_recognition_service import face_service
from .auth import get_current_user

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.put("/profile")
async def update_profile(
    profile_data: UserProfileUpdate,
    current_user = Depends(get_current_user)
):
    """
    Update user profile (Force Update flow for INIT users).
    Auto-generates employee_id if not exists.
    """
    users_col = get_users_collection()
    
    # Generate employee_id if not exists and department is provided
    employee_id = current_user.get("employee_id")
    if not employee_id and profile_data.department:
        # Map department to code
        dept_codes = {
            "HR": "HR", "IT": "IT", "Finance": "FN", "FN": "FN",
            "Marketing": "MK", "MK": "MK", "Sales": "SL", "SL": "SL",
            "Operations": "OP", "OP": "OP", "Admin": "AD", "AD": "AD"
        }
        dept_code = dept_codes.get(profile_data.department, "XX")
        
        # Count existing employees in this department
        count = await users_col.count_documents({
            "department": profile_data.department,
            "employee_id": {"$exists": True, "$ne": None}
        })
        employee_id = f"{dept_code}-{str(count + 1).zfill(3)}"
    
    update_data = {
        "full_name": profile_data.full_name,
        "phone": profile_data.phone,
        "department": profile_data.department,
        "position": profile_data.position,
        "avatar": profile_data.avatar,
        "bank_name": profile_data.bank_name,
        "bank_account_number": profile_data.bank_account_number,
        "bank_account_holder": profile_data.bank_account_holder,
        "updated_at": datetime.utcnow()
    }
    
    if employee_id:
        update_data["employee_id"] = employee_id
    
    await users_col.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": update_data}
    )
    
    return {
        "message": "Cập nhật hồ sơ thành công",
        "employee_id": employee_id,
        "next_step": "face_enrollment" if not current_user.get("face_registered") else None
    }

import os
import uuid
from ..config import settings as settings_config

@router.get("/me")
async def get_current_profile(current_user = Depends(get_current_user)):
    """Get current user's full profile"""
    return {
        "id": current_user["_id"],
        "email": current_user["email"],
        "full_name": current_user.get("full_name"),
        "phone": current_user.get("phone"),
        "department": current_user.get("department"),
        "position": current_user.get("position"),
        "avatar": current_user.get("avatar"),
        "employee_id": current_user.get("employee_id"),
        "bank_name": current_user.get("bank_name"),
        "bank_account_number": current_user.get("bank_account_number"),
        "bank_account_holder": current_user.get("bank_account_holder"),
        "role": current_user.get("role"),
        "status": current_user.get("status"),
        "face_registered": current_user.get("face_registered", False),
        "created_at": current_user.get("created_at")
    }

@router.post("/upload-avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user)
):
    """Upload user avatar image to GridFS"""
    from ..services.gridfs_service import GridFSService
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file ảnh (JPEG, PNG, WebP, GIF)")
    
    # Read file contents
    contents = await file.read()
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"avatar_{current_user['_id']}_{uuid.uuid4().hex[:8]}.{ext}"
    
    # Upload to GridFS
    file_id = await GridFSService.upload_file(
        contents,
        filename,
        content_type=file.content_type,
        metadata={
            "type": "avatar",
            "user_id": current_user["_id"]
        }
    )
    
    # Delete old avatar from GridFS if exists
    users_col = get_users_collection()
    user = await users_col.find_one({"_id": ObjectId(current_user["_id"])})
    old_avatar = user.get("avatar", "") if user else ""
    if old_avatar and old_avatar.startswith("/api/files/"):
        old_id = old_avatar.replace("/api/files/", "")
        await GridFSService.delete_file(old_id)
    
    # Update user avatar URL
    avatar_url = f"/api/files/{file_id}"
    await users_col.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": {"avatar": avatar_url, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Upload avatar thành công", "avatar_url": avatar_url}

import bcrypt
from pydantic import BaseModel as PydanticBaseModel

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

class ChangePasswordRequest(PydanticBaseModel):
    current_password: str
    new_password: str

@router.put("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user = Depends(get_current_user)
):
    """Change user password"""
    users_col = get_users_collection()
    
    # Get user with hashed password
    user = await users_col.find_one({"_id": ObjectId(current_user["_id"])})
    
    # Verify current password
    if not verify_password(request.current_password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")
    
    # Validate new password
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự")
    
    # Hash and save new password
    new_hashed = hash_password(request.new_password)
    await users_col.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": {"hashed_password": new_hashed, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Đổi mật khẩu thành công"}

from pydantic import BaseModel

class FaceEnrollRequest(BaseModel):
    face_images: List[str]

@router.post("/enroll-face")
async def enroll_face(
    request: FaceEnrollRequest,
    current_user = Depends(get_current_user)
):
    """
    Enroll face with images for AI training.
    After successful enrollment, status changes to PENDING.
    Face images stored in GridFS.
    """
    face_images = request.face_images
    
    if len(face_images) < 1:
        raise HTTPException(
            status_code=400, 
            detail=f"Cần ít nhất 1 ảnh khuôn mặt"
        )
    
    # Delete old face images from GridFS if re-enrolling
    users_col = get_users_collection()
    user = await users_col.find_one({"_id": ObjectId(current_user["_id"])})
    old_face_ids = user.get("face_image_ids", []) if user else []
    if old_face_ids:
        from ..services.gridfs_service import GridFSService
        await GridFSService.delete_files(old_face_ids)
    
    # Process face images (now async - stores in GridFS)
    success, message, embeddings, face_image_ids = await face_service.enroll_faces(
        user_id=current_user["_id"],
        face_images=face_images
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    # Determine new status (Keep ACTIVE if already ACTIVE)
    new_status = UserStatus.PENDING.value
    if current_user.get("status") == UserStatus.ACTIVE.value:
        new_status = UserStatus.ACTIVE.value

    # Update user with face embeddings + GridFS image IDs
    await users_col.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {
            "$set": {
                "face_encodings": embeddings,
                "face_image_ids": face_image_ids,
                "face_registered": True,
                "status": new_status,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": message,
        "status": new_status,
        "embeddings_count": len(embeddings),
        "next_step": "wait_for_approval" if new_status == "PENDING" else "dashboard"
    }

@router.get("/pending")
async def get_pending_users(current_user = Depends(get_current_user)):
    """Get list of users pending approval (HR/Admin only)"""
    if current_user.get("role") not in [UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập")
    
    users_col = get_users_collection()
    pending_users = await users_col.find(
        {"status": UserStatus.PENDING.value}
    ).to_list(None)
    
    result = []
    for user in pending_users:
        result.append({
            "id": str(user["_id"]),
            "email": user["email"],
            "full_name": user.get("full_name"),
            "department": user.get("department"),
            "position": user.get("position"),
            "avatar": user.get("avatar"),
            "face_registered": user.get("face_registered", False),
            "created_at": user.get("created_at"),
            "updated_at": user.get("updated_at")
        })
    
    return result

@router.put("/{user_id}/approve")
async def approve_user(
    user_id: str,
    current_user = Depends(get_current_user)
):
    """Approve a pending user (HR/Admin only)"""
    if current_user.get("role") not in [UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền duyệt hồ sơ")
    
    users_col = get_users_collection()
    
    # Check if user exists and is pending
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    
    if user.get("status") != UserStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Người dùng không ở trạng thái chờ duyệt")
    
    # Update status to ACTIVE
    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "status": UserStatus.ACTIVE.value,
                "approved_by": current_user["_id"],
                "approved_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": "Duyệt hồ sơ thành công",
        "user_id": user_id,
        "status": "ACTIVE"
    }

@router.put("/{user_id}/reject")
async def reject_user(
    user_id: str,
    reason: str,
    current_user = Depends(get_current_user)
):
    """Reject a pending user (HR/Admin only)"""
    if current_user.get("role") not in [UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền từ chối hồ sơ")
    
    users_col = get_users_collection()
    
    # Reset to INIT status so user can re-register face
    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "status": UserStatus.INIT.value,
                "face_registered": False,
                "face_encodings": [],
                "rejection_reason": reason,
                "rejected_by": current_user["_id"],
                "rejected_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": "Đã từ chối hồ sơ",
        "user_id": user_id,
        "reason": reason
    }

@router.get("/search")
async def search_users(
    q: str = None,
    department: str = None,
    current_user = Depends(get_current_user)
):
    """Search active users for chat (Public for active users)"""
    # Only active users can search
    if current_user.get("status") != UserStatus.ACTIVE.value:
         raise HTTPException(status_code=403, detail="Tài khoản chưa được kích hoạt")

    users_col = get_users_collection()
    
    query = {"status": UserStatus.ACTIVE.value}
    
    if q:
        # Search by name or email (case-insensitive)
        query["$or"] = [
            {"full_name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}}
        ]
    
    if department:
        query["department"] = department
        
    # Exclude current user from results
    query["_id"] = {"$ne": ObjectId(current_user["_id"])}
    
    users = await users_col.find(query).limit(50).to_list(50)
    
    result = []
    for user in users:
        result.append({
            "id": str(user["_id"]),
            "full_name": user.get("full_name", "Unknown"),
            "email": user["email"],
            "avatar": user.get("avatar"),
            "department": user.get("department"),
            "position": user.get("position")
        })
    
    return result

@router.get("/list")
async def list_users(
    status: str = None,
    role: str = None,
    current_user = Depends(get_current_user)
):
    """Get list of all users (HR/Admin only)"""
    if current_user.get("role") not in [UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập")
    
    users_col = get_users_collection()
    
    query = {}
    if status:
        query["status"] = status
    if role:
        query["role"] = role
    
    users = await users_col.find(query).to_list(None)
    
    result = []
    for user in users:
        result.append({
            "id": str(user["_id"]),
            "email": user["email"],
            "full_name": user.get("full_name"),
            "phone": user.get("phone"),
            "department": user.get("department"),
            "position": user.get("position"),
            "avatar": user.get("avatar"),
            "role": user.get("role"),
            "status": user.get("status"),
            "face_registered": user.get("face_registered", False),
            "created_at": user.get("created_at")
        })
    
    return result

@router.get("/{user_id}")
async def get_user(
    user_id: str,
    current_user = Depends(get_current_user)
):
    """Get user details"""
    users_col = get_users_collection()
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "full_name": user.get("full_name"),
        "phone": user.get("phone"),
        "department": user.get("department"),
        "position": user.get("position"),
        "avatar": user.get("avatar"),
        "role": user.get("role"),
        "status": user.get("status"),
        "employee_id": user.get("employee_id"),
        "bank_name": user.get("bank_name"),
        "bank_account_number": user.get("bank_account_number"),
        "bank_account_holder": user.get("bank_account_holder"),
        "face_registered": user.get("face_registered", False),
        "created_at": user.get("created_at")
    }

# ============ EMPLOYEE MANAGEMENT ENDPOINTS ============

class UpdateStatusRequest(PydanticBaseModel):
    status: str  # ACTIVE, SUSPENDED, TERMINATED

@router.put("/{user_id}/status")
async def update_user_status(
    user_id: str,
    data: UpdateStatusRequest,
    current_user = Depends(get_current_user)
):
    """Update user status (suspend/terminate/activate) - HR/Admin only"""
    if current_user.get("role") not in [UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền thay đổi trạng thái")
    
    valid_statuses = ["ACTIVE", "SUSPENDED", "TERMINATED", "INACTIVE"]
    if data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Trạng thái không hợp lệ. Chọn: {valid_statuses}")
    
    users_col = get_users_collection()
    
    result = await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "status": data.status,
                "status_updated_at": datetime.utcnow(),
                "status_updated_by": current_user["_id"]
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    
    status_messages = {
        "ACTIVE": "Đã kích hoạt tài khoản",
        "SUSPENDED": "Đã tạm khóa tài khoản",
        "TERMINATED": "Đã cho nghỉ việc",
        "INACTIVE": "Đã vô hiệu hóa tài khoản"
    }
    
    return {"message": status_messages.get(data.status, "Cập nhật thành công")}

class UpdateRoleRequest(PydanticBaseModel):
    role: str

@router.put("/{user_id}/role")
async def update_user_role(
    user_id: str,
    data: UpdateRoleRequest,
    current_user = Depends(get_current_user)
):
    """Change user role - Admin only"""
    if current_user.get("role") != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Chỉ Super Admin được thay đổi vai trò")
    
    valid_roles = [r.value for r in UserRole]
    if data.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Vai trò không hợp lệ. Chọn: {valid_roles}")
    
    users_col = get_users_collection()
    
    result = await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "role": data.role,
                "role_updated_at": datetime.utcnow(),
                "role_updated_by": current_user["_id"]
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    
    return {"message": f"Đã thay đổi vai trò thành {data.role}"}

@router.put("/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    current_user = Depends(get_current_user)
):
    """Reset user password to default - HR/Admin only"""
    if current_user.get("role") not in [UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền reset mật khẩu")
    
    users_col = get_users_collection()
    
    # Default password: 123456
    default_password = "123456"
    hashed = hash_password(default_password)
    
    result = await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "hashed_password": hashed,
                "password_reset_at": datetime.utcnow(),
                "password_reset_by": current_user["_id"]
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    
    return {"message": "Đã reset mật khẩu về 123456", "default_password": "123456"}

class AdminUpdateUserRequest(PydanticBaseModel):
    full_name: str = None
    phone: str = None
    department: str = None
    position: str = None

@router.put("/{user_id}")
async def admin_update_user(
    user_id: str,
    data: AdminUpdateUserRequest,
    current_user = Depends(get_current_user)
):
    """Update user info by admin - HR/Admin only"""
    if current_user.get("role") not in [UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền chỉnh sửa thông tin")
    
    users_col = get_users_collection()
    
    update_doc = {"updated_at": datetime.utcnow()}
    if data.full_name is not None:
        update_doc["full_name"] = data.full_name
    if data.phone is not None:
        update_doc["phone"] = data.phone
    if data.department is not None:
        update_doc["department"] = data.department
    if data.position is not None:
        update_doc["position"] = data.position
    
    result = await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_doc}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    
    return {"message": "Cập nhật thông tin thành công"}

    return {"message": "Cập nhật thông tin thành công"}

@router.delete("/{user_id}/face")
async def delete_user_face_data(
    user_id: str,
    current_user = Depends(get_current_user)
):
    """Delete user face data from GridFS - HR/Admin only"""
    if current_user.get("role") not in [UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền xóa dữ liệu khuôn mặt")
    
    users_col = get_users_collection()
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    
    # Delete face images from GridFS
    face_image_ids = user.get("face_image_ids", [])
    await face_service.delete_user_faces(user_id, face_image_ids)
    
    # Update DB
    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "face_encodings": [],
                "face_image_ids": [],
                "face_registered": False,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": "Đã xóa dữ liệu khuôn mặt thành công"}
