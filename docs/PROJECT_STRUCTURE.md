# EchoAI 项目结构

## 目录结构

```
echoai/
├── packages/                    # 前端模块 (Monorepo)
│   ├── echo/                    # -> vendor/blinko-main (软链接)
│   │   └── 知识管理系统 (Bun)
│   ├── riskcontrol/             # -> riskcontrol (软链接)
│   │   └── 投资风控系统 (npm)
│   └── shared/                  # 共享代码
│       └── context/             # 上下文管理库
│
├── services/                    # 后端服务
│   ├── lightrag/                # -> riskcontrol/lightrag-service
│   │   └── RAG 知识库服务 (Python)
│   └── voice-agent/             # -> riskcontrol/livekit-voice-service
│       └── 语音助手服务 (Python)
│
├── echo/                        # Echo 基础设施
│   ├── docker/                  # Docker 配置
│   ├── docs/                    # Echo 文档 (已整合到 docs/)
│   ├── scripts/                 # 启动脚本
│   └── sidecar/                 # Sidecar 服务 (Janitor 等)
│
├── riskcontrol/                 # RiskControl 完整项目
│   ├── client/                  # 前端代码
│   ├── api/                     # Vercel Functions
│   ├── shared/                  # 共享类型和工具
│   └── ...
│
├── vendor/                      # 第三方源码 (只读参考)
│   ├── blinko-main/             # Blinko 源码
│   └── khoj-main/               # Khoj 源码 (参考)
│
├── docs/                        # 项目文档
├── scripts/                     # 工具脚本
└── .kiro/                       # Kiro 配置
    ├── specs/                   # 功能规格
    ├── steering/                # 开发规范
    └── settings/                # 设置
```

## 开发命令

### 启动开发服务器

```bash
# 同时启动 Echo 和 RiskControl
npm run dev

# 单独启动 Echo (Bun)
npm run dev:echo

# 单独启动 RiskControl (npm)
npm run dev:riskcontrol
```

### 测试

```bash
# 运行所有测试
npm run test

# 单独测试
npm run test:echo
npm run test:riskcontrol
```

### 构建

```bash
npm run build:echo
npm run build:riskcontrol
```

## 包管理器

- **Echo (Blinko)**: Bun
- **RiskControl**: npm
- **根目录**: npm (workspace 管理)

## 软链接说明

项目使用软链接保持代码组织清晰：

| 软链接 | 目标 | 说明 |
|--------|------|------|
| `packages/echo` | `vendor/blinko-main` | Echo 前端 |
| `packages/riskcontrol` | `riskcontrol` | RiskControl 前端 |
| `services/lightrag` | `riskcontrol/lightrag-service` | RAG 服务 |
| `services/voice-agent` | `riskcontrol/livekit-voice-service` | 语音服务 |

## 待迁移项目

RiskControl 整合时需要迁移后端代码：

| 源路径 | 目标路径 | 说明 |
|--------|----------|------|
| `riskcontrol/api/` | `services/api/` | Vercel Functions |
| `riskcontrol/workers/` | `services/workers/` | Cloudflare Workers |
| `riskcontrol/client/` | `packages/riskcontrol/` | 前端代码 (保持软链接) |

## 环境变量

- `.env` - 根目录环境变量
- `riskcontrol/.env` - RiskControl 专用
- `vendor/blinko-main/.env` - Echo 专用
