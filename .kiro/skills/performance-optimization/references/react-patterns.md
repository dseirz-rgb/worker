# React 性能优化模式

## 概述

React 性能优化的核心是**减少不必要的渲染**和**减少渲染成本**。

```
优化策略优先级:
1. 避免不必要的渲染 (memo, 状态下沉)
2. 减少渲染成本 (虚拟列表, 懒加载)
3. 优化渲染过程 (useMemo, useCallback)
```

---

## React.memo

### 何时使用

- 组件接收的 props 很少变化
- 组件渲染成本较高
- 父组件频繁重渲染

### 基本用法

```typescript
import { memo } from 'react';

// ✅ 使用 memo 包裹纯展示组件
const UserCard = memo(function UserCard({ user }: { user: User }) {
  return (
    <div className="card">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
});
```

### 自定义比较函数

```typescript
// 当 props 是复杂对象时，提供自定义比较
const UserCard = memo(
  function UserCard({ user }: { user: User }) {
    return <div>{user.name}</div>;
  },
  (prevProps, nextProps) => {
    // 只比较关键字段
    return prevProps.user.id === nextProps.user.id 
        && prevProps.user.name === nextProps.user.name;
  }
);
```

### ⚠️ 常见陷阱

```typescript
// ❌ 错误：每次渲染都创建新对象，memo 失效
function Parent() {
  return <UserCard user={{ name: 'John', email: 'john@example.com' }} />;
}

// ✅ 正确：使用 useMemo 缓存对象
function Parent() {
  const user = useMemo(() => ({ name: 'John', email: 'john@example.com' }), []);
  return <UserCard user={user} />;
}
```

---

## useMemo

### 何时使用

- 计算成本高的派生数据
- 需要保持引用稳定的对象/数组
- 作为其他 Hook 的依赖项

### 基本用法

```typescript
import { useMemo } from 'react';

function UserList({ users, filter }: { users: User[]; filter: string }) {
  // ✅ 缓存过滤结果，避免每次渲染都重新计算
  const filteredUsers = useMemo(() => {
    console.log('过滤用户列表...');
    return users.filter(user => 
      user.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [users, filter]);

  return (
    <ul>
      {filteredUsers.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### 复杂计算示例

```typescript
function Dashboard({ transactions }: { transactions: Transaction[] }) {
  // ✅ 缓存统计计算
  const stats = useMemo(() => {
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    const average = total / transactions.length;
    const max = Math.max(...transactions.map(t => t.amount));
    const min = Math.min(...transactions.map(t => t.amount));
    
    return { total, average, max, min };
  }, [transactions]);

  return (
    <div>
      <p>总计: {stats.total}</p>
      <p>平均: {stats.average}</p>
    </div>
  );
}
```

### ⚠️ 不要过度使用

```typescript
// ❌ 不需要 useMemo：简单计算
const fullName = useMemo(() => `${firstName} ${lastName}`, [firstName, lastName]);

// ✅ 直接计算即可
const fullName = `${firstName} ${lastName}`;
```

---

## useCallback

### 何时使用

- 传递给 memo 组件的回调函数
- 作为 useEffect 的依赖项
- 传递给子组件的事件处理器

### 基本用法

```typescript
import { useCallback, memo } from 'react';

// 子组件使用 memo
const Button = memo(function Button({ onClick, children }: { 
  onClick: () => void; 
  children: React.ReactNode;
}) {
  console.log('Button 渲染');
  return <button onClick={onClick}>{children}</button>;
});

function Parent() {
  const [count, setCount] = useState(0);
  
  // ✅ 使用 useCallback 保持引用稳定
  const handleClick = useCallback(() => {
    console.log('点击了按钮');
  }, []);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
      <Button onClick={handleClick}>稳定的按钮</Button>
    </div>
  );
}
```

### 带依赖的回调

```typescript
function SearchForm({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');
  
  // ✅ 依赖 query 变化时更新回调
  const handleSubmit = useCallback(() => {
    onSearch(query);
  }, [query, onSearch]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <button type="submit">搜索</button>
    </form>
  );
}
```

---

## 代码分割与懒加载

### React.lazy + Suspense

```typescript
import { lazy, Suspense } from 'react';

// ✅ 懒加载大型组件
const HeavyChart = lazy(() => import('./HeavyChart'));
const AdminPanel = lazy(() => import('./AdminPanel'));

function App() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <Routes>
        <Route path="/dashboard" element={<HeavyChart />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Suspense>
  );
}
```

### 路由级别代码分割

```typescript
// routes.tsx
import { lazy } from 'react';

