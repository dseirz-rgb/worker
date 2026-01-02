---
name: performance-optimization
description: |
  性能优化技能：诊断和优化 React 前端、API 响应、数据库查询性能。
  Use when: 页面加载慢、组件渲染卡顿、API 响应超时、数据库查询慢。
  Triggers: "性能", "优化", "慢", "卡顿", "加载", "响应时间", "渲染"
category: optimization
triggers:
  - 性能
  - 优化
  - 慢
  - 卡顿
  - 加载
  - 响应时间
  - 渲染
  - performance
  - slow
  - lag
---

# Performance Optimization (性能优化师)

> ⚡ **核心理念**: 性能优化要有数据支撑，先测量再优化，避免过早优化。

## 🔴 第一原则：测量优先

**不要凭感觉优化，用数据说话！**

```
❌ 错误思路: "这个组件看起来慢，加个 memo 吧"
✅ 正确思路: "用 Profiler 测量后发现这个组件重渲染 50 次，需要优化"

❌ 错误思路: "数据库查询应该加索引"  
✅ 正确思路: "EXPLAIN 分析显示全表扫描，需要在 user_id 列加索引"
```

**优化优先级**: 架构问题 > 算法问题 > 代码问题 > 微优化

## When to Use This Skill

使用此技能当你遇到：
- 页面首次加载时间过长 (>3s)
- 组件交互响应迟钝 (>100ms)
- API 响应时间过长 (>500ms)
- 数据库查询超时或慢查询
- 内存占用持续增长
- 用户反馈"卡顿"、"慢"

## Not For / Boundaries

此技能不适用于：
- 功能尚未完成的代码（先完成再优化）
- 没有性能问题的代码（避免过早优化）
- 一次性脚本或工具（投入产出比低）

---

## Quick Reference

### 🎯 性能诊断工作流

```
问题报告 → 复现问题 → 测量基准 → 定位瓶颈 → 实施优化 → 验证效果
              ↓
         无法复现 → 收集更多信息（环境、数据量、操作步骤）
```

### 📋 性能诊断清单

#### 前端性能检查

| 检查项 | 工具 | 合格标准 |
|--------|------|----------|
| 首次内容绘制 (FCP) | Lighthouse | <1.8s |
| 最大内容绘制 (LCP) | Lighthouse | <2.5s |
| 首次输入延迟 (FID) | Lighthouse | <100ms |
| 累积布局偏移 (CLS) | Lighthouse | <0.1 |
| 组件重渲染次数 | React DevTools | 无不必要渲染 |
| Bundle 大小 | webpack-bundle-analyzer | <200KB (gzip) |
| 图片优化 | Lighthouse | 使用 WebP/AVIF |

#### API 性能检查

| 检查项 | 工具 | 合格标准 |
|--------|------|----------|
| 响应时间 (P50) | 监控系统 | <200ms |
| 响应时间 (P99) | 监控系统 | <1000ms |
| 响应体大小 | Network Tab | <100KB |
| 请求数量 | Network Tab | 首屏 <20 个 |
| 缓存命中率 | 监控系统 | >80% |

#### 数据库性能检查

| 检查项 | 工具 | 合格标准 |
|--------|------|----------|
| 查询时间 | EXPLAIN ANALYZE | <100ms |
| 扫描行数 | EXPLAIN | 使用索引 |
| 连接数 | 数据库监控 | <80% 最大连接 |
| 慢查询数量 | 慢查询日志 | 0 |

### 🔧 常见性能问题速查

| 症状 | 可能原因 | 解决方案 |
|------|----------|----------|
| 页面白屏时间长 | Bundle 过大 | 代码分割、懒加载 |
| 滚动卡顿 | 列表未虚拟化 | 使用 react-window |
| 输入延迟 | 频繁重渲染 | useMemo/useCallback |
| API 慢 | N+1 查询 | 批量查询、DataLoader |
| 数据库慢 | 缺少索引 | 添加复合索引 |
| 内存泄漏 | 未清理订阅 | useEffect cleanup |

