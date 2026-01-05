# Requirements Document

## Introduction

投资数据库 (`lyqspnecudllmnajrrlm`) 的表结构被意外覆盖，需要恢复表结构并从 IBKR 重新同步数据。同时，为防止类似事故再次发生，需要建立每日本地数据库备份机制。

## Glossary

- **Investment_DB**: 投资数据库，Supabase 项目 `lyqspnecudllmnajrrlm`，存储持仓、交易、净值等投资数据
- **Echo_DB**: Echo 数据库，Supabase 项目 `jwiocrwhqeomoybbwqcp`，存储笔记、任务等日常数据
- **IBKR_Sync**: 从 Interactive Brokers Flex Query API 同步数据到数据库的过程
- **Local_Backup**: 本地 PostgreSQL dump 文件，用于数据恢复

## Requirements

### Requirement 1: 投资数据库表结构恢复

**User Story:** As a user, I want the investment database tables restored, so that the application can store and retrieve investment data.

#### Acceptance Criteria

1. THE System SHALL create all required tables in Investment_DB: `asset_snapshots`, `dashboard_snapshots`, `nav_changes`, `cash_reports`, `transactions`, `stock_positions`, `watchlist`, `user_settings`, `risk_metrics`, `trade_reviews`
2. THE System SHALL create appropriate indexes for query performance
3. THE System SHALL grant proper permissions to the `anon` role for frontend access
4. WHEN tables are created, THE System SHALL verify each table is accessible via Supabase client

### Requirement 2: IBKR 数据重新同步

**User Story:** As a user, I want my investment data restored from IBKR, so that I can see my current portfolio and historical performance.

#### Acceptance Criteria

1. WHEN the database tables are ready, THE System SHALL trigger IBKR Flex Query sync
2. THE IBKR_Sync SHALL populate `asset_snapshots` with historical net worth data
3. THE IBKR_Sync SHALL populate `dashboard_snapshots` with detailed daily snapshots
4. THE IBKR_Sync SHALL populate `transactions` with trade history
5. WHEN sync completes, THE System SHALL verify data integrity by checking record counts

### Requirement 3: 每日本地数据库备份

**User Story:** As a user, I want automatic daily backups of my databases, so that I can recover from accidental data loss.

#### Acceptance Criteria

1. THE System SHALL create a backup script that dumps both Investment_DB and Echo_DB
2. THE Backup_Script SHALL run automatically once per day (via cron or launchd)
3. THE Backup_Script SHALL save dumps to a local directory with date-stamped filenames
4. THE Backup_Script SHALL retain backups for at least 30 days
5. THE Backup_Script SHALL delete backups older than 30 days to save disk space
6. IF a backup fails, THEN THE System SHALL log the error for troubleshooting

### Requirement 4: 数据库恢复脚本

**User Story:** As a user, I want a simple way to restore from backups, so that I can quickly recover from data loss.

#### Acceptance Criteria

1. THE System SHALL provide a restore script that can restore from a specific backup file
2. THE Restore_Script SHALL support restoring individual tables or full database
3. WHEN restoring, THE System SHALL prompt for confirmation before overwriting data
4. THE Restore_Script SHALL verify the backup file integrity before restoring

