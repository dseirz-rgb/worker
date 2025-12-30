# Requirements Document

## Introduction

OpenBB Integration 是 RiskControl 系统的统一数据获取层，通过集成 OpenBB Platform 提供标准化的多数据源金融数据访问能力。本模块将替代现有 `marketData.ts` 中分散的数据源实现，提供更稳定、更丰富的数据支持。

### 数据源策略

| 优先级 | 数据源 | 用途 | 实现方式 |
|--------|--------|------|----------|
| 1 | **长桥 API** | 港股/美股主数据源 | 保留现有实现 (Supabase live 表) |
| 2 | **OpenBB (FMP)** | 美股备用 | OpenBB Provider |
| 3 | **OpenBB (Polygon)** | 美股补充 | OpenBB Provider |
| 4 | **OpenBB (Yahoo)** | 最终备用 | OpenBB Provider |
| 5 | **腾讯财经 API** | A股数据 | 保留现有实现 |

### 与现有系统的关系

- **替代**: `marketData.ts` 中的 Finnhub/Yahoo/Polygon 直接调用
- **保留**: 长桥 API 集成（OpenBB 不支持）、腾讯财经 API（A股）
- **新增**: OpenBB FastAPI 服务、统一数据格式、更多数据类型

## Glossary

- **OpenBB_Service**: OpenBB 数据服务，运行 OpenBB FastAPI Server 提供 REST API
- **Data_Provider**: 数据提供商，如 FMP、Polygon、Yahoo Finance 等
- **Quote_Normalizer**: 报价标准化器，将不同数据源的格式统一为 LiveQuote
- **Provider_Router**: 数据源路由器，根据优先级和健康状态选择数据源
- **Health_Monitor**: 健康监控器，追踪各数据源的可用性和延迟
- **Cache_Layer**: 缓存层，减少重复请求，提高响应速度
- **Fundamental_Data**: 基本面数据，包括财务报表、估值指标等
- **Economic_Data**: 宏观经济数据，包括 GDP、CPI、利率等

## Requirements

### Requirement 1: OpenBB 服务部署

**User Story:** As a 开发者, I want to 部署 OpenBB FastAPI 服务, so that I can 通过统一的 API 获取多源金融数据。

#### Acceptance Criteria

1. THE OpenBB_Service SHALL 运行在独立的 Python 进程中，监听指定端口（默认 6900）
2. WHEN 服务启动 THEN THE OpenBB_Service SHALL 加载所有已配置的 Data_Provider 凭证
3. THE OpenBB_Service SHALL 提供 `/api/v1/equity/price/quote` 端点获取实时报价
4. THE OpenBB_Service SHALL 提供 `/api/v1/equity/price/historical` 端点获取历史价格
5. THE OpenBB_Service SHALL 提供 `/docs` 端点展示 OpenAPI 文档
6. IF 服务异常退出 THEN THE OpenBB_Service SHALL 自动重启（通过 PM2 或 systemd）
7. THE OpenBB_Service SHALL 支持通过环境变量配置 API 密钥

### Requirement 2: 数据源路由与故障转移

**User Story:** As a 系统, I want to 自动选择最优数据源, so that I can 确保数据获取的高可用性。

#### Acceptance Criteria

1. THE Provider_Router SHALL 按优先级顺序尝试数据源：长桥 → FMP → Polygon → Yahoo
2. WHEN 主数据源请求失败 THEN THE Provider_Router SHALL 自动切换到下一优先级数据源
3. IF 数据源连续失败 3 次 THEN THE Health_Monitor SHALL 标记该数据源为不健康
4. WHEN 不健康的数据源恢复 THEN THE Health_Monitor SHALL 在 5 分钟后重新启用
5. THE Provider_Router SHALL 记录每次数据源切换的原因和时间
6. THE Provider_Router SHALL 支持为不同市场（美股/港股/A股）配置不同的数据源优先级

### Requirement 3: 报价数据标准化

**User Story:** As a 前端开发者, I want to 获取统一格式的报价数据, so that I can 不关心底层数据源的差异。

#### Acceptance Criteria

1. THE Quote_Normalizer SHALL 将所有数据源的报价转换为统一的 LiveQuote 格式
2. THE LiveQuote SHALL 包含以下必需字段：ticker, price, prevClose, changePercent, volume, timestamp, source, market, currency
3. WHEN 数据源返回的字段缺失 THEN THE Quote_Normalizer SHALL 使用合理的默认值或标记为 null
4. THE Quote_Normalizer SHALL 正确处理不同数据源的时间戳格式（Unix/ISO/自定义）
5. THE Quote_Normalizer SHALL 正确处理不同数据源的价格精度（2-4 位小数）
6. THE Quote_Normalizer SHALL 标记数据来源，便于调试和监控

