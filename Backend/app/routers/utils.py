from fastapi import APIRouter, UploadFile, File, HTTPException
import numpy as np
import cv2
import io
from PIL import Image

from ..services.ocr_service import ocr_service

router = APIRouter(prefix="/api/utils", tags=["Utils"])

@router.post("/ocr")
async def ocr_scan(file: UploadFile = File(...)):
    """
    Perform OCR on uploaded image (CCCD/CMND)
    """
    try:
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")
            
        contents = await file.read()
        
        # Convert to numpy array for PaddleOCR/OpenCV
        # Method 1: Use numpy frombuffer + cv2.imdecode
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
             raise HTTPException(status_code=400, detail="Invalid image")

        # Run OCR
        data = ocr_service.extract_cccd_info(image)
        
        if data is None:
             raise HTTPException(status_code=422, detail="OCR Failed: Could not init engine or no text found")
             
        if isinstance(data, dict) and "error" in data:
             raise HTTPException(status_code=422, detail=f"OCR Init Failed: {data['error']}")

        return data

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"OCR Error: {e}")
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")
