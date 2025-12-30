# Implementation Plan: Risk Control System 2026

## Overview

基于 2025 年度投资回顾分析，实现刚性风控规则、利润保护机制和交易心理优化。采用 TypeScript + React + Supabase 技术栈，复用现有的风控服务架构。

## Tasks

- [x] 1. 数据库表结构创建
  - [x] 1.1 创建 risk_thresholds 表
    - 创建 Supabase 迁移文件
    - 包含杠杆、回撤、止盈、连败的阈值配置
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 1.2 创建 risk_logs 表
    - 创建 Supabase 迁移文件
    - 记录所有风控警报和熔断事件
    - _Requirements: 1.7, 5.6_
  - [x] 1.3 创建 monthly_snapshots 表
    - 创建 Supabase 迁移文件
    - 记录每月初始净值和月度统计
    - _Requirements: 2.6, 2.7_
  - [x] 1.4 创建 circuit_breaker_events 表
    - 创建 Supabase 迁移文件
    - 记录熔断触发和解除事件
    - _Requirements: 2.3, 4.3_

- [x] 2. 实现 Risk Metrics Service
  - [x] 2.1 创建 riskMetricsService.ts
    - 创建 `client/src/services/riskMetricsService.ts`
    - 实现 RiskMetrics 和 RiskThresholds 接口
    - 实现 calculateRiskMetrics 方法
    - _Requirements: 5.2_
  - [x] 2.2 实现杠杆率计算
    - 计算当前杠杆率 = 总持仓市值 / 净资产
    - 实现杠杆状态判断 (normal/warning/critical)
    - _Requirements: 1.1, 1.2, 1.3_
  - [x]* 2.3 编写杠杆阈值属性测试
    - **Property 1: Leverage Alert Threshold Consistency**
    - 测试杠杆超过阈值时状态正确
    - **Validates: Requirements 1.2, 1.3**
  - [x] 2.4 实现月度回撤计算
    - 计算月度回撤 = (月初净值 - 当前净值) / 月初净值 * 100
    - 实现回撤状态判断
    - _Requirements: 2.1, 2.5_
  - [x]* 2.5 编写月度回撤计算属性测试
    - **Property 4: Monthly Drawdown Calculation Accuracy**
    - 测试回撤计算公式正确性
    - **Validates: Requirements 2.1**
  - [x] 2.6 实现高水位追踪
    - 追踪历史最高净值 (HWM)
    - 计算移动止盈线 = HWM * (1 - trailing_stop_percent)
    - _Requirements: 3.1, 3.3_
  - [x]* 2.7 编写高水位单调性属性测试
    - **Property 7: High Water Mark Monotonicity**
    - 测试 HWM 只增不减
    - **Validates: Requirements 3.1, 3.2**
  - [x]* 2.8 编写止盈线计算属性测试
    - **Property 8: Trailing Stop Level Calculation**
    - 测试止盈线计算公式正确
    - **Validates: Requirements 3.3**
  - [x] 2.9 实现连败天数追踪
    - 追踪连续亏损天数
    - 盈利日重置计数器
    - _Requirements: 4.1, 4.5_
  - [x]* 2.10 编写连败计数属性测试
    - **Property 11: Losing Streak Counter Accuracy**
    - **Property 12: Losing Streak Reset on Profit**
    - **Validates: Requirements 4.1, 4.5**
  - [x] 2.11 实现综合风险评分
    - 基于所有指标计算 0-100 分
    - 实现 safe/caution/danger 状态
    - _Requirements: 5.7_
  - [x]* 2.12 编写风险评分边界属性测试
    - **Property 14: Risk Score Bounds**
    - 测试评分始终在 0-100 范围内
    - **Validates: Requirements 5.7**

