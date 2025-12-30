# Requirements Document: Intelligent Risk Engine

## Introduction

Intelligent Risk Engine 是 RiskControl 系统的智能风控决策层，基于 Qlib Analytics 的预测结果，实现动态风控阈值调整、AI 风险预警和仓位优化建议。这是整个系统的"大脑"，将量化分析转化为可执行的风控决策。

### 依赖关系

- **依赖**: `qlib-analytics` - 提供波动率预测、回撤概率、市场状态等输入
- **依赖**: `risk-control-2026` - 提供基础风控规则和阈值配置
- **依赖**: `realtime-market-platform` - 提供实时行情数据

### 核心价值

1. **动态适应**：风控阈值随市场状态自动调整，而非固定值
2. **预测性预警**：提前预警风险，而非事后响应
3. **智能建议**：基于风险预算提供仓位优化建议
4. **行为分析**：检测情绪化交易，提供冷静期建议

## Glossary

- **Dynamic_Leverage_Controller**: 动态杠杆控制器，根据市场状态调整杠杆限制
- **Dynamic_StopLoss_Manager**: 动态止损管理器，根据波动率调整止损线
- **Risk_Forecaster**: 风险预测器，预测未来 1/3/5 天的风险水平
- **Position_Optimizer**: 仓位优化器，基于风险预算建议最优配置
- **Emotional_Trading_Detector**: 情绪化交易检测器，识别非理性交易行为
- **Risk_Decision_Engine**: 风险决策引擎，综合各模块输出做出最终决策
- **Risk_Alert**: 风险警报，包含风险类型、严重程度、建议操作

## Requirements

### Requirement 1: 动态杠杆限制

**User Story:** As a 投资者, I want to 杠杆限制能根据市场状态自动调整, so that 在高风险时期自动降低杠杆保护本金。

#### Acceptance Criteria

1. WHEN 市场状态为 bull THEN THE Dynamic_Leverage_Controller SHALL 允许最高 1.5x 杠杆
2. WHEN 市场状态为 sideways THEN THE Dynamic_Leverage_Controller SHALL 允许最高 1.3x 杠杆
3. WHEN 市场状态为 bear 或 high_volatility THEN THE Dynamic_Leverage_Controller SHALL 允许最高 1.0x 杠杆（禁止杠杆）
4. WHEN 预测波动率超过历史 80 分位 THEN THE Dynamic_Leverage_Controller SHALL 额外降低 0.2x 杠杆限制
5. THE Dynamic_Leverage_Controller SHALL 在市场状态变化后 1 小时内更新杠杆限制
6. WHEN 杠杆限制变化 THEN THE 系统 SHALL 通知用户并记录变更历史

### Requirement 2: 动态止损线

**User Story:** As a 投资者, I want to 止损线能根据波动率自动调整, so that 在高波动时期有更大的容错空间。

#### Acceptance Criteria

1. WHEN 预测波动率低于历史 30 分位 THEN THE Dynamic_StopLoss_Manager SHALL 设置止损线为 -8%
2. WHEN 预测波动率在历史 30-70 分位 THEN THE Dynamic_StopLoss_Manager SHALL 设置止损线为 -10%
3. WHEN 预测波动率高于历史 70 分位 THEN THE Dynamic_StopLoss_Manager SHALL 设置止损线为 -12%
4. WHEN 预测波动率高于历史 90 分位 THEN THE Dynamic_StopLoss_Manager SHALL 设置止损线为 -15%
5. THE Dynamic_StopLoss_Manager SHALL 支持用户自定义止损线范围（最小 -5%，最大 -20%）
6. WHEN 止损线变化 THEN THE 系统 SHALL 通知用户并显示调整原因

### Requirement 3: 风险预警系统

**User Story:** As a 投资者, I want to 提前收到风险预警, so that I can 在风险发生前采取行动。

#### Acceptance Criteria

1. THE Risk_Forecaster SHALL 每日生成未来 1/3/5 天的风险预测报告
2. IF 预测 5 天内回撤概率 >10% 超过 50% THEN THE Risk_Forecaster SHALL 触发"中等风险"预警
3. IF 预测 5 天内回撤概率 >15% 超过 30% THEN THE Risk_Forecaster SHALL 触发"高风险"预警
4. IF 市场状态即将从 bull 转为 bear（转换概率 >40%）THEN THE Risk_Forecaster SHALL 触发"趋势转换"预警
5. WHEN 风险预警触发 THEN THE 系统 SHALL 通过 Toast、邮件、推送通知用户
6. THE Risk_Forecaster SHALL 提供预警的置信度和建议操作

