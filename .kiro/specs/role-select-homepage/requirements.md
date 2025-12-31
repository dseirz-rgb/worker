# Requirements Document

## Introduction

Echo 角色选择主页是用户进入应用后的第一个界面，用于选择当前要使用的角色身份。每个角色对应不同的功能集合，帮助用户在不同场景下专注于相关任务。

## Glossary

- **Role_Selector**: 角色选择器组件，显示所有可用角色卡片
- **Role_Card**: 角色卡片组件，展示单个角色的信息和状态
- **Role_Config**: 角色配置，存储用户对每个角色的个性化设置
- **GradientBackground**: Blinko 的渐变背景组件，用于统一视觉风格

## Requirements

### Requirement 1: 角色选择主页展示

**User Story:** As a user, I want to see all available roles when I open the app, so that I can choose which role to use.

#### Acceptance Criteria

1. WHEN the user opens the app after login, THE Role_Selector SHALL display all 5 role cards
2. THE Role_Card SHALL show role icon, name, description, and status (completed/in-progress/planned)
3. WHEN a role is marked as "planned", THE Role_Card SHALL display a "Coming Soon" badge
4. THE Role_Selector SHALL use GradientBackground to match Blinko's visual style

### Requirement 2: 角色卡片交互

**User Story:** As a user, I want to click on a role card to enter that role's workspace, so that I can access role-specific features.

#### Acceptance Criteria

1. WHEN the user clicks on a completed role card, THE System SHALL navigate to that role's main page
2. WHEN the user clicks on a planned role card, THE System SHALL show a toast message "Coming Soon"
3. WHEN the user hovers over a role card, THE Role_Card SHALL show a subtle highlight effect

### Requirement 3: 角色状态持久化

**User Story:** As a user, I want the app to remember my last selected role, so that I can quickly continue where I left off.

#### Acceptance Criteria

1. WHEN the user selects a role, THE System SHALL save the selection to local storage
2. WHEN the user opens the app next time, THE System SHALL highlight the last selected role
3. THE System SHALL provide a "Switch Role" button in the sidebar to return to role selection

### Requirement 4: 角色配置

**User Story:** As a user, I want to customize each role's settings, so that I can personalize my experience.

#### Acceptance Criteria

1. THE Role_Card SHALL have a settings icon that opens role-specific settings
2. WHEN the user clicks the settings icon, THE System SHALL open a settings modal for that role
3. THE Role_Config SHALL be stored in the database and synced across devices

### Requirement 5: 响应式设计

**User Story:** As a user, I want the role selection page to work well on different screen sizes, so that I can use it on any device.

#### Acceptance Criteria

1. ON desktop screens, THE Role_Selector SHALL display cards in a 3-column grid
2. ON tablet screens, THE Role_Selector SHALL display cards in a 2-column grid
3. ON mobile screens, THE Role_Selector SHALL display cards in a single column