- [x] 3. Checkpoint - 指标计算完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 4. 实现 Circuit Breaker Service
  - [x] 4.1 创建 circuitBreakerService.ts
    - 创建 `client/src/services/circuitBreakerService.ts`
    - 实现 CircuitBreakerState 接口
    - 实现 checkAndTrigger 方法
    - _Requirements: 1.4, 2.3, 4.3_
  - [x] 4.2 实现杠杆熔断逻辑
    - 杠杆 > 2.0x 触发全屏阻断模态框
    - 杠杆 > 1.5x 阻止新建仓
    - _Requirements: 1.4, 1.5_
  - [x]* 4.3 编写杠杆阻断属性测试
    - **Property 2: Leverage Blocking Enforcement**
    - 测试高杠杆时拒绝新订单
    - **Validates: Requirements 1.5**
  - [x] 4.4 实现动态杠杆限制
    - 回撤期间（NAV < HWM）降低杠杆限制到 1.2x
    - _Requirements: 1.6_
  - [x]* 4.5 编写动态杠杆限制属性测试
    - **Property 3: Dynamic Leverage Limit in Drawdown**
    - 测试回撤期间杠杆限制降低
    - **Validates: Requirements 1.6**
  - [x] 4.6 实现月度回撤熔断
    - -10% 触发半仓警告
    - -15% 触发强制冷静期（3天）
    - _Requirements: 2.2, 2.3, 2.4_
  - [x]* 4.7 编写月度回撤阈值属性测试
    - **Property 5: Monthly Drawdown Alert Thresholds**
    - 测试回撤阈值触发正确状态
    - **Validates: Requirements 2.2, 2.3**
  - [x] 4.8 实现移动止盈熔断
    - NAV 跌破止盈线触发利润保护警报
    - _Requirements: 3.4, 3.5_
  - [x]* 4.9 编写止盈触发属性测试
    - **Property 9: Trailing Stop Alert Trigger**
    - 测试 NAV < 止盈线时触发警报
    - **Validates: Requirements 3.4**
  - [x] 4.10 实现连败熔断
    - 连败 3 天触发警告
    - 连败 5 天触发强制冷静期（1天）
    - _Requirements: 4.2, 4.3, 4.7_
  - [x]* 4.11 编写连败阈值属性测试
    - **Property 13: Losing Streak Alert Thresholds**
    - 测试连败阈值触发正确状态
    - **Validates: Requirements 4.2, 4.3**
  - [x] 4.12 实现熔断确认和解除
    - 实现 acknowledgeAlert 方法
    - 实现 overrideCoolingPeriod 方法（需密码）
    - _Requirements: 1.4_

- [x] 5. Checkpoint - 熔断机制完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 6. 实现月度快照服务
  - [x] 6.1 创建 monthlySnapshotService.ts
    - 创建 `client/src/services/monthlySnapshotService.ts`
    - 实现月初净值记录
    - 实现月度统计更新
    - _Requirements: 2.6, 2.7_
  - [x]* 6.2 编写月度重置属性测试
    - **Property 6: Monthly Drawdown Reset on New Month**
    - 测试新月份重置回撤计算
    - **Validates: Requirements 2.6**

- [x] 7. 实现风控配置服务
  - [x] 7.1 创建 riskConfigService.ts
    - 创建 `client/src/services/riskConfigService.ts`
    - 实现阈值读取和保存
    - 实现恢复默认值功能
    - _Requirements: 6.1, 6.6, 6.7_
  - [x]* 7.2 编写配置持久化属性测试
    - **Property 15: Risk Threshold Configuration Persistence**
    - 测试保存后读取返回相同值
    - **Validates: Requirements 6.6**
  - [x] 7.3 实现止盈百分比边界验证
    - 限制 trailing_stop_percent 在 10-25% 范围
    - _Requirements: 3.7_
  - [x]* 7.4 编写止盈百分比边界属性测试
    - **Property 10: Trailing Stop Percent Bounds**
    - 测试配置值被限制在有效范围
    - **Validates: Requirements 3.7**

- [x] 8. 实现季节性风险服务
  - [x] 8.1 创建 seasonalRiskService.ts
    - 创建 `client/src/services/seasonalRiskService.ts`
    - 分析历史月度收益识别弱势月份
    - 实现季节性风险提醒
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x]* 8.2 编写季节性风险检测属性测试
    - **Property 16: Seasonal Risk Detection**
    - 测试弱势月份正确识别和提醒
    - **Validates: Requirements 7.1, 7.2**

