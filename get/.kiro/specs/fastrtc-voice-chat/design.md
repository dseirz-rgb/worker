# Design Document: FastRTC Voice Chat Integration

## Overview

本设计文档描述了如何将 FastRTC 实时语音通信库集成到现有的投资风控系统中，使用户能够通过语音与 AI 助手进行自然对话。

系统采用独立的 Python 微服务架构，通过 WebRTC 协议与前端通信，复用现有的 Gemini AI 后端和知识库服务。

### 核心设计决策

1. **独立微服务**: FastRTC 服务作为独立的 Python 服务部署，与现有的 LightRAG 服务并行运行
2. **复用现有基础设施**: 使用现有的 Gemini API 作为 LLM 后端，复用 Context Builder 逻辑
3. **WebRTC 优先**: 使用 WebRTC 协议实现低延迟音频传输，WebSocket 作为备选
4. **渐进式集成**: 前端通过可选的语音按钮集成，不影响现有文字聊天功能

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │   ChatWindow    │  │  VoiceWidget    │  │   WebRTC Client     │  │
│  │   (existing)    │  │   (new)         │  │   (new)             │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │
│           │                    │                       │             │
└───────────┼────────────────────┼───────────────────────┼─────────────┘
            │                    │                       │
            │ HTTP/SSE           │ WebRTC/WebSocket      │
            ▼                    ▼                       ▼
┌───────────────────┐  ┌─────────────────────────────────────────────┐
│   Vercel API      │  │         FastRTC Voice Service               │
│   /api/chat       │  │  ┌─────────────┐  ┌─────────────────────┐   │
│   (existing)      │  │  │   Stream    │  │  Session Manager    │   │
└───────────────────┘  │  │   Handler   │  │                     │   │
                       │  └──────┬──────┘  └──────────┬──────────┘   │
                       │         │                    │               │
                       │  ┌──────▼──────┐  ┌─────────▼───────────┐   │
                       │  │  STT Model  │  │  Context Fetcher    │   │
                       │  │  (Moonshine)│  │  (HTTP to Vercel)   │   │
                       │  └─────────────┘  └─────────────────────┘   │
                       │                                              │
                       │  ┌─────────────┐  ┌─────────────────────┐   │
                       │  │  TTS Model  │  │  Gemini LLM Client  │   │
                       │  │  (Kokoro)   │  │                     │   │
                       │  └─────────────┘  └─────────────────────┘   │
                       └─────────────────────────────────────────────┘
                                              │
                                              ▼
                       ┌─────────────────────────────────────────────┐
                       │              External Services              │
                       │  ┌─────────────┐  ┌─────────────────────┐   │
                       │  │ Gemini API  │  │   LightRAG Service  │   │
                       │  └─────────────┘  └─────────────────────┘   │
                       │  ┌─────────────┐  ┌─────────────────────┐   │
                       │  │  Supabase   │  │   Vercel API        │   │
                       │  └─────────────┘  └─────────────────────┘   │
                       └─────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. FastRTC Voice Service (Python)

独立的 Python 微服务，基于 FastRTC 库构建。

```python
# voice-service/main.py

from fastapi import FastAPI
from fastrtc import Stream, ReplyOnPause, get_stt_model, get_tts_model
import httpx
import os

app = FastAPI()

# 模型初始化
stt_model = get_stt_model()  # Moonshine Base
tts_model = get_tts_model()  # Kokoro

# Gemini 客户端
gemini_api_key = os.getenv("GEMINI_API_KEY")
gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# 会话存储
sessions: dict[str, SessionState] = {}

class SessionState:
    """会话状态管理"""
    session_id: str
    conversation_history: list[dict]
    portfolio_context: str | None
    created_at: float
    last_activity: float

async def fetch_portfolio_context(session_id: str) -> str:
    """从 Vercel API 获取投资组合上下文"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{os.getenv('VERCEL_API_URL')}/api/portfolio-context",
            headers={"Authorization": f"Bearer {session_id}"}
        )
        return response.json().get("context", "")

async def query_knowledge_base(query: str) -> str:
    """查询 LightRAG 知识库"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{os.getenv('LIGHTRAG_URL')}/query",
            json={"query": query, "mode": "hybrid"}
        )
        return response.json().get("result", "")

def voice_chat_handler(audio: tuple[int, np.ndarray], session_id: str):
    """
    语音聊天处理器
    
    流程:
    1. STT: 语音转文字
    2. 获取上下文 (投资组合 + 知识库)
    3. LLM: 生成响应
    4. TTS: 文字转语音
    """
    # 1. 语音转文字
    user_text = stt_model.stt(audio)
    
    # 2. 获取会话状态
    session = sessions.get(session_id)
    if not session:
        session = SessionState(session_id=session_id, ...)
        sessions[session_id] = session
    
    # 3. 构建提示词
    system_prompt = build_system_prompt(
        portfolio_context=session.portfolio_context,
        conversation_history=session.conversation_history
    )
    
    # 4. 调用 Gemini
    response_text = call_gemini(system_prompt, user_text)
    
    # 5. 更新会话历史
    session.conversation_history.append({"role": "user", "content": user_text})
    session.conversation_history.append({"role": "assistant", "content": response_text})
    
    # 6. TTS 流式输出
    for audio_chunk in tts_model.stream_tts_sync(response_text):
        yield audio_chunk

# 创建 FastRTC Stream
stream = Stream(
    ReplyOnPause(voice_chat_handler),
    modality="audio",
    mode="send-receive"
)

# 挂载到 FastAPI
stream.mount(app)
```

