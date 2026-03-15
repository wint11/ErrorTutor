from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import io
import logging

from app.services.ocr_service import ocr_service
from app.services.llm_factory import LLMFactory

router = APIRouter()
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

@router.post("/ocr/upload", response_model=OCRResponse)
async def upload_image_for_ocr(file: UploadFile = File(...)):
    """
    Upload an image for OCR processing.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        contents = await file.read()
        # Mocking OCR service call here for now as paddleocr might fail without cv2/numpy
        # In real scenario: result = ocr_service.recognize_image(contents)
        
        # We'll use the service but be prepared for failures
        # Note: ocr_service handles missing deps gracefully
        result = ocr_service.recognize_image(contents)
        
        if "error" in result:
             raise HTTPException(status_code=500, detail=result["error"])
             
        return OCRResponse(
            text=result.get("text", ""),
            lines=result.get("lines", []),
            raw=result.get("raw", [])
        )
        
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat/analyze", response_model=ChatResponse)
async def analyze_problem(request: ChatRequest):
    """
    Analyze the problem using LLM.
    """
    try:
        llm = LLMFactory.get_provider(request.provider)
        response_text = await llm.chat(
            prompt=request.prompt,
            system_prompt="You are a helpful math tutor. Break down the problem step-by-step.",
            history=request.history
        )
        return ChatResponse(response=response_text, provider=request.provider)
    except Exception as e:
        logger.error(f"LLM Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
