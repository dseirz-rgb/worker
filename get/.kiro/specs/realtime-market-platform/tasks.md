# Implementation Plan: 实时行情平台

## Overview

基于 OpenBB 统一数据层和现有 `marketData.ts`、`riskAlertService.ts` 架构，增量实现实时行情平台功能。采用 TypeScript + React + Supabase 技术栈。

### 前置依赖

- **openbb-integration** spec 必须先完成，提供 OpenBB Client 和数据服务

## Tasks

- [x] 1. 数据库表结构创建
  - [x] 1.1 创建 price_alert_rules 表
    - 创建 Supabase 迁移文件
    - 包含 id, user_id, ticker, condition_type, target_value, notification_channels, enabled, created_at, updated_at, last_triggered_at, cooldown_until 字段
    - _Requirements: 3.1, 4.5_
  - [x] 1.2 创建 price_alert_history 表
    - 创建 Supabase 迁移文件
    - 包含 id, rule_id, ticker, triggered_price, condition_type, target_value, triggered_at, notification_sent, notification_channels 字段
    - _Requirements: 4.5_

- [x] 2. 集成 OpenBB Client 到 Market Data Aggregator
  - [x] 2.1 导入 OpenBB Client
    - 在 `client/src/services/marketData.ts` 中导入 `openbbClient`
    - 将 OpenBB 作为美股备用数据源（优先级 2）
    - 保留长桥 API 作为主数据源（优先级 1）
    - 保留腾讯财经作为 A 股数据源
    - _Requirements: 1.5, 1.7_
  - [x] 2.2 简化数据源配置
    - 移除 Finnhub/Yahoo/Polygon 直接调用代码
    - 更新 DataSource 类型为 'longport' | 'openbb' | 'tencent'
    - _Requirements: 1.5_
  - [x] 2.3 添加数据源健康监控
    - 实现 DataSourceMetrics 接口
    - 实现请求成功率和延迟追踪
    - 实现连续失败计数和健康状态判断
    - _Requirements: 9.1, 9.2_
  - [x] 2.4 编写数据源健康监控属性测试
    - **Property 9: 数据源健康状态追踪**
    - **Validates: Requirements 9.1, 9.2**
  - [x] 2.5 实现数据源自动故障转移
    - 当长桥 API 连续失败 3 次后自动切换到 OpenBB
    - 实现数据源恢复检测和自动重新启用
    - _Requirements: 1.5, 9.3_
  - [x] 2.6 编写数据源故障转移属性测试
    - **Property 2: 数据源故障转移**
    - **Validates: Requirements 1.5, 9.2, 9.3**

- [x] 3. Checkpoint - 数据层完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 4. 实现 Price Alert Engine
  - [x] 4.1 创建 priceAlertService.ts
    - 创建 `client/src/services/priceAlertService.ts`
    - 实现 AlertRule 和 AlertConditionType 类型定义
    - 实现 createRule, updateRule, deleteRule, getRules 方法
    - 与 Supabase price_alert_rules 表交互
    - _Requirements: 3.1, 3.3, 3.4, 3.5_
  - [x] 4.2 编写警报规则 CRUD 属性测试
    - **Property 3: 警报规则 CRUD 一致性**
    - **Validates: Requirements 3.1, 3.3, 3.4**
  - [x] 4.3 实现警报条件评估逻辑
    - 实现 evaluateRule 方法，支持 price_above, price_below, change_above, change_below, break_ma 条件
    - 实现 evaluateRules 批量评估方法
    - _Requirements: 3.2, 4.1_
  - [x] 4.4 编写警报条件评估属性测试
    - **Property 4: 警报条件评估正确性**
    - **Validates: Requirements 4.1, 3.2**
  - [x] 4.5 实现警报去重机制
    - 实现 5 分钟冷却期逻辑
    - 更新 cooldown_until 字段
    - _Requirements: 4.4_
  - [x] 4.6 编写警报去重属性测试
    - **Property 6: 警报去重机制**
    - **Validates: Requirements 4.4**
  - [x] 4.7 实现警报通知发送
    - 复用现有 riskAlertService.ts 的通知逻辑
    - 支持 Toast、浏览器通知、邮件三种渠道
    - 确保通知包含 ticker、price、condition、timestamp
    - _Requirements: 4.2, 4.3_
  - [x] 4.8 编写警报通知完整性属性测试
    - **Property 5: 警报通知完整性**
    - **Validates: Requirements 4.2**
  - [x] 4.9 实现警报历史记录
    - 触发警报时写入 price_alert_history 表
    - 实现 getAlertHistory 查询方法
    - _Requirements: 4.5_