### 2. Voice Widget (React Component)

前端语音交互组件，集成到现有的 ChatWindow 中。

```typescript
// client/src/components/chat/VoiceWidget.tsx

interface VoiceWidgetProps {
  onTranscript?: (text: string) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

interface VoiceWidgetState {
  status: 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';
  isMuted: boolean;
  audioLevel: number;
  errorMessage?: string;
}

// WebRTC 连接管理
class VoiceConnection {
  private pc: RTCPeerConnection | null = null;
  private audioStream: MediaStream | null = null;
  
  async connect(serverUrl: string): Promise<void>;
  async disconnect(): Promise<void>;
  setMuted(muted: boolean): void;
  getAudioLevel(): number;
}
```

### 3. Session Manager

会话管理器，处理多用户并发和会话生命周期。

```python
# voice-service/session_manager.py

from dataclasses import dataclass, field
from datetime import datetime
import asyncio
import uuid

@dataclass
class Session:
    session_id: str
    user_id: str | None
    conversation_history: list[dict] = field(default_factory=list)
    portfolio_context: str | None = None
    knowledge_context: str | None = None
    created_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)
    
    def is_expired(self, timeout_seconds: int = 1800) -> bool:
        """检查会话是否过期 (默认30分钟)"""
        return (datetime.now() - self.last_activity).seconds > timeout_seconds
    
    def update_activity(self):
        """更新最后活动时间"""
        self.last_activity = datetime.now()
    
    def add_message(self, role: str, content: str):
        """添加消息到历史"""
        self.conversation_history.append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat()
        })
        self.update_activity()

class SessionManager:
    def __init__(self):
        self._sessions: dict[str, Session] = {}
        self._cleanup_task: asyncio.Task | None = None
    
    def create_session(self, user_id: str | None = None) -> Session:
        """创建新会话"""
        session_id = str(uuid.uuid4())
        session = Session(session_id=session_id, user_id=user_id)
        self._sessions[session_id] = session
        return session
    
    def get_session(self, session_id: str) -> Session | None:
        """获取会话"""
        session = self._sessions.get(session_id)
        if session and not session.is_expired():
            return session
        return None
    
    def delete_session(self, session_id: str):
        """删除会话"""
        if session_id in self._sessions:
            del self._sessions[session_id]
    
    async def cleanup_expired_sessions(self):
        """清理过期会话"""
        expired = [
            sid for sid, session in self._sessions.items()
            if session.is_expired()
        ]
        for sid in expired:
            del self._sessions[sid]
```

### 4. Context Fetcher

上下文获取器，从现有服务获取投资数据和知识库内容。

