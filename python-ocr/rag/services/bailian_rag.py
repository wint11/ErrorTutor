"""
阿里云百炼平台RAG服务

通过API调用百炼平台的RAG能力，无需本地部署向量数据库和Embedding模型
"""
import os
import json
from typing import List, Dict, Optional
import requests
from dotenv import load_dotenv

load_dotenv()


class BailianRAG:
    """
    阿里云百炼平台RAG服务
    
    使用方式：
    1. 在百炼平台创建知识库并上传CSV文件
    2. 创建RAG应用，关联知识库
    3. 获取API-Key和App-ID
    4. 配置环境变量 BAILIAN_API_KEY 和 BAILIAN_APP_ID
    """
    
    def __init__(self):
        self.api_key = os.getenv("BAILIAN_API_KEY")
        self.app_id = os.getenv("BAILIAN_APP_ID")
        self.base_url = "https://dashscope.aliyuncs.com/api/v1/apps"
        
        if not self.api_key:
            raise ValueError("请设置环境变量 BAILIAN_API_KEY")
        if not self.app_id:
            raise ValueError("请设置环境变量 BAILIAN_APP_ID")
    
    def query(self, question: str, session_id: str = None) -> Dict:
        """
        调用百炼RAG应用
        
        Args:
            question: 用户问题
            session_id: 会话ID（可选，用于多轮对话）
            
        Returns:
            API返回的JSON结果
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "input": {
                "prompt": question
            },
            "parameters": {}
        }
        
        if session_id:
            data["input"]["session_id"] = session_id
        
        url = f"{self.base_url}/{self.app_id}/completion"
        
        try:
            response = requests.post(url, headers=headers, json=data, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                "error": True,
                "message": f"调用百炼API失败: {str(e)}"
            }
    
    def get_error_hints(self, problem: str, step: int, student_answer: str = None) -> List[Dict]:
        """
        获取某题目某步骤的错误提示
        
        Args:
            problem: 题目内容
            step: 当前步骤序号
            student_answer: 学生的答案（可选，用于判断具体错误）
            
        Returns:
            错误提示列表
        """
        query = f"""
题目：{problem}
当前步骤：第{step}步
"""
        if student_answer:
            query += f"学生答案：{student_answer}\n"
        
        query += """
请提供这个题目在当前步骤的常见错误类型、错误原因和给学生的提示。
请以JSON格式返回，包含以下字段：
- error_type: 错误类型
- wrong_action: 错误做法
- why_wrong: 错误原因
- hint: 给学生的提示
"""
        
        result = self.query(query)
        return self._parse_hints(result)
    
    def _parse_hints(self, result: Dict) -> List[Dict]:
        """解析API返回的错误提示"""
        if result.get("error"):
            return []
        
        try:
            output = result.get("output", {})
            text = output.get("text", "")
            
            # 尝试从返回文本中解析JSON
            if "```json" in text:
                json_str = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                json_str = text.split("```")[1].split("```")[0].strip()
            else:
                json_str = text.strip()
            
            hints = json.loads(json_str)
            if isinstance(hints, dict):
                hints = [hints]
            return hints
        except (json.JSONDecodeError, IndexError):
            # 如果解析失败，返回文本内容
            return [{"hint": result.get("output", {}).get("text", "")}]


# 全局实例
_bailian_rag = None


def get_bailian_rag() -> BailianRAG:
    """获取BailianRAG单例"""
    global _bailian_rag
    if _bailian_rag is None:
        _bailian_rag = BailianRAG()
    return _bailian_rag
