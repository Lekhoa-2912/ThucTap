from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

class Database:
    client: AsyncIOMotorClient = None
    
db = Database()

async def connect_to_mongo():
    """Connect to MongoDB on startup"""
    db.client = AsyncIOMotorClient(settings.MONGODB_URL)
    print(f"✅ Đã kết nối tới MongoDB: {settings.DATABASE_NAME}")

async def close_mongo_connection():
    """Close MongoDB connection on shutdown"""
    if db.client:
        db.client.close()
        print("❌ Đã ngắt kết nối MongoDB")

def get_database():
    """Get the database instance"""
    return db.client[settings.DATABASE_NAME]

async def create_indexes():
    """Create MongoDB indexes for performance optimization."""
    try:
        database = get_database()
        
        # Attendance logs - compound index for duplicate check-in/out queries
        attendance_col = database["attendance_logs"]
        await attendance_col.create_index(
            [("user_id", 1), ("attendance_type", 1), ("timestamp", -1)],
            name="idx_attendance_user_type_time"
        )
        await attendance_col.create_index(
            [("user_id", 1), ("timestamp", -1)],
            name="idx_attendance_user_time"
        )
        await attendance_col.create_index(
            [("timestamp", -1)],
            name="idx_attendance_time"
        )
        
        # Users - index on email (unique) and status
        users_col = database["users"]
        await users_col.create_index("email", unique=True, name="idx_users_email")
        await users_col.create_index("status", name="idx_users_status")
        
        # Conversations
        conversations_col = database["conversations"]
        await conversations_col.create_index(
            [("participants", 1)],
            name="idx_conversations_participants"
        )
        
        # Messages
        messages_col = database["messages"]
        await messages_col.create_index(
            [("conversation_id", 1), ("created_at", -1)],
            name="idx_messages_conv_time"
        )
        
        # Notifications
        notifications_col = database["notifications"]
        await notifications_col.create_index(
            [("user_id", 1), ("read", 1), ("created_at", -1)],
            name="idx_notifications_user_read_time"
        )
        
        print("✅ MongoDB indexes verified/created")
    except Exception as e:
        print(f"⚠️ Index creation skipped or failed: {e}")

# Collections
def get_users_collection():
    return get_database()["users"]

def get_attendance_collection():
    return get_database()["attendance_logs"]

def get_projects_collection():
    return get_database()["projects"]

def get_tasks_collection():
    return get_database()["tasks"]

def get_messages_collection():
    return get_database()["messages"]

def get_conversations_collection():
    return get_database()["conversations"]

def get_payrolls_collection():
    return get_database()["payrolls"]

def get_notifications_collection():
    return get_database()["notifications"]

def get_password_reset_collection():
    return get_database()["password_reset_requests"]

def get_task_history_collection():
    return get_database()["task_history"]

def get_phases_collection():
    return get_database()["phases"]

def get_departments_collection():
    return get_database()["departments"]
