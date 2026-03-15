from typing import List, Dict, Any
import logging
import base64
import io

# Optional import to avoid crash if paddleocr is not installed
try:
    from paddleocr import PaddleOCR
    PADDLE_AVAILABLE = True
except ImportError:
    PADDLE_AVAILABLE = False
    logging.warning("PaddleOCR not installed. OCR service will return mock data.")

class OCRService:
    def __init__(self, use_gpu: bool = False):
        self.ocr = None
        if PADDLE_AVAILABLE:
            # Initialize PaddleOCR
            # use_angle_cls=True allows detecting text at angles
            # lang='ch' for Chinese support
            try:
                self.ocr = PaddleOCR(use_angle_cls=True, lang='ch', use_gpu=use_gpu, show_log=False)
                logging.info("PaddleOCR initialized successfully.")
            except Exception as e:
                logging.error(f"Failed to initialize PaddleOCR: {e}")
                self.ocr = None

    def recognize_image(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Recognize text from image bytes.
        Returns structured result: {"text": "full text", "lines": [...]}
        """
        if not self.ocr:
            return {
                "text": "[Mock OCR] 这是一个模拟的识别结果。请安装 paddleocr 以启用真实功能。",
                "lines": ["这是一个模拟的识别结果。", "请安装 paddleocr 以启用真实功能。"],
                "raw": []
            }
        
        try:
            # PaddleOCR takes image path or numpy array. 
            # We can save bytes to temp file or convert to numpy using opencv/PIL
            # Here we assume the image_bytes is passed correctly, but PaddleOCR usually needs a file path or cv2 image
            # For simplicity in MVP, we might need to write to a temp file
            
            # Implementation detail: Convert bytes to cv2 image
            import cv2
            import numpy as np
            
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            result = self.ocr.ocr(img, cls=True)
            
            # result structure: [[[[x1,y1],[x2,y2]...], ("text", confidence)], ...]
            
            full_text = ""
            lines = []
            raw_data = []
            
            if result and result[0]:
                for line in result[0]:
                    text = line[1][0]
                    confidence = line[1][1]
                    lines.append(text)
                    full_text += text + "\n"
                    raw_data.append({
                        "box": line[0],
                        "text": text,
                        "confidence": confidence
                    })
            
            return {
                "text": full_text.strip(),
                "lines": lines,
                "raw": raw_data
            }
            
        except Exception as e:
            logging.error(f"OCR processing error: {e}")
            return {"error": str(e)}

# Singleton instance
ocr_service = OCRService()