### Requirement 4: 缓存机制

**User Story:** As a 系统, I want to 缓存频繁请求的数据, so that I can 减少 API 调用次数和响应延迟。

#### Acceptance Criteria

1. THE Cache_Layer SHALL 缓存实时报价数据，TTL 为 5 秒
2. THE Cache_Layer SHALL 缓存历史价格数据，TTL 为 5 分钟
3. THE Cache_Layer SHALL 缓存基本面数据，TTL 为 1 小时
4. WHEN 缓存命中 THEN THE 系统 SHALL 直接返回缓存数据，不调用外部 API
5. THE Cache_Layer SHALL 支持手动清除指定 ticker 的缓存
6. THE Cache_Layer SHALL 记录缓存命中率指标

### Requirement 5: 历史价格数据

**User Story:** As a 投资者, I want to 获取股票的历史价格数据, so that I can 进行技术分析和回测。

#### Acceptance Criteria

1. THE OpenBB_Service SHALL 支持获取日线、周线、月线历史数据
2. THE OpenBB_Service SHALL 支持指定时间范围查询（start_date, end_date）
3. THE OpenBB_Service SHALL 返回包含 date, open, high, low, close, volume 的 OHLCV 数据
4. THE OpenBB_Service SHALL 支持获取最近 N 个交易日的数据（默认 30 天）
5. IF 请求的时间范围超过数据源限制 THEN THE OpenBB_Service SHALL 返回可用的最大范围并标记

### Requirement 6: 基本面数据

**User Story:** As a 投资者, I want to 获取股票的基本面数据, so that I can 进行价值分析。

#### Acceptance Criteria

1. THE OpenBB_Service SHALL 提供公司概况数据（名称、行业、市值、员工数）
2. THE OpenBB_Service SHALL 提供估值指标（PE、PB、PS、EV/EBITDA）
3. THE OpenBB_Service SHALL 提供财务指标（ROE、ROA、毛利率、净利率）
4. THE OpenBB_Service SHALL 提供股息数据（股息率、派息历史）
5. WHEN 基本面数据不可用 THEN THE OpenBB_Service SHALL 返回空对象而非错误

### Requirement 7: 宏观经济数据

**User Story:** As a 投资者, I want to 获取宏观经济数据, so that I can 了解市场大环境。

#### Acceptance Criteria

1. THE OpenBB_Service SHALL 提供美国 GDP 数据
2. THE OpenBB_Service SHALL 提供 CPI/通胀数据
3. THE OpenBB_Service SHALL 提供美联储利率数据
4. THE OpenBB_Service SHALL 提供失业率数据
5. THE OpenBB_Service SHALL 支持获取历史经济数据序列

### Requirement 8: TypeScript 客户端

**User Story:** As a 前端开发者, I want to 使用 TypeScript 客户端调用 OpenBB 服务, so that I can 获得类型安全和自动补全。

#### Acceptance Criteria

1. THE 客户端 SHALL 提供类型安全的 API 调用方法
2. THE 客户端 SHALL 自动处理请求重试和超时
3. THE 客户端 SHALL 提供 Promise-based 的异步接口
4. THE 客户端 SHALL 支持批量获取多个 ticker 的数据
5. THE 客户端 SHALL 与现有 `marketData.ts` 接口兼容，支持渐进式迁移

### Requirement 9: 健康检查与监控

**User Story:** As a 运维人员, I want to 监控 OpenBB 服务的健康状态, so that I can 及时发现和处理问题。

#### Acceptance Criteria

1. THE OpenBB_Service SHALL 提供 `/health` 端点返回服务状态
2. THE Health_Monitor SHALL 记录每个数据源的请求成功率
3. THE Health_Monitor SHALL 记录每个数据源的平均响应延迟
4. THE Health_Monitor SHALL 提供 `/metrics` 端点返回监控指标
5. WHEN 所有数据源不可用 THEN THE Health_Monitor SHALL 触发紧急告警

### Requirement 10: API 密钥管理

**User Story:** As a 开发者, I want to 安全地管理 API 密钥, so that I can 保护敏感凭证。

#### Acceptance Criteria

1. THE OpenBB_Service SHALL 从环境变量读取 API 密钥
2. THE OpenBB_Service SHALL 支持 .env 文件配置（开发环境）
3. THE OpenBB_Service SHALL 不在日志中输出 API 密钥
4. THE OpenBB_Service SHALL 在启动时验证必需的 API 密钥是否配置
5. IF API 密钥无效 THEN THE OpenBB_Service SHALL 标记对应数据源为不可用

