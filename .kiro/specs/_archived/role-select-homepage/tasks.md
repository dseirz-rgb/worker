# Implementation Plan: Role Select Homepage

## Overview

实现 Echo 角色选择主页，复用 Blinko 的 GradientBackground 和 glass-effect 样式。

**开发目录**: `get/blinko-main/`

**技术栈**: TypeScript + React + Tailwind CSS + HeroUI

---

## Tasks

- [x] 1. 创建类型定义和常量
  - [x] 1.1 创建 Role 类型定义
    - 创建 `app/src/types/role.ts`
    - 定义 Role 接口和 RoleStatus 类型
    - 定义 DEFAULT_ROLES 常量数组
    - _Requirements: 1.1, 1.2_

- [x] 2. 实现 RoleCard 组件
  - [x] 2.1 创建 RoleCard 基础组件
    - 创建 `app/src/components/RoleSelector/RoleCard.tsx`
    - 实现卡片布局：图标、名称、描述、状态
    - 使用 glass-effect 样式
    - _Requirements: 1.2, 1.3_

  - [x] 2.2 实现状态徽章
    - 已完成角色显示绿色勾选
    - 规划中角色显示 "Coming Soon" 徽章
    - _Requirements: 1.3_

  - [x] 2.3 实现交互效果
    - hover 高亮效果
    - 点击反馈
    - 选中状态高亮
    - _Requirements: 2.3, 3.2_

- [x] 3. 实现 RoleSelector 组件
  - [x] 3.1 创建 RoleSelector 组件
    - 创建 `app/src/components/RoleSelector/index.tsx`
    - 实现响应式网格布局 (3/2/1 列)
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 3.2 实现角色选择逻辑
    - 点击已完成角色导航到对应路由
    - 点击规划中角色显示 toast
    - _Requirements: 2.1, 2.2_

- [x] 4. 实现 RoleSelectPage 页面
  - [x] 4.1 创建页面组件
    - 创建 `app/src/pages/role-select.tsx`
    - 使用 GradientBackground 包裹
    - 添加标题 "Echo - 选择你的角色"
    - _Requirements: 1.1, 1.4_

  - [x] 4.2 实现 localStorage 持久化
    - 保存选中的角色 ID
    - 页面加载时恢复选中状态
    - _Requirements: 3.1, 3.2_

- [x] 5. 集成到路由系统
  - [x] 5.1 添加路由配置
    - 在 App.tsx 添加 `/role-select` 路由
    - 设置为登录后的默认页面
    - _Requirements: 1.1_

  - [x] 5.2 添加侧边栏切换按钮
    - 在侧边栏底部添加 "切换角色" 按钮
    - 点击返回角色选择页面
    - _Requirements: 3.3_

- [x] 6. Checkpoint - 功能验收
  - 确保所有角色卡片正确显示
  - 确保点击交互正常
  - 确保响应式布局正常
  - 如有问题，询问用户

- [ ]* 7. 编写测试
  - [ ]* 7.1 编写 RoleCard 单元测试
    - 测试组件渲染
    - 测试状态徽章显示
    - _Requirements: 1.2, 1.3_

  - [ ]* 7.2 编写属性测试
    - **Property 1: Role Card Display Completeness**
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 7.3 编写属性测试
    - **Property 2: Role Click Behavior**
    - **Validates: Requirements 2.1, 2.2**

---

## Notes

- 任务标记 `*` 为可选任务，可跳过以加快 MVP 进度
- **开发目录**: 所有代码修改都在 `get/blinko-main/` 中进行
- **复用原则**: 尽量复用 Blinko 现有组件和样式
- 属性测试使用 `fast-check`，每个属性至少 100 次迭代
