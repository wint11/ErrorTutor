import hashlib
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
import uuid
from typing import List, Optional, Union
from concurrent.futures import ThreadPoolExecutor, as_completed

import chromadb
import requests
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

try:
    import pymupdf4llm
    import docx
    from openai import OpenAI
    from langchain_text_splitters import (
        MarkdownHeaderTextSplitter,
        RecursiveCharacterTextSplitter,
    )

    HAS_PDF_TOOLS = True
except ImportError:
    HAS_PDF_TOOLS = False

# ==========================================
# 配置区域 (Configuration)
# ==========================================
# 阿里云百炼大模型配置 (用于处理 PDF 抽取后文本优化)
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "sk-8a33ac05041341158201050ba4b86a2b")
if HAS_PDF_TOOLS:
    dashscope_client = OpenAI(
        api_key=DASHSCOPE_API_KEY, 
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )
# 端口配置
APP_PORT = 8003               # RAG Service API Port
EMBED_PORT = 8004             # vLLM Embedding Port
GENERATE_LLM_PORT = 8005      # vLLM 生成内容 LLM Port
DOC_LLM_PORT = 8006           # vLLM 文档处理 LLM Port
ROOT_PATH = "/me4012/TongJI"
# 模型路径配置 (改为相对路径)
EMBEDDING_MODEL_PATH = "models/Qwen3-Embedding-0.6B"
GENERATE_MODEL_PATH = "models/Qwen3-8B"
DOC_MODEL_PATH = "models/Qwen3-8B"


VLLM_LOG_DIR = "logs"

# 默认 Token，可通过环境变量覆盖
DEFAULT_TOKEN_BASE = "me4012"
API_TOKEN = os.getenv(
    "API_TOKEN", hashlib.sha256(DEFAULT_TOKEN_BASE.encode()).hexdigest()
)

# 内部常量 (向不同模型请求的地址)
EMBED_API_URL = f"http://localhost:{EMBED_PORT}{ROOT_PATH}"
GENERATE_API_URL = f"http://localhost:{GENERATE_LLM_PORT}{ROOT_PATH}"
DOC_API_URL = f"http://localhost:{DOC_LLM_PORT}{ROOT_PATH}"

DEFAULT_EMBEDDING_MODEL_NAME = "embedding-model"
DEFAULT_GENERATE_MODEL_NAME = "generate-model"
DEFAULT_DOC_MODEL_NAME = "doc-model"

# ==========================================
# 向量数据库 (ChromaDB) 配置
# ==========================================
CHROMA_DB_PATH = "chroma_db"
chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
# 获取或创建 Collection
chroma_collection = chroma_client.get_or_create_collection(name="vllm_embeddings")

# 加载 Prompt 配置文件
PROMPTS_FILE_PATH = "prompts.json"
try:
    with open(PROMPTS_FILE_PATH, "r", encoding="utf-8") as f:
        SYSTEM_PROMPTS = json.load(f)
except Exception as e:
    print(f"警告: 无法加载提示词文件 {PROMPTS_FILE_PATH}, 将使用默认配置。错误: {e}")
    SYSTEM_PROMPTS = {}

# ==========================================
# API 定义
# ==========================================
app = FastAPI(
    title="RAG API Service",
    description="医学文献 RAG 检索增强生成服务接口",
    version="1.0.0"
)

# 允许跨域请求 (CORS) 以便前端 HTML 可以直接调用
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境建议指定具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 安全认证配置
# ==========================================
security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """校验 Bearer Token"""
    if credentials.credentials != API_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid API Token")
    return credentials.credentials

# ==========================================
# 请求/响应模型定义 (Pydantic Models)
# ==========================================
class EmbeddingRequest(BaseModel):
    input: Union[str, List[str]] = Field(
        ..., description="需要进行 embedding 并存入库的文本或文本列表"
    )
    metadatas: Optional[Union[dict, List[dict]]] = Field(
        default=None, description="可选的元数据（如来源文件名）"
    )

class EmbeddingResponse(BaseModel):
    id: str
    object: str
    created: int
    model: str
    data: List[dict]
    usage: dict
    chroma_ids: Optional[List[str]] = Field(None, description="存入 ChromaDB 后的 ID 列表")

class SearchRequest(BaseModel):
    query: str = Field(..., description="检索用的查询字符串")
    top_k: int = Field(default=5, description="向量检索召回的数量")

