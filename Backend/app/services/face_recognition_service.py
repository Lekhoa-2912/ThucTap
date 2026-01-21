import os
import cv2
import numpy as np
import base64
from typing import List, Tuple, Optional
from datetime import datetime
from ..config import settings

class FaceRecognitionService:
    """
    Simplified Face Recognition Service using OpenCV.
    Works without DeepFace/TensorFlow for better compatibility.
    Uses face histograms for basic face comparison.
    """
    
    def __init__(self):
        self.face_data_path = settings.FACE_DATA_PATH
        self.uploads_path = settings.UPLOADS_PATH
        
        # Ensure directories exist
        os.makedirs(self.face_data_path, exist_ok=True)
        os.makedirs(self.uploads_path, exist_ok=True)
        
        # Load Haar Cascade for face detection
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
    
    def base64_to_image(self, base64_string: str) -> np.ndarray:
        """Convert base64 string to OpenCV image"""
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
        
        img_bytes = base64.b64decode(base64_string)
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        return img
    
    def detect_face(self, img: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        """Detect face using OpenCV Haar Cascade"""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(50, 50)
        )
        
        if len(faces) > 0:
            return tuple(faces[0])  # (x, y, w, h)
        return None
    
    def extract_face_histogram(self, img: np.ndarray, face_rect: Tuple[int, int, int, int]) -> List[float]:
        """
        Extract face histogram as simple encoding.
        Returns normalized histogram as face "embedding".
        """
        x, y, w, h = face_rect
        face_roi = img[y:y+h, x:x+w]
        
        # Resize to standard size
        face_resized = cv2.resize(face_roi, (100, 100))
        
        # Convert to grayscale and compute histogram
        gray = cv2.cvtColor(face_resized, cv2.COLOR_BGR2GRAY)
        
        # Calculate histogram
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
        hist = cv2.normalize(hist, hist).flatten()
        
        return hist.tolist()
    
    def calculate_laplacian_variance(self, img: np.ndarray) -> float:
        """Calculate Laplacian variance to detect blur"""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        return laplacian.var()
    
    def is_image_blurry(self, img: np.ndarray, threshold: float = 50.0) -> bool:
        """Check if image is too blurry"""
        return self.calculate_laplacian_variance(img) < threshold
    
    def enroll_faces(self, user_id: str, face_images: List[str]) -> Tuple[bool, str, List[List[float]]]:
        """
        Process face images and extract encodings for enrollment.
        Uses adaptive filtering to keep at least 50 valid images.
        
        Returns:
            (success, message, encodings)
        """
        MIN_REQUIRED_IMAGES = 50
        MAX_IMAGES_TO_KEEP = 100
        
        user_face_dir = os.path.join(self.face_data_path, str(user_id))
        os.makedirs(user_face_dir, exist_ok=True)
        
        # Step 1: Score all images based on quality
        scored_images = []
        for idx, img_base64 in enumerate(face_images):
            try:
                img = self.base64_to_image(img_base64)
                
                # Detect face first
                face_rect = self.detect_face(img)
                if face_rect is None:
                    continue  # No face detected, skip
                
                # Calculate blur score (higher = sharper)
                blur_score = self.calculate_laplacian_variance(img)
                
                # Calculate face size score (larger face = better)
                x, y, w, h = face_rect
                face_size_score = (w * h) / (img.shape[0] * img.shape[1])
                
                # Combined quality score
                quality_score = blur_score * 0.7 + (face_size_score * 1000) * 0.3
                
                scored_images.append({
                    'idx': idx,
                    'img': img,
                    'face_rect': face_rect,
                    'blur_score': blur_score,
                    'quality_score': quality_score
                })
                    
            except Exception as e:
                print(f"Error processing image {idx}: {e}")
                continue
        
        # Step 2: Sort by quality score (best first)
        scored_images.sort(key=lambda x: x['quality_score'], reverse=True)
        
        # Step 3: Keep at least MIN_REQUIRED_IMAGES, up to MAX_IMAGES_TO_KEEP
        images_to_keep = min(max(len(scored_images), 0), MAX_IMAGES_TO_KEEP)
        
        # If we have more than MIN_REQUIRED_IMAGES, we can be more selective
        # If less, keep all we have
        if len(scored_images) >= MIN_REQUIRED_IMAGES:
            images_to_keep = min(len(scored_images), MAX_IMAGES_TO_KEEP)
        
        selected_images = scored_images[:images_to_keep]
        
        # Step 4: Extract encodings from selected images
        encodings = []
        saved_count = 0
        for item in selected_images:
            try:
                encoding = self.extract_face_histogram(item['img'], item['face_rect'])
                encodings.append(encoding)
                
                # Save reference images (first 20)
                if saved_count < 20:
                    saved_count += 1
                    face_path = os.path.join(user_face_dir, f"face_{saved_count}.jpg")
                    cv2.imwrite(face_path, item['img'])
                    
            except Exception as e:
                print(f"Error extracting encoding: {e}")
                continue
        
        valid_count = len(encodings)
        
        if valid_count < MIN_REQUIRED_IMAGES:
            return False, f"Không đủ ảnh khuôn mặt hợp lệ. Chỉ có {valid_count} ảnh (cần ít nhất {MIN_REQUIRED_IMAGES} ảnh). Vui lòng chụp thêm ảnh rõ nét hơn.", []
        
        return True, f"Đăng ký thành công với {valid_count} ảnh khuôn mặt chất lượng tốt!", encodings
    
    def compare_histograms(self, hist1: List[float], hist2: List[float]) -> float:
        """Compare two histograms using correlation"""
        h1 = np.array(hist1, dtype=np.float32)
        h2 = np.array(hist2, dtype=np.float32)
        return cv2.compareHist(h1, h2, cv2.HISTCMP_CORREL)
    
    def verify_face(self, face_image: str, stored_encodings: List[List[float]]) -> Tuple[bool, float, str]:
        """
        Verify if face matches stored encodings.
        
        Returns:
            (is_match, confidence, message)
        """
        try:
            img = self.base64_to_image(face_image)
            
            # Detect face
            face_rect = self.detect_face(img)
            if face_rect is None:
                return False, 0.0, "Không phát hiện được khuôn mặt trong ảnh"
            
            # Extract encoding
            current_encoding = self.extract_face_histogram(img, face_rect)
            
            # Compare with stored encodings
            best_score = 0.0
            for stored_enc in stored_encodings:
                score = self.compare_histograms(current_encoding, stored_enc)
                if score > best_score:
                    best_score = score
            
            # Threshold for match
            threshold = 0.5
            confidence = best_score * 100
            
            if best_score >= threshold:
                return True, confidence, f"Xác thực thành công (độ tin cậy: {confidence:.1f}%)"
            else:
                return False, confidence, f"Khuôn mặt không khớp (độ tin cậy: {confidence:.1f}%)"
                
        except Exception as e:
            print(f"Face verification error: {e}")
            return False, 0.0, f"Lỗi xác thực: {str(e)}"
    
    def save_attendance_image(self, user_id: str, face_image: str, check_type: str) -> str:
        """Save attendance check image"""
        try:
            img = self.base64_to_image(face_image)
            
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

# Singleton instance
face_service = FaceRecognitionService()
