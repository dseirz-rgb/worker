# Design Document: Gemini Live Voice Chat Integration

## Overview

本设计文档描述了如何使用 Gemini Live API 为投资风控系统集成实时语音交互能力。

相比之前的 FastRTC 方案，Gemini Live API 架构更加简洁：
- **无需独立 STT/TTS 模型**: Gemini Live API 原生支持语音输入输出
- **WebSocket 代理模式**: 后端作为代理，转发前端音频到 Gemini Live API
- **内置 VAD**: 使用 Gemini 的语音活动检测，无需额外实现
- **复用现有基础设施**: 使用现有的 Gemini API Key 和 Supabase 数据

### 核心设计决策

1. **WebSocket 代理架构**: 后端作为 WebSocket 代理，连接前端和 Gemini Live API
2. **系统指令注入**: 在会话开始时注入投资组合上下文作为系统指令
3. **原生音频格式**: 使用 Gemini Live API 支持的 PCM 格式 (16kHz 输入, 24kHz 输出)
4. **渐进式集成**: 前端通过可选的语音按钮集成，不影响现有文字聊天功能

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │   ChatWindow    │  │  VoiceWidget    │  │   AudioProcessor    │  │
│  │   (existing)    │  │   (updated)     │  │   (new)             │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │
│           │                    │                       │             │
└───────────┼────────────────────┼───────────────────────┼─────────────┘
            │                    │ WebSocket (WSS)       │
            │ HTTP/SSE           │                       │
            ▼                    ▼                       │
┌───────────────────┐  ┌─────────────────────────────────────────────┐
│   Vercel API      │  │         Voice Service (Python)              │
│   /api/chat       │  │  ┌─────────────┐  ┌─────────────────────┐   │
│   (existing)      │  │  │  WebSocket  │  │  Session Manager    │   │
└───────────────────┘  │  │   Handler   │  │                     │   │
                       │  └──────┬──────┘  └──────────┬──────────┘   │
                       │         │                    │               │
                       │  ┌──────▼──────────────────────────────┐    │
                       │  │     Gemini Live API Client          │    │
                       │  │     (WebSocket to Google)           │    │
                       │  └──────┬──────────────────────────────┘    │
                       │         │                                    │
                       │  ┌──────▼──────┐  ┌─────────────────────┐   │
                       │  │  Context    │  │  Audio Buffer       │   │
                       │  │  Fetcher    │  │  Manager            │   │
                       │  └─────────────┘  └─────────────────────┘   │
                       └─────────────────────────────────────────────┘
                                              │
                                              ▼
                       ┌─────────────────────────────────────────────┐
                       │              External Services              │
                       │  ┌─────────────┐  ┌─────────────────────┐   │
                       │  │ Gemini Live │  │   LightRAG Service  │   │
                       │  │ API (Google)│  │                     │   │
                       │  └─────────────┘  └─────────────────────┘   │
                       │  ┌─────────────┐                            │
                       │  │  Supabase   │                            │
                       │  └─────────────┘                            │
                       └─────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Voice Service (Python) - WebSocket Proxy

后端 WebSocket 代理服务，连接前端和 Gemini Live API。

