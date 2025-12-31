# Design Document - Khoj 深度集成 (Blinko)

## Overview

本设计基于已完成的统一 API 网关架构，将 Khoj 功能深度集成到 Blinko 中。
核心思路是：前端通过 tRPC 调用后端，后端通过 KhojClient 调用 Khoj 服务。

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Blinko Frontend                        │
├─────────────────────────────────────────────────────────────┤
│  pages/                                                     │
│  ├── khoj.tsx (原生对话页面)                                 │
│  ├── agents.tsx (Agent 管理)                                │
│  └── automations.tsx (自动化任务)                            │
├─────────────────────────────────────────────────────────────┤
│  components/khoj/                                           │
│  ├── chatInputArea/ (已有)                                  │
│  ├── chatMessage/ (已有)                                    │
│  ├── chatHistory/ (已有)                                    │
│  ├── agentCard/ (新增)                                      │
│  └── automationCard/ (新增)                                 │
├─────────────────────────────────────────────────────────────┤
│  lib/gateway.ts (khojService)                               │
│       ↓ tRPC                                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Blinko Backend                         │
├─────────────────────────────────────────────────────────────┤
│  routerTrpc/khoj.ts (已完成)                                │
│       ↓                                                     │
│  lib/khojClient.ts (已完成)                                 │
│       ↓ HTTP                                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Khoj Service                           │
│                   (localhost:42110)                         │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. 页面组件

#### 1.1 原生对话页面 (`pages/khoj.tsx`)

当前是 iframe 方案，需要改为原生组件：

```typescript
// 使用已有的 Khoj 组件
import { ChatHistory } from '@/components/khoj/chatHistory/chatHistory';
import { ChatInputArea } from '@/components/khoj/chatInputArea/chatInputArea';
import { ChatMessage } from '@/components/khoj/chatMessage/chatMessage';

// 通过 tRPC 调用
import { api } from '@/lib/trpc';

export default function KhojPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // 使用 tRPC mutation
  const chatMutation = api.khoj.chat.useMutation();
  
  const handleSend = async (message: string) => {
    const result = await chatMutation.mutateAsync({
      message,
      conversationId,
    });
    // 更新消息列表
  };
  
  return (
    <div className="flex flex-col h-full">
      <ChatHistory messages={messages} />
      <ChatInputArea onSend={handleSend} />
    </div>
  );
}
```

#### 1.2 Agent 管理页面 (`pages/agents.tsx`)

```typescript
export default function AgentsPage() {
  const { data: agents } = api.khoj.getAgents.useQuery();
  const createMutation = api.khoj.createAgent.useMutation();
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {agents?.map(agent => (
        <AgentCard key={agent.slug} agent={agent} />
      ))}
      <CreateAgentCard onCreate={createMutation.mutate} />
    </div>
  );
}
```

#### 1.3 自动化页面 (`pages/automations.tsx`)

```typescript
export default function AutomationsPage() {
  const { data: automations } = api.khoj.getAutomations.useQuery();
  const createMutation = api.khoj.createAutomation.useMutation();
  
  return (
    <div className="space-y-4">
      <AutomationList automations={automations} />
      <CreateAutomationForm onCreate={createMutation.mutate} />
    </div>
  );
}
```

### 2. 新增组件

#### 2.1 AgentCard 组件

```typescript
// components/khoj/agentCard/AgentCard.tsx
interface AgentCardProps {
  agent: KhojAgent;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function AgentCard({ agent, onSelect, onEdit, onDelete }: AgentCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Avatar style={{ backgroundColor: agent.color }}>
          <Icon icon={agent.icon} />
        </Avatar>
        <div>
          <h3 className="font-medium">{agent.name}</h3>
          <p className="text-sm text-default-500">{agent.persona}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <Button size="sm" onClick={onSelect}>选择</Button>
        <Button size="sm" variant="flat" onClick={onEdit}>编辑</Button>
        <Button size="sm" variant="flat" color="danger" onClick={onDelete}>删除</Button>
      </div>
    </Card>
  );
}
```

