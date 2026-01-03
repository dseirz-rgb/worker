# Implementation Plan: RiskControl Integration into Echo

## Overview

渐进式整合 RiskControl 投资模块到 Echo 知识管理系统。分 4 个阶段实施，每阶段可独立部署和测试。

## Phase 1: 基础设施准备

- [ ] 1. 项目结构重组
  - [ ] 1.1 创建 monorepo 结构，将 Echo 和 RiskControl 作为独立 workspace
    - 创建 `packages/echo` 和 `packages/riskcontrol` 目录
    - 配置 workspace 的 package.json
    - _Requirements: 34.1, 43.1, 43.2_
  - [ ] 1.2 配置统一的开发脚本
    - 添加 `npm run dev:echo`, `npm run dev:riskcontrol`, `npm run dev` 命令
    - _Requirements: 43.3, 43.4_
  - [ ] 1.3 配置统一的测试框架
    - 配置 Vitest 支持两个模块
    - 配置 fast-check 属性测试
    - _Requirements: 41.1, 41.2, 41.3_

- [ ] 2. 环境变量统一
  - [ ] 2.1 创建统一的 `.env` 模板
    - 合并 Echo 和 RiskControl 的环境变量
    - 添加清晰的分区注释
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ] 2.2 创建环境变量验证脚本
    - 检查必需变量是否存在
    - _Requirements: 7.4_

- [ ] 3. Checkpoint - 确保基础设施就绪
  - 确保两个模块可以独立运行
  - 确保测试框架配置正确

## Phase 2: 统一认证

- [ ] 4. 实现统一认证服务
  - [ ] 4.1 创建 `UnifiedAuthService` 接口和实现
    - 使用 RiskControl 的 Supabase Auth 作为主源
    - 实现 `login`, `logout`, `getCurrentUser`, `refreshSession` 方法
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ] 4.2 编写认证服务属性测试
    - **Property 1: 认证状态一致性**
    - **Validates: Requirements 1.1, 1.2**
  - [ ] 4.3 实现会话管理
    - 实现 token 刷新逻辑
    - 实现会话过期处理
    - _Requirements: 1.2_
  - [ ] 4.4 实现用户迁移脚本
    - 迁移现有 RiskControl 用户数据关联
    - _Requirements: 1.4_

- [ ] 5. Checkpoint - 确保认证系统工作正常
  - 测试登录/登出流程
  - 测试会话刷新

## Phase 3: 双数据库架构

- [ ] 6. 实现双数据库客户端
  - [ ] 6.1 创建 `DualDatabaseClient` 类
    - 初始化两个 Supabase 客户端
    - 实现 `getClientForDataType` 方法
    - _Requirements: 3.1, 3.4_
  - [ ] 6.2 编写数据隔离属性测试
    - **Property 2: 数据隔离完整性**
    - **Validates: Requirements 3.2, 3.3, 3.6**
  - [ ] 6.3 实现数据类型路由逻辑
    - 笔记/任务 → Echo DB
    - 持仓/交易 → RiskControl DB
    - _Requirements: 3.2, 3.3_

- [ ] 7. Checkpoint - 确保数据隔离正确
  - 验证数据写入正确的数据库
  - 验证无跨库数据污染

## Phase 4: 模块导航与 UI 整合

- [ ] 8. 实现模块导航
  - [ ] 8.1 创建 `ModuleNavigator` 组件
    - 使用 Echo 的 UI 设计系统
    - 实现模块切换动画
    - _Requirements: 2.1, 8.1, 8.2_
  - [ ] 8.2 实现导航状态持久化
    - 保存最后访问的模块
    - 保存每个模块的最后路径
    - _Requirements: 2.4_
  - [ ] 8.3 编写导航状态属性测试
    - **Property 9: 导航状态持久化**
    - **Validates: Requirements 2.4**
  - [ ] 8.4 适配 RiskControl 组件到 Echo UI 风格
    - 替换 Radix UI 为 HeroUI
    - 统一颜色和间距
    - _Requirements: 8.3, 8.4, 8.5_

