from typing import List, Dict, Any
import logging
import base64
import io
import os

# 设置 PaddleOCR 模型路径 - 强制使用项目内目录
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PYTHON_BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, '..'))
MODEL_DIR = os.path.join(PYTHON_BACKEND_DIR, '.paddlex', 'official_models')
os.makedirs(MODEL_DIR, exist_ok=True)

# 设置所有可能的环境变量，确保模型下载到项目目录
os.environ['PPOCR_HOME'] = MODEL_DIR
os.environ['PADDLE_OCR_HOME'] = MODEL_DIR
os.environ['PADDLE_HOME'] = MODEL_DIR
os.environ['PADDLE_PDX_HOME'] = os.path.join(PYTHON_BACKEND_DIR, '.paddlex')
os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'

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
            try:
                # 使用最小化参数初始化，让 PaddleOCR 自动下载模型到项目目录
                self.ocr = PaddleOCR(
                    use_angle_cls=True,
                    lang='ch'
                )
                logging.info("PaddleOCR initialized successfully.")
            except Exception as e:
                logging.error(f"Failed to initialize PaddleOCR: {e}")
                self.ocr = None

    def recognize_image(self, image_bytes: bytes) -> Dict[str, Any]:
        """识别图片中的文字"""
        if not self.ocr:
            return {
                "text": "[模拟 OCR] 这是一个模拟的识别结果。请安装 paddleocr 以启用真实功能。",
                "lines": ["这是一个模拟的识别结果。", "请安装 paddleocr 以启用真实功能。"],
                "raw": []
            }

        try:
            import cv2
            import numpy as np

            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            result = self.ocr.ocr(img, cls=True)

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

# 单例实例
ocr_service = OCRService()
