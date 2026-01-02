# 数据库迁移回滚策略

> 每种迁移操作的回滚方法和注意事项

## 回滚原则

### 🔴 核心原则

1. **每个迁移都要有对应的回滚脚本**
2. **回滚脚本必须在执行迁移前测试**
3. **破坏性变更的回滚需要数据恢复**
4. **回滚后必须验证数据完整性**

### 回滚决策流程

```
迁移失败 → 评估影响 → 选择回滚方式 → 执行回滚 → 验证数据 → 分析原因
                ↓
           影响范围大 → 从备份恢复
```

---

## 按操作类型的回滚策略

### 1. 添加字段 (ADD COLUMN)

**风险等级**: 🟢 低

**迁移 SQL**:
```sql
ALTER TABLE users ADD COLUMN phone TEXT;
```

**回滚 SQL**:
```sql
ALTER TABLE users DROP COLUMN phone;
```

**注意事项**:
- 如果字段已有数据，回滚会丢失数据
- 建议先备份该字段数据再回滚

**数据保护回滚**:
```sql
-- 1. 备份数据
CREATE TABLE users_phone_backup AS 
SELECT id, phone FROM users WHERE phone IS NOT NULL;

-- 2. 执行回滚
ALTER TABLE users DROP COLUMN phone;

-- 3. 如需恢复，重新添加字段并恢复数据
ALTER TABLE users ADD COLUMN phone TEXT;
UPDATE users u SET phone = b.phone 
FROM users_phone_backup b WHERE u.id = b.id;
```

---

### 2. 添加带默认值的字段 (ADD COLUMN WITH DEFAULT)

**风险等级**: 🟡 中

**迁移 SQL**:
```sql
ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
```

**回滚 SQL**:
```sql
ALTER TABLE users DROP COLUMN is_active;
```

**注意事项**:
- 大表添加带默认值的 NOT NULL 字段可能锁表
- 回滚简单，但会丢失所有该字段的数据

---

### 3. 删除字段 (DROP COLUMN)

**风险等级**: 🔴 高 - 不可逆操作

**迁移 SQL**:
```sql
ALTER TABLE users DROP COLUMN legacy_field;
```

**回滚策略**: 必须从备份恢复

**预防措施**:
```sql
-- 迁移前必须备份
CREATE TABLE users_legacy_field_backup AS 
SELECT id, legacy_field FROM users;

-- 或导出到文件
COPY (SELECT id, legacy_field FROM users) 
TO '/tmp/legacy_field_backup.csv' CSV HEADER;
```

**恢复步骤**:
```sql
-- 1. 重新添加字段
ALTER TABLE users ADD COLUMN legacy_field TEXT;

-- 2. 从备份恢复数据
UPDATE users u SET legacy_field = b.legacy_field 
FROM users_legacy_field_backup b WHERE u.id = b.id;

-- 3. 清理备份表
DROP TABLE users_legacy_field_backup;
```

---

### 4. 重命名字段 (RENAME COLUMN)

**风险等级**: 🔴 高

**迁移 SQL**:
```sql
ALTER TABLE users RENAME COLUMN old_name TO new_name;
```

**回滚 SQL**:
```sql
ALTER TABLE users RENAME COLUMN new_name TO old_name;
```

**注意事项**:
- 回滚简单，但需要同步回滚代码
- 建议使用安全的重命名流程（添加新字段 → 迁移数据 → 删除旧字段）

---

### 5. 修改字段类型 (ALTER COLUMN TYPE)

**风险等级**: 🔴 高 - 可能丢失数据

**迁移 SQL**:
```sql
ALTER TABLE users ALTER COLUMN age TYPE BIGINT;
```

**回滚 SQL**:
```sql
ALTER TABLE users ALTER COLUMN age TYPE INTEGER;
```

**注意事项**:
- 类型转换可能失败（如 TEXT → INTEGER）
- 可能丢失精度（如 BIGINT → INTEGER）
- 建议使用安全流程

**安全修改类型流程**:
```sql
-- 1. 添加新字段
ALTER TABLE users ADD COLUMN age_new BIGINT;

-- 2. 迁移数据
UPDATE users SET age_new = age;

-- 3. 验证数据
SELECT COUNT(*) FROM users WHERE age_new IS NULL AND age IS NOT NULL;

-- 4. 删除旧字段
ALTER TABLE users DROP COLUMN age;

-- 5. 重命名新字段
ALTER TABLE users RENAME COLUMN age_new TO age;
```

**回滚（如果使用安全流程）**:
```sql
-- 在步骤 4 之前可以简单回滚
ALTER TABLE users DROP COLUMN age_new;
```

---

### 6. 添加索引 (CREATE INDEX)

**风险等级**: 🟢 低

**迁移 SQL**:
```sql
CREATE INDEX idx_users_email ON users(email);
-- 或不锁表版本
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
```

**回滚 SQL**:
```sql
DROP INDEX idx_users_email;
-- 或
DROP INDEX CONCURRENTLY idx_users_email;
```

**注意事项**:
- 索引回滚不会丢失数据
- 回滚后查询性能可能下降

---

### 7. 删除索引 (DROP INDEX)

**风险等级**: 🟡 中

**迁移 SQL**:
```sql
DROP INDEX idx_users_email;
```

**回滚 SQL**:
```sql
CREATE INDEX idx_users_email ON users(email);
```

**注意事项**:
- 需要知道原索引的定义
- 建议迁移前记录索引定义

**记录索引定义**:
```sql
-- 查看索引定义
SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_users_email';
```

---