- [ ] 9. Checkpoint - 确保 UI 整合完成
  - 测试模块切换流畅性
  - 验证 UI 风格一致性

## Phase 5: API Gateway

- [ ] 10. 实现 API Gateway
  - [ ] 10.1 创建路由配置
    - `/api/echo/*` → Echo 后端
    - `/api/rc/*` → RiskControl 后端
    - _Requirements: 6.1, 6.2, 6.3_
  - [ ] 10.2 编写 API 路由属性测试
    - **Property 5: API 路由正确性**
    - **Validates: Requirements 6.2, 6.3**
  - [ ] 10.3 实现认证中间件
    - 统一验证 token
    - _Requirements: 6.4_
  - [ ] 10.4 实现优雅降级
    - 服务不可用时返回友好错误
    - _Requirements: 6.5_

- [ ] 11. Checkpoint - 确保 API 路由正确
  - 测试各路由正确分发
  - 测试错误处理

## Phase 6: 双 Agent 语音服务

- [ ] 12. 实现双 Agent 架构
  - [ ] 12.1 创建 `DualAgentVoiceService`
    - 基于 RiskControl 的 LiveKit 实现
    - 支持 Investment Agent 和 Daily Agent
    - _Requirements: 4.1, 4.8_
  - [ ] 12.2 保护 Investment Agent 配置
    - 复制原有 system prompts
    - 保留所有 function tools
    - _Requirements: 4.3, 4.9, 12.1, 12.2, 12.3, 12.4_
  - [ ] 12.3 编写 Agent 提示词保护属性测试
    - **Property 10: Investment Agent 提示词保护**
    - **Validates: Requirements 4.3, 4.9**
  - [ ] 12.4 实现 Daily Agent 配置
    - 创建独立的 personality 和 prompts
    - 配置 Echo 数据库访问
    - _Requirements: 4.5, 4.6_
  - [ ] 12.5 实现 Agent 切换
    - 保持会话状态
    - 平滑过渡
    - _Requirements: 4.7_

- [ ] 13. Checkpoint - 确保语音服务正常
  - 测试两个 Agent 独立工作
  - 测试 Agent 切换

## Phase 7: RAG 知识库隔离

- [ ] 14. 实现上下文隔离 RAG
  - [ ] 14.1 创建 `IsolatedRAGService`
    - 扩展 LightRAG 支持命名空间
    - 实现 `queryNamespace` 方法
    - _Requirements: 5.1, 5.7_
  - [ ] 14.2 编写 RAG 隔离属性测试
    - **Property 3: Agent 知识库隔离 (Investment)**
    - **Property 4: Agent 知识库隔离 (Daily)**
    - **Validates: Requirements 5.2, 5.3, 5.5, 5.6**
  - [ ] 14.3 实现主题检测
    - 自动识别投资 vs 日常话题
    - _Requirements: 5.4_
  - [ ] 14.4 实现跨域查询确认
    - 用户确认后才混合结果
    - _Requirements: 5.8_

- [ ] 15. Checkpoint - 确保 RAG 隔离正确
  - 测试知识库查询隔离
  - 测试主题检测准确性

## Phase 8: 风控功能保护

- [ ] 16. 验证熔断机制
  - [ ] 16.1 验证熔断服务完整性
    - 确认所有熔断类型保留
    - 确认阈值配置不变
    - _Requirements: 28.1, 28.2_
  - [ ] 16.2 编写熔断机制属性测试
    - **Property 6: 熔断机制触发正确性**
    - **Validates: Requirements 28.3, 28.4**
  - [ ] 16.3 验证冷却期机制
    - 确认 24-72 小时冷却期
    - _Requirements: 28.4_

