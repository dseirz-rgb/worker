# API 响应优化策略

## 概述

API 性能优化的核心是**减少响应时间**和**减少数据传输量**。

```
优化策略优先级:
1. 减少请求数量 (批量、合并)
2. 减少响应大小 (分页、字段筛选、压缩)
3. 利用缓存 (HTTP 缓存、应用缓存)
4. 优化后端处理 (数据库、算法)
```

---

## 缓存策略

### HTTP 缓存头

```typescript
// Vercel API Route 示例
export async function GET(request: Request) {
  const data = await fetchData();
  
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      // 浏览器缓存 60 秒，CDN 缓存 300 秒
      'Cache-Control': 'public, s-maxage=300, max-age=60, stale-while-revalidate=600',
    },
  });
}
```

### 缓存策略选择

| 数据类型 | 缓存策略 | Cache-Control |
|----------|----------|---------------|
| 静态配置 | 长期缓存 | `max-age=86400` |
| 用户数据 | 私有短期 | `private, max-age=60` |
| 列表数据 | CDN 缓存 | `s-maxage=300, stale-while-revalidate` |
| 实时数据 | 不缓存 | `no-store` |


### React Query 缓存配置

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 分钟内数据视为新鲜
      gcTime: 30 * 60 * 1000,   // 30 分钟后垃圾回收
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// 针对特定查询的缓存配置
const { data } = useQuery({
  queryKey: ['users', userId],
  queryFn: () => fetchUser(userId),
  staleTime: 10 * 60 * 1000, // 用户数据 10 分钟内不重新获取
});
```

---

## 响应压缩

### Gzip/Brotli 压缩

```typescript
// Next.js/Vercel 自动启用压缩
// 确保 next.config.js 中启用
module.exports = {
  compress: true,
};
```

### 响应体优化

```typescript
// ❌ 返回完整对象
return {
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  deletedAt: user.deletedAt,
  metadata: user.metadata,
  // ... 更多字段
};

// ✅ 只返回需要的字段
return {
  id: user.id,
  name: user.name,
  email: user.email,
};
```

---

## 分页与无限滚动

### 游标分页 (推荐)

```typescript
// API 端
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor');
  const limit = parseInt(searchParams.get('limit') || '20');

  const items = await db
    .select()
    .from(itemsTable)
    .where(cursor ? gt(itemsTable.id, cursor) : undefined)
    .limit(limit + 1); // 多取一条判断是否有下一页

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return Response.json({ data, nextCursor, hasMore });
}
```

### React Query 无限滚动

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';

function useInfiniteItems() {
  return useInfiniteQuery({
    queryKey: ['items'],
    queryFn: ({ pageParam }) => fetchItems({ cursor: pageParam }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

function ItemList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteItems();

  return (
    <div>
      {data?.pages.map((page) =>
        page.data.map((item) => <ItemCard key={item.id} item={item} />)
      )}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? '加载中...' : '加载更多'}
        </button>
      )}
    </div>
  );
}
```

---

## 请求合并与批量处理

### DataLoader 模式

```typescript
import DataLoader from 'dataloader';

// 创建批量加载器
const userLoader = new DataLoader(async (userIds: readonly string[]) => {
  const users = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, [...userIds]));
  
  // 按请求顺序返回结果
  const userMap = new Map(users.map(u => [u.id, u]));
  return userIds.map(id => userMap.get(id) || null);
});

// 使用：自动批量化
const user1 = await userLoader.load('user-1');
const user2 = await userLoader.load('user-2');
// 实际只发送一次数据库查询
```

### 请求去重

```typescript
// React Query 自动去重相同的请求
// 多个组件同时请求相同数据，只发送一次请求
function ComponentA() {
  const { data } = useQuery({ queryKey: ['user', '123'], queryFn: fetchUser });
}

function ComponentB() {
  const { data } = useQuery({ queryKey: ['user', '123'], queryFn: fetchUser });
}
// 只会发送一次 fetchUser 请求
```

---

## 预加载与预取

### 路由预加载

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

function UserListItem({ user }: { user: User }) {
  const queryClient = useQueryClient();

  // 鼠标悬停时预取用户详情
  const prefetchUser = () => {
    queryClient.prefetchQuery({
      queryKey: ['user', user.id],
      queryFn: () => fetchUserDetail(user.id),
      staleTime: 5 * 60 * 1000,
    });
  };

  return (
    <Link to={`/users/${user.id}`} onMouseEnter={prefetchUser}>
      {user.name}
    </Link>
  );
}
```

### 初始数据

```typescript
// 使用列表数据作为详情页初始数据
function UserDetail({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUserDetail(userId),
    // 从列表缓存中获取初始数据
    initialData: () => {
      const users = queryClient.getQueryData<User[]>(['users']);
      return users?.find(u => u.id === userId);
    },
  });
}
```

---

## 错误处理与重试

### 智能重试策略

```typescript
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  retry: (failureCount, error) => {
    // 4xx 错误不重试
    if (error.status >= 400 && error.status < 500) return false;
    // 最多重试 3 次
    return failureCount < 3;
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});
```

### 优雅降级

```typescript
async function fetchWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    console.warn('主请求失败，使用降级方案', error);
    return await fallback();
  }
}

// 使用
const data = await fetchWithFallback(
  () => fetchFromAPI(),
  () => fetchFromCache(),
);
```

---

## 性能监控

### 请求耗时追踪

```typescript
// 创建带监控的 fetch 包装
async function monitoredFetch(url: string, options?: RequestInit) {
  const start = performance.now();
  
  try {
    const response = await fetch(url, options);
    const duration = performance.now() - start;
    
    // 记录慢请求
    if (duration > 1000) {
      console.warn(`慢请求: ${url} 耗时 ${duration.toFixed(0)}ms`);
    }
    
    return response;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`请求失败: ${url} 耗时 ${duration.toFixed(0)}ms`, error);
    throw error;
  }
}
```

---

## 优化检查清单

### 缓存

- [ ] 是否设置了合适的 HTTP 缓存头？
- [ ] React Query 的 staleTime 是否合理？
- [ ] 是否利用了 CDN 缓存？

### 数据传输

- [ ] 是否只返回必要的字段？
- [ ] 是否启用了响应压缩？
- [ ] 大列表是否使用了分页？

### 请求优化

- [ ] 是否合并了可批量处理的请求？
- [ ] 是否实现了请求去重？
- [ ] 是否预加载了可能需要的数据？
