"""
GridFS Storage Service - Store files in MongoDB instead of filesystem.
Handles avatars, face reference images, and attendance photos.
"""
import base64
from typing import Optional, Tuple, Dict, Any
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from datetime import datetime


class GridFSService:
    """Service for storing and retrieving files from MongoDB GridFS."""
    
    _bucket: AsyncIOMotorGridFSBucket = None
    
    @classmethod
    def initialize(cls, database):
        """Initialize GridFS bucket with database reference."""
        cls._bucket = AsyncIOMotorGridFSBucket(database)
        print("✅ GridFS storage initialized")
    
    @classmethod
    def get_bucket(cls) -> AsyncIOMotorGridFSBucket:
        if cls._bucket is None:
            from ..database import get_database
            cls._bucket = AsyncIOMotorGridFSBucket(get_database())
        return cls._bucket
    
    @classmethod
    async def upload_file(
        cls,
        file_data: bytes,
        filename: str,
        content_type: str = "application/octet-stream",
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Upload file to GridFS.
        Returns: file_id as string
        """
        bucket = cls.get_bucket()
        meta = metadata or {}
        meta["content_type"] = content_type
        meta["uploaded_at"] = datetime.utcnow()
        
        file_id = await bucket.upload_from_stream(
            filename,
            file_data,
            metadata=meta
        )
        return str(file_id)
    
    @classmethod
    async def upload_base64_image(
        cls,
        base64_string: str,
        filename: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Upload a base64-encoded image to GridFS.
        Returns: file_id as string
        """
        # Strip data URI prefix if present
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
        
        img_bytes = base64.b64decode(base64_string)
        return await cls.upload_file(
            img_bytes,
            filename,
            content_type="image/jpeg",
            metadata=metadata
        )
    
    @classmethod
    async def get_file(cls, file_id: str) -> Tuple[bytes, str, str]:
        """
        Get file from GridFS.
        Returns: (file_data, content_type, filename)
        """
        bucket = cls.get_bucket()
        oid = ObjectId(file_id)
        
        # Get file info
        grid_out = await bucket.open_download_stream(oid)
        data = await grid_out.read()
        
        content_type = "application/octet-stream"
        filename = grid_out.filename or "file"
        
        if grid_out.metadata:
            content_type = grid_out.metadata.get("content_type", content_type)
        
        return data, content_type, filename
    
    @classmethod
    async def delete_file(cls, file_id: str) -> bool:
        """Delete file from GridFS."""
        try:
            bucket = cls.get_bucket()
            await bucket.delete(ObjectId(file_id))
            return True
        except Exception as e:
            print(f"Error deleting GridFS file {file_id}: {e}")
            return False
    
    @classmethod
    async def delete_files(cls, file_ids: list) -> int:
        """Delete multiple files from GridFS. Returns count of deleted."""
        deleted = 0
        for fid in file_ids:
            if fid and await cls.delete_file(fid):
                deleted += 1
        return deleted
    
    @classmethod
    async def file_exists(cls, file_id: str) -> bool:
        """Check if a file exists in GridFS."""
        try:
            bucket = cls.get_bucket()
            from ..database import get_database
            db = get_database()
            doc = await db["fs.files"].find_one({"_id": ObjectId(file_id)})
            return doc is not None
        except Exception:
            return False


gridfs_service = GridFSService()
