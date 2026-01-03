# Echo SeekDB Sidecar

Echo 的本地知识库后端，使用 SeekDB (OceanBase AI-Native Search Database) 提供：
- 文档管理 (Paperless 兼容 API)
- 向量搜索 + 全文搜索
- 多模态内容索引 (笔记、视频、PPT)

## 快速开始

### 1. 启动服务

```bash
cd echo/sidecar

# 复制环境变量
cp .env.example .env

# 启动 Docker 服务
docker-compose up -d
```

### 2. 验证服务

```bash
# 检查健康状态
curl http://localhost:8765/health

# 获取文档列表
curl http://localhost:8765/api/documents/

# 获取标签列表
curl http://localhost:8765/api/tags/
```

## API 端点

### Paperless 兼容 API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/documents/` | GET | 获取文档列表 (分页) |
| `/api/documents/{id}/` | GET | 获取文档详情 |
| `/api/documents/post_document/` | POST | 上传文档 |
| `/api/documents/{id}/` | PATCH | 更新文档 |
| `/api/documents/{id}/` | DELETE | 删除文档 |
| `/api/documents/{id}/download/` | GET | 下载原文件 |
| `/api/documents/{id}/thumb/` | GET | 获取缩略图 |
| `/api/tags/` | GET/POST | 标签管理 |
| `/api/document_types/` | GET/POST | 文档类型管理 |

### 搜索 API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/search` | POST | 混合搜索 (向量 + 全文) |
| `/health` | GET | 健康检查 |

## 目录结构

```
sidecar/
├── docker-compose.yml    # Docker 编排
├── Dockerfile            # API 服务镜像
├── requirements.txt      # Python 依赖
├── .env.example          # 环境变量模板
├── storage/              # 文件存储
│   ├── documents/        # 原始文档
│   └── thumbnails/       # 缩略图
└── scripts/
    ├── server.py         # FastAPI 服务
    ├── init_db.sql       # 数据库初始化
    ├── seed_data.sql     # 示例数据
    ├── sync_notes.py     # Supabase 同步
    ├── video_processor.py # 视频处理
    └── ppt_processor.py  # PPT 处理
```

## 环境变量

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `SEEKDB_HOST` | localhost | SeekDB 主机 |
| `SEEKDB_PORT` | 2881 | SeekDB 端口 |
| `SEEKDB_USER` | root | 数据库用户 |
| `SEEKDB_PASSWORD` | (空) | 数据库密码 |
| `SEEKDB_DATABASE` | echo | 数据库名 |
| `API_PORT` | 8765 | API 服务端口 |
| `STORAGE_PATH` | ./storage | 文件存储路径 |

## 开发

### 本地运行 (不使用 Docker)

```bash
# 安装依赖
pip install -r requirements.txt

# 启动 SeekDB (需要先安装)
# 参考: https://github.com/oceanbase/seekdb

# 初始化数据库
mysql -h 127.0.0.1 -P 2881 -u root < scripts/init_db.sql
mysql -h 127.0.0.1 -P 2881 -u root echo < scripts/seed_data.sql

# 启动 API 服务
python scripts/server.py
```

## 参考

- [SeekDB GitHub](https://github.com/oceanbase/seekdb)
- [OceanBase 文档](https://www.oceanbase.com/docs)
