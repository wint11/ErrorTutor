from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage
from app.core.config import settings

class LLMProvider(ABC):
    """Abstract Base Class for LLM Providers"""
    
    @abstractmethod
    async def chat(self, prompt: str, system_prompt: Optional[str] = None, history: List[Dict[str, str]] = None) -> str:
        """
        Standard chat interface.
        :param prompt: User input
        :param system_prompt: System instruction
        :param history: Chat history [{"role": "user", "content": "..."}, ...]
        :return: LLM response text
        """
        pass

class DeepSeekProvider(LLMProvider):
    def __init__(self):
        self.llm = ChatOpenAI(
            model="deepseek-chat",
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
            temperature=0.3
        )

    async def chat(self, prompt: str, system_prompt: Optional[str] = None, history: List[Dict[str, str]] = None) -> str:
        messages: List[BaseMessage] = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        
        if history:
            for msg in history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    # langchain has AIMessage but for simplicity here just skip or map
                    pass 
        
        messages.append(HumanMessage(content=prompt))
        
        response = await self.llm.ainvoke(messages)
        return response.content

class VolcEngineProvider(LLMProvider):
    # Placeholder for VolcEngine (Doubao) implementation
    # This would typically use volcesdk or similar
    def __init__(self):
        pass

    async def chat(self, prompt: str, system_prompt: Optional[str] = None, history: List[Dict[str, str]] = None) -> str:
        # Mock implementation for now
        return f"[VolcEngine Mock] Response to: {prompt}"

class LLMFactory:
    @staticmethod
    def get_provider(provider_name: str = "deepseek") -> LLMProvider:
        if provider_name.lower() == "deepseek":
            return DeepSeekProvider()
        elif provider_name.lower() == "volcengine":
            return VolcEngineProvider()
        else:
            raise ValueError(f"Unknown provider: {provider_name}")
