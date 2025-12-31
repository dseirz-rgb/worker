# Design Document - AI 服务统一迁移

## Overview

本设计将 Echo on Blinko 的 AI 能力从双系统 (Mastra + Khoj) 统一到单一 Mastra 框架。核心策略是：短期优化现有集成，中期在 Mastra 上实现 Khoj 高价值功能，长期完全迁移并废弃 Khoj。

## Architecture

### 当前架构 (迁移前)

```
┌─────────────────────────────────────────────────────────────┐
│                    Echo on Blinko                           │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                              │
│  ├── EchoAI Components                                      │
│  ├── Khoj Pages (iframe/API)                               │
│  └── Agent/Automation Pages                                 │
├─────────────────────────────────────────────────────────────┤
│  Backend (Node.js + tRPC)                                   │
│  ├── Mastra AI Service                                      │
│  │   ├── Memory System ✅                                   │
│  │   ├── RAG ✅                                             │
│  │   └── Basic Agent ✅                                     │
│  └── Khoj Client (API Proxy)                               │
├─────────────────────────────────────────────────────────────┤
│  External Services                                          │
│  ├── PostgreSQL                                             │
│  ├── Khoj Server (Python) ← 待废弃                          │
│  └── Janitor (Python)                                       │
└─────────────────────────────────────────────────────────────┘
```

### 目标架构 (迁移后)

```
┌─────────────────────────────────────────────────────────────┐
│                    Echo on Blinko                           │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                              │
│  ├── EchoAI Components                                      │
│  ├── Agent Management UI                                    │
│  ├── Automation UI                                          │
│  └── Research UI                                            │
├─────────────────────────────────────────────────────────────┤
│  Backend (Node.js + tRPC)                                   │
│  └── Unified Mastra AI Service                              │
│      ├── Memory System                                      │
│      ├── RAG + Vector Search                                │
│      ├── Research Agent                                     │
│      ├── Agent Management                                   │
│      ├── Automation System                                  │
│      └── Tool Registry                                      │
├─────────────────────────────────────────────────────────────┤
│  External Services                                          │
│  ├── PostgreSQL (统一数据存储)                               │
│  ├── Tavily API (网络搜索)                                  │
│  └── Janitor (Python)                                       │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Research Agent

```typescript
// server/aiServer/researchAgent.ts

interface ResearchConfig {
  maxIterations: number;        // 最大迭代次数，默认 5
  searchDepth: 'shallow' | 'deep';
  tools: ('rag' | 'web' | 'files')[];
  timeout: number;              // 超时时间 (ms)
}

interface ResearchSource {
  type: 'note' | 'web' | 'file';
  title: string;
  url?: string;
  noteId?: number;
  snippet: string;
  relevance: number;
}

interface ResearchIteration {
  iteration: number;
  query: string;
  findings: string;
  sources: ResearchSource[];
  nextSteps: string[];
}

interface ResearchResult {
  summary: string;
  sources: ResearchSource[];
  iterations: ResearchIteration[];
  confidence: number;
  totalTime: number;
}

class ResearchAgent {
  private config: ResearchConfig;
  private tools: ToolRegistry;
  private memory: MemoryManager;

  constructor(accountId: number, config?: Partial<ResearchConfig>) {
    this.config = {
      maxIterations: 5,
      searchDepth: 'deep',
      tools: ['rag', 'web'],
      timeout: 120000,
      ...config,
    };
  }

