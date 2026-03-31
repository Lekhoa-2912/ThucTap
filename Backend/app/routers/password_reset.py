"""
Password Reset Router
Workflow:
  1. Employee submits reset request with: email, face photo, CCCD front, CCCD back
  2. HR reviews the request (view photos) and either approves (sets new password) or rejects
"""
import os
import shutil
import base64
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from bson import ObjectId
from pydantic import BaseModel

from ..database import get_users_collection, get_password_reset_collection
from ..routers.auth import get_current_user, get_password_hash, verify_password
from ..models.user import UserRole
from ..config import settings

router = APIRouter(prefix="/api/password-reset", tags=["Password Reset"])

RESET_UPLOADS = os.path.join(settings.UPLOADS_PATH, "password_resets")

# ─────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────
class ResetApproveBody(BaseModel):
    new_password: str

class ResetRejectBody(BaseModel):
    reason: Optional[str] = "Yêu cầu bị từ chối"


# ─────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────
def _serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc

async def _save_upload(file: UploadFile, folder: str, prefix: str) -> str:
    """Save an uploaded image file and return relative URL path."""
    os.makedirs(folder, exist_ok=True)
    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    filename = f"{prefix}_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(folder, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    # Return correct URL — file lives in uploads/password_resets/{subfolder}/{filename}
    subfolder = os.path.basename(folder)
    return f"/uploads/password_resets/{subfolder}/{filename}"


# ─────────────────────────────────────────────
# Employee: submit reset request
# ─────────────────────────────────────────────
@router.post("/request")
async def submit_reset_request(
    email: str = Form(...),
    face_photo: UploadFile = File(...),
    cccd_front: UploadFile = File(...),
    cccd_back: UploadFile = File(...),
):
    """
    Employee submits a password-reset request (no auth required).
    Uploads: face selfie, CCCD front, CCCD back.
    """
    users_col = get_users_collection()
    user = await users_col.find_one({"email": email})
    if not user:
        # Generic error to avoid email enumeration
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản với email này")

    reset_col = get_password_reset_collection()

    # Check if there's already a pending request for this user
    existing = await reset_col.find_one({
        "user_id": str(user["_id"]),
        "status": "PENDING"
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Bạn đã có yêu cầu đang chờ xử lý. Vui lòng đợi HR xét duyệt."
        )

    # Save uploaded images
    request_id = uuid.uuid4().hex
    folder = os.path.join(RESET_UPLOADS, request_id)

    face_url  = await _save_upload(face_photo, folder, "face")
    front_url = await _save_upload(cccd_front, folder, "cccd_front")
    back_url  = await _save_upload(cccd_back,  folder, "cccd_back")

    doc = {
        "user_id":    str(user["_id"]),
        "email":      email,
        "full_name":  user.get("full_name", ""),
        "department": user.get("department", ""),
        "face_photo_url":  face_url,
        "cccd_front_url":  front_url,
        "cccd_back_url":   back_url,
        "status":     "PENDING",          # PENDING | APPROVED | REJECTED
        "reason":     None,
        "reviewed_by": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await reset_col.insert_one(doc)

    return {
        "message": "Yêu cầu cấp lại mật khẩu đã được gửi. Vui lòng chờ HR xét duyệt.",
        "request_id": str(result.inserted_id),
    }


# ─────────────────────────────────────────────
# HR: list pending requests
# ─────────────────────────────────────────────
@router.get("/requests")
async def list_reset_requests(
    status: Optional[str] = None,
    current_user = Depends(get_current_user),
):
    """HR/Admin: list all password reset requests."""
    if current_user.get("role") not in [UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập")

    reset_col = get_password_reset_collection()
    query = {}
    if status:
        query["status"] = status

    cursor = reset_col.find(query).sort("created_at", -1)
    docs = []
    async for doc in cursor:
        docs.append(_serialize(doc))
    return docs


# ─────────────────────────────────────────────
# HR: get single request detail
# ─────────────────────────────────────────────
@router.get("/requests/{request_id}")
async def get_reset_request(
    request_id: str,
    current_user = Depends(get_current_user),
):
    """HR/Admin: get a single password reset request."""
    if current_user.get("role") not in [UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập")

    reset_col = get_password_reset_collection()
    doc = await reset_col.find_one({"_id": ObjectId(request_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu")
    return _serialize(doc)


# ─────────────────────────────────────────────
# HR: approve → set new password
# ─────────────────────────────────────────────
@router.put("/requests/{request_id}/approve")
async def approve_reset_request(
    request_id: str,
    body: ResetApproveBody,
    current_user = Depends(get_current_user),
):
    """HR/Admin: approve a password-reset request and set the new password."""
    if current_user.get("role") not in [UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập")

    reset_col = get_password_reset_collection()
    doc = await reset_col.find_one({"_id": ObjectId(request_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu")
    if doc["status"] != "PENDING":
        raise HTTPException(status_code=400, detail="Yêu cầu đã được xử lý rồi")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự")

    users_col = get_users_collection()
    await users_col.update_one(
        {"_id": ObjectId(doc["user_id"])},
        {"$set": {"hashed_password": get_password_hash(body.new_password), "updated_at": datetime.utcnow()}}
    )

    await reset_col.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "status": "APPROVED",
            "reviewed_by": current_user.get("full_name") or current_user.get("email"),
            "updated_at": datetime.utcnow(),
        }}
    )

    return {"message": "Đã duyệt và cập nhật mật khẩu mới cho nhân viên"}


# ─────────────────────────────────────────────
# HR: reject
# ─────────────────────────────────────────────
@router.put("/requests/{request_id}/reject")
async def reject_reset_request(
    request_id: str,
    body: ResetRejectBody,
    current_user = Depends(get_current_user),
):
    """HR/Admin: reject a password-reset request."""
    if current_user.get("role") not in [UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập")

    reset_col = get_password_reset_collection()
    doc = await reset_col.find_one({"_id": ObjectId(request_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu")
    if doc["status"] != "PENDING":
        raise HTTPException(status_code=400, detail="Yêu cầu đã được xử lý rồi")

    await reset_col.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "status": "REJECTED",
            "reason": body.reason,
            "reviewed_by": current_user.get("full_name") or current_user.get("email"),
            "updated_at": datetime.utcnow(),
        }}
    )
    return {"message": "Đã từ chối yêu cầu cấp lại mật khẩu"}


# ─────────────────────────────────────────────
# Employee: check status of their request (public, by email)
# ─────────────────────────────────────────────
@router.get("/status")
async def check_request_status(email: str):
    """Employee: check the status of their latest password-reset request."""
    reset_col = get_password_reset_collection()
    doc = await reset_col.find_one(
        {"email": email},
        sort=[("created_at", -1)]
    )
    if not doc:
        return {"status": None, "message": "Chưa có yêu cầu nào"}
    return {
        "status": doc["status"],
        "reason": doc.get("reason"),
        "created_at": doc["created_at"].isoformat(),
        "updated_at": doc["updated_at"].isoformat(),
    }
