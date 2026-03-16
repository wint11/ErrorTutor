import os
import sys

# 必须在导入任何 paddle 相关库之前设置环境变量
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PADDLEX_HOME = os.path.join(CURRENT_DIR, '.paddlex')
os.makedirs(PADDLEX_HOME, exist_ok=True)

# 强制设置所有 Paddle 相关环境变量到项目目录
os.environ['PADDLE_PDX_HOME'] = PADDLEX_HOME
os.environ['PPOCR_HOME'] = os.path.join(PADDLEX_HOME, 'official_models')
os.environ['PADDLE_OCR_HOME'] = os.path.join(PADDLEX_HOME, 'official_models')
os.environ['HOME'] = CURRENT_DIR  # 覆盖 HOME 目录，这是 PaddleX 使用的
os.environ['USERPROFILE'] = CURRENT_DIR  # Windows 用户目录
os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import logging

# 添加当前目录到路径
sys.path.insert(0, CURRENT_DIR)

from services.ocr_service import ocr_service
from services.llm_factory import LLMFactory

app = FastAPI(title="ErrorTutor OCR & LLM Service")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger(__name__)

class OCRResponse(BaseModel):
    text: str
    lines: List[str]
    raw: Optional[List[dict]] = None

class ChatRequest(BaseModel):
    prompt: str
    provider: str = "deepseek"
    history: Optional[List[dict]] = None

class ChatResponse(BaseModel):
    response: str
    provider: str

@app.post("/api/v1/ocr/recognize", response_model=OCRResponse)
async def recognize_image(file: UploadFile = File(...)):
    """上传图片进行 OCR 识别"""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="文件必须是图片格式")

    try:
        contents = await file.read()
        result = ocr_service.recognize_image(contents)

        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])

        return OCRResponse(**result)
    except Exception as e:
        logger.error(f"OCR error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """与 LLM 对话"""
    try:
        llm = LLMFactory.create(request.provider)
        response = await llm.chat(request.prompt, request.history)
        return ChatResponse(response=response, provider=request.provider)
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "ocr_available": ocr_service.ocr is not None}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
