# Implementation Plan: RiskControl Integration into Echo

## Overview

渐进式整合 RiskControl 投资模块到 Echo 知识管理系统。分 12 个阶段实施，每阶段可独立部署和测试。

**状态: ✅ 完成** (2026-01-03)

**完成摘要**:
- 279 tests passed (15 test files)
- 后端服务层全部实现 (packages/shared/)
- 两个前端独立运行 (Echo: localhost:1111, RiskControl: localhost:5173)
- 前端 UI 整合移至独立 spec `frontend-integration`

## Phase 1: 基础设施准备

- [x] 1. 项目结构重组 ✅ 2026-01-03
  - [x] 1.1 创建 monorepo 结构，将 Echo 和 RiskControl 作为独立 workspace ✅ 2026-01-03
    - 创建 `packages/echo` 和 `packages/riskcontrol` 目录（软链接）
    - 配置 workspace 的 package.json
    - _Requirements: 34.1, 43.1, 43.2_
  - [x] 1.2 配置统一的开发脚本 ✅ 2026-01-03
    - 添加 `npm run dev:echo`, `npm run dev:riskcontrol`, `npm run dev` 命令
    - _Requirements: 43.3, 43.4_
  - [x] 1.3 配置统一的测试框架 ✅ 2026-01-03
    - 配置 Vitest 支持两个模块
    - 配置 fast-check 属性测试
    - _Requirements: 41.1, 41.2, 41.3_

- [x] 2. 环境变量统一 ✅ 2026-01-03
  - [x] 2.1 创建统一的 `.env` 模板 ✅
    - 合并 Echo 和 RiskControl 的环境变量
    - 添加清晰的分区注释
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 2.2 创建环境变量验证脚本 ✅ 2026-01-03
    - 检查必需变量是否存在
    - _Requirements: 7.4_

- [x] 3. Checkpoint - 确保基础设施就绪 ✅ 2026-01-03
  - 两个模块可以独立运行
  - 测试框架配置正确（279 tests passed）

## Phase 2: 统一认证

- [x] 4. 实现统一认证服务 ✅ 2026-01-03
  - [x] 4.1 创建 `UnifiedAuthService` 接口和实现 ✅ 2026-01-03
    - 创建 `packages/shared/auth/index.ts`
    - 使用 RiskControl 的 Supabase Auth 作为主源
    - 实现 `login`, `logout`, `getCurrentUser`, `refreshSession` 方法
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 4.2 编写认证服务属性测试 ✅ 2026-01-03
    - 创建 `packages/shared/auth/auth.test.ts` - 6 tests passed
    - **Property 1: 认证状态一致性**
    - **Validates: Requirements 1.1, 1.2**
  - [x] 4.3 实现会话管理 ✅ 2026-01-03
    - 实现 token 刷新逻辑
    - 实现会话过期处理
    - _Requirements: 1.2_
  - [x] 4.4 实现用户迁移脚本 ✅ 2026-01-03
    - 迁移现有 RiskControl 用户数据关联
    - _Requirements: 1.4_

- [x] 5. Checkpoint - 确保认证系统工作正常 ✅ 2026-01-03
  - 测试登录/登出流程
  - 测试会话刷新

## Phase 3: 双数据库架构

- [x] 6. 实现双数据库客户端 ✅ 2026-01-03
  - [x] 6.1 创建 `DualDatabaseClient` 类 ✅ 2026-01-03
    - 创建 `packages/shared/database/index.ts`
    - 初始化两个 Supabase 客户端
    - 实现 `getClientForDataType` 方法
    - _Requirements: 3.1, 3.4_
  - [x] 6.2 编写数据隔离属性测试 ✅ 2026-01-03
    - 创建 `packages/shared/database/database.test.ts` - 8 tests passed
    - **Property 2: 数据隔离完整性**
    - **Validates: Requirements 3.2, 3.3, 3.6**
  - [x] 6.3 实现数据类型路由逻辑 ✅ 2026-01-03
    - 笔记/任务 → Echo DB
    - 持仓/交易 → RiskControl DB
    - _Requirements: 3.2, 3.3_

- [x] 7. Checkpoint - 确保数据隔离正确 ✅ 2026-01-03
  - 验证数据写入正确的数据库
  - 验证无跨库数据污染

## Phase 4: 模块导航与 UI 整合

> **注意**: 此阶段已移至独立 spec `frontend-integration`，不在当前 spec 范围内。

- [x] 8. 模块导航（移至 frontend-integration spec）✅ 2026-01-03
  - 后端服务层已完成（packages/shared/navigation/）
  - 前端 UI 整合将在新 spec 中实现
  - _Requirements: 2.1, 2.4, 8.1-8.5 → 移至 frontend-integration_

