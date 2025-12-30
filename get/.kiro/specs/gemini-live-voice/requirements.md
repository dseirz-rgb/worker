# Requirements Document

## Introduction

本功能旨在使用 Gemini Live API 为投资风控系统集成实时语音交互能力。Gemini Live API 是 Google 提供的原生音频对话 API，支持低延迟的双向语音通信，内置语音活动检测（VAD）、语音转文字（STT）和文字转语音（TTS）功能，无需额外部署模型。

相比之前的 FastRTC 方案，Gemini Live API 更加简洁：
- 无需部署独立的 STT/TTS 模型
- 使用 WebSocket 而非 WebRTC，降低复杂度
- 原生支持语音活动检测和打断功能
- 直接使用现有的 Gemini API Key

## Glossary

- **Gemini_Live_API**: Google 提供的实时音频对话 API，支持双向语音流
- **Voice_Service**: 语音聊天后端服务，作为 WebSocket 代理连接前端和 Gemini Live API
- **Voice_Widget**: 前端语音交互组件，提供录音和播放界面
- **WebSocket_Proxy**: 后端代理服务，转发前端音频到 Gemini Live API
- **Session_Manager**: 会话管理器，维护用户会话状态和对话历史
- **Context_Fetcher**: 上下文获取器，从 Supabase 和 LightRAG 获取投资数据

## Requirements

### Requirement 1: 语音聊天后端服务

**User Story:** 作为投资者，我希望有一个语音聊天后端服务，以便我可以通过语音与 AI 进行实时对话。

#### Acceptance Criteria

1. THE Voice_Service SHALL provide a WebSocket endpoint at `/ws/voice` for real-time audio streaming
2. WHEN a client connects, THE Voice_Service SHALL establish a connection to Gemini Live API
3. WHEN audio input is received from client, THE Voice_Service SHALL forward it to Gemini Live API in PCM format (16kHz, 16-bit, mono)
4. WHEN audio response is received from Gemini, THE Voice_Service SHALL forward it to the client (24kHz, 16-bit, mono)
5. THE Voice_Service SHALL use Gemini's built-in voice activity detection for automatic turn-taking
6. WHEN the service starts, THE Voice_Service SHALL validate Gemini API key availability

### Requirement 2: 投资上下文集成

**User Story:** 作为投资者，我希望语音 AI 能够访问我的投资数据，以便获得个性化的投资建议。

#### Acceptance Criteria

1. WHEN a voice session starts, THE Voice_Service SHALL fetch portfolio context from Supabase
2. THE Voice_Service SHALL include current portfolio positions in the system instruction
3. THE Voice_Service SHALL include risk metrics and leverage data in the system instruction
4. WHEN the user asks about specific topics, THE Voice_Service SHALL query LightRAG knowledge base
5. THE Voice_Service SHALL maintain conversation context within the Gemini Live session

### Requirement 3: 前端语音交互组件

**User Story:** 作为投资者，我希望在界面上有一个简洁的语音交互按钮，以便我可以轻松开始语音对话。

#### Acceptance Criteria

1. THE Voice_Widget SHALL display a microphone button in the chat interface
2. WHEN the user clicks the microphone button, THE Voice_Widget SHALL request microphone permission and establish WebSocket connection
3. WHILE recording, THE Voice_Widget SHALL display a visual indicator showing connection status
4. WHEN AI is responding, THE Voice_Widget SHALL display a speaking indicator
5. THE Voice_Widget SHALL provide a disconnect button to end the voice session
6. IF WebSocket connection fails, THEN THE Voice_Widget SHALL display an error message and offer retry option
7. THE Voice_Widget SHALL work on both desktop and mobile browsers

### Requirement 4: 会话管理

**User Story:** 作为投资者，我希望语音对话能够保持上下文，以便进行连贯的多轮对话。

#### Acceptance Criteria

1. THE Voice_Service SHALL maintain session state for each connected client
2. WHEN a new session starts, THE Voice_Service SHALL generate a unique session ID
3. THE Voice_Service SHALL leverage Gemini Live API's built-in conversation history
4. WHEN the session ends, THE Voice_Service SHALL clean up session resources
5. IF the WebSocket connection is interrupted, THEN THE Voice_Service SHALL attempt to restore the session using Gemini's session resumption feature

### Requirement 5: 错误处理与降级

**User Story:** 作为投资者，我希望在语音功能出现问题时能够得到清晰的反馈，以便我知道如何处理。

#### Acceptance Criteria

1. IF Gemini Live API connection fails, THEN THE Voice_Service SHALL return an error message to the client
2. IF audio format is invalid, THEN THE Voice_Service SHALL return a descriptive error
3. IF the Gemini API key is invalid, THEN THE Voice_Service SHALL return a 401 error
4. THE Voice_Widget SHALL display user-friendly error messages in Chinese
5. WHEN network latency exceeds 5 seconds, THE Voice_Service SHALL notify the user of potential delays

### Requirement 6: 安全与隐私

**User Story:** 作为投资者，我希望我的语音数据得到保护，以便我的投资信息不被泄露。

#### Acceptance Criteria

1. THE Voice_Service SHALL use secure WebSocket connections (WSS)
2. THE Voice_Service SHALL NOT store raw audio data after processing
3. WHEN the session ends, THE Voice_Service SHALL delete all temporary audio buffers
4. THE Voice_Service SHALL validate origin headers to prevent unauthorized access
