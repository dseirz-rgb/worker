# Requirements Document

## Introduction

将 Echo 前端投资模块与后端服务层（packages/shared）进行联调，实现真实数据流通。当前状态：前端页面已迁移完成（14 个页面），后端服务已实现（279 tests passed），但前端仍使用 mock 数据或未连接到真实 API。

## Glossary

- **InvestmentStore**: Echo 前端的 MobX Store，管理投资模块状态
- **DualDatabaseClient**: 双数据库客户端，连接 Echo 和 RiskControl 两个 Supabase 实例
- **CircuitBreakerService**: 熔断服务，检查风险指标并触发熔断
- **PriceAlertService**: 价格警报服务，管理警报规则和触发
- **WebSocketGateway**: WebSocket 网关，提供实时数据推送
- **API_Gateway**: API 网关，路由请求到正确的后端服务

## Requirements

### Requirement 1: 数据库连接配置

**User Story:** As a developer, I want the frontend to connect to real Supabase databases, so that users can see their actual investment data.

#### Acceptance Criteria

1. WHEN the application starts, THE InvestmentStore SHALL initialize DualDatabaseClient with correct environment variables
2. THE System SHALL use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for database connection
3. IF database connection fails, THEN THE System SHALL display a user-friendly error message
4. THE System SHALL support both Echo and RiskControl database connections simultaneously

### Requirement 2: 持仓数据获取

**User Story:** As a user, I want to see my real portfolio positions, so that I can track my investments accurately.

#### Acceptance Criteria

1. WHEN the Portfolio page loads, THE System SHALL fetch positions from RiskControl database
2. THE System SHALL display positions with correct market values, P&L, and weights
3. WHEN positions data changes in database, THE System SHALL reflect updates within 5 seconds
4. IF no positions exist, THEN THE System SHALL display an empty state message

### Requirement 3: 风险指标获取

**User Story:** As a user, I want to see real-time risk metrics, so that I can monitor my portfolio risk.

#### Acceptance Criteria

1. WHEN the Risk Center page loads, THE System SHALL fetch risk metrics from dashboard_snapshots table
2. THE CircuitBreakerService SHALL evaluate risk metrics and return trading decisions
3. THE System SHALL display circuit breaker states (open/closed/half-open)
4. WHEN risk metrics exceed thresholds, THE System SHALL display warning indicators

### Requirement 4: 价格警报管理

**User Story:** As a user, I want to manage price alerts, so that I can be notified of important price movements.

#### Acceptance Criteria

1. WHEN the user creates an alert, THE System SHALL persist it to the database
2. WHEN the user toggles an alert, THE System SHALL update the enabled status
3. WHEN the user deletes an alert, THE System SHALL remove it from the database
4. THE System SHALL display the correct active alert count in the sidebar badge

### Requirement 5: WebSocket 实时更新

**User Story:** As a user, I want to receive real-time price updates, so that I can react quickly to market changes.

#### Acceptance Criteria

1. WHEN the application starts, THE WebSocketGateway SHALL establish connection
2. THE System SHALL subscribe to price updates for user's positions
3. WHEN a price update is received, THE System SHALL update the UI immediately
4. IF WebSocket disconnects, THEN THE System SHALL attempt reconnection with exponential backoff
5. WHEN reconnected, THE System SHALL restore all previous subscriptions

### Requirement 6: 认证集成

**User Story:** As a user, I want my investment data to be protected, so that only I can access my portfolio.

#### Acceptance Criteria

1. WHEN accessing investment pages, THE System SHALL verify user authentication
2. IF user is not authenticated, THEN THE System SHALL redirect to login page
3. THE System SHALL pass authentication token to all API requests
4. WHEN session expires, THE System SHALL prompt user to re-authenticate

### Requirement 7: 页面功能验证

**User Story:** As a user, I want all investment pages to work correctly with real data, so that I can use the full functionality.

#### Acceptance Criteria

1. THE Dashboard page SHALL display real portfolio summary and risk overview
2. THE Portfolio page SHALL display real positions with sorting and filtering
3. THE Risk Center page SHALL display real risk metrics and circuit breaker states
4. THE Market Analysis page SHALL display real market data
5. THE Decision Center page SHALL integrate with AI services for recommendations
6. THE Voice page SHALL connect to LiveKit for voice interactions

### Requirement 8: 错误处理与降级

**User Story:** As a user, I want the application to handle errors gracefully, so that I can continue using other features when one service fails.

#### Acceptance Criteria

1. IF database query fails, THEN THE System SHALL display cached data if available
2. IF WebSocket connection fails, THEN THE System SHALL fall back to polling
3. IF AI service is unavailable, THEN THE System SHALL display a service unavailable message
4. THE System SHALL log all errors for debugging purposes

