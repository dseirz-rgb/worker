/**
 * Agent Personality System
 * 
 * Inspired by Stockagent's character system, this module defines personality
 * configurations that affect agent decision-making style and risk tolerance.
 * 
 * @see https://github.com/MingyuJ666/Stockagent
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Risk tolerance level affects recommendation aggressiveness
 * - conservative: Prioritizes capital preservation, recommends defensive positions
 * - moderate: Balanced approach between growth and safety
 * - aggressive: Prioritizes growth opportunities, accepts higher volatility
 */
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

/**
 * Decision style affects analysis depth vs speed tradeoff
 * - data-driven: Relies heavily on quantitative metrics and historical data
 * - intuitive: Incorporates qualitative factors and market sentiment
 * - balanced: Combines both quantitative and qualitative approaches
 */
export type DecisionStyle = 'data-driven' | 'intuitive' | 'balanced';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Agent personality configuration
 * Affects decision-making style and risk tolerance in recommendations
 */
export interface AgentPersonality {
  /** Risk tolerance level affects recommendation aggressiveness */
  riskTolerance: RiskTolerance;
  
  /** Decision style affects analysis depth vs speed tradeoff */
  decisionStyle: DecisionStyle;
  
  /** Custom personality traits for prompt engineering */
  traits?: string[];
}

/**
 * Personality override options for ExecutionOptions
 * All fields are optional to allow partial overrides
 */
export interface PersonalityOverride {
  riskTolerance?: RiskTolerance;
  decisionStyle?: DecisionStyle;
  traits?: string[];
}

// ============================================================================
// Default Personalities
// ============================================================================

/**
 * Default personality presets for common use cases
 */
export const DEFAULT_PERSONALITIES: Record<string, AgentPersonality> = {
  /** Conservative investor focused on capital preservation */
  conservative: {
    riskTolerance: 'conservative',
    decisionStyle: 'data-driven',
    traits: ['cautious', 'risk-averse', 'long-term focused', 'dividend-oriented']
  },
  
  /** Moderate investor with balanced approach */
  moderate: {
    riskTolerance: 'moderate',
    decisionStyle: 'balanced',
    traits: ['balanced', 'diversification-focused', 'principle-aligned']
  },
  
  /** Aggressive investor seeking growth */
  aggressive: {
    riskTolerance: 'aggressive',
    decisionStyle: 'intuitive',
    traits: ['growth-oriented', 'opportunity-seeking', 'momentum-aware']
  },
  
  /** Quantitative analyst personality */
  quantitative: {
    riskTolerance: 'moderate',
    decisionStyle: 'data-driven',
    traits: ['analytical', 'metrics-focused', 'systematic', 'backtesting-oriented']
  },
  
  /** Value investor personality */
  valueInvestor: {
    riskTolerance: 'conservative',
    decisionStyle: 'data-driven',
    traits: ['value-focused', 'margin-of-safety', 'contrarian', 'patient']
  },

  /**
   * Challenger personality - 严厉教练
   * 用于 Advisor Agent 的默认配置
   * @see Requirements 2.1, 2.2, 2.3, 2.4, 2.5
   */
  challenger: {
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
  }
};

/**
 * Challenger personality preset
 * 用于 Advisor Agent 的默认配置
 * @see Requirements 2.1, 2.2, 2.3
 */
export const CHALLENGER_PERSONALITY: AgentPersonality = DEFAULT_PERSONALITIES.challenger;

// ============================================================================
// Prompt Template Functions
// ============================================================================

/**
 * Generate personality-aware system prompt prefix
 * This prefix is prepended to agent prompts to influence their behavior
 */
export function generatePersonalityPrompt(personality: AgentPersonality): string {
  const riskPrompt = getRiskTolerancePrompt(personality.riskTolerance);
  const stylePrompt = getDecisionStylePrompt(personality.decisionStyle);
  const traitsPrompt = personality.traits?.length 
    ? getTraitsPrompt(personality.traits) 
    : '';
  
  return `${riskPrompt}\n\n${stylePrompt}${traitsPrompt}`;
}

/**
 * Generate risk tolerance specific prompt guidance
 */