class SearchResultItem(BaseModel):
    document: str
    score: float
    metadata: dict

class SearchResponse(BaseModel):
    status: str
    query: str
    results: List[SearchResultItem]

class GenerateRequest(BaseModel):
    question: str = Field(..., description="用户问题")
    type: str = Field(default="order_teaching", description="业务类型")
    top_k: int = Field(default=5, description="向量检索召回的数量")
    use_kb: bool = Field(default=True, description="是否进行知识库检索")

class GenerateResponse(BaseModel):
    is_context: Optional[bool] = Field(False, description="是否是检索的上下文信息")
    docs: Optional[List[dict]] = Field(None, description="检索到的文档列表")
    choices: Optional[List[dict]] = Field(None, description="大模型返回的回答片段")

class ChunkItem(BaseModel):
    id: str
    document: str

class ChunksResponse(BaseModel):
    status: str
    total: int
    page: int
    page_size: int
    chunks: List[ChunkItem]

class DeleteRequest(BaseModel):
    ids: List[str] = Field(..., description="要删除的文档 ID 列表")

class DeleteResponse(BaseModel):
    status: str
    deleted_count: int

class OptimizeRequest(BaseModel):
    text: str = Field(..., description="需要优化的文本块内容")

class OptimizeResponse(BaseModel):
    status: str
    optimized_text: str

class UploadPdfRequest(BaseModel):
    file: bytes = Field(..., description="PDF 文件内容")

class UploadPdfResponse(BaseModel):
    status: str
    filename: str
    chunks: List[str]

class UploadResponse(BaseModel):
    status: str = Field(..., description="处理状态")
    filename: str = Field(..., description="上传的文件名")
    file_type: str = Field(..., description="识别出的文件类型")
    chunks: List[str] = Field(..., description="解析并切分后的文本块数组")

class BasicResponse(BaseModel):
    status: str
    message: str


@app.post("/embed", response_model=EmbeddingResponse)
async def embed_and_store(request: EmbeddingRequest, token: str = Depends(verify_token)):
    """
    统一 Embedding 接口: 调用 vLLM 获取向量，并存入 ChromaDB
    """

    payload = {"model": DEFAULT_EMBEDDING_MODEL_NAME, "input": request.input}

    try:
        response = requests.post(
            f"{EMBED_API_URL}/v1/embeddings",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=60,
        )
        response.raise_for_status()
        result = response.json()

        # 存入 ChromaDB
        if "data" in result:
            embeddings = [item["embedding"] for item in result["data"]]
            inputs = (
                request.input if isinstance(request.input, list) else [request.input]
            )
            ids = [str(uuid.uuid4()) for _ in inputs]

            # 处理 metadatas
            metadatas = None
            if request.metadatas:
                if isinstance(request.metadatas, list):
                    metadatas = request.metadatas
                else:
                    metadatas = [request.metadatas for _ in inputs]

            chroma_collection.add(
                embeddings=embeddings, documents=inputs, ids=ids, metadatas=metadatas
            )
            result["chroma_ids"] = ids

        return result
    except Exception as e:
        print(f"Embedding 失败: {e}")
        raise HTTPException(status_code=502, detail=str(e))


def _get_embedding(text: str) -> List[float]:
    """内部辅助函数: 获取单条文本的向量"""
    payload = {"model": DEFAULT_EMBEDDING_MODEL_NAME, "input": text}
    response = requests.post(
        f"{EMBED_API_URL}/v1/embeddings",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=60,
    )
    response.raise_for_status()
    return response.json()["data"][0]["embedding"]