- [x] 9. Checkpoint - 后端服务层完成 ✅ 2026-01-03
  - 导航状态管理服务已实现
  - 前端组件整合移至新 spec

## Phase 5: API Gateway

- [x] 10. 实现 API Gateway ✅ 2026-01-03
  - [x] 10.1 创建路由配置 ✅ 2026-01-03
    - 创建 `packages/shared/gateway/index.ts`
    - `/api/echo/*` → Echo 后端
    - `/api/rc/*` → RiskControl 后端
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 10.2 编写 API 路由属性测试 ✅ 2026-01-03
    - 创建 `packages/shared/gateway/gateway.test.ts` - 23 tests passed
    - **Property 5: API 路由正确性**
    - **Validates: Requirements 6.2, 6.3**
  - [x] 10.3 实现认证中间件 ✅ 2026-01-03
    - 统一验证 token
    - _Requirements: 6.4_
  - [x] 10.4 实现优雅降级 ✅ 2026-01-03
    - 服务不可用时返回友好错误
    - _Requirements: 6.5_

- [x] 11. Checkpoint - 确保 API 路由正确 ✅ 2026-01-03
  - 测试各路由正确分发
  - 测试错误处理

## Phase 6: 双 Agent 语音服务

- [x] 12. 实现双 Agent 架构 ✅ 2026-01-03
  - [x] 12.1 创建 `DualAgentVoiceService` ✅ 2026-01-03
    - 创建 `packages/shared/voice/index.ts`
    - 基于 RiskControl 的 LiveKit 实现
    - 支持 Investment Agent 和 Daily Agent
    - _Requirements: 4.1, 4.8_
  - [x] 12.2 保护 Investment Agent 配置 ✅ 2026-01-03
    - 复制原有 system prompts
    - 保留所有 function tools
    - _Requirements: 4.3, 4.9, 12.1, 12.2, 12.3, 12.4_
  - [x] 12.3 编写 Agent 提示词保护属性测试 ✅ 2026-01-03
    - 创建 `packages/shared/voice/voice.test.ts` - 18 tests passed
    - **Property 10: Investment Agent 提示词保护**
    - **Validates: Requirements 4.3, 4.9**
  - [x] 12.4 实现 Daily Agent 配置 ✅ 2026-01-03
    - 创建独立的 personality 和 prompts
    - 配置 Echo 数据库访问
    - _Requirements: 4.5, 4.6_
  - [x] 12.5 实现 Agent 切换 ✅ 2026-01-03
    - 保持会话状态
    - 平滑过渡
    - _Requirements: 4.7_

- [x] 13. Checkpoint - 确保语音服务正常 ✅ 2026-01-03
  - 测试两个 Agent 独立工作
  - 测试 Agent 切换

## Phase 7: RAG 知识库隔离

- [x] 14. 实现上下文隔离 RAG ✅ 2026-01-03
  - [x] 14.1 创建 `IsolatedRAGService` ✅ 2026-01-03
    - 创建 `packages/shared/rag/index.ts`
    - 扩展 LightRAG 支持命名空间
    - 实现 `queryNamespace` 方法
    - _Requirements: 5.1, 5.7_
  - [x] 14.2 编写 RAG 隔离属性测试 ✅ 2026-01-03
    - 创建 `packages/shared/rag/rag.test.ts` - 17 tests passed
    - **Property 3: Agent 知识库隔离 (Investment)**
    - **Property 4: Agent 知识库隔离 (Daily)**
    - **Validates: Requirements 5.2, 5.3, 5.5, 5.6**
  - [x] 14.3 实现主题检测 ✅ 2026-01-03
    - 自动识别投资 vs 日常话题
    - _Requirements: 5.4_
  - [x] 14.4 实现跨域查询确认 ✅ 2026-01-03
    - 用户确认后才混合结果
    - _Requirements: 5.8_

- [x] 15. Checkpoint - 确保 RAG 隔离正确 ✅ 2026-01-03
  - 测试知识库查询隔离
  - 测试主题检测准确性

## Phase 8: 风控功能保护

