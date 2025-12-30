# Implementation Plan: Gemini Live Voice Chat

## Overview

本实现计划将 Gemini Live API 集成到投资风控系统中，提供实时语音对话功能。采用 WebSocket 代理架构，后端转发前端音频到 Gemini Live API。

## Tasks

- [x] 1. 设置项目结构和依赖
  - [x] 1.1 更新 voice-service 依赖
    - 添加 `google-genai` SDK 到 requirements.txt
    - 移除 FastRTC 相关依赖
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 更新配置文件
    - 更新 config.py 使用 Gemini Live API 配置
    - 更新 .env.example 文件
    - _Requirements: 1.6_

- [x] 2. 实现后端 WebSocket 代理服务
  - [x] 2.1 重构 main.py 为 WebSocket 代理
    - 实现 `/ws/voice` WebSocket 端点
    - 实现 Gemini Live API 连接逻辑
    - 实现音频转发逻辑
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 2.2 编写 WebSocket 处理器属性测试
    - **Property 1: Audio Forwarding Integrity**
    - **Property 7: Connection Establishment**
    - **Validates: Requirements 1.2, 1.3, 1.4**

  - [x] 2.3 更新 session_manager.py
    - 简化会话管理逻辑
    - 移除 FastRTC 相关代码
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ]* 2.4 编写会话管理器属性测试
    - **Property 2: Session ID Uniqueness**
    - **Property 4: Session Cleanup Completeness**
    - **Validates: Requirements 4.2, 4.4**

- [x] 3. Checkpoint - 确保后端测试通过
  - 运行所有后端测试
  - 确保 WebSocket 端点可访问
  - 如有问题请询问用户

- [x] 4. 实现上下文集成
  - [x] 4.1 更新 context_fetcher.py
    - 实现 build_system_instruction() 方法
    - 集成投资组合数据到系统指令
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 4.2 编写上下文获取器属性测试
    - **Property 3: System Instruction Content**
    - **Validates: Requirements 2.2, 2.3**

- [x] 5. 实现前端语音组件
  - [x] 5.1 更新 VoiceWidget.tsx
    - 实现 WebSocket 连接逻辑
    - 实现音频录制和播放
    - 实现状态管理 (idle, connecting, connected, speaking, listening, error)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.2 编写 VoiceWidget 单元测试
    - 测试按钮渲染
    - 测试状态转换
    - **Property 6: Visual Feedback State Machine**
    - **Validates: Requirements 3.3, 3.4, 3.6**

  - [x] 5.3 更新 voiceService.ts
    - 实现 WebSocket 客户端
    - 实现音频处理工具函数
    - _Requirements: 3.2, 3.6_

- [x] 6. Checkpoint - 确保前端测试通过
  - 运行所有前端测试
  - 确保组件正确渲染
  - 如有问题请询问用户

- [x] 7. 实现错误处理
  - [x] 7.1 实现后端错误处理
    - 处理 Gemini API 连接失败
    - 处理音频格式错误
    - 处理会话超时
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 7.2 编写错误处理属性测试
    - **Property 5: Error Response Format**
    - **Validates: Requirements 5.1, 5.2, 5.4**

  - [x] 7.3 实现前端错误显示
    - 显示中文错误消息
    - 提供重试选项
    - _Requirements: 5.4, 3.6_

- [x] 8. 实现安全措施
  - [x] 8.1 实现 Origin 验证
    - 验证 WebSocket 连接的 Origin 头
    - 配置允许的域名列表
    - _Requirements: 6.4_

  - [ ]* 8.2 编写安全属性测试
    - **Property 8: Origin Validation**
    - **Validates: Requirements 6.4**

  - [x] 8.3 确保音频数据不持久化
    - 验证会话结束时清理所有缓冲区
    - _Requirements: 6.2, 6.3_

- [x] 9. 部署和集成
  - [x] 9.1 更新 Dockerfile
    - 移除 FastRTC 相关配置
    - 优化镜像大小
    - _Requirements: 1.6_

  - [x] 9.2 部署到 Zeabur
    - 更新环境变量
    - 验证服务健康检查
    - 服务地址: https://voice-service.zeabur.app
    - _Requirements: 1.6_

  - [x] 9.3 集成到 ChatWindow
    - 在聊天界面添加语音按钮
    - 确保与现有文字聊天功能兼容
    - _Requirements: 3.1_

  - [x] 9.4 增强语音通话界面
    - 添加 AI IP 形象组件 (AICharacter.tsx)
    - 添加情绪表达功能
    - 添加对话记录显示 (TranscriptDisplay.tsx)
    - 添加 AI 状态指示器 (AIStatusIndicator.tsx)
    - 改进错误处理和超时机制
    - _Requirements: 3.3, 3.4, 3.6_

- [x] 10. Final Checkpoint - 端到端测试
  - [x] 服务健康检查通过
  - [x] WebSocket 端点可访问
  - [x] 前端 UI 正常显示
  - [x] 错误处理正常工作
  - 注意: 需要真实麦克风设备才能测试完整语音对话流程

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