@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest, token: str = Depends(verify_token)):
    """
    RAG 检索接口:
    1. 将 query 转化为 embedding 向量
    2. 从 ChromaDB 检索 top_k 个相似文档
    3. 直接返回召回结果
    """

    try:
        # 1. 向量化 query
        query_embedding = _get_embedding(request.query)

        # 2. 向量库检索 (召回阶段)
        search_results = chroma_collection.query(
            query_embeddings=[query_embedding], n_results=request.top_k
        )

        # ChromaDB 可能会返回空列表，需做检查
        if not search_results["documents"] or not search_results["documents"][0]:
            return {"status": "success", "results": [], "message": "未检索到相关文档"}

        retrieved_docs = search_results["documents"][0]
        distances = (
            search_results["distances"][0]
            if "distances" in search_results
            else [0.0] * len(retrieved_docs)
        )
        metadatas = (
            search_results["metadatas"][0]
            if "metadatas" in search_results and search_results["metadatas"]
            else [{}] * len(retrieved_docs)
        )

        # 组装结果
        final_results = []
        for i, doc in enumerate(retrieved_docs):
            # 将距离转为某种得分形式，或者直接返回距离
            meta = (
                metadatas[i]
                if metadatas and i < len(metadatas) and metadatas[i] is not None
                else {}
            )
            final_results.append(
                {
                    "document": doc,
                    "score": distances[i],  # 用距离作为分数，数值越小越好
                    "metadata": meta,
                }
            )

        return {"status": "success", "query": request.query, "results": final_results}

    except Exception as e:
        print(f"Search 过程失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate", response_model=GenerateResponse, responses={
    200: {
        "description": "SSE 流式返回，可能包含 is_context 或 choices 数据",
        "content": {"text/event-stream": {"schema": {"$ref": "#/components/schemas/GenerateResponse"}}}
    }
})
async def generate(request: GenerateRequest, token: str = Depends(verify_token)):
    """
    RAG 对话接口:
    1. 检索相关文档
    2. 构建 Prompt 发送给 Generate LLM
    """

    # 1. 检索相关文档 (仅当 use_kb 为 True 时进行)
    context_text = ""
    retrieved_docs_list = []

    if request.use_kb:
        try:
            query_embedding = _get_embedding(request.question)
            search_results = chroma_collection.query(
                query_embeddings=[query_embedding], n_results=request.top_k
            )
            if search_results["documents"] and search_results["documents"][0]:
                retrieved_docs = search_results["documents"][0]
                metadatas = (
                    search_results["metadatas"][0]
                    if "metadatas" in search_results and search_results["metadatas"]
                    else [{}] * len(retrieved_docs)
                )
                # 直接拼接上下文，不再重排
                for i, doc in enumerate(retrieved_docs):
                    meta = (
                        metadatas[i]
                        if metadatas and i < len(metadatas) and metadatas[i] is not None
                        else {}
                    )
                    source = meta.get("source", "未知来源")
                    context_text += f"\n--- 文档 {i+1} (来源: {source}) ---\n{doc}\n"
                    retrieved_docs_list.append({"content": doc, "source": source})
        except Exception as e:
            print(f"检索过程失败，将降级为普通对话: {e}")

    # 2. 获取并构建 Prompt
    business_type = request.type
    if (
        business_type in SYSTEM_PROMPTS
        and "system_prompt" in SYSTEM_PROMPTS[business_type]
    ):
        # 从配置中加载 prompt 数组并合并成字符串
        prompt_lines = SYSTEM_PROMPTS[business_type]["system_prompt"]
        base_system_prompt = "\n".join(prompt_lines)
    else:
        # 默认回退的 prompt
        base_system_prompt = (
            "你是一个专业的AI助手。请基于提供的上下文回答用户的问题。"
            "如果上下文中没有相关信息，请根据你的知识进行回答。"
        )

    system_prompt = base_system_prompt
    if context_text:
        system_prompt += f"\n\n[上下文信息]\n{context_text}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": request.question},
    ]

    payload = {
        "model": DEFAULT_GENERATE_MODEL_NAME,
        "messages": messages,
        "stream": True,
        "temperature": 0.3,
        "max_tokens": 1024,
    }

    # 3. 请求 Generate LLM 引擎
    try:
        upstream_response = requests.post(
            f"{GENERATE_API_URL}/v1/chat/completions",
            json=payload,
            stream=True,
            headers={"Content-Type": "application/json"},
        )
        upstream_response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"连接 Generate LLM 失败: {e}")
        raise HTTPException(status_code=502, detail=f"LLM Engine unavailable: {e}")

    # 4. 流式转发
    def stream_generator():
        # 先单独发送一条特殊格式的 JSON 包含检索到的文档，前端可拦截解析
        context_data = {"is_context": True, "docs": retrieved_docs_list}
        yield f"data: {json.dumps(context_data, ensure_ascii=False)}\n\n".encode(
            "utf-8"
        )

        in_think_block = False
        waiting_for_first_char = False

        for line in upstream_response.iter_lines():
            if line:
                try:
                    line_str = line.decode("utf-8").replace("data: ", "")
                    if line_str == "[DONE]":
                        # LLM 生成结束前，我们将参考来源组装为一个假的 chunk 推送给前端
                        sources = set(doc.get("source", "未知来源") for doc in retrieved_docs_list)
                        if sources:
                            ref_text = "\n\n" + "=" * 40 + "\n【参考来源】\n"
                            for idx, src in enumerate(sources, 1):
                                ref_text += f"[{idx}] {src}\n"
                            
                            ref_chunk = {
                                "choices": [
                                    {"delta": {"content": ref_text}}
                                ]
                            }
                            yield f"data: {json.dumps(ref_chunk, ensure_ascii=False)}\n\n".encode("utf-8")
                            
                        yield line + b"\n"
                        continue

                    chunk_json = json.loads(line_str)
                    if "choices" in chunk_json and len(chunk_json["choices"]) > 0:
                        content = chunk_json["choices"][0].get("delta", {}).get("content", "")

                        # 简单的状态机过滤 <think> 标签及其内容
                        if "<think>" in content:
                            in_think_block = True
                            content = content.replace("<think>", "")

                        if "</think>" in content:
                            in_think_block = False
                            content = content.replace("</think>", "")
                            # 标记进入等待第一个正文的状态
                            waiting_for_first_char = True
                            
                            if not content.strip():
                                continue

                        if in_think_block:
                            # 处于 think 块内部，完全忽略这段内容
                            continue
                            
                        if waiting_for_first_char:
                            if content.strip():
                                # 遇到了第一个非空字符，去除左侧的空白/换行，并关闭等待状态
                                content = content.lstrip()
                                waiting_for_first_char = False
                            else:
                                # 仍然全是空白或换行，直接丢弃这个 chunk
                                continue

                        # 如果过滤后还有内容，重新打包发送
                        if content:
                            chunk_json["choices"][0]["delta"]["content"] = content
                            yield f"data: {json.dumps(chunk_json, ensure_ascii=False)}\n\n".encode(
                                "utf-8"
                            )

                except Exception:
                    # 如果解析失败，原样透传
                    yield line + b"\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream")


