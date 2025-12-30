# Requirements Document

## Introduction

实时行情平台是 RiskControl 系统的新增核心模块，旨在提供实时市场数据监控、智能警报触发和自动化风控响应能力。

### 数据源策略

基于现有系统架构和 OpenBB 集成方案，采用以下数据源策略：

| 优先级 | 数据源 | 用途 | 实现方式 |
|--------|--------|------|----------|
| 1 | **长桥 API** (Supabase live 表) | 港股/美股主数据源 | 保留现有实现 |
| 2 | **OpenBB Service** | 美股备用 | 通过 openbb-integration 服务 |
| 3 | **腾讯财经 API** | A股数据 | 保留现有实现 |

> **架构变更**：原有的 Finnhub/Yahoo/Polygon 直接调用已迁移到 `openbb-integration` 服务，本模块通过 OpenBB Client 统一调用。详见 `.kiro/specs/openbb-integration/`。

### 依赖关系

- **依赖**: `openbb-integration` - 提供统一的数据获取层
- **被依赖**: `risk-control-2026` - 消费实时行情数据
- **被依赖**: `qlib-analytics` - 消费历史行情数据

## Glossary

- **Realtime_Market_Service**: 实时行情服务，负责从多个数据源获取、聚合和分发实时市场数据
- **Price_Alert_Engine**: 价格警报引擎，监控价格变动并触发预设的警报规则
- **WebSocket_Gateway**: WebSocket 网关，提供实时数据推送能力
- **Alert_Rule**: 警报规则，用户定义的价格或指标触发条件
- **Market_Data_Aggregator**: 市场数据聚合器，整合多个数据源的行情数据
- **Risk_Integration_Layer**: 风控集成层，将实时数据与风控系统连接
- **Live_Quote**: 实时报价数据结构，包含价格、涨跌幅、成交量等
- **Alert_Notification**: 警报通知，通过多渠道（Toast、邮件、浏览器通知）发送的警报消息

## Requirements

### Requirement 1: 实时行情数据获取

**User Story:** As a 投资者, I want to 获取实时的股票行情数据, so that I can 及时了解持仓和关注标的的价格变动。

#### Acceptance Criteria

1. WHEN 用户打开应用 THEN THE Realtime_Market_Service SHALL 自动连接并开始获取实时行情数据
2. WHEN 数据源返回新的报价 THEN THE Market_Data_Aggregator SHALL 在 500ms 内更新本地缓存
3. WHILE 应用处于活跃状态 THE Realtime_Market_Service SHALL 每 5 秒刷新一次持仓标的的行情
4. WHILE 应用处于活跃状态 THE Realtime_Market_Service SHALL 每 30 秒刷新一次观察列表标的的行情
5. IF 主数据源（长桥 API/Supabase live 表）不可用 THEN THE Market_Data_Aggregator SHALL 自动切换到 OpenBB Service 备用数据源
6. WHEN 获取行情数据 THEN THE Realtime_Market_Service SHALL 返回包含 ticker、price、prevClose、changePercent、volume、timestamp 的 Live_Quote 结构
7. THE Realtime_Market_Service SHALL 通过 OpenBB Client 调用 openbb-integration 服务获取备用数据

### Requirement 2: WebSocket 实时推送

**User Story:** As a 投资者, I want to 通过 WebSocket 接收实时行情推送, so that I can 无需手动刷新即可看到最新价格。

#### Acceptance Criteria

1. WHEN 用户连接到 WebSocket_Gateway THEN THE WebSocket_Gateway SHALL 建立持久连接并开始推送订阅的标的行情
2. WHEN 行情数据更新 THEN THE WebSocket_Gateway SHALL 在 100ms 内将更新推送给所有订阅该标的的客户端
3. IF WebSocket 连接断开 THEN THE 客户端 SHALL 在 3 秒内自动重连
4. WHEN 重连成功 THEN THE WebSocket_Gateway SHALL 恢复之前的订阅状态
5. WHILE WebSocket 连接活跃 THE WebSocket_Gateway SHALL 每 30 秒发送心跳包以保持连接

### Requirement 3: 价格警报规则配置

**User Story:** As a 投资者, I want to 设置价格警报规则, so that I can 在价格达到目标时收到通知。

#### Acceptance Criteria

1. WHEN 用户创建价格警报 THEN THE Price_Alert_Engine SHALL 保存包含 ticker、条件类型、目标价格、通知方式的 Alert_Rule
2. THE Price_Alert_Engine SHALL 支持以下条件类型：价格高于、价格低于、涨幅超过、跌幅超过、突破均线
3. WHEN 用户编辑警报规则 THEN THE Price_Alert_Engine SHALL 立即更新监控条件
4. WHEN 用户删除警报规则 THEN THE Price_Alert_Engine SHALL 停止该规则的监控
5. THE Price_Alert_Engine SHALL 支持为每个标的设置多个不同条件的警报规则