function getRiskTolerancePrompt(riskTolerance: RiskTolerance): string {
  switch (riskTolerance) {
    case 'conservative':
      return `## Risk Approach: Conservative
You prioritize capital preservation above all else. When making recommendations:
- Favor defensive positions and stable dividend-paying stocks
- Recommend reducing exposure when uncertainty is high
- Suggest maintaining higher cash reserves as a buffer
- Emphasize downside protection over upside potential
- Be skeptical of high-growth, high-volatility opportunities
- Recommend position sizes that limit maximum loss exposure`;

    case 'moderate':
      return `## Risk Approach: Moderate
You seek a balanced approach between growth and safety. When making recommendations:
- Balance growth opportunities with risk management
- Recommend diversification across sectors and asset classes
- Consider both upside potential and downside risks equally
- Suggest position sizes proportional to conviction level
- Accept moderate volatility for reasonable expected returns
- Maintain a mix of defensive and growth-oriented positions`;

    case 'aggressive':
      return `## Risk Approach: Aggressive
You prioritize growth opportunities and accept higher volatility. When making recommendations:
- Actively seek high-growth opportunities even with higher risk
- Be willing to concentrate positions in high-conviction ideas
- Consider momentum and market trends in decision-making
- Accept short-term volatility for long-term growth potential
- Recommend leveraging opportunities when risk/reward is favorable
- Focus on maximizing returns rather than minimizing drawdowns`;
  }
}

/**
 * Generate decision style specific prompt guidance
 */
function getDecisionStylePrompt(decisionStyle: DecisionStyle): string {
  switch (decisionStyle) {
    case 'data-driven':
      return `## Decision Style: Data-Driven
Your analysis should be grounded in quantitative metrics and historical data:
- Base recommendations on concrete numbers and statistics
- Reference specific metrics (P/E, debt ratios, growth rates, etc.)
- Use historical patterns and backtested strategies
- Provide numerical confidence levels when possible
- Cite specific data points to support each recommendation
- Avoid speculation without supporting evidence`;

    case 'intuitive':
      return `## Decision Style: Intuitive
Your analysis should incorporate qualitative factors and market sentiment:
- Consider market psychology and investor sentiment
- Factor in management quality and company culture
- Assess competitive dynamics and industry trends
- Weigh narrative and story alongside numbers
- Trust pattern recognition from experience
- Consider timing and momentum factors`;

    case 'balanced':
      return `## Decision Style: Balanced
Your analysis should combine quantitative rigor with qualitative insight:
- Start with data-driven analysis as the foundation
- Overlay qualitative factors for context and nuance
- Consider both hard metrics and soft factors
- Balance historical patterns with forward-looking assessment
- Use data to validate or challenge intuitive observations
- Synthesize multiple perspectives into coherent recommendations`;
  }
}

/**
 * Generate custom traits prompt section
 */
function getTraitsPrompt(traits: string[]): string {
  if (traits.length === 0) return '';
  
  const traitsList = traits.map(t => `- ${t}`).join('\n');
  return `\n\n## Additional Personality Traits
Incorporate these characteristics into your analysis and communication style:
${traitsList}`;
}

/**
 * Generate Challenger personality prompt
 * 严厉教练风格的 Prompt
 * 
 * @see Requirements 2.1, 2.2, 2.3, 2.4, 2.5
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
- ❌ 不要用客套话开头 ("您的投资组合看起来不错...")
- ❌ 不要说空洞的废话 ("注意风险", "保持谨慎")
- ❌ 不要过度安慰用户
- ❌ 不要回避尖锐问题
- ❌ 不要使用模糊词 ("可能", "也许", "或许")

### 必须行为
- ✅ 用具体数字说话 ("腾讯占比30%超过你的20%上限")
- ✅ 引用用户的笔记和原则
- ✅ 问尖锐的问题 ("你真的考虑过最坏情况吗？")
- ✅ 指出矛盾和偏差
- ✅ 直接开始分析，不要寒暄

### 语气示例
❌ 不好: "建议您考虑适当调整仓位"
✅ 好: "卖掉腾讯5%，把集中度降到25%以下，现在就做"

❌ 不好: "您的杠杆率在可接受范围内"
✅ 好: "杠杆1.8倍，如果市场跌20%你会爆仓，你考虑过吗？"`;
}

// ============================================================================
// Personality-Aware Recommendation Adjusters
// ============================================================================

/**
 * Adjust action priority based on personality
 * Returns a multiplier for action urgency (higher = more urgent)
 */