@app.get("/chunks", response_model=ChunksResponse)
async def get_all_chunks(page: int = 1, page_size: int = 50, token: str = Depends(verify_token)):
    """获取知识库内容 (支持分页)"""
    try:
        data = chroma_collection.get()
        results = []
        total = 0
        if data and data.get("ids"):
            total = len(data["ids"])
            # 计算切片索引
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            
            # 获取当前页的数据
            page_ids = data["ids"][start_idx:end_idx]
            page_docs = data["documents"][start_idx:end_idx]
            
            for i in range(len(page_ids)):
                results.append(
                    {"id": page_ids[i], "document": page_docs[i]}
                )
        return {
            "status": "success", 
            "total": total,
            "page": page,
            "page_size": page_size,
            "chunks": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/chunks", response_model=DeleteResponse)
async def delete_chunks(request: DeleteRequest, token: str = Depends(verify_token)):
    """删除知识库中指定的 chunks"""
    try:
        if request.ids:
            chroma_collection.delete(ids=request.ids)
        return {"status": "success", "deleted_count": len(request.ids)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/chunks/all", response_model=BasicResponse)
async def clear_all_chunks(token: str = Depends(verify_token)):
    """彻底清空整个知识库集合"""
    try:
        global chroma_collection
        # 删除整个集合
        chroma_client.delete_collection(name="vllm_embeddings")
        # 重新创建一个空的同名集合
        chroma_collection = chroma_client.get_or_create_collection(
            name="vllm_embeddings"
        )
        return {
            "status": "success",
            "message": "All chunks have been completely deleted.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/optimize", response_model=OptimizeResponse)
async def optimize_chunk(request: OptimizeRequest, token: str = Depends(verify_token)):
    """使用大模型优化 Chunk 内容"""

    system_prompt = (
        "/no_think 你是一个专业的医学文献处理助手。请优化以下文本块的内容，"
        "使其更加通顺、连贯。你需要：1. 去除由于PDF解析导致的无意义乱码、页眉页脚残留、引用标记。"
        "2. 保持原有的专业知识点和上下文逻辑不变。3. 直接输出优化后的文本，不要输出任何解释性的前言或后语。"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"请优化以下文本：\n{request.text}"},
    ]

    payload = {
        "model": DEFAULT_GENERATE_MODEL_NAME,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 1024,
    }

    try:
        upstream_response = requests.post(
            f"{GENERATE_API_URL}/v1/chat/completions",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=120,
        )
        upstream_response.raise_for_status()
        result = upstream_response.json()
        optimized_text = result["choices"][0]["message"]["content"].strip()
        # 简单过滤可能残留的 <think>
        if "<think>" in optimized_text and "</think>" in optimized_text:
            optimized_text = re.sub(
                r"<think>.*?</think>", "", optimized_text, flags=re.DOTALL
            ).strip()
        return {"status": "success", "optimized_text": optimized_text}
    except Exception as e:
        print(f"优化 Chunk 失败: {e}")
        raise HTTPException(status_code=502, detail=str(e))


# -------------------------------------------------------
# 新增 PDF 处理接口 (供前端 HTML 调用)
# -------------------------------------------------------
def optimize_text_with_llm(task_id, title, text, extract_labels=None):
    """
    使用阿里云百炼大模型优化文本，并返回 JSON 格式：
    1. 判断是否符合用户提供的干货标签
    2. 允许调整标题
    3. 恢复通顺段落，对过长内容进行合理分段
    4. 不符合要求返回空内容
    """
    if not text or not text.strip():
        return {"id": task_id, "title": title, "content": ""}
        
    labels_str = extract_labels if extract_labels and extract_labels.strip() else "疾病特征描述, 病理分析, 治疗方案, 诊断标准, 用药指南"
        
    prompt = f"""
    你是一个专业的医学文献处理助手。我将发送给你一个从医学指南中提取的文本块（包含当前标题和正文内容）。
    请你完成以下任务：
    1. 判断该文本是否属于以下“干货”标签之一：【{labels_str}】。
    2. 如果该文本仅仅是简单的署名、目录、无意义的符号、或者是无关紧要的背景介绍，或者与上述标签内容无关，请将 content 设为空字符串 ""。
    3. 如果该文本属于上述干货内容，请将其恢复成连贯、通顺、逻辑清晰的段落。**特别注意：对于过长的内容，请进行合理的换行和分段，不要挤成一团**。
    4. 根据正文的实际内容，**评估并允许优化或修改原有的标题**，使其更加准确和精炼。如果原有标题为空或不合适，请直接赋予一个合适的 Markdown 标题（例如 `## 诊断标准`）。注意保留正确的 `#` 层级。
    5. **你必须返回一个合法的 JSON 对象**，且只能包含以下三个字段：
       - "id": 返回我发送给你的 ID
       - "title": 优化后或保持原样的标题（带 # 标记，如果不适用则为空）
       - "content": 优化后的正文段落（如果不符合要求则为空字符串）
       
    请直接输出 JSON，不要输出任何额外的说明文字或 markdown 代码块标记（如 ```json ）。
    """
    
    user_message = f"ID: {task_id}\n当前标题: {title}\n正文内容: {text}"
    
    try:
        completion = dashscope_client.chat.completions.create(
            model="qwen-plus", 
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": user_message},
            ],
            response_format={"type": "json_object"}
        )
        result = completion.choices[0].message.content.strip()
        
        # 尝试解析返回的 JSON
        try:
            json_result = json.loads(result)
            return json_result
        except json.JSONDecodeError:
            print(f"  [LLM Error] 返回的不是合法 JSON: {result}")
            return {"id": task_id, "title": title, "content": ""}
            
    except Exception as e:
        print(f"  [LLM Error] 调用大模型失败: {e}")
        return {"id": task_id, "title": title, "content": ""}

