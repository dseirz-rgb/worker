/**
 * Tests for Challenger Prompt Builder
 * 
 * @see .kiro/specs/ai-challenger-personality/design.md
 * @see Requirements 1.1, 1.2, 3.1, 3.2
 */

import { describe, it, expect } from 'vitest';
import {
  buildChallengerPrompt,
  DEFAULT_CHALLENGER_CONFIG,
  CHALLENGER_INSTRUCTIONS,
  COGNITIVE_BIAS_INSTRUCTIONS,
  detectSentiment,
  detectCognitiveBias,
  detectPrincipleViolation,
  getChallengerResponsePrefix,
  type ChallengerConfig,
  type ChallengerContext,
} from './challengerPromptBuilder';

describe('challengerPromptBuilder', () => {
  describe('buildChallengerPrompt', () => {
    it('should return original prompt when challenger is disabled', () => {
      const basePrompt = 'What is value investing?';
      const config: ChallengerConfig = {
        enabled: false,
        devilsAdvocate: true,
        principleCheck: true,
        cognitiveBiasDetection: true,
      };

      const result = buildChallengerPrompt(basePrompt, {}, config);
      expect(result).toBe(basePrompt);
    });

    it('should inject challenger instructions when enabled', () => {
      const basePrompt = 'Analyze my portfolio';
      const result = buildChallengerPrompt(basePrompt, {}, DEFAULT_CHALLENGER_CONFIG);

      expect(result).toContain(basePrompt);
      expect(result).toContain('CHALLENGER MODE INSTRUCTIONS');
      expect(result).toContain('Debate & Challenge');
      expect(result).toContain('拒绝空洞');
    });

    it('should include user principles when provided', () => {
      const basePrompt = 'Should I buy more AAPL?';
      const context: ChallengerContext = {
        userPrinciples: [
          '单一持仓不超过20%',
          '永不满仓',
          '截断亏损，让利润奔跑',
        ],
      };

      const result = buildChallengerPrompt(basePrompt, context, DEFAULT_CHALLENGER_CONFIG);

      expect(result).toContain('用户投资原则');
      expect(result).toContain('单一持仓不超过20%');
      expect(result).toContain('永不满仓');
      expect(result).toContain('截断亏损');
      expect(result).toContain('必须检查一致性');
    });

    it('should include historical mistakes when provided', () => {
      const basePrompt = 'Should I average down on this stock?';
      const context: ChallengerContext = {
        historicalMistakes: [
          {
            date: '2024-03-15',
            description: '在腾讯下跌时不断加仓',
            outcome: '亏损扩大到30%',
          },
        ],
      };

      const result = buildChallengerPrompt(basePrompt, context, DEFAULT_CHALLENGER_CONFIG);

      expect(result).toContain('历史教训');
      expect(result).toContain('2024-03-15');
      expect(result).toContain('腾讯下跌时不断加仓');
      expect(result).toContain('亏损扩大到30%');
    });

    it('should include cognitive bias detection instructions', () => {
      const basePrompt = 'What do you think about my strategy?';
      const result = buildChallengerPrompt(basePrompt, {}, DEFAULT_CHALLENGER_CONFIG);

      expect(result).toContain('认知偏差检测');
      expect(result).toContain('确认偏差');
      expect(result).toContain('损失厌恶');
      expect(result).toContain('近因偏差');
    });

    it('should include devils advocate section', () => {
      const basePrompt = 'I think NVDA will go up';
      const result = buildChallengerPrompt(basePrompt, {}, DEFAULT_CHALLENGER_CONFIG);

      expect(result).toContain('魔鬼代言人模式');
      expect(result).toContain('反面观点');
    });

    it('should skip principle check when disabled', () => {
      const basePrompt = 'Analyze my portfolio';
      const context: ChallengerContext = {
        userPrinciples: ['单一持仓不超过20%'],
      };
      const config: ChallengerConfig = {
        enabled: true,
        devilsAdvocate: true,
        principleCheck: false,
        cognitiveBiasDetection: true,
      };

      const result = buildChallengerPrompt(basePrompt, context, config);

      expect(result).not.toContain('用户投资原则');
    });
  });

  describe('detectSentiment', () => {
    it('should detect bullish sentiment', () => {
      expect(detectSentiment('我看好腾讯')).toBe('bullish');
      expect(detectSentiment('这只股票会涨')).toBe('bullish');
      expect(detectSentiment('准备买入AAPL')).toBe('bullish');
      expect(detectSentiment('我要加仓')).toBe('bullish');
    });

    it('should detect bearish sentiment', () => {
      expect(detectSentiment('我看空市场')).toBe('bearish');
      expect(detectSentiment('这只股票会跌')).toBe('bearish');
      expect(detectSentiment('准备卖出')).toBe('bearish');
      expect(detectSentiment('我要减仓')).toBe('bearish');
    });

    it('should detect neutral sentiment', () => {
      expect(detectSentiment('什么是价值投资？')).toBe('neutral');
      expect(detectSentiment('分析一下我的持仓')).toBe('neutral');
      expect(detectSentiment('今天市场怎么样')).toBe('neutral');
    });
  });

  describe('detectCognitiveBias', () => {
    it('should detect confirmation bias', () => {
      const biases = detectCognitiveBias('这只股票有很多利好消息');
      expect(biases).toContain('confirmation_bias');
    });

    it('should detect loss aversion', () => {
      const biases = detectCognitiveBias('虽然亏了很多，但我不想卖，再等等会回来的');
      expect(biases).toContain('loss_aversion');
    });

    it('should detect recency bias', () => {
      const biases = detectCognitiveBias('最近这只股票涨得很好');
      expect(biases).toContain('recency_bias');
    });

    it('should detect anchoring', () => {
      const biases = detectCognitiveBias('我买入价是100元，现在才80元');
      expect(biases).toContain('anchoring');
    });

    it('should return empty array for neutral messages', () => {
      const biases = detectCognitiveBias('什么是价值投资？');
      expect(biases).toHaveLength(0);
    });
  });

  describe('detectPrincipleViolation', () => {
    it('should detect concentration violation', () => {
      const principles = ['单一持仓不超过20%'];
      const holdings = [
        { ticker: 'AAPL', weight: 35 },
        { ticker: 'GOOGL', weight: 25 },
      ];

      const result = detectPrincipleViolation('买入AAPL', principles, holdings);

      expect(result.violated).toBe(true);
      expect(result.principle).toContain('不超过20%');
      expect(result.details).toContain('AAPL');
      expect(result.details).toContain('35');
    });

    it('should not flag when within limits', () => {
      const principles = ['单一持仓不超过30%'];
      const holdings = [
        { ticker: 'AAPL', weight: 25 },
        { ticker: 'GOOGL', weight: 20 },
      ];

      const result = detectPrincipleViolation('买入AAPL', principles, holdings);

      expect(result.violated).toBe(false);
    });

    it('should detect stop loss violation', () => {
      const principles = ['截断亏损，不死扛'];
      const action = '继续持有这只亏损的股票';

      const result = detectPrincipleViolation(action, principles);

      expect(result.violated).toBe(true);
      expect(result.principle).toContain('截断亏损');
    });
  });

  describe('getChallengerResponsePrefix', () => {
    it('should return bullish challenge prefix', () => {
      const prefix = getChallengerResponsePrefix('bullish', []);
      expect(prefix).toContain('买入之前');
    });

    it('should return bearish challenge prefix', () => {
      const prefix = getChallengerResponsePrefix('bearish', []);
      expect(prefix).toContain('卖出之前');
    });

    it('should return bias-specific prefix', () => {
      const prefix = getChallengerResponsePrefix('neutral', ['confirmation_bias']);
      expect(prefix).toContain('好消息');
    });

    it('should return empty for neutral without biases', () => {
      const prefix = getChallengerResponsePrefix('neutral', []);
      expect(prefix).toBe('');
    });
  });

  describe('CHALLENGER_INSTRUCTIONS constant', () => {
    it('should contain all required sections', () => {
      expect(CHALLENGER_INSTRUCTIONS).toContain('Debate & Challenge');
      expect(CHALLENGER_INSTRUCTIONS).toContain('拒绝空洞');
      expect(CHALLENGER_INSTRUCTIONS).toContain('魔鬼代言人');
      expect(CHALLENGER_INSTRUCTIONS).toContain('直接开始');
      expect(CHALLENGER_INSTRUCTIONS).toContain('尖锐提问');
    });

    it('should contain example bad responses to avoid', () => {
      expect(CHALLENGER_INSTRUCTIONS).toContain('注意风险');
      expect(CHALLENGER_INSTRUCTIONS).toContain('保持谨慎');
    });

    it('should contain example good responses', () => {
      expect(CHALLENGER_INSTRUCTIONS).toContain('腾讯占比30%');
    });
  });

  describe('DEFAULT_CHALLENGER_CONFIG', () => {
    it('should have all features enabled by default', () => {
      expect(DEFAULT_CHALLENGER_CONFIG.enabled).toBe(true);
      expect(DEFAULT_CHALLENGER_CONFIG.devilsAdvocate).toBe(true);
      expect(DEFAULT_CHALLENGER_CONFIG.principleCheck).toBe(true);
      expect(DEFAULT_CHALLENGER_CONFIG.cognitiveBiasDetection).toBe(true);
    });
  });
});
