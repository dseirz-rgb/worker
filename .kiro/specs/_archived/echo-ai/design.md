# Design Document - EchoAI

## Overview

EchoAI 是 Echo 项目的 AI 对话模块，基于 Khoj 后端服务提供智能对话能力。本设计将现有的 iframe 嵌入方案重构为原生 React 组件，并将品牌从 Khoj 统一为 EchoAI。

### 设计目标

1. **品牌统一** - 前端显示统一为 Echo/EchoAI
2. **原生体验** - 使用原生 React 组件替代 iframe
3. **功能完整** - 对话、Agent、自动化、日报
4. **渐进式重构** - 保留后端 API 不变，仅重构前端

## Architecture

### 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    Echo App (前端)                       │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  EchoAI     │  │   Agents    │  │ Automations │     │
│  │  对话页面   │  │   管理页面  │  │   任务页面  │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│  ┌──────┴────────────────┴────────────────┴──────┐     │
│  │              useEchoAIChat Hook               │     │
│  │         (对话状态管理 + API 调用)              │     │
│  └──────────────────────┬────────────────────────┘     │
│                         │                               │
│  ┌──────────────────────┴────────────────────────┐     │
│  │              tRPC Client (api.khoj.*)          │     │
│  └──────────────────────┬────────────────────────┘     │
└─────────────────────────┼───────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────┐
│                    Echo Server (后端)                    │
├─────────────────────────┼───────────────────────────────┤
│  ┌──────────────────────┴────────────────────────┐     │
│  │              khoj.ts (tRPC Router)             │     │
│  │         (保持不变，仅前端重命名)               │     │
│  └──────────────────────┬────────────────────────┘     │
│                         │                               │
│  ┌──────────────────────┴────────────────────────┐     │
│  │              khojClient.ts                     │     │
│  │         (Khoj API 客户端)                      │     │
│  └──────────────────────┬────────────────────────┘     │
└─────────────────────────┼───────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────┐
│                    Khoj Service (Docker)                 │
│                    http://localhost:42110                │
└─────────────────────────────────────────────────────────┘
```

### 文件结构

```
get/blinko-main/app/src/
├── pages/
│   ├── echoai.tsx           # 重命名: khoj.tsx → echoai.tsx
│   ├── agents.tsx           # 已有，需更新
│   └── automations.tsx      # 已有，需更新
├── components/
│   ├── echoai/              # 重命名: khoj/ → echoai/
│   │   ├── ChatPage.tsx     # 新增：主对话页面组件
│   │   ├── ChatSidebar.tsx  # 新增：对话列表侧边栏
│   │   ├── AgentCard.tsx    # 新增：Agent 卡片
│   │   ├── AgentForm.tsx    # 新增：Agent 表单
│   │   ├── AutomationCard.tsx  # 新增：自动化卡片
│   │   ├── AutomationForm.tsx  # 新增：自动化表单
│   │   ├── chatInputArea/   # 已有
│   │   ├── chatMessage/     # 已有
│   │   └── chatHistory/     # 已有
│   └── BlinkoSettings/
│       └── EchoAISetting.tsx  # 重命名: KhojSetting.tsx
├── hooks/
│   └── useEchoAIChat.ts     # 新增：对话状态管理
└── lib/
    └── echoaiService.ts     # 重命名: khojService.ts
```

## Components and Interfaces

### 1. useEchoAIChat Hook

```typescript
interface UseEchoAIChatReturn {
  // 状态
  messages: ChatMessage[];
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // 操作
  sendMessage: (content: string, agentSlug?: string) => Promise<void>;
  createConversation: () => Promise<void>;
  switchConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  clearError: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  references?: Reference[];
}