def clean_markdown_text(md_text):
    # 根据需求：提取 Markdown 后，去掉所有空格（保留换行符）
    md_text = re.sub(r'[^\S\r\n]+', '', md_text)

    # 去除“##参考文献”及其后面的所有内容
    md_text = re.split(r'^#+参考文献', md_text, flags=re.MULTILINE)[0]

    # 兼容无空格状态下的正则替换
    md_text = re.sub(
        r"中华\w+杂志\d+年\d+月.*?ChinJ\w+.*?\n",
        "",
        md_text,
        flags=re.IGNORECASE,
    )
    md_text = re.sub(r"^[·\-]\d+[·\-]\n?", "", md_text, flags=re.MULTILINE)
    md_text = re.sub(r"［[\d,\-]+］", "", md_text)
    md_text = re.sub(r"\[[\d,\-]+\]", "", md_text)
    md_text = re.sub(r"\n{3,}", "\n\n", md_text)
    md_text = re.sub(r"==>picture.*?<==", "", md_text, flags=re.IGNORECASE)
    md_text = re.sub(
        r"^DOI[：:].*?$\n?", "", md_text, flags=re.MULTILINE | re.IGNORECASE
    )
    md_text = re.sub(r"^收稿日期.*?$\n?", "", md_text, flags=re.MULTILINE)
    md_text = re.sub(r"^引用本文.*?$\n?", "", md_text, flags=re.MULTILINE)
    
    # 恢复标准 Markdown 标题格式：在行首的 # 号后添加一个空格
    md_text = re.sub(r'^(#+)(?=[^\s#])', r'\1 ', md_text, flags=re.MULTILINE)
    
    return md_text.strip()


