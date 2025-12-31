# Implementation Plan: Navigation Redesign

## Overview

重构 Echo 应用的导航系统，实现功能分组、快捷操作栏、展开/收起模式和视觉层次优化。

## Tasks

- [x] 1. 创建导航数据结构和类型定义
  - [x] 1.1 在 `echo/src/types/navigation.ts` 创建导航相关类型
    - 定义 NavGroup, NavItem, QuickAction 接口
    - _Requirements: 1.1_
  - [x] 1.2 在 `echo/src/config/navigation.ts` 创建导航配置
    - 定义 NAV_GROUPS 分组配置
    - 定义 QUICK_ACTIONS 快捷操作配置
    - _Requirements: 1.1, 2.2_
  - [ ]* 1.3 编写属性测试验证分组完整性
    - **Property 1: 导航项分组完整性**
    - **Validates: Requirements 1.1**

- [x] 2. 实现导航状态管理 Hook
  - [x] 2.1 创建 `echo/src/hooks/useNavigationState.ts`
    - 实现展开/收起状态切换
    - 实现 localStorage 持久化
    - _Requirements: 3.1, 3.4_
  - [ ]* 2.2 编写属性测试验证状态持久化
    - **Property 4: 用户偏好持久化往返**
    - **Validates: Requirements 3.4**

- [x] 3. 实现键盘快捷键 Hook
  - [x] 3.1 创建 `echo/src/hooks/useKeyboardShortcuts.ts`
    - 实现快捷键注册和监听
    - 支持 Cmd/Ctrl + Shift + 组合键
    - _Requirements: 2.4_
  - [ ]* 3.2 编写属性测试验证快捷键触发
    - **Property 2: 快捷操作触发一致性**
    - **Validates: Requirements 2.3, 2.4**

- [x] 4. Checkpoint - 确保所有 hooks 测试通过
  - 运行测试，确认基础逻辑正确
  - 如有问题请询问用户

- [x] 5. 实现导航 UI 组件
  - [x] 5.1 创建 `echo/src/components/navigation/QuickActionsBar.tsx`
    - 实现快捷操作按钮组
    - 支持展开/收起模式下的不同显示
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 5.2 创建 `echo/src/components/navigation/NavGroupSection.tsx`
    - 实现分组区块渲染
    - 支持分隔线和组标签
    - _Requirements: 1.2, 1.3_
  - [x] 5.3 创建 `echo/src/components/navigation/NavigationBar.tsx`
    - 组合 QuickActionsBar 和 NavGroupSection
    - 实现展开/收起切换按钮
    - _Requirements: 3.2, 3.3_
  - [ ]* 5.4 编写属性测试验证图标尺寸规则
    - **Property 5: 图标尺寸规则一致性**
    - **Validates: Requirements 4.1, 4.2**

- [x] 6. 实现视觉样式
  - [x] 6.1 更新导航栏样式
    - 核心功能使用较大图标 (h-6 w-6)
    - 其他功能使用标准图标 (h-5 w-5)
    - 分组使用不同的颜色标识
    - _Requirements: 4.1, 4.2, 4.4_
  - [x] 6.2 实现激活状态高亮
    - 当前页面对应的导航项高亮显示
    - _Requirements: 4.3_
  - [x] 6.3 实现 Tooltip 组件
    - 收起模式下悬停显示功能名称
    - _Requirements: 3.2_

- [x] 7. 实现响应式布局
  - [x] 7.1 实现移动端底部导航
    - 屏幕宽度 < 640px 时移至底部
    - 只显示 5 个主要功能
    - _Requirements: 5.1, 5.2_
  - [x] 7.2 实现移动端快捷操作浮动按钮
    - 添加 FAB 按钮访问快捷操作
    - _Requirements: 5.3_

- [x] 8. 集成到主应用
  - [x] 8.1 更新 `echo/src/App.tsx`
    - 替换原有 NavBar 为新的 NavigationBar
    - 集成键盘快捷键
    - _Requirements: 1.1, 2.1_

- [x] 9. Final Checkpoint - 确保所有测试通过
  - 运行完整测试套件
  - 验证所有功能正常工作
  - 如有问题请询问用户

## Notes

- 任务标记 `*` 为可选测试任务，可跳过以加快 MVP 开发
- 每个任务都引用了具体的需求条款以便追溯
- Checkpoint 任务用于阶段性验证
- 属性测试验证核心正确性属性
