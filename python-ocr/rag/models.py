"""
RAG数据模型定义
"""
from typing import List, Optional
from pydantic import BaseModel, Field


class CommonError(BaseModel):
    """常见错误模式"""
    error_id: str = Field(..., description="错误唯一标识")
    error_type: str = Field(..., description="错误类型，如：漏乘、符号错误、计算错误")
    wrong_action: str = Field(..., description="错误的解题动作")
    why_wrong: str = Field(..., description="为什么会错")
    hint: str = Field(..., description="给学生的提示")
    frequency: str = Field(default="medium", description="发生频率：high/medium/low")


class Step(BaseModel):
    """解题步骤"""
    step_number: int = Field(..., description="步骤序号，从1开始")
    description: str = Field(..., description="步骤描述，如：去分母、去括号")
    correct_action: str = Field(..., description="正确的解题动作")
    common_errors: List[CommonError] = Field(default_factory=list, description="该步骤的常见错误")


class ProblemErrorPattern(BaseModel):
    """题目错误模式（核心数据结构）"""
    problem_id: str = Field(..., description="题目唯一标识")
    title: str = Field(..., description="题目标题")
    grade: str = Field(..., description="年级，如：七年级、八年级")
    topic: str = Field(..., description="主题，如：一元一次方程、二元一次方程组")
    subtopic: Optional[str] = Field(None, description="子主题，如：去分母、代入消元")
    knowledge_points: List[str] = Field(default_factory=list, description="涉及的知识点")
    difficulty: str = Field(default="medium", description="难度：easy/medium/hard")
    steps: List[Step] = Field(default_factory=list, description="解题步骤列表")
    
    class Config:
        json_schema_extra = {
            "example": {
                "problem_id": "eq_001",
                "title": "解方程：2(x-1)/3 = 4",
                "grade": "七年级",
                "topic": "一元一次方程",
                "subtopic": "去分母",
                "knowledge_points": ["去分母", "去括号", "移项"],
                "difficulty": "medium",
                "steps": [
                    {
                        "step_number": 1,
                        "description": "去分母",
                        "correct_action": "等式两边同乘3，得 2(x-1) = 12",
                        "common_errors": [
                            {
                                "error_id": "eq_001_s1_e1",
                                "error_type": "漏乘",
                                "wrong_action": "2(x-1) = 4",
                                "why_wrong": "忘记等式右边也要乘3",
                                "hint": "去分母时，等式两边每一项都要乘分母的最小公倍数",
                                "frequency": "high"
                            }
                        ]
                    }
                ]
            }
        }


class RetrievedError(BaseModel):
    """检索到的错误结果"""
    problem_id: str
    problem_title: str
    step_number: int
    step_description: str
    error_id: str
    error_type: str
    wrong_action: str
    why_wrong: str
    hint: str
    similarity_score: float = Field(..., description="相似度分数")
