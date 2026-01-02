# Voice Agent Dockerfile for Google Cloud Run
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# Cloud Run 使用 PORT 环境变量
ENV PORT=8080

# 启动 Agent（生产模式）
CMD ["python", "agent.py", "start"]
