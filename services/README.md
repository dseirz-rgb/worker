# Services - 后端服务

## 目录结构

```
services/
├── lightrag/       -> ../riskcontrol/lightrag-service
│   └── RAG 知识库服务 (Python + FastAPI)
│
└── voice-agent/    -> ../riskcontrol/livekit-voice-service
    └── 语音助手服务 (Python + LiveKit)
```

## 服务说明

### LightRAG

基于 LightRAG 的知识库服务，支持：
- 投资知识索引
- 日常知识索引
- 命名空间隔离

### Voice Agent

基于 LiveKit 的语音助手服务，支持：
- Investment Agent (投资顾问)
- Daily Agent (日常助手)

## 部署

这些服务部署在 GCP Cloud Run 上。

```bash
# 部署 LightRAG
cd services/lightrag && ./deploy.sh

# 部署 Voice Agent
cd services/voice-agent && ./deploy.sh
```