def chunk_markdown(md_text):
    headers_to_split_on = [
        ("#", "Header 1"),
        ("##", "Header 2"),
        ("###", "Header 3"),
    ]
    markdown_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=headers_to_split_on
    )
    md_header_splits = markdown_splitter.split_text(md_text)

    # 自定义拆分规则：
    # 优先按段落切分，其次按换行，再按中文/英文句点、感叹号、问号切分（避免截断句子）
    text_splitter = RecursiveCharacterTextSplitter(
        separators=[
            "\n\n",
            "\n",
            "。",
            "！",
            "？",
            ". ",
            "! ",
            "? ",
            "，",
            ", ",
            " ",
            ""
        ],
        chunk_size=800,       # 适当的块大小，保持同一标题下尽量不分得太碎
        chunk_overlap=150,    # 前后保留150字符左右的重叠，确保上下文不丢失
        keep_separator=True,  # 拆分时保留标点符号
    )
    splits = text_splitter.split_documents(md_header_splits)

    chunks = []
    for split in splits:
        meta_info = " > ".join(split.metadata.values())
        if meta_info:
            content = f"[{meta_info}]\n{split.page_content}"
        else:
            content = split.page_content
        chunks.append(content)
    return chunks


# -------------------------------------------------------
# 文件处理分支函数
# -------------------------------------------------------
async def process_pdf_file(file: UploadFile, use_llm: bool = True, extract_labels: str = "") -> List[str]:
    """处理 PDF 文件：提取为 Markdown -> 清洗 -> (可选) LLM 优化 -> 切分为 Chunks"""
    if not HAS_PDF_TOOLS:
        raise HTTPException(
            status_code=501,
            detail="Server missing pymupdf4llm, openai or langchain_text_splitters",
        )

    temp_dir = "tmp"
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{file.filename}")
    
    try:
        # 保存上传的文件
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 1. 提取为 Markdown
        md_text = pymupdf4llm.to_markdown(temp_file_path, margins=(50, 50, 0, 0))
        
        # 2. 清洗文本
        cleaned_md = clean_markdown_text(md_text)
        
        # 如果不使用 LLM 优化，直接切分返回
        if not use_llm:
            return chunk_markdown(cleaned_md)
        
        # 3. 按标题切分并调用大模型优化
        parts = re.split(r'(^#+ .+?)\n', cleaned_md, flags=re.MULTILINE)
        tasks = []
        
        if parts and parts[0].strip():
            tasks.append({"index": 0, "title": "", "content": parts[0]})
                
        for i in range(1, len(parts), 2):
            title = parts[i]
            content = parts[i+1] if i+1 < len(parts) else ""
            if content.strip():
                tasks.append({"index": i, "title": title, "content": content})
                
        results_dict = {}
        
        def process_task(task):
            return optimize_text_with_llm(task['index'], task['title'], task['content'], extract_labels)
        
        # 使用线程池进行并发请求
        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_task = {executor.submit(process_task, task): task for task in tasks}
            
            for future in as_completed(future_to_task):
                result_json = future.result()
                idx = result_json.get("id", -1)
                opt_title = result_json.get("title", "").strip()
                opt_content = result_json.get("content", "").strip()
                
                if opt_content:
                    if opt_title:
                        results_dict[idx] = f"\n{opt_title}\n\n{opt_content}\n"
                    else:
                        results_dict[idx] = f"{opt_content}\n"
                else:
                    results_dict[idx] = ""

        # 按照原来的顺序重组
        optimized_md_parts = [results_dict[task['index']] for task in tasks if results_dict.get(task['index'])]
        final_md = "\n".join(optimized_md_parts)
        
        # 4. 切分为 Chunks
        chunks = chunk_markdown(final_md)
        return chunks

    except Exception as e:
        print(f"处理 PDF 失败: {e}")
        raise HTTPException(status_code=500, detail=f"PDF Processing Error: {str(e)}")
    finally:
        # 清理临时文件
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)


