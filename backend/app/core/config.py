from pydantic_settings import BaseSettings
from typing import Optional, List

class Settings(BaseSettings):
    PROJECT_NAME: str = "ErrorTutor API"
    API_V1_STR: str = "/api/v1"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    # LLM Keys
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    
    VOLCENGINE_API_KEY: Optional[str] = None
    VOLCENGINE_ENDPOINT_ID: Optional[str] = None
    
    # RAG
    CHROMA_PERSIST_DIRECTORY: str = "./backend/data/chroma"
    
    class Config:
        env_file = ".env"

settings = Settings()