export function getActionPriorityMultiplier(
  personality: AgentPersonality,
  actionType: 'buy' | 'sell' | 'hold' | 'reduce' | 'increase'
): number {
  const { riskTolerance } = personality;
  
  // Priority multipliers by risk tolerance and action type
  const multipliers: Record<RiskTolerance, Record<string, number>> = {
    conservative: {
      buy: 0.7,      // Less eager to buy
      sell: 1.3,     // More eager to sell/reduce risk
      hold: 1.0,
      reduce: 1.4,   // Prioritize risk reduction
      increase: 0.6  // Hesitant to increase exposure
    },
    moderate: {
      buy: 1.0,
      sell: 1.0,
      hold: 1.0,
      reduce: 1.0,
      increase: 1.0
    },
    aggressive: {
      buy: 1.3,      // More eager to buy opportunities
      sell: 0.7,     // Less eager to sell
      hold: 0.9,
      reduce: 0.6,   // Less focused on reducing
      increase: 1.4  // Eager to increase winners
    }
  };
  
  return multipliers[riskTolerance][actionType] ?? 1.0;
}

/**
 * Get recommended position size limit based on personality
 * Returns maximum percentage of portfolio for a single position
 */
export function getMaxPositionSize(personality: AgentPersonality): number {
  switch (personality.riskTolerance) {
    case 'conservative':
      return 0.15; // 15% max per position
    case 'moderate':
      return 0.25; // 25% max per position
    case 'aggressive':
      return 0.40; // 40% max per position
  }
}

/**
 * Get recommended cash reserve based on personality
 * Returns minimum percentage of portfolio to keep in cash
 */
export function getMinCashReserve(personality: AgentPersonality): number {
  switch (personality.riskTolerance) {
    case 'conservative':
      return 0.20; // 20% minimum cash
    case 'moderate':
      return 0.10; // 10% minimum cash
    case 'aggressive':
      return 0.05; // 5% minimum cash
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Merge personality with override, applying partial overrides
 */
export function mergePersonality(
  base: AgentPersonality,
  override?: PersonalityOverride
): AgentPersonality {
  if (!override) return base;
  
  return {
    riskTolerance: override.riskTolerance ?? base.riskTolerance,
    decisionStyle: override.decisionStyle ?? base.decisionStyle,
    traits: override.traits ?? base.traits
  };
}

/**
 * Validate personality configuration
 * Returns true if valid, throws error if invalid
 */
export function validatePersonality(personality: AgentPersonality): boolean {
  const validRiskTolerances: RiskTolerance[] = ['conservative', 'moderate', 'aggressive'];
  const validDecisionStyles: DecisionStyle[] = ['data-driven', 'intuitive', 'balanced'];
  
  if (!validRiskTolerances.includes(personality.riskTolerance)) {
    throw new Error(`Invalid riskTolerance: ${personality.riskTolerance}. Must be one of: ${validRiskTolerances.join(', ')}`);
  }
  
  if (!validDecisionStyles.includes(personality.decisionStyle)) {
    throw new Error(`Invalid decisionStyle: ${personality.decisionStyle}. Must be one of: ${validDecisionStyles.join(', ')}`);
  }
  
  if (personality.traits && !Array.isArray(personality.traits)) {
    throw new Error('traits must be an array of strings');
  }
  
  return true;
}

/**
 * Create a personality from a preset name
 */
export function createPersonalityFromPreset(
  presetName: keyof typeof DEFAULT_PERSONALITIES
): AgentPersonality {
  const preset = DEFAULT_PERSONALITIES[presetName];
  if (!preset) {
    throw new Error(`Unknown personality preset: ${presetName}. Available presets: ${Object.keys(DEFAULT_PERSONALITIES).join(', ')}`);
  }
  return { ...preset };
}

/**
 * Get a human-readable description of a personality
 */
export function describePersonality(personality: AgentPersonality): string {
  const riskDesc = {
    conservative: 'risk-averse, prioritizing capital preservation',
    moderate: 'balanced, seeking reasonable risk-adjusted returns',
    aggressive: 'growth-focused, accepting higher volatility'
  };
  
  const styleDesc = {
    'data-driven': 'relies on quantitative analysis and metrics',
    'intuitive': 'incorporates qualitative factors and market sentiment',
    'balanced': 'combines data analysis with qualitative insight'
  };
  
  let description = `This agent is ${riskDesc[personality.riskTolerance]} and ${styleDesc[personality.decisionStyle]}.`;
  
  if (personality.traits?.length) {
    description += ` Key traits: ${personality.traits.join(', ')}.`;
  }
  
  return description;
}
