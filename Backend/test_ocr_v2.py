from paddleocr import PaddleOCR
import numpy as np
import cv2

print("Init PaddleOCR...")
try:
    # Minimal init
    ocr = PaddleOCR(use_angle_cls=False, lang='vi') 
    print("Init success.")
except Exception as e:
    print(f"Init failed: {e}")
    exit(1)

# Dummy image
img = np.zeros((100, 100, 3), dtype=np.uint8)
cv2.putText(img, 'Test', (10, 50), cv2.FONT_HERSHEY_DUPLEX, 1, (255, 255, 255), 2)

print("\n--- TEST 1: ocr(img, cls=False) ---")
try:
    res = ocr.ocr(img, cls=False)
    print("TEST 1 SUCCESS")
except Exception as e:
    print(f"TEST 1 FAILED: {type(e).__name__}: {e}")

print("\n--- TEST 2: ocr(img) ---")
try:
    res = ocr.ocr(img)
    print("TEST 2 SUCCESS")
except Exception as e:
    print(f"TEST 2 FAILED: {type(e).__name__}: {e}")
