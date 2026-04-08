#!/bin/bash
# 一键安装部署脚本
# 存放在 /home/xuyantao/TongJi_deploy/install.sh

set -e # 发生错误时退出

echo "==========================================="
echo "   TongJi_deploy 一键部署安装脚本启动"
echo "==========================================="

# 1. 检查操作系统版本
echo "=> 正在检测系统版本..."
if [ -f /etc/os-release ]; then
    cat /etc/os-release | grep PRETTY_NAME | cut -d '=' -f 2 | tr -d '"'
else
    echo "无法确定系统版本 (未找到 /etc/os-release)。"
fi

# 2. 检查 NVIDIA 显卡驱动版本 (>=550)
echo "=> 正在检测 NVIDIA 显卡驱动版本..."
if ! command -v nvidia-smi &> /dev/null; then
    echo "错误: 未检测到 nvidia-smi，请确保已安装 NVIDIA 显卡驱动！"
    exit 1
fi

DRIVER_VERSION=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -n 1)
echo "当前 NVIDIA 驱动版本: $DRIVER_VERSION"

# 提取主版本号
MAJOR_VERSION=$(echo "$DRIVER_VERSION" | cut -d'.' -f1)
if [ "$MAJOR_VERSION" -lt 550 ]; then
    echo "错误: NVIDIA 驱动版本必须大于等于 550。当前主版本为 $MAJOR_VERSION"
    exit 1
fi
echo "=> NVIDIA 驱动版本符合要求 (>= 550)。"

# 3. 检查并安装 Conda (Miniconda)
echo "=> 正在检测 Conda 环境..."
if ! command -v conda &> /dev/null; then
    # 检查是否由于未初始化环境变量导致
    if [ -f "$HOME/miniconda3/bin/conda" ]; then
        export PATH="$HOME/miniconda3/bin:$PATH"
    elif [ -f "$HOME/anaconda3/bin/conda" ]; then
        export PATH="$HOME/anaconda3/bin:$PATH"
    else
        echo "未检测到 conda，准备下载并安装 Miniconda..."
        MINICONDA_INSTALLER="Miniconda3-latest-Linux-x86_64.sh"
        wget https://repo.anaconda.com/miniconda/$MINICONDA_INSTALLER -O /tmp/$MINICONDA_INSTALLER
        bash /tmp/$MINICONDA_INSTALLER -b -p $HOME/miniconda3
        rm /tmp/$MINICONDA_INSTALLER
        
        # 临时在当前脚本中添加 conda 到环境变量
        export PATH="$HOME/miniconda3/bin:$PATH"
        echo "=> Miniconda 安装完成。"
    fi
fi

if command -v conda &> /dev/null; then
    echo "=> Conda 已就绪: $(conda --version)"
else
    echo "错误: Conda 依然无法使用，请检查安装！"
    exit 1
fi

# 确保 conda 命令在 bash 脚本的 subshell 中可用
eval "$(conda shell.bash hook)"

# 4. 创建 Conda 环境
ENV_NAME="vllm_env"
echo "=> 准备配置 Conda 环境: $ENV_NAME (Python 3.12)"

if conda info --envs | awk '{print $1}' | grep -x -q "$ENV_NAME"; then
    echo "=> 环境 $ENV_NAME 已存在。"
else
    echo "=> 创建新环境 $ENV_NAME..."
    conda create -n $ENV_NAME python=3.12 -y
fi

echo "=> 正在激活环境 $ENV_NAME..."
conda activate $ENV_NAME

# 5. 安装依赖
# 脚本位于 /home/xuyantao/TongJi_deploy 目录
REQ_FILE="$(dirname "$0")/requirements_vllm_rag.txt"
if [ ! -f "$REQ_FILE" ]; then
    echo "错误: 找不到依赖文件 $REQ_FILE"
    exit 1
fi

echo "=> 正在基于 $REQ_FILE 安装依赖..."
# 按照要求使用 extra-index-url
pip install -r "$REQ_FILE" --extra-index-url https://download.pytorch.org/whl/cu124

# 6. 补充依赖安装
# 依据 service_rag_server.py 脚本中的 import，补充安装不在 txt 中但在服务中使用的模块
# 检查后发现 chromadb 已经在 txt (1.5.5) 中，但 python-docx (处理 docx) 似乎缺失
echo "=> 正在检查并安装额外的依赖..."
pip install python-docx

echo "==========================================="
echo "部署完成！所有依赖已成功安装。"
echo "==========================================="
echo "如需进入环境并运行项目，请执行以下命令："
echo "source $(conda info --base)/etc/profile.d/conda.sh"
echo "conda activate $ENV_NAME"
