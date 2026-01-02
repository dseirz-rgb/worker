# Drizzle ORM 查询优化

## 概述

数据库查询优化的核心是**减少查询次数**和**减少扫描数据量**。

```
优化策略优先级:
1. 避免 N+1 查询 (JOIN、批量查询)
2. 使用索引 (WHERE、ORDER BY 字段)
3. 减少返回数据 (SELECT 指定字段、分页)
4. 优化查询结构 (子查询、CTE)
```

---

## N+1 查询问题

### 问题示例

```typescript
// ❌ N+1 查询：1 次查用户 + N 次查文章
const users = await db.select().from(usersTable);

for (const user of users) {
  // 每个用户都发起一次查询
  const posts = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.userId, user.id));
  user.posts = posts;
}
```

### 解决方案 1: JOIN 查询

```typescript
// ✅ 使用 LEFT JOIN 一次查询
const usersWithPosts = await db
  .select({
    user: usersTable,
    post: postsTable,
  })
  .from(usersTable)
  .leftJoin(postsTable, eq(usersTable.id, postsTable.userId));

// 处理结果，按用户分组
const userMap = new Map<string, UserWithPosts>();
for (const row of usersWithPosts) {
  if (!userMap.has(row.user.id)) {
    userMap.set(row.user.id, { ...row.user, posts: [] });
  }
  if (row.post) {
    userMap.get(row.user.id)!.posts.push(row.post);
  }
}
const result = Array.from(userMap.values());
```


### 解决方案 2: 批量查询

```typescript
// ✅ 使用 IN 批量查询
const users = await db.select().from(usersTable);
const userIds = users.map(u => u.id);

// 一次查询所有相关文章
const allPosts = await db
  .select()
  .from(postsTable)
  .where(inArray(postsTable.userId, userIds));

// 在内存中关联
const postsByUser = new Map<string, Post[]>();
for (const post of allPosts) {
  if (!postsByUser.has(post.userId)) {
    postsByUser.set(post.userId, []);
  }
  postsByUser.get(post.userId)!.push(post);
}

const result = users.map(user => ({
  ...user,
  posts: postsByUser.get(user.id) || [],
}));
```

### 解决方案 3: Drizzle Relations

```typescript
// schema.ts - 定义关系
import { relations } from 'drizzle-orm';

export const usersRelations = relations(usersTable, ({ many }) => ({
  posts: many(postsTable),
}));

export const postsRelations = relations(postsTable, ({ one }) => ({
  author: one(usersTable, {
    fields: [postsTable.userId],
    references: [usersTable.id],
  }),
}));

// 使用 with 查询关联数据
const usersWithPosts = await db.query.usersTable.findMany({
  with: {
    posts: true,
  },
});
```

---

## 索引优化

### 创建索引

```typescript
// schema.ts
import { index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: text('name'),
  status: varchar('status', { length: 20 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // 单列索引
  emailIdx: index('users_email_idx').on(table.email),
  // 复合索引 (查询条件顺序要匹配)
  statusCreatedIdx: index('users_status_created_idx').on(table.status, table.createdAt),
}));
```

### 索引使用原则

| 场景 | 是否需要索引 | 说明 |
|------|-------------|------|
| WHERE 条件字段 | ✅ 需要 | 加速过滤 |
| ORDER BY 字段 | ✅ 需要 | 避免排序 |
| JOIN 关联字段 | ✅ 需要 | 加速连接 |
| 外键字段 | ✅ 需要 | 加速关联查询 |
| 低选择性字段 | ❌ 不需要 | 如 boolean、status |
| 频繁更新字段 | ⚠️ 谨慎 | 索引维护成本高 |

### 复合索引顺序

```typescript
// 查询: WHERE status = 'active' AND created_at > '2024-01-01'
// ✅ 正确的索引顺序 (等值条件在前，范围条件在后)
index('idx').on(table.status, table.createdAt)

// ❌ 错误的索引顺序
index('idx').on(table.createdAt, table.status)
```