### 8. 添加表 (CREATE TABLE)

**风险等级**: 🟢 低

**迁移 SQL**:
```sql
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);
```

**回滚 SQL**:
```sql
DROP TABLE new_table;
```

**注意事项**:
- 如果表已有数据，回滚会丢失数据
- 如果有外键依赖，需要先处理依赖

---

### 9. 删除表 (DROP TABLE)

**风险等级**: 🔴 极高 - 不可逆操作

**迁移 SQL**:
```sql
DROP TABLE old_table;
```

**回滚策略**: 必须从备份恢复

**预防措施**:
```sql
-- 迁移前必须完整备份表
CREATE TABLE old_table_backup AS SELECT * FROM old_table;

-- 或导出到文件
pg_dump -t old_table > old_table_backup.sql
```

**恢复步骤**:
```sql
-- 从备份表恢复
CREATE TABLE old_table AS SELECT * FROM old_table_backup;

-- 或从文件恢复
psql < old_table_backup.sql
```

---

### 10. 添加约束 (ADD CONSTRAINT)

**风险等级**: 🟡 中

**迁移 SQL**:
```sql
-- 添加唯一约束
ALTER TABLE users ADD CONSTRAINT unique_email UNIQUE (email);

-- 添加外键约束
ALTER TABLE posts ADD CONSTRAINT fk_author 
FOREIGN KEY (author_id) REFERENCES users(id);

-- 添加检查约束
ALTER TABLE users ADD CONSTRAINT check_age CHECK (age >= 0);
```

**回滚 SQL**:
```sql
ALTER TABLE users DROP CONSTRAINT unique_email;
ALTER TABLE posts DROP CONSTRAINT fk_author;
ALTER TABLE users DROP CONSTRAINT check_age;
```

**注意事项**:
- 添加约束可能因现有数据不符合而失败
- 回滚简单，不会丢失数据

---

### 11. 删除约束 (DROP CONSTRAINT)

**风险等级**: 🟡 中

**迁移 SQL**:
```sql
ALTER TABLE users DROP CONSTRAINT unique_email;
```

**回滚 SQL**:
```sql
ALTER TABLE users ADD CONSTRAINT unique_email UNIQUE (email);
```

**注意事项**:
- 需要知道原约束的定义
- 回滚时可能因数据变化而失败

**记录约束定义**:
```sql
-- 查看约束定义
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'users'::regclass;
```

---

## 批量回滚策略

### 多个迁移的回滚

```sql
-- 按相反顺序回滚
-- 假设迁移顺序: A → B → C
-- 回滚顺序: C → B → A

BEGIN;

-- 回滚 C
DROP INDEX idx_new;

-- 回滚 B
ALTER TABLE users DROP COLUMN new_field;

-- 回滚 A
DROP TABLE new_table;

COMMIT;
```

### 事务回滚

```sql
BEGIN;

-- 执行迁移
ALTER TABLE users ADD COLUMN phone TEXT;
CREATE INDEX idx_users_phone ON users(phone);

-- 如果出错，自动回滚
-- 如果成功，提交
COMMIT;
```

---

## 从备份恢复

### 完整数据库恢复

```bash
# 1. 停止应用连接
# 2. 恢复数据库
psql -h <host> -U postgres -d postgres < full_backup.sql

# 或使用 pg_restore
pg_restore -h <host> -U postgres -d postgres full_backup.dump
```

### 单表恢复

```bash
# 从备份文件恢复单表
psql -h <host> -U postgres -d postgres < table_backup.sql
```

### 时间点恢复 (PITR)

```bash
# 需要启用 WAL 归档
# 恢复到指定时间点
recovery_target_time = '2024-01-15 10:30:00'
```

---

## 回滚检查清单

### 回滚前

- [ ] 确认回滚 SQL 正确
- [ ] 确认回滚不会造成更大问题
- [ ] 通知相关团队
- [ ] 准备数据验证脚本

### 回滚后

- [ ] 验证表结构正确
- [ ] 验证数据完整性
- [ ] 验证应用功能正常
- [ ] 记录回滚原因和过程

---

## 回滚脚本模板

### 标准回滚脚本

```sql
-- 回滚脚本: rollback_20240115_add_phone_field.sql
-- 原迁移: 20240115_add_phone_field.sql
-- 作者: developer
-- 日期: 2024-01-15

-- 前置检查
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'phone'
  ) THEN
    RAISE EXCEPTION 'Column phone does not exist, nothing to rollback';
  END IF;
END $$;

-- 备份数据（可选）
CREATE TABLE IF NOT EXISTS _rollback_backup_phone AS 
SELECT id, phone FROM users WHERE phone IS NOT NULL;

-- 执行回滚
ALTER TABLE users DROP COLUMN phone;

-- 验证
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'phone'
  ) THEN
    RAISE EXCEPTION 'Rollback failed: column phone still exists';
  END IF;
END $$;

-- 完成
SELECT 'Rollback completed successfully' AS status;
```

---

## 紧急回滚流程

### 生产环境紧急回滚

```
1. 评估影响范围
   - 受影响的表/数据量
   - 受影响的功能/用户

2. 决定回滚方式
   - SQL 回滚（影响小）
   - 备份恢复（影响大）

3. 通知相关人员
   - 开发团队
   - 运维团队
   - 产品/业务团队

4. 执行回滚
   - 在事务中执行
   - 记录执行日志

5. 验证恢复
   - 检查数据完整性
   - 检查应用功能

6. 事后分析
   - 记录问题原因
   - 更新迁移流程
```
