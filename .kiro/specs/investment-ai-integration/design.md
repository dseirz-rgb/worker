# Design Document

## Overview

本设计将 RiskControl 的 AI 功能完整移植到 Echo 投资模块，复用 Echo 现有的 Mastra Agent 架构和 tRPC 基建，同时保留 RiskControl 原有的投资专用提示词、AI 风格和多 Agent 编排系统。

核心设计原则：
1. **复用 Echo 基建**：使用 Mastra Agent、tRPC、Prisma，不引入新的 AI 框架
2. **保留投资风格**：完整移植 RiskControl 的 System Prompt 和 AI 人格
3. **多 Agent 编排**：移植 RiskControl 的多 Agent 系统（持仓分析、风险评估、市场分析、投资建议）
4. **智能 RAG**：移植查询分类、向量搜索、历史对话搜索
5. **双数据库隔离**：投资数据使用 Investment DB，不与 Echo DB 混用

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Echo Frontend                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   ChatWindow    │  │  RiskDashboard  │  │   NotesPage     │  │
│  │  (HeroUI)       │  │  (HeroUI)       │  │  (HeroUI)       │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │            │
│           └────────────────────┼────────────────────┘            │
│                                │                                 │
│                    ┌───────────▼───────────┐                     │
│                    │      tRPC Client      │                     │
│                    │   (api.investment.*)  │                     │
│                    └───────────┬───────────┘                     │
└────────────────────────────────┼────────────────────────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────┐
│                        Echo Server                               │
│                    ┌───────────▼───────────┐                     │
│                    │   Investment Router   │                     │
│                    │   (tRPC Endpoints)    │                     │
│                    └───────────┬───────────┘                     │
│                                │                                 │
│  ┌─────────────────────────────┼─────────────────────────────┐  │
│  │                Multi-Agent Orchestrator                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │  │
│  │  │  Position    │  │    Risk      │  │   Market     │     │  │
│  │  │  Analyst     │  │   Analyst    │  │   Analyst    │     │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │  │
│  │         │                 │                 │              │  │
│  │         └─────────────────┼─────────────────┘              │  │
│  │                           │                                │  │
│  │                   ┌───────▼───────┐                        │  │
│  │                   │    Advisor    │                        │  │
│  │                   │    Agent      │                        │  │
│  │                   └───────┬───────┘                        │  │
│  └───────────────────────────┼────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┼────────────────────────────────┐  │
│  │                           │                                 │  │
│  │  ┌──────────────┐  ┌──────▼──────┐  ┌──────────────┐       │  │
│  │  │   Context    │  │ Investment  │  │  Adaptive    │       │  │
│  │  │   Builder    │◄─┤   Agent     ├─►│  RAG Service │       │  │
│  │  │              │  │  (Mastra)   │  │              │       │  │
│  │  └──────┬───────┘  └──────┬──────┘  └──────┬───────┘       │  │
│  │         │                 │                │                │  │
│  │         │         ┌───────▼───────┐        │                │  │
│  │         │         │  AI Provider  │        │                │  │
│  │         │         │  (Gemini/     │        │                │  │
│  │         │         │   OpenAI)     │        │                │  │
│  │         │         └───────────────┘        │                │  │
│  │         │                                  │                │  │
│  └─────────┼──────────────────────────────────┼────────────────┘  │
│            │                                  │                   │
│  ┌─────────▼──────────────────────────────────▼───────────────┐  │
│  │                    Investment DB Client                     │  │
│  │                    (Supabase)                               │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Investment DB                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │
│  │ positions  │ │ dashboard  │ │ messages   │ │ documents  │    │
│  │            │ │ _snapshots │ │            │ │            │    │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                   │
│  │ conversa-  │ │ ai_        │ │ user_      │                   │
│  │ tions      │ │ analyses   │ │ profiles   │                   │
│  └────────────┘ └────────────┘ └────────────┘                   │
└──────────────────────────────────────────────────────────────────┘
```

### Multi-Agent 编排模式

从 RiskControl 移植的多 Agent 系统支持以下编排模式：

1. **Sequential（顺序执行）**：Position Analyst → Risk Analyst → Market Analyst → Advisor
2. **Respond Directly（快速响应）**：直接使用 Advisor Agent 回答简单问题
3. **Selector（智能选择）**：根据查询类型选择合适的 Agent 组合

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestration Modes                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Sequential Mode (深度分析):                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐ │
│  │ Position │ → │   Risk   │ → │  Market  │ → │ Advisor  │ │
│  │ Analyst  │   │ Analyst  │   │ Analyst  │   │          │ │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘ │
│                                                              │
│  Respond Directly Mode (快速问答):                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Advisor Agent                      │   │
│  │              (with context injection)                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Selector Mode (智能路由):                                   │
│  ┌──────────┐                                               │
│  │ Selector │ → [Position | Risk | Market | Advisor]       │
│  └──────────┘                                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Investment Agent (服务端)

位置：`services/echo-server/aiServer/investmentAgent.ts`

```typescript
interface InvestmentAgentConfig {
  name: string;
  persona: string;
  systemPrompt: string;
  tools: string[];
}

