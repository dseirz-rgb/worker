# Requirements Document

## Introduction

本功能将建立一个统一的 API 网关架构，将所有外部服务（Khoj、Janitor、Paperless、SeekDB）的 API 调用统一通过 Blinko 后端代理。这样可以：
- 消除 CORS 问题（前端只访问同源 API）
- 统一认证和授权
- 集中日志和监控
- 简化前端代码
- 为未来扩展打下基础

## Glossary

- **API_Gateway**: Blinko 后端作为统一入口，代理所有外部服务请求
- **Service_Client**: 后端服务客户端，封装与外部服务的通信
- **Service_Registry**: 服务注册表，管理所有外部服务的配置和状态
- **Health_Monitor**: 健康监控器，定期检查所有服务状态
- **Proxy_Router**: 代理路由器，将请求转发到对应的外部服务
- **Khoj_Service**: Khoj AI 知识助手服务 (端口 42110)
- **Janitor_Service**: Janitor AI 文件整理服务 (端口 8766)
- **Paperless_Service**: Paperless 文档管理服务 (端口 8000)
- **SeekDB_Service**: SeekDB 向量搜索服务 (端口 8765)

## Requirements

### Requirement 1: 服务注册与发现

**User Story:** As a developer, I want a centralized service registry, so that I can easily manage and discover all external services.

#### Acceptance Criteria

1. THE Service_Registry SHALL maintain a list of all registered external services
2. WHEN a service is registered, THE Service_Registry SHALL store its URL, health endpoint, and configuration
3. THE Service_Registry SHALL support dynamic service configuration through environment variables
4. WHEN the application starts, THE Service_Registry SHALL load service configurations from environment
5. THE Service_Registry SHALL provide an API to query service status and configuration

### Requirement 2: 健康监控

**User Story:** As a user, I want to see the status of all services at a glance, so that I know which features are available.

#### Acceptance Criteria

1. THE Health_Monitor SHALL periodically check the health of all registered services
2. WHEN a service health check fails, THE Health_Monitor SHALL mark the service as unavailable
3. THE Health_Monitor SHALL provide a unified health endpoint that returns all service statuses
4. WHEN a service becomes available after being unavailable, THE Health_Monitor SHALL update its status
5. THE Health_Monitor SHALL support configurable health check intervals per service

### Requirement 3: Khoj API 代理

**User Story:** As a user, I want to use Khoj features from within Blinko without CORS issues, so that I have a seamless experience.

#### Acceptance Criteria

1. THE Khoj_Proxy SHALL forward chat requests to Khoj server and return responses
2. THE Khoj_Proxy SHALL forward search requests to Khoj server and return results
3. THE Khoj_Proxy SHALL forward agent management requests to Khoj server
4. THE Khoj_Proxy SHALL forward automation requests to Khoj server
5. THE Khoj_Proxy SHALL support streaming responses for chat
6. IF Khoj service is unavailable, THEN THE Khoj_Proxy SHALL return appropriate error responses

### Requirement 4: Janitor API 代理

**User Story:** As a user, I want to use Janitor features through the unified API, so that file organization works reliably.

#### Acceptance Criteria

1. THE Janitor_Proxy SHALL forward file analysis requests to Janitor server
2. THE Janitor_Proxy SHALL forward organization requests to Janitor server
3. THE Janitor_Proxy SHALL forward configuration requests to Janitor server
4. THE Janitor_Proxy SHALL forward history requests to Janitor server
5. IF Janitor service is unavailable, THEN THE Janitor_Proxy SHALL return appropriate error responses

### Requirement 5: Paperless API 代理

**User Story:** As a user, I want to access Paperless documents through the unified API, so that document management is integrated.

#### Acceptance Criteria

1. THE Paperless_Proxy SHALL forward document list requests to Paperless server
2. THE Paperless_Proxy SHALL forward document search requests to Paperless server
3. THE Paperless_Proxy SHALL forward document upload requests to Paperless server
4. THE Paperless_Proxy SHALL forward document download requests to Paperless server
5. THE Paperless_Proxy SHALL handle Paperless authentication tokens
6. IF Paperless service is unavailable, THEN THE Paperless_Proxy SHALL return appropriate error responses

### Requirement 6: SeekDB API 代理

**User Story:** As a user, I want to use SeekDB search through the unified API, so that vector search is seamlessly integrated.

#### Acceptance Criteria

1. THE SeekDB_Proxy SHALL forward search requests to SeekDB server
2. THE SeekDB_Proxy SHALL forward ingest requests to SeekDB server
3. THE SeekDB_Proxy SHALL forward status requests to SeekDB server
4. IF SeekDB service is unavailable, THEN THE SeekDB_Proxy SHALL return appropriate error responses

### Requirement 7: 统一错误处理

**User Story:** As a developer, I want consistent error handling across all proxied services, so that the frontend can handle errors uniformly.

#### Acceptance Criteria

1. THE API_Gateway SHALL return consistent error response format for all services
2. WHEN a service is unavailable, THE API_Gateway SHALL return a 503 status with service name
3. WHEN a service returns an error, THE API_Gateway SHALL forward the error with context
4. THE API_Gateway SHALL log all errors with service name and request details
5. THE API_Gateway SHALL support retry logic for transient failures

### Requirement 8: 前端服务层重构

**User Story:** As a developer, I want the frontend to use a unified service layer, so that all API calls go through the gateway.

#### Acceptance Criteria

1. THE Frontend_Service_Layer SHALL provide a unified interface for all service calls
2. THE Frontend_Service_Layer SHALL automatically route requests through the API gateway
3. THE Frontend_Service_Layer SHALL handle service unavailability gracefully
4. THE Frontend_Service_Layer SHALL provide TypeScript types for all service responses
5. WHEN a service is unavailable, THE Frontend_Service_Layer SHALL show appropriate UI feedback

### Requirement 9: 配置管理

**User Story:** As a developer, I want to configure service endpoints through environment variables, so that deployment is flexible.

#### Acceptance Criteria

1. THE Configuration_Manager SHALL read service URLs from environment variables
2. THE Configuration_Manager SHALL provide default values for local development
3. THE Configuration_Manager SHALL support Docker network hostnames
4. THE Configuration_Manager SHALL validate configuration on startup
5. THE Configuration_Manager SHALL log configuration values (excluding secrets)

### Requirement 10: 服务状态 UI

**User Story:** As a user, I want to see service status in the UI, so that I know which features are available.

#### Acceptance Criteria

1. THE Service_Status_UI SHALL display the status of all registered services
2. THE Service_Status_UI SHALL update status in real-time
3. WHEN a service is unavailable, THE Service_Status_UI SHALL show a warning indicator
4. THE Service_Status_UI SHALL provide a way to manually refresh service status
5. THE Service_Status_UI SHALL show service details on hover/click
