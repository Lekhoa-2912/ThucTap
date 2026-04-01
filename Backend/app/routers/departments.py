from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId

from ..database import get_departments_collection, get_users_collection
from ..models.department import Department, DepartmentCreate, DepartmentUpdate
from .auth import get_current_user

router = APIRouter(prefix="/api/departments", tags=["Departments"])

@router.get("")
@router.get("/")
async def get_departments(current_user = Depends(get_current_user)):
    """Get all departments with member count"""
    try:
        dept_col = get_departments_collection()
        users_col = get_users_collection()
        
        depts = await dept_col.find({}).to_list(None)
        result = []
        
        for d in depts:
            dept_name = d.get("name")
            # Count users in department
            member_count = await users_col.count_documents({"department": dept_name}) if dept_name else 0
            
            manager_id = d.get("manager_id")
            
            result.append({
                "id": str(d["_id"]),
                "name": dept_name,
                "description": d.get("description"),
                "manager_id": str(manager_id) if manager_id else None,
                "member_count": member_count,
                "created_at": d.get("created_at")
            })
            
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
@router.post("/")
async def create_department(data: DepartmentCreate, current_user = Depends(get_current_user)):
    """Create a new department (SUPER_ADMIN or HR_MANAGER only)"""
    if current_user.get("role") not in ["SUPER_ADMIN", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Không có quyền tạo phòng ban")
        
    dept_col = get_departments_collection()
    
    # Check duplicate name
    existing = await dept_col.find_one({"name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Tên phòng ban đã tồn tại")
        
    dept = {
        "name": data.name,
        "description": data.description,
        "manager_id": data.manager_id,
        "created_at": datetime.utcnow()
    }
    
    result = await dept_col.insert_one(dept)
    
    # Auto-promote new manager to LEADER if they are an EMPLOYEE
    if data.manager_id:
        try:
            users_col = get_users_collection()
            user = await users_col.find_one({"_id": ObjectId(data.manager_id)})
            if user and user.get("role") == "EMPLOYEE":
                await users_col.update_one(
                    {"_id": ObjectId(data.manager_id)},
                    {"$set": {
                        "role": "LEADER",
                        "role_updated_at": datetime.utcnow(),
                        "role_updated_by": current_user["_id"]
                    }}
                )
        except Exception as e:
            print(f"Failed to auto-promote manager: {e}")

    return {"id": str(result.inserted_id), "message": "Tạo phòng ban thành công"}

@router.get("/{id}")
async def get_department(id: str, current_user = Depends(get_current_user)):
    """Get single department details"""
    dept_col = get_departments_collection()
    users_col = get_users_collection()
    
    try:
        dept = await dept_col.find_one({"_id": ObjectId(id)})
    except:
        raise HTTPException(status_code=400, detail="ID không hợp lệ")
        
    if not dept:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng ban")
        
    member_count = await users_col.count_documents({"department": dept.get("name")})
    
    return {
        "id": str(dept["_id"]),
        "name": dept.get("name"),
        "description": dept.get("description"),
        "manager_id": dept.get("manager_id"),
        "member_count": member_count,
        "created_at": dept.get("created_at")
    }

@router.put("/{id}")
async def update_department(id: str, data: DepartmentUpdate, current_user = Depends(get_current_user)):
    """Update department (SUPER_ADMIN or HR_MANAGER only)"""
    if current_user.get("role") not in ["SUPER_ADMIN", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Không có quyền sửa phòng ban")
        
    dept_col = get_departments_collection()
    
    try:
        existing = await dept_col.find_one({"_id": ObjectId(id)})
    except:
         raise HTTPException(status_code=400, detail="ID không hợp lệ")
         
    if not existing:
         raise HTTPException(status_code=404, detail="Không tìm thấy phòng ban")

    update_doc = {}
    if data.name is not None:
         # Check duplicate name if renamed
         if data.name != existing.get("name"):
              dup = await dept_col.find_one({"name": data.name})
              if dup:
                   raise HTTPException(status_code=400, detail="Tên phòng ban đã tồn tại")
         update_doc["name"] = data.name
    if data.description is not None:
         update_doc["description"] = data.description
    if data.manager_id is not None:
         update_doc["manager_id"] = data.manager_id

    if update_doc:
         await dept_col.update_one({"_id": ObjectId(id)}, {"$set": update_doc})
         
         # Auto-promote new manager to LEADER if they are an EMPLOYEE
         if "manager_id" in update_doc and update_doc["manager_id"]:
             new_manager_id = update_doc["manager_id"]
             if new_manager_id != existing.get("manager_id"):
                 try:
                     users_col = get_users_collection()
                     user = await users_col.find_one({"_id": ObjectId(new_manager_id)})
                     if user and user.get("role") == "EMPLOYEE":
                         await users_col.update_one(
                             {"_id": ObjectId(new_manager_id)},
                             {"$set": {
                                 "role": "LEADER",
                                 "role_updated_at": datetime.utcnow(),
                                 "role_updated_by": current_user["_id"]
                             }}
                         )
                 except Exception as e:
                     print(f"Failed to auto-promote manager: {e}")

    return {"message": "Cập nhật phòng ban thành công"}

@router.delete("/{id}")
async def delete_department(id: str, current_user = Depends(get_current_user)):
    """Delete a department (SUPER_ADMIN or HR_MANAGER only)"""
    if current_user.get("role") not in ["SUPER_ADMIN", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Không có quyền xóa phòng ban")
        
    dept_col = get_departments_collection()
    try:
        result = await dept_col.delete_one({"_id": ObjectId(id)})
    except:
         raise HTTPException(status_code=400, detail="ID không hợp lệ")
         
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng ban")
        
    return {"message": "Đã xóa phòng ban thành công"}