  /**
   * 执行多轮研究
   */
  async *research(query: string): AsyncGenerator<ResearchIteration, ResearchResult> {
    const iterations: ResearchIteration[] = [];
    const allSources: ResearchSource[] = [];
    let currentQuery = query;

    for (let i = 0; i < this.config.maxIterations; i++) {
      // 1. 搜索本地笔记
      const ragResults = await this.searchNotes(currentQuery);
      
      // 2. 搜索网络 (如果启用)
      const webResults = this.config.tools.includes('web') 
        ? await this.searchWeb(currentQuery) 
        : [];

      // 3. 分析结果，生成发现
      const findings = await this.analyzeResults(currentQuery, [...ragResults, ...webResults]);
      
      // 4. 决定下一步
      const nextSteps = await this.planNextSteps(query, findings, iterations);

      const iteration: ResearchIteration = {
        iteration: i + 1,
        query: currentQuery,
        findings: findings.summary,
        sources: findings.sources,
        nextSteps,
      };

      iterations.push(iteration);
      allSources.push(...findings.sources);
      
      yield iteration;

      // 如果没有下一步，结束研究
      if (nextSteps.length === 0 || nextSteps[0] === 'COMPLETE') {
        break;
      }

      currentQuery = nextSteps[0];
    }

    // 生成最终总结
    const summary = await this.generateSummary(query, iterations);
    
    return {
      summary,
      sources: this.deduplicateSources(allSources),
      iterations,
      confidence: this.calculateConfidence(iterations),
      totalTime: Date.now() - startTime,
    };
  }

  private async searchNotes(query: string): Promise<ResearchSource[]> {
    const { notes } = await AiModelFactory.queryVector(query, this.accountId);
    return notes.map(note => ({
      type: 'note',
      title: note.content.slice(0, 50),
      noteId: note.id,
      snippet: note.content.slice(0, 200),
      relevance: note.score || 0.5,
    }));
  }

  private async searchWeb(query: string): Promise<ResearchSource[]> {
    const tavily = new TavilyClient(process.env.TAVILY_API_KEY);
    const results = await tavily.search(query, { maxResults: 5 });
    return results.map(r => ({
      type: 'web',
      title: r.title,
      url: r.url,
      snippet: r.content,
      relevance: r.score,
    }));
  }
}
```

### 2. Agent 管理系统

```typescript
// server/aiServer/agentManager.ts

interface AgentConfig {
  id: number;
  slug: string;
  name: string;
  persona: string;
  systemPrompt: string;
  tools: string[];
  modelId?: number;
  privacy: 'public' | 'private';
  accountId: number;
}

class AgentManager {
  /**
   * 创建 Agent
   */
  async createAgent(data: Omit<AgentConfig, 'id'>): Promise<AgentConfig> {
    const slug = this.generateSlug(data.name);
    
    const agent = await prisma.agent.create({
      data: {
        slug,
        name: data.name,
        persona: data.persona,
        systemPrompt: data.systemPrompt,
        tools: data.tools,
        modelId: data.modelId,
        privacy: data.privacy,
        accountId: data.accountId,
      },
    });

    return agent;
  }

