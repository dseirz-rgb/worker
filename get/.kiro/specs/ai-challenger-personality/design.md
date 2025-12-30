# Design: AI Challenger Personality Enhancement

## Overview

本设计文档描述如何恢复和强化 AI 系统的"严厉教练"风格，确保统一智能系统继承原有的 "Debate & Challenge" 设计。

核心设计理念：
1. **继承而非重建** - 保留原有 aiService 的优秀设计，让新系统继承
2. **Prompt 注入** - 在所有 AI 调用中注入"质疑"指令
3. **Personality 升级** - 将 Advisor Agent 默认 personality 改为 aggressive
4. **透明化公示** - 在设置页面展示所有 AI 功能的调教方式

## Architecture

### Current State (风格被稀释)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      User Query                                          │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│   aiService       │   │ UnifiedIntelligence│   │   Multi-Agent     │
│   (有质疑风格)    │   │   (风格丢失)       │   │   (moderate)      │
│   ✅ Debate &     │   │   ❌ 没有继承      │   │   ❌ 太温和       │
│      Challenge    │   │      原有风格      │   │                   │
└───────────────────┘   └───────────────────┘   └───────────────────┘
```


### Target State (风格统一)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      User Query                                          │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Challenger Prompt Builder                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  buildChallengerPrompt(basePrompt, context)                        │ │
│  │  - Inject "Debate & Challenge" instructions                        │ │
│  │  - Inject "拒绝空洞" style requirements                            │ │
│  │  - Inject principle contradiction detection                        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│   aiService       │   │ UnifiedIntelligence│   │   Multi-Agent     │
│   ✅ 保留原有     │   │   ✅ 继承质疑风格 │   │   ✅ aggressive   │
│      质疑风格     │   │                    │   │      personality  │
└───────────────────┘   └───────────────────┘   └───────────────────┘
```

## Components and Interfaces

### 1. ChallengerPromptBuilder (核心组件)

```typescript
// client/src/services/challengerPromptBuilder.ts

/**
 * 质疑风格 Prompt 构建器
 * 在所有 AI 调用中注入"严厉教练"风格的指令
 */

export interface ChallengerConfig {
  enabled: boolean;                    // 是否启用质疑模式
  devilsAdvocate: boolean;             // 是否启用魔鬼代言人
  principleCheck: boolean;             // 是否检查原则一致性
  cognitiveBiasDetection: boolean;     // 是否检测认知偏差
}

export const DEFAULT_CHALLENGER_CONFIG: ChallengerConfig = {
  enabled: true,
  devilsAdvocate: true,
  principleCheck: true,
  cognitiveBiasDetection: true,
};

/**
 * 质疑风格的核心指令
 * 从原有 aiService 中提取并增强
 */
export const CHALLENGER_INSTRUCTIONS = `
### 🎯 CHALLENGER MODE INSTRUCTIONS

1. **Debate & Challenge**: 不要只是同意。挑战用户的假设，用数据和原则来质疑他们的决策。
   - 如果用户的行为与其投资原则矛盾，直接指出
   - 引用用户笔记中的具体原则

2. **拒绝空洞**: 不要说废话。
   - ❌ 不要说: "注意风险", "保持谨慎", "市场有波动"
   - ✅ 要说: "你的腾讯占比30%超过了你笔记中20%的上限"
   - 必须包含具体数字、股票代码或百分比

3. **魔鬼代言人**: 主动提出反面观点。
   - 如果用户看好某只股票，提出至少2个看空理由
   - 如果用户看空某只股票，提出至少2个看多理由
   - 用 "🤔 反面观点" 标记

4. **直接开始**: 不要用客套话开头。
   - ❌ 不要说: "您的投资组合看起来不错..."
   - ✅ 直接说: "等等，你的腾讯占比30%..."