```python
# voice-service/main.py

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import base64
from google import genai

app = FastAPI()

# Gemini Live API 配置
GEMINI_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"
GEMINI_CONFIG = {
    "response_modalities": ["AUDIO"],
    "speech_config": {
        "voice_config": {
            "prebuilt_voice_config": {
                "voice_name": "Aoede"  # 或其他支持的声音
            }
        }
    }
}

class VoiceSession:
    """管理单个语音会话"""
    def __init__(self, session_id: str, websocket: WebSocket):
        self.session_id = session_id
        self.client_ws = websocket
        self.gemini_session = None
        self.context = ""
    
    async def connect_to_gemini(self, system_instruction: str):
        """建立到 Gemini Live API 的连接"""
        client = genai.Client()
        config = {
            **GEMINI_CONFIG,
            "system_instruction": system_instruction
        }
        self.gemini_session = await client.aio.live.connect(
            model=GEMINI_MODEL,
            config=config
        )
    
    async def send_audio_to_gemini(self, audio_data: bytes):
        """发送音频到 Gemini"""
        if self.gemini_session:
            await self.gemini_session.send_realtime_input(
                audio={"data": audio_data, "mime_type": "audio/pcm"}
            )
    
    async def receive_from_gemini(self):
        """从 Gemini 接收响应并转发到客户端"""
        async for response in self.gemini_session.receive():
            if response.server_content and response.server_content.model_turn:
                for part in response.server_content.model_turn.parts:
                    if part.inline_data and part.inline_data.data:
                        # 转发音频到客户端
                        await self.client_ws.send_bytes(part.inline_data.data)

@app.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket):
    await websocket.accept()
    session = VoiceSession(session_id=str(uuid.uuid4()), websocket=websocket)
    
    try:
        # 获取投资上下文
        context = await fetch_portfolio_context()
        system_instruction = build_system_instruction(context)
        
        # 连接 Gemini Live API
        await session.connect_to_gemini(system_instruction)
        
        # 启动接收任务
        receive_task = asyncio.create_task(session.receive_from_gemini())
        
        # 处理客户端音频
        while True:
            data = await websocket.receive_bytes()
            await session.send_audio_to_gemini(data)
            
    except WebSocketDisconnect:
        pass
    finally:
        if session.gemini_session:
            await session.gemini_session.close()
```

### 2. Voice Widget (React Component)

前端语音交互组件，使用 Web Audio API 处理音频。

```typescript
// client/src/components/chat/VoiceWidget.tsx

interface VoiceWidgetProps {
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error';

interface VoiceWidgetState {
  status: ConnectionStatus;
  errorMessage?: string;
}

// 音频处理配置
const AUDIO_CONFIG = {
  inputSampleRate: 16000,  // Gemini 输入要求
  outputSampleRate: 24000, // Gemini 输出格式
  channelCount: 1,         // 单声道
  bitDepth: 16,            // 16-bit PCM
};

class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  
  async startRecording(onAudioData: (data: ArrayBuffer) => void): Promise<void> {
    this.audioContext = new AudioContext({ sampleRate: AUDIO_CONFIG.inputSampleRate });
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(1024, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = this.float32ToPCM16(inputData);
      onAudioData(pcmData.buffer);
    };
    
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }
  
  private float32ToPCM16(float32Array: Float32Array): Int16Array {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm16;
  }
  
  async playAudio(pcmData: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: AUDIO_CONFIG.outputSampleRate });
    }
    
    const int16Array = new Int16Array(pcmData);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 0x8000;
    }
    
    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, AUDIO_CONFIG.outputSampleRate);
    audioBuffer.getChannelData(0).set(float32Array);
    
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.start();
  }
  
  stopRecording(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }
}
```

### 3. Session Manager

会话管理器，处理多用户并发。

```python
# voice-service/session_manager.py

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Optional
import uuid
import asyncio

@dataclass
class VoiceSession:
    session_id: str
    created_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)
    portfolio_context: str = ""
    is_active: bool = True
    
    def update_activity(self):
        self.last_activity = datetime.now()
    
    def is_expired(self, timeout_seconds: int = 1800) -> bool:
        return (datetime.now() - self.last_activity).seconds > timeout_seconds

class SessionManager:
    def __init__(self, timeout_seconds: int = 1800):
        self._sessions: Dict[str, VoiceSession] = {}
        self._timeout = timeout_seconds
        self._cleanup_task: Optional[asyncio.Task] = None
    
    def create_session(self) -> VoiceSession:
        session_id = str(uuid.uuid4())
        session = VoiceSession(session_id=session_id)
        self._sessions[session_id] = session
        return session
    
    def get_session(self, session_id: str) -> Optional[VoiceSession]:
        session = self._sessions.get(session_id)
        if session and not session.is_expired(self._timeout):
            session.update_activity()
            return session
        return None
    
    def delete_session(self, session_id: str) -> bool:
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False
    
    def get_active_count(self) -> int:
        return len([s for s in self._sessions.values() if s.is_active])
    
    async def start_cleanup_task(self):
        async def cleanup_loop():
            while True:
                await asyncio.sleep(60)
                expired = [sid for sid, s in self._sessions.items() if s.is_expired(self._timeout)]
                for sid in expired:
                    del self._sessions[sid]
        
        self._cleanup_task = asyncio.create_task(cleanup_loop())
    
    async def stop_cleanup_task(self):
        if self._cleanup_task:
            self._cleanup_task.cancel()
```