  /**
   * 获取 Agent 列表
   */
  async getAgents(accountId: number): Promise<AgentConfig[]> {
    return prisma.agent.findMany({
      where: {
        OR: [
          { accountId },
          { privacy: 'public' },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 使用 Agent 生成响应
   */
  async chat(
    agentId: number,
    messages: CoreMessage[],
    options?: { stream?: boolean }
  ): Promise<AgentResponse> {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error('Agent not found');

    // 构建系统提示
    const systemMessages: CoreMessage[] = [
      { role: 'system', content: agent.systemPrompt },
      { role: 'system', content: `你的名字是 ${agent.name}。${agent.persona}` },
    ];

    // 获取可用工具
    const tools = await this.getAgentTools(agent.tools);

    // 创建 Mastra Agent
    const mastraAgent = await AiModelFactory.BaseChatAgent({
      withTools: tools.length > 0,
      customTools: tools,
    });

    return mastraAgent.stream([...systemMessages, ...messages]);
  }
}
```

### 3. 自动化任务系统

```typescript
// server/aiServer/automationManager.ts

interface AutomationConfig {
  id: number;
  name: string;
  query: string;
  schedule: string;              // cron 表达式
  naturalSchedule?: string;      // 自然语言调度
  agentId?: number;
  resultStorage: 'note' | 'memory' | 'both';
  notificationChannels: string[];
  isEnabled: boolean;
  accountId: number;
}

interface AutomationRun {
  id: number;
  automationId: number;
  status: 'pending' | 'running' | 'success' | 'failed';
  result?: string;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

class AutomationManager {
  private scheduler: NodeSchedule;

  /**
   * 创建自动化任务
   */
  async createAutomation(data: Omit<AutomationConfig, 'id'>): Promise<AutomationConfig> {
    // 解析自然语言调度
    let schedule = data.schedule;
    if (data.naturalSchedule) {
      schedule = await this.parseNaturalSchedule(data.naturalSchedule);
    }

    const automation = await prisma.aiScheduledTask.create({
      data: {
        name: data.name,
        prompt: data.query,
        schedule,
        isEnabled: data.isEnabled,
        accountId: data.accountId,
        // 扩展字段存储在 metadata
        metadata: {
          agentId: data.agentId,
          resultStorage: data.resultStorage,
          notificationChannels: data.notificationChannels,
          naturalSchedule: data.naturalSchedule,
        },
      },
    });

    // 注册调度
    if (data.isEnabled) {
      this.scheduleTask(automation);
    }

    return automation;
  }

  /**
   * 解析自然语言调度
   */
  private async parseNaturalSchedule(text: string): Promise<string> {
    const agent = await AiModelFactory.BaseChatAgent({ withTools: false });
    const result = await agent.generate([
      {
        role: 'system',
        content: `将自然语言时间描述转换为 cron 表达式。只返回 cron 表达式，不要其他内容。
示例:
- "每天早上9点" -> "0 9 * * *"
- "每周一下午3点" -> "0 15 * * 1"
- "每小时" -> "0 * * * *"`,
      },
      { role: 'user', content: text },
    ]);
    return result.text.trim();
  }

  /**
   * 执行自动化任务
   */
  async runAutomation(automationId: number): Promise<AutomationRun> {
    const automation = await prisma.aiScheduledTask.findUnique({
      where: { id: automationId },
    });

    const run = await prisma.automationRun.create({
      data: {
        automationId,
        status: 'running',
        startedAt: new Date(),
      },
    });

    try {
      // 使用 Research Agent 或普通 Agent
      const metadata = automation.metadata as any;
      let result: string;

      if (metadata?.agentId) {
        const agentManager = new AgentManager();
        const response = await agentManager.chat(metadata.agentId, [
          { role: 'user', content: automation.prompt },
        ]);
        result = response.text;
      } else {
        const researchAgent = new ResearchAgent(automation.accountId);
        const research = await researchAgent.research(automation.prompt);
        result = research.summary;
      }

      // 存储结果
      await this.storeResult(automation, result, metadata);

      // 发送通知
      await this.sendNotifications(automation, result, metadata);

      // 更新运行记录
      await prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: 'success',
          result,
          completedAt: new Date(),
        },
      });

      return run;
    } catch (error) {
      await prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          error: error.message,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }
}
```

### 4. 工具注册系统

```typescript
// server/aiServer/toolRegistry.ts

interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (params: any, context: ToolContext) => Promise<any>;
  permissions?: string[];
}

interface ToolContext {
  accountId: number;
  agentId?: number;
}

class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.registerBuiltinTools();
  }

  private registerBuiltinTools() {
    // 笔记搜索
    this.register({
      name: 'searchNotes',
      description: '搜索用户笔记',
      parameters: z.object({
        query: z.string(),
        limit: z.number().optional().default(10),
      }),
      execute: async (params, ctx) => {
        const { notes } = await AiModelFactory.queryVector(params.query, ctx.accountId);
        return notes.slice(0, params.limit);
      },
    });

    // 网络搜索
    this.register({
      name: 'webSearch',
      description: '搜索互联网获取最新信息',
      parameters: z.object({
        query: z.string(),
        maxResults: z.number().optional().default(5),
      }),
      execute: async (params) => {
        const tavily = new TavilyClient(process.env.TAVILY_API_KEY);
        return tavily.search(params.query, { maxResults: params.maxResults });
      },
      permissions: ['web_access'],
    });

    // 网页内容提取
    this.register({
      name: 'readWebpage',
      description: '读取网页内容',
      parameters: z.object({
        url: z.string().url(),
      }),
      execute: async (params) => {
        const response = await fetch(params.url);
        const html = await response.text();
        // 使用 cheerio 提取正文
        const $ = cheerio.load(html);
        $('script, style, nav, footer, header').remove();
        return $('body').text().slice(0, 5000);
      },
      permissions: ['web_access'],
    });

    // 创建笔记
    this.register({
      name: 'createNote',
      description: '创建新笔记',
      parameters: z.object({
        content: z.string(),
        type: z.enum(['blinko', 'note', 'todo']).optional().default('note'),
      }),
      execute: async (params, ctx) => {
        return prisma.notes.create({
          data: {
            content: params.content,
            type: params.type === 'blinko' ? 0 : params.type === 'note' ? 1 : 2,
            accountId: ctx.accountId,
          },
        });
      },
      permissions: ['write_notes'],
    });
  }

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  getTools(names?: string[]): ToolDefinition[] {
    if (!names) return Array.from(this.tools.values());
    return names.map(n => this.tools.get(n)).filter(Boolean);
  }

  async execute(name: string, params: any, context: ToolContext): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    
    // 检查权限
    if (tool.permissions?.length) {
      await this.checkPermissions(tool.permissions, context);
    }

    // 记录执行日志
    console.log(`[Tool] Executing ${name}`, params);
    
    const result = await tool.execute(params, context);
    
    console.log(`[Tool] ${name} completed`);
    return result;
  }
}
```

## Data Models

### 新增 Prisma Schema

```prisma
// 添加到 prisma/schema.prisma