5. **尖锐提问**: 问让用户思考的问题。
   - "你真的考虑过最坏情况吗？"
   - "上次这样做的结果是什么？这次有什么不同？"
   - "你是故意违背自己的原则，还是忘了？"
`;


/**
 * 构建带有质疑风格的 Prompt
 */
export function buildChallengerPrompt(
  basePrompt: string,
  context: {
    userPrinciples?: string[];      // 用户的投资原则
    currentHoldings?: any[];        // 当前持仓
    historicalMistakes?: any[];     // 历史错误
  },
  config: ChallengerConfig = DEFAULT_CHALLENGER_CONFIG
): string {
  if (!config.enabled) {
    return basePrompt;
  }

  let enhancedPrompt = basePrompt;

  // 1. 注入质疑指令
  enhancedPrompt += '\n\n' + CHALLENGER_INSTRUCTIONS;

  // 2. 注入原则检查上下文
  if (config.principleCheck && context.userPrinciples?.length) {
    enhancedPrompt += `\n\n### 📋 用户投资原则 (必须检查一致性)
${context.userPrinciples.map((p, i) => `${i + 1}. ${p}`).join('\n')}

如果用户的行为或问题与上述原则矛盾，必须直接指出！`;
  }

  // 3. 注入历史错误上下文
  if (context.historicalMistakes?.length) {
    enhancedPrompt += `\n\n### ⚠️ 历史教训 (如果相关，必须提醒)
${context.historicalMistakes.map(m => `- ${m.date}: ${m.description} (结果: ${m.outcome})`).join('\n')}`;
  }

  return enhancedPrompt;
}
```

### 2. Challenger Personality Preset (personality.ts 扩展)

```typescript
// 添加到 client/src/services/agents/personality.ts

/**
 * Challenger personality preset
 * 用于 Advisor Agent 的默认配置
 */
export const CHALLENGER_PERSONALITY: AgentPersonality = {
  riskTolerance: 'aggressive',
  decisionStyle: 'data-driven',
  traits: [
    'critical',           // 批判性思维
    'challenging',        // 主动挑战
    'principle-enforcing', // 原则执行者
    'direct',             // 直接了当
    'devil-advocate',     // 魔鬼代言人
    'no-hedging',         // 不用模糊词
  ]
};

/**
 * 生成 Challenger 风格的 Prompt
 */
export function generateChallengerPersonalityPrompt(): string {
  return `## Personality: Challenger (严厉教练)

你是一个严厉但负责任的投资教练。你的职责是：

### 核心行为
- **质疑一切**: 不要轻易同意用户的观点，用数据和逻辑挑战他们
- **原则执行**: 检查用户行为是否符合他们自己的投资原则
- **直接了当**: 不用"可能"、"也许"、"或许"等模糊词
- **魔鬼代言人**: 主动提出反面观点

### 禁止行为
- ❌ 不要用客套话开头
- ❌ 不要说空洞的废话 ("注意风险")
- ❌ 不要过度安慰用户
- ❌ 不要回避尖锐问题

### 必须行为
- ✅ 用具体数字说话
- ✅ 引用用户的笔记和原则
- ✅ 问尖锐的问题
- ✅ 指出矛盾和偏差`;
}
```


### 3. AI Personality Config (集中配置)

