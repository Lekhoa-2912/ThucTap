import os
import cv2
import numpy as np
import base64
from typing import List, Tuple, Optional, Dict, Any
from datetime import datetime
from ..config import settings
from deepface import DeepFace

class FaceRecognitionService:
    """
    Advanced Face Recognition Service using DeepFace (ArcFace).
    Replaces legacy Haar Cascade/Histogram methods.
    """
    
    def __init__(self):
        self.face_data_path = settings.FACE_DATA_PATH
        self.uploads_path = settings.UPLOADS_PATH
        
        # Ensure directories exist
        os.makedirs(self.face_data_path, exist_ok=True)
        os.makedirs(self.uploads_path, exist_ok=True)
        
        # Configuration
        self.model_name = "ArcFace"
        self.detector_backend = "retinaface" # Stronger detection
        self.distance_metric = "cosine"
        # ArcFace cosine threshold is typically 0.68. 
        # We use a slightly stricter one for better security or looser if needed.
        self.threshold = 0.68 

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
    
    def get_embedding(self, img: np.ndarray) -> Optional[List[float]]:
        """
        Extract 512D face embedding using ArcFace.
        Returns None if no face or multiple faces found (unless handled).
        """
        try:
            # DeepFace.represent returns a list of dicts
            results = DeepFace.represent(
                img_path=img,
                model_name=self.model_name,
                detector_backend=self.detector_backend,
                enforce_detection=True,
                align=True
            )
            
            if not results:
                return None
                
            # Return the embedding of the first detected face
            # In a stricter system, we might reject if len(results) > 1
            return results[0]["embedding"]
            
        except Exception as e:
            print(f"Error getting embedding: {e}")
            return None

    def calculate_cosine_distance(self, source_representation: List[float], test_representation: List[float]) -> float:
        """
        Calculate cosine distance between two embeddings.
        """
        a = np.matmul(np.transpose(source_representation), test_representation)
        b = np.sum(np.multiply(source_representation, source_representation))
        c = np.sum(np.multiply(test_representation, test_representation))
        return 1 - (a / (np.sqrt(b) * np.sqrt(c)))

    def enroll_faces(self, user_id: str, face_images: List[str]) -> Tuple[bool, str, List[List[float]]]:
        """
        Enroll user with DeepFace.
        Only needs 1-3 good images.
        
        Returns:
            (success, message, encodings)
        """
        user_face_dir = os.path.join(self.face_data_path, str(user_id))
        os.makedirs(user_face_dir, exist_ok=True)
        
        encodings = []
        saved_count = 0
        
        # We only need a few valid images now
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
                
                # Save the image for reference
                saved_count += 1
                face_path = os.path.join(user_face_dir, f"ref_{saved_count}.jpg")
                cv2.imwrite(face_path, img)
            else:
                print(f"Skipping image {idx}: No face detected or low quality.")

        if not encodings:
            return False, "Không thể phát hiện khuôn mặt rõ ràng trong các ảnh đã gửi. Vui lòng chụp lại, giữ khuôn mặt thẳng và đủ sáng.", []
        
        return True, f"Đăng ký thành công với {len(encodings)} mẫu khuôn mặt chất lượng cao!", encodings
    
    def enroll_single_image(self, user_id: str, image_base64: str) -> Tuple[bool, str, List[float]]:
        """
        Auto-enroll user with a single image.
        """
        return self.enroll_faces(user_id, [image_base64])
    
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
            
            # Get embedding of the probe image
            current_embedding = self.get_embedding(img)
            
            if current_embedding is None:
                return False, 0.0, "Không phát hiện được khuôn mặt trong ảnh"
            
            # Compare with all stored embeddings
            # We look for the MINIMUM distance (best match)
            min_distance = float("inf")
            
            for stored_enc in stored_encodings:
                dist = self.calculate_cosine_distance(current_embedding, stored_enc)
                if dist < min_distance:
                    min_distance = dist
            
            # Convert distance to confidence score (approximate)
            # Threshold is self.threshold. 
            # If dist = 0, confidence = 100%. If dist = threshold, confidence = 50% (just a heuristic mapping)
            
            if min_distance <= self.threshold:
                # Map [0, threshold] to [100, 50] linearly-ish or just inverted
                # Simple inversion: (1 - dist) * 100 might be too linear.
                # Let's use relative to threshold.
                score = (1 - (min_distance / (self.threshold * 2))) * 100 # Just a safe visualization
                # Or simply:
                confidence = max(0, (1 - min_distance) * 100)
                
                return True, confidence, f"Xác thực thành công (Khớp: {confidence:.1f}%)"
            else:
                confidence = max(0, (1 - min_distance) * 100)
                return False, confidence, f"Khuôn mặt không khớp (Độ tin cậy: {confidence:.1f}%)"
                
        except Exception as e:
            print(f"Face verification error: {e}")
            return False, 0.0, f"Lỗi xác thực: {str(e)}"
    
    def save_attendance_image(self, user_id: str, face_image: str, check_type: str) -> str:
        """Save attendance check image"""
        try:
            img = self.base64_to_image(face_image)
            if img is None:
                return ""
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{user_id}_{check_type}_{timestamp}.jpg"
            
            attendance_dir = os.path.join(self.uploads_path, "attendance")
            os.makedirs(attendance_dir, exist_ok=True)
            
            filepath = os.path.join(attendance_dir, filename)
            cv2.imwrite(filepath, img)
            
            return f"/uploads/attendance/{filename}"
        except Exception as e:
            print(f"Error saving attendance image: {e}")
            return ""

    def delete_user_faces(self, user_id: str) -> bool:
        """Delete all face data for a user"""
        try:
            import shutil
            user_face_dir = os.path.join(self.face_data_path, str(user_id))
            if os.path.exists(user_face_dir):
                shutil.rmtree(user_face_dir)
            return True
        except Exception as e:
            print(f"Error deleting face data: {e}")
            return False

# Singleton instance
face_service = FaceRecognitionService()
