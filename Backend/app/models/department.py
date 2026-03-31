from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class DepartmentBase(BaseModel):
    name: str
    description: Optional[str] = None
    manager_id: Optional[str] = None  # ID of leader/manager

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    manager_id: Optional[str] = None

class Department(DepartmentBase):
    id: Optional[str] = Field(default=None, alias="_id")
    member_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
