# Echo SeekDB API 服务 Dockerfile

FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY scripts/ ./scripts/

# 创建存储目录
RUN mkdir -p /app/storage/documents /app/storage/thumbnails

# 暴露端口
EXPOSE 8765

# 启动命令
CMD ["python", "scripts/server.py"]
