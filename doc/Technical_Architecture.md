# 技术架构与选型方案 (Technical Architecture)

## 1. 系统总体架构 (System Architecture)

基于“快速开发、易于扩展、移动端优先”的原则，本项目采用 **前后端分离** 架构。

```mermaid
graph TD
    User[用户 (学生)] -->|拍照/做题| Client[前端应用 (H5/App)]
    Client -->|HTTP API| Gateway[API 网关 / Nginx]
    Gateway --> Backend[后端服务 (FastAPI)]
    
    subgraph "后端核心模块"
        Backend --> OCR[OCR 服务 (PaddleOCR)]
        Backend --> Core[核心业务逻辑 (题目解析/诊断)]
        Backend --> RAG[RAG 引擎 (LangChain)]
        Backend --> LLM_Manager[LLM 统一接口层]
    end
    
    subgraph "数据存储"
        Core --> DB[(关系型数据库 SQLite/PostgreSQL)]
        RAG --> VectorDB[(向量数据库 ChromaDB)]
        RAG --> KB[教学知识库 (Markdown/JSON)]
    end
    
    subgraph "外部模型服务"
        LLM_Manager --> DeepSeek[DeepSeek API]
        LLM_Manager --> Volc[火山引擎 (Doubao) API]
        LLM_Manager --> Other[其他 LLM]
    end
```

***

## 2. 技术选型 (Technology Stack)

### 2.1 前端 (移动端优先)

- **框架**: **React** (Vite 构建)
  - *理由*: 生态丰富，组件库多，开发效率高。通过 Mobile-First 设计，既可作为 H5 运行在手机浏览器，也可通过 Capacitor/Cordova 封装为 App。
- **UI 组件库**: **Vant UI** 或 **Shadcn/ui (Mobile mode)**
  - *理由*: Vant 是轻量、可靠的移动端 Vue/React 组件库，非常适合仿 App 界面。
- **功能特性**:
  - 调用摄像头: HTML5 `<input type="file" accept="image/*" capture="camera">` 或通过 JS SDK。

### 2.2 后端 (API 服务)

- **语言**: **Python 3.10+**
  - *理由*: AI/OCR 领域的首选语言，拥有最丰富的库支持。
- **Web 框架**: **FastAPI**
  - *理由*: 高性能，原生支持异步，自动生成 Swagger 文档，适合构建 RESTful API。
- **OCR 引擎**: **PaddleOCR**
  - *理由*: 百度开源，中文识别效果极佳，支持数学公式识别（PP-Structure），部署方便。

### 2.3 数据存储

- **关系型数据库**: **SQLite** (MVP 阶段) / PostgreSQL (生产环境)
  - *理由*: MVP 阶段 SQLite 无需配置，单文件存储，极易迁移和备份。
- **向量数据库**: **ChromaDB** (本地)
  - *理由*: 轻量级，嵌入在 Python 进程中，无需额外部署服务，适合 RAG 知识库检索。

### 2.4 LLM 与 RAG

- **编排框架**: **LangChain**
  - *理由*: 提供了标准的 LLM 接口抽象和 RAG 链构建工具。
- **模型接入**:
  - **DeepSeek**: 用于逻辑推理、解题步骤生成（高智商，低成本）。
  - **火山引擎 (Doubao)**: 用于简单的对话交互或作为备选。
  - **设计模式**: 策略模式 (Strategy Pattern)，定义统一 `LLMProvider` 接口，支持配置热切换。

***

## 3. 核心模块详细设计

### 3.1 LLM 统一接口层 (LLM Abstraction Layer)

为了应对不同大模型的 API 差异，设计统一的适配器层。

```python
class LLMBase(ABC):
    @abstractmethod
    async def achat(self, prompt: str, history: List[dict] = None) -> str:
        pass

class DeepSeekProvider(LLMBase):
    # 实现 DeepSeek API 调用
    pass

class VolcEngineProvider(LLMBase):
    # 实现火山引擎 API 调用
    pass

class LLMFactory:
    @staticmethod
    def get_provider(name: str) -> LLMBase:
        # 根据配置返回实例
        pass
```

### 3.2 OCR 识别流程

1. **图片预处理**: 压缩、去噪、灰度化 (OpenCV)。
2. **文本检测**: 使用 PaddleOCR 检测文本区域。
3. **公式识别**: 针对数学题，需启用公式识别模型 (如 PaddleOCR 的 rec 模型或专门的公式识别微调模型)。
4. **结构化输出**: 将识别结果合并为自然段落。

### 3.3 知识库 RAG 流程

1. **文档加载**: 读取 Markdown/JSON 格式的教材、错题集。
2. **切片 (Chunking)**: 按“知识点”或“题目”进行语义切片。
3. **Embedding**: 使用 BGE-M3 或 OpenAI Embedding 将文本向量化。
4. **检索**:
   - Hybrid Search (混合检索): 关键词检索 (BM25) + 向量检索 (Cosine Similarity)。

***

## 4. 目录结构规划 (Directory Structure)

```
ErrorTutor/
├── doc/                    # 文档
├── backend/                # 后端代码 (Python/FastAPI)
│   ├── app/
│   │   ├── api/            # 接口路由
│   │   ├── core/           # 核心配置、工厂类
│   │   ├── services/       # 业务逻辑 (OCR, LLM, RAG)
│   │   ├── models/         # 数据库模型
│   │   ├── schemas/        # Pydantic 数据验证
│   │   └── utils/          # 工具函数
│   ├── data/               # 本地数据 (SQLite, ChromaDB)
│   ├── main.py             # 启动入口
│   └── requirements.txt    # 依赖
├── frontend/               # 前端代码 (React)
│   ├── src/
│   │   ├── components/     # UI 组件
│   │   ├── pages/          # 页面
│   │   ├── services/       # API 调用
│   │   └── hooks/          # React Hooks
│   └── package.json
└── README.md
```

## 5. 开发计划 (MVP Timeline)

1. **Day 1**: 环境搭建，FastAPI 基础框架，集成 LLM 接口 (DeepSeek)。
2. **Day 2**: 集成 PaddleOCR，实现图片转文本接口。
3. **Day 3**: 搭建 RAG 知识库，实现“三路检索”逻辑。
4. **Day 4**: 前端页面开发 (拍照、题目展示、对话框)。
5. **Day 5**: 联调前后端，优化 Prompt，测试核心流程。

