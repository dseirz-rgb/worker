# Drizzle ORM 迁移代码模板

> 常用的 Drizzle ORM schema 定义和迁移模板

## 基础表定义模板

### 标准表结构

```typescript
import { 
  pgTable, 
  uuid, 
  text, 
  timestamp, 
  boolean, 
  integer,
  jsonb,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';

// 标准表模板（带审计字段）
export const exampleTable = pgTable('example_table', {
  // 主键
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 业务字段
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').default('active'),
  metadata: jsonb('metadata'),
  
  // 审计字段
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'), // 软删除
}, (table) => ({
  // 索引
  nameIdx: index('idx_example_name').on(table.name),
  statusIdx: index('idx_example_status').on(table.status),
}));
```

### 用户表模板

```typescript
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 认证信息
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  
  // 个人信息
  name: text('name'),
  avatarUrl: text('avatar_url'),
  
  // 状态
  emailVerified: boolean('email_verified').default(false),
  isActive: boolean('is_active').default(true),
  
  // 审计
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
}, (table) => ({
  emailIdx: uniqueIndex('idx_users_email').on(table.email),
}));
```

### 关联表模板

```typescript
// 一对多关系
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  content: text('content'),
  
  // 外键
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  authorIdx: index('idx_posts_author').on(table.authorId),
}));

// 多对多关系（中间表）
export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id')
    .notNull()
    .references(() => roles.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.roleId] }),
}));
```

---

## 字段类型模板

### 常用字段类型

```typescript
import { 
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  bigint,
  real,
  doublePrecision,
  numeric,
  boolean,
  timestamp,
  date,
  time,
  jsonb,
  json,
  pgEnum
} from 'drizzle-orm/pg-core';

// 枚举类型
export const statusEnum = pgEnum('status', ['pending', 'active', 'inactive', 'deleted']);

export const allTypesExample = pgTable('all_types', {
  // 标识符
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 字符串
  shortText: varchar('short_text', { length: 255 }),
  longText: text('long_text'),
  
  // 数字
  count: integer('count').default(0),
  bigNumber: bigint('big_number', { mode: 'number' }),
  price: numeric('price', { precision: 10, scale: 2 }),
  rating: real('rating'),
  preciseValue: doublePrecision('precise_value'),
  
  // 布尔
  isEnabled: boolean('is_enabled').default(true),
  
  // 日期时间
  createdAt: timestamp('created_at').defaultNow(),
  birthDate: date('birth_date'),
  startTime: time('start_time'),
  
  // JSON
  settings: jsonb('settings').$type<{ theme: string; notifications: boolean }>(),
  rawData: json('raw_data'),
  
  // 枚举
  status: statusEnum('status').default('pending'),
});
```

### 数组字段

```typescript
import { pgTable, uuid, text } from 'drizzle-orm/pg-core';

export const tagsExample = pgTable('tags_example', {
  id: uuid('id').primaryKey().defaultRandom(),
  tags: text('tags').array(), // TEXT[]
});
```

---

## 索引模板

### 各类索引定义

```typescript
import { 
  pgTable, 
  uuid, 
  text, 
  timestamp,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';

export const indexedTable = pgTable('indexed_table', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  name: text('name'),
  status: text('status'),
  category: text('category'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // 唯一索引
  emailUnique: uniqueIndex('idx_unique_email').on(table.email),
  
  // 普通索引
  nameIdx: index('idx_name').on(table.name),
  
  // 复合索引
  statusCategoryIdx: index('idx_status_category').on(table.status, table.category),
  
  // 部分索引（需要原生 SQL）
  // activeIdx: index('idx_active').on(table.status).where(sql`status = 'active'`),
}));
```

---

## 迁移操作模板

### 添加字段

```typescript
// schema.ts 修改前
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
});

// schema.ts 修改后
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  phone: text('phone'), // 新增可空字段
});

// 生成的 SQL
// ALTER TABLE users ADD COLUMN phone TEXT;
```

### 添加带默认值的字段

```typescript
// 新增带默认值的字段
export const users = pgTable('users', {
  // ...
  isVerified: boolean('is_verified').default(false).notNull(),
});

// 生成的 SQL
// ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT false;
```

### 添加外键

```typescript
// 添加外键关联
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  
  // 新增外键
  categoryId: uuid('category_id')
    .references(() => categories.id, { 
      onDelete: 'set null',
      onUpdate: 'cascade'
    }),
});
```

### 修改字段（需要手动 SQL）

```sql
-- 修改字段类型
ALTER TABLE users ALTER COLUMN age TYPE BIGINT;

-- 修改字段默认值
ALTER TABLE users ALTER COLUMN status SET DEFAULT 'active';

-- 移除默认值
ALTER TABLE users ALTER COLUMN status DROP DEFAULT;

-- 添加 NOT NULL 约束
ALTER TABLE users ALTER COLUMN name SET NOT NULL;

-- 移除 NOT NULL 约束
ALTER TABLE users ALTER COLUMN name DROP NOT NULL;
```

---

## 关系定义模板

### Drizzle Relations

```typescript
import { relations } from 'drizzle-orm';

// 用户表
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
});

// 文章表
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title'),
  authorId: uuid('author_id').references(() => users.id),
});

// 评论表
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content'),
  postId: uuid('post_id').references(() => posts.id),
  authorId: uuid('author_id').references(() => users.id),
});

// 定义关系
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));
```

---

## 配置文件模板

### drizzle.config.ts

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Schema 文件位置
  schema: './src/db/schema.ts',
  
  // 迁移文件输出目录
  out: './drizzle',
  
  // 数据库类型
  dialect: 'postgresql',
  
  // 数据库连接
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  
  // 可选配置
  verbose: true,
  strict: true,
});
```

### 多环境配置

```typescript
// drizzle.config.dev.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DEV_DATABASE_URL!,
  },
});

// drizzle.config.prod.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.PROD_DATABASE_URL!,
  },
});
```

---

## 数据库客户端模板

### 基础客户端

```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// 创建连接
const client = postgres(connectionString);

// 创建 Drizzle 实例
export const db = drizzle(client, { schema });

// 导出 schema
export * from './schema';
```

### Supabase 客户端

```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.SUPABASE_DB_URL!;

// Supabase 连接配置
const client = postgres(connectionString, {
  prepare: false, // Supabase 需要禁用 prepared statements
});

export const db = drizzle(client, { schema });
```

---

## 查询示例模板

### 基础 CRUD

```typescript
import { db, users, posts } from './db';
import { eq, and, or, like, desc, asc } from 'drizzle-orm';

// 创建
const newUser = await db.insert(users).values({
  email: 'user@example.com',
  name: 'User Name',
}).returning();

// 查询
const user = await db.query.users.findFirst({
  where: eq(users.email, 'user@example.com'),
});

// 更新
await db.update(users)
  .set({ name: 'New Name' })
  .where(eq(users.id, userId));

// 删除
await db.delete(users)
  .where(eq(users.id, userId));
```

### 关联查询

```typescript
// 查询用户及其文章
const userWithPosts = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    posts: true,
  },
});

// 查询文章及作者
const postWithAuthor = await db.query.posts.findFirst({
  where: eq(posts.id, postId),
  with: {
    author: true,
    comments: {
      with: {
        author: true,
      },
    },
  },
});
```