async def process_docx_file(file: UploadFile, use_llm: bool = True, extract_labels: str = "") -> List[str]:
    """处理 DOCX 文件：提取文本（带基础标题层级） -> 清洗 -> (可选) LLM 优化 -> 切分为 Chunks"""
    if not HAS_PDF_TOOLS:
        raise HTTPException(
            status_code=501,
            detail="Server missing docx, openai or langchain_text_splitters",
        )

    temp_dir = "tmp"
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{file.filename}")
    
    try:
        # 保存上传的文件
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 1. 提取 DOCX 为基础 Markdown 文本
        doc = docx.Document(temp_file_path)
        md_lines = []
        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue
            
            # 尝试根据 Word 的样式识别标题层级，转化为 Markdown 的 # 号
            style_name = para.style.name.lower()
            if style_name.startswith('heading'):
                try:
                    level = int(style_name.split(' ')[-1])
                    md_lines.append(f"{'#' * level} {text}\n")
                except ValueError:
                    md_lines.append(f"# {text}\n")
            elif style_name == 'title':
                md_lines.append(f"# {text}\n")
            else:
                md_lines.append(text)
                
        md_text = "\n".join(md_lines)
        
        # 2. 清洗文本
        cleaned_md = clean_markdown_text(md_text)
        
        # 如果不使用 LLM 优化，直接切分返回
        if not use_llm:
            return chunk_markdown(cleaned_md)
        
        # 3. 按标题切分并调用大模型优化
        parts = re.split(r'(^#+ .+?)\n', cleaned_md, flags=re.MULTILINE)
        tasks = []
        
        if parts and parts[0].strip():
            tasks.append({"index": 0, "title": "", "content": parts[0]})
                
        for i in range(1, len(parts), 2):
            title = parts[i]
            content = parts[i+1] if i+1 < len(parts) else ""
            if content.strip():
                tasks.append({"index": i, "title": title, "content": content})
                
        results_dict = {}
        
        def process_task(task):
            return optimize_text_with_llm(task['index'], task['title'], task['content'], extract_labels)
        
        # 使用线程池进行并发请求
        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_task = {executor.submit(process_task, task): task for task in tasks}
            
            for future in as_completed(future_to_task):
                result_json = future.result()
                idx = result_json.get("id", -1)
                opt_title = result_json.get("title", "").strip()
                opt_content = result_json.get("content", "").strip()
                
                if opt_content:
                    if opt_title:
                        results_dict[idx] = f"\n{opt_title}\n\n{opt_content}\n"
                    else:
                        results_dict[idx] = f"{opt_content}\n"
                else:
                    results_dict[idx] = ""

        # 按照原来的顺序重组
        optimized_md_parts = [results_dict[task['index']] for task in tasks if results_dict.get(task['index'])]
        final_md = "\n".join(optimized_md_parts)
        
        # 4. 切分为 Chunks
        chunks = chunk_markdown(final_md)
        return chunks

    except Exception as e:
        print(f"处理 DOCX 失败: {e}")
        raise HTTPException(status_code=500, detail=f"DOCX Processing Error: {str(e)}")
    finally:
        # 清理临时文件
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@app.post("/upload", response_model=UploadResponse, summary="通用文档上传并解析接口")
async def upload_and_process_document(
    file: UploadFile = File(..., description="要上传的文档文件（支持 PDF 等格式）", json_schema_extra={"format": "binary"}), 
    use_llm: bool = Form(True, description="是否使用大模型对文本进行评估、过滤和排版优化"),
    extract_labels: str = Form("", description="自定义大模型提取的干货标签（逗号分隔）"),
    token: str = Depends(verify_token)
):
    """
    通用上传接口，通过判断文件后缀名进行路由分发：
    - .pdf -> process_pdf_file
    - .docx -> process_docx_file
    返回解析、优化并切分后的 Chunks 数组
    """
    filename = file.filename.lower()
    
    if filename.endswith(".pdf"):
        file_type = "pdf"
        chunks = await process_pdf_file(file, use_llm, extract_labels)
    elif filename.endswith(".docx") or filename.endswith(".doc"):
        file_type = "docx"
        chunks = await process_docx_file(file, use_llm, extract_labels)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type for filename: {file.filename}. Supported types are: .pdf, .docx, .doc",
        )

    return {
        "status": "success", 
        "filename": file.filename, 
        "file_type": file_type,
        "chunks": chunks
    }