interface Conversation {
  id: string;
  title: string;
  agentSlug?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. ChatPage 组件

```typescript
interface ChatPageProps {
  // 无需 props，使用 hook 管理状态
}

// 布局结构
// ┌─────────────────────────────────────────┐
// │ ┌─────────┐ ┌─────────────────────────┐ │
// │ │ 对话    │ │ 消息区域                │ │
// │ │ 列表    │ │                         │ │
// │ │         │ │                         │ │
// │ │ [新建]  │ │                         │ │
// │ │ 对话1   │ │                         │ │
// │ │ 对话2   │ ├─────────────────────────┤ │
// │ │ ...     │ │ 输入框                  │ │
// │ └─────────┘ └─────────────────────────┘ │
// └─────────────────────────────────────────┘
```

### 3. Agent 管理组件

```typescript
interface Agent {
  slug: string;
  name: string;
  persona: string;
  avatar?: string;
  color?: string;
  tools?: string[];
  inputTools?: string[];
  outputModes?: string[];
  chatModel?: string;
}

interface AgentCardProps {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (slug: string) => void;
  onSelect: (slug: string) => void;
}

interface AgentFormProps {
  agent?: Agent;  // 编辑时传入
  onSubmit: (agent: Agent) => void;
  onCancel: () => void;
}
```

### 4. Automation 管理组件

```typescript
interface Automation {
  id: string;
  subject: string;
  queryToRun: string;
  schedule: string;  // Cron 表达式
  nextRun?: Date;
  lastRun?: Date;
}

interface AutomationCardProps {
  automation: Automation;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
}

interface AutomationFormProps {
  onSubmit: (automation: Omit<Automation, 'id'>) => void;
  onCancel: () => void;
}
```

## Data Models

### 对话消息流

```typescript
// 发送消息请求
interface SendMessageRequest {
  q: string;           // 用户消息
  client: string;      // 客户端标识 "echo"
  stream: boolean;     // 是否流式
  conversation_id?: string;
  agent?: string;      // Agent slug
}

// 消息响应 (流式)
interface MessageChunk {
  type: 'message' | 'references' | 'end';
  data?: string;
  references?: Reference[];
}
```

### 本地存储

```typescript
// 存储当前对话 ID
localStorage.setItem('echoai_current_conversation', conversationId);

// 存储用户偏好
localStorage.setItem('echoai_preferences', JSON.stringify({
  defaultAgent: 'default',
  theme: 'auto',
}));
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: 消息顺序一致性

*For any* 对话会话，发送的消息和接收的回复 SHALL 按时间顺序显示，不会出现乱序。

**Validates: Requirements 2.2**

### Property 2: 对话切换完整性

*For any* 对话切换操作，切换后显示的消息 SHALL 完全属于目标对话，不会混入其他对话的消息。

**Validates: Requirements 2.3**

### Property 3: Agent 配置持久性

*For any* Agent 创建或更新操作，保存后重新加载 SHALL 返回相同的配置数据。

**Validates: Requirements 3.3, 3.4**

### Property 4: 自动化任务调度正确性

*For any* Cron 表达式配置，显示的"下次执行时间" SHALL 与 Cron 表达式计算结果一致。

**Validates: Requirements 4.6**

## Error Handling

### 服务离线处理

```typescript
// 检测服务状态
const { isOnline, error } = useServiceStatus('echoai');

// 离线时显示提示
if (!isOnline) {
  return (
    <ErrorState
      title="EchoAI 服务离线"
      description="请检查服务是否正常运行"
      action={<Button onClick={retry}>重试</Button>}
    />
  );
}
```

### 消息发送失败

```typescript
try {
  await sendMessage(content);
} catch (error) {
  // 显示错误提示，保留用户输入
  toast.error('发送失败，请重试');
  // 不清空输入框，让用户可以重试
}
```

## Testing Strategy

### 单元测试

- useEchoAIChat hook 状态管理测试
- 消息渲染组件测试
- Agent/Automation 表单验证测试

### 集成测试

- 完整对话流程测试
- Agent CRUD 流程测试
- 自动化任务创建流程测试

### E2E 测试

- 使用 Chrome DevTools MCP 进行页面交互测试
- 验证消息发送和接收
- 验证导航和路由

## Migration Plan

### Phase 1: 品牌重命名

1. 重命名组件目录 `khoj/` → `echoai/`
2. 重命名页面文件 `khoj.tsx` → `echoai.tsx`
3. 更新路由 `/khoj` → `/echoai`
4. 更新导航菜单显示名称
5. 更新 i18n 翻译文件

### Phase 2: 原生对话页面

1. 创建 useEchoAIChat hook
2. 创建 ChatPage 组件
3. 创建 ChatSidebar 组件
4. 集成已有的 chatMessage/chatInputArea 组件
5. 移除 iframe 方案

### Phase 3: Agent 管理

1. 创建 AgentCard 组件
2. 创建 AgentForm 组件
3. 更新 agents.tsx 页面
4. 集成 Agent 选择到对话页面

### Phase 4: 自动化任务

1. 创建 AutomationCard 组件
2. 创建 AutomationForm 组件
3. 更新 automations.tsx 页面
4. 添加 Cron 表达式友好选择器

### Phase 5: 日报系统

1. 创建日报生成 API 调用
2. 创建日报显示组件
3. 实现建议接受/拒绝功能
