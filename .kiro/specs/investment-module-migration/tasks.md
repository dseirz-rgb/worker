# Implementation Plan: Investment Module Migration

## Overview

将 RiskControl 应用中的完整投资功能移植到 Echo 前端，使用 Echo 的 UI 风格 (HeroUI + MobX)，同时保持双数据库架构：
- **Investment DB** (`lyqspnecudllmnajrrlm`) - 投资/风控数据
- **Echo DB** (`jwiocrwhqeomoybbwqcp`) - 笔记/AI 数据

## Tasks

- [x] 1. 基础架构设置
  - [x] 1.1 创建 InvestmentStore (MobX)
    - 已创建 `packages/echo/src/store/investmentStore.ts`
    - 连接 Investment DB 获取数据
    - _Requirements: 7.2_
  - [x] 1.2 创建投资模块路由
    - 已在 App.tsx 添加 `/investment/*` 路由
    - 使用 InvestmentRouteWrapper 错误边界
    - _Requirements: 7.1_
  - [x] 1.3 创建数据库架构规则
    - 已创建 `.kiro/steering/database-architecture.md`
    - 明确双数据库职责
    - _Requirements: 7.3_

- [x] 2. 投资仪表盘首页
  - [x] 2.1 创建 Dashboard 页面
    - 已创建 `pages/investment/index.tsx`
    - 显示资产概览、风险指标、快捷入口
    - 功能完整，使用 HeroUI + MobX
    - _Requirements: 1.1_

- [x] 3. 持仓管理页面
  - [x] 3.1 创建 Portfolio 页面
    - 已创建 `pages/investment/portfolio.tsx`
    - 显示股票持仓列表、筛选、排序
    - 功能完整，使用 HeroUI + MobX
    - _Requirements: 2.1_

- [x] 4. 风险中心页面
  - [x] 4.1 创建 Risk Center 入口页面
    - 已创建 `pages/investment/risk/index.tsx`
    - 显示风险指标、熔断状态、快捷入口
    - 功能完整，使用 HeroUI + MobX
    - _Requirements: 5.1_

- [ ] 5. 年度回顾页面完善
  - [ ] 5.1 完善 annual-review.tsx
    - 当前状态：基本功能已实现，但缺少"年度反思"部分
    - 需要从 RiskControl `AnnualReview2025.tsx` 补充完整逻辑
    - 添加年度反思部分（关键洞察、需要改进、2026目标）
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 6. 投资镜像页面移植
  - [ ] 6.1 移植 InvestmentMirror.tsx 到 mirror.tsx
    - 当前状态：只有占位符页面
    - 需要从 RiskControl 复制时间胶囊组件逻辑
    - 转换 UI 组件到 HeroUI
    - 适配 MobX store
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ] 6.2 移植 TimeCapsule 组件
    - 从 `components/review/TimeCapsule.tsx` 复制
    - 转换为 HeroUI 组件
    - _Requirements: 2.2_

- [ ] 7. 动态笔记页面 → **已移至独立 Spec**
  - 详见 [investment-notes-integration](../investment-notes-integration/) spec
  - 采用复用 Echo 基建的方式实现，而非从 RiskControl 移植
  - 使用 InvestmentNotesStore + Investment DB `documents` 表
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 8. 语音通话页面移植
  - [ ] 8.1 移植 VoiceCall.tsx 到 voice.tsx
    - 当前状态：只有占位符页面
    - 需要从 RiskControl 复制 LiveKit 集成代码
    - 转换 UI 组件
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ] 8.2 移植 EnhancedVoiceAssistant 组件
    - 从 `components/voice/` 复制
    - 适配 Echo 的样式系统
    - _Requirements: 4.2, 4.3_

- [ ] 9. 风险引擎页面完善
  - [ ] 9.1 完善 risk/engine.tsx
    - 当前状态：有基本 UI，但缺少完整功能
    - 需要从 RiskControl `RiskEngine.tsx` 移植完整逻辑
    - 包含熔断器配置、阈值设置、保存功能
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 10. 智能风控页面完善
  - [ ] 10.1 完善 risk/intelligent.tsx
    - 当前状态：有基本 UI，但缺少完整功能
    - 需要从 RiskControl `IntelligentRisk.tsx` 移植
    - 集成 UnifiedAIAnalysisPanel
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 11. 市场分析页面完善
  - [ ] 11.1 完善 market.tsx
    - 当前状态：有基本 UI，使用模拟数据
    - 需要从 RiskControl `MarketAnalysis.tsx` 移植
    - 接入真实市场数据
    - _Requirements: 2.1_

- [ ] 12. 决策中心页面完善
  - [ ] 12.1 完善 decision.tsx
    - 当前状态：有基本 UI，使用模拟数据
    - 需要从 RiskControl `DecisionCenter.tsx` 移植
    - 接入真实 AI 决策辅助功能
    - _Requirements: 6.1_

- [ ] 13. Checkpoint - 验证所有页面
  - 启动 Echo 前端验证所有投资页面
  - 确保导航正常、数据加载正确
  - 对比 RiskControl 原版确认功能完整

- [ ] 14. 清理和文档
  - [ ] 14.1 更新项目文档
    - 更新 PROJECT_STRUCTURE.md
    - 记录双数据库架构
  - [ ] 14.2 评估 RiskControl 前端去留
    - 确认所有功能已移植
    - 决定是否废弃独立前端

## 当前状态总结

### ✅ 已完成 (功能完整)
- Task 1: 基础架构设置 - InvestmentStore、路由、数据库规则
- Task 2: 投资仪表盘首页 - 完整功能
- Task 3: 持仓管理页面 - 完整功能
- Task 4: 风险中心页面 - 完整功能

### 🔄 部分完成 (需要完善)
- Task 5: 年度回顾页面 - 缺少"年度反思"部分
- Task 9: 风险引擎页面 - 有基本 UI，缺少完整功能
- Task 10: 智能风控页面 - 有基本 UI，缺少完整功能
- Task 11: 市场分析页面 - 有基本 UI，使用模拟数据
- Task 12: 决策中心页面 - 有基本 UI，使用模拟数据

### ❌ 未开始 (只有占位符)
- Task 6: 投资镜像页面 - 只有占位符
- Task 7: 动态笔记页面 - **已移至独立 spec** ([investment-notes-integration](../investment-notes-integration/))
- Task 8: 语音通话页面 - 只有占位符

## 数据库使用说明

### Investment DB (lyqspnecudllmnajrrlm)
投资模块的所有数据都存储在 Investment DB：
- `stock_positions` - 股票持仓
- `transactions` - 交易记录
- `dashboard_snapshots` - 仪表盘快照
- `investment_notes` - 投资笔记
- `watchlist` - 观察列表
- `alerts` - 预警配置

### Echo DB (jwiocrwhqeomoybbwqcp)
Echo 主应用数据（笔记、AI 对话等）存储在 Echo DB。

**禁止跨库 JOIN，需要聚合数据时通过 API 层处理。**

## Notes

- 每个页面移植后立即验证，确保功能正常
- 优先保证功能完整，样式可以后续微调
- Recharts 图表组件两边都用，无需转换
- LiveKit 相关代码需要确保环境变量配置正确
- 投资相关数据必须使用 Investment DB，不要写入 Echo DB
