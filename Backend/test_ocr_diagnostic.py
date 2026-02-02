import cv2
import numpy as np
import sys

print(f"Python version: {sys.version}")

try:
    import paddle
    print(f"PaddlePaddle version: {paddle.__version__}")
except ImportError:
    print("PaddlePaddle not installed")

try:
    from paddleocr import PaddleOCR
    import paddleocr
    # print(f"PaddleOCR version: {paddleocr.__version__}") # Sometimes version is not exposed directly
except ImportError:
    print("PaddleOCR not installed")
    sys.exit(1)

# Create a dummy image
img = np.zeros((100, 100, 3), dtype=np.uint8)
cv2.putText(img, 'Hello', (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

print("Initializing PaddleOCR...")
try:
    ocr = PaddleOCR(use_angle_cls=False, lang='vi', show_log=False)
    print("Initialization successful")
    
    print("Running OCR...")
    # Try calling without arguments
    try:
        res = ocr.ocr(img)
        print("ocr(img) success")
    except Exception as e:
        print(f"ocr(img) failed: {e}")

    # Try calling with cls=False
    try:
        res = ocr.ocr(img, cls=False)
        print("ocr(img, cls=False) success")
    except Exception as e:
        print(f"ocr(img, cls=False) failed: {e}")

except Exception as e:
    print(f"Initialization failed: {e}")
