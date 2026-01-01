# Design Document: Role Select Homepage

## Overview

角色选择主页是 Echo 应用的入口页面，用户登录后首先看到这个页面。页面展示 5 个角色卡片，用户点击卡片进入对应角色的功能区。

设计复用 Blinko 的 `GradientBackground` 组件和 `glass-effect` 样式，保持视觉一致性。

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   RoleSelectPage                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │              GradientBackground                    │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │              RoleSelector                    │  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐       │  │  │
│  │  │  │RoleCard │ │RoleCard │ │RoleCard │       │  │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘       │  │  │
│  │  │  ┌─────────┐ ┌─────────┐                   │  │  │
│  │  │  │RoleCard │ │RoleCard │                   │  │  │
│  │  │  └─────────┘ └─────────┘                   │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### RoleSelectPage

主页面组件，负责整体布局和状态管理。

```typescript
// app/src/pages/role-select.tsx
interface RoleSelectPageProps {
  // 无需 props，从 store 获取状态
}

export default function RoleSelectPage(): JSX.Element
```

### RoleSelector

角色选择器组件，管理角色列表和选择逻辑。

```typescript
// app/src/components/RoleSelector/index.tsx
interface RoleSelectorProps {
  roles: Role[];
  selectedRoleId?: string;
  onRoleSelect: (roleId: string) => void;
  onRoleSettings: (roleId: string) => void;
}

export function RoleSelector(props: RoleSelectorProps): JSX.Element
```

### RoleCard

单个角色卡片组件。

```typescript
// app/src/components/RoleSelector/RoleCard.tsx
interface RoleCardProps {
  role: Role;
  isSelected: boolean;
  onClick: () => void;
  onSettingsClick: () => void;
}

export function RoleCard(props: RoleCardProps): JSX.Element
```

### Role 类型定义

```typescript
// app/src/types/role.ts
export type RoleStatus = 'completed' | 'in-progress' | 'planned';

export interface Role {
  id: string;
  name: string;
  icon: string;
  description: string;
  status: RoleStatus;
  route: string;
  color: string;
}

export const DEFAULT_ROLES: Role[] = [
  {
    id: 'assistant',
    name: '通用助手',
    icon: '🎯',
    description: '日常笔记、翻译、活动监控',
    status: 'completed',
    route: '/',
    color: '#3B82F6',
  },
  {
    id: 'developer',
    name: 'AI 开发者',
    icon: '🧑‍💻',
    description: 'GitHub 监控、项目追踪、知识学习',
    status: 'planned',
    route: '/developer',
    color: '#10B981',
  },
  {
    id: 'manager',
    name: '美术经理',
    icon: '👨‍💼',
    description: '团队管理、周报、会议记录',
    status: 'planned',
    route: '/manager',
    color: '#F59E0B',
  },
  {
    id: 'investor',
    name: '投资者',
    icon: '📈',
    description: '投资数据、情绪管理、风控',
    status: 'planned',
    route: '/investor',
    color: '#EF4444',
  },
  {
    id: 'family',
    name: '家庭成员',
    icon: '👨‍👩‍👧',
    description: '家庭关怀、健康追踪',
    status: 'planned',
    route: '/family',
    color: '#8B5CF6',
  },
];
```

## Data Models

### 本地存储

```typescript
// localStorage key
const SELECTED_ROLE_KEY = 'echo_selected_role';

// 存储格式
interface StoredRoleSelection {
  roleId: string;
  selectedAt: string; // ISO date string
}
```

### 数据库模型 (Prisma)

```prisma
// 角色配置表 (可选，Phase 2 实现)
model roleConfig {
  id        Int      @id @default(autoincrement())
  roleId    String   @db.VarChar(50)
  config    Json     @db.Json
  isActive  Boolean  @default(true)
  accountId Int
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @db.Timestamptz(6)

  account   accounts @relation(fields: [accountId], references: [id])

  @@unique([accountId, roleId])
  @@index([accountId])
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do.*

### Property 1: Role Card Display Completeness

*For any* role data object, the rendered RoleCard component should display the role's icon, name, description, and status badge (if status is "planned").

**Validates: Requirements 1.2, 1.3**

### Property 2: Role Click Behavior

*For any* role, clicking the card should either navigate to the role's route (if status is "completed" or "in-progress") or show a toast message (if status is "planned").

**Validates: Requirements 2.1, 2.2**

### Property 3: Role Selection Persistence

*For any* role selection action, the selected role ID should be saved to localStorage, and on page reload, the same role should be highlighted.

**Validates: Requirements 3.1, 3.2**

## Error Handling

| 错误场景 | 处理方式 |
|---------|---------|
| localStorage 不可用 | 降级为内存存储，不影响功能 |
| 角色数据加载失败 | 显示默认角色列表 |
| 导航失败 | 显示错误 toast，保持当前页面 |

## Testing Strategy

### 单元测试

- RoleCard 组件渲染测试
- RoleSelector 组件交互测试
- localStorage 持久化测试

### 属性测试 (fast-check)

使用 `fast-check` 进行属性测试，每个属性至少 100 次迭代。

```typescript
// 示例：Property 1 测试
import fc from 'fast-check';

const roleArbitrary = fc.record({
  id: fc.string(),
  name: fc.string(),
  icon: fc.string(),
  description: fc.string(),
  status: fc.constantFrom('completed', 'in-progress', 'planned'),
  route: fc.string(),
  color: fc.hexaString(),
});

test('Property 1: Role Card Display Completeness', () => {
  fc.assert(
    fc.property(roleArbitrary, (role) => {
      const { getByText, queryByText } = render(<RoleCard role={role} />);
      
      // 应该显示 name 和 description
      expect(getByText(role.name)).toBeInTheDocument();
      expect(getByText(role.description)).toBeInTheDocument();
      
      // 如果是 planned，应该显示 Coming Soon
      if (role.status === 'planned') {
        expect(queryByText('Coming Soon')).toBeInTheDocument();
      }
      
      return true;
    }),
    { numRuns: 100 }
  );
});
```

### 集成测试

- 页面完整渲染测试
- 角色切换流程测试
- 响应式布局测试
