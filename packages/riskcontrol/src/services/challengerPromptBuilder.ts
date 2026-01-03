/**
 * Challenger Prompt Builder
 * 
 * 质疑风格 Prompt 构建器
 * 在所有 AI 调用中注入"严厉教练"风格的指令
 * 
 * @see .kiro/specs/ai-challenger-personality/design.md
 * @see Requirements 1.1, 1.2, 3.1, 3.2
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Challenger mode configuration
 */
export interface ChallengerConfig {
  /** 是否启用质疑模式 */
  enabled: boolean;
  /** 是否启用魔鬼代言人 */
  devilsAdvocate: boolean;
  /** 是否检查原则一致性 */
  principleCheck: boolean;
  /** 是否检测认知偏差 */
  cognitiveBiasDetection: boolean;
}

/**
 * Context for challenger prompt building
 */
export interface ChallengerContext {
  /** 用户的投资原则 */
  userPrinciples?: string[];
  /** 当前持仓 */
  currentHoldings?: Array<{
    ticker: string;
    weight: number;
    pnl?: number;
  }>;
  /** 历史错误 */
  historicalMistakes?: Array<{
    date: string;
    description: string;
    outcome: string;
  }>;
  /** 近期决策 */
  recentDecisions?: Array<{
    date: string;
    action: string;
    ticker: string;
    result?: string;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Check if challenger mode is enabled via environment variable
 */
export const CHALLENGER_ENABLED = typeof import.meta !== 'undefined' 
  ? import.meta.env?.VITE_CHALLENGER_MODE !== 'false'
  : true;

/**
 * Default challenger configuration
 */
export const DEFAULT_CHALLENGER_CONFIG: ChallengerConfig = {
  enabled: CHALLENGER_ENABLED,
  devilsAdvocate: true,
  principleCheck: true,
  cognitiveBiasDetection: true,
};

/**
 * 质疑风格的核心指令
 * 从原有 aiService 中提取并增强
 * 
 * @see Requirements 1.1, 3.1, 3.2, 4.1
 */
export const CHALLENGER_INSTRUCTIONS = `
### 🎯 CHALLENGER MODE INSTRUCTIONS

1. **Debate & Challenge**: 不要只是同意。挑战用户的假设，用数据和原则来质疑他们的决策。
   - 如果用户的行为与其投资原则矛盾，直接指出
   - 引用用户笔记中的具体原则
   - 问尖锐的问题："你是故意违背自己的原则，还是忘了？"

2. **拒绝空洞**: 不要说废话。
   - ❌ 不要说: "注意风险", "保持谨慎", "市场有波动"
   - ✅ 要说: "你的腾讯占比30%超过了你笔记中20%的上限"
   - 必须包含具体数字、股票代码或百分比
   - 每个警告都要有具体的数据支撑

3. **魔鬼代言人**: 主动提出反面观点。
   - 如果用户看好某只股票，提出至少2个看空理由
   - 如果用户看空某只股票，提出至少2个看多理由
   - 用 "🤔 反面观点" 标记
   - 用数据和事实支持反面观点，不只是意见

4. **直接开始**: 不要用客套话开头。
   - ❌ 不要说: "您的投资组合看起来不错..."
   - ❌ 不要说: "感谢您的提问..."
   - ✅ 直接说: "等等，你的腾讯占比30%..."
   - 开门见山，直奔主题

5. **尖锐提问**: 问让用户思考的问题。
   - "你真的考虑过最坏情况吗？"
   - "上次这样做的结果是什么？这次有什么不同？"
   - "你是故意违背自己的原则，还是忘了？"
   - "如果市场跌20%，你能承受吗？"

6. **认知偏差检测**: 识别并指出用户可能存在的偏见。
   - 确认偏差：只看好消息，忽略坏消息
   - 损失厌恶：不愿止损，死扛亏损
   - 近因偏差：过度关注近期表现
   - 锚定效应：被买入价格锚定
`;

/**
 * 认知偏差检测指令
 * @see Requirements 6.1, 6.2, 6.3, 6.4
 */
export const COGNITIVE_BIAS_INSTRUCTIONS = `
### 🧠 认知偏差检测

当检测到以下偏差时，必须明确指出：

1. **确认偏差** (Confirmation Bias)
   - 迹象：用户只关注支持其观点的信息
   - 指出："你似乎只看到了好消息，但有没有考虑过..."

2. **损失厌恶** (Loss Aversion)
   - 迹象：用户不愿意止损，持有亏损仓位过久
   - 指出："这只股票已经亏损X%，你的止损原则是什么？"

3. **近因偏差** (Recency Bias)
   - 迹象：用户过度关注近期表现
   - 指出："最近3个月的涨幅不代表长期趋势，历史上..."

4. **锚定效应** (Anchoring)
   - 迹象：用户被买入价格锚定
   - 指出："买入价格不应该影响卖出决策，当前的基本面是..."
`;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * 构建带有质疑风格的 Prompt
 * 
 * @param basePrompt - 原始 prompt
 * @param context - 质疑上下文（用户原则、持仓等）
 * @param config - 质疑配置
 * @returns 增强后的 prompt
 * 
 * @see Requirements 1.1, 1.2, 1.3, 1.4
 */
export function buildChallengerPrompt(
  basePrompt: string,
  context: ChallengerContext = {},
  config: ChallengerConfig = DEFAULT_CHALLENGER_CONFIG
): string {
  // 如果禁用质疑模式，返回原始 prompt
  if (!config.enabled) {
    return basePrompt;
  }

  let enhancedPrompt = basePrompt;

  // 1. 注入质疑指令
  enhancedPrompt += '\n\n' + CHALLENGER_INSTRUCTIONS;

  // 2. 注入原则检查上下文
  if (config.principleCheck && context.userPrinciples?.length) {
    enhancedPrompt += buildPrincipleCheckSection(context.userPrinciples);
  }

  // 3. 注入历史错误上下文
  if (context.historicalMistakes?.length) {
    enhancedPrompt += buildHistoricalMistakesSection(context.historicalMistakes);
  }

  // 4. 注入认知偏差检测指令
  if (config.cognitiveBiasDetection) {
    enhancedPrompt += '\n\n' + COGNITIVE_BIAS_INSTRUCTIONS;
  }

  // 5. 注入魔鬼代言人指令
  if (config.devilsAdvocate) {
    enhancedPrompt += buildDevilsAdvocateSection();
  }

  return enhancedPrompt;
}

/**
 * 构建原则检查部分
 */
function buildPrincipleCheckSection(principles: string[]): string {
  return `

### 📋 用户投资原则 (必须检查一致性)
${principles.map((p, i) => `${i + 1}. ${p}`).join('\n')}

**重要**: 如果用户的行为或问题与上述原则矛盾，必须直接指出！
- 引用具体的原则编号
- 说明矛盾之处
- 问用户："你是故意违背原则 #X，还是忘了？"`;
}

/**
 * 构建历史错误部分
 */
function buildHistoricalMistakesSection(
  mistakes: Array<{ date: string; description: string; outcome: string }>
): string {
  return `

### ⚠️ 历史教训 (如果相关，必须提醒)
${mistakes.map(m => `- ${m.date}: ${m.description} (结果: ${m.outcome})`).join('\n')}

**重要**: 如果用户当前的决策与历史错误相似，必须提醒：
- "上次这样做的结果是什么？"
- "这次有什么不同？"`;
}

/**
 * 构建魔鬼代言人部分
 */
function buildDevilsAdvocateSection(): string {
  return `

### 😈 魔鬼代言人模式

当用户表达对某只股票的看法时：
- 如果用户看多，提出至少 2 个看空理由
- 如果用户看空，提出至少 2 个看多理由
- 用 "🤔 反面观点" 标记
- 用数据支持，不只是意见

示例：
用户："我觉得腾讯会涨"
回应："🤔 反面观点：
1. 游戏版号审批仍然严格，新游戏收入增长受限
2. 宏观经济放缓可能影响广告收入
你考虑过这些风险吗？"`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 检测用户消息中的情绪倾向
 * 用于触发魔鬼代言人模式
 */
export function detectSentiment(message: string): 'bullish' | 'bearish' | 'neutral' {
  const bullishKeywords = ['看好', '会涨', '买入', '加仓', '看多', '牛市', '上涨', '利好'];
  const bearishKeywords = ['看空', '会跌', '卖出', '减仓', '看跌', '熊市', '下跌', '利空'];

  const lowerMessage = message.toLowerCase();
  
  const bullishCount = bullishKeywords.filter(k => lowerMessage.includes(k)).length;
  const bearishCount = bearishKeywords.filter(k => lowerMessage.includes(k)).length;

  if (bullishCount > bearishCount) return 'bullish';
  if (bearishCount > bullishCount) return 'bearish';
  return 'neutral';
}

/**
 * 检测用户消息中可能的认知偏差
 */
export function detectCognitiveBias(
  message: string,
  context?: ChallengerContext
): string[] {
  const biases: string[] = [];

  // 确认偏差：只提到正面信息
  if (message.includes('利好') && !message.includes('利空')) {
    biases.push('confirmation_bias');
  }

  // 损失厌恶：提到亏损但不愿卖出
  if ((message.includes('亏') || message.includes('跌')) && 
      (message.includes('不想卖') || message.includes('再等等') || message.includes('会回来'))) {
    biases.push('loss_aversion');
  }

  // 近因偏差：过度关注近期表现
  if (message.includes('最近') || message.includes('这几天') || message.includes('上周')) {
    biases.push('recency_bias');
  }

  // 锚定效应：提到买入价格
  if (message.includes('买入价') || message.includes('成本价') || message.includes('我买的时候')) {
    biases.push('anchoring');
  }

  return biases;
}

/**
 * 检测原则违背
 * 比较用户行为与其投资原则
 */
export function detectPrincipleViolation(
  action: string,
  principles: string[],
  holdings?: Array<{ ticker: string; weight: number }>
): { violated: boolean; principle?: string; details?: string } {
  // 检查集中度原则
  const concentrationPrinciple = principles.find(p => 
    p.includes('集中') || p.includes('单一持仓') || p.includes('不超过')
  );
  
  if (concentrationPrinciple && holdings) {
    const overConcentrated = holdings.find(h => h.weight > 30);
    if (overConcentrated) {
      return {
        violated: true,
        principle: concentrationPrinciple,
        details: `${overConcentrated.ticker} 占比 ${overConcentrated.weight.toFixed(1)}% 超过集中度限制`,
      };
    }
  }

  // 检查止损原则
  const stopLossPrinciple = principles.find(p => 
    p.includes('止损') || p.includes('截断亏损')
  );
  
  if (stopLossPrinciple && action.includes('继续持有') && action.includes('亏损')) {
    return {
      violated: true,
      principle: stopLossPrinciple,
      details: '继续持有亏损仓位可能违背止损原则',
    };
  }

  return { violated: false };
}

/**
 * 生成质疑风格的响应前缀
 * 用于确保 AI 响应以质疑方式开始
 */
export function getChallengerResponsePrefix(
  sentiment: 'bullish' | 'bearish' | 'neutral',
  biases: string[]
): string {
  const prefixes: string[] = [];

  // 基于情绪的前缀
  if (sentiment === 'bullish') {
    prefixes.push('等等，在你决定买入之前...');
  } else if (sentiment === 'bearish') {
    prefixes.push('慢着，卖出之前考虑过...');
  }

  // 基于偏差的前缀
  if (biases.includes('confirmation_bias')) {
    prefixes.push('你是不是只看到了好消息？');
  }
  if (biases.includes('loss_aversion')) {
    prefixes.push('你的止损原则去哪了？');
  }

  return prefixes.length > 0 ? prefixes[0] : '';
}