---

## 查询分析

### 使用 EXPLAIN

```typescript
// 分析查询计划
const result = await db.execute(sql`
  EXPLAIN ANALYZE
  SELECT * FROM users WHERE email = 'test@example.com'
`);
console.log(result);
```

### 常见问题诊断

| EXPLAIN 输出 | 问题 | 解决方案 |
|--------------|------|----------|
| Seq Scan | 全表扫描 | 添加索引 |
| Sort | 内存排序 | 添加排序字段索引 |
| Nested Loop | 嵌套循环 | 检查 JOIN 条件索引 |
| Hash Join | 大表连接 | 考虑分页或限制 |

---

## SELECT 优化

### 只查询需要的字段

```typescript
// ❌ 查询所有字段
const users = await db.select().from(usersTable);

// ✅ 只查询需要的字段
const users = await db
  .select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
  })
  .from(usersTable);
```

### 使用聚合函数

```typescript
// ❌ 查询所有数据后在应用层计算
const allOrders = await db.select().from(ordersTable);
const total = allOrders.reduce((sum, o) => sum + o.amount, 0);

// ✅ 在数据库层计算
const [{ total }] = await db
  .select({ total: sql<number>`SUM(${ordersTable.amount})` })
  .from(ordersTable);
```

---

## 分页优化

### 游标分页 (推荐)

```typescript
// ✅ 游标分页：性能稳定，不受数据量影响
async function getItemsWithCursor(cursor?: string, limit = 20) {
  const items = await db
    .select()
    .from(itemsTable)
    .where(cursor ? gt(itemsTable.id, cursor) : undefined)
    .orderBy(asc(itemsTable.id))
    .limit(limit + 1);

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { data, nextCursor, hasMore };
}
```

### 偏移分页 (简单场景)

```typescript
// ⚠️ 偏移分页：大偏移量时性能下降
async function getItemsWithOffset(page: number, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  
  const [items, [{ count }]] = await Promise.all([
    db.select().from(itemsTable).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(itemsTable),
  ]);

  return {
    data: items,
    total: count,
    page,
    pageSize,
    totalPages: Math.ceil(count / pageSize),
  };
}
```

---

## 事务优化

### 批量插入

```typescript
// ❌ 逐条插入
for (const item of items) {
  await db.insert(itemsTable).values(item);
}

// ✅ 批量插入
await db.insert(itemsTable).values(items);

// ✅ 大量数据分批插入
const BATCH_SIZE = 1000;
for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE);
  await db.insert(itemsTable).values(batch);
}
```

### 事务使用

```typescript
// ✅ 使用事务保证一致性
await db.transaction(async (tx) => {
  const [user] = await tx
    .insert(usersTable)
    .values({ name: 'John' })
    .returning();

  await tx.insert(profilesTable).values({
    userId: user.id,
    bio: 'Hello',
  });
});
```

---

## 连接池配置

### Supabase/PostgreSQL 配置

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// 生产环境配置
const client = postgres(process.env.DATABASE_URL!, {
  max: 10,              // 最大连接数
  idle_timeout: 20,     // 空闲超时 (秒)
  connect_timeout: 10,  // 连接超时 (秒)
});

export const db = drizzle(client);
```

---

## 优化检查清单

### 查询结构

- [ ] 是否避免了 N+1 查询？
- [ ] 是否只 SELECT 需要的字段？
- [ ] 是否使用了合适的 JOIN 类型？

### 索引

- [ ] WHERE 条件字段是否有索引？
- [ ] ORDER BY 字段是否有索引？
- [ ] 复合索引顺序是否正确？

### 分页

- [ ] 大数据量是否使用游标分页？
- [ ] 是否避免了大偏移量查询？

### 批量操作

- [ ] 是否使用批量插入/更新？
- [ ] 大批量操作是否分批处理？
