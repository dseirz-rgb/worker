# Echo SeekDB Sidecar

Echo 应用的 AI 原生搜索数据库服务，基于 ChromaDB 实现向量搜索、全文搜索和混合搜索。

## 功能特性

- 🔍 向量搜索 - 基于语义相似度的搜索
- 📝 全文搜索 - 基于关键词的搜索
- 🔀 混合搜索 - 结合向量和全文搜索
- 📦 自动 Embedding - 内容自动生成向量表示
- 💾 持久化存储 - 数据本地持久化

## 安装

```bash
cd echo/sidecar
pip install -e .
```

## 运行

```bash
uvicorn main:app --port 8765 --reload
```

## API 端点

- `GET /health` - 健康检查
- `POST /notes` - 创建笔记
- `GET /notes/{id}` - 获取笔记
- `PUT /notes/{id}` - 更新笔记
- `DELETE /notes/{id}` - 删除笔记
- `POST /search` - 搜索
