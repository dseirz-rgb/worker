---
name: database-migration
description: |
  数据库迁移技能：安全的数据库 schema 变更工作流。
  Use when: 需要修改数据库结构、执行迁移、回滚变更。
  Triggers: "迁移", "migration", "数据库", "schema", "表结构"
category: deployment
---

# Database Migration (数据库迁移)

> 🔒 **核心理念**: 数据库迁移是高风险操作，必须遵循严格的安全工作流。备份优先，测试先行，回滚就绪。

## 🔴 第一原则：永远不要直接在生产环境执行未测试的迁移

```
❌ 错误做法: 直接在生产数据库执行 ALTER TABLE
✅ 正确做法: 本地测试 → 预发布验证 → 生产执行 → 验证回滚

❌ 错误做法: "这只是加个字段，应该没问题"
✅ 正确做法: 任何 schema 变更都要走完整流程
```

## When to Use This Skill

使用此技能当你需要：
- 添加/删除/修改数据库表或字段
- 创建或修改索引
- 执行数据迁移（data migration）
- 回滚失败的迁移
- 处理破坏性变更（删除字段、修改类型）
- 在生产环境执行 schema 变更

## Not For / Boundaries

此技能不适用于：
- 纯查询优化（不涉及 schema 变更）
- 应用层代码修改
- 数据库备份恢复（参考运维文档）

---

## Quick Reference

### 🎯 迁移安全工作流

```
需求分析 → 编写迁移 → 本地测试 → 备份生产 → 执行迁移 → 验证结果 → 监控
    ↓                                              ↓
  评估风险                                      失败 → 回滚
```

### 📋 迁移前必问清单

| 问题 | 目的 |
|------|------|
| 1. 这是破坏性变更吗？ | 删除/重命名字段需要特殊处理 |
| 2. 数据量有多大？ | 大表迁移需要分批执行 |
| 3. 有没有依赖这个字段的代码？ | 确保代码先兼容 |
| 4. 回滚方案是什么？ | 必须有可执行的回滚脚本 |
| 5. 迁移需要多长时间？ | 评估是否需要维护窗口 |

### ✅ 迁移类型风险等级

| 操作类型 | 风险等级 | 注意事项 |
|----------|----------|----------|
| 添加可空字段 | 🟢 低 | 最安全的操作 |
| 添加带默认值的字段 | 🟡 中 | 大表可能锁表 |
| 添加索引 | 🟡 中 | 使用 CONCURRENTLY |
| 修改字段类型 | 🔴 高 | 可能丢失数据 |
| 删除字段 | 🔴 高 | 不可逆操作 |
| 重命名字段 | 🔴 高 | 需要代码配合 |
| 删除表 | 🔴 极高 | 必须确认无依赖 |

---

## 迁移安全工作流详解

### Phase 1: 备份

**生产环境迁移前必须备份！**

```bash
# Supabase 备份
# 方式 1: 使用 Supabase Dashboard 导出
# 方式 2: 使用 pg_dump

# 导出完整数据库
pg_dump -h <host> -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql

# 只导出 schema
pg_dump -h <host> -U postgres -d postgres --schema-only > schema_backup.sql

# 只导出特定表
pg_dump -h <host> -U postgres -d postgres -t <table_name> > table_backup.sql
```

### Phase 2: 本地测试

```bash
# 1. 生成迁移文件
pnpm drizzle-kit generate

# 2. 检查生成的 SQL
cat drizzle/<migration_file>.sql

# 3. 在本地数据库测试
pnpm drizzle-kit push

# 4. 验证 schema 正确
pnpm drizzle-kit studio
```

### Phase 3: 执行迁移

```bash
# 生产环境迁移
pnpm drizzle-kit push --config=drizzle.config.prod.ts

# 或使用迁移文件
pnpm drizzle-kit migrate
```

### Phase 4: 验证结果

```sql
-- 检查表结构
\d+ <table_name>

-- 检查数据完整性
SELECT COUNT(*) FROM <table_name>;

-- 检查约束
SELECT * FROM information_schema.table_constraints 
WHERE table_name = '<table_name>';
```

---

## Drizzle ORM 迁移指南

### 基本配置

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### 常用命令

```bash
# 生成迁移文件（基于 schema 变更）
pnpm drizzle-kit generate

# 推送 schema 到数据库（开发环境）
pnpm drizzle-kit push

# 执行迁移文件（生产环境）
pnpm drizzle-kit migrate

# 查看数据库状态
pnpm drizzle-kit studio

# 检查 schema 差异
pnpm drizzle-kit check
```

### Schema 定义示例

