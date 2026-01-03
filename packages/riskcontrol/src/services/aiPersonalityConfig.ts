/**
 * AI Personality Configuration
 * 
 * AI 功能配置信息
 * 用于设置页面的"AI 调教公示"展示
 * 
 * @see .kiro/specs/ai-challenger-personality/design.md
 * @see Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

// ============================================================================
// Types
// ============================================================================

/**
 * AI feature configuration for display
 */
export interface AIFeatureConfig {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Icon emoji */
  icon: string;
  /** Personality style description */
  style: string;
  /** Core instructions list */
  coreInstructions: string[];
  /** Example of good response */
  goodExample: string;
  /** Example of bad response */
  badExample: string;
  /** Source file path for the actual prompt */
  promptSource: string;
}

// ============================================================================
// Configuration Data
// ============================================================================

/**
 * All AI feature configurations
 * 
 * This data is used to display the "AI 调教公示" section in settings.
 * Each entry describes how a specific AI feature is configured.
 */
export const AI_FEATURE_CONFIGS: AIFeatureConfig[] = [
  {
    id: 'chat',
    name: '聊天助手 (Investment Mirror)',
    icon: '📱',
    style: '严厉教练 + 魔鬼代言人',
    coreInstructions: [
      'Debate & Challenge: 不要只是同意，要挑战用户的假设',
      'Data-Driven: 用数据支持论点，引用具体数字',
      '拒绝空洞: 不说"注意风险"，要说具体数字和股票代码',
      '原则检查: 检测用户行为是否违背其投资原则',
    ],
    goodExample: '等等，你的腾讯占比30%，但你笔记里写的是不超过20%。你是故意违背原则，还是忘了？',
    badExample: '您的投资组合看起来不错，腾讯是一个好公司...',
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
      '拒绝空洞: 不说废话，要说具体建议',
    ],
    goodExample: '腾讯占比30%超过你的20%上限，考虑减仓5%',
    badExample: '市场波动是常态，保持冷静，坚守原则',
    promptSource: 'client/src/services/aiService.ts',
  },
  {
    id: 'risk-analysis',
    name: '风控分析 (Risk Analysis)',
    icon: '🚨',
    style: '激进型分析师 (Aggressive)',
    coreInstructions: [
      '主动识别风险: 不等用户问，主动指出问题',
      '提出反面观点: 帮助用户压力测试决策',
      '检测认知偏差: 确认偏差、损失厌恶、近因偏差',
      '量化风险: 用具体数字说明风险程度',
    ],
    goodExample: '杠杆1.8倍，如果市场跌20%你会爆仓，你考虑过吗？',
    badExample: '您的杠杆率在可接受范围内，请继续关注市场动态',
    promptSource: 'client/src/services/agents/advisorAgent.ts',
  },
  {
    id: 'advisor',
    name: '投资顾问 (Advisor Agent)',
    icon: '💼',
    style: '批判性思维 + 原则执行者',
    coreInstructions: [
      '不用模糊词: 避免"可能"、"也许"、"或许"',
      '问尖锐问题: "你真的考虑过最坏情况吗？"',
      '历史对质: "上次这样做的结果是什么？"',
      '直接行动: 给出具体的操作建议，不含糊',
    ],
    goodExample: '卖掉腾讯5%，把集中度降到25%以下，现在就做',
    badExample: '建议您考虑适当调整仓位，注意风险管理',
    promptSource: 'client/src/services/agents/advisorAgent.ts',
  },
  {
    id: 'unified-intelligence',
    name: '统一智能 (Unified Intelligence)',
    icon: '🧠',
    style: '多维度质疑 + 深度分析',
    coreInstructions: [
      '继承质疑风格: 从 aiService 继承 Debate & Challenge',
      '多 Agent 协作: 综合持仓、风险、市场分析',
      '原则一致性: 检查用户行为与原则的匹配度',
      '魔鬼代言人: 主动提出反面观点',
    ],
    goodExample: '综合分析显示：你的科技股占比65%，但你的原则是"行业分散"。同时，市场情绪偏负面，你确定要加仓吗？',
    badExample: '根据分析，您的投资组合整体表现良好...',
    promptSource: 'client/src/services/unifiedIntelligence/unifiedIntelligenceService.ts',
  },
];

// ============================================================================
// Accessor Functions
// ============================================================================

/**
 * Get all AI feature configurations
 */
export function getAIFeatureConfigs(): AIFeatureConfig[] {
  return AI_FEATURE_CONFIGS;
}

/**
 * Get a single AI feature configuration by ID
 */
export function getAIFeatureConfig(id: string): AIFeatureConfig | undefined {
  return AI_FEATURE_CONFIGS.find(c => c.id === id);
}

/**
 * Get AI feature configurations by style
 */
export function getAIFeatureConfigsByStyle(style: string): AIFeatureConfig[] {
  return AI_FEATURE_CONFIGS.filter(c => 
    c.style.toLowerCase().includes(style.toLowerCase())
  );
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that all configurations have required fields
 * Used for testing to ensure config sync with actual prompts
 */
export function validateAIFeatureConfigs(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const config of AI_FEATURE_CONFIGS) {
    if (!config.id) errors.push(`Missing id for config`);
    if (!config.name) errors.push(`Missing name for config ${config.id}`);
    if (!config.icon) errors.push(`Missing icon for config ${config.id}`);
    if (!config.style) errors.push(`Missing style for config ${config.id}`);
    if (!config.coreInstructions?.length) {
      errors.push(`Missing coreInstructions for config ${config.id}`);
    }
    if (!config.goodExample) errors.push(`Missing goodExample for config ${config.id}`);
    if (!config.badExample) errors.push(`Missing badExample for config ${config.id}`);
    if (!config.promptSource) errors.push(`Missing promptSource for config ${config.id}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get a summary of all AI personalities for display
 */
export function getAIPersonalitySummary(): string {
  return AI_FEATURE_CONFIGS.map(c => `${c.icon} ${c.name}: ${c.style}`).join('\n');
}