```python
# voice-service/context_fetcher.py

import httpx
from typing import Optional

class ContextFetcher:
    def __init__(
        self,
        vercel_api_url: str,
        lightrag_url: str,
        supabase_url: str,
        supabase_key: str
    ):
        self.vercel_api_url = vercel_api_url
        self.lightrag_url = lightrag_url
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
    
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
    
    async def fetch_positions(self) -> list[dict]:
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
    
    async def query_knowledge(self, query: str) -> str:
        """查询知识库"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.lightrag_url}/query",
                json={"query": query, "mode": "hybrid"},
                timeout=30.0
            )
            result = response.json()
            return result.get("result", "")
    
    async def build_full_context(self, user_query: str) -> str:
        """构建完整上下文"""
        # 并行获取数据
        portfolio, positions, knowledge = await asyncio.gather(
            self.fetch_portfolio_summary(),
            self.fetch_positions(),
            self.query_knowledge(user_query)
        )
        
        # 格式化上下文
        context_parts = []
        
        if portfolio:
            context_parts.append(f"""
## 投资组合概览
- 总净值: ¥{portfolio.get('total_net_worth_cny', 0):,.0f}
- 持仓数量: {portfolio.get('total_positions', 0)}
- 现金比例: {portfolio.get('cash_ratio_percent', 0):.1f}%
- 年初至今收益: {portfolio.get('ytd_return_percent', 0):.2f}%
""")
        
        if positions:
            top_positions = sorted(
                positions, 
                key=lambda x: x.get('market_value_cny', 0), 
                reverse=True
            )[:10]
            positions_text = "\n".join([
                f"- {p['ticker']}: {p.get('weight_percent', 0):.1f}% (盈亏: {p.get('unrealized_pnl_percent', 0):.1f}%)"
                for p in top_positions
            ])
            context_parts.append(f"""
## 主要持仓 (Top 10)
{positions_text}
""")
        
        if knowledge:
            context_parts.append(f"""
## 相关知识
{knowledge}
""")
        
        return "\n".join(context_parts)
```

## Data Models

### Session Data Model

```typescript
// 会话数据模型
interface VoiceSession {
  sessionId: string;
  userId?: string;
  conversationHistory: ConversationMessage[];
  portfolioContext?: string;
  knowledgeContext?: string;
  createdAt: string;  // ISO 8601
  lastActivity: string;  // ISO 8601
  status: 'active' | 'expired' | 'closed';
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;  // ISO 8601
  audioUrl?: string;  // 可选的音频 URL (用于回放)
}
```

### WebRTC Signaling Messages

```typescript
// WebRTC 信令消息
interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'session-init' | 'session-end';
  sessionId?: string;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit | SessionInitPayload;
}

interface SessionInitPayload {
  sessionId: string;
  userId?: string;
  capabilities: {
    audio: boolean;
    video: boolean;
  };
}
```

### Voice Service Configuration

```python
# voice-service/config.py

from pydantic_settings import BaseSettings

class VoiceServiceConfig(BaseSettings):
    # Server
    host: str = "0.0.0.0"
    port: int = 8001
    
    # Models
    stt_model: str = "moonshine-base"
    tts_model: str = "kokoro"
    
    # External Services
    gemini_api_key: str
    gemini_model: str = "gemini-2.0-flash"
    lightrag_url: str = "http://localhost:8000"
    supabase_url: str
    supabase_key: str
    vercel_api_url: str
    
    # Session
    session_timeout_seconds: int = 1800  # 30 minutes
    max_conversation_history: int = 20
    
    # Audio
    sample_rate: int = 16000
    chunk_size: int = 1024
    
    class Config:
        env_file = ".env"
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: STT Conversion Timing

*For any* valid audio input of duration N seconds, the STT model SHALL complete conversion within max(500ms, N * 0.5) milliseconds, ensuring real-time responsiveness.

**Validates: Requirements 1.2**

### Property 2: TTS Output Completeness

*For any* non-empty text input to the TTS model, the output SHALL be a valid audio stream with sample rate 16000Hz and non-zero duration proportional to text length.

**Validates: Requirements 1.3**

### Property 3: Gemini Integration Round-Trip

*For any* user query text, calling the Gemini LLM SHALL return a non-empty response string within 30 seconds, and the response SHALL be contextually relevant (contains at least one keyword from the query or context).

**Validates: Requirements 1.6**

### Property 4: Context Retrieval Completeness

*For any* voice query processing, the context fetcher SHALL retrieve portfolio data from Supabase, and the retrieved data SHALL contain at minimum: total_net_worth, positions count, and cash_ratio fields.

**Validates: Requirements 2.1**

### Property 5: Prompt Context Inclusion

*For any* AI prompt generated by the voice service, the prompt string SHALL contain:
- Portfolio summary section with net worth and position count
- Risk metrics section with leverage ratio (if applicable)
- Conversation history from the current session

**Validates: Requirements 2.2, 2.3**

### Property 6: Knowledge Base Query Triggering

*For any* user query containing stock ticker symbols (e.g., AAPL, TSLA, 腾讯) or investment keywords (e.g., "持仓", "风险", "收益"), the service SHALL query the LightRAG knowledge base and include results in the context.

**Validates: Requirements 2.4**

### Property 7: Conversation History Persistence

*For any* session with N messages added, querying the session's conversation history SHALL return exactly N messages in chronological order, with each message containing role, content, and timestamp fields.

**Validates: Requirements 2.5**

### Property 8: Session ID Uniqueness

*For any* set of N sessions created by the SessionManager, all N session IDs SHALL be unique (no duplicates), and each ID SHALL be a valid UUID v4 format.

**Validates: Requirements 4.2**

### Property 9: Session Cleanup Completeness

*For any* session that is explicitly closed or expires, after cleanup:
- The session SHALL NOT be retrievable via get_session()
- All associated audio buffers SHALL be deallocated
- Memory usage SHALL not increase monotonically with session count

**Validates: Requirements 4.4, 6.4**

### Property 10: Audio Data Non-Persistence

*For any* completed voice interaction, after the response is sent:
- No raw audio files SHALL exist in the working directory
- No audio data SHALL be stored in the session object
- Only text transcripts MAY be retained in conversation history

**Validates: Requirements 6.2**

### Property 11: Authentication Enforcement

*For any* WebRTC connection attempt without valid authentication token, the service SHALL reject the connection with a 401 status code and NOT establish an audio stream.

**Validates: Requirements 6.3**

## Error Handling

### Error Categories and Responses

| Error Type | Detection | Response | Fallback |
|------------|-----------|----------|----------|
| STT Failure | Exception from stt_model.stt() | Return error message | Suggest text input |
| TTS Failure | Exception from tts_model.stream_tts_sync() | Return text response | Display text in UI |
| Gemini Timeout | httpx.TimeoutException after 30s | "AI 响应超时，请重试" | Retry with shorter context |
| Gemini Rate Limit | 429 status code | "请求过于频繁，请稍后再试" | Exponential backoff |
| LightRAG Unavailable | Connection refused | Skip knowledge context | Use portfolio context only |
| Supabase Error | HTTP 4xx/5xx | Log error, continue | Use cached context |
| WebRTC Connection Lost | ICE connection state = 'failed' | Attempt reconnection | Fall back to WebSocket |
| Session Expired | session.is_expired() returns True | Create new session | Preserve last context |

### Error Response Format

```python
@dataclass
class VoiceError:
    code: str  # e.g., "STT_FAILURE", "GEMINI_TIMEOUT"
    message: str  # User-friendly message
    recoverable: bool  # Can the user retry?
    fallback_action: str | None  # e.g., "text_input", "retry"
    
    def to_audio_response(self) -> bytes:
        """Convert error to TTS audio for voice feedback"""
        return tts_model.tts_sync(self.message)
    
    def to_json(self) -> dict:
        return {
            "error": True,
            "code": self.code,
            "message": self.message,
            "recoverable": self.recoverable,
            "fallback": self.fallback_action
        }
