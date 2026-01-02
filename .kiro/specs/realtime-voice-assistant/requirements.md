# Requirements Document

## Introduction

本功能为 Blinko 应用集成一个类似豆包的超低延迟、可打断的实时语音助手。使用 LiveKit 作为实时通信基础设施，Google Gemini Multimodal Live API 作为智能模型，实现原生 Speech-to-Speech（无需中间 STT/TTS）的最快响应体验。

## Glossary

- **Voice_Assistant**: 实时语音助手组件，负责处理用户语音输入并返回语音响应
- **LiveKit_Agent**: 基于 livekit-agents 框架的 Python 后端服务，处理语音流和 AI 推理
- **LiveKit_Room**: LiveKit 实时通信房间，用于音频流传输
- **Multimodal_Agent**: 使用 Gemini Realtime API 的多模态代理，支持原生语音到语音处理
- **Barge_In**: 打断功能，允许用户在 AI 响应过程中随时打断并开始新的对话
- **Bar_Visualizer**: 音频波形可视化组件，类似 Siri/豆包的动态效果
- **Token_Endpoint**: 用于生成 LiveKit 房间访问令牌的 API 端点

## Requirements

### Requirement 1: LiveKit Agent 后端服务

**User Story:** As a developer, I want to deploy a Python-based LiveKit agent service, so that I can process real-time voice streams with Gemini AI.

#### Acceptance Criteria

1. THE LiveKit_Agent SHALL connect to LiveKit server using LIVEKIT_URL and LIVEKIT_API credentials
2. WHEN a user joins a LiveKit_Room, THE LiveKit_Agent SHALL automatically create a Multimodal_Agent instance
3. THE Multimodal_Agent SHALL use Google Gemini Multimodal Live API for native Speech-to-Speech processing
4. WHEN the user speaks, THE LiveKit_Agent SHALL stream audio directly to Gemini without intermediate STT
5. WHEN Gemini responds, THE LiveKit_Agent SHALL stream audio directly to the user without intermediate TTS
6. THE LiveKit_Agent SHALL support Barge_In functionality automatically through the livekit-plugins-google package

### Requirement 2: Token 生成端点

**User Story:** As a frontend application, I want to obtain LiveKit room tokens, so that I can securely connect to voice sessions.

#### Acceptance Criteria

1. THE Token_Endpoint SHALL accept user identity and room name as parameters
2. WHEN a valid request is received, THE Token_Endpoint SHALL generate a JWT token with appropriate permissions
3. THE Token_Endpoint SHALL return the token along with the LiveKit server URL
4. IF invalid credentials are provided, THEN THE Token_Endpoint SHALL return an appropriate error response

### Requirement 3: Voice Assistant React 组件

**User Story:** As a user, I want to interact with a voice assistant through a visual interface, so that I can have natural voice conversations with AI.

#### Acceptance Criteria

1. THE Voice_Assistant component SHALL connect to LiveKit_Room using the token from Token_Endpoint
2. WHEN connected, THE Voice_Assistant SHALL display a Bar_Visualizer showing audio activity
3. THE Voice_Assistant SHALL provide microphone controls through VoiceAssistantControlBar
4. WHEN the user speaks, THE Voice_Assistant SHALL transmit audio to the LiveKit_Room in real-time
5. WHEN AI responds, THE Voice_Assistant SHALL play the audio response and update the Bar_Visualizer
6. THE Voice_Assistant SHALL handle connection states (connecting, connected, disconnected, error)

### Requirement 4: 打断功能 (Barge-In)

**User Story:** As a user, I want to interrupt the AI while it's speaking, so that I can have natural, fluid conversations.

#### Acceptance Criteria

1. WHILE the Multimodal_Agent is generating audio response, THE Voice_Assistant SHALL continue listening for user input
2. WHEN the user starts speaking during AI response, THE Multimodal_Agent SHALL immediately stop the current response
3. WHEN Barge_In occurs, THE Multimodal_Agent SHALL process the new user input without delay
4. THE Barge_In functionality SHALL be handled automatically by the livekit-plugins-google package

### Requirement 5: 音频可视化

**User Story:** As a user, I want to see visual feedback of audio activity, so that I know when the system is listening or speaking.

#### Acceptance Criteria

1. THE Bar_Visualizer SHALL display dynamic waveform animation during audio activity
2. WHEN the user is speaking, THE Bar_Visualizer SHALL show input audio levels
3. WHEN the AI is responding, THE Bar_Visualizer SHALL show output audio levels
4. WHEN idle, THE Bar_Visualizer SHALL display a subtle idle animation

### Requirement 6: 错误处理与状态管理

**User Story:** As a user, I want clear feedback about connection status and errors, so that I understand the system state.

#### Acceptance Criteria

1. WHEN connection fails, THE Voice_Assistant SHALL display an error message with retry option
2. WHEN microphone permission is denied, THE Voice_Assistant SHALL prompt user to grant permission
3. THE Voice_Assistant SHALL display current connection state (connecting, connected, disconnected)
4. IF the LiveKit_Agent is unavailable, THEN THE Voice_Assistant SHALL show appropriate fallback UI

### Requirement 7: 环境配置

**User Story:** As a developer, I want clear environment variable configuration, so that I can deploy the system correctly.

#### Acceptance Criteria

1. THE system SHALL require LIVEKIT_URL for LiveKit server connection
2. THE system SHALL require LIVEKIT_API_KEY and LIVEKIT_API_SECRET for authentication
3. THE system SHALL require GOOGLE_API_KEY for Gemini API access
4. THE system SHALL validate all required environment variables on startup
5. IF any required environment variable is missing, THEN THE system SHALL log a clear error message