#### 2.2 AutomationCard 组件

```typescript
// components/khoj/automationCard/AutomationCard.tsx
interface AutomationCardProps {
  automation: KhojAutomation;
  onRun?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function AutomationCard({ automation, onRun, onEdit, onDelete }: AutomationCardProps) {
  return (
    <Card className="p-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium">{automation.subject}</h3>
          <p className="text-sm text-default-500">{automation.query_to_run}</p>
          <p className="text-xs text-default-400">
            {cronstrue.toString(automation.schedule)}
          </p>
        </div>
        <Chip size="sm" color={automation.next ? 'success' : 'default'}>
          {automation.next ? '已启用' : '已禁用'}
        </Chip>
      </div>
      <div className="flex gap-2 mt-4">
        <Button size="sm" onClick={onRun}>立即运行</Button>
        <Button size="sm" variant="flat" onClick={onEdit}>编辑</Button>
        <Button size="sm" variant="flat" color="danger" onClick={onDelete}>删除</Button>
      </div>
    </Card>
  );
}
```

### 3. 后端 API (已完成)

`server/routerTrpc/khoj.ts` 已包含所有需要的 procedures：

- `chat` - 发送消息
- `getConversations` - 获取对话列表
- `getConversation` - 获取对话详情
- `deleteConversation` - 删除对话
- `search` - 语义搜索
- `getAgents` - 获取 Agent 列表
- `getAgent` - 获取单个 Agent
- `createAgent` - 创建 Agent
- `updateAgent` - 更新 Agent
- `deleteAgent` - 删除 Agent
- `getAutomations` - 获取自动化列表
- `createAutomation` - 创建自动化
- `deleteAutomation` - 删除自动化

## Data Models

### KhojAgent (已在 khojClient.ts 定义)

```typescript
interface KhojAgent {
  slug: string;
  name: string;
  persona: string;
  color?: string;
  icon?: string;
  privacy_level?: string;
  chat_model?: string;
  tools?: string[];
}
```

### KhojAutomation (已在 khojClient.ts 定义)

```typescript
interface KhojAutomation {
  id: string;
  subject: string;
  query_to_run: string;
  schedule: string;  // cron 表达式
  next?: string;     // 下次执行时间
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: API Gateway Consistency

*For any* Khoj API call from the frontend, it SHALL go through tRPC and use the unified gateway error handling.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 2: Service Availability Handling

*For any* Khoj feature page, if the Khoj service is unavailable, the page SHALL display a user-friendly error with retry option.

**Validates: Requirements 1.6, 6.4**

### Property 3: Agent CRUD Consistency

*For any* Agent created through the UI, it SHALL be retrievable from the Agent list, and deleting it SHALL remove it from the list.

**Validates: Requirements 2.1, 2.3, 2.4**

### Property 4: Automation CRUD Consistency

*For any* Automation created through the UI, it SHALL be retrievable from the Automation list, and deleting it SHALL remove it from the list.

**Validates: Requirements 3.1, 3.2, 3.4**

## Error Handling

所有错误通过 `GatewayError` 统一处理：

```typescript
// 前端错误处理示例
const { error } = api.khoj.chat.useMutation({
  onError: (error) => {
    if (error.data?.code === 'SERVICE_UNAVAILABLE') {
      toast.error('Khoj 服务不可用，请检查服务状态');
    } else {
      toast.error(error.message);
    }
  },
});
```

## Testing Strategy

### 单元测试

- 测试 AgentCard 组件渲染
- 测试 AutomationCard 组件渲染
- 测试表单验证逻辑

### 集成测试

- 测试 Agent CRUD 流程
- 测试 Automation CRUD 流程
- 测试对话流程

### 属性测试

- 使用 fast-check 测试 API 调用的一致性
- 测试错误处理的完整性

