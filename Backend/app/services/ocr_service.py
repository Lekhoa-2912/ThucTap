"""
OCR Service - CCCD/CMND Vietnamese ID Card Reader
Uses EasyOCR with Vietnamese + English languages
"""
import easyocr
import cv2
import re
import os


class OCRService:
    def __init__(self):
        self.reader = None
        self._initializing = False

    def get_reader(self):
        """Lazy-load EasyOCR reader on first call."""
        if self.reader is not None:
            return self.reader

        if self._initializing:
            import time
            for _ in range(120):
                time.sleep(0.5)
                if self.reader is not None:
                    return self.reader
            print("⚠️ EasyOCR init timed out.")
            return None

        try:
            self._initializing = True
            print("🔄 Initializing EasyOCR (Vietnamese + English)...")
            self.reader = easyocr.Reader(['vi', 'en'], gpu=False)
            print("✅ EasyOCR ready!")
        except Exception as e:
            print(f"❌ EasyOCR init failed: {e}")
            self.reader = None
        finally:
            self._initializing = False
        return self.reader

    # ------------------------------------------------------------------
    # Core: run OCR on image → get raw text lines
    # ------------------------------------------------------------------
    def _run_ocr(self, image):
        """Run EasyOCR on a numpy image or file path, return list of text lines."""
        reader = self.get_reader()
        if reader is None:
            return []

        try:
            results = reader.readtext(image)
        except Exception as e:
            print(f"OCR error: {e}")
            return []

        if not results:
            return []

        lines = []
        for item in results:
            bbox, text, conf = item
            lines.append({"text": text.strip(), "conf": conf})

        return lines

    # ------------------------------------------------------------------
    # Main extraction logic
    # ------------------------------------------------------------------
    def extract_cccd_info(self, image_array):
        """
        Extract structured info from Vietnamese CCCD/CMND image.
        image_array: numpy array (BGR from cv2)
        Returns dict with: full_name, dob, gender, nationality,
        cccd_number, place_of_origin, permanent_address, raw_text.
        """
        debug_path = os.path.join(os.getcwd(), "ocr_debug.txt")

        raw_lines = self._run_ocr(image_array)

        # If no text found, try enhanced contrast
        if not raw_lines:
            print("⚡ No text found. Trying enhanced contrast...")
            try:
                gray = cv2.cvtColor(image_array, cv2.COLOR_BGR2GRAY)
                enhanced = cv2.convertScaleAbs(gray, alpha=1.5, beta=20)
                raw_lines = self._run_ocr(enhanced)
            except Exception as e:
                print(f"Enhancement failed: {e}")

        texts = [item["text"] for item in raw_lines]

        # Debug log
        try:
            with open(debug_path, "w", encoding="utf-8") as f:
                f.write(f"IMAGE_SHAPE: {image_array.shape}\n")
                f.write(f"TOTAL_LINES: {len(texts)}\n")
                f.write("--- RAW OCR LINES ---\n")
                for i, item in enumerate(raw_lines):
                    f.write(f"[{i}] (conf={item['conf']:.3f}) {item['text']}\n")
        except:
            pass

        # Build result dict – all None by default
        extracted = {
            "full_name": None,
            "dob": None,
            "gender": None,
            "nationality": "Việt Nam",
            "cccd_number": None,
            "place_of_origin": None,
            "permanent_address": None,
            "raw_text": "\n".join(texts)
        }

        if not texts:
            return extracted

        # ----------------------------------------------------------
        # Normalize helper
        # ----------------------------------------------------------
        def norm(s):
            """Normalize Vietnamese text for keyword matching."""
            return s.upper().strip()

        # ----------------------------------------------------------
        # Parse each line
        # ----------------------------------------------------------
        for i, line in enumerate(texts):
            lc = line.strip()
            lu = norm(lc)

            # ---- 1. CCCD Number (12 digits) ----
            if not extracted["cccd_number"]:
                m = re.search(r'(\d[\s.]*){12}', lc)
                if m:
                    num = re.sub(r'[\s.]', '', m.group(0))
                    if len(num) >= 12:
                        extracted["cccd_number"] = num[:12]

            # ---- 2. Full Name ----
            # EasyOCR often puts the label and value on separate lines
            if not extracted["full_name"]:
                if any(kw in lu for kw in [
                    "HỌ VÀ TÊN", "HỌ TÊN", "HỌ, CHỮ ĐỆM", "CHỮ ĐỆM VÀ TÊN",
                    "FULL NAME", "HO VA TEN", "FUL", "FUFAUE", "FUIL NAME"
                ]):
                    # Check if name is on the same line after colon
                    parts = re.split(r'[:/]', lc, maxsplit=1)
                    if len(parts) > 1 and len(parts[1].strip()) > 3:
                        extracted["full_name"] = parts[1].strip().upper()
                    else:
                        # Name is on the next line(s)
                        for offset in [1, 2]:
                            if i + offset < len(texts):
                                nl = texts[i + offset].strip()
                                nlu = norm(nl)
                                # Skip label lines
                                if any(k in nlu for k in [
                                    "NGÀY", "DATE", "GIỚI", "SEX", "SỐ", "NO:",
                                    "QUỐC", "NATIONAL", "QUÊ", "ORIGIN"
                                ]):
                                    break
                                if len(nl) >= 3 and not nl.isdigit():
                                    extracted["full_name"] = nl.upper()
                                    break

            # ---- 3. Date of Birth ----
            if not extracted["dob"]:
                # Check for date pattern anywhere
                m = re.search(r'(\d{2}[/\-\.]\d{2}[/\-\.]\d{4})', lc)
                if m:
                    date_str = m.group(1).replace('-', '/').replace('.', '/')
                    # Only set if we're near a DOB label or this is the first date found
                    if any(kw in norm(texts[max(0,i-2):i+1][0] if i > 0 else lc) for kw in ["NGÀY", "DATE", "SINH", "BIRTH"]):
                        extracted["dob"] = date_str
                    elif not extracted["dob"]:
                        # First date found, likely DOB (appears before expiry)
                        extracted["dob"] = date_str

            # ---- 4. Gender ----
            if not extracted["gender"]:
                if any(kw in lu for kw in ["GIỚI", "SEX", "GIOI"]):
                    # Search current + next lines for Nam/Nữ
                    search_range = texts[i:min(i+3, len(texts))]
                    search_text = " ".join(search_range).upper()
                    if "NỮ" in search_text or "FEMALE" in search_text or "NU" in search_text:
                        extracted["gender"] = "FEMALE"
                    elif "NAM" in search_text or "MALE" in search_text:
                        extracted["gender"] = "MALE"

            # ---- 5. Nationality ----
            if any(kw in lu for kw in ["QUỐC TỊCH", "NATIONALITY", "QUOC TICH", "NATONONTY"]):
                # Check next lines
                for offset in [0, 1, 2]:
                    if i + offset < len(texts):
                        nl = texts[i + offset].strip()
                        if "VIỆT" in nl.upper() or "VIET" in nl.upper():
                            extracted["nationality"] = "Việt Nam"
                            break

            # ---- 6. Place of Origin (Quê quán) ----
            if not extracted["place_of_origin"]:
                if any(kw in lu for kw in ["QUÊ QUÁN", "QUE QUAN", "QUC QUAN", "ORIGIN"]):
                    origin_parts = []
                    # Check same line after colon
                    parts = re.split(r'[:]', lc, maxsplit=1)
                    if len(parts) > 1 and len(parts[1].strip()) > 2:
                        origin_parts.append(parts[1].strip())

                    # Collect next lines until we hit "thường trú" or "residence"
                    for offset in [1, 2, 3, 4]:
                        if i + offset < len(texts):
                            nl = texts[i + offset].strip()
                            nlu = norm(nl)
                            if any(k in nlu for k in [
                                "THƯỜNG TRÚ", "THUONG TRU", "RESIDENCE",
                                "CÓ GIÁ TRỊ", "EXPIRY", "NGÀY"
                            ]):
                                break
                            if len(nl) > 1 and not any(k in nlu for k in ["PLACE", "OF"]):
                                origin_parts.append(nl)

                    if origin_parts:
                        extracted["place_of_origin"] = ", ".join(origin_parts)

            # ---- 7. Permanent Address (Nơi thường trú) ----
            if not extracted["permanent_address"]:
                if any(kw in lu for kw in [
                    "THƯỜNG TRÚ", "THUONG TRU", "RESIDENCE"
                ]):
                    addr_parts = []
                    # Check same line after colon
                    parts = re.split(r'[:]', lc, maxsplit=1)
                    if len(parts) > 1 and len(parts[1].strip()) > 2:
                        addr_parts.append(parts[1].strip())

                    # Collect next lines until we hit expiry/other section
                    for offset in [1, 2, 3, 4]:
                        if i + offset < len(texts):
                            nl = texts[i + offset].strip()
                            nlu = norm(nl)
                            if any(k in nlu for k in [
                                "CÓ GIÁ TRỊ", "EXPIRY", "DATE OF EXPIRY",
                                "GIÁM ĐỐC", "CỤC TRƯỞNG", "DIRECTOR"
                            ]):
                                break
                            if len(nl) > 1 and not any(k in nlu for k in ["PLACE", "OF"]):
                                addr_parts.append(nl)

                    if addr_parts:
                        extracted["permanent_address"] = ", ".join(addr_parts)

        # ----------------------------------------------------------
        # Fallbacks
        # ----------------------------------------------------------
        full_text = " ".join(texts)

        # CCCD number fallback
        if not extracted["cccd_number"]:
            m = re.search(r'(\d[\s.]*){12}', full_text)
            if m:
                num = re.sub(r'[\s.]', '', m.group(0))
                if len(num) >= 12:
                    extracted["cccd_number"] = num[:12]

        # Name fallback: look for UPPERCASE Vietnamese name pattern
        if not extracted["full_name"]:
            skip_words = [
                "CỘNG HÒA", "CĂN CƯỚC", "IDENTITY", "CARD", "SOCIALIST",
                "VIET NAM", "VIỆT NAM", "CÔNG DÂN", "CITIZEN", "CONG HOA"
            ]
            for t in texts:
                tc = t.strip()
                if tc.isupper() and 2 <= len(tc.split()) <= 5:
                    if not any(k in tc.upper() for k in skip_words):
                        extracted["full_name"] = tc
                        break

        # DOB fallback
        if not extracted["dob"]:
            m = re.search(r'(\d{2}/\d{2}/\d{4})', full_text)
            if m:
                extracted["dob"] = m.group(1)

        # Gender fallback from full text
        if not extracted["gender"]:
            if " NAM " in full_text.upper() or "\nNAM\n" in ("\n" + full_text.upper() + "\n"):
                extracted["gender"] = "MALE"
            elif " NỮ " in full_text.upper():
                extracted["gender"] = "FEMALE"

        # Debug final results
        try:
            with open(debug_path, "a", encoding="utf-8") as f:
                f.write("\n--- EXTRACTED RESULTS ---\n")
                for k, v in extracted.items():
                    if k != "raw_text":
                        f.write(f"{k}: {v}\n")
        except:
            pass

        return extracted


ocr_service = OCRService()