### 4. Context Fetcher

上下文获取器，从 Supabase 和 LightRAG 获取投资数据。

```python
# voice-service/context_fetcher.py

import httpx
from typing import Optional
import asyncio

class ContextFetcher:
    def __init__(self, supabase_url: str, supabase_key: str, lightrag_url: str):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.lightrag_url = lightrag_url
    
    async def fetch_portfolio_summary(self) -> dict:
        """获取投资组合摘要"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.supabase_url}/rest/v1/dashboard_live",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}"
                },
                params={"order": "snapshot_date.desc", "limit": 1}
            )
            data = response.json()
            return data[0] if data else {}
    
    async def fetch_positions(self) -> list:
        """获取当前持仓"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.supabase_url}/rest/v1/positions_live",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}"
                }
            )
            return response.json()
    
    async def build_system_instruction(self) -> str:
        """构建系统指令，包含投资上下文"""
        portfolio, positions = await asyncio.gather(
            self.fetch_portfolio_summary(),
            self.fetch_positions()
        )
        
        instruction_parts = [
            "你是一个专业的投资助手，帮助用户分析投资组合、讨论市场趋势和风险管理。",
            "请用简洁、专业的语言回答问题，回答应该简短，适合语音对话。",
            ""
        ]
        
        if portfolio:
            instruction_parts.append(f"""
当前投资组合概览：
- 总净值: ¥{portfolio.get('total_net_worth_cny', 0):,.0f}
- 持仓数量: {portfolio.get('total_positions', 0)}
- 现金比例: {portfolio.get('cash_ratio_percent', 0):.1f}%
- 年初至今收益: {portfolio.get('ytd_return_percent', 0):.2f}%
- 杠杆率: {portfolio.get('leverage_ratio', 1):.2f}x
""")
        
        if positions:
            top_positions = sorted(
                positions,
                key=lambda x: abs(x.get('market_value_cny', 0)),
                reverse=True
            )[:5]
            positions_text = "\n".join([
                f"- {p.get('ticker', 'N/A')}: {p.get('weight_percent', 0):.1f}% (盈亏: {p.get('unrealized_pnl_percent', 0):.1f}%)"
                for p in top_positions
            ])
            instruction_parts.append(f"""
主要持仓 (Top 5):
{positions_text}
""")
        
        return "\n".join(instruction_parts)
```

## Data Models

### WebSocket Message Format

```typescript
// 客户端发送的消息
interface ClientMessage {
  type: 'audio' | 'control';
  data?: ArrayBuffer;  // PCM 音频数据
  action?: 'start' | 'stop' | 'mute' | 'unmute';
}

// 服务端发送的消息
interface ServerMessage {
  type: 'audio' | 'status' | 'error' | 'transcript';
  data?: ArrayBuffer;  // PCM 音频数据
  status?: 'connected' | 'speaking' | 'listening' | 'disconnected';
  error?: string;
  transcript?: string;  // 可选的转录文本
}
```

### Voice Service Configuration