---

## 性能优化工作流

### Phase 1: 问题定位

```bash
# 1. 前端性能分析
# 使用 Chrome DevTools Performance 面板录制
# 使用 React DevTools Profiler 分析组件

# 2. API 性能分析
# 使用 Network 面板查看请求瀑布图
# 检查响应时间和响应体大小

# 3. 数据库性能分析
# 使用 EXPLAIN ANALYZE 分析查询计划
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
```

### Phase 2: 基准测量

```typescript
// 前端性能测量
import { Profiler } from 'react';

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
) {
  console.log(`${id} ${phase}: ${actualDuration.toFixed(2)}ms`);
}

<Profiler id="MyComponent" onRender={onRenderCallback}>
  <MyComponent />
</Profiler>
```

```typescript
// API 性能测量
const start = performance.now();
const response = await fetch('/api/data');
const duration = performance.now() - start;
console.log(`API 响应时间: ${duration.toFixed(2)}ms`);
```

### Phase 3: 实施优化

根据定位的问题类型，参考对应的优化指南：

- **React 组件优化** → `references/react-patterns.md`
- **API 响应优化** → `references/api-optimization.md`
- **数据库查询优化** → `references/query-optimization.md`

### Phase 4: 效果验证

```bash
# 1. 对比优化前后的指标
# 2. 使用 Playwright 进行性能回归测试
# 3. 监控生产环境指标变化
```

---

## Examples

### Example 1: 列表渲染卡顿

**Input:** "用户列表页面滚动时很卡，有 1000+ 条数据"

**诊断:**
1. 打开 React DevTools Profiler
2. 发现每次滚动都重渲染所有列表项
3. 问题：未使用虚拟列表

**解决方案:**
```bash
pnpm add @tanstack/react-virtual
```

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function UserList({ users }: { users: User[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: users.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <UserCard user={users[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Example 2: API 响应慢

**Input:** "获取用户详情的 API 响应需要 2 秒"

**诊断:**
1. 检查 API 日志，发现多次数据库查询
2. 问题：N+1 查询（获取用户后，逐个获取关联数据）

**解决方案:**
```typescript
// ❌ 优化前：N+1 查询
const users = await db.select().from(usersTable);
for (const user of users) {
  user.posts = await db.select().from(postsTable).where(eq(postsTable.userId, user.id));
}

// ✅ 优化后：JOIN 查询
const usersWithPosts = await db
  .select()
  .from(usersTable)
  .leftJoin(postsTable, eq(usersTable.id, postsTable.userId));
```

### Example 3: 组件频繁重渲染

**Input:** "输入框打字时整个表单都在闪烁"

**诊断:**
1. React DevTools 显示父组件每次输入都重渲染
2. 问题：状态提升过高，导致无关组件重渲染

**解决方案:**
```typescript
// ❌ 优化前：状态在父组件
function Form() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  return (
    <div>
      <NameInput value={name} onChange={setName} />
      <EmailInput value={email} onChange={setEmail} />
      <ExpensiveComponent /> {/* 每次输入都重渲染 */}
    </div>
  );
}

// ✅ 优化后：状态下沉 + memo
const ExpensiveComponent = memo(function ExpensiveComponent() {
  // ...
});

function NameInput() {
  const [name, setName] = useState(''); // 状态下沉到子组件
  return <input value={name} onChange={(e) => setName(e.target.value)} />;
}
```

---

## References

- `references/index.md`: 导航索引
- `references/react-patterns.md`: React 性能优化模式
- `references/api-optimization.md`: API 响应优化策略
- `references/query-optimization.md`: Drizzle ORM 查询优化

---

## Maintenance

- **Sources**: React 官方文档, Web Vitals, Drizzle ORM 文档
- **Last Updated**: 2025-01-01
- **Known Limits**: 
  - 性能标准因项目而异，需根据实际情况调整
  - 某些优化可能增加代码复杂度，需权衡
