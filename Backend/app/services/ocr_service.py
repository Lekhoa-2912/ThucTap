import paddleocr
from paddleocr import PaddleOCR
import cv2
import re
class OCRService:
    def __init__(self):
        self.ocr = None
        self._initializing = False

    def get_ocr(self):
        """Lazy load PaddleOCR model on first use."""
        if self.ocr is None:
            if self._initializing:
                # If already initializing, wait longer (first time download is heavy)
                import time
                for _ in range(60): # Wait up to 30s
                    time.sleep(0.5)
                    if self.ocr is not None: return self.ocr
                print("⚠️ OCR initialization timed out (another process is likely busy).")
                return None
                
            try:
                self._initializing = True
                print("🔄 Starting PaddleOCR (Vietnamese) initialization... This might include downloading models.")
                # use_gpu=False is safer for general environments
                self.ocr = PaddleOCR(use_angle_cls=False, lang='vi', use_gpu=False)
                print("✅ PaddleOCR initialized successfully!")
            except Exception as e:
                print(f"❌ Failed to initialize PaddleOCR: {e}")
                self.ocr = None
            finally:
                self._initializing = False
        return self.ocr

    def _rotate_image(self, image, angle):
        if angle == 90:
            return cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
        elif angle == 180:
            return cv2.rotate(image, cv2.ROTATE_180)
        elif angle == 270:
            return cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)
        return image

    def extract_cccd_info(self, image_array):
        """
        Extract info from CCCD image array (numpy)
        """
        import os
        debug_path = os.path.join(os.getcwd(), "ocr_debug.txt")
        
        ocr_engine = self.get_ocr()
        if ocr_engine is None:
            return {"error": "OCR engine not initialized or failed to load"}

        lines = []
        rotations = [0, 90, 270, 180]
        
        for angle in rotations:
            print(f"--- Trying OCR with rotation {angle} ---")
            img_rotated = self._rotate_image(image_array, angle)
            
            # --- Pass 1: Standard ---
            try:
                if hasattr(ocr_engine, 'cls'): ocr_engine.cls = False
                result = ocr_engine.ocr(img_rotated, cls=False)
                print(f"Angle {angle} RAW_RETS: {str(result)[:200]}...")
            except Exception as e:
                print(f"OCR failed at angle {angle}: {e}")
                continue

            # --- Pass 2: Grayscale & Contrast (If Pass 1 failed) ---
            if not result or not result[0]:
                print(f"Angle {angle}: No text found, trying pre-processed fallback...")
                try:
                    gray = cv2.cvtColor(img_rotated, cv2.COLOR_BGR2GRAY)
                    enhanced = cv2.convertScaleAbs(gray, alpha=1.5, beta=10) # Increase contrast
                    result = ocr_engine.ocr(enhanced, cls=False)
                except Exception as e:
                    print(f"OCR fallback failed at angle {angle}: {e}")

            if not result or not result[0]: continue
                
            current_lines = [line[1][0] for line in result[0] if line and len(line) > 1]
            full_text_upper = "\n".join(current_lines).upper()

            # Keywords
            keywords = ["CỘNG HÀA", "SOCIALIST", "CĂN CƯỚC", "IDENTITY CARD", "VIỆT NAM", "IDENTIFICATION"]
            score = sum(1 for k in keywords if k in full_text_upper)
            
            if score >= 1:
                lines = current_lines
                break
        
        if not lines:
             print("⚠️ Still no text found after all rotations and pre-processing.")
             # One LAST attempt: Any text from any orientation is better than nothing
             if 'current_lines' in locals() and current_lines:
                  lines = current_lines

        extracted_data = {
            "full_name": None,
            "dob": None,
            "gender": None,
            "nationality": "Việt Nam",
            "cccd_number": None,
            "raw_text": "\n".join(lines) if lines else ""
        }

        # PROACTIVE DEBUG LOGGING
        try:
            with open(debug_path, "w", encoding="utf-8") as f:
                f.write(f"IMAGE_SHAPE: {image_array.shape}\n")
                f.write("--- RAW OCR LINES ---\n")
                for l in lines: f.write(f"{l}\n")
        except: pass

        if not lines: return extracted_data

        full_text = " ".join(lines)
        
        for i, line in enumerate(lines):
            l_c = line.strip()
            l_u = l_c.upper()
            
            # 1. CCCD Number (Case-insensitive 12 digits)
            if not extracted_data["cccd_number"]:
                m = re.search(r'(\d[\s\.]*){12}', l_c)
                if m:
                    extracted_data["cccd_number"] = re.sub(r'[\s\.]', '', m.group(0))

            # 2. Full Name
            if not extracted_data["full_name"]:
                if any(kw in l_u for kw in ["FULL NAME", "HỌ VÀ TÊN", "HỌ, CHỮ ĐỆM", "HỌ TÊN", "CHỮ ĐỆM"]):
                    parts = re.split(r'[:/]', l_c)
                    candidate = parts[-1].strip()
                    if len(candidate.split()) >= 2 and candidate.isupper():
                        extracted_data["full_name"] = candidate
                    if not extracted_data["full_name"]:
                        for offset in [1, 2]:
                            if i + offset < len(lines):
                                next_l = lines[i+offset].strip()
                                if len(next_l.split()) >= 2 and next_l.isupper() and not any(k in next_l.upper() for k in ["SEX", "NAM", "NỮ", "SỐ", "IDENTIFICATION"]):
                                    extracted_data["full_name"] = next_l
                                    break

            # 3. DOB
            if not extracted_data["dob"]:
                m = re.search(r'(\d{2}/\d{2}/\d{4})', l_c)
                if m:
                    extracted_data["dob"] = m.group(1)
                elif any(kw in l_u for kw in ["DATE OF BIRTH", "NGÀY SINH"]):
                     search_space = l_c + " " + (lines[i+1] if i + 1 < len(lines) else "")
                     m2 = re.search(r'(\d{2}/\d{2}/\d{4})', search_space)
                     if m2: extracted_data["dob"] = m2.group(1)

            # 4. Gender
            if not extracted_data["gender"]:
                if any(kw in l_u for kw in ["SEX", "GIỚI TÍNH"]):
                    search_txt = l_u + " " + (lines[i+1].upper() if i + 1 < len(lines) else "")
                    if "NAM" in search_txt or "MALE" in search_txt: extracted_data["gender"] = "MALE"
                    elif "NỮ" in search_txt or "FEMALE" in search_txt: extracted_data["gender"] = "FEMALE"

        # --- FINAL AGGRESSIVE FALLBACK ---
        if not extracted_data["cccd_number"]:
            m = re.search(r'(\d[\s\.]*){12}', full_text)
            if m: extracted_data["cccd_number"] = re.sub(r'[\s\.]', '', m.group(0))

        if not extracted_data["full_name"]:
             for l in lines:
                 l_c = l.strip()
                 if l_c.isupper() and 2 <= len(l_c.split()) <= 6:
                      if not any(k in l_c.upper() for k in ["CỘNG HÒA", "CĂN CƯỚC", "IDENTITY", "CARD", "SOCIALIST", "VIET NAM"]):
                           extracted_data["full_name"] = l_c
                           break
        
        if not extracted_data["dob"]:
             m = re.search(r'(\d{2}/\d{2}/\d{4})', full_text)
             if m: extracted_data["dob"] = m.group(1)

        try:
            with open(debug_path, "a", encoding="utf-8") as f:
                f.write("\n--- FINAL RESULTS ---\n")
                for k, v in extracted_data.items(): f.write(f"{k}: {v}\n")
        except: pass

        return extracted_data

ocr_service = OCRService()
