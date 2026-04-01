from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from bson import ObjectId

from ..services.gridfs_service import GridFSService

from ..database import get_projects_collection, get_tasks_collection, get_users_collection, get_task_history_collection, get_phases_collection
from ..models.project import (
    Project, ProjectCreate, ProjectStatus,
    PhaseBase, Phase,
    Task, TaskCreate, TaskStatus, TaskAccept, TaskProgressUpdate
)
from ..models.user import UserRole, UserStatus
from .auth import get_current_user

router = APIRouter(prefix="/api/projects", tags=["Projects"])

# ============ PROJECT ENDPOINTS ============

@router.get("/")
async def get_projects(
    status: str = None,
    current_user = Depends(get_current_user)
):
    """Get standalone tasks acting as projects (filtered by user access)"""
    if current_user.get("status") != UserStatus.ACTIVE.value:
        raise HTTPException(status_code=403, detail="Tài khoản chưa được kích hoạt")
    
    tasks_col = get_tasks_collection()
    users_col = get_users_collection()
    
    # standalone tasks have project_id == None
    query = {"project_id": None}
    
    if current_user.get("role") == UserRole.EMPLOYEE.value:
        query["assigned_to"] = {"$in": [str(current_user["_id"])]}
        
    if status:
        query["status"] = status
        
    projects = await tasks_col.find(query).sort("created_at", -1).to_list(None)
    
    result = []
    for proj in projects:
        members_raw = proj.get("assigned_to", [])
        members_info = []
        for member_id in members_raw[:6]:
            try:
                user = await users_col.find_one({"_id": ObjectId(member_id)})
                if user:
                    members_info.append({
                        "id": str(user["_id"]),
                        "full_name": user.get("full_name"),
                        "avatar": user.get("avatar"),
                    })
            except:
                pass

        result.append({
            "id": str(proj["_id"]),
            "name": proj.get("title"),  # Map title to name for React card render
            "description": proj.get("description"),
            "status": proj.get("status"),
            "start_date": proj.get("created_at"),
            "end_date": proj.get("deadline"),
            "team_members": members_info,
            "team_count": len(members_raw),
            "created_by": proj.get("assigned_by"),
            "created_at": proj.get("created_at")
        })
        
    return result
