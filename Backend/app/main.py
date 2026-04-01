from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from .config import settings as settings_config
from .database import connect_to_mongo, close_mongo_connection, create_indexes, get_database
from .socket_events import socket_app

# Import routers
from .routers import auth, users, attendance, chat, projects, payroll, settings, leaves, notifications, calendar, overtime, exports, kpi, contracts, documents, utils, departments, files
from .routers import password_reset

# Create FastAPI app
app = FastAPI(
    title="GoodZWork API",
    description="HR Management System with AI Face Recognition",
    version="1.0.0"
)

# CORS middleware - Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Startup and shutdown events
@app.on_event("startup")
async def startup():
    print("✨ Starting GoodZWork API...")
    try:
        await connect_to_mongo()
        
        # Create directories (keep for backward compat during migration)
        os.makedirs(settings_config.FACE_DATA_PATH, exist_ok=True)
        os.makedirs(settings_config.UPLOADS_PATH, exist_ok=True)
        
        # Initialize GridFS
        from .services.gridfs_service import GridFSService
        GridFSService.initialize(get_database())
        
        # Create MongoDB indexes for performance
        print("📁 Verifying database indexes...")
        await create_indexes()
        
        # Pre-warm face recognition models (makes first check-in 5-10x faster)
        # We do this after indexes to avoid blocking database init
        try:
            from .services.face_recognition_service import face_service
            face_service.warm_up()
        except Exception as fe:
            print(f"⚠️ Face service warm-up delayed: {fe}")
            
        # Auto-cleanup old attendance photos (>3 months)
        try:
            await cleanup_old_attendance_photos()
        except Exception as ce:
            print(f"⚠️ Cleanup error: {ce}")
            
        print("🚀 GoodZWork API is ready and running successfully!")
    except Exception as e:
        print(f"❌ CRITICAL ERROR DURING STARTUP: {e}")
        # We still want the app to start if possible so we can see error logs via API
        pass

@app.on_event("shutdown")
async def shutdown():
    await close_mongo_connection()


async def cleanup_old_attendance_photos():
    """Delete attendance photos older than 3 months from GridFS."""
    from datetime import datetime, timedelta
    try:
        db = get_database()
        cutoff = datetime.utcnow() - timedelta(days=90)
        
        # Find old attendance photos in GridFS
        cursor = db["fs.files"].find({
            "metadata.type": "attendance",
            "metadata.timestamp": {"$lt": cutoff}
        })
        
        deleted = 0
        async for doc in cursor:
            from .services.gridfs_service import GridFSService
            await GridFSService.delete_file(str(doc["_id"]))
            deleted += 1
        
        if deleted > 0:
            print(f"🗑️ Cleaned up {deleted} attendance photos older than 3 months")
    except Exception as e:
        print(f"⚠️ Attendance photo cleanup skipped: {e}")


# Include routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(attendance.router)
app.include_router(chat.router)
app.include_router(projects.router)
app.include_router(payroll.router)
app.include_router(settings.router)
app.include_router(leaves.router)
app.include_router(notifications.router)
app.include_router(calendar.router)
app.include_router(overtime.router)
app.include_router(exports.router)
app.include_router(kpi.router)
app.include_router(contracts.router)
app.include_router(documents.router)
app.include_router(utils.router)
app.include_router(password_reset.router)
app.include_router(departments.router)
app.include_router(files.router)

# Mount static files for uploads (backward compat for old avatar URLs)
# Ensure the directory exists before mounting (StaticFiles crashes if dir is missing)
os.makedirs(settings_config.UPLOADS_PATH, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings_config.UPLOADS_PATH), name="uploads")

# Mount Socket.IO
app.mount("/socket.io", socket_app)

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "chào mừng tới GoodZWork API",
        "version": "1.0.0",
        "docs": "/docs",
        "features": [
            "AI Face Recognition (DeepFace + ArcFace)",
            "Geofencing Attendance",
            "Real-time Chat (Socket.IO)",
            "Project & Task Management",
            "Payroll System"
        ]
    }

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# API Info
@app.get("/api/info")
async def api_info():
    return {
        "endpoints": {
            "auth": "/api/auth - Authentication (login, register)",
            "users": "/api/users - User management, face enrollment",
            "attendance": "/api/attendance - GPS + Face check-in/out",
            "chat": "/api/chat - Real-time messaging",
            "projects": "/api/projects - Project & task management",
            "payroll": "/api/payroll - Salary calculation & payment"
        },
        "socket_events": {
            "send_message": "Send a new message",
            "new_message": "Receive new message",
            "typing": "Typing indicator",
            "mark_seen": "Mark messages as read",
            "revoke_message": "Recall a message"
        }
    }
