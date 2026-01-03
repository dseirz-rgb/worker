# Implementation Plan: API Integration

## Overview

将 Echo 前端投资模块与后端服务层进行联调，实现真实数据流通，并验证所有页面功能。

## Phase 1: 环境配置

- [x] 1. 环境变量配置
  - [x] 1.1 更新 InvestmentStore 使用正确的环境变量
    - 将 `VITE_RC_SUPABASE_URL` 改为 `VITE_SUPABASE_URL`
    - 将 `VITE_RC_SUPABASE_ANON_KEY` 改为 `VITE_SUPABASE_ANON_KEY`
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 编写数据库初始化属性测试
    - **Property 1: 数据库初始化正确性**
    - **Validates: Requirements 1.1, 1.4**

- [x] 2. Checkpoint - 确保数据库连接正常
  - 验证 DualDatabaseClient 初始化成功
  - 验证可以查询 positions 表

## Phase 2: 数据获取验证

- [x] 3. 持仓数据获取
  - [x] 3.1 验证 fetchPositions 方法
    - 确认从 RiskControl 数据库获取数据
    - 确认字段映射正确（snake_case → camelCase）
    - _Requirements: 2.1, 2.2_
  - [x] 3.2 编写持仓数据映射属性测试
    - **Property 2: 持仓数据映射正确性**
    - **Validates: Requirements 2.2**

- [x] 4. 风险指标获取
  - [x] 4.1 验证 fetchRiskMetrics 方法
    - 确认从 dashboard_snapshots 表获取数据
    - 确认 CircuitBreakerService 正确评估风险
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 5. 价格警报获取
  - [x] 5.1 验证 fetchAlerts 方法
    - 确认从 price_alerts 表获取数据
    - 确认警报 CRUD 操作正常
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 5.2 编写警报徽章属性测试
    - **Property 3: 警报徽章计数准确性**
    - **Validates: Requirements 4.4**

- [x] 6. Checkpoint - 确保数据获取正常
  - 验证 positions、riskMetrics、alerts 都能正确获取
  - 验证错误处理正常

## Phase 3: 浏览器功能测试

- [x] 7. Dashboard 页面测试
  - [x] 7.1 访问 /investment 页面
    - 检查页面加载无错误
    - 检查资产概览卡片显示
    - 检查风险指标卡片显示
    - _Requirements: 7.1_

- [x] 8. Portfolio 页面测试
  - [x] 8.1 访问 /investment/portfolio 页面
    - 检查持仓表格渲染
    - 检查排序功能
    - 检查筛选功能
    - 检查响应式布局（移动端卡片视图）
    - _Requirements: 7.2_

- [x] 9. Risk 页面测试
  - [x] 9.1 访问 /investment/risk 页面
    - 检查风险评分显示
    - 检查熔断状态卡片
    - _Requirements: 7.3_
  - [x] 9.2 访问 /investment/risk/intelligent 页面
    - 检查情绪检测面板
    - _Requirements: 7.3_
  - [x] 9.3 访问 /investment/risk/engine 页面
    - 检查熔断规则配置
    - _Requirements: 7.3_
  - [x] 9.4 访问 /investment/risk/settings 页面
    - 检查阈值配置表单
    - _Requirements: 7.3_

- [x] 10. Market 页面测试
  - [x] 10.1 访问 /investment/market 页面
    - 检查市场指数显示
    - 检查新闻列表（使用 Serper API）
    - _Requirements: 7.4_

- [x] 11. Decision 页面测试
  - [x] 11.1 访问 /investment/decision 页面
    - 检查 AI 对话框
    - 检查 Gemini API 连接
    - _Requirements: 7.5_

- [x] 12. Voice 页面测试
  - [x] 12.1 访问 /investment/voice 页面
    - 检查 LiveKit 连接状态
    - _Requirements: 7.6_

- [x] 13. 辅助页面测试
  - [x] 13.1 访问 /investment/mirror 页面
    - 检查 Placeholder UI
  - [x] 13.2 访问 /investment/notes 页面
    - 检查笔记列表
  - [x] 13.3 访问 /investment/annual-review 页面
    - 检查年度统计
  - [x] 13.4 访问 /investment/showcase 页面
    - 检查 HeroUI 组件演示
  - [x] 13.5 访问 /investment/agent-demo 页面
    - 检查 AI 对话演示

- [x] 14. Checkpoint - 所有页面功能验证完成
  - 确保所有 14 个页面无控制台错误
  - 确保所有页面 UI 正常渲染

## Phase 4: 错误处理验证

- [x] 15. 错误处理测试
  - [x] 15.1 测试数据库连接失败场景
    - 断开网络，验证错误提示
    - _Requirements: 8.1_
  - [x] 15.2 测试空数据场景
    - 清空 positions 表，验证空状态显示
    - _Requirements: 2.4_

- [x] 16. Final Checkpoint - 联调完成
  - 所有数据获取正常
  - 所有页面功能正常
  - 错误处理正常

## Notes

- 所有任务都必须执行（全面测试）
- 浏览器测试需要启动 Echo 前端 (`npm run dev`)
- 访问 http://localhost:1111/investment 进行测试
- 检查浏览器控制台无错误