```typescript
// src/db/schema.ts
import { pgTable, text, timestamp, uuid, boolean, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  content: text('content'),
  authorId: uuid('author_id').references(() => users.id),
  published: boolean('published').default(false),
  viewCount: integer('view_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

---

## 破坏性变更处理

### 删除字段的安全流程

```
1. 代码中移除对该字段的所有引用
2. 部署代码变更
3. 等待确认无问题（建议 24-48 小时）
4. 执行数据库迁移删除字段
```

### 重命名字段的安全流程

```
1. 添加新字段
2. 数据迁移：复制旧字段数据到新字段
3. 代码改为使用新字段
4. 部署代码
5. 确认无问题后删除旧字段
```

### 修改字段类型的安全流程

```
1. 添加新字段（新类型）
2. 数据迁移：转换并复制数据
3. 代码改为使用新字段
4. 部署代码
5. 确认无问题后删除旧字段
```

---

## 回滚策略

### 回滚原则

1. **每个迁移都要有对应的回滚脚本**
2. **回滚脚本必须在执行迁移前测试**
3. **破坏性变更的回滚需要数据恢复**

### 回滚方式

**方式 1: 使用 Drizzle 回滚**
```bash
# Drizzle 目前不支持自动回滚，需要手动编写
```

**方式 2: 手动 SQL 回滚**
```sql
-- 回滚添加字段
ALTER TABLE users DROP COLUMN new_field;

-- 回滚添加索引
DROP INDEX idx_users_email;

-- 回滚添加表
DROP TABLE new_table;
```

**方式 3: 从备份恢复**
```bash
# 恢复完整数据库
psql -h <host> -U postgres -d postgres < backup.sql

# 恢复特定表
psql -h <host> -U postgres -d postgres < table_backup.sql
```

---

## 生产环境迁移注意事项

### 🚨 高风险操作检查清单

- [ ] 已创建数据库备份
- [ ] 已在本地/预发布环境测试
- [ ] 已准备回滚脚本
- [ ] 已通知相关团队成员
- [ ] 已选择低峰期执行
- [ ] 已准备监控告警

### 大表迁移策略

```sql
-- 添加索引时使用 CONCURRENTLY（不锁表）
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- 大表添加字段时分批更新默认值
-- 1. 先添加可空字段
ALTER TABLE large_table ADD COLUMN new_field TEXT;

-- 2. 分批更新数据
UPDATE large_table SET new_field = 'default' 
WHERE id IN (SELECT id FROM large_table WHERE new_field IS NULL LIMIT 10000);

-- 3. 最后添加 NOT NULL 约束
ALTER TABLE large_table ALTER COLUMN new_field SET NOT NULL;
```

### 零停机迁移模式

```
1. 添加新字段（可空）
2. 部署代码：同时写入新旧字段
3. 数据迁移：填充历史数据
4. 部署代码：只读取新字段
5. 删除旧字段
```

---

## Examples

### Example 1: 添加新字段

**Input:** "需要给 users 表添加 avatar_url 字段"

**Steps:**
1. 修改 schema 文件
2. 生成迁移
3. 本地测试
4. 生产执行

**Expected Output:**

```typescript
// src/db/schema.ts
export const users = pgTable('users', {
  // ... 现有字段
  avatarUrl: text('avatar_url'), // 新增可空字段
});
```

```bash
# 生成迁移
pnpm drizzle-kit generate

# 检查生成的 SQL
# ALTER TABLE users ADD COLUMN avatar_url TEXT;

# 执行迁移
pnpm drizzle-kit push
```

### Example 2: 安全删除字段

**Input:** "需要删除 users 表的 legacy_field 字段"

**Steps:**
1. 确认代码中无引用
2. 备份数据
3. 执行删除

**Expected Output:**

```bash
# 1. 搜索代码确认无引用
grep -r "legacy_field" src/

# 2. 备份该字段数据
psql -c "COPY (SELECT id, legacy_field FROM users) TO '/tmp/legacy_backup.csv' CSV HEADER;"

# 3. 修改 schema 移除字段
# 4. 生成并执行迁移
pnpm drizzle-kit generate
pnpm drizzle-kit push
```

### Example 3: 添加索引

**Input:** "users 表的 email 查询很慢，需要添加索引"

**Steps:**
1. 分析查询模式
2. 创建索引
3. 验证性能

**Expected Output:**

```typescript
// src/db/schema.ts
import { pgTable, text, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
}));
```

```sql
-- 生产环境使用 CONCURRENTLY 避免锁表
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
```

---

## References

- `references/drizzle-templates.md`: Drizzle ORM 迁移代码模板
- `references/rollback-strategies.md`: 各类迁移的回滚策略

---

## Maintenance

- **Sources**: Drizzle ORM 官方文档, PostgreSQL 最佳实践
- **Last Updated**: 2025-01-01
- **Known Limits**: 
  - 回滚策略依赖手动编写
  - 大规模数据迁移需要额外工具支持