// Agent 管理
model agent {
  id          Int      @id @default(autoincrement())
  slug        String   @unique @db.VarChar(100)
  name        String   @db.VarChar(255)
  persona     String?  @db.Text
  systemPrompt String  @db.Text
  tools       String[] @default([])
  modelId     Int?
  privacy     String   @default("private") @db.VarChar(20)
  accountId   Int
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @db.Timestamptz(6)

  account     accounts @relation(fields: [accountId], references: [id])
  model       aiModels? @relation(fields: [modelId], references: [id])

  @@index([accountId])
  @@index([privacy])
}

// 自动化运行记录
model automationRun {
  id           Int      @id @default(autoincrement())
  automationId Int
  status       String   @db.VarChar(20)
  result       String?  @db.Text
  error        String?  @db.Text
  startedAt    DateTime @db.Timestamptz(6)
  completedAt  DateTime? @db.Timestamptz(6)

  automation   aiScheduledTask @relation(fields: [automationId], references: [id])

  @@index([automationId])
  @@index([status])
}

// 研究会话
model researchSession {
  id          Int      @id @default(autoincrement())
  query       String   @db.Text
  summary     String?  @db.Text
  iterations  Json     @db.Json
  sources     Json     @db.Json
  confidence  Float    @default(0)
  status      String   @db.VarChar(20)
  accountId   Int
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  completedAt DateTime? @db.Timestamptz(6)

  account     accounts @relation(fields: [accountId], references: [id])

  @@index([accountId])
  @@index([status])
}

