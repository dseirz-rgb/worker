# Implementation Plan: Intelligent Risk Engine

## Overview

基于 Qlib Analytics 预测结果和实时行情数据，实现智能风控决策层。采用 TypeScript + React + Supabase 技术栈，与现有风控系统深度集成。

### 前置依赖

- **qlib-analytics** spec 必须先完成，提供预测 API
- **risk-control-2026** spec 必须先完成，提供基础风控规则
- **realtime-market-platform** spec 必须先完成，提供实时行情

## Tasks

- [x] 1. 数据库表结构创建
  - [x] 1.1 创建 risk_decisions 表
    - 创建 Supabase 迁移文件
    - 存储风控决策记录
    - _Requirements: 6.5_
  - [x] 1.2 创建 risk_alerts_history 表
    - 存储风险预警历史
    - _Requirements: 3.5_
  - [x] 1.3 创建 user_risk_config 表
    - 存储用户风控配置
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [x] 1.4 创建 emotional_trading_events 表
    - 存储情绪化交易检测记录
    - _Requirements: 5.5_

- [x] 2. Dynamic Leverage Controller
  - [x] 2.1 创建 dynamicLeverageController.ts
    - 创建 `client/src/services/dynamicLeverageController.ts`
    - 实现基础杠杆限制映射（bull: 1.5x, sideways: 1.3x, bear/high_vol: 1.0x）
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 2.2 实现波动率调整逻辑
    - 波动率超过 80 分位额外降低 0.2x
    - _Requirements: 1.4_
  - [ ]* 2.3 编写杠杆限制范围属性测试
    - **Property 1: 杠杆限制范围**
    - **Validates: Requirements 1.1, 1.2, 1.3**
  - [x] 2.4 实现杠杆变更通知
    - 杠杆限制变化时通知用户
    - 记录变更历史
    - _Requirements: 1.5, 1.6_

- [x] 3. Dynamic StopLoss Manager
  - [x] 3.1 创建 dynamicStopLossManager.ts
    - 创建 `client/src/services/dynamicStopLossManager.ts`
    - 实现波动率分位数到止损线的映射
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 3.2 实现用户自定义范围
    - 支持配置止损线范围（-5% ~ -20%）
    - _Requirements: 2.5_
  - [ ]* 3.3 编写止损线范围属性测试
    - **Property 2: 止损线范围**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
  - [x] 3.4 实现止损变更通知
    - 止损线变化时通知用户并显示原因
    - _Requirements: 2.6_

- [x] 4. Checkpoint - 动态阈值完成
  - 确保杠杆和止损动态调整正常，如有问题请询问用户

- [ ] 5. Risk Forecaster
  - [ ] 5.1 创建 riskForecaster.ts
    - 创建 `client/src/services/riskForecaster.ts`
    - 实现每日风险预测报告生成
    - _Requirements: 3.1_
  - [ ] 5.2 实现回撤概率预警
    - >10% 回撤概率 >50% 触发中等风险预警
    - >15% 回撤概率 >30% 触发高风险预警
    - _Requirements: 3.2, 3.3_
  - [ ] 5.3 实现趋势转换预警
    - bull → bear 转换概率 >40% 触发预警
    - _Requirements: 3.4_
  - [ ] 5.4 实现预警通知
    - 支持 Toast、邮件、推送通知
    - _Requirements: 3.5_
  - [ ]* 5.5 编写预警完整性属性测试
    - **Property 8: 预警完整性**
    - **Validates: Requirements 3.5, 3.6**

- [ ] 6. Emotional Trading Detector
  - [ ] 6.1 创建 emotionalTradingDetector.ts
    - 创建 `client/src/services/emotionalTradingDetector.ts`
    - 实现交易行为记录
    - _Requirements: 5.1_
  - [ ] 6.2 实现报复性交易检测
    - 亏损后大幅加仓检测
    - _Requirements: 5.1_
  - [ ] 6.3 实现过度交易检测
    - 短时间内频繁交易检测
    - _Requirements: 5.1_
  - [ ] 6.4 实现冷静期功能
    - 检测到情绪化交易时建议冷静期
    - 支持用户设置冷静期时长
    - _Requirements: 5.2, 5.4_
  - [ ]* 6.5 编写冷静期执行属性测试
    - **Property 4: 冷静期执行**
    - **Validates: Requirements 5.2, 5.4**
  - [ ] 6.6 实现交易行为分析报告
    - 生成交易行为分析报告
    - _Requirements: 5.3, 5.5_

- [ ] 7. Checkpoint - 预警系统完成
  - 确保风险预警和情绪检测正常，如有问题请询问用户