### Requirement 4: 仓位优化建议

**User Story:** As a 投资者, I want to 获得基于风险预算的仓位建议, so that I can 优化投资组合的风险收益比。

#### Acceptance Criteria

1. THE Position_Optimizer SHALL 基于用户设定的风险预算（如最大回撤 10%）计算最优仓位
2. WHEN 当前仓位偏离最优配置超过 20% THEN THE Position_Optimizer SHALL 生成调仓建议
3. THE Position_Optimizer SHALL 考虑各标的的相关性，避免过度集中
4. THE Position_Optimizer SHALL 提供"保守"、"平衡"、"激进"三种配置方案
5. WHEN 市场状态变化 THEN THE Position_Optimizer SHALL 重新计算最优配置
6. THE Position_Optimizer SHALL 显示调仓前后的预期风险指标变化

### Requirement 5: 情绪化交易检测

**User Story:** As a 投资者, I want to 系统能识别我的情绪化交易行为, so that I can 避免在冲动下做出错误决策。

#### Acceptance Criteria

1. THE Emotional_Trading_Detector SHALL 检测以下情绪化交易模式：
   - 连续亏损后加大仓位（报复性交易）
   - 短时间内频繁交易（过度交易）
   - 大幅偏离既定策略（恐慌/贪婪）
2. WHEN 检测到情绪化交易 THEN THE 系统 SHALL 显示警告并建议冷静期
3. THE Emotional_Trading_Detector SHALL 提供交易行为分析报告
4. THE 系统 SHALL 支持用户设置"冷静期"，在此期间禁止交易
5. THE Emotional_Trading_Detector SHALL 记录检测历史用于自我反思

### Requirement 6: 风险决策引擎

**User Story:** As a 系统, I want to 综合各模块输出做出最终风控决策, so that 风控措施协调一致。

#### Acceptance Criteria

1. THE Risk_Decision_Engine SHALL 综合杠杆控制、止损管理、风险预警、仓位建议的输出
2. WHEN 多个模块输出冲突 THEN THE Risk_Decision_Engine SHALL 采用最保守的决策
3. THE Risk_Decision_Engine SHALL 生成统一的风控状态报告
4. THE Risk_Decision_Engine SHALL 支持手动覆盖自动决策（需要确认）
5. THE Risk_Decision_Engine SHALL 记录所有决策和覆盖操作用于审计

### Requirement 7: 风险仪表盘

**User Story:** As a 投资者, I want to 在仪表盘上看到综合风险状态, so that I can 快速了解当前风险水平。

#### Acceptance Criteria

1. THE 仪表盘 SHALL 显示当前风险等级（低/中/高/极高）
2. THE 仪表盘 SHALL 显示动态杠杆限制和当前杠杆率
3. THE 仪表盘 SHALL 显示动态止损线和当前回撤
4. THE 仪表盘 SHALL 显示未来风险预测（1/3/5 天）
5. THE 仪表盘 SHALL 显示最新的风险预警和建议操作
6. THE 仪表盘 SHALL 支持查看风险历史趋势

### Requirement 8: 风险报告

**User Story:** As a 投资者, I want to 定期收到风险分析报告, so that I can 回顾和改进我的风险管理。

#### Acceptance Criteria

1. THE 系统 SHALL 每周生成风险分析周报
2. THE 周报 SHALL 包含：本周风险事件、预警准确率、决策执行情况
3. THE 系统 SHALL 每月生成风险分析月报
4. THE 月报 SHALL 包含：风险趋势分析、模型性能评估、改进建议
5. THE 报告 SHALL 支持 PDF 导出和邮件发送

### Requirement 9: 配置管理

**User Story:** As a 投资者, I want to 自定义风控参数, so that 系统能适应我的风险偏好。

#### Acceptance Criteria

1. THE 系统 SHALL 支持配置风险偏好（保守/平衡/激进）
2. THE 系统 SHALL 支持配置最大可接受回撤
3. THE 系统 SHALL 支持配置预警通知渠道和频率
4. THE 系统 SHALL 支持配置冷静期时长
5. THE 系统 SHALL 提供配置模板和推荐值

### Requirement 10: API 集成

**User Story:** As a 开发者, I want to 通过 API 获取智能风控决策, so that I can 集成到其他系统。

#### Acceptance Criteria

1. THE 系统 SHALL 提供 RESTful API 获取当前风控状态
2. THE 系统 SHALL 提供 WebSocket 推送风控决策变更
3. THE API SHALL 返回决策依据和置信度
4. THE API SHALL 支持查询历史决策记录
5. THE API SHALL 提供 TypeScript 客户端 SDK