```python
# voice-service/config.py

from pydantic_settings import BaseSettings

class VoiceServiceConfig(BaseSettings):
    # Server
    host: str = "0.0.0.0"
    port: int = 8080
    
    # Gemini Live API
    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash-native-audio-preview-12-2025"
    
    # External Services
    supabase_url: str
    supabase_key: str
    lightrag_url: str = "http://lightrag-service-1.zeabur.internal:8080"
    
    # Session
    session_timeout_seconds: int = 1800  # 30 minutes
    
    # Audio
    input_sample_rate: int = 16000
    output_sample_rate: int = 24000
    
    # CORS
    allowed_origins: list[str] = ["*"]
    
    class Config:
        env_file = ".env"
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Audio Forwarding Integrity

*For any* audio data received from the client, the Voice_Service SHALL forward it to Gemini Live API without modification, and *for any* audio response from Gemini, it SHALL be forwarded to the client without modification.

**Validates: Requirements 1.3, 1.4**

### Property 2: Session ID Uniqueness

*For any* set of N sessions created by the SessionManager, all N session IDs SHALL be unique (no duplicates), and each ID SHALL be a valid UUID v4 format.

**Validates: Requirements 4.2**

### Property 3: System Instruction Content

*For any* voice session with available portfolio data, the system instruction sent to Gemini SHALL contain:
- Portfolio net worth value
- Number of positions
- At least one position ticker symbol (if positions exist)

**Validates: Requirements 2.2, 2.3**

### Property 4: Session Cleanup Completeness

*For any* session that is explicitly closed or expires:
- The session SHALL NOT be retrievable via get_session()
- All associated resources SHALL be released

**Validates: Requirements 4.4, 6.3**

### Property 5: Error Response Format

*For any* error condition (connection failure, invalid audio, API error), the Voice_Service SHALL return a JSON message with:
- `type: "error"`
- `error: string` containing a descriptive message in Chinese

**Validates: Requirements 5.1, 5.2, 5.4**

### Property 6: Visual Feedback State Machine

*For any* VoiceWidget instance, the status SHALL transition through valid states only:
- `idle` → `connecting` (on button click)
- `connecting` → `connected` | `error` (on connection result)
- `connected` → `listening` | `speaking` | `idle` (on audio activity or disconnect)
- `error` → `idle` (on retry or dismiss)

**Validates: Requirements 3.3, 3.4, 3.6**

### Property 7: Connection Establishment

*For any* client WebSocket connection to `/ws/voice`, the Voice_Service SHALL establish a corresponding Gemini Live API connection before processing any audio data.

**Validates: Requirements 1.2**

### Property 8: Origin Validation

*For any* WebSocket connection attempt, the Voice_Service SHALL validate the Origin header against the allowed origins list, rejecting connections from unauthorized origins.

**Validates: Requirements 6.4**

## Error Handling

### Error Categories and Responses

| Error Type | Detection | Response | User Message |
|------------|-----------|----------|--------------|
| Gemini Connection Failed | WebSocket error | `{"type": "error", "error": "..."}` | "无法连接到语音服务，请稍后重试" |
| Invalid Audio Format | Format validation | `{"type": "error", "error": "..."}` | "音频格式不正确" |
| API Key Invalid | 401 from Gemini | `{"type": "error", "error": "..."}` | "服务配置错误，请联系管理员" |
| Session Expired | Timeout check | `{"type": "error", "error": "..."}` | "会话已过期，请重新连接" |
| Network Timeout | 5s timeout | `{"type": "error", "error": "..."}` | "网络延迟较高，请检查网络连接" |
| Microphone Permission Denied | getUserMedia error | UI error state | "请允许麦克风权限以使用语音功能" |

### Graceful Degradation

```
Voice Full → Voice (no context) → Error State
     ↓              ↓                 ↓
  Supabase      Gemini API        WebSocket
  failure       failure           failure
