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
│   Web Client    │────▶│  LiveKit Server │────▶│  Voice Agent    │
│   (Browser)     │◀────│   (WebRTC)      │◀────│  (Python)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │  Google Gemini  │
                                                │  (LLM + TTS)    │
                                                └─────────────────┘
```
