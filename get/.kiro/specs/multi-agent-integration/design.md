# Design: Multi-Agent System Deep Integration

## Overview

本设计文档描述如何将多 Agent 投资分析系统深度集成到现有的 UI 组件和服务中。

## Architecture

### Current State

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend                                │
├─────────────────────────────────────────────────────────────┤
│  RiskCenter    │  DecisionCenter  │  DailyBriefing          │
│  (AI Panel)    │  (Chat/Analysis) │  (Modal)                │
│       │        │        │         │        │                │
│       ▼        │        ▼         │        ▼                │
│  /api/chat     │   ragService     │   aiService             │
│  (直接调用)    │   + /api/chat    │   .generateDailyInsight │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Multi-Agent System                         │
│  (仅在 aiService.generateRiskReport 中使用)                  │
└─────────────────────────────────────────────────────────────┘
```

### Target State

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend                                │
├─────────────────────────────────────────────────────────────┤
│  RiskCenter    │  DecisionCenter  │  DailyBriefing          │
│  (AI Panel)    │  (Chat/Analysis) │  (Modal)                │
│       │        │        │         │        │                │
│       ▼        │        ▼         │        ▼                │
│  useMultiAgent │  useMultiAgent   │   useMultiAgent         │
│  Hook          │  Hook + RAG      │   Hook                  │
└───────┬────────┴────────┬─────────┴────────┬────────────────┘
        │                 │                  │
        └─────────────────┼──────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Multi-Agent Service                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              AgentOrchestrator                        │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │   │
│  │  │Position │ │  Risk   │ │ Market  │ │ Advisor │    │   │
│  │  │Analyst  │→│ Analyst │→│ Analyst │→│         │    │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │MemoryManager │ │ AlertManager │ │ StateManager │         │
│  └──────────────┘ └──────────────┘ └──────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. useMultiAgent Hook

创建一个统一的 React Hook 来管理多 Agent 交互。

```typescript
// client/src/hooks/useMultiAgent.ts

interface UseMultiAgentOptions {
  mode?: OrchestrationMode;
  enableMemory?: boolean;
  enableAlerts?: boolean;
  onAlert?: (alert: AgentAlertEvent) => void;
}

interface UseMultiAgentReturn {
  // State
  isAnalyzing: boolean;
  progress: ProgressStatus | null;
  result: OrchestratorResult | null;
  error: Error | null;
  
  // Actions
  analyze: (portfolio: PortfolioState, query?: string) => Promise<void>;
  quickAnalyze: (portfolio: PortfolioState, query: string) => Promise<void>;
  cancel: () => void;
  clearCache: () => void;
  
  // Agent Results
  agentResults: Map<string, AgentResult>;
  currentAgent: string | null;
}

export function useMultiAgent(options?: UseMultiAgentOptions): UseMultiAgentReturn;
```

### 2. RiskCenter AI Panel Integration

修改 `AIAnalysisPanel` 组件使用多 Agent 系统。

```typescript
// 修改 client/src/pages/RiskCenter.tsx 中的 AIAnalysisPanel

function AIAnalysisPanel({ riskMetrics, thresholds, breakerSummary, dashboard, history }: AIAnalysisPanelProps) {
  const { 
    analyze, 
    isAnalyzing, 
    progress, 
    result, 
    agentResults,
    currentAgent 
  } = useMultiAgent({
    mode: 'sequential',
    enableAlerts: true,
    onAlert: (alert) => {
      // 添加到风控日志
      addRiskLog(alert);
    }
  });

  const handleStartAnalysis = async () => {
    const portfolio = buildPortfolioState(dashboard, positions);
    await analyze(portfolio, '深度风控分析');
  };

  return (
    <div>
      {/* 进度显示 */}
      {isAnalyzing && progress && (
        <AgentProgressBar 
          phase={progress.phase}
          progress={progress.progress}
          currentAgent={currentAgent}
        />
      )}
      
      {/* Agent 结果展示 */}
      {result && (
        <AgentResultsAccordion results={agentResults} />
      )}
      
      {/* 追问输入 */}
      <QuickQuestionInput 
        onSubmit={(q) => quickAnalyze(portfolio, q)}
      />
    </div>
  );
}
```

### 3. Chat Integration with Query Router

在聊天中智能路由查询到合适的模式。

```typescript
// client/src/services/chatQueryRouter.ts

interface QueryClassification {
  type: 'simple' | 'complex' | 'analysis';
  suggestedMode: OrchestrationMode;
  confidence: number;
}

