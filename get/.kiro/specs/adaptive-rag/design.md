# Design Document: Adaptive RAG

## Overview

本设计实现一个自适应检索增强生成（Adaptive RAG）系统，基于 LangGraph 的状态图架构，结合 AutoGen 的消息转换能力。系统通过智能路由、多级质量控制和自适应重试机制，显著提升 AI 对话的准确性和可靠性。

核心设计理念：
1. **智能路由** - 使用 LLM 判断问题类型，而非简单关键词匹配
2. **质量闭环** - 文档评分 → 幻觉检测 → 答案评估的三级质量控制
3. **自适应重试** - 失败时自动切换策略，最大化回答质量
4. **消息管理** - 自动处理长对话，避免 token 超限

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Adaptive RAG Service                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐                                                        │
│  │   START      │                                                        │
│  └──────┬───────┘                                                        │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────────┐                                                    │
│  │ Message Transform │  ← 消息历史管理 (限制消息数/token数)               │
│  └──────┬───────────┘                                                    │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────────┐     structured_data    ┌─────────────────┐        │
│  │   Query Router   │ ─────────────────────► │ Structured Data │        │
│  │   (LLM-based)    │                        │   (Supabase)    │        │
│  └────────┬─────────┘                        └────────┬────────┘        │
│           │                                           │                  │
│           │ vectorstore          websearch            │                  │
│           ▼                         │                 │                  │
│  ┌──────────────────┐               │                 │                  │
│  │    Retrieve      │               │                 │                  │
│  │   (LightRAG)     │               │                 │                  │
│  └────────┬─────────┘               │                 │                  │
│           │                         │                 │                  │
│           ▼                         │                 │                  │
│  ┌──────────────────┐               │                 │                  │
│  │ Document Grader  │               │                 │                  │
│  │  (Relevance)     │               │                 │                  │
│  └────────┬─────────┘               │                 │                  │
│           │                         │                 │                  │
│      relevant?                      │                 │                  │
│      ┌────┴────┐                    │                 │                  │
│      │ no      │ yes                │                 │                  │
│      ▼         ▼                    ▼                 │                  │
│  ┌───────┐  ┌──────────────────────────┐              │                  │
│  │  Web  │  │       Generate           │◄─────────────┘                  │
│  │Search │  │    (RAG Response)        │                                 │
│  └───┬───┘  └───────────┬──────────────┘                                 │
│      │                  │                                                │
│      └──────────────────┤                                                │
│                         ▼                                                │
│              ┌──────────────────────┐                                    │
│              │ Hallucination Grader │                                    │
│              │   (Grounded Check)   │                                    │
│              └──────────┬───────────┘                                    │
│                         │                                                │
│                    grounded?                                             │
│                    ┌────┴────┐                                           │
│                    │ no      │ yes                                       │
│                    ▼         ▼                                           │
│              ┌─────────┐  ┌──────────────────┐                           │
│              │Regenerate│  │  Answer Grader   │                          │
│              │(≤3 times)│  │ (Usefulness)     │                          │
│              └─────────┘  └────────┬─────────┘                           │
│                                    │                                     │
│                               useful?                                    │
│                               ┌────┴────┐                                │
│                               │ no      │ yes                            │
│                               ▼         ▼                                │
│                          ┌─────────┐  ┌─────┐                            │
│                          │Websearch│  │ END │                            │
│                          │Fallback │  └─────┘                            │
│                          └─────────┘                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. GraphState (状态定义)

```typescript
interface GraphState {
  // 输入
  question: string;              // 用户问题
  messages: Message[];           // 对话历史
  
  // 检索结果
  documents: Document[];         // 检索到的文档
  web_search: 'Yes' | 'No';      // 是否需要 Web 搜索
  
  // 生成结果
  generation: string;            // AI 生成的回答
  citations: Citation[];         // 引用来源
  
  // 控制状态
  loop_step: number;             // 当前重试次数
  max_retries: number;           // 最大重试次数 (默认 3)
  route_decision: RouteDecision; // 路由决策
}

interface RouteDecision {
  datasource: 'vectorstore' | 'structured_data' | 'websearch';
  confidence: number;
  reasoning: string;
}

interface Document {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  relevance_score?: number;
}
```

### 2. Query Router (查询路由器)

```typescript
interface QueryRouterConfig {
  llm_model: string;  // 默认 'gemini-2.0-flash'
  system_prompt: string;
}

interface QueryRouterResult {
  datasource: 'vectorstore' | 'structured_data' | 'websearch';
  confidence: number;
  reasoning: string;
}

// Router Prompt
const ROUTER_SYSTEM_PROMPT = `You are an expert at routing user questions to the appropriate data source.

Available data sources:
1. vectorstore - Contains investment knowledge, strategies, principles, book notes, and analysis methods
2. structured_data - Contains portfolio positions, transactions, market data, and financial metrics
3. websearch - For current events, real-time information, or topics not covered by other sources

