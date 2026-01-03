# 基础设施配置 (Infrastructure)

此目录包含项目的基础设施配置文件。

## 目录结构

```
infra/
├── docker/         # Docker 配置
│   ├── Dockerfile.blinko     # Blinko UI 镜像
│   ├── Dockerfile.janitor    # Janitor 服务镜像
│   ├── Dockerfile.postgres   # PostgreSQL 镜像 (含中文搜索)
│   └── scripts/              # 初始化脚本
│       └── init-postgres.sql
│
├── prisma/         # 数据库 Schema (Echo/Blinko)
│   ├── schema.prisma         # Prisma Schema 定义
│   ├── migrations/           # 数据库迁移文件
│   ├── seed.ts               # 种子数据脚本
│   └── seedfiles/            # 种子数据文件
│
└── deploy/         # 部署脚本 (待添加)
```

## 使用说明

### Docker

从项目根目录运行：

```bash
# 开发环境
docker-compose -f docker-compose.dev.yml up -d

# 生产环境
docker-compose up -d
```

### Prisma

```bash
# 生成 Prisma Client
cd vendor/blinko-main && npx prisma generate

# 运行迁移
cd vendor/blinko-main && npx prisma migrate dev

# 种子数据
cd vendor/blinko-main && npx prisma db seed
```

## 迁移说明

此目录从以下位置迁移而来：
- `vendor/blinko-main/prisma/` → `infra/prisma/`
- `echo/docker/` → `infra/docker/`

迁移日期: 2026-01-03
