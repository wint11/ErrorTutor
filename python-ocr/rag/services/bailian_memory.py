"""
阿里云百炼平台记忆库服务

通过API调用百炼平台的记忆库能力，实现跨会话的长期记忆
文档：https://help.aliyun.com/zh/model-studio/memory-library
"""
import os
import json
from typing import List, Dict, Optional
import requests
from dotenv import load_dotenv

load_dotenv()


class BailianMemory:
    """
    阿里云百炼平台记忆库服务
    
    使用方式：
    1. 在百炼平台创建记忆库并配置记忆规则
    2. 获取API-Key和Memory Library ID
    3. 配置环境变量 DASHSCOPE_API_KEY 和 BAILIAN_MEMORY_LIBRARY_ID
    
    记忆库规则建议：
    - 用户画像：年级、薄弱知识点、常见错误类型、学习风格
    - 记忆片段：具体错题场景和改进过程（有效期180天）
    """
    
    def __init__(self):
        # 优先使用 DASHSCOPE_API_KEY（百炼通用Key），如果没有则尝试 BAILIAN_API_KEY
        self.api_key = os.getenv("DASHSCOPE_API_KEY") or os.getenv("BAILIAN_API_KEY")
        self.memory_library_id = os.getenv("BAILIAN_MEMORY_LIBRARY_ID")
        self.base_url = "https://dashscope.aliyuncs.com/api/v2/apps/memory"
        
        if not self.api_key:
            raise ValueError("请设置环境变量 DASHSCOPE_API_KEY 或 BAILIAN_API_KEY")
        if not self.memory_library_id:
            raise ValueError("请设置环境变量 BAILIAN_MEMORY_LIBRARY_ID")
    
    def add_memory(
        self, 
        messages: List[Dict[str, str]], 
        memory_content: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Dict:
        """
        添加记忆到记忆库
        
        Args:
            messages: 对话消息列表，格式 [{"role": "user", "content": "..."}, ...]
            memory_content: 直接指定要存入的记忆内容（可选，如果不提供则自动提取）
            user_id: 用户ID（可选，用于区分不同用户）
            
        Returns:
            API返回的JSON结果
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "memory_library_id": self.memory_library_id,
            "messages": messages
        }
        
        if memory_content:
            data["memory_content"] = memory_content
        if user_id:
            data["user_id"] = user_id
        
        url = f"{self.base_url}/add"
        
        try:
            response = requests.post(url, headers=headers, json=data, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                "error": True,
                "message": f"调用记忆库添加API失败: {str(e)}"
            }
    
    def query_memory(
        self, 
        query: str, 
        user_id: Optional[str] = None,
        top_k: int = 5
    ) -> Dict:
        """
        从记忆库中检索相关记忆
        
        Args:
            query: 查询内容
            user_id: 用户ID（可选，用于过滤特定用户的记忆）
            top_k: 返回的最大记忆数量
            
        Returns:
            API返回的JSON结果，包含相关记忆列表
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "memory_library_id": self.memory_library_id,
            "query": query,
            "top_k": top_k
        }
        
        if user_id:
            data["user_id"] = user_id
        
        url = f"{self.base_url}/query"
        
        try:
            response = requests.post(url, headers=headers, json=data, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                "error": True,
                "message": f"调用记忆库查询API失败: {str(e)}"
            }
    
    def extract_user_profile(self, user_id: Optional[str] = None) -> Dict:
        """
        提取用户画像信息
        
        Args:
            user_id: 用户ID
            
        Returns:
            用户画像数据，包含年级、薄弱知识点等
        """
        query = "获取该学生的完整学习画像，包括年级、薄弱知识点、常见错误类型等"
        result = self.query_memory(query, user_id=user_id, top_k=1)
        
        if result.get("error"):
            return {"error": result.get("message")}
        
        # 解析返回的用户画像
        memories = result.get("memories", [])
        if memories:
            return memories[0].get("content", {})
        return {}
    
    def add_learning_memory(
        self,
        student_id: str,
        problem: str,
        error_type: str,
        hint_provided: str,
        student_response: str,
        session_messages: List[Dict[str, str]]
    ) -> Dict:
        """
        添加学习过程记忆（专门用于辅导场景）
        
        Args:
            student_id: 学生ID
            problem: 题目内容
            error_type: 错误类型
            hint_provided: 提供的提示
            student_response: 学生反应/理解情况
            session_messages: 完整对话记录
            
        Returns:
            API返回结果
        """
        memory_content = f"""
学生在以下题目中出现了错误：
题目：{problem}
错误类型：{error_type}
提供的提示：{hint_provided}
学生理解情况：{student_response}
"""
        return self.add_memory(
            messages=session_messages,
            memory_content=memory_content.strip(),
            user_id=student_id
        )
    
    def get_student_context(self, student_id: str, current_problem: str) -> str:
        """
        获取学生上下文信息，用于个性化辅导
        
        Args:
            student_id: 学生ID
            current_problem: 当前题目
            
        Returns:
            格式化的上下文字符串，可注入到LLM提示中
        """
        # 查询相关记忆
        query = f"学生之前做类似题目时的错误类型和需要特别注意的地方。当前题目：{current_problem}"
        result = self.query_memory(query, user_id=student_id, top_k=3)
        
        if result.get("error") or not result.get("memories"):
            return ""
        
        memories = result.get("memories", [])
        context_parts = ["【该学生的历史学习记录】"]
        
        for i, mem in enumerate(memories, 1):
            content = mem.get("content", "")
            if content:
                context_parts.append(f"{i}. {content}")
        
        return "\n".join(context_parts)


# 全局实例
_bailian_memory = None


def get_bailian_memory() -> BailianMemory:
    """获取BailianMemory单例"""
    global _bailian_memory
    if _bailian_memory is None:
        _bailian_memory = BailianMemory()
    return _bailian_memory
