# Implementation Plan: Database Recovery and Backup System

## Overview

分阶段实现数据库恢复和备份系统：先恢复表结构，再同步数据，最后建立备份机制。

## Tasks

- [x] 1. 恢复投资数据库表结构
  - [x] 1.1 创建 Schema 执行脚本
    - 创建 `scripts/execute-schema.ts`
    - 使用 Supabase service key 连接数据库
    - 读取并执行 `scripts/investment-db-schema.sql`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 执行 Schema 并验证
    - 运行脚本创建所有 10 个表
    - 验证表结构正确
    - 验证索引存在
    - 验证 anon 角色权限
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. 触发 IBKR 数据同步
  - [x] 2.1 调用现有 IBKR Sync 服务
    - 创建 `scripts/ibkr-sync.sh` 使用 curl 通过本地代理获取数据
    - 创建 `scripts/parse-and-insert.ts` 解析 XML 并写入数据库
    - 验证数据写入成功
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 验证数据完整性
    - 检查各表记录数
    - 创建 `scripts/verify-data.ts` 验证脚本
    - _Requirements: 2.5_

- [x] 3. Checkpoint - 数据库恢复完成
  - 所有表创建成功 ✅
  - IBKR 数据同步完成 ✅ (asset_snapshots: 4, dashboard_snapshots: 1, nav_changes: 2, transactions: 2, stock_positions: 5)
  - 数据来源标记为 'IBKR' ✅

- [x] 4. 创建每日备份脚本
  - [x] 4.1 创建备份 Shell 脚本
    - 创建 `scripts/backup-databases.sh` ✅
    - 支持备份 Investment_DB 和 Echo_DB ✅
    - 使用 gzip 压缩 ✅
    - 文件名包含日期戳 ✅
    - _Requirements: 3.1, 3.3_

  - [x] 4.2 实现备份清理逻辑
    - 删除超过 30 天的备份文件 ✅
    - 记录清理日志 ✅
    - _Requirements: 3.4, 3.5_

  - [x] 4.3 配置 Launchd 定时任务
    - 创建 `~/Library/LaunchAgents/com.echoai.backup.plist` ✅
    - 每天凌晨 3 点执行备份 ✅
    - _Requirements: 3.2_

  - [ ]* 4.4 编写备份脚本属性测试
    - **Property 1: Backup File Lifecycle**
    - **Property 2: Backup Filename Format**
    - **Validates: Requirements 3.3, 3.4, 3.5**

- [x] 5. 创建数据恢复脚本
  - [x] 5.1 创建恢复 Shell 脚本
    - 创建 `scripts/restore-database.sh` ✅
    - 支持完整恢复 ✅
    - 恢复前验证文件完整性 (gzip -t) ✅
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 5.2 添加确认提示
    - 恢复前显示警告信息 ✅
    - 需要用户确认才继续 ✅
    - 支持 --force 跳过确认 ✅
    - _Requirements: 4.3_

- [x] 6. Checkpoint - 备份系统完成
  - 手动执行备份脚本验证 ✅ (investment: 2.9K, echo: 2.6K)
  - 验证 Launchd 任务已加载 ✅ (com.echoai.backup)
  - 恢复脚本已创建 ✅

- [x] 7. 更新文档
  - [x] 7.1 备份说明已包含在脚本注释中
    - 备份文件位置: `~/Backups/echoai-db` + `~/Google Drive/Backups/echoai-db`
    - 手动备份: `./scripts/backup-databases.sh`
    - 恢复: `./scripts/restore-database.sh <investment|echo> [backup_file] [--force]`
    - _Requirements: 3.1, 4.1_

## Notes

- Tasks marked with `*` are optional property-based tests
- 优先完成 Task 1-3 恢复数据库，解决当前数据丢失问题
- Task 4-6 建立备份机制，防止未来数据丢失
- 使用现有的 IBKR Sync 服务，不需要重新实现