```typescript
// client/src/services/aiPersonalityConfig.ts

/**
 * AI 功能配置信息
 * 用于设置页面的"AI 调教公示"展示
 */

export interface AIFeatureConfig {
  id: string;
  name: string;
  icon: string;
  style: string;
  coreInstructions: string[];
  goodExample: string;
  badExample: string;
  promptSource: string;  // 实际 prompt 的来源文件
}

export const AI_FEATURE_CONFIGS: AIFeatureConfig[] = [
  {
    id: 'chat',
    name: '聊天助手 (Investment Mirror)',
    icon: '📱',
    style: '严厉教练 + 魔鬼代言人',
    coreInstructions: [
      'Debate & Challenge: 不要只是同意，要挑战用户的假设',
      'Data-Driven: 用数据支持论点',
      '拒绝空洞: 不说"注意风险"，要说具体数字',
    ],
    goodExample: '等等，你的腾讯占比30%，但你笔记里写的是不超过20%',
    badExample: '您的投资组合看起来不错...',
    promptSource: 'client/src/services/aiService.ts',
  },
  {
    id: 'daily-insight',
    name: '每日洞察 (Daily Insight)',
    icon: '📊',
    style: '严厉但负责任的教练',
    coreInstructions: [
      '针对性强: 必须结合具体持仓风险',
      '结合笔记: 指出行为与原则的冲突',
      '简短有力: 不超过100字',
    ],
    goodExample: '腾讯占比30%超过你的20%上限，考虑减仓',
    badExample: '市场波动是常态，保持冷静',
    promptSource: 'client/src/services/aiService.ts',
  },
  {
    id: 'risk-analysis',
    name: '风控分析 (Risk Analysis)',
    icon: '🚨',
    style: '激进型分析师 (Aggressive)',
    coreInstructions: [
      '主动识别风险，不等用户问',
      '提出反面观点，帮助压力测试',
      '检测认知偏差 (确认偏差、损失厌恶等)',
    ],
    goodExample: '杠杆1.8倍，如果市场跌20%你会爆仓，你考虑过吗？',
    badExample: '您的杠杆率在可接受范围内',
    promptSource: 'client/src/services/agents/advisorAgent.ts',
  },
  {
    id: 'advisor',
    name: '投资顾问 (Advisor Agent)',
    icon: '💼',
    style: '批判性思维 + 原则执行者',
    coreInstructions: [
      '不用模糊词: 避免"可能"、"也许"',
      '问尖锐问题: "你真的考虑过最坏情况吗？"',
      '历史对质: "上次这样做的结果是什么？"',
    ],
    goodExample: '卖掉腾讯5%，把集中度降到25%以下，现在就做',
    badExample: '建议您考虑适当调整仓位',
    promptSource: 'client/src/services/agents/advisorAgent.ts',
  },
];

/**
 * 获取所有 AI 功能配置
 */
export function getAIFeatureConfigs(): AIFeatureConfig[] {
  return AI_FEATURE_CONFIGS;
}

/**
 * 获取单个 AI 功能配置
 */
export function getAIFeatureConfig(id: string): AIFeatureConfig | undefined {
  return AI_FEATURE_CONFIGS.find(c => c.id === id);
}
```


### 4. AI Personality Display Component (UI 组件)

```tsx
// client/src/components/settings/AIPersonalityDisplay.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAIFeatureConfigs, AIFeatureConfig } from '@/services/aiPersonalityConfig';

export function AIPersonalityDisplay() {
  const configs = getAIFeatureConfigs();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🤖</span>
        <h2 className="text-xl font-semibold">AI 调教公示</h2>
      </div>
      
      <p className="text-sm text-muted-foreground">
        以下是每个 AI 功能的设计风格和核心指令，让你了解 AI 是如何被"调教"的。
      </p>

      <div className="grid gap-4">
        {configs.map((config) => (
          <AIFeatureCard key={config.id} config={config} />
        ))}
      </div>
    </div>
  );
}

function AIFeatureCard({ config }: { config: AIFeatureConfig }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span>{config.icon}</span>
          <span>{config.name}</span>
          <Badge variant="secondary" className="ml-auto">
            {config.style}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 核心指令 */}
        <div>
          <p className="text-sm font-medium mb-1">核心指令:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            {config.coreInstructions.map((instruction, i) => (
              <li key={i}>• {instruction}</li>
            ))}
          </ul>
        </div>

        {/* 示例对比 */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 bg-red-50 dark:bg-red-950 rounded">
            <p className="font-medium text-red-600 dark:text-red-400">❌ 不好的回答</p>
            <p className="text-red-700 dark:text-red-300 mt-1">{config.badExample}</p>
          </div>
          <div className="p-2 bg-green-50 dark:bg-green-950 rounded">
            <p className="font-medium text-green-600 dark:text-green-400">✅ 好的回答</p>
            <p className="text-green-700 dark:text-green-300 mt-1">{config.goodExample}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Data Models

### ChallengerContext

```typescript
interface ChallengerContext {
  userPrinciples: string[];           // 用户投资原则列表
  currentHoldings: {
    ticker: string;
    weight: number;
    pnl: number;
  }[];
  historicalMistakes: {
    date: string;
    description: string;
    outcome: string;
  }[];
  recentDecisions: {
    date: string;
    action: string;
    ticker: string;
    result?: string;
  }[];
}
```


## Integration Points

### 1. aiService.ts Integration

```typescript
// 在 aiService.sendMessage 中，保留并强化原有的质疑风格
// 原有代码已经有 "Debate & Challenge"，只需确保不被覆盖

