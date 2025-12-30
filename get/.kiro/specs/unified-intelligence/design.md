# Design: Unified Intelligence System

## Overview

本设计文档描述如何将 Multi-Agent System、Adaptive RAG、LightRAG 和 Voice Service 四个系统深度整合为统一的投资分析平台。

核心设计理念：
1. **分层架构** - Query Classifier → Adaptive RAG → Multi-Agent 三层处理
2. **智能路由** - 根据查询复杂度自动选择处理模式
3. **质量闭环** - 所有生成内容经过 Hallucination Grader 检验
4. **渐进增强** - 简单问题快速响应，复杂问题深度分析

## Architecture

### Current State (独立系统)

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend                                │
├─────────────────────────────────────────────────────────────┤
│  RiskCenter    │  DecisionCenter  │  DailyBriefing          │
│       │        │        │         │        │                │
│       ▼        │        ▼         │        ▼                │
│  /api/chat     │   ragService     │   aiService             │
│  (直接调用)    │   (独立RAG)      │   (独立AI)              │
└─────────────────────────────────────────────────────────────┘
        │                 │                  │
        ▼                 ▼                  ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ Multi-Agent   │ │ Adaptive RAG  │ │   LightRAG    │
│ (仅风控报告)  │ │ (独立运行)    │ │ (部分集成)    │
└───────────────┘ └───────────────┘ └───────────────┘
```

### Target State (统一系统)

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend                                │
├─────────────────────────────────────────────────────────────┤
│  RiskCenter    │  DecisionCenter  │  DailyBriefing │ Voice  │
│       │        │        │         │        │       │   │    │
│       └────────┴────────┴─────────┴────────┴───────┴───┘    │
│                              │                               │
│                              ▼                               │
│                    useUnifiedIntelligence                    │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Unified Intelligence Service                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  Query Classifier                       │ │
│  │  confidence > 0.8 → RAG only (fast)                    │ │
│  │  confidence < 0.8 → Multi-Agent (deep)                 │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                  │
│           ┌───────────────┼───────────────┐                  │
│           ▼               ▼               ▼                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  RAG Only   │  │  RAG+Agent  │  │ Full Agent  │          │
│  │  (<2s)      │  │  (5-15s)    │  │ (15-30s)    │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         └────────────────┼────────────────┘                  │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                   Adaptive RAG Layer                    │ │
│  │  Query Router → Doc Grader → Hallucination Grader      │ │
│  │       │                                                 │ │
│  │  ┌────┴────┬────────────┐                               │ │
│  │  ▼         ▼            ▼                               │ │
│  │ LightRAG  Supabase   WebSearch                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │               Multi-Agent Orchestrator                  │ │
│  │  Position → Risk → Market → WebSurfer → Advisor        │ │
│  │  + Memory + Alerts + Extended Thinking                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. UnifiedIntelligenceService (统一入口)

```typescript
// client/src/services/unifiedIntelligence/unifiedIntelligenceService.ts

interface UnifiedIntelligenceConfig {
  enableMultiAgent: boolean;      // 是否启用多Agent
  enableAdaptiveRAG: boolean;     // 是否启用自适应RAG
  confidenceThreshold: number;    // 路由阈值 (默认 0.8)
  maxAgentTime: number;           // Agent最大执行时间 (默认 30s)
  cacheEnabled: boolean;          // 是否启用缓存
  cacheTTL: number;               // 缓存时间 (默认 300s)
}

interface QueryResult {
  text: string;                   // 回答文本
  citations: Citation[];          // 引用来源
  mode: 'rag_only' | 'rag_agent' | 'full_agent';  // 使用的模式
  agentResults?: AgentResult[];   // Agent结果 (如果使用)
  confidence: number;             // 置信度
  processingTime: number;         // 处理时间
}

interface AnalysisResult extends QueryResult {
  summary: string;                // 分析摘要
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
  alerts: AgentAlert[];
}

class UnifiedIntelligenceService {
  constructor(config?: Partial<UnifiedIntelligenceConfig>);
  
  // 快速查询 - 自动路由
  async query(question: string, context?: QueryContext): Promise<QueryResult>;
  
  // 深度分析 - 强制使用多Agent
  async deepAnalyze(portfolio: PortfolioState, query?: string): Promise<AnalysisResult>;
  
  // 快速响应 - 强制使用RAG
  async quickAnswer(question: string): Promise<QueryResult>;
  