```

## Testing Strategy

### Dual Testing Approach

本项目采用单元测试和属性测试相结合的方式：

1. **单元测试**: 验证具体示例、边界情况和错误条件
2. **属性测试**: 验证跨所有输入的通用属性

### Property-Based Testing Configuration

- **测试框架**: Python - `hypothesis`; TypeScript - `fast-check`
- **最小迭代次数**: 每个属性测试 100 次
- **标签格式**: `Feature: gemini-live-voice, Property {number}: {property_text}`

### Test Categories

#### 1. Unit Tests (Python - pytest)

```python
# voice-service/tests/test_session_manager.py

def test_create_session_returns_valid_session():
    manager = SessionManager()
    session = manager.create_session()
    assert session.session_id is not None
    assert len(session.session_id) == 36  # UUID format

def test_expired_session_not_retrievable():
    manager = SessionManager(timeout_seconds=1)
    session = manager.create_session()
    import time
    time.sleep(2)
    assert manager.get_session(session.session_id) is None

def test_delete_session_removes_session():
    manager = SessionManager()
    session = manager.create_session()
    assert manager.delete_session(session.session_id) is True
    assert manager.get_session(session.session_id) is None
```

#### 2. Property Tests (Python - hypothesis)

```python
# voice-service/tests/test_properties.py

from hypothesis import given, strategies as st, settings

@given(st.lists(st.text(min_size=1), min_size=1, max_size=50))
@settings(max_examples=100)
def test_session_id_uniqueness(user_ids: list[str]):
    """
    Feature: gemini-live-voice, Property 2: Session ID Uniqueness
    """
    manager = SessionManager()
    sessions = [manager.create_session() for _ in user_ids]
    session_ids = [s.session_id for s in sessions]
    assert len(session_ids) == len(set(session_ids))

@given(st.binary(min_size=100, max_size=10000))
@settings(max_examples=100)
def test_audio_data_integrity(audio_data: bytes):
    """
    Feature: gemini-live-voice, Property 1: Audio Forwarding Integrity
    """
    # 模拟音频转发，验证数据完整性
    forwarded = forward_audio(audio_data)
    assert forwarded == audio_data
```

#### 3. Frontend Tests (TypeScript - vitest)

```typescript
// client/src/components/chat/VoiceWidget.test.tsx

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoiceWidget } from './VoiceWidget';

describe('VoiceWidget', () => {
  it('should render microphone button', () => {
    render(<VoiceWidget />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should show connecting state on click', async () => {
    render(<VoiceWidget />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    // 验证状态变化
  });
});
```

### Test Coverage Requirements

| Component | Unit Test Coverage | Property Test Coverage |
|-----------|-------------------|----------------------|
| SessionManager | ≥ 90% | Properties 2, 4 |
| ContextFetcher | ≥ 85% | Property 3 |
| WebSocket Handler | ≥ 80% | Properties 1, 7, 8 |
| VoiceWidget | ≥ 85% | Property 6 |
| Error Handling | ≥ 95% | Property 5 |

## Deployment

### Zeabur 部署配置

```json
// zeabur.json
{
  "build": {
    "type": "dockerfile"
  },
  "env": {
    "PORT": "8080",
    "HOST": "0.0.0.0"
  }
}
```

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### 环境变量

| 变量名 | 描述 | 示例值 |
|--------|------|--------|
| `PORT` | 服务端口 | `8080` |
| `GEMINI_API_KEY` | Gemini API 密钥 | `AIza...` |
| `SUPABASE_URL` | Supabase URL | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | Supabase Service Key | `eyJ...` |
| `LIGHTRAG_URL` | LightRAG 服务地址 | `http://lightrag-service-1.zeabur.internal:8080` |

## Security Considerations

1. **WSS 加密**: 生产环境使用 WSS (WebSocket Secure)
2. **Origin 验证**: 验证 WebSocket 连接的 Origin 头
3. **API Key 保护**: Gemini API Key 仅在后端使用，不暴露给前端
4. **音频数据**: 不持久化存储，仅在内存中处理
5. **会话超时**: 30 分钟无活动自动清理会话
