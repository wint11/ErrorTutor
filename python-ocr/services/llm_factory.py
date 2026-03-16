from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import os

class LLMProvider(ABC):
    """LLM Provider 抽象基类"""

    @abstractmethod
    async def chat(self, prompt: str, system_prompt: Optional[str] = None, history: List[Dict[str, str]] = None) -> str:
        pass

class DeepSeekProvider(LLMProvider):
    def __init__(self):
        self.api_key = os.getenv('DEEPSEEK_API_KEY')
        self.base_url = os.getenv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')

        try:
            from langchain_openai import ChatOpenAI
            from langchain_core.messages import HumanMessage, SystemMessage
            self.ChatOpenAI = ChatOpenAI
            self.HumanMessage = HumanMessage
            self.SystemMessage = SystemMessage
            self.available = True
        except ImportError:
            self.available = False

        if self.available and self.api_key:
            self.llm = self.ChatOpenAI(
                model="deepseek-chat",
                api_key=self.api_key,
                base_url=self.base_url,
                temperature=0.3
            )
        else:
            self.llm = None

    async def chat(self, prompt: str, system_prompt: Optional[str] = None, history: List[Dict[str, str]] = None) -> str:
        if not self.available or not self.llm:
            return f"[DeepSeek Mock] 回复: {prompt[:50]}..."

        messages = []
        if system_prompt:
            messages.append(self.SystemMessage(content=system_prompt))

        if history:
            for msg in history:
                if msg.get("role") == "user":
                    messages.append(self.HumanMessage(content=msg.get("content", "")))

        messages.append(self.HumanMessage(content=prompt))

        try:
            response = await self.llm.ainvoke(messages)
            return response.content
        except Exception as e:
            return f"[DeepSeek Error] {str(e)}"

class VolcEngineProvider(LLMProvider):
    def __init__(self):
        pass

    async def chat(self, prompt: str, system_prompt: Optional[str] = None, history: List[Dict[str, str]] = None) -> str:
        return f"[VolcEngine Mock] 回复: {prompt[:50]}..."

class LLMFactory:
    @staticmethod
    def get_provider(provider_name: str = "deepseek") -> LLMProvider:
        if provider_name.lower() == "deepseek":
            return DeepSeekProvider()
        elif provider_name.lower() == "volcengine":
            return VolcEngineProvider()
        else:
            raise ValueError(f"Unknown provider: {provider_name}")