  // 每日洞察
  async generateDailyInsight(portfolio: PortfolioState): Promise<DailyInsight>;
  
  // 语音上下文
  async getVoiceContext(): Promise<VoiceContext>;
}
```

### 2. QueryClassifier (查询分类器)

```typescript
// client/src/services/unifiedIntelligence/queryClassifier.ts

interface ClassificationResult {
  mode: 'rag_only' | 'rag_agent' | 'full_agent';
  confidence: number;
  reasoning: string;
  suggestedAgents?: string[];     // 建议使用的Agent
}

class QueryClassifier {
  // 使用 Adaptive RAG 的 Query Router 作为基础
  private queryRouter: QueryRouter;
  
  async classify(question: string): Promise<ClassificationResult> {
    // 1. 先用 Query Router 判断数据源
    const routeResult = await this.queryRouter.route(question);
    
    // 2. 根据置信度和问题复杂度决定模式
    if (routeResult.confidence > 0.8 && this.isSimpleQuery(question)) {
      return { mode: 'rag_only', confidence: routeResult.confidence, ... };
    }
    
    if (this.requiresDeepAnalysis(question)) {
      return { mode: 'full_agent', confidence: 0.9, ... };
    }
    
    return { mode: 'rag_agent', confidence: routeResult.confidence, ... };
  }
  
  private isSimpleQuery(question: string): boolean {
    // 简单问题模式
    const simplePatterns = [
      /^(什么是|解释|定义)/,
      /^(今天|现在|当前).*(怎么样|如何)/,
      /\?$/,  // 简短问句
    ];
    return question.length < 30 && simplePatterns.some(p => p.test(question));
  }
  
  private requiresDeepAnalysis(question: string): boolean {
    // 需要深度分析的模式
    const deepPatterns = [
      /(深度|全面|详细).*(分析|诊断|评估)/,
      /(风险|回撤|杠杆).*(分析|评估|研究)/,
      /(建议|操作|调仓|策略)/,
    ];
    return deepPatterns.some(p => p.test(question));
  }
}
```

### 3. Enhanced Adaptive RAG (增强版)

```typescript
// client/src/services/unifiedIntelligence/enhancedAdaptiveRag.ts

class EnhancedAdaptiveRAGService extends AdaptiveRAGService {
  // 重写 vectorstore 检索，优先使用 LightRAG
  protected async retrieveFromVectorstore(
    query: string,
    citations: Citation[]
  ): Promise<Document[]> {
    // 1. 优先尝试 LightRAG
    try {
      if (await isLightRAGAvailable()) {
        const result = await queryKnowledge(query, 'hybrid');
        if (result.success && result.result) {
          citations.push({
            source: '🧠 知识图谱 (LightRAG)',
            title: 'GraphRAG 检索结果',
            content_snippet: result.result.slice(0, 100) + '...',
          });
          return this.lightragResultToDocuments(result.result);
        }
      }
    } catch (error) {
      console.warn('[EnhancedRAG] LightRAG failed, falling back:', error);
    }
    
    // 2. 降级到 Supabase 向量搜索
    return super.retrieveFallback(query, citations);
  }
  
  // 为 Agent 提供检索接口
  async retrieveForAgent(
    agentId: string,
    query: string
  ): Promise<{ documents: Document[]; citations: Citation[] }> {
    const citations: Citation[] = [];
    let documents: Document[] = [];
    
    // 根据 Agent 类型选择路由
    switch (agentId) {
      case 'position_analyst':
        documents = await this.retrieveStructuredData(query, citations);
        break;
      case 'risk_analyst':
        documents = await this.retrieveFromVectorstore(query, citations);
        break;
      case 'market_analyst':
        documents = await this.webSearch({ question: query, ... });
        break;
      default:
        // 使用智能路由
        const state = await this.executeGraph(createInitialState(query));
        documents = state.documents;
    }
    
    return { documents, citations };
  }
}
```

### 4. Agent + RAG Integration

```typescript
// client/src/services/unifiedIntelligence/agentRagIntegration.ts

class AgentRAGIntegration {
  private enhancedRag: EnhancedAdaptiveRAGService;
  private hallucinationGrader: HallucinationGrader;
  
  // 为 Agent 提供带质量控制的检索
  async retrieveWithQualityControl(
    agentId: string,
    query: string
  ): Promise<RetrievalResult> {
    // 1. 检索文档
    const { documents, citations } = await this.enhancedRag.retrieveForAgent(agentId, query);
    
    // 2. 文档评分
    const gradedDocs = await this.gradeDocuments(documents, query);
    
    return {
      documents: gradedDocs,
      citations,
      hasRelevantDocs: gradedDocs.length > 0,
    };
  }
  