- [x] 9. Checkpoint - 服务层完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 10. 实现风控中心页面
  - [x] 10.1 创建 RiskCenter 页面
    - 创建 `client/src/pages/RiskCenter.tsx`
    - 添加到路由配置
    - _Requirements: 5.1_
  - [x] 10.2 创建 RiskMetricCard 组件
    - 创建 `client/src/components/risk/RiskMetricCard.tsx`
    - 显示单个风控指标（杠杆/回撤/HWM/连败）
    - 实现颜色编码和动画效果
    - _Requirements: 5.2, 5.3, 5.4_
  - [x] 10.3 创建 RiskRulesPanel 组件
    - 创建 `client/src/components/risk/RiskRulesPanel.tsx`
    - 显示所有风控规则及当前状态
    - _Requirements: 5.5_
  - [x] 10.4 创建 RiskLogList 组件
    - 创建 `client/src/components/risk/RiskLogList.tsx`
    - 显示最近的风控警报和熔断记录
    - _Requirements: 5.6_
  - [x] 10.5 创建 RiskScoreGauge 组件
    - 创建 `client/src/components/risk/RiskScoreGauge.tsx`
    - 显示综合风险评分仪表盘
    - _Requirements: 5.7_

- [x] 11. 实现风控设置页面
  - [x] 11.1 创建 RiskSettings 页面
    - 创建 `client/src/pages/RiskSettings.tsx`
    - 实现阈值配置表单
    - 实现恢复默认值按钮
    - _Requirements: 6.1, 6.7_

- [x] 12. 实现警报组件
  - [x] 12.1 创建 LeverageBlockingModal 组件
    - 创建 `client/src/components/risk/LeverageBlockingModal.tsx`
    - 全屏阻断模态框，需手动确认
    - _Requirements: 1.4_
  - [x] 12.2 创建 CoolingPeriodBanner 组件
    - 创建 `client/src/components/risk/CoolingPeriodBanner.tsx`
    - 显示冷静期倒计时
    - _Requirements: 2.4_
  - [x] 12.3 创建 TradeConfirmationDialog 组件
    - 创建 `client/src/components/risk/TradeConfirmationDialog.tsx`
    - 连败期间新交易需确认
    - _Requirements: 4.7_
  - [x] 12.4 集成警报通知
    - 复用现有 riskAlertService.ts
    - 添加音频通知支持
    - _Requirements: 1.2, 1.3_

- [x] 13. 集成到现有页面
  - [x] 13.1 集成到 Dashboard
    - 添加风控指标卡片
    - 添加风控中心入口
    - _Requirements: 1.1, 5.2_
  - [x] 13.2 集成到交易流程
    - 在下单前检查杠杆限制
    - 在连败期间显示确认对话框
    - _Requirements: 1.5, 4.7_

- [x] 14. 实现风控报告
  - [x] 14.1 创建 riskReportService.ts
    - 创建 `client/src/services/riskReportService.ts`
    - 实现周报生成（每周日）
    - 实现月报生成（每月1日）
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 14.2 创建 RiskReportViewer 组件
    - 创建 `client/src/components/risk/RiskReportViewer.tsx`
    - 显示历史风控报告
    - _Requirements: 8.4, 8.5_

- [x] 15. Final Checkpoint - 全部完成
  - 确保所有测试通过
  - 验证端到端流程：
    - 杠杆超限 → 警告/阻断
    - 月度回撤 → 冷静期
    - 连败 → 交易确认
  - 如有问题请询问用户

## Notes

- 任务标记 `*` 为可选测试任务，可跳过以加快 MVP 开发
- 每个属性测试引用设计文档中的正确性属性
- 复用现有服务：riskAlertService.ts、portfolioService.ts
- 风控规则应在客户端和服务端双重验证

## 文件结构

```
client/src/
├── services/
│   ├── riskMetricsService.ts      # 风控指标计算
│   ├── circuitBreakerService.ts   # 熔断机制
│   ├── monthlySnapshotService.ts  # 月度快照
│   ├── riskConfigService.ts       # 风控配置
│   ├── seasonalRiskService.ts     # 季节性风险
│   └── riskReportService.ts       # 风控报告
├── pages/
│   ├── RiskCenter.tsx             # 风控中心页面
│   └── RiskSettings.tsx           # 风控设置页面
└── components/risk/
    ├── RiskMetricCard.tsx         # 指标卡片
    ├── RiskRulesPanel.tsx         # 规则面板
    ├── RiskLogList.tsx            # 日志列表
    ├── RiskScoreGauge.tsx         # 评分仪表盘
    ├── LeverageBlockingModal.tsx  # 杠杆阻断模态框
    ├── CoolingPeriodBanner.tsx    # 冷静期横幅
    ├── TradeConfirmationDialog.tsx # 交易确认对话框
    └── RiskReportViewer.tsx       # 报告查看器
```