const systemInstructionText = `
You are "Investment Mirror" (PIP - Personalized Investment Partner).
Your role is to act as a critical, data-driven, and debating partner...

${CHALLENGER_INSTRUCTIONS}  // 注入增强的质疑指令
`;
```

### 2. UnifiedIntelligenceService Integration

```typescript
// client/src/services/unifiedIntelligence/unifiedIntelligenceService.ts

import { buildChallengerPrompt, DEFAULT_CHALLENGER_CONFIG } from '../challengerPromptBuilder';

class UnifiedIntelligenceService {
  async query(question: string, context?: QueryContext): Promise<QueryResult> {
    // 获取用户原则
    const userPrinciples = await this.loadUserPrinciples();
    
    // 构建带质疑风格的 prompt
    const enhancedPrompt = buildChallengerPrompt(
      question,
      {
        userPrinciples,
        currentHoldings: context?.portfolio?.positions,
      },
      DEFAULT_CHALLENGER_CONFIG
    );
    
    // 继续原有流程...
  }
}
```

### 3. AdvisorAgent Integration

```typescript
// client/src/services/agents/advisorAgent.ts

import { CHALLENGER_PERSONALITY, generateChallengerPersonalityPrompt } from './personality';

export class AdvisorAgent implements Agent {
  // 修改默认 personality 为 challenger
  personality = CHALLENGER_PERSONALITY;
  
  constructor(config: AdvisorConfig = {}) {
    // 如果没有指定 personality，使用 challenger
    this.personality = config.personality || CHALLENGER_PERSONALITY;
  }
}
```

### 4. Settings Page Integration

```tsx
// client/src/pages/RiskSettings.tsx 或新建 AISettings.tsx

import { AIPersonalityDisplay } from '@/components/settings/AIPersonalityDisplay';

