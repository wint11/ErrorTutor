import os
# Set Hugging Face mirror site for better connectivity in China
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

from huggingface_hub import snapshot_download
import argparse
from tqdm import tqdm
import json

# Recommended models (~14B range, Chat/Dialogue focused)
MODELS = {
    "deepseek-r1-14b": {
        "id": "deepseek-ai/DeepSeek-R1-Distill-Qwen-14B",
        "path": "/me4012/TongJI/models/DeepSeek-R1-Distill-Qwen-14B",
        "desc": "DeepSeek R1 Distill (14B) - Excellent reasoning and dialogue capabilities."
    },
    "mistral-small-24b": {
        "id": "mistralai/Mistral-Small-24B-Instruct-2501",
        "path": "/me4012/TongJI/models/Mistral-Small-24B-Instruct-2501",
        "desc": "Mistral Small 3 (24B) - A very strong model, slightly larger than 14B."
    },
    "glm-4-9b": {
        "id": "THUDM/glm-4-9b-chat",
        "path": "/me4012/TongJI/models/glm-4-9b-chat",
        "desc": "GLM-4 9B Chat - Zhipu AI's powerful open-source model with long context (128k)."
    },
    "qwen3.5-8b": {
        "id": "Qwen/Qwen3.5-8B",
        "path": "/me4012/TongJI/models/Qwen3.5-8B",
        "desc": "Qwen 3.5 8B - Latest generation from Alibaba." 
    },
    "qwen3.5-4b": {
        "id": "Qwen/Qwen3.5-4B",
        "path": "/me4012/TongJI/models/Qwen3.5-4B",
        "desc": "Qwen 3.5 4B - Latest generation from Alibaba." 
    },
    "qwen3.5-0.8b": {
        "id": "Qwen/Qwen3.5-0.8B",
        "path": "/me4012/TongJI/models/Qwen3.5-0.8B",
        "desc": "Qwen 3.5 0.8B - Latest generation from Alibaba." 
    },
    "Qwen3-Embedding-0.6B": {
        "id": "Qwen/Qwen3-Embedding-0.6B",
        "path": "/me4012/TongJI/models/Qwen3-Embedding-0.6B",
        "desc": "Qwen 3 Embedding 0.6B - Latest generation from Alibaba." 
    },
    "Qwen3-Reranker-0.6B": {
        "id": "Qwen/Qwen3-Reranker-0.6B",
        "path": "/me4012/TongJI/models/Qwen3-Reranker-0.6B",
        "desc": "Qwen 3 Reranker 0.6B - Small and efficient reranker from Alibaba."
    },
    "qwen3-vl-2b": {
        "id": "Qwen/Qwen3-VL-2B-Instruct",
        "path": "/me4012/TongJI/models/Qwen3-VL-2B-Instruct",
        "desc": "Qwen3-VL 2B Instruct - The latest Qwen 3 vision-language model."
    }
}

def download_model(model_key):
    if model_key not in MODELS:
        print(f"Error: Model key '{model_key}' not found.")
        print("Available keys:", ", ".join(MODELS.keys()))
        return

    model_info = MODELS[model_key]
    model_name = model_info["id"]
    local_dir = model_info["path"]

    print(f"\n{'='*50}")
    print(f"Downloading: {model_key}")
    print(f"Repo ID:     {model_name}")
    print(f"Description: {model_info['desc']}")
    print(f"Save Path:   {local_dir}")
    print(f"{'='*50}\n")
    
    os.makedirs(local_dir, exist_ok=True)

    try:
        snapshot_download(
            repo_id=model_name,
            local_dir=local_dir,
        )
        print(f"\n[SUCCESS] {model_name} downloaded to {local_dir}")
        print(f"Update your service.py to use: MODEL_PATH = '{local_dir}'")
        print(f"Update your service.py to use: MODEL_NAME = '{model_name}'")
    except Exception as e:
        print(f"\n[ERROR] Failed to download {model_name}: {e}")
        print("Please check if the model ID is correct and accessible.")

def list_models():
    print("\nAvailable Models (Chat/Dialogue Focused):")
    print(f"{'Key':<20} | {'Model ID':<45} | {'Description'}")
    print("-" * 120)
    for key, info in MODELS.items():
        print(f"{key:<20} | {info['id']:<45} | {info['desc']}")
    print("-" * 120)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download Recommended Chat LLMs")
    parser.add_argument("model", type=str, nargs="?", help="Model key to download")
    parser.add_argument("--list", action="store_true", help="List available models")
    
    args = parser.parse_args()
    
    if args.list or not args.model:
        list_models()
    else:
        download_model(args.model)