  // 验证 Agent 生成的回答
  async validateAgentResponse(
    response: string,
    documents: Document[]
  ): Promise<ValidationResult> {
    const result = await this.hallucinationGrader.grade(
      response,
      documents.map(d => d.content)
    );
    
    return {
      isGrounded: result.binary_score === 'yes',
      explanation: result.explanation,
      needsRegeneration: result.binary_score === 'no',
    };
  }
}
```

### 5. useUnifiedIntelligence Hook

```typescript
// client/src/hooks/useUnifiedIntelligence.ts

interface UseUnifiedIntelligenceOptions {
  autoClassify?: boolean;         // 自动分类查询
  enableProgress?: boolean;       // 显示进度
  onAlert?: (alert: AgentAlert) => void;
}

interface UseUnifiedIntelligenceReturn {
  // State
  isProcessing: boolean;
  mode: 'idle' | 'rag_only' | 'rag_agent' | 'full_agent';
  progress: ProgressStatus | null;
  result: QueryResult | AnalysisResult | null;
  error: Error | null;
  
  // Actions
  query: (question: string) => Promise<void>;
  deepAnalyze: (portfolio: PortfolioState, query?: string) => Promise<void>;
  quickAnswer: (question: string) => Promise<void>;
  cancel: () => void;
  
  // Agent State (when using multi-agent)
  agentResults: Map<string, AgentResult>;
  currentAgent: string | null;
  alerts: AgentAlert[];
}

export function useUnifiedIntelligence(
  options?: UseUnifiedIntelligenceOptions
): UseUnifiedIntelligenceReturn;
```

## Data Models

### QueryContext

```typescript
interface QueryContext {
  conversationHistory?: Message[];  // 对话历史
  portfolio?: PortfolioState;       // 当前持仓
  userPreferences?: UserPreferences; // 用户偏好
  forceMode?: 'rag_only' | 'full_agent'; // 强制模式
}
```

### VoiceContext

```typescript
interface VoiceContext {
  portfolioSummary: string;         // 持仓摘要
  riskSummary: string;              // 风险摘要
  latestAnalysis?: {
    timestamp: Date;
    summary: string;
    riskLevel: string;
    keyFindings: string[];
  };
  recentAlerts: AgentAlert[];
}
```

### DailyInsight

```typescript
interface DailyInsight {
  date: string;
  summary: string;
  positionInsights: {
    agentId: 'position_analyst';
    summary: string;
    keyChanges: string[];
  };
  riskInsights: {
    agentId: 'risk_analyst';
    summary: string;
    riskLevel: string;
    warnings: string[];
  };
  marketInsights: {
    agentId: 'market_analyst';
    summary: string;
    headlines: string[];
  };
  recommendation: {
    agentId: 'advisor';
    summary: string;
    actions: string[];
  };
}
```

## Integration Patterns

### RiskCenter Integration

```typescript
// client/src/pages/RiskCenter.tsx

function AIAnalysisPanel({ portfolio, riskMetrics }: Props) {
  const {
    deepAnalyze,
    isProcessing,
    progress,
    result,
    agentResults,
    currentAgent,
    alerts,
  } = useUnifiedIntelligence({
    enableProgress: true,
    onAlert: (alert) => addToRiskLog(alert),
  });

  return (
    <div>
      <Button onClick={() => deepAnalyze(portfolio, '深度风控分析')}>
        开始分析
      </Button>
      
      {isProcessing && (
        <AgentProgressBar
          currentAgent={currentAgent}
          progress={progress}
        />
      )}
      
      {result && (
        <AgentResultsAccordion results={agentResults} />
      )}
      
      {alerts.length > 0 && (
        <AlertsList alerts={alerts} />
      )}
    </div>
  );
}
```

### Chat Integration

```typescript
// client/src/components/chat/ChatWindow.tsx

