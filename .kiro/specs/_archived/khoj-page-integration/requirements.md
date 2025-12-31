# Requirements Document

## Introduction

本功能在 Blinko 应用中添加一个独立的 Khoj 页面，将 Khoj 的 AI 对话功能直接集成到 Blinko 中。这是一个快速集成方案，目标是让用户能够在 Blinko 内直接使用 Khoj 的强大知识检索和对话能力，而无需切换应用。

### 集成策略

采用"页面嵌入"方式，分两个阶段：
1. **Phase 1 - iframe 嵌入**：直接嵌入 Khoj Web UI，最快实现
2. **Phase 2 - API 集成**：使用 Khoj API 构建原生 UI，更好的用户体验

## Glossary

- **Blinko**: 笔记和知识管理应用，本项目的主应用
- **Khoj**: 开源 AI 个人助手，提供知识管理和语义搜索能力
- **Khoj_Server**: Khoj 的后端服务，运行在 `http://localhost:42110`
- **Khoj_Web_UI**: Khoj 的 Web 界面，可通过 iframe 嵌入
- **Khoj_API**: Khoj 提供的 REST API 接口
- **Khoj_Page**: 在 Blinko 中新增的 Khoj 功能页面

## Requirements

### Requirement 1: Khoj 页面入口

**User Story:** As a user, I want to access Khoj from within Blinko, so that I can use Khoj's AI capabilities without leaving the app.

#### Acceptance Criteria

1. THE Blinko_Application SHALL provide a navigation entry for Khoj page
2. WHEN a user clicks the Khoj navigation item, THE Application SHALL navigate to the Khoj page
3. THE Khoj_Page SHALL be accessible at the `/khoj` route
4. THE Navigation_Item SHALL display an appropriate icon and label (e.g., "AI 助手" or "Khoj")

### Requirement 2: Khoj 服务连接

**User Story:** As a user, I want Blinko to connect to my local Khoj server, so that I can use Khoj's features.

#### Acceptance Criteria

1. THE Khoj_Page SHALL attempt to connect to the configured Khoj server on load
2. WHEN Khoj server is available, THE Khoj_Page SHALL display the Khoj interface
3. IF Khoj server is unavailable, THEN THE Khoj_Page SHALL display a friendly error message with setup instructions
4. THE Khoj_Page SHALL provide a "重试连接" button when connection fails
5. THE Khoj_Page SHALL support configuring Khoj server URL (default: `http://localhost:42110`)

### Requirement 3: iframe 嵌入模式 (Phase 1)

**User Story:** As a user, I want to use Khoj's full web interface within Blinko, so that I get all Khoj features immediately.

#### Acceptance Criteria

1. THE Khoj_Page SHALL embed Khoj Web UI using an iframe
2. THE iframe SHALL occupy the full available page area
3. THE iframe SHALL load Khoj's chat interface (`/chat` route)
4. WHEN the iframe loads successfully, THE Khoj_Page SHALL hide the loading indicator
5. IF the iframe fails to load, THEN THE Khoj_Page SHALL display an error message

### Requirement 4: 连接状态指示

**User Story:** As a user, I want to see the Khoj connection status, so that I know if the service is available.

#### Acceptance Criteria

1. THE Khoj_Page SHALL display a connection status indicator
2. WHEN Khoj is connected, THE Indicator SHALL show a green status with "已连接"
3. WHEN Khoj is disconnected, THE Indicator SHALL show a red status with "未连接"
4. THE Khoj_Page SHALL periodically check connection status (every 30 seconds)

### Requirement 5: 设置配置

**User Story:** As a user, I want to configure Khoj connection settings, so that I can connect to my Khoj server.

#### Acceptance Criteria

1. THE Settings_Page SHALL include a Khoj configuration section
2. THE Configuration_Section SHALL allow setting Khoj server URL
3. THE Configuration_Section SHALL provide a "测试连接" button
4. WHEN connection test succeeds, THE Configuration_Section SHALL show success message
5. WHEN connection test fails, THE Configuration_Section SHALL show error message with details

### Requirement 6: 响应式布局

**User Story:** As a user, I want the Khoj page to work well on different screen sizes, so that I can use it on desktop and mobile.

#### Acceptance Criteria

1. THE Khoj_Page SHALL adapt to different screen sizes
2. WHEN on mobile, THE Khoj_Page SHALL use full-width layout
3. WHEN on desktop, THE Khoj_Page SHALL use appropriate padding and margins
4. THE iframe SHALL resize responsively with the container

### Requirement 7: 错误处理

**User Story:** As a user, I want clear error messages when something goes wrong, so that I can troubleshoot issues.

#### Acceptance Criteria

1. IF Khoj server is not running, THEN THE Khoj_Page SHALL display "Khoj 服务未启动" with start instructions
2. IF network error occurs, THEN THE Khoj_Page SHALL display "网络连接失败" with retry option
3. IF iframe blocked by browser, THEN THE Khoj_Page SHALL display "无法加载 Khoj" with alternative link
4. THE Error_Messages SHALL include actionable guidance for users