@router.post("/")
async def create_project(
    data: ProjectCreate,
    current_user = Depends(get_current_user)
):
    """Create a standalone task acting as a project (Leader/Admin only)"""
    if current_user.get("role") not in [UserRole.LEADER.value, UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền tạo dự án")
        
    tasks_col = get_tasks_collection()
    
    project_task = {
        "project_id": None, 
        "title": data.name, 
        "description": data.description,
        "priority": "MEDIUM",
        "deadline": data.end_date,
        "assigned_to": data.team_members or [],
        "assigned_by": str(current_user["_id"]),
        "status": TaskStatus.ASSIGNED.value if data.team_members else TaskStatus.TODO.value,
        "progress": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await tasks_col.insert_one(project_task)
    return {
        "id": str(result.inserted_id),
        "message": "Tạo dự án thành công"
    }

@router.get("/{project_id}")
async def get_project(
    project_id: str,
    current_user = Depends(get_current_user)
):
    """Get standalone task details loaded as a project"""
    tasks_col = get_tasks_collection()
    users_col = get_users_collection()
    
    try:
         proj = await tasks_col.find_one({"_id": ObjectId(project_id)})
    except:
         raise HTTPException(status_code=400, detail="ID không hợp lệ")

    if not proj:
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án")
        
    members_raw = proj.get("assigned_to", [])
    members_info = []
    for member_id in members_raw:
        try:
             user = await users_col.find_one({"_id": ObjectId(member_id)})
             if user:
                  members_info.append({
                       "id": str(user["_id"]),
                       "full_name": user.get("full_name"),
                       "avatar": user.get("avatar")
                  })
        except:
             pass

    return {
        "id": str(proj["_id"]),
        "name": proj.get("title"),
        "description": proj.get("description"),
        "status": proj.get("status"),
        "end_date": proj.get("deadline"),
        "team_members": members_info,
        "team_count": len(members_raw),
        "created_by": proj.get("assigned_by"),
        "created_at": proj.get("created_at")
    }
    return {
        "id": str(proj["_id"]),
        "name": proj.get("title"),
        "description": proj.get("description"),
        "status": proj.get("status"),
        "end_date": proj.get("deadline"),
        "team_members": members_info,
        "team_count": len(members_raw),
        "created_by": proj.get("assigned_by"),
        "created_at": proj.get("created_at")
    }

@router.put("/{project_id}")
async def update_project(
    project_id: str,
    data: ProjectCreate,
    current_user = Depends(get_current_user)
):
    """Update standalone task acting as project (Leader/Admin only)"""
    if current_user.get("role") not in [UserRole.LEADER.value, UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền sửa dự án")
        
    tasks_col = get_tasks_collection()
    
    update_doc = {
        "title": data.name,
        "description": data.description,
        "deadline": data.end_date,
        "assigned_to": data.team_members or [],
        "updated_at": datetime.utcnow()
    }
    
    try:
        await tasks_col.update_one({"_id": ObjectId(project_id)}, {"$set": update_doc})
    except:
         raise HTTPException(status_code=400, detail="ID không hợp lệ")
         
    return {"message": "Cập nhật dự án thành công"}



@router.put("/{project_id}/status")
async def update_project_status(
    project_id: str,
    status: ProjectStatus,
    current_user = Depends(get_current_user)
):
    """Update project status"""
    if current_user.get("role") not in [UserRole.LEADER.value, UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền cập nhật trạng thái")
    
    tasks_col = get_tasks_collection()
    
    await tasks_col.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": {"status": status.value, "updated_at": datetime.utcnow()}}
    )
    return {"message": f"Đã cập nhật trạng thái: {status.value}"}

# ============ MEMBER MANAGEMENT ============

from pydantic import BaseModel as PydanticModel
from typing import List as TypeList

class MemberIds(PydanticModel):
    member_ids: TypeList[str]

@router.get("/{project_id}/members")
async def get_project_members(
    project_id: str,
    current_user = Depends(get_current_user)
):
    """Get all members of a project"""
    tasks_col = get_tasks_collection()
    users_col = get_users_collection()
    
    project = await tasks_col.find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án")
    
    members = []
    for member_id in project.get("assigned_to", []):
        try:
            user = await users_col.find_one({"_id": ObjectId(member_id)})
            if user:
                members.append({
                    "id": str(user["_id"]),
                    "full_name": user.get("full_name"),
                    "email": user.get("email"),
                    "avatar": user.get("avatar"),
                    "position": user.get("position"),
                    "department": user.get("department")
                })
        except:
            pass
    
    return members

@router.post("/{project_id}/members")
async def add_project_members(
    project_id: str,
    data: MemberIds,
    current_user = Depends(get_current_user)
):
    """Add members to project"""
    if current_user.get("role") not in [UserRole.LEADER.value, UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền thêm thành viên")
    
    projects_col = get_projects_collection()
    
    await projects_col.update_one(
        {"_id": ObjectId(project_id)},
        {
            "$addToSet": {"team_members": {"$each": data.member_ids}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return {"message": f"Đã thêm {len(data.member_ids)} thành viên"}

@router.delete("/{project_id}/members/{member_id}")
async def remove_project_member(
    project_id: str,
    member_id: str,
    current_user = Depends(get_current_user)
):
    """Remove member from project"""
    if current_user.get("role") not in [UserRole.LEADER.value, UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền xóa thành viên")
    
    projects_col = get_projects_collection()
    
    await projects_col.update_one(
        {"_id": ObjectId(project_id)},
        {
            "$pull": {"team_members": member_id},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return {"message": "Đã xóa thành viên khỏi dự án"}

@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a project (Admin only)"""
    if current_user.get("role") not in [UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền xóa dự án")
    
    projects_col = get_projects_collection()
    tasks_col = get_tasks_collection()
    
    # Delete all tasks in project
    await tasks_col.delete_many({"project_id": project_id})
    
    # Delete project
    await projects_col.delete_one({"_id": ObjectId(project_id)})
    
    return {"message": "Đã xóa dự án"}

# ============ PHASE ENDPOINTS ============

@router.post("/{project_id}/phases")
async def create_phase(
    project_id: str,
    data: PhaseBase,
    current_user = Depends(get_current_user)
):
    """Create a new phase for a project (Leader/Admin only)"""
    if current_user.get("role") not in [UserRole.LEADER.value, UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền tạo giai đoạn")
        
    phases_col = get_phases_collection()
    
    phase = {
        "project_id": project_id,
        "name": data.name,
        "description": data.description,
        "order": data.order,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "created_at": datetime.utcnow()
    }
    
    result = await phases_col.insert_one(phase)
    return {"id": str(result.inserted_id), "message": "Tạo giai đoạn thành công"}

@router.get("/{project_id}/phases")
async def get_project_phases(
    project_id: str,
    current_user = Depends(get_current_user)
):
    """Get all phases in a project"""
    phases_col = get_phases_collection()
    
    phases = await phases_col.find({"project_id": project_id}).sort("order", 1).to_list(None)
    result = []
    for ph in phases:
        result.append({
            "id": str(ph["_id"]),
            "name": ph["name"],
            "description": ph.get("description"),
            "order": ph.get("order", 0),
            "start_date": ph.get("start_date"),
            "end_date": ph.get("end_date")
        })
    return result

@router.delete("/phases/{phase_id}")
async def delete_phase(
    phase_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a phase (Leader/Admin only)"""
    if current_user.get("role") not in [UserRole.LEADER.value, UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền xóa giai đoạn")
        
    phases_col = get_phases_collection()
    tasks_col = get_tasks_collection()
    
    # Optional: nullify or do something for tasks connected to it?
    await tasks_col.update_many({"phase_id": phase_id}, {"$set": {"phase_id": None}})
    
    result = await phases_col.delete_one({"_id": ObjectId(phase_id)})
    if result.deleted_count == 0:
         raise HTTPException(status_code=404, detail="Không tìm thấy giai đoạn")
    return {"message": "Đã xóa giai đoạn"}

# ============ TASK ENDPOINTS ============

@router.get("/{project_id}/tasks")
async def get_project_tasks(
    project_id: str,
    status: str = None,
    assigned_to: str = None,
    current_user = Depends(get_current_user)
):
    """Get all tasks in a project"""
    tasks_col = get_tasks_collection()
    users_col = get_users_collection()
    
    query = {"project_id": project_id}
    if status:
        query["status"] = status
    if assigned_to:
        query["assigned_to"] = {"$in": [assigned_to]}
    
    tasks = await tasks_col.find(query).sort("created_at", -1).to_list(None)
    
    result = []
    for task in tasks:
        # assigned_to is now a list of user IDs
        assignees = []
        for uid in (task.get("assigned_to") or []):
            try:
                user = await users_col.find_one({"_id": ObjectId(uid)})
                if user:
                    assignees.append({
                        "id": str(user["_id"]),
                        "full_name": user.get("full_name"),
                        "avatar": user.get("avatar")
                    })
            except:
                pass
        
        result.append({
            "id": str(task["_id"]),
            "title": task["title"],
            "description": task.get("description"),
            "priority": task.get("priority"),
            "status": task.get("status"),
            "deadline": task.get("deadline"),
            "progress": task.get("progress", 0),
            "assigned_to": assignees,
            "assigned_by": task.get("assigned_by"),
            "rejection_reason": task.get("rejection_reason"),
            "completion_file_id": task.get("completion_file_id"),
            "completion_file_name": task.get("completion_file_name"),
            "created_at": task.get("created_at")
        })
    
    return result

@router.post("/{project_id}/tasks")
async def create_task(
    project_id: str,
    data: TaskCreate,
    current_user = Depends(get_current_user)
):
    """Create a new task (Leader assigns to employee)"""
    if current_user.get("role") not in [UserRole.LEADER.value, UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền giao việc")
    
    tasks_col = get_tasks_collection()
    
    assigned_to = data.assigned_to or []
    task = {
        "project_id": project_id,
        "title": data.title,
        "description": data.description,
        "priority": data.priority.value,
        "deadline": data.deadline,
        "phase_id": data.phase_id,
        "assigned_to": assigned_to,
        "assigned_by": current_user["_id"],
        "status": TaskStatus.ASSIGNED.value if assigned_to else TaskStatus.TODO.value,
        "progress": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await tasks_col.insert_one(task)
    
    return {
        "id": str(result.inserted_id),
        "message": "Tạo task thành công"
    }

@router.get("/tasks/my-tasks")
async def get_my_tasks(
    status: str = None,
    current_user = Depends(get_current_user)
):
    """Get tasks assigned to current user (supports multi-assign list)"""
    tasks_col = get_tasks_collection()
    projects_col = get_projects_collection()
    
    # Support both old string format and new list format
    query = {"assigned_to": {"$in": [str(current_user["_id"])]}}
    if status:
        query["status"] = status
    
    tasks = await tasks_col.find(query).sort("deadline", 1).to_list(None)
    
    result = []
    for task in tasks:
        try:
            project = await projects_col.find_one({"_id": ObjectId(task["project_id"])})
        except:
            project = None
        
        result.append({
            "id": str(task["_id"]),
            "title": task["title"],
            "description": task.get("description"),
            "priority": task.get("priority"),
            "status": task.get("status"),
            "deadline": task.get("deadline"),
            "progress": task.get("progress", 0),
            "rejection_reason": task.get("rejection_reason"),
            "completion_file_id": task.get("completion_file_id"),
            "completion_file_name": task.get("completion_file_name"),
            "project_name": project.get("name") if project else "Unknown",
            "project_id": task["project_id"],
            "created_at": task.get("created_at")
        })
    
    return result

@router.get("/tasks/{task_id}")
async def get_task(
    task_id: str,
    current_user = Depends(get_current_user)
):
    """Get single task details"""
    tasks_col = get_tasks_collection()
    users_col = get_users_collection()
    projects_col = get_projects_collection()
    
    task = await tasks_col.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy task")
    
    # Get all assignees info (multi-assign as list)
    assignees = []
    for uid in (task.get("assigned_to") or []):
        try:
            user = await users_col.find_one({"_id": ObjectId(uid)})
            if user:
                assignees.append({
                    "id": str(user["_id"]),
                    "full_name": user.get("full_name"),
                    "avatar": user.get("avatar")
                })
        except:
            pass
    
    # Get project info
    project = await projects_col.find_one({"_id": ObjectId(task["project_id"])})
    
    return {
        "id": str(task["_id"]),
        "title": task["title"],
        "description": task.get("description"),
        "priority": task.get("priority"),
        "status": task.get("status"),
        "deadline": task.get("deadline"),
        "progress": task.get("progress", 0),
        "assigned_to": assignees,
        "assigned_by": task.get("assigned_by"),
        "rejection_reason": task.get("rejection_reason"),
        "completion_file_id": task.get("completion_file_id"),
        "completion_file_name": task.get("completion_file_name"),
        "project_id": task["project_id"],
        "project_name": project.get("name") if project else "Unknown",
        "created_at": task.get("created_at"),
        "updated_at": task.get("updated_at"),
        "completed_at": task.get("completed_at")
    }

class TaskUpdate(PydanticModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    deadline: Optional[datetime] = None
    assigned_to: Optional[List[str]] = None  # Multi-assign list
    status: Optional[str] = None

@router.put("/tasks/{task_id}")
async def update_task(
    task_id: str,
    data: TaskUpdate,
    current_user = Depends(get_current_user)
):
    """Update task (Leader/Admin only)"""
    if current_user.get("role") not in [UserRole.LEADER.value, UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền sửa task")
    
    tasks_col = get_tasks_collection()
    
    # Build update document
    update_doc = {"updated_at": datetime.utcnow()}
    if data.title is not None:
        update_doc["title"] = data.title
    if data.description is not None:
        update_doc["description"] = data.description
    if data.priority is not None:
        update_doc["priority"] = data.priority
    if data.deadline is not None:
        update_doc["deadline"] = data.deadline
    if data.status is not None:
        update_doc["status"] = data.status
        if data.status == "COMPLETED":
            update_doc["completed_at"] = datetime.utcnow()
            update_doc["progress"] = 100
            # Auto-delete project when task is done
            try:
                projects_col = get_projects_collection()
                task = await tasks_col.find_one({"_id": ObjectId(task_id)})
                if task and "project_id" in task:
                     await projects_col.delete_one({"_id": ObjectId(task["project_id"])})
            except:
                pass
    
    # Handle multi-assign reassignment
    if data.assigned_to is not None:
        update_doc["assigned_to"] = data.assigned_to
        # If reassigning with people, set status to ASSIGNED
        if data.status is None:
            update_doc["status"] = TaskStatus.ASSIGNED.value if data.assigned_to else TaskStatus.TODO.value
    
    await tasks_col.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": update_doc}
    )
    
    return {"message": "Cập nhật task thành công"}

@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a task (Leader/Admin only)"""
    if current_user.get("role") not in [UserRole.LEADER.value, UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền xóa task")
    
    tasks_col = get_tasks_collection()
    
    result = await tasks_col.delete_one({"_id": ObjectId(task_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Không tìm thấy task")
    
    return {"message": "Đã xóa task"}

@router.put("/tasks/{task_id}/accept")
async def respond_to_task(
    task_id: str,
    data: TaskAccept,
    current_user = Depends(get_current_user)
):
    """
    Accept or reject assigned task.
    If reject, must provide reason and optional evidence image.
    """
    tasks_col = get_tasks_collection()
    
    task = await tasks_col.find_one({
        "_id": ObjectId(task_id),
        "assigned_to": {"$in": [str(current_user["_id"])]},
        "status": TaskStatus.ASSIGNED.value
    })
    
    if not task:
        raise HTTPException(status_code=404, detail="Task không tồn tại hoặc không phải của bạn")
    
    if data.accepted:
        # Accept task
        await tasks_col.update_one(
            {"_id": ObjectId(task_id)},
            {"$set": {
                "status": TaskStatus.IN_PROGRESS.value,
                "accepted_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }}
        )
        return {"message": "Đã nhận việc"}
    else:
        # Reject task
        if not data.rejection_reason:
            raise HTTPException(status_code=400, detail="Vui lòng nhập lý do từ chối")
        
        await tasks_col.update_one(
            {"_id": ObjectId(task_id)},
            {"$set": {
                "status": TaskStatus.REJECTED.value,
                "rejection_reason": data.rejection_reason,
                "rejection_evidence": data.rejection_evidence,
                "rejected_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }}
        )
        
        # TODO: Notify leader
        
        return {"message": "Đã từ chối task"}

@router.put("/tasks/{task_id}/progress")
async def update_task_progress(
    task_id: str,
    data: TaskProgressUpdate,
    current_user = Depends(get_current_user)
):
    """Update task progress (0-100%) and log history"""
    tasks_col = get_tasks_collection()
    history_col = get_task_history_collection()
    
    task = await tasks_col.find_one({
        "_id": ObjectId(task_id),
        "assigned_to": {"$in": [str(current_user["_id"])]}
    })
    
    if not task:
        raise HTTPException(status_code=404, detail="Task không tồn tại hoặc không phải của bạn")
    
    old_progress = task.get("progress", 0)
    new_status = TaskStatus.IN_PROGRESS.value
    completed_at = None
    
    if data.progress == 100:
        new_status = TaskStatus.COMPLETED.value
        completed_at = datetime.utcnow()
        # Auto-delete project when task is done
        try:
            projects_col = get_projects_collection()
            if "project_id" in task:
                 await projects_col.delete_one({"_id": ObjectId(task["project_id"])})
        except:
            pass
        
    await tasks_col.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "progress": data.progress,
            "status": new_status,
            "completed_at": completed_at,
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Insert History Log
    await history_col.insert_one({
        "task_id": task_id,
        "updated_by": str(current_user["_id"]),
        "old_progress": old_progress,
        "new_progress": data.progress,
        "note": data.notes,
        "created_at": datetime.utcnow()
    })
    
    return {
        "message": f"Cập nhật tiến độ: {data.progress}%",
        "status": new_status
    }

@router.post("/tasks/{task_id}/complete")
async def complete_task_with_file(
    task_id: str,
    file: UploadFile = File(...),
    notes: Optional[str] = Form(None),
    current_user = Depends(get_current_user)
):
    """Mark a task as 100% complete and upload a completion file"""
    tasks_col = get_tasks_collection()
    history_col = get_task_history_collection()
    
    task = await tasks_col.find_one({
        "_id": ObjectId(task_id),
        "assigned_to": {"$in": [str(current_user["_id"])]}
    })
    
    if not task:
        raise HTTPException(status_code=404, detail="Task không tồn tại hoặc không phải của bạn")
        
    old_progress = task.get("progress", 0)
    
    # Upload file
    contents = await file.read()
    file_id = await GridFSService.upload_file(
        contents,
        file.filename,
        file.content_type or "application/octet-stream",
        {"category": "task_completion", "task_id": task_id}
    )
    
    completed_at = datetime.utcnow()
    new_status = TaskStatus.COMPLETED.value
    
    await tasks_col.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "progress": 100,
            "status": new_status,
            "completed_at": completed_at,
            "completion_file_id": str(file_id),
            "completion_file_name": file.filename,
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Auto-delete project when task is done (standalone task projects)
    try:
        projects_col = get_projects_collection()
        if "project_id" in task:
             await projects_col.delete_one({"_id": ObjectId(task["project_id"])})
    except:
        pass
        
    # Insert History Log
    await history_col.insert_one({
        "task_id": task_id,
        "updated_by": str(current_user["_id"]),
        "old_progress": old_progress,
        "new_progress": 100,
        "note": f"Đã hoàn thành và đính kèm file: {file.filename}. \n{notes or ''}",
        "created_at": datetime.utcnow()
    })
    
    return {
        "message": "Đã lưu tệp tin và hoàn thành công việc",
        "status": new_status,
        "file_id": str(file_id)
    }

@router.get("/tasks/{task_id}/history")
async def get_task_history(
    task_id: str,
    current_user = Depends(get_current_user)
):
    """Get history tracking updates of a task"""
    history_col = get_task_history_collection()
    users_col = get_users_collection()
    
    logs = await history_col.find({"task_id": task_id}).sort("created_at", -1).to_list(None)
    
    result = []
    for log in logs:
        user = await users_col.find_one({"_id": ObjectId(log["updated_by"])})
        result.append({
            "id": str(log["_id"]),
            "old_progress": log.get("old_progress", 0),
            "new_progress": log.get("new_progress", 0),
            "note": log.get("note"),
            "created_at": log.get("created_at"),
            "user": {
                "id": log["updated_by"],
                "full_name": user.get("full_name") if user else "Unknown User",
                "avatar": user.get("avatar") if user else None
            }
        })
        
    return result

@router.get("/stats/employee-performance")
async def get_employee_performance(
    current_user = Depends(get_current_user)
):
    """Get task completion statistics per employee (Leader/Admin only)"""
    if current_user.get("role") not in [UserRole.LEADER.value, UserRole.HR_MANAGER.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Không có quyền xem thống kê")
    
    tasks_col = get_tasks_collection()
    users_col = get_users_collection()
    
    # Get all employees
    employees = await users_col.find({"role": UserRole.EMPLOYEE.value}).to_list(None)
    
    result = []
    for emp in employees:
        emp_id = str(emp["_id"])
        
        # Get task counts
        total_tasks = await tasks_col.count_documents({"assigned_to": emp_id})
        completed_tasks = await tasks_col.count_documents({
            "assigned_to": emp_id,
            "status": TaskStatus.COMPLETED.value
        })
        in_progress = await tasks_col.count_documents({
            "assigned_to": emp_id,
            "status": TaskStatus.IN_PROGRESS.value
        })
        
        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        result.append({
            "user_id": emp_id,
            "full_name": emp.get("full_name", "Unknown"),
            "avatar": emp.get("avatar"),
            "department": emp.get("department"),
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "in_progress_tasks": in_progress,
            "completion_rate": round(completion_rate, 1)
        })
    
    # Sort by completion rate
    result.sort(key=lambda x: x["completion_rate"], reverse=True)
    
    return result