interface InvestmentChatOptions {
  conversationId?: number;
  context?: 'report' | 'briefing' | 'portfolio' | null;
  accountId: number;
}

interface InvestmentChatResponse {
  text: string;
  citations: Citation[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

// 核心方法
class InvestmentAgent {
  // 初始化 Investment Agent
  async initialize(): Promise<void>;
  
  // 对话
  async chat(
    messages: Message[],
    options: InvestmentChatOptions
  ): Promise<InvestmentChatResponse>;
  
  // 流式对话
  async *streamChat(
    messages: Message[],
    options: InvestmentChatOptions
  ): AsyncGenerator<string>;
  
  // 生成每日洞察
  async generateDailyInsight(accountId: number): Promise<string>;
  
  // 生成风控研报
  async generateRiskReport(
    accountId: number,
    options?: { watchlist?: any[] }
  ): Promise<RiskReport>;
}
```

### 2. Context Builder (上下文构建器)

位置：`services/echo-server/aiServer/investment/contextBuilder.ts`

```typescript
interface PortfolioContext {
  summary: {
    snapshotDate: string;
    totalNetWorthCNY: number;
    totalPositions: number;
    cashRatio: number;
    dailyPnL: number;
    dailyPnLPercent: number;
    drawdownPercent: number;
  };
  positions: PositionDetail[];
  transactions: TransactionDetail[];
  userProfile: UserProfile | null;
}

interface ContextBuilderResult {
  text: string;           // 格式化的上下文文本
  citations: Citation[];  // 引用来源
}

// 核心方法
class InvestmentContextBuilder {
  // 构建完整投资上下文
  async buildContext(accountId: number): Promise<ContextBuilderResult>;
  
  // 获取持仓数据
  async getPositions(accountId: number): Promise<PositionDetail[]>;
  
  // 获取 Dashboard 快照
  async getDashboardSnapshot(accountId: number): Promise<DashboardSnapshot>;
  
  // 获取最近交易
  async getRecentTransactions(accountId: number, limit?: number): Promise<TransactionDetail[]>;
  
  // 获取用户档案
  async getUserProfile(accountId: number): Promise<UserProfile | null>;
  
  // 格式化为 AI 提示词
  formatAsPrompt(context: PortfolioContext): string;
}
```

### 3. Adaptive RAG Service (智能检索增强服务)

位置：`services/echo-server/aiServer/investment/adaptiveRagService.ts`

从 RiskControl 移植的智能 RAG 服务，支持：
- 查询分类（结构化数据 vs 知识库）
- 向量搜索（Supabase pgvector）
- 全文搜索降级
- 历史对话搜索

```typescript
interface QueryClassification {
  needsStructuredData: boolean;   // 需要持仓/交易等结构化数据
  needsKnowledgeBase: boolean;    // 需要知识库/策略等非结构化数据
  confidence: number;             // 分类置信度 0-1
  matchedKeywords: string[];      // 匹配到的关键词
}

interface RAGResult {
  text: string;           // 检索到的相关内容
  citations: Citation[];  // 引用来源
}

// 结构化数据关键词
const STRUCTURED_KEYWORDS = [
  '持仓', '仓位', '交易', '买入', '卖出', '盈亏', '净值',
  '股票', '期权', '市值', '成本', '收益', '亏损', '回撤',
  '杠杆', '融资', '保证金', '资产', '负债', '权益',
  '今天', '昨天', '本周', '本月', '今年', '最近',
];

// 知识库关键词
const KNOWLEDGE_KEYWORDS = [
  '策略', '原则', '理论', '分析', '方法', '思路', '逻辑',
  '为什么', '怎么', '如何', '什么是', '解释', '说明',
  '书', '文章', '笔记', '观点', '建议', '经验', '教训',
  '巴菲特', '芒格', '格雷厄姆', '彼得林奇', '索罗斯',
  '价值投资', '成长投资', '趋势', '周期', '估值',
];

// 核心方法
class AdaptiveRAGService {
  // 获取投资上下文（主入口）
  async getInvestmentContext(
    query: string,
    accountId: number
  ): Promise<RAGResult>;
  
  // 分类查询
  classifyQuery(query: string): QueryClassification;
  
  // 获取结构化数据
  async fetchStructuredData(accountId: number): Promise<{
    context: string;
    citations: Citation[];
  }>;
  
  // 获取知识库数据
  async fetchKnowledgeData(
    query: string,
    accountId: number
  ): Promise<{
    context: string;
    citations: Citation[];
  }>;
  
  // 向量搜索
  async vectorSearch(
    query: string,
    limit?: number
  ): Promise<Document[]>;
  
  // 全文搜索（降级）
  async fullTextSearch(
    query: string,
    limit?: number
  ): Promise<Document[]>;
  
  // 搜索历史对话
  async searchHistory(
    query: string,
    accountId: number,
    limit?: number
  ): Promise<HistorySearchResult[]>;
}
```

### 4. Multi-Agent Orchestrator (多 Agent 编排器)

位置：`services/echo-server/aiServer/investment/orchestrator.ts`

从 RiskControl 移植的多 Agent 编排系统：

```typescript
type OrchestrationMode = 'sequential' | 'respond_directly' | 'selector';

interface AgentResult {
  agentId: string;
  status: 'success' | 'error' | 'skipped';
  summary: string;
  data: any;
  executionTime: number;
}

interface OrchestratorResult {
  results: AgentResult[];
  finalReport: FinalReport;
  executionTrace: ExecutionTrace;
}

interface FinalReport {
  title: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  recommendation: string;
  actionPlan: string;
  primaryTicker: string;
}

// 核心方法
class InvestmentOrchestrator {
  // 执行多 Agent 分析
  async execute(
    portfolio: PortfolioState,
    options: ExecutionOptions
  ): Promise<OrchestratorResult>;
  
  // 快速分析（Respond Directly 模式）
  async quickAnalyze(
    portfolio: PortfolioState,
    query: string
  ): Promise<OrchestratorResult>;
  
  // 深度分析（Sequential 模式）
  async deepAnalyze(
    portfolio: PortfolioState,
    query?: string
  ): Promise<OrchestratorResult>;
}
```

### 5. Specialized Agents (专业 Agent)

位置：`services/echo-server/aiServer/investment/agents/`

从 RiskControl 移植的专业 Agent：

```typescript
// Position Analyst - 持仓分析
interface PositionAnalystAgent {
  analyze(portfolio: PortfolioState): Promise<{
    concentrationAnalysis: ConcentrationAnalysis;
    performanceAttribution: PerformanceAttribution;
    recommendations: string[];
  }>;
}

// Risk Analyst - 风险评估
interface RiskAnalystAgent {
  analyze(portfolio: PortfolioState): Promise<{
    stressTestResults: StressTestResult[];
    drawdownAnalysis: DrawdownAnalysis;
    leverageAssessment: LeverageAssessment;
    warnings: string[];
  }>;
}

// Market Analyst - 市场分析
interface MarketAnalystAgent {
  analyze(portfolio: PortfolioState): Promise<{
    marketSentiment: MarketSentiment;
    tickerSentiments: TickerSentiment[];
    marketEvents: MarketEvent[];
  }>;
}

// Advisor Agent - 投资建议
interface AdvisorAgent {
  synthesize(
    positionAnalysis: any,
    riskAnalysis: any,
    marketAnalysis: any
  ): Promise<{
    summary: string;
    actionItems: ActionItem[];
    riskLevel: string;
  }>;
}
```

### 4. Investment Router (tRPC 路由)

位置：`services/echo-server/routerTrpc/investment.ts`

```typescript
// tRPC 端点定义
const investmentRouter = router({
  // 对话
  chat: authProcedure
    .input(z.object({
      conversationId: z.number().optional(),
      message: z.string(),
      context: z.enum(['report', 'briefing', 'portfolio']).optional(),
    }))
    .mutation(async ({ input, ctx }) => InvestmentChatResponse),
  
  // 流式对话
  streamChat: authProcedure
    .input(z.object({
      conversationId: z.number().optional(),
      message: z.string(),
      context: z.enum(['report', 'briefing', 'portfolio']).optional(),
    }))
    .mutation(async function* ({ input, ctx }) => AsyncGenerator<string>),
  
  // 生成每日洞察
  generateDailyInsight: authProcedure
    .mutation(async ({ ctx }) => string),
  
  // 生成风控研报
  generateRiskReport: authProcedure
    .input(z.object({
      watchlist: z.array(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => RiskReport),
  
  // 获取对话列表
  getConversations: authProcedure
    .query(async ({ ctx }) => Conversation[]),
  
  // 获取对话消息
  getMessages: authProcedure
    .input(z.object({
      conversationId: z.number(),
    }))
    .query(async ({ input, ctx }) => Message[]),
  
  // 创建对话
  createConversation: authProcedure
    .input(z.object({
      title: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => Conversation),
  
  // 删除对话
  deleteConversation: authProcedure
    .input(z.object({
      conversationId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => { success: boolean }),
});
```

### 5. Investment DB Client (数据库客户端)

位置：`services/echo-server/lib/investmentDb.ts`

```typescript
// 使用 Supabase 客户端连接 Investment DB
// 环境变量: INVESTMENT_SUPABASE_URL, INVESTMENT_SUPABASE_ANON_KEY

interface InvestmentDbClient {
  // 持仓相关
  getPositions(accountId: number): Promise<Position[]>;
  
  // Dashboard 相关
  getDashboardSnapshot(accountId: number): Promise<DashboardSnapshot>;
  
  // 对话相关
  getConversations(accountId: number): Promise<Conversation[]>;
  createConversation(accountId: number, title: string): Promise<Conversation>;
  deleteConversation(conversationId: number): Promise<void>;
  
  // 消息相关
  getMessages(conversationId: number): Promise<Message[]>;
  saveMessage(message: Omit<Message, 'id' | 'createdAt'>): Promise<Message>;
  
  // 笔记搜索
  searchDocuments(query: string, limit?: number): Promise<Document[]>;
  
  // AI 分析
  saveAnalysis(analysis: Omit<AIAnalysis, 'id' | 'createdAt'>): Promise<AIAnalysis>;
  getLatestAnalysis(accountId: number): Promise<AIAnalysis | null>;
}
```

## Data Models

### Message

```typescript
interface Message {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  createdAt: string;
}
```

### Citation

```typescript
interface Citation {
  source: string;      // 来源类型: '📊 结构化数据', '📝 投资笔记', '💬 历史对话'
  title: string;       // 标题
  contentSnippet?: string;  // 内容片段
  url?: string;        // 可选链接
}
```

### RiskReport

```typescript
interface RiskReport {
  id: number;
  userId: number;
  title: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  content: string;      // Markdown 格式
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'REBALANCE' | 'WARNING';
  actionPlan: string;
  primaryTicker: string;
  portfolioSnapshot: any;
  createdAt: string;
}
```

### UserProfile

```typescript
interface UserProfile {
  userId: number;
  investmentStyle: 'conservative' | 'moderate' | 'aggressive';
  riskTolerance: number;  // 1-10
  principles: string[];   // 投资原则列表
  content: string;        // 完整档案文本
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Agent Initialization Consistency

*For any* Investment Agent initialization, the resulting agent SHALL have a valid system prompt containing the "Investment Mirror" persona keywords and be registered in the agent manager.

**Validates: Requirements 1.1, 1.2, 1.4**

### Property 2: Context Builder Data Completeness

*For any* account with portfolio data, the Context Builder SHALL return a result containing: positions array, dashboard snapshot, and formatted text string. The formatted text SHALL contain all position tickers and net worth value.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 3: Context Builder Graceful Degradation

*For any* account without portfolio data or database error, the Context Builder SHALL return a non-empty fallback message without throwing an exception.

**Validates: Requirements 2.4**

### Property 4: RAG Service Result Limiting

*For any* search query, the RAG Service SHALL return at most 5 notes and at most 3 historical messages.

**Validates: Requirements 3.3, 3.5**

### Property 5: Citation Format Consistency

*For any* citation generated by the system, it SHALL match the pattern `[Source Type: Title]` where Source Type is one of: '📊 结构化数据', '📝 投资笔记', '💬 历史对话'.

**Validates: Requirements 3.4, 9.1, 9.2, 9.3, 9.5**

### Property 6: RAG Service Graceful Degradation

*For any* query with no matching notes, the RAG Service SHALL return an empty citations array and proceed without error.

**Validates: Requirements 3.6**

### Property 7: Context Selection Prompt Inclusion

*For any* chat request with context selection, the resulting AI prompt SHALL include the corresponding context data (report content, briefing data, or portfolio positions).

**Validates: Requirements 4.5**

### Property 8: Message Persistence Round-Trip

*For any* message sent through the chat endpoint, saving then retrieving the message SHALL produce an equivalent message object.

**Validates: Requirements 4.6**

### Property 9: Risk Report Structure Completeness

*For any* generated risk report, the result SHALL contain all required fields: riskLevel, summary, content, recommendation, and portfolioSnapshot.

**Validates: Requirements 7.2, 7.3, 7.5**

### Property 10: Risk Report Persistence

*For any* generated risk report, it SHALL be saved to the ai_analyses table and be retrievable by ID.

**Validates: Requirements 7.4**

### Property 11: Authentication Enforcement

*For any* tRPC endpoint in the investment router, unauthenticated requests SHALL be rejected with an appropriate error code.

**Validates: Requirements 8.2**

### Property 12: Error Response Format

*For any* error in tRPC endpoints, the response SHALL include an error code and human-readable message.

**Validates: Requirements 8.4**

## Error Handling

### Database Errors

- **Connection Failure**: 返回 `SERVICE_UNAVAILABLE` 错误，前端显示"数据库连接失败，请稍后重试"
- **Query Timeout**: 设置 30 秒超时，超时后返回 `TIMEOUT` 错误
- **Data Not Found**: 返回空数组或 null，不抛出错误

### AI Service Errors

- **Model Unavailable**: 回退到备用模型，如果都不可用返回 `AI_SERVICE_UNAVAILABLE`
- **Token Limit Exceeded**: 截断上下文，保留最近的消息
- **Rate Limit**: 返回 `RATE_LIMITED` 错误，前端显示重试倒计时

### Validation Errors

- **Invalid Input**: 返回 `BAD_REQUEST` 错误，包含具体字段错误信息
- **Unauthorized**: 返回 `UNAUTHORIZED` 错误，前端跳转登录页

## Testing Strategy

### Unit Tests

使用 Vitest 进行单元测试：

1. **Context Builder Tests**
   - 测试数据格式化逻辑
   - 测试缓存行为
   - 测试空数据处理

2. **RAG Service Tests**
   - 测试查询分类逻辑
   - 测试搜索结果限制
   - 测试引用格式化

3. **Investment Router Tests**
   - 测试输入验证
   - 测试认证检查
   - 测试错误响应格式

### Property-Based Tests

使用 fast-check 进行属性测试，每个属性至少 100 次迭代：

1. **Property 2**: 生成随机持仓数据，验证 Context Builder 输出完整性
2. **Property 4**: 生成随机查询，验证 RAG 结果数量限制
3. **Property 5**: 生成随机引用，验证格式匹配
4. **Property 8**: 生成随机消息，验证持久化往返一致性
5. **Property 9**: 生成随机报告请求，验证结构完整性

### Integration Tests

1. **端到端对话流程**: 创建对话 → 发送消息 → 接收响应 → 验证持久化
2. **风控研报生成**: 请求生成 → 验证结构 → 验证数据库保存
3. **上下文切换**: 切换不同上下文 → 验证提示词变化