- [ ] 8. Risk Decision Engine
  - [ ] 8.1 创建 riskDecisionEngine.ts
    - 创建 `client/src/services/riskDecisionEngine.ts`
    - 实现综合决策生成
    - _Requirements: 6.1_
  - [ ] 8.2 实现保守优先策略
    - 多模块冲突时采用最保守决策
    - _Requirements: 6.2_
  - [ ]* 8.3 编写风险等级一致性属性测试
    - **Property 3: 风险等级一致性**
    - **Validates: Requirements 6.2**
  - [ ] 8.4 实现决策覆盖功能
    - 支持手动覆盖自动决策
    - 记录覆盖原因和操作者
    - _Requirements: 6.4_
  - [ ]* 8.5 编写覆盖审计属性测试
    - **Property 6: 覆盖审计**
    - **Validates: Requirements 6.4, 6.5**
  - [ ] 8.6 实现决策记录
    - 保存所有决策到数据库
    - _Requirements: 6.5_
  - [ ]* 8.7 编写决策可追溯属性测试
    - **Property 5: 决策可追溯**
    - **Validates: Requirements 6.5, 7.5**

- [ ] 9. Position Optimizer (可选 V2)
  - [ ] 9.1 创建 positionOptimizer.ts
    - 创建 `client/src/services/positionOptimizer.ts`
    - 实现基于风险预算的仓位计算
    - _Requirements: 4.1_
  - [ ] 9.2 实现调仓建议
    - 当前仓位偏离最优配置超过 20% 时生成建议
    - _Requirements: 4.2_
  - [ ] 9.3 实现多配置方案
    - 提供保守/平衡/激进三种方案
    - _Requirements: 4.4_

- [ ] 10. 前端组件
  - [ ] 10.1 创建 RiskDashboard 组件
    - 创建 `client/src/components/risk/RiskDashboard.tsx`
    - 显示当前风险等级、杠杆限制、止损线
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ] 10.2 创建 RiskAlertPanel 组件
    - 创建 `client/src/components/risk/RiskAlertPanel.tsx`
    - 显示最新风险预警和建议操作
    - _Requirements: 7.5_
  - [ ] 10.3 创建 RiskForecastChart 组件
    - 创建 `client/src/components/risk/RiskForecastChart.tsx`
    - 显示未来 1/3/5 天风险预测
    - _Requirements: 7.4_
  - [ ] 10.4 创建 RiskHistoryChart 组件
    - 显示风险历史趋势
    - _Requirements: 7.6_
  - [ ] 10.5 创建 useRiskDecision Hook
    - 创建 `client/src/hooks/useRiskDecision.ts`
    - 封装风险决策获取和订阅逻辑
    - _Requirements: 7.1_

- [ ] 11. 用户配置界面
  - [ ] 11.1 创建 RiskConfigPanel 组件
    - 创建 `client/src/components/risk/RiskConfigPanel.tsx`
    - 支持配置风险偏好、最大回撤、通知渠道
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [ ] 11.2 实现配置模板
    - 提供推荐配置模板
    - _Requirements: 9.5_

- [ ] 12. 风险报告 (可选 V2)
  - [ ] 12.1 实现周报生成
    - 每周生成风险分析周报
    - _Requirements: 8.1, 8.2_
  - [ ] 12.2 实现月报生成
    - 每月生成风险分析月报
    - _Requirements: 8.3, 8.4_
  - [ ] 12.3 实现报告导出
    - 支持 PDF 导出和邮件发送
    - _Requirements: 8.5_

- [ ] 13. API 集成
  - [ ] 13.1 创建风控状态 API
    - 实现 GET /api/risk/status 端点
    - _Requirements: 10.1_
  - [ ] 13.2 创建风控决策 API
    - 实现 GET /api/risk/decision 端点
    - _Requirements: 10.1, 10.3_
  - [ ] 13.3 创建历史查询 API
    - 实现 GET /api/risk/history 端点
    - _Requirements: 10.4_
  - [ ] 13.4 创建 TypeScript SDK
    - 封装 API 调用
    - _Requirements: 10.5_

- [ ] 14. 集成到现有页面
  - [ ] 14.1 集成到 Dashboard 页面
    - 添加风险仪表盘组件
    - 显示实时风控状态
    - _Requirements: 7.1_
  - [ ] 14.2 集成到 Portfolio 页面
    - 显示动态杠杆和止损信息
    - _Requirements: 7.2, 7.3_
  - [ ] 14.3 集成到 Settings 页面
    - 添加风控配置入口
    - _Requirements: 9.1_

- [ ] 15. Final Checkpoint - 全部完成
  - 确保所有测试通过
  - 验证端到端流程：预测输入 → 动态阈值 → 风险决策 → 通知
  - 如有问题请询问用户

## Notes

- 任务标记 `*` 为可选测试任务，可跳过以加快 MVP 开发
- Position Optimizer (任务 9) 和风险报告 (任务 12) 可作为 V2 功能延后实现
- 本 spec 依赖 qlib-analytics 的预测 API，需确保 Qlib 服务可用
- 情绪化交易检测需要足够的交易历史数据才能有效工作