function ChatWindow() {
  const {
    query,
    quickAnswer,
    isProcessing,
    mode,
    result,
    agentResults,
  } = useUnifiedIntelligence({ autoClassify: true });

  const handleSend = async (message: string) => {
    // 自动分类并路由
    await query(message);
  };

  return (
    <div>
      {/* 显示当前模式 */}
      {isProcessing && (
        <ProcessingIndicator mode={mode} />
      )}
      
      {/* Agent 思考过程 (可折叠) */}
      {mode !== 'rag_only' && agentResults.size > 0 && (
        <Collapsible title="Agent 分析过程">
          <AgentThinkingDisplay results={agentResults} />
        </Collapsible>
      )}
      
      {/* 回答和引用 */}
      {result && (
        <ChatResponse
          text={result.text}
          citations={result.citations}
        />
      )}
    </div>
  );
}
```

### Voice Service Integration

```python
# voice-service/unified_context.py

class UnifiedContextFetcher:
    """获取统一智能系统的上下文"""
    
    def __init__(self, api_base_url: str):
        self.api_base_url = api_base_url
        self.cache: Optional[VoiceContext] = None
        self.cache_time: float = 0
        self.cache_ttl: float = 300  # 5 minutes
    
    async def get_voice_context(self) -> VoiceContext:
        """获取语音对话上下文"""
        # 检查缓存
        if self._is_cache_valid():
            return self.cache
        
        # 调用统一智能服务 API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/api/unified-intelligence/voice-context"
            )
            if response.status_code == 200:
                self.cache = response.json()
                self.cache_time = time.time()
                return self.cache
        
        return self._get_fallback_context()
    
    def build_system_prompt(self, context: VoiceContext) -> str:
        """构建语音对话的系统提示"""
        return f"""你是一个投资助手，正在通过语音与用户对话。

当前投资组合状态：
{context['portfolioSummary']}

风险状态：
{context['riskSummary']}

{self._format_latest_analysis(context.get('latestAnalysis'))}

请用简洁的语言回答用户问题，适合语音播报。"""
```

## API Endpoints

### GET /api/unified-intelligence/voice-context

```typescript
// api/unified-intelligence/voice-context.ts

