# RAG 错误模式知识库

## 概述

本模块实现了基于RAG（检索增强生成）的错误模式知识库，用于在AI辅导过程中提供常见错误提示。

## 核心功能

1. **步骤级错误追踪**：每个解题步骤的常见错误都被记录和索引
2. **语义检索**：基于题目内容的相似度检索相关错误
3. **上下文增强**：自动将相关错误信息注入AI提示词

## 目录结构

```
rag/
├── __init__.py
├── models.py                 # 数据模型定义
├── data/
│   ├── __init__.py
│   ├── sample_problems.json  # 示例题目数据（5道题）
│   └── chroma_db/           # ChromaDB持久化数据（自动生成）
├── services/
│   ├── __init__.py
│   ├── error_pattern_rag.py # RAG核心服务
│   └── tutoring_with_rag.py # 辅导集成服务
└── scripts/
    └── init_database.py     # 数据库初始化脚本
```

## 快速开始

### 1. 安装依赖

```bash
cd python-ocr
pip install -r requirements.txt
```

### 2. 初始化数据库

```bash
python -m rag.scripts.init_database --test
```

这会：
- 加载 `data/sample_problems.json` 中的5道示例题目
- 创建ChromaDB向量数据库
- 运行检索测试

### 3. 在代码中使用

```python
from rag.services.tutoring_with_rag import TutoringWithRAG, TutoringContext

# 初始化服务
tutoring = TutoringWithRAG()

# 构建带RAG上下文的提示词
context = TutoringContext(
    problem_text="解方程：2(x-1)/3 = 4",
    current_step=1,
    grade="七年级",
    topic="一元一次方程"
)
prompt = tutoring.build_system_prompt_with_rag(context)

# 使用prompt调用LLM
# ...
```

## 数据结构

### 题目错误模式 (ProblemErrorPattern)

```json
{
  "problem_id": "唯一标识",
  "title": "题目标题",
  "grade": "年级",
  "topic": "主题",
  "steps": [
    {
      "step_number": 1,
      "description": "步骤描述",
      "correct_action": "正确做法",
      "common_errors": [
        {
          "error_id": "错误唯一标识",
          "error_type": "错误类型",
          "wrong_action": "错误做法",
          "why_wrong": "错误原因",
          "hint": "给学生的提示",
          "frequency": "high/medium/low"
        }
      ]
    }
  ]
}
```

## 添加新题目

编辑 `data/sample_problems.json`，按相同格式添加新题目，然后重新运行初始化脚本。

## API接口

### ErrorPatternRAG

```python
from rag.services.error_pattern_rag import ErrorPatternRAG

rag = ErrorPatternRAG()

# 检索相似错误
errors = rag.retrieve_similar_errors(
    query="题目内容",
    current_step=1,
    grade="七年级",
    top_k=3
)

# 获取特定步骤的错误
errors = rag.get_errors_by_step("eq_001", 1)
```

### TutoringWithRAG

```python
from rag.services.tutoring_with_rag import TutoringWithRAG

tutoring = TutoringWithRAG()

# 获取步骤指导
guidance = tutoring.get_step_guidance("eq_001", 1)

# 分析学生错误
analysis = tutoring.analyze_student_error(
    problem_text="题目",
    student_answer="学生答案",
    correct_answer="正确答案",
    current_step=1
)
```

## 示例数据

当前包含5道示例题目：

1. **eq_001**: 解一元一次方程（去分母）- 4个步骤，4个错误模式
2. **eq_002**: 解一元一次方程（移项合并）- 2个步骤，2个错误模式
3. **eq_003**: 解一元一次方程（去括号）- 4个步骤，5个错误模式
4. **eqsys_001**: 解二元一次方程组（加减消元）- 3个步骤，3个错误模式
5. **eqsys_002**: 解二元一次方程组（代入消元）- 3个步骤，3个错误模式

共 **17个错误模式**，覆盖最常见的计算错误。