```

### Graceful Degradation Strategy

```
Voice Full → Voice (no knowledge) → Voice (no context) → Text Chat
     ↓              ↓                      ↓                 ↓
  LightRAG      Supabase              Gemini            WebRTC
  failure       failure               failure           failure
```

## Testing Strategy

### Dual Testing Approach

本项目采用单元测试和属性测试相结合的方式，确保代码正确性：

1. **单元测试**: 验证具体示例、边界情况和错误条件
2. **属性测试**: 验证跨所有输入的通用属性

### Property-Based Testing Configuration

- **测试框架**: Python - `hypothesis`; TypeScript - `fast-check`
- **最小迭代次数**: 每个属性测试 100 次
- **标签格式**: `Feature: fastrtc-voice-chat, Property {number}: {property_text}`

### Test Categories

#### 1. Unit Tests (Python - pytest)

```python
# voice-service/tests/test_session_manager.py

def test_create_session_returns_valid_session():
    """Test that create_session returns a session with valid ID"""
    manager = SessionManager()
    session = manager.create_session()
    assert session.session_id is not None
    assert len(session.session_id) == 36  # UUID format

def test_expired_session_not_retrievable():
    """Test that expired sessions return None"""
    manager = SessionManager()
    session = manager.create_session()
    session.last_activity = datetime.now() - timedelta(hours=1)
    assert manager.get_session(session.session_id) is None

def test_conversation_history_order():
    """Test that messages are stored in chronological order"""
    session = Session(session_id="test")
    session.add_message("user", "Hello")
    session.add_message("assistant", "Hi there")
    assert session.conversation_history[0]["role"] == "user"
    assert session.conversation_history[1]["role"] == "assistant"
```

#### 2. Property Tests (Python - hypothesis)

```python
# voice-service/tests/test_properties.py

from hypothesis import given, strategies as st, settings

