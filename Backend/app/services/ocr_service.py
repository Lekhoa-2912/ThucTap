import paddleocr

class OCRService:
    def __init__(self):
        # Initialize PaddleOCR with Vietnamese support
        try:
            print(f"PaddleOCR Version: {paddleocr.__version__}")
            # Disable use_angle_cls as it causes crashes. Remove show_log as it might be unsupported in this version.
            self.ocr = PaddleOCR(use_angle_cls=False, lang='vi')
            print("PaddleOCR initialized successfully (angle_cls=False, minimal args)")
        except Exception as e:
            print(f"Failed to initialize PaddleOCR: {e}")
            self.ocr = None

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
        if self.ocr is None:
            return {"error": "OCR engine not initialized"}

        lines = []
        
        # Try different rotations: 0, 90, 270, 180
        # We check for keywords to determine if rotation is correct
        rotations = [0, 90, 270, 180]
        
        for angle in rotations:
            print(f"--- Trying OCR with rotation {angle} ---")
            img_rotated = self._rotate_image(image_array, angle)
            
            try:
                # Force disable cls attribute to avoid internal keyword error
                if hasattr(self.ocr, 'cls'):
                    self.ocr.cls = False
                    
                try:
                    # Attempt 1: Standard call (new versions might default cls=True)
                    # We pass cls=False explicitly
                    result = self.ocr.ocr(img_rotated, cls=False)
                except TypeError:
                    # Attempt 2: If kwarg not supported, call without it
                    try:
                        result = self.ocr.ocr(img_rotated)
                    except TypeError as te:
                         # Attempt 3: If still 'unexpected keyword cls', it might be internal
                         # Try passing explicit definition of what we want
                         print(f"Angle {angle} TypeError: {te}. Trying fallback with det=True, rec=True.")
                         result = self.ocr.ocr(img_rotated, det=True, rec=True)

            except Exception as e:
                print(f"OCR failed at angle {angle}: {e}")
                continue

            if not result or not result[0]:
                continue
                
            current_lines = [line[1][0] for line in result[0]]
            full_text_upper = "\n".join(current_lines).upper()

            # Check criteria for valid rotation
            # Keywords that must appear in a valid CCCD scan
            keywords = ["CỘNG HÒA", "SOCIALIST", "CĂN CƯỚC", "IDENTITY CARD", "VIỆT NAM"]
            score = sum(1 for k in keywords if k in full_text_upper)
            
            print(f"Angle {angle} score: {score}")
            if score >= 1:
                # Found a good orientation
                lines = current_lines
                break
        
        # If still no lines (tried all rotations), stick with the last result or empty
        # But we need at least one result ideally.
        # If lines is empty here, it means no rotation satisfied the keywords.
        # We might want to fallback to 0 degrees result if lines is empty but we had SOME result.
        # For simplicity, if lines is empty, we return empty structure.

        extracted_data = {
            "full_name": None,
            "dob": None,
            "address": None, 
            "hometown": None, 
            "cccd_number": None,
            "raw_text": "\n".join(lines) if lines else ""
        }

        if not lines:
             print("No text detected in any orientation")
             return extracted_data
        
        # DEBUG: Print detected lines
        print("\n--- OCR DETECTED LINES (FINAL) ---")
        for l in lines:
            print(l)
        print("--------------------------\n")

        # Enhanced Parsing Logic
        
        # 1. Join all text for global regex search
        full_text = "\n".join(lines)
        
        # 2. Iterate lines for specific processing
        for i, line in enumerate(lines):
            line_clean = line.strip()
            line_upper = line_clean.upper()
            
            # CCCD Number (12 digits)
            if not extracted_data["cccd_number"]:
                match = re.search(r'\b\d{12}\b', line_clean)
                if match:
                    extracted_data["cccd_number"] = match.group(0)

            # Name Detection (Improved)
            # Look for lines that are ALL UPPERCASE and have 2+ words, excluding known keywords
            if not extracted_data["full_name"]:
                # Strategy: Check if this line is a label "Họ và tên" and take next line
                if any(kw in line_upper for kw in ["HỌ VÀ TÊN", "HO VA TEN", "FULL NAME"]):
                    if i + 1 < len(lines):
                        next_line = lines[i+1].trip()
                        if next_line.isupper() and len(next_line.split()) >= 2:
                            extracted_data["full_name"] = next_line
                
                # Fallback: Just look for a standalone uppercase line that looks like a name
                # Avoid header words like CỘNG HÒA, ĐỘC LẬP, CĂN CƯỚC, CÔNG DÂN
                elif line_clean.isupper() and len(line_clean.split()) >= 2:
                    is_excluded = any(kw in line_upper for kw in [
                        "CỘNG HÒA", "ĐỘC LẬP", "HẠNH PHÚC", "CĂN CƯỚC", "CÔNG DÂN", "SOCIALIST", "REPUBLIC", "IDENTITY", "CARD",
                        "SỐ", "NO.", "CÓ GIÁ TRỊ", "DATE", "SEX", "NAM", "NỮ", "QUỐC TỊCH", "VIỆT NAM", "HỌ VÀ TÊN"
                    ])
                    # Often name is below "Họ và tên", but sometimes OCR merges prompt and value on same line is rare for CCCD
                    # But often name is the largest/most prominent Uppercase text in the middle
                    if not is_excluded:
                         # Additional Check: Name usually doesn't contain numbers
                        if not re.search(r'\d', line_clean):
                            # Verify if it's likely a name (2-5 words)
                            if 2 <= len(line_clean.split()) <= 6:
                                extracted_data["full_name"] = line_clean

            # DOB Detection (dd/mm/yyyy)
            if not extracted_data["dob"]:
                # Try finding date pattern
                date_match = re.search(r'\b\d{2}/\d{2}/\d{4}\b', line_clean)
                if date_match:
                    # Check context. Is it DOB or Expiry?
                    # DOB usually appears first or near "Ngày sinh". Expiry near "giá trị"
                    # If line contains "Ngày sinh" or "Date of birth" -> High confidence
                    if any(kw in line_upper for kw in ["NGÀY SINH", "DATE OF BIRTH", "SINH"]):
                         extracted_data["dob"] = date_match.group(0)
                    else:
                        # Store as candidate if we haven't found definite DOB yet
                        # Usually DOB is the first date found in standard layout, 
                        # but Expiry is at bottom.
                        # Let's rely on "Ngày sinh" detection first.
                        pass
                
                # Check labels
                if any(kw in line_upper for kw in ["NGÀY SINH", "DATE OF BIRTH"]):
                     # If date not in this line, check next line
                    if i + 1 < len(lines):
                         next_match = re.search(r'\b\d{2}/\d{2}/\d{4}\b', lines[i+1])
                         if next_match:
                             extracted_data["dob"] = next_match.group(0)

            # Hometown / Quê quán
            if not extracted_data["hometown"] and any(kw in line_upper for kw in ["QUÊ QUÁN", "PLACE OF ORIGIN"]):
                # Extract content after label
                parts = re.split(r'[:|Quê quán|Place of origin]', line_clean, flags=re.IGNORECASE)
                if len(parts) > 1 and len(parts[-1].strip()) > 3:
                     extracted_data["hometown"] = parts[-1].strip()
                elif i + 1 < len(lines):
                    # Take next line if it doesn't look like another label
                    next_line = lines[i+1].split(":", 1)[-1].strip() # Handle 'prefix: content'
                    extracted_data["hometown"] = next_line

            # Address / Thường trú
            if not extracted_data["address"] and any(kw in line_upper for kw in ["THƯỜNG TRÚ", "RESIDENCE"]):
                 # Extract content after label
                parts = re.split(r'[:|thường trú|residence]', line_clean, flags=re.IGNORECASE)
                if len(parts) > 1 and len(parts[-1].strip()) > 3:
                     extracted_data["address"] = parts[-1].strip()
                elif i + 1 < len(lines):
                    # Next line
                    extracted_data["address"] = lines[i+1].strip()
                    # Address often spans 2 lines
                    if i + 2 < len(lines) and not any(k in lines[i+2].upper() for k in ["GIÁ TRỊ", "DATE"]):
                        extracted_data["address"] += ", " + lines[i+2].strip()

        # Final Fallback for DOB if strictly not found near label: just take first date that < 2020
        if not extracted_data["dob"]:
             matches = re.findall(r'\b\d{2}/\d{2}/\d{4}\b', full_text)
             for m in matches:
                 # Simple check if year < current year - 10
                 try:
                     year = int(m.split('/')[-1])
                     if 1900 < year < 2020: # Assuming adults
                         extracted_data["dob"] = m
                         break
                 except: pass

        return extracted_data

ocr_service = OCRService()
