# LiveKit Voice Agent

基于 LiveKit Agents SDK 和 Google Gemini 的实时语音助手后端服务。

## 功能特性

- 🎙️ 实时语音对话
- 🤖 Google Gemini 2.5 Flash 语音模型
- 🔇 Silero VAD 语音活动检测
- 🔊 BVC 噪声消除

## 快速开始

### 1. 安装依赖

```bash
cd server/voiceAgent
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入实际的 API 密钥
```

### 3. 启动服务

```bash
python agent.py dev
```

## 环境变量说明

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `LIVEKIT_URL` | ✅ | LiveKit 服务器 WebSocket URL |
| `LIVEKIT_API_KEY` | ✅ | LiveKit API 密钥 |
| `LIVEKIT_API_SECRET` | ✅ | LiveKit API Secret |
| `GOOGLE_API_KEY` | ✅ | Google API 密钥 |

## 文件结构

```
voiceAgent/
├── agent.py          # Agent 主入口
├── config.py         # 环境变量验证
├── requirements.txt  # Python 依赖
├── .env.example      # 环境变量示例
└── README.md         # 说明文档
```

## 开发命令

```bash
# 开发模式（自动重载）
python agent.py dev

# 生产模式
python agent.py start

# 连接到特定房间
python agent.py connect --room my-room
```

## 架构说明

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Client    │────▶│  LiveKit Cloud  │────▶│  Voice Agent    │
│   (Browser)     │◀────│   (托管服务)     │◀────│  (Cloud Run)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │  Google Gemini  │
                                                │  (LLM + TTS)    │
                                                └─────────────────┘
```

## 生产部署 (Google Cloud Run)

### 当前部署信息

- **Service URL**: https://voice-agent-673807213796.asia-east1.run.app
- **GCP Project**: gen-lang-client-0596519904
- **Region**: asia-east1
- **部署时间**: 2026-01-03

### 部署命令

```bash
# 1. 构建并推送镜像
cd server/voiceAgent
gcloud builds submit --tag gcr.io/gen-lang-client-0596519904/voice-agent .

# 2. 部署到 Cloud Run
gcloud run deploy voice-agent \
  --image gcr.io/gen-lang-client-0596519904/voice-agent \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --set-env-vars "LIVEKIT_URL=xxx,LIVEKIT_API_KEY=xxx,LIVEKIT_API_SECRET=xxx,GOOGLE_API_KEY=xxx"
```

### 工作原理

Voice Agent 是一个 **WebSocket 客户端**，主动连接到 LiveKit Cloud。
Cloud Run 需要 HTTP 端口监听才能保持容器运行，所以 agent.py 中包含一个简单的健康检查 HTTP 服务器。

```
Cloud Run Container:
├── HTTP Health Server (port 8080) ← Cloud Run 健康检查
└── LiveKit Agent (WebSocket client) → 连接到 LiveKit Cloud
```

### 费用说明

- **按需计费**：没有请求时不产生费用
- **冷启动**：首次请求约 10-30 秒延迟
- **预估费用**：低使用量 < $5/月

### 注意事项

- `min-instances=0` 表示按需启动，会有冷启动延迟
- 前端已实现冷启动等待 UI（倒计时提示）
- 如需更快响应，可设置 `min-instances=1`（会持续产生费用）