# -------------------------------------------------------
# 服务管理逻辑 (vLLM 多模型部署)
# -------------------------------------------------------
def start_vllm_engine(
    port: int,
    model_path: str,
    model_name: str,
    task: str = None,
    gpu_util: str = "0.2",
    gpu_id: str = "0",
    max_model_len: str = "4096",
):
    """启动单个 vLLM 子进程"""
    print(
        f"正在启动 vLLM 引擎 (Port {port}, Model: {model_name}, "
        f"GPU: {gpu_id}, MaxLen: {max_model_len})..."
    )

    os.makedirs(VLLM_LOG_DIR, exist_ok=True)
    log_file_path = os.path.join(VLLM_LOG_DIR, f"vllm_{port}.log")

    env = os.environ.copy()
    env["CUDA_VISIBLE_DEVICES"] = gpu_id

    cmd = [
        sys.executable,
        "-m",
        "vllm.entrypoints.openai.api_server",
        "--model",
        model_path,
        "--served-model-name",
        model_name,
        "--host",
        "0.0.0.0",
        "--port",
        str(port),
        "--trust-remote-code",
        "--root-path",
        ROOT_PATH,
        "--gpu-memory-utilization",
        gpu_util,
        "--max-model-len",
        max_model_len,
        "--enforce-eager",
    ]

    log_f = open(log_file_path, "w")
    process = subprocess.Popen(
        cmd, stdout=log_f, stderr=subprocess.STDOUT, preexec_fn=os.setsid, env=env
    )
    return process, log_f


def wait_for_vllm_ready(ports: List[int]):
    """无限等待多个 vLLM 服务就绪"""
    for port in ports:
        print(f"等待 vLLM 初始化 (Port {port}, 将持续探测直到成功)...")
        health_url = f"http://localhost:{port}/health"
        while True:
            try:
                resp = requests.get(health_url, timeout=2)
                if resp.status_code == 200:
                    print(f"\nvLLM 引擎 (Port {port}) 已就绪!")
                    break
            except requests.exceptions.RequestException:
                pass
            sys.stdout.write(".")
            sys.stdout.flush()
            time.sleep(5)


def main():
    processes = []
    log_files = []

    def cleanup(signum=None, frame=None):
        print("\n正在停止服务...")
        for p in processes:
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            except Exception:
                pass
        for f in log_files:
            try:
                f.close()
            except Exception:
                pass
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    # 1. 启动多个 vLLM 实例 (利用多卡进行分布式部署)
    try:
        # 【分配到 GPU 0】
        # Embedding (8004) - 0.6B 模型，处理文本块不需要太长上下文，设为 4096 即可
        p, f = start_vllm_engine(
            EMBED_PORT,
            EMBEDDING_MODEL_PATH,
            DEFAULT_EMBEDDING_MODEL_NAME,
            gpu_util="0.6",
            gpu_id="0",
            max_model_len="1024",
        )
        processes.append(p)
        log_files.append(f)

        # 【分配到 GPU 2】
        # Generate LLM (8006) - 8B 模型，作为对话生成，需要拼接检索到的上下文，设为 8192
        p, f = start_vllm_engine(
            GENERATE_LLM_PORT,
            GENERATE_MODEL_PATH,
            DEFAULT_GENERATE_MODEL_NAME,
            gpu_util="0.8",
            gpu_id="1",
            max_model_len="8192",
        )
        processes.append(p)
        log_files.append(f)

        # 2. 等待所有服务就绪
        active_ports = [EMBED_PORT, GENERATE_LLM_PORT]
        wait_for_vllm_ready(active_ports)

        # 3. 启动业务服务
        print(f"启动 RAG 业务接口服务 (Port {APP_PORT})...")
        uvicorn.run(app, host="0.0.0.0", port=APP_PORT)
    except Exception as e:
        print(f"启动失败: {e}")
        cleanup()


if __name__ == "__main__":
    main()
