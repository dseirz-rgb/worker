# 项目交接文档

> 最后更新: 2026-01-03

## 当前状态

项目已完成 RiskControl 前端整合到 Echo，统一为单一前端应用。

## 已完成功能

### EchoAI 核心 ✅
- AI 对话界面、智能建议、每日报告
- 语义搜索、引用面板、思考过程
- 研究模式、斜杠命令、语音输入
- 文件上传、消息反馈、TTS

### RiskControl 整合 ✅ (2026-01-03)
- 统一认证服务 (UnifiedAuthService)
- 双数据库架构 (DualDatabaseClient)
- 模块导航 (ModuleNavigator)
- API Gateway 路由
- 双 Agent 语音服务 (DualAgentVoiceService)
- RAG 知识库隔离 (IsolatedRAGService)
- WebSocket 实时通信 (WebSocketGateway)
- 风控功能 (CircuitBreaker, EmotionDetector, PriceAlert)
- 外部集成 (IBKR, Resend, Gemini, TradingView)
- Tauri App 配置 (TauriConfigService)

### 前端整合 ✅ (2026-01-03)
- 投资模块侧边栏菜单（9 个子菜单项）
- 14 个投资页面迁移到 Echo
- MobX InvestmentStore 状态管理
- HeroUI 组件统一
- 响应式布局（桌面/平板/移动端）
- 错误边界隔离

### 文档管理 ✅
- 文件上传和预览
- 全文搜索 (PostgreSQL FTS)
- 文档元数据管理、OCR 处理

## 架构变更 (前端整合)

### 统一前端结构

```
packages/echo/src/
├── pages/
│   ├── investment/           # 投资模块页面
│   │   ├── index.tsx         # Dashboard
│   │   ├── portfolio.tsx     # 持仓管理
│   │   ├── market.tsx        # 市场分析
│   │   ├── decision.tsx      # 决策中心
│   │   ├── mirror.tsx        # 投资镜像
│   │   ├── notes.tsx         # 动态笔记
│   │   ├── voice.tsx         # 语音通话
│   │   ├── annual-review.tsx # 年度回顾
│   │   ├── showcase.tsx      # 组件展示
│   │   ├── agent-demo.tsx    # Agent 演示
│   │   └── risk/             # 风控子模块
│   │       ├── index.tsx     # 风险中心
│   │       ├── intelligent.tsx # 智能风控
│   │       ├── engine.tsx    # 风险引擎
│   │       └── settings.tsx  # 风险设置
│   └── ...                   # Echo 原有页面
├── components/
│   └── investment/           # 投资模块组件
│       ├── InvestmentSidebarItem.tsx
│       ├── InvestmentErrorBoundary.tsx
│       └── InvestmentRouteWrapper.tsx
└── store/
    └── investmentStore.ts    # MobX 状态管理
```

### 访问路由

| 路由 | 页面 |
|------|------|
| `/investment` | 投资 Dashboard |
| `/investment/portfolio` | 持仓管理 |
| `/investment/risk` | 风险中心 |
| `/investment/risk/intelligent` | 智能风控 |
| `/investment/risk/engine` | 风险引擎 |
| `/investment/risk/settings` | 风险设置 |
| `/investment/market` | 市场分析 |
| `/investment/decision` | 决策中心 |
| `/investment/mirror` | 投资镜像 |
| `/investment/notes` | 动态笔记 |
| `/investment/voice` | 语音通话 |
| `/investment/review` | 年度回顾 |
| `/investment/showcase` | 组件展示 |
| `/investment/agent-demo` | Agent 演示 |

## 环境配置

### 必需的环境变量

```bash
# .env (根目录)

# Echo 数据库
DATABASE_URL=postgresql://...

# RiskControl Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...

# 前端环境变量 (Vite)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_USE_MOCK_QLIB=true

# AI 服务
DOUBAO_API_KEY=...
```

### 开发端口

| 服务 | 端口 |
|------|------|
| Echo 前端/后端 | 1111 |
| Janitor | 8766 |
| PostgreSQL | 5432 |

### 启动命令

```bash
# 启动开发服务（只需启动 Echo）
npm run dev

# 或直接启动 Echo
npm run dev:echo

# 访问
# Echo 主应用: http://localhost:1111
# 投资模块: http://localhost:1111/investment

# 运行测试
npm test
```

## 注意事项

- RiskControl 独立前端已废弃，所有功能已整合到 Echo
- 投资模块使用 MobX 状态管理（InvestmentStore）
- 所有投资页面使用 HeroUI 组件
- 错误边界确保投资模块错误不会影响整个应用
- 响应式布局支持桌面、平板、移动端
