"""
多厂商LLM调用工厂

支持以下模型：
- DeepSeek (deepseek-chat)
- 智谱GLM (glm-4-flash / glm-4-plus)
- 阿里云百炼 (qwen-turbo / qwen-plus)
- Kimi (kimi-k2)

使用方式：
1. 在 .env 文件中配置 API Key
2. 在 config.yaml 中选择使用的模型
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import os
import json
from dotenv import load_dotenv

load_dotenv()


class LLMProvider(ABC):
    """LLM Provider 抽象基类"""
    
    name: str = ""
    model_name: str = ""
    
    @abstractmethod
    async def chat(self, prompt: str, system_prompt: Optional[str] = None, history: List[Dict[str, str]] = None) -> str:
        """发送聊天请求"""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """检查是否可用（API Key是否配置）"""
        pass


class DeepSeekProvider(LLMProvider):
    """DeepSeek 模型提供商"""
    
    name = "DeepSeek"
    model_name = "deepseek-chat"
    
    def __init__(self):
        self.api_key = os.getenv("DEEPSEEK_API_KEY")
        self.base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        
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
                model=self.model_name,
                api_key=self.api_key,
                base_url=self.base_url,
                temperature=0.3
            )
        else:
            self.llm = None
    
    def is_available(self) -> bool:
        return self.available and self.api_key is not None
    
    async def chat(self, prompt: str, system_prompt: Optional[str] = None, history: List[Dict[str, str]] = None) -> str:
        if not self.is_available():
            return f"[DeepSeek 不可用] 请配置 DEEPSEEK_API_KEY 环境变量"
        
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


class GLMProvider(LLMProvider):
    """智谱AI GLM 模型提供商"""
    
    name = "GLM"
    model_name = "glm-4-flash"
    
    def __init__(self):
        self.api_key = os.getenv("ZHIPU_API_KEY")
        self.base_url = os.getenv("ZHIPU_BASE_URL", "https://open.bigmodel.cn/api/paas/v4")
        
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
                model=self.model_name,
                api_key=self.api_key,
                base_url=self.base_url,
                temperature=0.3
            )
        else:
            self.llm = None
    
    def is_available(self) -> bool:
        return self.available and self.api_key is not None
    
    async def chat(self, prompt: str, system_prompt: Optional[str] = None, history: List[Dict[str, str]] = None) -> str:
        if not self.is_available():
            return f"[GLM 不可用] 请配置 ZHIPU_API_KEY 环境变量"
        
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
            return f"[GLM Error] {str(e)}"


class QwenProvider(LLMProvider):
    """阿里云百炼 通义千问 模型提供商"""
    
    name = "Qwen"
    model_name = "qwen-turbo"
    
    def __init__(self):
        self.api_key = os.getenv("DASHSCOPE_API_KEY")
        self.base_url = os.getenv("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/api/v1")
        
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
                model=self.model_name,
                api_key=self.api_key,
                base_url=self.base_url,
                temperature=0.3
            )
        else:
            self.llm = None
    
    def is_available(self) -> bool:
        return self.available and self.api_key is not None
    
    async def chat(self, prompt: str, system_prompt: Optional[str] = None, history: List[Dict[str, str]] = None) -> str:
        if not self.is_available():
            return f"[Qwen 不可用] 请配置 DASHSCOPE_API_KEY 环境变量"
        
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
            return f"[Qwen Error] {str(e)}"


class KimiProvider(LLMProvider):
    """Kimi 模型提供商"""
    
    name = "Kimi"
    model_name = "kimi-k2.5"
    
    def __init__(self):
        self.api_key = os.getenv("KIMI_API_KEY")
        self.base_url = os.getenv("KIMI_BASE_URL", "https://api.moonshot.cn/v1")
        
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
                model=self.model_name,
                api_key=self.api_key,
                base_url=self.base_url,
                temperature=0.3
            )
        else:
            self.llm = None
    
    def is_available(self) -> bool:
        return self.available and self.api_key is not None
    
    async def chat(self, prompt: str, system_prompt: Optional[str] = None, history: List[Dict[str, str]] = None) -> str:
        if not self.is_available():
            return f"[Kimi 不可用] 请配置 KIMI_API_KEY 环境变量"
        
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
            return f"[Kimi Error] {str(e)}"


class LLMFactory:
    """LLM 工厂类"""
    
    PROVIDERS = {
        "deepseek": DeepSeekProvider,
        "glm": GLMProvider,
        "qwen": QwenProvider,
        "kimi": KimiProvider,
    }
    
    @staticmethod
    def get_provider(provider_name: str = None) -> LLMProvider:
        """
        获取指定的LLM提供商
        
        Args:
            provider_name: 提供商名称 (deepseek/glm/qwen/kimi)
            
        Returns:
            LLMProvider 实例
        """
        if provider_name is None:
            provider_name = os.getenv("LLM_PROVIDER", "deepseek")
        
        provider_name = provider_name.lower()
        
        if provider_name not in LLMFactory.PROVIDERS:
            available = list(LLMFactory.PROVIDERS.keys())
            raise ValueError(f"未知的提供商: {provider_name}，可选: {available}")
        
        return LLMFactory.PROVIDERS[provider_name]()
    
    @staticmethod
    def list_available_providers() -> Dict[str, bool]:
        """列出所有可用的提供商"""
        result = {}
        for name, provider_class in LLMFactory.PROVIDERS.items():
            try:
                provider = provider_class()
                result[name] = provider.is_available()
            except Exception:
                result[name] = False
        return result
    
    @staticmethod
    def get_default_provider() -> LLMProvider:
        """获取默认提供商（自动选择第一个可用的）"""
        available = LLMFactory.list_available_providers()
        
        for name, is_available in available.items():
            if is_available:
                return LLMFactory.PROVIDERS[name]()
        
        # 如果没有可用的，返回 DeepSeek（会返回错误信息）
        return DeepSeekProvider()


# 全局实例
_llm_provider: Optional[LLMProvider] = None


def get_llm_provider() -> LLMProvider:
    """获取全局LLM提供商实例（单例）"""
    global _llm_provider
    if _llm_provider is None:
        provider_name = os.getenv("LLM_PROVIDER", "deepseek")
        _llm_provider = LLMFactory.get_provider(provider_name)
    return _llm_provider


def set_llm_provider(provider_name: str):
    """设置全局LLM提供商"""
    global _llm_provider
    _llm_provider = LLMFactory.get_provider(provider_name)
