import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def test_connection():
    mongo_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME")
    
    print(f"📡 Testing connection to: {mongo_url}")
    print(f"📦 Database name: {db_name}")
    
    try:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        
        # Test connection
        await client.admin.command('ping')
        print("✅ Connected to MongoDB Atlas successfully!")
        
        # List databases
        dbs = await client.list_database_names()
        print(f"📚 Available databases: {dbs}")
        
        # Check users collection
        db = client[db_name]
        users_count = await db.users.count_documents({})
        print(f"👥 Users in database: {users_count}")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())
