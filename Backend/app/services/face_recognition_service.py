import os
import cv2
import numpy as np
import base64
from typing import List, Tuple, Optional, Dict, Any
from datetime import datetime
from ..config import settings

# --- TF/Keras compatibility hack ---
import sys
try:
    import tensorflow.keras
except ImportError:
    try:
        import keras
        sys.modules['tensorflow.keras'] = keras
    except Exception:
        pass
# -----------------------------------

# Lazy import - DeepFace is heavy, only import when needed
_deepface = None

def _get_deepface():
    """Lazy import DeepFace to avoid slow startup."""
    global _deepface
    if _deepface is None:
        from deepface import DeepFace
        _deepface = DeepFace
    return _deepface


class FaceRecognitionService:
    """
    Advanced Face Recognition Service using DeepFace (ArcFace).
    - Model pre-warming at startup for fast first request
    - GridFS storage for face data (no local filesystem dependency)
    """
    
    def __init__(self):
        # Configuration
        self.model_name = "ArcFace"
        self.detector_backend = "opencv"  # Changed from retinaface to opencv for stability
        self.distance_metric = "cosine"
        self.threshold = 0.68
        self._model_warmed = False

    def warm_up(self):
        """
        Pre-load ArcFace + RetinaFace models into memory.
        Call once at server startup. Makes first check-in 5-10x faster.
        """
        if self._model_warmed:
            return
        
        try:
            print("🔄 Pre-loading face recognition models (ArcFace + RetinaFace)...")
            DeepFace = _get_deepface()
            
            # Create a small dummy image with a simple face-like pattern
            dummy = np.zeros((160, 160, 3), dtype=np.uint8)
            # Draw a simple circle to give the detector something to work with
            cv2.circle(dummy, (80, 60), 30, (200, 200, 200), -1)  # head
            cv2.circle(dummy, (70, 50), 5, (100, 100, 100), -1)   # left eye
            cv2.circle(dummy, (90, 50), 5, (100, 100, 100), -1)   # right eye
            cv2.ellipse(dummy, (80, 75), (15, 8), 0, 0, 180, (100, 100, 100), 2)  # mouth
            
            # Force model loading by running represent (will fail on dummy but loads model)
            try:
                DeepFace.represent(
                    img_path=dummy,
                    model_name=self.model_name,
                    detector_backend=self.detector_backend,
                    enforce_detection=False,
                    align=True
                )
            except Exception:
                pass  # Expected - dummy image won't have a real face
            
            self._model_warmed = True
            print("✅ Face recognition models loaded and ready!")
        except Exception as e:
            print(f"⚠️ Model warm-up had issues (will load on first request): {e}")

    def base64_to_image(self, base64_string: str) -> np.ndarray:
        """Convert base64 string to OpenCV image"""
        try:
            if "," in base64_string:
                base64_string = base64_string.split(",")[1]
            
            img_bytes = base64.b64decode(base64_string)
            img_array = np.frombuffer(img_bytes, dtype=np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            return img
        except Exception as e:
            print(f"Error converting base64 to image: {e}")
            return None
    
    def image_to_bytes(self, img: np.ndarray, quality: int = 85) -> bytes:
        """Convert OpenCV image to JPEG bytes."""
        _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, quality])
        return buffer.tobytes()
    
    def get_embedding(self, img: np.ndarray) -> Optional[List[float]]:
        """
        Extract 512D face embedding using ArcFace.
        Returns None if no face found.
        """
        try:
            DeepFace = _get_deepface()
            results = DeepFace.represent(
                img_path=img,
                model_name=self.model_name,
                detector_backend=self.detector_backend,
                enforce_detection=True,
                align=True
            )
            
            if not results:
                return None
                
            return results[0]["embedding"]
            
        except Exception as e:
            print(f"Error getting embedding: {e}")
            import traceback
            traceback.print_exc()
            return None

    def calculate_cosine_distance(self, source_representation: List[float], test_representation: List[float]) -> float:
        """Calculate cosine distance between two embeddings."""
        a = np.matmul(np.transpose(source_representation), test_representation)
        b = np.sum(np.multiply(source_representation, source_representation))
        c = np.sum(np.multiply(test_representation, test_representation))
        return 1 - (a / (np.sqrt(b) * np.sqrt(c)))

    async def enroll_faces(self, user_id: str, face_images: List[str]) -> Tuple[bool, str, list, list]:
        """
        Enroll user with DeepFace. Stores face images in GridFS.
        
        Returns:
            (success, message, encodings, face_image_ids)
        """
        from .gridfs_service import GridFSService
        
        encodings = []
        face_image_ids = []
        saved_count = 0
        MAX_ENROLLMENT_IMAGES = 3
        
        for idx, img_base64 in enumerate(face_images):
            if saved_count >= MAX_ENROLLMENT_IMAGES:
                break
                
            img = self.base64_to_image(img_base64)
            if img is None:
                continue
                
            embedding = self.get_embedding(img)
            
            if embedding:
                encodings.append(embedding)
                saved_count += 1
                
                # Save reference image to GridFS
                img_bytes = self.image_to_bytes(img)
                file_id = await GridFSService.upload_file(
                    img_bytes,
                    f"face_ref_{user_id}_{saved_count}.jpg",
                    content_type="image/jpeg",
                    metadata={
                        "type": "face_reference",
                        "user_id": user_id,
                        "index": saved_count
                    }
                )
                face_image_ids.append(file_id)
            else:
                print(f"Skipping image {idx}: No face detected or low quality.")

        if not encodings:
            return False, "Không thể phát hiện khuôn mặt rõ ràng trong các ảnh đã gửi. Vui lòng chụp lại, giữ khuôn mặt thẳng và đủ sáng.", [], []
        
        return True, f"Đăng ký thành công với {len(encodings)} mẫu khuôn mặt chất lượng cao!", encodings, face_image_ids
    
    async def enroll_single_image(self, user_id: str, image_base64: str) -> Tuple[bool, str, list]:
        """Auto-enroll user with a single image."""
        success, message, encodings, _ = await self.enroll_faces(user_id, [image_base64])
        return success, message, encodings
    
    def verify_face(self, face_image: str, stored_encodings: List[List[float]]) -> Tuple[bool, float, str]:
        """
        Verify if face matches stored encodings using DeepFace embeddings.
        
        Returns:
            (is_match, confidence_score, message)
        """
        try:
            img = self.base64_to_image(face_image)
            if img is None:
                return False, 0.0, "Ảnh không hợp lệ"
            
            current_embedding = self.get_embedding(img)
            
            if current_embedding is None:
                return False, 0.0, "Không phát hiện được khuôn mặt trong ảnh"
            
            min_distance = float("inf")
            
            for stored_enc in stored_encodings:
                dist = self.calculate_cosine_distance(current_embedding, stored_enc)
                if dist < min_distance:
                    min_distance = dist
            
            if min_distance <= self.threshold:
                confidence = max(0, (1 - min_distance) * 100)
                return True, confidence, f"Xác thực thành công (Khớp: {confidence:.1f}%)"
            else:
                confidence = max(0, (1 - min_distance) * 100)
                return False, confidence, f"Khuôn mặt không khớp (Độ tin cậy: {confidence:.1f}%)"
                
        except Exception as e:
            print(f"Face verification error: {e}")
            return False, 0.0, f"Lỗi xác thực: {str(e)}"
    
    async def save_attendance_image(self, user_id: str, face_image: str, check_type: str) -> str:
        """Save attendance check image to GridFS. Returns file_id or empty string."""
        from .gridfs_service import GridFSService
        
        try:
            img = self.base64_to_image(face_image)
            if img is None:
                return ""
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{user_id}_{check_type}_{timestamp}.jpg"
            
            img_bytes = self.image_to_bytes(img, quality=75)  # Lower quality for attendance photos
            file_id = await GridFSService.upload_file(
                img_bytes,
                filename,
                content_type="image/jpeg",
                metadata={
                    "type": "attendance",
                    "user_id": user_id,
                    "check_type": check_type,
                    "timestamp": datetime.now()
                }
            )
            
            return f"/api/files/{file_id}"
        except Exception as e:
            print(f"Error saving attendance image: {e}")
            return ""

    async def delete_user_faces(self, user_id: str, face_image_ids: list = None) -> bool:
        """Delete all face data for a user from GridFS."""
        from .gridfs_service import GridFSService
        
        try:
            if face_image_ids:
                await GridFSService.delete_files(face_image_ids)
            return True
        except Exception as e:
            print(f"Error deleting face data: {e}")
            return False


# Singleton instance
face_service = FaceRecognitionService()