- [x] 5. Checkpoint - 警报引擎完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 6. 实现 Risk Integration Layer
  - [x] 6.1 创建 riskIntegrationService.ts
    - 创建 `client/src/services/riskIntegrationService.ts`
    - 实现 onQuoteUpdate 方法，接收实时行情更新
    - 实现 getRealTimeMetrics 方法，返回实时风控指标
    - _Requirements: 5.1_
  - [x] 6.2 实现风控阈值检查
    - 复用现有 riskMetricsService.ts 的阈值配置
    - 实现杠杆率超限检查
    - 实现单日亏损超限检查
    - 触发相应的风控警报
    - _Requirements: 5.2, 5.3_
  - [x] 6.3 编写风控阈值触发属性测试
    - **Property 7: 风控阈值触发**
    - **Validates: Requirements 5.2, 5.3**
  - [x] 6.4 实现移动止盈计算
    - 基于实时数据计算移动止盈线
    - 与现有 trailingStopLevel 逻辑集成
    - _Requirements: 5.5_

- [x] 7. 实现市场状态监控
  - [x] 7.1 创建 marketStatusService.ts
    - 创建 `client/src/services/marketStatusService.ts`
    - 实现 getMarketStatus 方法，返回美股/港股/A股状态
    - 实现 getNextTradingSession 方法，返回下一交易时段
    - 实现倒计时计算
    - _Requirements: 8.1, 8.3_
  - [x] 7.2 编写市场状态计算属性测试
    - **Property 8: 市场状态计算正确性**
    - **Validates: Requirements 8.1, 8.4**
  - [x] 7.3 实现非交易时段逻辑
    - 非交易时段显示最后收盘价
    - 与 Realtime Market Service 集成
    - _Requirements: 8.4_

- [x] 8. Checkpoint - 服务层完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 9. 实现 Realtime Market Service
  - [x] 9.1 创建 realtimeMarketService.ts
    - 创建 `client/src/services/realtimeMarketService.ts`
    - 实现订阅管理（subscribe, unsubscribe）
    - 实现高优先级（持仓）5秒刷新、普通优先级（观察列表）30秒刷新
    - _Requirements: 1.1, 1.3, 1.4_
  - [x] 9.2 实现数据更新回调
    - 实现 onDataUpdate 回调机制
    - 连接 Price Alert Engine 进行规则评估
    - 连接 Risk Integration Layer 进行风控计算
    - _Requirements: 1.2, 4.1, 5.1_
  - [x] 9.3 编写 Live Quote 结构完整性属性测试
    - **Property 1: Live Quote 结构完整性**
    - **Validates: Requirements 1.6**

- [x] 10. 实现 WebSocket Gateway (可选)
  - [x] 10.1 创建 websocketGateway.ts
    - 创建 `client/src/services/websocketGateway.ts`
    - 实现 WebSocket 连接管理
    - 实现自动重连逻辑（3秒内重连）
    - 实现心跳机制（30秒间隔）
    - _Requirements: 2.1, 2.3, 2.5_
  - [x] 10.2 实现订阅状态恢复
    - 重连后恢复之前的订阅状态
    - _Requirements: 2.4_
  - [x]* 10.3 编写 WebSocket 订阅状态恢复属性测试
    - **Property 10: WebSocket 订阅状态恢复**
    - **Validates: Requirements 2.4**
  - _Note: WebSocket Gateway 为可选功能，当前使用轮询方式实现_

- [x] 11. 实现前端组件
  - [x] 11.1 创建 LiveQuoteCard 组件
    - 创建 `client/src/components/market/LiveQuoteCard.tsx`
    - 显示实时价格、涨跌幅、涨跌金额
    - 实现涨跌颜色区分
    - 实现价格变动闪烁动画
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 11.2 创建 AlertRulePanel 组件
    - 创建 `client/src/components/market/AlertRulePanel.tsx`
    - 实现警报规则列表展示
    - 实现创建/编辑/删除警报规则
    - _Requirements: 3.1, 3.3, 3.4_
  - [x] 11.3 创建 MarketStatusIndicator 组件
    - 创建 `client/src/components/market/MarketStatusIndicator.tsx`
    - 显示美股/港股/A股交易状态
    - 显示倒计时
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 11.4 创建 useRealtimeQuotes Hook
    - 创建 `client/src/hooks/useRealtimeQuotes.ts`
    - 封装 Realtime Market Service 订阅逻辑
    - 提供响应式的实时行情数据
    - _Requirements: 1.1, 7.1_

- [x] 12. 集成到现有页面
  - [x] 12.1 集成到 Portfolio 页面
    - 在持仓列表中显示实时行情
    - 添加价格警报入口
    - _Requirements: 7.1, 3.1_
  - [x] 12.2 集成到 Dashboard 页面
    - 添加市场状态指示器
    - 显示实时风控指标
    - _Requirements: 8.1, 5.4_

- [x] 13. Final Checkpoint - 全部完成
  - 确保所有测试通过
  - 验证端到端流程：创建警报 → 价格变动 → 触发通知
  - 如有问题请询问用户

## Notes

- 任务标记 `*` 为可选测试任务，可跳过以加快 MVP 开发
- 每个属性测试引用设计文档中的正确性属性
- WebSocket Gateway (任务 10) 为可选功能，可先使用轮询方式实现
- 复用现有服务：marketData.ts、riskAlertService.ts、riskMetricsService.ts