// 功能开关
model featureFlag {
  id          Int      @id @default(autoincrement())
  key         String   @unique @db.VarChar(100)
  value       Boolean  @default(false)
  accountId   Int?     // null 表示全局
  metadata    Json?    @db.Json
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @db.Timestamptz(6)

  account     accounts? @relation(fields: [accountId], references: [id])

  @@unique([key, accountId])
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: Research Agent 迭代一致性

*For any* research query, the Research_Agent SHALL produce iterations where each iteration's findings are based on the previous iteration's next steps, and the final summary SHALL reference all discovered sources.

**Validates: Requirements 2.1, 2.2, 2.6**

### Property 2: Agent 配置持久性

*For any* Agent created through the UI, retrieving that Agent SHALL return the same configuration (name, persona, tools, systemPrompt) that was saved.

**Validates: Requirements 3.2, 3.3**

### Property 3: 自动化调度准确性

*For any* automation with a cron schedule, the System SHALL execute the task within 60 seconds of the scheduled time.

**Validates: Requirements 4.1, 4.2**

### Property 4: 工具权限隔离

*For any* tool execution, if the Agent does not have the required permission, the System SHALL reject the execution and return an error.

**Validates: Requirements 5.5**

### Property 5: 数据迁移完整性

*For any* Khoj conversation migrated to Mastra, the message count and content SHALL be identical before and after migration.

**Validates: Requirements 6.2, 6.3**

### Property 6: 功能开关路由正确性

*For any* feature flag configuration, requests SHALL be routed to the correct service (Mastra or Khoj) based on the flag value.

**Validates: Requirements 7.2, 7.4**

## Error Handling

### Research Agent 错误处理

```typescript
class ResearchError extends Error {
  constructor(
    message: string,
    public code: 'TIMEOUT' | 'NO_RESULTS' | 'TOOL_FAILED' | 'ITERATION_LIMIT',
    public partialResult?: Partial<ResearchResult>
  ) {
    super(message);
  }
}

// 使用示例
try {
  const result = await researchAgent.research(query);
} catch (error) {
  if (error instanceof ResearchError) {
    if (error.code === 'TIMEOUT' && error.partialResult) {
      // 返回部分结果
      return { ...error.partialResult, isPartial: true };
    }
  }
  throw error;
}
```

### 服务降级策略

```typescript
class AIServiceRouter {
  async chat(messages: CoreMessage[], options: ChatOptions) {
    const useKhoj = await this.shouldUseKhoj(options);
    
    try {
      if (useKhoj) {
        return await this.khojClient.chat(messages);
      }
      return await this.mastraService.chat(messages);
    } catch (error) {
      // 降级到另一个服务
      if (useKhoj) {
        console.warn('Khoj failed, falling back to Mastra');
        return await this.mastraService.chat(messages);
      }
      throw error;
    }
  }
}
```

## Testing Strategy

### 单元测试

- Research Agent 迭代逻辑
- Agent 配置 CRUD
- 自动化调度解析
- 工具权限检查

### 集成测试

- Research Agent 端到端流程
- Agent 对话流程
- 自动化任务执行
- 数据迁移验证

### 属性测试 (fast-check)

```typescript
import fc from 'fast-check';

// Property 1: Research 迭代一致性
test('research iterations reference previous findings', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 5, maxLength: 100 }),
      async (query) => {
        const agent = new ResearchAgent(testAccountId, { maxIterations: 3 });
        const result = await collectIterations(agent.research(query));
        
        // 验证每个迭代的 query 来自上一个迭代的 nextSteps
        for (let i = 1; i < result.iterations.length; i++) {
          const prev = result.iterations[i - 1];
          const curr = result.iterations[i];
          expect(prev.nextSteps).toContain(curr.query);
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

// Property 2: Agent 配置持久性
test('agent config round-trip', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }),
        persona: fc.string({ maxLength: 500 }),
        systemPrompt: fc.string({ minLength: 10, maxLength: 2000 }),
        tools: fc.array(fc.constantFrom('searchNotes', 'webSearch', 'createNote')),
      }),
      async (config) => {
        const manager = new AgentManager();
        const created = await manager.createAgent({
          ...config,
          privacy: 'private',
          accountId: testAccountId,
        });
        
        const retrieved = await manager.getAgent(created.id);
        
        expect(retrieved.name).toBe(config.name);
        expect(retrieved.persona).toBe(config.persona);
        expect(retrieved.systemPrompt).toBe(config.systemPrompt);
        expect(retrieved.tools).toEqual(config.tools);
        
        // 清理
        await manager.deleteAgent(created.id);
        return true;
      }
    ),
    { numRuns: 100 }
  );
});
```
