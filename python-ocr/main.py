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
from rag.services.bailian_memory import BailianMemory, get_bailian_memory

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="ErrorTutor OCR & LLM Service")

# 初始化记忆库（如果配置了）
memory_service: Optional[BailianMemory] = None
try:
    memory_service = get_bailian_memory()
    logger.info("记忆库服务初始化成功")
except ValueError as e:
    logger.warning(f"记忆库服务未配置: {e}")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class OCRResponse(BaseModel):
    text: str
    lines: List[str]
    raw: Optional[List[dict]] = None

class ChatRequest(BaseModel):
    prompt: str
    provider: str = "deepseek"
    history: Optional[List[dict]] = None
    student_id: Optional[str] = None
    problem_context: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    provider: str


class MemoryAddRequest(BaseModel):
    student_id: str
    messages: List[dict]
    memory_content: Optional[str] = None


class MemoryQueryRequest(BaseModel):
    query: str
    student_id: Optional[str] = None
    top_k: int = 5


class TutoringSessionRequest(BaseModel):
    student_id: str
    problem: str
    error_type: str
    hint_provided: str
    student_response: str
    session_messages: List[dict]

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
    """与 LLM 对话（支持记忆库上下文）"""
    try:
        # 如果有学生ID和题目上下文，先获取记忆上下文
        enhanced_prompt = request.prompt
        if memory_service and request.student_id and request.problem_context:
            context = memory_service.get_student_context(
                request.student_id, 
                request.problem_context
            )
            if context:
                enhanced_prompt = f"{context}\n\n当前问题：{request.prompt}"
                logger.info(f"已注入学生 {request.student_id} 的记忆上下文")
        
        llm = LLMFactory.create(request.provider)
        response = await llm.chat(enhanced_prompt, request.history)
        return ChatResponse(response=response, provider=request.provider)
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/memory/add")
async def add_memory(request: MemoryAddRequest):
    """添加记忆到记忆库"""
    if not memory_service:
        raise HTTPException(status_code=503, detail="记忆库服务未配置")
    
    try:
        result = memory_service.add_memory(
            messages=request.messages,
            memory_content=request.memory_content,
            user_id=request.student_id
        )
        if result.get("error"):
            raise HTTPException(status_code=500, detail=result.get("message"))
        return result
    except Exception as e:
        logger.error(f"Add memory error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/memory/query")
async def query_memory(request: MemoryQueryRequest):
    """从记忆库查询记忆"""
    if not memory_service:
        raise HTTPException(status_code=503, detail="记忆库服务未配置")
    
    try:
        result = memory_service.query_memory(
            query=request.query,
            user_id=request.student_id,
            top_k=request.top_k
        )
        if result.get("error"):
            raise HTTPException(status_code=500, detail=result.get("message"))
        return result
    except Exception as e:
        logger.error(f"Query memory error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/memory/tutoring-session")
async def add_tutoring_session(request: TutoringSessionRequest):
    """记录辅导会话记忆（专门用于错题辅导场景）"""
    if not memory_service:
        raise HTTPException(status_code=503, detail="记忆库服务未配置")
    
    try:
        result = memory_service.add_learning_memory(
            student_id=request.student_id,
            problem=request.problem,
            error_type=request.error_type,
            hint_provided=request.hint_provided,
            student_response=request.student_response,
            session_messages=request.session_messages
        )
        if result.get("error"):
            raise HTTPException(status_code=500, detail=result.get("message"))
        return result
    except Exception as e:
        logger.error(f"Add tutoring session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/memory/student/{student_id}/context")
async def get_student_context(student_id: str, current_problem: str = ""):
    """获取学生上下文信息"""
    if not memory_service:
        raise HTTPException(status_code=503, detail="记忆库服务未配置")
    
    try:
        context = memory_service.get_student_context(student_id, current_problem)
        return {"student_id": student_id, "context": context}
    except Exception as e:
        logger.error(f"Get student context error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "ok",
        "ocr_available": ocr_service.ocr is not None,
        "memory_available": memory_service is not None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