@given(st.lists(st.text(min_size=1), min_size=1, max_size=50))
@settings(max_examples=100)
def test_session_id_uniqueness(user_ids: list[str]):
    """
    Feature: fastrtc-voice-chat, Property 8: Session ID Uniqueness
    For any set of N sessions, all IDs should be unique
    """
    manager = SessionManager()
    sessions = [manager.create_session(uid) for uid in user_ids]
    session_ids = [s.session_id for s in sessions]
    assert len(session_ids) == len(set(session_ids))

@given(st.lists(st.tuples(st.sampled_from(["user", "assistant"]), st.text(min_size=1)), min_size=1, max_size=20))
@settings(max_examples=100)
def test_conversation_history_persistence(messages: list[tuple[str, str]]):
    """
    Feature: fastrtc-voice-chat, Property 7: Conversation History Persistence
    For any N messages added, history should contain exactly N messages
    """
    session = Session(session_id="test")
    for role, content in messages:
        session.add_message(role, content)
    
    assert len(session.conversation_history) == len(messages)
    for i, (role, content) in enumerate(messages):
        assert session.conversation_history[i]["role"] == role
        assert session.conversation_history[i]["content"] == content

@given(st.text(min_size=10, max_size=500))
@settings(max_examples=100)
def test_prompt_context_inclusion(user_query: str):
    """
    Feature: fastrtc-voice-chat, Property 5: Prompt Context Inclusion
    For any AI prompt, it should contain portfolio and risk sections
    """
    # Mock portfolio data
    portfolio = {"total_net_worth_cny": 1000000, "total_positions": 10}
    prompt = build_system_prompt(portfolio, [], user_query)
    
    assert "净值" in prompt or "net_worth" in prompt.lower()
    assert "持仓" in prompt or "position" in prompt.lower()
```

#### 3. Frontend Tests (TypeScript - vitest + fast-check)

```typescript
// client/src/components/chat/VoiceWidget.test.tsx

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import { VoiceWidget } from './VoiceWidget';

describe('VoiceWidget', () => {
  it('should render microphone button', () => {
    render(<VoiceWidget />);
    expect(screen.getByRole('button', { name: /microphone/i })).toBeInTheDocument();
  });

  it('should show error state on connection failure', async () => {
    render(<VoiceWidget />);
    // Simulate connection failure
    // Assert error message is displayed
  });
});

// Property test for audio level normalization
describe('Audio Level Properties', () => {
  it('should normalize audio level to 0-1 range', () => {
    fc.assert(
      fc.property(fc.float({ min: -100, max: 100 }), (rawLevel) => {
        const normalized = normalizeAudioLevel(rawLevel);
        return normalized >= 0 && normalized <= 1;
      }),
      { numRuns: 100 }
    );
  });
});
```

### Integration Tests

```python
# voice-service/tests/test_integration.py

import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_health_endpoint():
    """Test that health endpoint returns service status"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "stt_model_loaded" in data
        assert "tts_model_loaded" in data

@pytest.mark.asyncio
async def test_context_fetcher_integration():
    """Test that context fetcher retrieves data from Supabase"""
    fetcher = ContextFetcher(...)
    context = await fetcher.build_full_context("我的持仓情况如何？")
    assert "投资组合" in context or "portfolio" in context.lower()
```

### Test Coverage Requirements

| Component | Unit Test Coverage | Property Test Coverage |
|-----------|-------------------|----------------------|
| SessionManager | ≥ 90% | Properties 7, 8, 9 |
| ContextFetcher | ≥ 85% | Properties 4, 5, 6 |
| VoiceHandler | ≥ 80% | Properties 1, 2, 3 |
| VoiceWidget | ≥ 85% | UI state properties |
| Error Handling | ≥ 95% | Edge cases |

## Deployment Architecture

```yaml
# docker-compose.yml for voice service

version: '3.8'

services:
  voice-service:
    build:
      context: ./voice-service
      dockerfile: Dockerfile
    ports:
      - "8001:8001"
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - LIGHTRAG_URL=http://lightrag:8000
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_KEY=${SUPABASE_KEY}
    depends_on:
      - lightrag
    volumes:
      - voice-models:/app/models
    deploy:
      resources:
        limits:
          memory: 4G  # STT/TTS models need memory

  lightrag:
    build:
      context: ./lightrag-service
    ports:
      - "8000:8000"
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}

volumes:
  voice-models:
```

## Security Considerations

1. **WebRTC 加密**: 所有 WebRTC 连接使用 DTLS-SRTP 加密
2. **认证**: 使用 JWT token 验证用户身份
3. **音频数据**: 不持久化存储，仅在内存中处理
4. **API 密钥**: 通过环境变量注入，不硬编码
5. **CORS**: 生产环境限制允许的源
