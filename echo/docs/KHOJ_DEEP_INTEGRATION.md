# Khoj 深度集成方案

> 本文档描述将 Khoj 前端组件深度移植到 Echo 的技术方案
> 遵循"开源优先"原则：Fork 改造，而非重写
> 
> 创建日期: 2025-12-31

---

## 📊 当前状态分析

### Khoj 源码结构 (已下载到 `get/khoj-main/`)

```
get/khoj-main/
├── src/
│   ├── khoj/                    # Python 后端
│   │   ├── routers/             # FastAPI 路由
│   │   │   ├── api_chat.py      # 对话 API
│   │   │   ├── api_agents.py    # Agent API
│   │   │   ├── api_automation.py # 自动化 API
│   │   │   └── api_search.py    # 搜索 API
│   │   └── processor/           # 处理器
│   │       ├── embeddings.py    # Embedding 生成
│   │       └── conversation/    # 对话处理
│   └── interface/
│       └── web/                 # Next.js 前端
│           └── app/
│               ├── page.tsx     # 首页 (Agent 选择 + 对话入口)
│               ├── chat/        # 对话页面
│               ├── agents/      # Agent 管理
│               ├── automations/ # 自动化任务
│               ├── search/      # 搜索页面
│               └── components/  # 可复用组件
│                   ├── chatInputArea/   # 对话输入
│                   ├── chatHistory/     # 对话历史
│                   ├── chatMessage/     # 消息渲染
│                   ├── agentCard/       # Agent 卡片
│                   ├── suggestions/     # 建议卡片
│                   └── referencePanel/  # 引用面板
```

### Echo 当前 Khoj 集成状态

| 组件 | 代码存在 | 实际使用 | 问题 |
|------|---------|---------|------|
| KhojClient | ✅ | ⚠️ 仅健康检查 | 未深度调用 |
| UnifiedSearch | ✅ | ⚠️ 未整合 | 默认禁用 |
| UnifiedChat | ✅ | ⚠️ 主要用 Echo | 模式切换不明显 |
| AgentSelector | ✅ | ⚠️ 依赖 Khoj 启动 | 无 Agent 时隐藏 |
| Knowledge 页面 | ✅ | ⚠️ 依赖 Khoj | 无引导 |
| Automation | ✅ | ❌ 未暴露 UI | 功能完整但无入口 |

---

## 🎯 深度集成目标

### 核心目标

1. **移植 Khoj 前端组件** - 将 Khoj 的 React 组件移植到 Echo
2. **统一 UI 体验** - Khoj 功能无缝融入 Echo 界面
3. **降低使用门槛** - 一键启动，自动配置
4. **增强功能可见性** - 自动化、Agent 等功能在 UI 中可见

### 移植优先级

| 组件 | 优先级 | 价值 | 复杂度 |
|------|--------|------|--------|
| ChatInputArea | P0 | 高 | 中 |
| ChatMessage | P0 | 高 | 高 |
| AgentCard | P1 | 高 | 低 |
| Suggestions | P1 | 中 | 低 |
| Automations | P1 | 高 | 中 |
| ReferencePanel | P2 | 中 | 中 |
| Search | P2 | 中 | 低 |

---

## 📦 组件移植方案

### Phase 1: 对话组件移植 (P0)

#### 1.1 ChatInputArea 移植

**源文件**: `get/khoj-main/src/interface/web/app/components/chatInputArea/chatInputArea.tsx`

**核心功能**:
- 文本输入 + 自动调整高度
- 文件上传 (拖拽 + 点击)
- 图片预览
- 语音输入 (Whisper 转写)
- 斜杠命令 (`/research`, `/paint`, `/code`)
- Research 模式切换

**移植步骤**:
```bash
# 1. 复制组件
cp -r get/khoj-main/src/interface/web/app/components/chatInputArea \
      echo/src/components/khoj/

# 2. 复制样式
cp get/khoj-main/src/interface/web/app/components/chatInputArea/chatInputArea.module.css \
   echo/src/components/khoj/chatInputArea/

# 3. 调整导入路径
# - @/components/ui/* → 使用 Echo 的 shadcn 组件
# - @/app/common/* → 移植或适配
```

**需要适配的依赖**:
- `@/components/ui/command` - Echo 已有
- `@/components/ui/textarea` - Echo 已有
- `@/components/ui/tooltip` - Echo 已有
- `@/app/common/colorUtils` - 需移植
- `@/app/common/iconUtils` - 需移植
- `@/app/common/chatFunctions` - 需移植

#### 1.2 ChatMessage 移植

**源文件**: `get/khoj-main/src/interface/web/app/components/chatMessage/chatMessage.tsx`

