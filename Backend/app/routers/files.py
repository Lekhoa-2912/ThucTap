"""
File serving router - Serves files from MongoDB GridFS.
Replaces static file serving from filesystem.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from ..services.gridfs_service import GridFSService

router = APIRouter(prefix="/api/files", tags=["Files"])


@router.get("/{file_id}")
async def get_file(file_id: str):
    """
    Serve a file from GridFS by its ID.
    Includes browser caching headers for performance.
    """
    try:
        data, content_type, filename = await GridFSService.get_file(file_id)
        
        return Response(
            content=data,
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=86400",  # Cache 24h
                "Content-Disposition": f'inline; filename="{filename}"',
            }
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail="File không tồn tại")
