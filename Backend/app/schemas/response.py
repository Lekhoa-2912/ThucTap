"""
Standard API Response Schemas
"""
from pydantic import BaseModel
from typing import Generic, TypeVar, Optional, List, Any
from datetime import datetime

T = TypeVar('T')


class ApiResponse(BaseModel, Generic[T]):
    """
    Standard API Response wrapper for all endpoints
    
    Example:
    {
        "success": true,
        "data": { ... },
        "error": null,
        "error_code": null,
        "message": "Operation successful",
        "timestamp": "2026-03-30T20:30:00Z"
    }
    """
    success: bool
    data: Optional[T] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    message: Optional[str] = None
    timestamp: datetime = datetime.utcnow()
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() + "Z"
        }


class ListApiResponse(BaseModel, Generic[T]):
    """
    Standard API Response for list endpoints
    
    Example:
    {
        "success": true,
        "data": [ ... ],
        "pagination": {
            "total": 100,
            "page": 1,
            "page_size": 10,
            "total_pages": 10
        },
        "message": "Operations retrieved successfully",
        "timestamp": "2026-03-30T20:30:00Z"
    }
    """
    success: bool
    data: List[T]
    pagination: Optional['Pagination'] = None
    message: Optional[str] = None
    timestamp: datetime = datetime.utcnow()
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() + "Z"
        }


class Pagination(BaseModel):
    """Pagination metadata"""
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool = False
    has_prev: bool = False
    
    @staticmethod
    def calculate(total: int, page: int, page_size: int) -> 'Pagination':
        """Helper method to calculate pagination"""
        total_pages = (total + page_size - 1) // page_size  # Ceiling division
        return Pagination(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )


class ErrorApiResponse(BaseModel):
    """
    Error API Response
    
    Example:
    {
        "success": false,
        "error": "User not found",
        "error_code": "NOT_FOUND",
        "data": {
            "resource": "User",
            "resource_id": "123"
        },
        "message": null,
        "timestamp": "2026-03-30T20:30:00Z"
    }
    """
    success: bool = False
    error: str
    error_code: str
    data: Optional[dict] = None
    message: Optional[str] = None
    timestamp: datetime = datetime.utcnow()
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() + "Z"
        }


class HealthCheckResponse(BaseModel):
    """Health check response"""
    status: str  # "healthy" or "unhealthy"
    timestamp: datetime = datetime.utcnow()
    database: str = "unknown"  # "connected" or "disconnected"
    services: Optional[dict] = None  # {"ocr": "ok", "face_recognition": "ok"}
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() + "Z"
        }


# Helper functions
def success_response(
    data: T,
    message: str = None,
    status_code: int = 200
) -> dict:
    """Helper to create success response"""
    return {
        "success": True,
        "data": data,
        "message": message,
        "timestamp": datetime.utcnow()
    }


def list_response(
    data: List[T],
    total: int,
    page: int,
    page_size: int,
    message: str = None
) -> dict:
    """Helper to create list response with pagination"""
    return {
        "success": True,
        "data": data,
        "pagination": Pagination.calculate(total, page, page_size),
        "message": message,
        "timestamp": datetime.utcnow()
    }


def error_response(
    error: str,
    error_code: str,
    details: dict = None,
    status_code: int = 400
) -> dict:
    """Helper to create error response"""
    return {
        "success": False,
        "error": error,
        "error_code": error_code,
        "data": details,
        "timestamp": datetime.utcnow()
    }