### Requirement 4: 智能警报触发

**User Story:** As a 投资者, I want to 在满足警报条件时收到即时通知, so that I can 及时做出交易决策。

#### Acceptance Criteria

1. WHEN 实时价格满足 Alert_Rule 条件 THEN THE Price_Alert_Engine SHALL 在 1 秒内触发 Alert_Notification
2. WHEN 警报触发 THEN THE Alert_Notification SHALL 包含标的代码、当前价格、触发条件、触发时间
3. THE Alert_Notification SHALL 支持 Toast 通知、浏览器通知、邮件通知三种渠道
4. IF 同一规则在 5 分钟内重复触发 THEN THE Price_Alert_Engine SHALL 合并通知避免骚扰
5. WHEN 警报触发 THEN THE Price_Alert_Engine SHALL 记录触发历史到数据库

### Requirement 5: 风控系统集成

**User Story:** As a 投资者, I want to 实时行情与风控系统联动, so that I can 在风险指标异常时自动收到警告。

#### Acceptance Criteria

1. WHEN 实时行情更新 THEN THE Risk_Integration_Layer SHALL 重新计算杠杆率、回撤等风控指标
2. IF 杠杆率超过警戒线 THEN THE Risk_Integration_Layer SHALL 触发杠杆警报
3. IF 单日亏损超过阈值 THEN THE Risk_Integration_Layer SHALL 触发止损警报
4. WHEN 持仓市值变动超过 5% THEN THE Risk_Integration_Layer SHALL 更新仪表盘数据
5. THE Risk_Integration_Layer SHALL 支持基于实时数据的移动止盈计算

### Requirement 6: 行情数据持久化

**User Story:** As a 投资者, I want to 保存历史行情数据, so that I can 进行回测和分析。

#### Acceptance Criteria

1. WHEN 收到新的行情数据 THEN THE Realtime_Market_Service SHALL 将数据写入 Supabase live 表
2. THE live 表 SHALL 保存最近 7 天的分钟级行情数据
3. WHEN 数据超过 7 天 THEN THE Realtime_Market_Service SHALL 自动清理过期数据
4. THE Realtime_Market_Service SHALL 支持查询指定时间范围的历史行情

### Requirement 7: 行情数据展示

**User Story:** As a 投资者, I want to 在界面上直观地看到实时行情, so that I can 快速了解市场状况。

#### Acceptance Criteria

1. WHEN 行情数据更新 THEN THE 前端组件 SHALL 实时刷新显示最新价格
2. THE 前端组件 SHALL 使用颜色区分涨跌（红涨绿跌或绿涨红跌可配置）
3. WHEN 价格变动 THEN THE 前端组件 SHALL 显示闪烁动画提示变化
4. THE 前端组件 SHALL 显示涨跌幅百分比和涨跌金额
5. THE 前端组件 SHALL 支持迷你行情卡片和详细行情面板两种展示模式

### Requirement 8: 市场状态监控

**User Story:** As a 投资者, I want to 了解各市场的开盘状态, so that I can 知道何时可以交易。

#### Acceptance Criteria

1. THE Realtime_Market_Service SHALL 显示美股、港股、A股的当前交易状态（盘前、盘中、盘后、休市）
2. WHEN 市场状态变化 THEN THE Realtime_Market_Service SHALL 更新状态指示器
3. THE Realtime_Market_Service SHALL 显示距离下一个交易时段的倒计时
4. IF 当前为非交易时段 THEN THE Realtime_Market_Service SHALL 显示最后收盘价而非实时价

### Requirement 9: 数据源健康监控

**User Story:** As a 系统管理员, I want to 监控数据源的健康状态, so that I can 及时发现和处理数据问题。

#### Acceptance Criteria

1. THE Realtime_Market_Service SHALL 记录每个数据源的请求成功率和延迟
2. IF 数据源连续 3 次请求失败 THEN THE Realtime_Market_Service SHALL 标记该数据源为不健康
3. WHEN 数据源恢复 THEN THE Realtime_Market_Service SHALL 自动重新启用
4. THE Realtime_Market_Service SHALL 提供数据源健康状态的 API 端点
5. WHEN 所有数据源不可用 THEN THE Realtime_Market_Service SHALL 发送紧急通知

### Requirement 10: 移动端适配

**User Story:** As a 移动端用户, I want to 在手机上查看实时行情和接收警报, so that I can 随时随地监控投资。

#### Acceptance Criteria

1. THE 前端组件 SHALL 在移动端提供响应式布局
2. WHEN 警报触发 THEN THE Alert_Notification SHALL 支持发送到 iOS/Android 推送通知
3. THE 移动端界面 SHALL 支持快速查看持仓和观察列表的实时行情
4. THE 移动端界面 SHALL 支持快速创建和管理价格警报
