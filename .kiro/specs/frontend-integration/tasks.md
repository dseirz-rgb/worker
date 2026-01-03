# Implementation Plan: Frontend Integration

## Overview

将 RiskControl 前端深度整合到 Echo 应用中，统一技术栈。分 3 个阶段实施。

## Phase 1: 框架搭建 ✅

- [x] 1. Echo 侧边栏扩展
  - [x] 1.1 在 Echo 侧边栏添加"投资"菜单项
    - 创建 `InvestmentSidebarItem` 组件，9 个子菜单项
    - 集成到 `Sidebar.tsx`，支持展开/收起
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 1.2 实现警报徽章显示
    - InvestmentStore.activeAlertCount 计算属性
    - _Requirements: 3.4_

- [x] 2. 投资模块路由配置
  - [x] 2.1 在 Echo 路由中添加 14 个投资模块路由
    - 所有路由使用 lazy loading + ProtectedRoute
    - _Requirements: 2.2_

- [x] 3. 投资模块 MobX Store
  - [x] 3.1 创建 InvestmentStore 类
    - 集成 DualDatabaseClient、CircuitBreakerService、PriceAlertService
    - 实现 positions、riskMetrics、alerts 状态管理
    - _Requirements: 2.3_

- [x] 4. Checkpoint - 框架搭建完成
  - TypeScript 类型检查通过
  - 侧边栏、路由、Store 已集成

## Phase 2: 组件迁移 (进行中)

- [x] 5. 迁移核心页面（P0）
  - [x] 5.1 迁移 Home/Dashboard 页面
    - 创建 `pages/investment/index.tsx`
    - 使用 InvestmentStore 获取数据
    - 包含：资产概览、风险指标、最近警报、快捷入口
    - _Requirements: 4.1, 4.2_
  - [x] 5.2 迁移 Portfolio 持仓页面
    - 创建 `pages/investment/portfolio.tsx`
    - 包含：持仓列表、筛选、排序、汇总统计
    - _Requirements: 4.1_

- [x] 6. 迁移风控页面（P1）
  - [x] 6.1 迁移 RiskCenter 风险中心
    - 创建 `pages/investment/risk/index.tsx`
    - 包含：综合风险评分、熔断状态、风险指标卡片
    - _Requirements: 4.1_
  - [x] 6.2 迁移 IntelligentRisk 智能风控
    - 创建 `pages/investment/risk/intelligent.tsx`
    - 包含：情绪检测、AI 风险预警
    - _Requirements: 4.1_
  - [x] 6.3 迁移 RiskEngine 风险引擎
    - 创建 `pages/investment/risk/engine.tsx`
    - 包含：熔断规则配置、计算参数
    - _Requirements: 4.1_
  - [x] 6.4 迁移 RiskSettings 风险设置
    - 创建 `pages/investment/risk/settings.tsx`
    - 包含：阈值配置、通知设置
    - _Requirements: 4.1_

- [x] 7. 迁移分析页面（P1）
  - [x] 7.1 迁移 MarketAnalysis 市场分析
    - 创建 `pages/investment/market.tsx`
    - 包含：市场指数、热门股票、技术分析入口
    - _Requirements: 4.1_
  - [x] 7.2 迁移 DecisionCenter 决策中心
    - 创建 `pages/investment/decision.tsx`
    - 包含：AI 建议、智能问答、研报解读入口
    - _Requirements: 4.1_
  - [x] 7.3 迁移 InvestmentMirror 投资镜像
    - 创建 `pages/investment/mirror.tsx`
    - 包含：placeholder UI
    - _Requirements: 4.1_

- [x] 8. 迁移辅助页面（P2）
  - [x] 8.1 迁移 DynamicNotes 动态笔记
    - 创建 `pages/investment/notes.tsx`
    - _Requirements: 4.1_
  - [x] 8.2 迁移 VoiceCall 语音通话
    - 创建 `pages/investment/voice.tsx`
    - _Requirements: 4.1_
  - [ ] 8.3 迁移 UserProfile 用户设置
    - 整合到 Echo 的设置页面（待定）
    - _Requirements: 4.1_
  - [x] 8.4 迁移 AnnualReview 年度回顾
    - 创建 `pages/investment/annual-review.tsx`
    - _Requirements: 4.1_
  - [x] 8.5 迁移 ComponentShowcase 组件展示
    - 创建 `pages/investment/showcase.tsx`
    - 包含：HeroUI 组件展示
    - _Requirements: 4.1_
  - [x] 8.6 迁移 AgentDemo Agent 演示
    - 创建 `pages/investment/agent-demo.tsx`
    - 包含：AI 对话演示
    - _Requirements: 4.1_

- [x] 9. HeroUI 组件适配
  - [x] 9.1 所有页面使用 HeroUI 组件
    - Card, Button, Chip, Input, Table, Progress, Switch, Tabs 等
    - 统一使用 GradientBackground 背景
    - _Requirements: 4.1, 4.2_

- [x] 10. Checkpoint - 组件迁移完成
  - [x] 所有 14 个页面已创建
  - [x] 所有页面使用 HeroUI 组件
  - [x] TypeScript 类型检查通过
  - [x] 前端服务运行正常 (http://localhost:1111/investment)

## Phase 3: 响应式与错误处理

- [x] 11. 响应式布局适配
  - [x] 11.1 适配投资页面响应式布局
    - 桌面端：多列布局
    - 平板端：两列布局
    - 移动端：单列布局
    - _Requirements: 6.1, 6.4_
  - [ ]* 11.2 编写响应式布局测试
    - **Property 6: 响应式布局**
    - **Validates: Requirements 6.1, 6.4**

- [x] 12. 错误边界实现
  - [x] 12.1 创建 InvestmentErrorBoundary 组件
    - 捕获投资模块错误
    - 显示友好错误 UI
    - 提供重试按钮
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [ ]* 12.2 编写错误边界测试
    - **Property 7: 错误边界隔离**
    - **Validates: Requirements 8.1, 8.2**

- [x] 13. Checkpoint - 响应式与错误处理完成
  - 确保各屏幕尺寸显示正常
  - 确保错误不会崩溃整个应用

## Phase 4: 清理收尾

- [x] 14. 状态管理统一
  - [x] 14.1 移除 Zustand 依赖
    - 确认所有状态已迁移到 MobX
    - 移除 RiskControl 的 Zustand stores
    - _Requirements: 2.3_

- [x] 15. 清理独立前端
  - [x] 15.1 更新启动脚本
    - 移除 `npm run dev:riskcontrol` 命令
    - 更新 `npm run dev` 只启动 Echo
    - _Requirements: 1.1_
  - [x] 15.2 更新文档
    - 更新 README.md
    - 更新 HANDOVER.md
    - _Requirements: 1.4_

- [x] 16. Final Checkpoint - 整合完成
  - 确保只有一个前端应用
  - 确保所有功能正常
  - 确保测试通过

## Notes

- 任务标记 `*` 为可选测试任务
- 每个 Checkpoint 确保阶段性成果可用
- 属性测试验证核心正确性属性（每个测试 100 次迭代）
- 迁移过程中保持 RiskControl 独立前端可用，直到 Phase 4 完成