**核心功能**:
- Markdown 渲染 (markdown-it + highlight.js)
- LaTeX 公式 (KaTeX)
- 代码块复制
- 图片渲染
- 引用来源显示
- 反馈按钮 (👍/👎)
- 文本转语音
- Train of Thought 展示
- Excalidraw 图表
- Mermaid 图表

**移植步骤**:
```bash
# 1. 复制组件
cp -r get/khoj-main/src/interface/web/app/components/chatMessage \
      echo/src/components/khoj/

# 2. 复制依赖组件
cp -r get/khoj-main/src/interface/web/app/components/excalidraw \
      echo/src/components/khoj/
cp -r get/khoj-main/src/interface/web/app/components/mermaid \
      echo/src/components/khoj/
cp -r get/khoj-main/src/interface/web/app/components/referencePanel \
      echo/src/components/khoj/
```

**需要安装的依赖**:
```json
{
  "markdown-it": "^14.0.0",
  "markdown-it-highlightjs": "^4.0.0",
  "katex": "^0.16.0",
  "dompurify": "^3.0.0",
  "@excalidraw/excalidraw": "^0.17.0",
  "mermaid": "^10.0.0"
}
```

#### 1.3 ChatHistory 移植

**源文件**: `get/khoj-main/src/interface/web/app/components/chatHistory/chatHistory.tsx`

**核心功能**:
- 消息列表渲染
- 无限滚动加载
- 自动滚动到底部
- Train of Thought 折叠
- 消息删除/重试

---

### Phase 2: Agent 系统移植 (P1)

#### 2.1 AgentCard 移植

**源文件**: `get/khoj-main/src/interface/web/app/components/agentCard/agentCard.tsx`

**核心功能**:
- Agent 信息展示
- Agent 创建/编辑表单
- 颜色/图标选择
- 隐私级别设置
- 模型选择

**移植步骤**:
```bash
cp -r get/khoj-main/src/interface/web/app/components/agentCard \
      echo/src/components/khoj/
```

#### 2.2 Agents 页面移植

**源文件**: `get/khoj-main/src/interface/web/app/agents/page.tsx`

**核心功能**:
- 个人 Agent 列表
- 公共 Agent 探索
- Agent 创建入口

**移植目标**: `echo/src/pages/Agents.tsx`

---

### Phase 3: 自动化系统移植 (P1)

#### 3.1 Automations 页面移植

**源文件**: `get/khoj-main/src/interface/web/app/automations/page.tsx`

**核心功能**:
- 自动化任务列表
- Cron 表达式配置
- 任务创建/编辑
- 任务执行/删除
- 建议模板

**移植目标**: `echo/src/pages/Automations.tsx`

**关键组件**:
- `AutomationsCard` - 任务卡片
- `EditCard` - 编辑表单
- `AutomationModificationForm` - 表单组件

---

### Phase 4: 搜索增强 (P2)

#### 4.1 Search 页面移植

**源文件**: `get/khoj-main/src/interface/web/app/search/page.tsx`

**核心功能**:
- 语义搜索
- 文件过滤
- 搜索结果卡片
- 文件上传
- 文件管理

**移植目标**: 增强 `echo/src/pages/Search.tsx`

---

## 🔧 技术适配方案

### 1. 路由适配

| Khoj 路由 | Echo 路由 | 说明 |
|-----------|-----------|------|
| `/` | `/` | 首页 (保持 Echo 风格) |
| `/chat` | `/chat` | 对话页面 |
| `/agents` | `/agents` | Agent 管理 (新增) |
| `/automations` | `/automations` | 自动化 (新增) |
| `/search` | `/search` | 搜索 (增强) |

### 2. API 适配

Khoj 使用 REST API，Echo 使用 tRPC。需要创建适配层：

```typescript
// echo/src/services/khoj/khojAdapter.ts

import { getKhojClient } from './khojClient';

/**
 * 适配 Khoj API 到 Echo 服务层
 */
export const khojAdapter = {
  // 对话
  async chat(message: string, options?: ChatOptions) {
    const client = getKhojClient();
    return client.chat(message, options);
  },

  // 搜索
  async search(query: string, options?: SearchOptions) {
    const client = getKhojClient();
    return client.search(query, options);
  },

  // Agent
  async getAgents() {
    const client = getKhojClient();
    return client.getAgents();
  },

  // 自动化
  async getAutomations() {
    const client = getKhojClient();
    return client.getAutomations();
  },

  async createAutomation(data: AutomationData) {
    const client = getKhojClient();
    return client.createAutomation(data);
  },
};
```

### 3. 样式适配