Analyze the user's question and return JSON with:
- datasource: one of 'vectorstore', 'structured_data', 'websearch'
- confidence: 0.0 to 1.0
- reasoning: brief explanation

Examples:
- "我的持仓情况" → structured_data (portfolio query)
- "巴菲特的投资原则" → vectorstore (investment knowledge)
- "今天美股发生了什么" → websearch (current events)`;
```

### 3. Document Grader (文档评分器)

```typescript
interface DocumentGraderConfig {
  llm_model: string;
  threshold: number;  // 默认 0.5
}

interface GradeResult {
  binary_score: 'yes' | 'no';
  confidence: number;
}

const DOC_GRADER_PROMPT = `You are a grader assessing relevance of a retrieved document to a user question.

If the document contains keyword(s) or semantic meaning related to the question, grade it as relevant.

Return JSON with:
- binary_score: 'yes' or 'no'
- confidence: 0.0 to 1.0`;
```

### 4. Hallucination Grader (幻觉检测器)

```typescript
interface HallucinationGraderResult {
  binary_score: 'yes' | 'no';  // yes = grounded, no = hallucination
  explanation: string;
}

const HALLUCINATION_GRADER_PROMPT = `You are a grader assessing whether an LLM generation is grounded in / supported by a set of retrieved facts.

Give a binary score:
- 'yes': the generation is grounded in the facts
- 'no': the generation contains information not supported by the facts

Return JSON with:
- binary_score: 'yes' or 'no'
- explanation: brief explanation of your assessment`;
```

### 5. Answer Grader (答案评估器)

```typescript
interface AnswerGraderResult {
  binary_score: 'yes' | 'no';  // yes = useful, no = not useful
  explanation: string;
}

const ANSWER_GRADER_PROMPT = `You are a grader assessing whether an answer addresses / resolves a question.

Give a binary score:
- 'yes': the answer resolves the question
- 'no': the answer does not resolve the question

Return JSON with:
- binary_score: 'yes' or 'no'
- explanation: brief explanation`;
```

### 6. Message Transformer (消息转换器)

```typescript
interface MessageTransformerConfig {
  max_messages: number;      // 默认 10
  max_tokens: number;        // 默认 4000
  max_tokens_per_message: number;  // 默认 500
  min_tokens: number;        // 默认 500 (低于此值不截断)
}

interface TransformResult {
  messages: Message[];
  messages_removed: number;
  tokens_removed: number;
}

class MessageTransformer {
  constructor(config: MessageTransformerConfig);
  
  // 应用消息历史限制
  applyMessageLimit(messages: Message[]): Message[];
  
  // 应用 token 限制
  applyTokenLimit(messages: Message[]): Message[];
  
  // 组合转换
  transform(messages: Message[]): TransformResult;
}
```

### 7. Adaptive RAG Service (主服务)

```typescript
interface AdaptiveRAGConfig {
  router: QueryRouterConfig;
  documentGrader: DocumentGraderConfig;
  hallucinationGrader: HallucinationGraderConfig;
  answerGrader: AnswerGraderConfig;
  messageTransformer: MessageTransformerConfig;
  max_retries: number;  // 默认 3
}

class AdaptiveRAGService {
  constructor(config: AdaptiveRAGConfig);
  
  // 主入口 - 兼容现有 ragService API
  async getInvestmentContext(query: string): Promise<{
    text: string;
    citations: Citation[];
  }>;
  
  // 内部节点函数
  private async routeQuestion(state: GraphState): Promise<GraphState>;
  private async retrieve(state: GraphState): Promise<GraphState>;
  private async gradeDocuments(state: GraphState): Promise<GraphState>;
  private async generate(state: GraphState): Promise<GraphState>;
  private async gradeGeneration(state: GraphState): Promise<string>;
  private async webSearch(state: GraphState): Promise<GraphState>;
}
```

## Data Models

### Message 数据模型

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
  timestamp?: Date;
}