export function classifyQuery(query: string): QueryClassification {
  // 简单问题模式
  const simplePatterns = [
    /^(什么是|解释|定义)/,
    /^(今天|现在|当前).*(怎么样|如何)/,
    /\?$/,  // 简短问句
  ];
  
  // 复杂分析模式
  const complexPatterns = [
    /(分析|诊断|评估|研究)/,
    /(风险|回撤|杠杆|持仓)/,
    /(建议|操作|调仓)/,
  ];
  
  // 判断逻辑
  if (query.length < 20 && simplePatterns.some(p => p.test(query))) {
    return { type: 'simple', suggestedMode: 'respond_directly', confidence: 0.8 };
  }
  
  if (complexPatterns.some(p => p.test(query))) {
    return { type: 'analysis', suggestedMode: 'sequential', confidence: 0.9 };
  }
  
  return { type: 'complex', suggestedMode: 'selector', confidence: 0.6 };
}
```

### 4. Daily Briefing Enhancement

增强每日洞察生成。

```typescript
// client/src/services/aiService.ts

async generateDailyInsightWithAgents(): Promise<DailyInsight> {
  const service = createMultiAgentService({
    mode: 'sequential',
    enableMemory: true,
  });
  
  const result = await service.quickAnalyze(
    await this.getCurrentPortfolio(),
    '生成今日投资洞察，包括持仓变化、风险评估和市场动态'
  );
  
  return {
    summary: result.finalReport.summary,
    positionInsights: result.results.find(r => r.agentId === 'position_analyst')?.summary,
    riskInsights: result.results.find(r => r.agentId === 'risk_analyst')?.summary,
    marketInsights: result.results.find(r => r.agentId === 'market_analyst')?.summary,
    recommendation: result.finalReport.recommendation,
  };
}
```

### 5. Voice Service Integration

在 Python 语音服务中集成 Agent 结果。

```python
# voice-service/agent_context.py

import httpx
from typing import Optional, Dict, Any

class AgentContextFetcher:
    """获取多 Agent 分析结果作为语音对话上下文"""
    
    def __init__(self, api_base_url: str):
        self.api_base_url = api_base_url
        self.cached_analysis: Optional[Dict[str, Any]] = None
        self.cache_timestamp: float = 0
        self.cache_ttl: float = 300  # 5 minutes
    
    async def get_latest_analysis(self) -> Optional[Dict[str, Any]]:
        """获取最新的 Agent 分析结果"""
        import time
        
        # 检查缓存
        if self.cached_analysis and (time.time() - self.cache_timestamp) < self.cache_ttl:
            return self.cached_analysis
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.api_base_url}/api/agent-analysis/latest"
                )
                if response.status_code == 200:
                    self.cached_analysis = response.json()
                    self.cache_timestamp = time.time()
                    return self.cached_analysis
        except Exception as e:
            print(f"Failed to fetch agent analysis: {e}")
        
        return None
    
    def build_voice_context(self, analysis: Dict[str, Any]) -> str:
        """构建语音对话上下文"""
        if not analysis:
            return ""
        
        context_parts = []
        
        # 添加风险摘要
        if risk := analysis.get('risk_summary'):
            context_parts.append(f"当前风险等级: {risk['level']}, {risk['summary']}")
        
        # 添加持仓摘要
        if position := analysis.get('position_summary'):
            context_parts.append(f"持仓分析: {position['summary']}")
        
        # 添加市场动态
        if market := analysis.get('market_summary'):
            context_parts.append(f"市场动态: {market['summary']}")
        
        return "\n".join(context_parts)
```

## UI Components

### AgentProgressBar

```typescript
// client/src/components/agents/AgentProgressBar.tsx

interface AgentProgressBarProps {
  phase: string;
  progress: number;
  currentAgent: string | null;
  agents: string[];
}

export function AgentProgressBar({ phase, progress, currentAgent, agents }: AgentProgressBarProps) {
  return (
    <div className="space-y-2">
      {/* 总体进度 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-white/50">{progress}%</span>
      </div>
      
      {/* Agent 步骤 */}
      <div className="flex items-center gap-1">
        {agents.map((agent, i) => (
          <div 
            key={agent}
            className={cn(
              "flex-1 h-1 rounded-full transition-colors",
              currentAgent === agent ? 'bg-cyan-500 animate-pulse' :
              i < agents.indexOf(currentAgent || '') ? 'bg-emerald-500' :
              'bg-white/10'
            )}
          />
        ))}
      </div>
      
      {/* 当前阶段 */}
      <p className="text-xs text-white/50">
        {phase}: {getAgentDisplayName(currentAgent)}
      </p>
    </div>
  );
}
```

### AgentResultsAccordion

```typescript
// client/src/components/agents/AgentResultsAccordion.tsx

interface AgentResultsAccordionProps {
  results: Map<string, AgentResult>;
}