export const routes = [
  {
    path: '/',
    element: lazy(() => import('./pages/Home')),
  },
  {
    path: '/users',
    element: lazy(() => import('./pages/Users')),
  },
  {
    path: '/settings',
    element: lazy(() => import('./pages/Settings')),
  },
];
```

### 条件懒加载

```typescript
function FeaturePanel({ showAdvanced }: { showAdvanced: boolean }) {
  // ✅ 只在需要时加载高级功能
  const AdvancedFeatures = lazy(() => import('./AdvancedFeatures'));

  return (
    <div>
      <BasicFeatures />
      {showAdvanced && (
        <Suspense fallback={<div>加载高级功能...</div>}>
          <AdvancedFeatures />
        </Suspense>
      )}
    </div>
  );
}
```

---

## 虚拟列表

### 使用 @tanstack/react-virtual

```bash
pnpm add @tanstack/react-virtual
```

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // 预估每项高度
    overscan: 5, // 预渲染数量
  });

  return (
    <div
      ref={parentRef}
      style={{ height: '400px', overflow: 'auto' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <ItemCard item={items[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 动态高度虚拟列表

```typescript
function DynamicVirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // 初始估计
    measureElement: (element) => element.getBoundingClientRect().height, // 动态测量
  });

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              transform: `translateY(${virtualItem.start}px)`,
              width: '100%',
            }}
          >
            <ItemCard item={items[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 状态管理优化

### 状态下沉

```typescript
// ❌ 状态过高，导致无关组件重渲染
function App() {
  const [searchQuery, setSearchQuery] = useState('');
  
  return (
    <div>
      <Header /> {/* 每次输入都重渲染 */}
      <SearchInput value={searchQuery} onChange={setSearchQuery} />
      <Footer /> {/* 每次输入都重渲染 */}
    </div>
  );
}

// ✅ 状态下沉到需要的组件
function App() {
  return (
    <div>
      <Header />
      <SearchSection /> {/* 状态在这里管理 */}
      <Footer />
    </div>
  );
}

function SearchSection() {
  const [searchQuery, setSearchQuery] = useState('');
  return <SearchInput value={searchQuery} onChange={setSearchQuery} />;
}
```

### 状态分割

```typescript
// ❌ 单一大状态，任何变化都触发重渲染
const [state, setState] = useState({
  user: null,
  posts: [],
  comments: [],
  settings: {},
});

// ✅ 分割状态，独立更新
const [user, setUser] = useState(null);
const [posts, setPosts] = useState([]);
const [comments, setComments] = useState([]);
const [settings, setSettings] = useState({});
```

---

## 性能检测工具

### React DevTools Profiler

```typescript
// 在代码中使用 Profiler 组件
import { Profiler } from 'react';

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number,
) {
  // 记录性能数据
  console.log({
    id,
    phase,
    actualDuration: `${actualDuration.toFixed(2)}ms`,
    baseDuration: `${baseDuration.toFixed(2)}ms`,
  });
}

function App() {
  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <MyComponent />
    </Profiler>
  );
}
```

### why-did-you-render

```bash
pnpm add -D @welldone-software/why-did-you-render
```

```typescript
// wdyr.ts (在应用入口前导入)
import React from 'react';

if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    trackAllPureComponents: true,
  });
}

// 在组件上启用追踪
MyComponent.whyDidYouRender = true;
```

---

## 优化检查清单

### 组件级别

- [ ] 纯展示组件是否使用了 `memo`？
- [ ] 传递给子组件的回调是否使用了 `useCallback`？
- [ ] 复杂计算是否使用了 `useMemo`？
- [ ] 是否避免了在 render 中创建新对象/数组？

### 列表级别

- [ ] 长列表是否使用了虚拟化？
- [ ] 列表项是否有稳定的 `key`？
- [ ] 列表项组件是否使用了 `memo`？

### 应用级别

- [ ] 是否实现了路由级别的代码分割？
- [ ] 大型组件是否使用了懒加载？
- [ ] 状态是否下沉到最小范围？
- [ ] 是否避免了不必要的全局状态？