interface ContentPart {
  type: 'text' | 'image';
  text?: string;
  image_url?: string;
}
```

### Citation 数据模型 (保持现有结构)

```typescript
interface Citation {
  source: string;       // 来源标识
  title: string;        // 标题
  content_snippet: string;  // 内容片段
  url?: string;         // 可选 URL
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Query Router Output Validity

*For any* valid query string, the Query_Router SHALL return a response containing:
- datasource field with value in ['vectorstore', 'structured_data', 'websearch']
- confidence field with value between 0.0 and 1.0

**Validates: Requirements 1.1, 1.5**

### Property 2: Query Routing Consistency

*For any* query containing portfolio-related keywords (持仓, 交易, 净值, position, trade), the Query_Router SHALL route to 'structured_data' with confidence > 0.5

*For any* query containing knowledge-related keywords (策略, 原则, 巴菲特, strategy, principle), the Query_Router SHALL route to 'vectorstore' with confidence > 0.5

*For any* query containing current-event patterns (今天, 最新, current, latest), the Query_Router SHALL route to 'websearch' with confidence > 0.5

**Validates: Requirements 1.2, 1.3, 1.4**

### Property 3: Document Grader Output Validity

*For any* document-query pair, the Document_Grader SHALL return a response with binary_score in ['yes', 'no']

**Validates: Requirements 2.1, 2.2**

### Property 4: Document Grading Fallback Behavior

*For any* set of documents where all are graded as 'no' (not relevant), the Adaptive_RAG_Service SHALL set web_search flag to 'Yes'

*For any* set of documents where at least one is graded as 'yes' (relevant), the Adaptive_RAG_Service SHALL proceed to generation with filtered documents

**Validates: Requirements 2.3, 2.4**

### Property 5: Hallucination Grader Output Validity

*For any* generation-documents pair, the Hallucination_Grader SHALL return a response with:
- binary_score in ['yes', 'no']
- explanation as non-empty string

**Validates: Requirements 3.1, 3.2, 3.4**

### Property 6: Retry Mechanism Enforcement

*For any* execution where hallucination is detected (binary_score = 'no'), the system SHALL:
- Increment loop_step by 1
- Trigger regeneration if loop_step <= max_retries
- Return best available response if loop_step > max_retries

*For any* execution, loop_step SHALL never exceed max_retries + 1

**Validates: Requirements 3.3, 3.5, 5.2, 5.4**

### Property 7: Answer Grader Output Validity

*For any* question-answer pair, the Answer_Grader SHALL return a response with binary_score in ['yes', 'no']

**Validates: Requirements 4.1, 4.2**

### Property 8: Answer Grading Behavior

*For any* answer graded as 'no' (not useful), the Adaptive_RAG_Service SHALL trigger websearch fallback

*For any* answer graded as 'yes' (useful), the Adaptive_RAG_Service SHALL return the response to the user

**Validates: Requirements 4.3, 4.4**

### Property 9: Message Transformation Invariants

*For any* message list with length > max_messages, after transformation:
- Result length SHALL be <= max_messages
- Most recent messages SHALL be preserved
- messages_removed SHALL equal original_length - result_length

*For any* message list with total tokens > max_tokens, after transformation:
- Total tokens SHALL be <= max_tokens
- tokens_removed SHALL be > 0

*For any* message list with total tokens < min_tokens:
- No truncation SHALL be applied
- Result SHALL equal input

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 10: GraphState Consistency

*For any* state transition, the GraphState SHALL maintain:
- question field unchanged throughout execution
- loop_step monotonically increasing
- documents array only modified by retrieve and gradeDocuments nodes

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 11: Backward Compatibility

*For any* call to getInvestmentContext(query), the response SHALL contain:
- text field as string
- citations field as array of Citation objects

This matches the existing ragService API signature.

**Validates: Requirements 8.3, 8.5**

### Property 12: Fallback Chain

*For any* scenario where LightRAG is unavailable, the Adaptive_RAG_Service SHALL:
- Attempt Supabase vector search as fallback
- Return valid response (not throw error)

**Validates: Requirements 8.4**

## Error Handling

### 错误类型与处理策略

| 错误类型 | 处理策略 | 用户反馈 |
|---------|---------|---------|
| LLM API 超时 | 重试 2 次，然后降级到关键词路由 | 无感知 |
| LightRAG 不可用 | 降级到 Supabase 向量搜索 | 无感知 |
| 文档检索失败 | 触发 Web 搜索 | 无感知 |
| 幻觉检测失败 | 跳过检测，返回原始回答 | 添加免责声明 |
| 最大重试次数 | 返回最佳可用回答 | 添加免责声明 |
| Token 超限 | 自动截断消息历史 | 无感知 |

### 错误恢复状态机

```
Normal → Error → Retry → (Success | Fallback | MaxRetries)
                    ↓
              Degraded Mode
```

## Testing Strategy

### 单元测试

1. **Query Router Tests**
   - 测试各类查询的路由决策
   - 测试 JSON 输出格式
   - 测试边界情况（空查询、超长查询）

2. **Document Grader Tests**
   - 测试相关/不相关文档的评分
   - 测试批量文档评分

3. **Message Transformer Tests**
   - 测试消息数量限制
   - 测试 token 限制
   - 测试最小阈值保护

### 属性测试

使用 fast-check 进行属性测试，每个属性至少运行 100 次迭代。

```typescript
// 示例：Property 1 - Query Router Output Validity
// Feature: adaptive-rag, Property 1: Query Router Output Validity
test.prop([fc.string().filter(s => s.length > 0 && s.length < 1000)])(
  'Query router returns valid output for any query',
  async (query) => {
    const result = await queryRouter.route(query);
    expect(['vectorstore', 'structured_data', 'websearch']).toContain(result.datasource);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  }
);
```

### 集成测试

1. 端到端流程测试
2. 与现有 LightRAG 服务的集成
3. 与 Supabase 的集成
4. 降级场景测试
