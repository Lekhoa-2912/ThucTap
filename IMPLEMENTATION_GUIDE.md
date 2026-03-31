# Hướng Dẫn Cập Nhật Backend/app/main.py

## 📝 Các Thay Đổi Cần Thực Hiện

### 1. Thêm Imports Ở Đầu File

```python
# THÊM NHỮNG DÒNG NÀY ở đầu file, sau các imports hiện tại:

from fastapi.responses import JSONResponse
from datetime import datetime
from .exceptions import AppException
from .schemas.response import ErrorApiResponse
```

### 2. Thêm Exception Handler

```python
# THÊM NGAY SAU KHI TẠO APP (sau dòng: app = FastAPI(...))

# Exception handler for custom exceptions
@app.exception_handler(AppException)
async def app_exception_handler(request, exc: AppException):
    """Handle custom application exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
            "error_code": exc.code,
            "data": exc.details if exc.details else None,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    )


# Handler for generic HTTP exceptions
@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    """Handle unexpected exceptions"""
    import traceback
    import logging
    
    logger = logging.getLogger(__name__)
    logger.error(f"Unexpected error: {str(exc)}\n{traceback.format_exc()}")
    
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "error_code": "INTERNAL_ERROR",
            "data": None,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    )
```

### 3. Cập Nhật Health Check Endpoint

```python
# THAY THẾ endpoint /health hiện tại bằng:

@app.get("/health")
async def health_check():
    """Enhanced health check with database connectivity"""
    try:
        users_col = get_users_collection()
        await users_col.database.client.admin.command('ping')
        db_status = "connected"
    except Exception as e:
        db_status = "disconnected"
    
    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "database": db_status,
        "services": {
            "api": "ok",
            "database": db_status,
            "socket": "ok"
        }
    }
```

### 4. Cập Nhật API Info Endpoint

```python
# THAY THẾ endpoint /api/info hiện tại bằng:

@app.get("/api/info")
async def api_info():
    """API information and available endpoints"""
    return {
        "success": True,
        "data": {
            "api_name": "GoodZWork HR Management API",
            "version": "1.0.0",
            "environment": "development",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "features": [
                "AI Face Recognition (DeepFace + ArcFace)",
                "Geofencing Attendance",
                "Real-time Chat (Socket.IO)",
                "Project & Task Management",
                "Payroll System",
                "Leave Management",
                "KPI Review",
                "Document Management"
            ],
            "endpoints": {
                "authentication": "/api/auth",
                "users": "/api/users",
                "attendance": "/api/attendance",
                "chat": "/api/chat",
                "projects": "/api/projects",
                "payroll": "/api/payroll",
                "leaves": "/api/leaves",
                "overtime": "/api/overtime",
                "departments": "/api/departments",
                "settings": "/api/settings"
            },
            "documentation": "/docs",
            "health": "/health"
        },
        "message": "API information retrieved successfully"
    }
```

### 5. Cập Nhật Root Endpoint

```python
# THAY THẾ endpoint / hiện tại bằng:

@app.get("/")
async def root():
    """Root endpoint - API welcome message"""
    return {
        "success": True,
        "data": {
            "message": "Chào mừng tới GoodZWork API",
            "version": "1.0.0",
            "docs": "/docs",
            "health": "/health",
            "info": "/api/info"
        },
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
```

---

## 🔧 Quá Trình Thực Hiện

1. **Mở file:** `Backend/app/main.py`

2. **Thêm imports mới** ở đầu file (sau các imports hiện tại)

3. **Copy-paste exception handlers** ngay sau dòng tạo app

4. **Cập nhật 4 endpoints** như trên

5. **Lưu file** và restart server

---

## ✅ Kiểm Tra Sau Cập Nhật

```bash
# Terminal
cd Backend
python -m uvicorn app.main:app --reload

# Trong browser hoặc Postman:
# GET http://localhost:8000/
# GET http://localhost:8000/health
# GET http://localhost:8000/api/info
```

Bạn sẽ thấy responses theo format mới:
```json
{
    "success": true,
    "data": { ... },
    "message": "...",
    "timestamp": "2026-03-30T20:30:00Z"
}
```

---

## 📌 Lưu Ý Quan Trọng

1. **Không xóa** các `app.include_router()` hiện tại
2. **Đặt exception handlers** TRƯỚC khi include routers
3. **Kiểm tra indentation** khi copy-paste
4. **Restart server** sau khi cập nhật

---

## 🚨 Nếu Có Lỗi

Hãy check:
- ✅ File imports đúng chưa?
- ✅ Exception handlers nằm đúng vị trí chưa?
- ✅ Indentation có đúng không?
- ✅ Syntax có đúng không?

Chạy kiểm tra syntax:
```bash
python -m py_compile Backend/app/main.py
```

Nếu không có lỗi, file valid. Nếu có lỗi, kiểm tra line số được báo.