export default async function handler(req: Request) {
  const service = new UnifiedIntelligenceService();
  const context = await service.getVoiceContext();
  
  return new Response(JSON.stringify(context), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

### POST /api/unified-intelligence/query

```typescript
// api/unified-intelligence/query.ts

export default async function handler(req: Request) {
  const { question, context, forceMode } = await req.json();
  
  const service = new UnifiedIntelligenceService();
  const result = await service.query(question, { ...context, forceMode });
  
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

### POST /api/unified-intelligence/deep-analyze

```typescript
// api/unified-intelligence/deep-analyze.ts

export default async function handler(req: Request) {
  const { portfolio, query } = await req.json();
  
  const service = new UnifiedIntelligenceService();
  const result = await service.deepAnalyze(portfolio, query);
  
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## Caching Strategy

```typescript
// client/src/services/unifiedIntelligence/cache.ts

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class UnifiedIntelligenceCache {
  private cache = new Map<string, CacheEntry<any>>();
  
  // Agent 分析结果缓存 (5分钟)
  private readonly AGENT_RESULT_TTL = 5 * 60 * 1000;
  
  // LightRAG 查询缓存 (10分钟)
  private readonly LIGHTRAG_TTL = 10 * 60 * 1000;
  
  // 市场数据缓存 (1小时)
  private readonly MARKET_DATA_TTL = 60 * 60 * 1000;
  
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    
    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
    return data;
  }
  
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}
```

## Error Handling

### Fallback Chain

```typescript
// client/src/services/unifiedIntelligence/fallback.ts

class FallbackHandler {
  async executeWithFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    errorHandler?: (error: Error) => void
  ): Promise<T> {
    try {
      return await primary();
    } catch (error) {
      errorHandler?.(error as Error);
      console.warn('Primary failed, using fallback:', error);
      return await fallback();
    }
  }
}

// 使用示例
const result = await fallbackHandler.executeWithFallback(
  // Primary: 使用统一智能系统
  () => unifiedService.query(question),
  // Fallback: 使用简单 RAG
  () => ragService.getInvestmentContext(question),
  // Error handler
  (error) => logError('unified-intelligence', error)
);
```

### Agent Failure Isolation

```typescript
// 单个 Agent 失败不阻塞整体分析
async function executeAgentsWithIsolation(
  agents: Agent[],
  context: AnalysisContext
): Promise<AgentResult[]> {
  const results = await Promise.allSettled(
    agents.map(agent => agent.analyze(context))
  );
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    
    // 失败的 Agent 返回错误状态
    return {
      agentId: agents[index].id,
      status: 'error',
      error: result.reason.message,
      summary: `${agents[index].name} 分析失败`,
    };
  });
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do.*

### Property 1: Query Classification Consistency

*For any* query with confidence > 0.8 from Query_Router, the Query_Classifier SHALL return mode 'rag_only'

*For any* query containing deep analysis keywords (深度分析, 全面评估, 风险诊断), the Query_Classifier SHALL return mode 'full_agent'

**Validates: Requirements 3.1, 3.2**

### Property 2: LightRAG Priority

*For any* vectorstore route, the Enhanced_Adaptive_RAG SHALL attempt LightRAG query before Supabase fallback

*For any* LightRAG failure, the system SHALL successfully fallback to Supabase vector search

**Validates: Requirements 1.1, 1.2**

### Property 3: Hallucination Grading Integration

*For any* Agent-generated response, the Hallucination_Grader SHALL be invoked before returning to user

*For any* response graded as hallucination, the Agent_Orchestrator SHALL trigger re-analysis

**Validates: Requirements 2.4, 2.5**

### Property 4: Response Time Bounds

*For any* RAG-only query, the response time SHALL be less than 2 seconds

*For any* Multi-Agent analysis, the response time SHALL be less than 30 seconds

**Validates: Requirements 3.4, 3.5**

### Property 5: Agent Failure Isolation

*For any* single Agent failure, the remaining Agents SHALL continue execution

*For any* analysis with Agent failures, the result SHALL include partial results from successful Agents

**Validates: Requirements 9.1**

### Property 6: Cache Consistency

*For any* cached result within TTL, the system SHALL return cached data without re-fetching

*For any* cache invalidation, subsequent queries SHALL fetch fresh data

**Validates: Requirements 8.5, 8.6**

### Property 7: Backward Compatibility

*For any* call to existing ragService.getInvestmentContext(), the response format SHALL remain unchanged

*For any* environment with DISABLE_UNIFIED_INTELLIGENCE=true, the system SHALL use legacy implementation

**Validates: Requirements 10.1, 10.2**

## Testing Strategy

### Unit Tests

1. **QueryClassifier Tests**
   - 测试简单查询分类
   - 测试复杂查询分类
   - 测试边界情况

2. **EnhancedAdaptiveRAG Tests**
   - 测试 LightRAG 优先逻辑
   - 测试降级到 Supabase
   - 测试 Agent 检索接口

3. **AgentRAGIntegration Tests**
   - 测试质量控制流程
   - 测试幻觉检测集成

### Property-Based Tests

使用 fast-check 进行属性测试，每个属性至少运行 100 次迭代。

```typescript
// Feature: unified-intelligence, Property 1: Query Classification Consistency
test.prop([fc.string().filter(s => s.length > 0 && s.length < 500)])(
  'High confidence queries route to RAG only',
  async (query) => {
    // Mock high confidence from router
    mockQueryRouter.route.mockResolvedValue({ confidence: 0.9, ... });
    
    const result = await queryClassifier.classify(query);
    expect(result.mode).toBe('rag_only');
  }
);
```

### Integration Tests

1. 端到端查询流程测试
2. RiskCenter 集成测试
3. Chat 集成测试
4. Voice Service 集成测试

## Migration Plan

### Phase 1: Core Service (P0) - 2-3 days
1. 创建 UnifiedIntelligenceService
2. 实现 QueryClassifier
3. 创建 EnhancedAdaptiveRAG
4. 实现 AgentRAGIntegration
5. 创建 useUnifiedIntelligence Hook

### Phase 2: UI Integration (P0) - 2-3 days
1. 集成 RiskCenter AI Panel
2. 集成 DecisionCenter Chat
3. 创建 UI 组件 (ProgressBar, ResultsAccordion)

### Phase 3: Enhancement (P1) - 1-2 days
1. 集成 Daily Briefing
2. 实现缓存策略
3. 添加 API 端点

### Phase 4: Voice Integration (P2) - 1-2 days
1. 创建 Voice Context API
2. 集成 Voice Service
3. 测试语音触发分析

## Risks and Mitigations

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 多系统集成复杂度高 | 开发时间延长 | 分阶段实施，优先核心功能 |
| 性能下降 | 用户体验差 | 智能路由，简单问题快速响应 |
| LightRAG 不稳定 | 检索失败 | 自动降级到 Supabase |
| Agent 分析超时 | 用户等待过长 | 设置超时，返回部分结果 |
| 缓存一致性问题 | 数据过期 | 合理 TTL，支持手动刷新 |
