# Implementation Plan: FastRTC Voice Chat Integration

## Overview

本实现计划将 FastRTC 语音聊天功能分解为可执行的编码任务。采用渐进式开发，先搭建后端服务，再实现前端组件，最后进行集成测试。

## Tasks

- [x] 1. 搭建 Voice Service 项目结构
  - 创建 `voice-service/` 目录结构
  - 配置 Python 依赖 (FastRTC, httpx, pydantic)
  - 创建 Dockerfile 和 docker-compose.yml
  - 设置环境变量配置
  - _Requirements: 1.1, 1.4, 1.5_

- [x] 2. 实现 Session Manager
  - [x] 2.1 创建 Session 数据类和 SessionManager 类
    - 实现 Session dataclass with conversation_history
    - 实现 create_session, get_session, delete_session 方法
    - 实现 is_expired 和 cleanup_expired_sessions 方法
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.2 编写 Session ID 唯一性属性测试
    - **Property 8: Session ID Uniqueness**
    - **Validates: Requirements 4.2**

  - [x] 2.3 编写对话历史持久性属性测试
    - **Property 7: Conversation History Persistence**
    - **Validates: Requirements 2.5**

  - [x] 2.4 编写会话清理完整性属性测试
    - **Property 9: Session Cleanup Completeness**
    - **Validates: Requirements 4.4, 6.4**

- [x] 3. Checkpoint - 确保 Session Manager 测试通过
  - 运行所有测试，确保通过
  - 如有问题，询问用户

- [x] 4. 实现 Context Fetcher
  - [x] 4.1 创建 ContextFetcher 类
    - 实现 fetch_portfolio_summary 方法 (从 Supabase)
    - 实现 fetch_positions 方法
    - 实现 query_knowledge 方法 (调用 LightRAG)
    - 实现 build_full_context 方法
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.2 编写上下文检索完整性属性测试
    - **Property 4: Context Retrieval Completeness**
    - **Validates: Requirements 2.1**

  - [x] 4.3 编写提示词上下文包含属性测试
    - **Property 5: Prompt Context Inclusion**
    - **Validates: Requirements 2.2, 2.3**

  - [x] 4.4 编写知识库查询触发属性测试
    - **Property 6: Knowledge Base Query Triggering**
    - **Validates: Requirements 2.4**

- [x] 5. Checkpoint - 确保 Context Fetcher 测试通过
  - 运行所有测试，确保通过
  - 如有问题，询问用户

- [x] 6. 实现 Voice Handler 核心逻辑
  - [x] 6.1 创建 voice_chat_handler 函数
    - 集成 STT 模型 (get_stt_model)
    - 集成 TTS 模型 (get_tts_model)
    - 实现 Gemini API 调用
    - 实现 build_system_prompt 函数
    - _Requirements: 1.2, 1.3, 1.6_

  - [x] 6.2 编写 TTS 输出完整性属性测试
    - **Property 2: TTS Output Completeness**
    - **Validates: Requirements 1.3**

  - [x] 6.3 编写 Gemini 集成往返属性测试
    - **Property 3: Gemini Integration Round-Trip**
    - **Validates: Requirements 1.6**

- [x] 7. 实现 FastAPI 应用和 WebRTC 端点
  - [x] 7.1 创建 FastAPI 应用
    - 配置 CORS 中间件
    - 创建 /health 端点
    - 挂载 FastRTC Stream
    - 实现认证中间件
    - _Requirements: 1.1, 6.1, 6.3_

  - [x] 7.2 编写认证强制属性测试
    - **Property 11: Authentication Enforcement**
    - **Validates: Requirements 6.3**

- [x] 8. 实现错误处理和降级逻辑
  - [x] 8.1 创建 VoiceError 类和错误处理器
    - 实现 STT 失败处理
    - 实现 TTS 失败处理
    - 实现 Gemini 超时/限流处理
    - 实现 LightRAG 不可用处理
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [x] 8.2 编写音频数据非持久化属性测试
    - **Property 10: Audio Data Non-Persistence**
    - **Validates: Requirements 6.2**

- [x] 9. Checkpoint - 确保后端服务测试通过
  - 运行所有后端测试
  - 验证 Docker 构建成功
  - 如有问题，询问用户

- [x] 10. 实现前端 VoiceWidget 组件
  - [x] 10.1 创建 VoiceWidget React 组件
    - 实现麦克风按钮 UI
    - 实现状态管理 (idle, connecting, listening, speaking, error)
    - 实现音频电平可视化
    - 实现静音/取消静音切换
    - _Requirements: 3.1, 3.3, 3.4, 3.5_

  - [x] 10.2 实现 WebRTC 连接管理
    - 创建 VoiceConnection 类
    - 实现 connect/disconnect 方法
    - 实现 ICE candidate 处理
    - 实现重连逻辑
    - _Requirements: 3.2, 3.6_

  - [x] 10.3 编写 VoiceWidget 单元测试
    - 测试按钮渲染
    - 测试状态转换
    - 测试错误显示
    - _Requirements: 3.1, 3.6_

- [x] 11. 集成 VoiceWidget 到 ChatWindow
  - [x] 11.1 修改 ChatWindow 组件
    - 添加 VoiceWidget 到聊天界面
    - 实现语音/文字模式切换
    - 实现降级逻辑 (语音不可用时切换到文字)
    - _Requirements: 5.4_

- [x] 12. Checkpoint - 确保前端组件测试通过
  - 运行前端测试
  - 如有问题，询问用户

- [x] 13. 端到端集成测试
  - [x] 13.1 编写集成测试
    - 测试完整语音对话流程
    - 测试错误恢复场景
    - 测试会话管理
    - _Requirements: 1.1, 2.1, 4.1_

- [x] 14. 部署配置
  - [x] 14.1 更新部署配置
    - 更新 docker-compose.yml 添加 voice-service
    - 配置 Zeabur/Railway 部署
    - 添加环境变量文档
    - _Requirements: 6.1_

- [x] 15. Final Checkpoint - 确保所有测试通过
  - 运行完整测试套件
  - 验证部署配置
  - 如有问题，询问用户

## Notes

- 所有任务都是必须完成的，包括属性测试
- 每个属性测试引用设计文档中的具体属性编号
- Checkpoint 任务用于增量验证
- 属性测试使用 hypothesis (Python) 和 fast-check (TypeScript)