- [ ] 17. 验证情绪交易检测
  - [ ] 17.1 验证检测器完整性
    - 确认所有检测类型保留
    - 确认阈值配置不变
    - _Requirements: 29.1, 29.2_
  - [ ] 17.2 编写情绪检测属性测试
    - **Property 7: 情绪交易检测准确性**
    - **Validates: Requirements 29.2, 29.3**

- [ ] 18. 验证价格警报系统
  - [ ] 18.1 验证警报服务完整性
    - 确认所有警报类型保留
    - 确认通知渠道配置
    - _Requirements: 30.1, 30.2_
  - [ ] 18.2 编写警报去重属性测试
    - **Property 11: 价格警报去重**
    - **Validates: Requirements 30.3**

- [ ] 19. Checkpoint - 确保风控功能完整
  - 测试熔断触发
  - 测试情绪检测
  - 测试价格警报

## Phase 9: 实时通信

- [ ] 20. 验证 WebSocket 服务
  - [ ] 20.1 验证 WebSocket Gateway 完整性
    - 确认自动重连逻辑
    - 确认心跳机制
    - _Requirements: 33.1, 33.4_
  - [ ] 20.2 编写 WebSocket 恢复属性测试
    - **Property 8: WebSocket 订阅恢复**
    - **Validates: Requirements 33.2, 33.3**
  - [ ] 20.3 验证订阅状态恢复
    - 确认断线重连后订阅恢复
    - _Requirements: 33.3_

- [ ] 21. Checkpoint - 确保实时通信正常
  - 测试 WebSocket 连接
  - 测试断线重连

## Phase 10: 外部集成验证

- [ ] 22. 验证外部服务集成
  - [ ] 22.1 验证 IBKR 集成
    - 确认 Flex Query 正常工作
    - _Requirements: 25.1, 25.2_
  - [ ] 22.2 验证 TradingView 集成
    - 确认图表 Widget 正常加载
    - _Requirements: 36.1, 36.2_
  - [ ] 22.3 验证 Google Drive 集成
    - 确认文档同步正常
    - _Requirements: 37.1, 37.2_
  - [ ] 22.4 验证邮件服务
    - 确认 Resend 邮件发送正常
    - _Requirements: 38.1, 38.2_
  - [ ] 22.5 验证 Gemini API 代理
    - 确认代理正常工作
    - _Requirements: 39.1, 39.2_

- [ ] 23. Checkpoint - 确保外部集成正常
  - 测试各外部服务连接
  - 验证数据同步

## Phase 11: 移动端整合

- [ ] 24. Tauri App 整合
  - [ ] 24.1 扩展 Tauri 配置
    - 添加 RiskControl 模块路由
    - 配置模块权限
    - _Requirements: 42.1, 42.3_
  - [ ] 24.2 实现原生导航
    - 模块切换手势
    - 底部导航栏
    - _Requirements: 42.3_
  - [ ] 24.3 验证 PWA 配置
    - 确认 PWA 仍可独立使用
    - _Requirements: 35.1, 35.4_

- [ ] 25. Checkpoint - 确保移动端正常
  - 测试 Tauri App 模块切换
  - 测试 PWA 功能

## Phase 12: 文档与收尾

- [ ] 26. 完成文档
  - [ ] 26.1 更新 HANDOVER.md
    - 记录整合决策
    - 记录架构变更
    - _Requirements: 27.1, 27.2_
  - [ ] 26.2 创建 API 文档
    - 记录模块间接口
    - _Requirements: 27.3_
  - [ ] 26.3 创建故障排除指南
    - 常见问题解决方案
    - _Requirements: 27.5_

- [ ] 27. Final Checkpoint - 整合完成
  - 运行所有测试
  - 验证所有功能正常
  - 确认文档完整

## Notes

- 所有任务都是必须完成的，包括属性测试
- 每个 Checkpoint 确保阶段性成果可用
- 属性测试验证核心正确性属性（每个测试 100 次迭代）
- 单元测试验证具体示例和边界情况
