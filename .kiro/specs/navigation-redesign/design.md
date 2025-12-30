# Design Document: Navigation Redesign

## Overview

重新设计 Echo 应用的导航系统，将 14 个功能图标按逻辑分组，添加快捷操作入口，支持展开/收起模式，并优化视觉层次。

## Architecture

```
┌─────────────────────────────────────────┐
│              Navigation Bar              │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐    │
│  │      Quick Actions Section       │    │
│  │  [截图] [语音] [快速笔记]         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │      Core Functions Group        │    │
│  │  [首页] [对话] [笔记] [任务]      │    │
│  └─────────────────────────────────┘    │
│  ─────────── separator ───────────      │
│  ┌─────────────────────────────────┐    │
│  │    Productivity Functions Group  │    │
│  │  [GitHub] [文件] [翻译] [活动]    │    │
│  └─────────────────────────────────┘    │
│  ─────────── separator ───────────      │
│  ┌─────────────────────────────────┐    │
│  │       Life Functions Group       │    │
│  │  [投资] [健康] [情绪] [家庭] [学习]│    │
│  └─────────────────────────────────┘    │
│  ─────────── separator ───────────      │
│  ┌─────────────────────────────────┐    │
│  │      System Functions Group      │    │
│  │  [设置]                          │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [展开/收起 Toggle]                     │
└─────────────────────────────────────────┘
```

## Components and Interfaces

### 1. NavigationBar 组件

```typescript
interface NavigationBarProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
}

interface NavGroup {
  id: string;
  label: string;
  color: string;
  items: NavItem[];
}

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  size?: 'normal' | 'large';
}

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut: string;
  action: () => void;
}
```

### 2. QuickActionsBar 组件

```typescript
interface QuickActionsBarProps {
  actions: QuickAction[];
  isExpanded: boolean;
}
```

### 3. NavGroupSection 组件

```typescript
interface NavGroupSectionProps {
  group: NavGroup;
  isExpanded: boolean;
  activeItem: string;
}
```

### 4. useNavigationState Hook

```typescript
interface NavigationState {
  isExpanded: boolean;
  toggleExpand: () => void;
}

function useNavigationState(): NavigationState;
```

### 5. useKeyboardShortcuts Hook

```typescript
interface ShortcutConfig {
  key: string;
  modifiers: ('ctrl' | 'shift' | 'alt' | 'meta')[];
  action: () => void;
}

function useKeyboardShortcuts(shortcuts: ShortcutConfig[]): void;
```

## Data Models

### 导航分组配置

```typescript
const NAV_GROUPS: NavGroup[] = [
  {
    id: 'core',
    label: '核心功能',
    color: 'blue',
    items: [
      { path: '/', label: '首页', icon: Home, size: 'large' },
      { path: '/chat', label: '对话', icon: MessageCircle, size: 'large' },
      { path: '/notes', label: '笔记', icon: StickyNote },
      { path: '/tasks', label: '任务', icon: CheckSquare },
    ],
  },
  {
    id: 'productivity',
    label: '生产力',
    color: 'green',
    items: [
      { path: '/github', label: 'GitHub', icon: Github },
      { path: '/files', label: '文件', icon: FolderSearch },
      { path: '/translate', label: '翻译', icon: Languages },
      { path: '/activity', label: '活动', icon: Activity },
    ],
  },
  {
    id: 'life',
    label: '生活',
    color: 'purple',
    items: [
      { path: '/investment', label: '投资', icon: DollarSign },
      { path: '/health', label: '健康', icon: Heart },
      { path: '/emotion', label: '情绪', icon: Smile },
      { path: '/family', label: '家庭', icon: Users },
      { path: '/learning', label: '学习', icon: BookOpen },
    ],
  },
  {
    id: 'system',
    label: '系统',
    color: 'gray',
    items: [
      { path: '/settings', label: '设置', icon: Settings },
    ],
  },
];

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'screenshot',
    label: '截图',
    icon: Camera,
    shortcut: 'Cmd+Shift+S',
    action: () => { /* 调用 Tauri 截图 API */ },
  },
  {
    id: 'voice-meeting',
    label: '语音会议',
    icon: Mic,
    shortcut: 'Cmd+Shift+V',
    action: () => { /* 打开语音会议弹窗 */ },
  },
  {
    id: 'quick-note',
    label: '快速笔记',
    icon: PenLine,
    shortcut: 'Cmd+Shift+N',
    action: () => { /* 打开快速笔记弹窗 */ },
  },
];
```

### 持久化状态

```typescript
// localStorage key
const NAV_EXPANDED_KEY = 'echo_nav_expanded';

// 默认值
const DEFAULT_EXPANDED = false;
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 导航项分组完整性

*For any* navigation item in the original NAV_ITEMS array, it should exist in exactly one group within NAV_GROUPS, and the total count of items across all groups should equal the original count.

**Validates: Requirements 1.1**

### Property 2: 快捷操作触发一致性

*For any* quick action, whether triggered by button click or keyboard shortcut, the same action function should be invoked with identical behavior.

**Validates: Requirements 2.3, 2.4**

### Property 3: 导航栏模式切换一致性

*For any* sequence of toggle operations on the navigation bar, the isExpanded state should alternate between true and false, and the UI should reflect the current state correctly.

**Validates: Requirements 3.1**

### Property 4: 用户偏好持久化往返

*For any* navigation expanded state set by the user, saving to localStorage and then reading back should produce the same state value.

**Validates: Requirements 3.4**

### Property 5: 图标尺寸规则一致性

*For any* navigation item, if it belongs to the 'core' group and is marked as 'large', it should render with larger icon size; all other items within the same group should have consistent normal size.

**Validates: Requirements 4.1, 4.2**

## Error Handling

1. **localStorage 不可用**: 使用 try-catch 包装，降级为内存状态
2. **快捷键冲突**: 检测系统快捷键冲突，提供自定义选项
3. **Tauri API 调用失败**: 显示友好错误提示，提供重试选项

## Testing Strategy

### 单元测试 (Vitest)

- 测试 `useNavigationState` hook 的状态切换逻辑
- 测试 `useKeyboardShortcuts` hook 的快捷键注册和触发
- 测试导航分组数据结构的完整性

### 属性测试 (fast-check)

- **Property 1**: 生成随机导航项，验证分组完整性
- **Property 4**: 生成随机布尔值，验证 localStorage 往返一致性
- **Property 5**: 生成随机导航配置，验证图标尺寸规则

### 组件测试 (Testing Library)

- 测试 NavigationBar 的展开/收起渲染
- 测试 QuickActionsBar 的按钮点击
- 测试响应式布局在不同屏幕宽度下的表现
