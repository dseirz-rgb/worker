# Requirements Document

## Introduction

将 Echo 和 RiskControl 两个独立运行的前端整合为统一的用户界面。用户可以在一个应用中无缝切换笔记管理和投资风控功能。

## Glossary

- **Echo_Frontend**: Echo 知识管理系统前端，基于 React 18 + MobX + HeroUI
- **RiskControl_Frontend**: RiskControl 投资风控系统前端，基于 React 19 + Zustand + Radix UI
- **Module_Switcher**: 模块切换组件，允许用户在 Echo 和 RiskControl 之间切换
- **Unified_Shell**: 统一的应用外壳，包含导航栏、侧边栏和模块容器
- **HeroUI**: Echo 使用的 UI 组件库
- **Radix_UI**: RiskControl 使用的 UI 组件库

## Requirements

### Requirement 1: 统一应用外壳

**User Story:** As a user, I want a single application interface that contains both Echo and RiskControl features, so that I don't need to switch between different browser tabs.

#### Acceptance Criteria

1. THE Unified_Shell SHALL provide a consistent header with module switching capability
2. THE Unified_Shell SHALL display the current active module name
3. WHEN the application loads, THE System SHALL restore the user's last visited module
4. THE Unified_Shell SHALL maintain a consistent visual style across both modules

### Requirement 2: 模块切换

**User Story:** As a user, I want to quickly switch between notes and investment features, so that I can access all my tools efficiently.

#### Acceptance Criteria

1. THE Module_Switcher SHALL be accessible from the sidebar or header
2. WHEN a user clicks on a module, THE System SHALL load that module's interface
3. THE System SHALL preserve the state of each module when switching
4. WHEN switching modules, THE System SHALL animate the transition smoothly
5. THE System SHALL support keyboard shortcuts for module switching (e.g., Cmd+1 for Echo, Cmd+2 for RiskControl)

### Requirement 3: Echo 侧边栏扩展

**User Story:** As a user, I want to see the investment module entry in Echo's sidebar, so that I can easily access investment features.

#### Acceptance Criteria

1. THE Echo_Frontend sidebar SHALL include an "投资" (Investment) menu item
2. WHEN a user clicks the Investment menu item, THE System SHALL switch to RiskControl module
3. THE Investment menu item SHALL display an appropriate icon
4. THE Investment menu item SHALL show a badge when there are risk alerts

### Requirement 4: UI 风格统一

**User Story:** As a user, I want a consistent visual experience across both modules, so that the application feels cohesive.

#### Acceptance Criteria

1. THE System SHALL use Echo's HeroUI as the primary component library
2. WHEN RiskControl components are displayed, THE System SHALL adapt them to HeroUI styling
3. THE System SHALL maintain consistent color palette across modules
4. THE System SHALL maintain consistent typography across modules
5. THE System SHALL maintain consistent spacing and layout patterns

### Requirement 5: 整合方式选择

**User Story:** As a developer, I want to choose the best integration approach, so that the implementation is maintainable and performant.

#### Acceptance Criteria

1. THE System SHALL support iframe-based integration as the initial approach
2. THE iframe integration SHALL allow communication between parent and child frames
3. THE System SHALL support route-based integration as an alternative approach
4. IF route-based integration is chosen, THEN THE System SHALL handle React version conflicts
5. THE System SHALL document the chosen integration approach and its trade-offs

### Requirement 6: 响应式设计

**User Story:** As a user, I want the integrated application to work well on different screen sizes, so that I can use it on desktop and tablet.

#### Acceptance Criteria

1. THE Unified_Shell SHALL adapt to different screen widths
2. WHEN on mobile/tablet, THE Module_Switcher SHALL use a bottom navigation bar
3. THE System SHALL support swipe gestures for module switching on touch devices
4. THE System SHALL maintain usability on screens as small as 768px width

### Requirement 7: 性能优化

**User Story:** As a user, I want the application to load quickly and respond smoothly, so that my workflow is not interrupted.

#### Acceptance Criteria

1. THE System SHALL lazy-load modules that are not currently active
2. THE System SHALL cache module state to enable fast switching
3. WHEN switching modules, THE transition SHALL complete within 300ms
4. THE System SHALL preload the other module in the background after initial load

### Requirement 8: 错误隔离

**User Story:** As a user, I want errors in one module to not affect the other module, so that I can continue working.

#### Acceptance Criteria

1. IF an error occurs in RiskControl module, THEN THE Echo module SHALL continue functioning
2. IF an error occurs in Echo module, THEN THE RiskControl module SHALL continue functioning
3. THE System SHALL display a friendly error message when a module fails to load
4. THE System SHALL provide a retry option when a module fails to load