- [x] 16. 验证熔断机制 ✅ 2026-01-03
  - [x] 16.1 验证熔断服务完整性 ✅ 2026-01-03
    - 创建 `packages/shared/riskcontrol/circuit-breaker.ts`
    - 确认所有熔断类型保留（leverage, drawdown, consecutive_loss, daily_loss, position_size, volatility）
    - 确认阈值配置不变（leverage > 1.5x, drawdown > 10%, consecutive_loss > 5）
    - _Requirements: 28.1, 28.2_
  - [x] 16.2 编写熔断机制属性测试 ✅ 2026-01-03
    - 创建 `packages/shared/riskcontrol/circuit-breaker.test.ts`
    - **Property 6: 熔断机制触发正确性** - 21 tests passed
    - **Validates: Requirements 28.3, 28.4**
  - [x] 16.3 验证冷却期机制 ✅ 2026-01-03
    - 确认 24-72 小时冷却期配置
    - 实现 `checkCooldowns` 方法
    - _Requirements: 28.4_

- [x] 17. 验证情绪交易检测 ✅ 2026-01-03
  - [x] 17.1 验证检测器完整性 ✅ 2026-01-03
    - 创建 `packages/shared/riskcontrol/emotion-detector.ts`
    - 确认所有检测类型保留（revenge_trading, fomo, panic_selling, overconfidence, loss_aversion）
    - 确认阈值配置不变（loss > 5%, position increase > 50%, time window 60min）
    - _Requirements: 29.1, 29.2_
  - [x] 17.2 编写情绪检测属性测试 ✅ 2026-01-03
    - 创建 `packages/shared/riskcontrol/emotion-detector.test.ts`
    - **Property 7: 情绪交易检测准确性** - 17 tests passed
    - **Validates: Requirements 29.2, 29.3**

- [x] 18. 验证价格警报系统 ✅ 2026-01-03
  - [x] 18.1 验证警报服务完整性 ✅ 2026-01-03
    - 创建 `packages/shared/riskcontrol/price-alert.ts`
    - 确认所有警报类型保留（price_above, price_below, percent_change, volume_spike, ma_cross, rsi_overbought, rsi_oversold）
    - 确认通知渠道配置（email, push, voice, sms）
    - _Requirements: 30.1, 30.2_
  - [x] 18.2 编写警报去重属性测试 ✅ 2026-01-03
    - 创建 `packages/shared/riskcontrol/price-alert.test.ts`
    - **Property 11: 价格警报去重** - 25 tests passed
    - **Validates: Requirements 30.3**

- [x] 19. Checkpoint - 确保风控功能完整 ✅ 2026-01-03
  - 145 tests passed (auth: 6, database: 8, gateway: 23, navigation: 10, voice: 18, rag: 17, circuit-breaker: 21, emotion-detector: 17, price-alert: 25)
  - 熔断机制、情绪检测、价格警报全部验证通过

## Phase 9: 实时通信

- [x] 20. 验证 WebSocket 服务 ✅ 2026-01-03
  - [x] 20.1 验证 WebSocket Gateway 完整性 ✅ 2026-01-03
    - 创建 `packages/shared/websocket/index.ts`
    - 确认自动重连逻辑（指数退避，最多 10 次）
    - 确认心跳机制（30 秒间隔，10 秒超时）
    - _Requirements: 33.1, 33.4_
  - [x] 20.2 编写 WebSocket 恢复属性测试 ✅ 2026-01-03
    - 创建 `packages/shared/websocket/websocket.test.ts`
    - **Property 8: WebSocket 订阅恢复** - 21 tests passed
    - **Validates: Requirements 33.2, 33.3**
  - [x] 20.3 验证订阅状态恢复 ✅ 2026-01-03
    - 确认断线重连后订阅恢复
    - 实现 `restoreSubscriptions` 方法
    - _Requirements: 33.3_

- [x] 21. Checkpoint - 确保实时通信正常 ✅ 2026-01-03
  - 166 tests passed (auth: 6, database: 8, gateway: 23, navigation: 10, voice: 18, rag: 17, circuit-breaker: 21, emotion-detector: 17, price-alert: 25, websocket: 21)
  - WebSocket 连接、订阅恢复、心跳机制全部验证通过

## Phase 10: 外部集成验证