Khoj 使用 CSS Modules + Tailwind，Echo 也使用相同技术栈，可直接复用：

```css
/* 复制 Khoj 样式文件 */
get/khoj-main/src/interface/web/app/components/*/styles.module.css
→ echo/src/components/khoj/*/styles.module.css
```

### 4. 状态管理适配

Khoj 使用 SWR，Echo 使用 React Query。需要适配：

```typescript
// Khoj 原始代码
const { data, error } = useSWR('/api/agents', fetcher);

// Echo 适配后
const { data, error } = useQuery({
  queryKey: ['khoj', 'agents'],
  queryFn: () => khojAdapter.getAgents(),
});
```

---

## 📁 文件结构规划

```
echo/src/
├── components/
│   └── khoj/                    # Khoj 移植组件
│       ├── chatInputArea/       # 对话输入
│       │   ├── ChatInputArea.tsx
│       │   └── chatInputArea.module.css
│       ├── chatMessage/         # 消息渲染
│       │   ├── ChatMessage.tsx
│       │   └── chatMessage.module.css
│       ├── chatHistory/         # 对话历史
│       │   ├── ChatHistory.tsx
│       │   └── chatHistory.module.css
│       ├── agentCard/           # Agent 卡片
│       │   ├── AgentCard.tsx
│       │   └── agentCard.module.css
│       ├── automationCard/      # 自动化卡片
│       │   ├── AutomationCard.tsx
│       │   └── automationCard.module.css
│       ├── suggestions/         # 建议卡片
│       │   ├── SuggestionCard.tsx
│       │   └── suggestions.module.css
│       ├── referencePanel/      # 引用面板
│       │   ├── ReferencePanel.tsx
│       │   └── referencePanel.module.css
│       ├── excalidraw/          # Excalidraw 图表
│       │   └── Excalidraw.tsx
│       ├── mermaid/             # Mermaid 图表
│       │   └── Mermaid.tsx
│       └── common/              # 公共工具
│           ├── colorUtils.ts
│           ├── iconUtils.ts
│           └── chatFunctions.ts
├── pages/
│   ├── Agents.tsx               # Agent 管理页面 (新增)
│   └── Automations.tsx          # 自动化页面 (新增)
└── services/
    └── khoj/
        ├── khojClient.ts        # 已有
        ├── khojConfig.ts        # 已有
        ├── khojAdapter.ts       # 新增 - API 适配层
        └── automation.ts        # 已有
```

---

## 🚀 实施计划

### Week 1: 基础设施

- [ ] 安装依赖 (markdown-it, katex, excalidraw, mermaid)
- [ ] 移植公共工具 (colorUtils, iconUtils, chatFunctions)
- [ ] 创建 khojAdapter 适配层
- [ ] 配置路由

### Week 2: 对话组件

- [ ] 移植 ChatInputArea
- [ ] 移植 ChatMessage
- [ ] 移植 ChatHistory
- [ ] 集成到 Chat 页面

### Week 3: Agent 系统

- [ ] 移植 AgentCard
- [ ] 创建 Agents 页面
- [ ] 集成 Agent 选择到首页

### Week 4: 自动化系统

- [ ] 移植 AutomationCard
- [ ] 创建 Automations 页面
- [ ] 添加导航入口

### Week 5: 搜索增强

- [ ] 移植搜索组件
- [ ] 增强 Search 页面
- [ ] 集成文件过滤

### Week 6: 测试与优化

- [ ] 端到端测试
- [ ] 性能优化
- [ ] 文档更新

---

## ⚠️ 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 依赖冲突 | 高 | 使用 peerDependencies |
| 样式冲突 | 中 | CSS Modules 隔离 |
| API 不兼容 | 中 | 适配层封装 |
| 性能问题 | 中 | 懒加载组件 |
| Khoj 服务不可用 | 高 | 优雅降级 |

---

## 📊 成功指标

| 指标 | 目标 | 说明 |
|------|------|------|
| 组件移植完成率 | 100% | 所有 P0/P1 组件 |
| 功能可用性 | 95% | 核心功能正常 |
| 用户体验一致性 | 90% | UI 风格统一 |
| 性能无退化 | 100% | 响应时间不增加 |
| 测试覆盖率 | 80% | 核心路径覆盖 |

---

## 🔗 参考资源

- [Khoj 源码](https://github.com/khoj-ai/khoj)
- [Khoj 文档](https://docs.khoj.dev/)
- [Echo 项目文档](./VISION_AND_ARCHITECTURE.md)
- [开源优先原则](../.kiro/steering/open-source-first.md)

---

*本文档遵循"开源优先"原则，所有代码移植基于 Khoj 源码改造，而非重写。*
