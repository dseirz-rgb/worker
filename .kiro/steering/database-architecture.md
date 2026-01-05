---
inclusion: fileMatch
fileMatchPattern: "**/{supabase,database,prisma,drizzle}*"
---

# 数据库架构规范

## 双数据库架构

项目使用两个独立的 Supabase 数据库，各有明确职责：

| 数据库 | 项目 ID | 用途 |
|--------|---------|------|
| **Investment DB** | `lyqspnecudllmnajrrlm` | 投资/风控数据 |
| **Echo DB** | `jwiocrwhqeomoybbwqcp` | 笔记/AI/用户数据 |

## Investment DB (投资数据库)

**连接信息：**
```
URL: https://lyqspnecudllmnajrrlm.supabase.co
DATABASE_URL: postgresql://postgres:DIDIdache2025@db.lyqspnecudllmnajrrlm.supabase.co:5432/postgres
```

**表结构：**
| 表名 | 用途 | 数据来源 |
|------|------|----------|
| `stock_positions` | 股票持仓快照 | IBKR Sync |
| `option_positions` | 期权持仓快照 | IBKR Sync |
| `transactions` | 交易记录 | IBKR Sync / 手动 |
| `asset_snapshots` | 资产快照 | IBKR Sync |
| `nav_changes` | NAV 变动 | IBKR Sync |
| `dashboard_snapshots` | 仪表盘快照 | IBKR Sync |
| `watchlist` | 观察列表 | 用户手动 |
| `investment_notes` | 投资笔记 | 用户手动 |
| `market_data` | 市场数据 | 外部 API |
| `live` | 实时行情 | 长桥 API |
| `alerts` | 预警配置 | 用户配置 |
| `sync_logs` | 同步日志 | 系统 |
| `user_settings` | 用户设置 | 用户配置 |
| `trade_reviews` | 交易复盘 | 用户手动 |

**使用场景：**
- RiskControl 前端所有数据
- 投资组合分析
- 风险指标计算
- IBKR 数据同步

## Echo DB (笔记数据库)

**连接信息：**
```
URL: https://jwiocrwhqeomoybbwqcp.supabase.co
DATABASE_URL: postgresql://postgres:DIDIdache2025%40@db.jwiocrwhqeomoybbwqcp.supabase.co:5432/postgres
# 注意：密码是 DIDIdache2025@ ，@ 符号需要 URL 编码为 %40
```

**表结构：** 由 Prisma schema 管理 (`infra/prisma/schema.prisma`)

主要表：
| 表名 | 用途 |
|------|------|
| `notes` | 笔记内容 |
| `tags` | 标签 |
| `attachments` | 附件 |
| `accounts` | 用户账户 |
| `conversations` | AI 对话 |
| `messages` | 对话消息 |
| `memories` | AI 记忆 |
| `agents` | AI Agent 配置 |
| `automations` | 自动化任务 |
| `config` | 系统配置 |

**使用场景：**
- Echo 主应用所有数据
- 笔记管理
- AI 对话和记忆
- 用户认证

## 数据库选择原则

```
新功能开发时，按以下规则选择数据库：

投资/风控相关 → Investment DB
├── 持仓数据
├── 交易记录
├── 风险指标
├── 市场数据
└── 投资笔记

笔记/AI/用户相关 → Echo DB
├── 笔记内容
├── AI 对话
├── 用户账户
├── 系统配置
└── 文件管理
```

## 跨库查询

**禁止直接 JOIN 两个数据库的表。**

如需聚合数据：
1. 分别查询两个数据库
2. 在应用层合并数据
3. 或通过 API 聚合

## 代码示例

### RiskControl 前端 (Investment DB)
```typescript
// packages/riskcontrol/src/services/supabaseData.ts
const SUPABASE_URL = 'https://lyqspnecudllmnajrrlm.supabase.co';
const supabase = createClient(SUPABASE_URL, ANON_KEY);

// 查询持仓
const { data } = await supabase.from('stock_positions').select('*');
```

### Echo 后端 (Echo DB)
```typescript
// services/echo-server/prisma.ts
// 使用 Prisma ORM 连接 Echo DB
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 查询笔记
const notes = await prisma.notes.findMany();
```

## 备份

两个数据库独立备份：
- 本地: `~/Backups/echoai-db/`
- Google Drive: `~/Google Drive/Backups/echoai-db/`
- 文件命名: `investment_YYYYMMDD_HHMMSS.sql.gz`, `echo_YYYYMMDD_HHMMSS.sql.gz`

## 迁移注意事项

从 RiskControl 独立项目迁移时：
1. 确认数据属于哪个数据库
2. 投资相关数据保持在 Investment DB
3. 不要将投资数据迁移到 Echo DB
4. 保持两个数据库的独立性