export function AgentResultsAccordion({ results }: AgentResultsAccordionProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  
  return (
    <div className="space-y-2">
      {Array.from(results.entries()).map(([agentId, result]) => (
        <div 
          key={agentId}
          className={cn(
            "rounded-xl border transition-all",
            result.status === 'success' ? 'border-emerald-500/30' : 'border-red-500/30'
          )}
        >
          <button
            onClick={() => setExpanded(expanded === agentId ? null : agentId)}
            className="w-full flex items-center justify-between p-3"
          >
            <div className="flex items-center gap-2">
              <AgentIcon agentId={agentId} />
              <span className="font-medium">{getAgentDisplayName(agentId)}</span>
            </div>
            <ChevronDown className={cn(
              "transition-transform",
              expanded === agentId && "rotate-180"
            )} />
          </button>
          
          {expanded === agentId && (
            <div className="px-3 pb-3 text-sm text-white/70">
              <p>{result.summary}</p>
              {result.data.key_findings && (
                <ul className="mt-2 space-y-1">
                  {result.data.key_findings.map((f: string, i: number) => (
                    <li key={i}>• {f}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

## API Endpoints

### GET /api/agent-analysis/latest

返回最新的 Agent 分析结果（用于语音服务）。

```typescript
// api/agent-analysis/latest.ts

export default async function handler(req: Request) {
  const supabase = createClient();
  
  const { data } = await supabase
    .from('ai_analyses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!data) {
    return new Response(JSON.stringify({ error: 'No analysis found' }), { status: 404 });
  }
  
  // 解析 execution_trace 获取各 Agent 结果
  const trace = data.execution_trace || {};
  
  return new Response(JSON.stringify({
    id: data.id,
    created_at: data.created_at,
    risk_level: extractRiskLevel(data.content),
    risk_summary: trace.risk_analyst?.summary,
    position_summary: trace.position_analyst?.summary,
    market_summary: trace.market_analyst?.summary,
    recommendation: data.recommendation,
  }));
}
```

## State Management

### Agent Analysis Cache

```typescript
// client/src/stores/agentAnalysisStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AgentAnalysisState {
  latestResult: OrchestratorResult | null;
  lastAnalyzedAt: number | null;
  isStale: boolean;
  
  setResult: (result: OrchestratorResult) => void;
  markStale: () => void;
  clear: () => void;
}

export const useAgentAnalysisStore = create<AgentAnalysisState>()(
  persist(
    (set, get) => ({
      latestResult: null,
      lastAnalyzedAt: null,
      isStale: true,
      
      setResult: (result) => set({
        latestResult: result,
        lastAnalyzedAt: Date.now(),
        isStale: false,
      }),
      
      markStale: () => set({ isStale: true }),
      
      clear: () => set({
        latestResult: null,
        lastAnalyzedAt: null,
        isStale: true,
      }),
    }),
    {
      name: 'agent-analysis-cache',
      partialize: (state) => ({
        latestResult: state.latestResult,
        lastAnalyzedAt: state.lastAnalyzedAt,
      }),
    }
  )
);
```

## Error Handling

### Graceful Degradation

```typescript
// client/src/services/agents/fallback.ts

export async function analyzeWithFallback(
  portfolio: PortfolioState,
  query: string,
  options: AnalysisOptions
): Promise<AnalysisResult> {
  try {
    // 尝试多 Agent 分析
    const service = createMultiAgentService(options);
    return await service.analyze({ portfolio, query });
  } catch (error) {
    console.warn('Multi-agent analysis failed, falling back to legacy:', error);
    
    // 回退到原有实现
    return await legacyAnalyze(portfolio, query);
  }
}
```

## Testing Strategy

### Integration Tests

```typescript
// client/src/services/agents/integration.test.ts

describe('Multi-Agent Integration', () => {
  describe('RiskCenter Integration', () => {
    it('should display agent progress during analysis', async () => {
      // ...
    });
    
    it('should show all agent results in accordion', async () => {
      // ...
    });
  });
  
  describe('Chat Integration', () => {
    it('should route simple queries to respond_directly mode', async () => {
      // ...
    });
    
    it('should route complex queries to sequential mode', async () => {
      // ...
    });
  });
});
```

## Migration Plan

### Phase 1: Core Integration (P0)
1. 创建 `useMultiAgent` Hook
2. 集成 RiskCenter AI Panel
3. 集成 DecisionCenter Chat

### Phase 2: Enhancement (P1)
1. 增强 Daily Briefing
2. 完善 AgentDemo 页面
3. 添加 Agent 结果缓存

### Phase 3: Voice Integration (P2)
1. 创建 Agent Context API
2. 集成 Voice Service
3. 添加语音触发分析

## Risks and Mitigations

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 多 Agent 分析耗时过长 | 用户体验差 | 使用 respond_directly 模式快速响应 |
| API 调用失败 | 功能不可用 | 实现优雅降级到原有实现 |
| 内存占用过高 | 性能问题 | 限制缓存大小，定期清理 |
| 并发分析冲突 | 数据不一致 | 使用请求队列，取消旧请求 |