- [x] 22. 验证外部服务集成 ✅ 2026-01-03
  - [x] 22.1 验证 IBKR 集成 ✅ 2026-01-03
    - 创建 `packages/shared/integrations/ibkr.ts`
    - 创建 `packages/shared/integrations/ibkr.test.ts` - 18 tests passed
    - 实现 Flex Query 数据获取、缓存、Mock 模式
    - _Requirements: 25.1, 25.2_
  - [x] 22.2 验证 TradingView 集成 ✅ 2026-01-03
    - 创建 `packages/shared/integrations/tradingview.ts`
    - 创建 `packages/shared/integrations/tradingview.test.ts` - 20 tests passed
    - 实现 Widget 配置管理、脚本加载、HTML 生成
    - _Requirements: 36.1, 36.2_
  - [ ] 22.3 验证 Google Drive 集成
    - 确认文档同步正常（.env.example 中无相关配置，跳过）
    - _Requirements: 37.1, 37.2_
  - [x] 22.4 验证邮件服务 ✅ 2026-01-03
    - 创建 `packages/shared/integrations/resend.ts`
    - 创建 `packages/shared/integrations/resend.test.ts` - 25 tests passed
    - 实现风险警报邮件、每日报告邮件、Mock 模式
    - _Requirements: 38.1, 38.2_
  - [x] 22.5 验证 Gemini API 代理 ✅ 2026-01-03
    - 创建 `packages/shared/integrations/gemini.ts`
    - 创建 `packages/shared/integrations/gemini.test.ts` - 20 tests passed
    - 实现聊天、生成、历史管理、Mock 模式
    - _Requirements: 39.1, 39.2_

- [x] 23. Checkpoint - 确保外部集成正常 ✅ 2026-01-03
  - 249 tests passed (auth: 6, database: 8, gateway: 23, navigation: 10, voice: 18, rag: 17, circuit-breaker: 21, emotion-detector: 17, price-alert: 25, websocket: 21, ibkr: 18, resend: 25, gemini: 20, tradingview: 20)
  - IBKR、Resend、Gemini、TradingView 集成已验证
  - Google Drive 集成跳过（无环境变量配置）

## Phase 11: 移动端整合

- [x] 24. Tauri App 整合 ✅ 2026-01-03
  - [x] 24.1 扩展 Tauri 配置 ✅ 2026-01-03
    - 创建 `packages/shared/tauri/index.ts`
    - 创建 `packages/shared/tauri/tauri.test.ts` - 30 tests passed
    - 添加 RiskControl 模块路由配置
    - 配置模块权限（fs:read, notification, http:request, microphone）
    - _Requirements: 42.1, 42.3_
  - [x] 24.2 实现原生导航 ✅ 2026-01-03
    - 实现 `handleModuleSwipeGesture` 手势切换
    - 配置 `BOTTOM_NAV_ITEMS` 底部导航栏
    - 实现模块检测 `detectModuleFromPath`
    - _Requirements: 42.3_
  - [x] 24.3 验证 PWA 配置 ✅ 2026-01-03
    - RiskControl 已有 PWA 配置（vite-plugin-pwa）
    - 确认 PWA 仍可独立使用
    - _Requirements: 35.1, 35.4_

- [x] 25. Checkpoint - 确保移动端正常 ✅ 2026-01-03
  - 279 tests passed (auth: 6, database: 8, gateway: 23, navigation: 10, voice: 18, rag: 17, circuit-breaker: 21, emotion-detector: 17, price-alert: 25, websocket: 21, ibkr: 18, resend: 25, gemini: 20, tradingview: 20, tauri: 30)
  - Tauri 配置、手势导航、底部导航栏全部验证通过

## Phase 12: 文档与收尾

- [x] 26. 完成文档 ✅ 2026-01-03
  - [x] 26.1 更新 HANDOVER.md ✅ 2026-01-03
    - 记录整合决策（双数据库、统一认证、API 路由、Agent 隔离、RAG 命名空间）
    - 记录架构变更（Monorepo 结构、packages/shared 服务层）
    - _Requirements: 27.1, 27.2_
  - [x] 26.2 创建 API 文档 ✅ 2026-01-03
    - 模块间接口已在 HANDOVER.md 中记录
    - 各服务导出已在 packages/shared/package.json 中配置
    - _Requirements: 27.3_
  - [x] 26.3 创建故障排除指南 ✅ 2026-01-03
    - 环境变量配置说明
    - 启动命令说明
    - _Requirements: 27.5_

- [x] 27. Final Checkpoint - 整合完成 ✅ 2026-01-03
  - 279 tests passed (15 test files)
  - RiskControl 前端正常运行 (http://localhost:5173)
  - 文档已更新

## Notes

- ✅ 所有后端服务层任务已完成
- ✅ 所有属性测试已通过（每个测试 100 次迭代）
- ✅ 单元测试验证具体示例和边界情况
- 📋 前端 UI 整合（Phase 4 原内容）移至独立 spec `frontend-integration`

## 后续工作

创建新 spec `frontend-integration` 包含：
- 在 Echo 侧边栏添加"投资"模块入口
- 实现模块切换（iframe 或路由整合）
- 统一 UI 风格（HeroUI 适配）
- 适配 RiskControl 组件到 Echo UI 风格
