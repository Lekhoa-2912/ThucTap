import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# Danh sách tài khoản mẫu với các vai trò khác nhau
# LƯU Ý: Roles và Status phải viết HOA để khớp với Enum trong code
SAMPLE_USERS = [
    {
        "email": "admin@goodzwork.com",
        "password": "admin123",
        "full_name": "Super Admin",
        "role": "SUPER_ADMIN",
        "department": "Admin",
        "position": "Administrator",
        "phone": "0901234567",
        "status": "ACTIVE"
    },
    {
        "email": "hr@goodzwork.com",
        "password": "hr123456",
        "full_name": "Nguyễn Thị HR",
        "role": "HR_MANAGER",
        "department": "HR",
        "position": "HR Manager",
        "phone": "0901234568",
        "status": "ACTIVE"
    },
    {
        "email": "leader@goodzwork.com",
        "password": "leader123",
        "full_name": "Trần Văn Leader",
        "role": "LEADER",
        "department": "IT",
        "position": "Team Leader",
        "phone": "0901234569",
        "status": "ACTIVE"
    },
    {
        "email": "employee@goodzwork.com",
        "password": "emp123456",
        "full_name": "Lê Thị Employee",
        "role": "EMPLOYEE",
        "department": "IT",
        "position": "Developer",
        "phone": "0901234570",
        "status": "ACTIVE"
    },
    {
        "email": "accountant@goodzwork.com",
        "password": "acc123456",
        "full_name": "Phạm Văn Kế Toán",
        "role": "ACCOUNTANT",
        "department": "Finance",
        "position": "Accountant",
        "phone": "0901234571",
        "status": "ACTIVE"
    }
]

async def seed_users():
    mongo_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME")
    
    print(f"📡 Connecting to MongoDB Atlas...")
    print(f"📦 Database: {db_name}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    users_col = db.users
    
    print("\n🗑️ Xóa tất cả user cũ...")
    result = await users_col.delete_many({})
    print(f"   Đã xóa {result.deleted_count} user")
    
    print("\n👥 Tạo các tài khoản mẫu...\n")
    print("=" * 60)
    
    for user_data in SAMPLE_USERS:
        user_doc = {
            "email": user_data["email"],
            "hashed_password": hash_password(user_data["password"]),
            "full_name": user_data["full_name"],
            "role": user_data["role"],  # Đã sửa thành chữ HOA
            "department": user_data["department"],
            "position": user_data["position"],
            "phone": user_data["phone"],
            "status": user_data["status"],  # Đã sửa thành chữ HOA
            "face_registered": True,  # Skip face registration for demo
            "employee_id": f"{user_data['department'][:2].upper()}-001",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await users_col.insert_one(user_doc)
        
        role_emoji = {
            "SUPER_ADMIN": "👑",
            "HR_MANAGER": "🧑‍💼",
            "LEADER": "👨‍💻",
            "EMPLOYEE": "👤",
            "ACCOUNTANT": "💰"
        }
        
        print(f"{role_emoji.get(user_data['role'], '👤')} {user_data['role']}")
        print(f"   📧 Email: {user_data['email']}")
        print(f"   🔑 Password: {user_data['password']}")
        print(f"   👤 Name: {user_data['full_name']}")
        print(f"   🏢 Dept: {user_data['department']} - {user_data['position']}")
        print("-" * 60)
    
    print("\n✅ Hoàn tất! Đã tạo tất cả tài khoản.\n")
    
    # Verify
    total = await users_col.count_documents({})
    print(f"📊 Tổng số user trong database: {total}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_users())
