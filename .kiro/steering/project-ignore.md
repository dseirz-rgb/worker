# 项目忽略规则

## 不需要关注的目录

以下目录在大多数任务中不需要加载：

- `node_modules/` - 依赖包，除非调试依赖问题
- `.git/` - Git 内部文件
- `tiktoken_cache/` - 缓存文件
- `vendor/khoj-main/` - 第三方源码（只读参考）
- `.pids/` - 进程 ID 文件
- `dist/` - 构建输出
- `.turbo/` - Turbo 缓存
- `.vercel/` - Vercel 缓存

## 不需要关注的文件类型

- `.DS_Store` - macOS 系统文件
- `*.zip` - 压缩包
- `*.log` - 日志文件（除非调试）
- `*.lock` - 锁文件（除非解决依赖问题）

## 核心关注区域

当前项目的核心代码在：

### 前端
- `packages/echo/` - Echo 前端（链接到 vendor/blinko-main）
- `packages/riskcontrol/` - RiskControl 前端（链接到 riskcontrol）
- `packages/shared/` - 共享代码

### 后端
- `services/` - 后端服务
- `riskcontrol/api/` - RiskControl API（待迁移）
- `riskcontrol/workers/` - Workers（待迁移）

### 配置
- `.kiro/` - Kiro 配置
- `docs/` - 项目文档
- `scripts/` - 工具脚本

## 配置文件

需要关注的配置：
- `.env.example` - 环境变量模板
- `docker-compose.yml` - Docker 配置
- `package.json` - 项目依赖
- `tsconfig.json` - TypeScript 配置