export function RiskSettings() {
  return (
    <div className="space-y-8">
      {/* 现有设置内容 */}
      
      {/* 新增: AI 调教公示 */}
      <AIPersonalityDisplay />
    </div>
  );
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do.*

### Property 1: Principle Contradiction Detection

*For any* user query about a position that contradicts their documented principles, the AI response SHALL contain a reference to the specific principle being violated.

**Validates: Requirements 1.2, 1.3, 1.4**

### Property 2: Response Specificity

*For any* AI warning or advice, the response SHALL contain at least one specific number, ticker symbol, or percentage, and SHALL NOT contain generic phrases like "注意风险".

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 3: Devil's Advocate Counter-Arguments

*For any* user query expressing bullish or bearish sentiment on a stock, the AI response SHALL contain at least 2 counter-arguments labeled with "🤔 反面观点" or similar marker.

**Validates: Requirements 4.1, 4.2, 4.4**

### Property 4: Historical Confrontation

*For any* user decision that matches a pattern from their historical mistakes, the AI response SHALL reference the historical event with specific date and outcome.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 5: Cognitive Bias Detection

*For any* user query showing signs of confirmation bias, loss aversion, or recency bias, the AI response SHALL identify and explain the bias.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 6: Configuration Sync

*For any* AI feature displayed in the "AI 调教公示" section, the displayed configuration SHALL match the actual prompt configuration in the source file.

**Validates: Requirements 7.5**

### Property 7: Backward Compatibility

*For any* call to existing aiService.sendMessage() or Agent personality system, the response format and API contract SHALL remain unchanged.

**Validates: Requirements 8.1, 8.2, 8.3**


## Error Handling

### Graceful Degradation

```typescript
// 如果质疑模式出错，回退到原有行为
async function queryWithChallenger(question: string): Promise<string> {
  try {
    const enhancedPrompt = buildChallengerPrompt(question, context);
    return await callAI(enhancedPrompt);
  } catch (error) {
    console.warn('Challenger mode failed, falling back:', error);
    return await callAI(question);  // 回退到原有行为
  }
}
```

### Environment Variable Toggle

```typescript
// 支持通过环境变量禁用质疑模式
const CHALLENGER_ENABLED = import.meta.env.VITE_CHALLENGER_MODE !== 'false';

if (!CHALLENGER_ENABLED) {
  // 使用原有的温和模式
}
```

## Testing Strategy

### Unit Tests

1. **ChallengerPromptBuilder Tests**
   - 测试 prompt 注入是否正确
   - 测试原则检查上下文是否正确添加
   - 测试配置开关是否生效

2. **Personality Tests**
   - 测试 CHALLENGER_PERSONALITY 配置是否正确
   - 测试 generateChallengerPersonalityPrompt 输出

3. **AIPersonalityConfig Tests**
   - 测试配置数据完整性
   - 测试配置与实际 prompt 的一致性

### Property-Based Tests

使用 fast-check 进行属性测试，每个属性至少运行 100 次迭代。

```typescript
// Feature: ai-challenger-personality, Property 2: Response Specificity
test.prop([fc.string().filter(s => s.includes('风险'))])(
  'AI warnings should contain specific numbers',
  async (warningQuery) => {
    const response = await aiService.query(warningQuery);
    
    // 不应包含空洞的废话
    expect(response).not.toContain('注意风险');
    expect(response).not.toContain('保持谨慎');
    
    // 应包含具体数字或股票代码
    const hasSpecifics = /\d+%|\d+\.\d+|[A-Z]{2,5}/.test(response);
    expect(hasSpecifics).toBe(true);
  }
);
```

### Integration Tests

1. 端到端测试质疑模式是否生效
2. 测试设置页面 "AI 调教公示" 是否正确显示
3. 测试环境变量开关是否生效

## Migration Plan

### Phase 1: Core Components (Day 1)
1. 创建 `challengerPromptBuilder.ts`
2. 添加 `CHALLENGER_PERSONALITY` 到 `personality.ts`
3. 创建 `aiPersonalityConfig.ts`

### Phase 2: Integration (Day 1-2)
1. 修改 `advisorAgent.ts` 默认 personality
2. 在 `unifiedIntelligenceService.ts` 中集成 challenger prompt
3. 确保 `aiService.ts` 原有质疑风格不被覆盖

### Phase 3: UI (Day 2)
1. 创建 `AIPersonalityDisplay.tsx` 组件
2. 在设置页面添加 "AI 调教公示" 部分

### Phase 4: Testing (Day 2-3)
1. 编写单元测试
2. 编写属性测试
3. 手动测试 AI 响应风格

## Risks and Mitigations

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 质疑风格过于激进 | 用户体验差 | 提供环境变量开关，可禁用 |
| Prompt 过长影响性能 | 响应变慢 | 优化 prompt 长度，只注入必要指令 |
| 配置与实际不同步 | 公示信息不准确 | 添加自动化测试检查一致性 |
| 原有功能被破坏 | 回归问题 | 保持向后兼容，添加回归测试 |
