/**
 * 双 Agent 语音服务属性测试
 * 
 * **Feature: riskcontrol-integration**
 * **Property 10: Investment Agent 提示词保护**
 * **Validates: Requirements 4.3, 4.9**
 * 
 * @module @echoai/shared/voice/tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  DualAgentVoiceService,
  AGENT_CONFIGS,
  INVESTMENT_AGENT_PROMPT,
  DAILY_AGENT_PROMPT,
  VoiceServiceError,
  type AgentType,
  type AgentConfig,
} from './index';

// ============================================
// 测试配置
// ============================================

const TEST_CONFIG = {
  livekitUrl: 'wss://test.livekit.cloud',
  livekitApiKey: 'test-api-key',
  livekitApiSecret: 'test-api-secret',
  voiceAgentUrl: 'http://localhost:8080',
  echoApiUrl: 'http://localhost:1111',
  rcApiUrl: 'http://localhost:3000',
};

// ============================================
// 辅助函数
// ============================================

// 生成有效的 Agent 类型
const agentTypeArb = fc.constantFrom('investment', 'daily') as fc.Arbitrary<AgentType>;

// 生成有效的参与者 ID
const participantIdArb = fc.stringMatching(/^[a-zA-Z0-9_-]{3,20}$/);

// 生成投资相关文本
const investmentTextArb = fc.oneof(
  fc.constant('我的股票持仓怎么样'),
  fc.constant('分析一下投资组合风险'),
  fc.constant('市场趋势如何'),
  fc.constant('我应该买入还是卖出'),
  fc.constant('portfolio performance'),
  fc.tuple(
    fc.constantFrom('股票', '基金', '投资', '持仓', '收益', '风险'),
    fc.string({ minLength: 1, maxLength: 20 })
  ).map(([keyword, suffix]) => `${keyword}${suffix}`)
);

// 生成日常相关文本
const dailyTextArb = fc.oneof(
  fc.constant('帮我记个笔记'),
  fc.constant('今天有什么任务'),
  fc.constant('安排一下日程'),
  fc.constant('提醒我开会'),
  fc.constant('check my calendar'),
  fc.tuple(
    fc.constantFrom('笔记', '任务', '日程', '提醒', '会议'),
    fc.string({ minLength: 1, maxLength: 20 })
  ).map(([keyword, suffix]) => `${keyword}${suffix}`)
);

// ============================================
// 属性测试
// ============================================

describe('DualAgentVoiceService Property Tests', () => {
  let service: DualAgentVoiceService;

  beforeEach(() => {
    service = new DualAgentVoiceService(TEST_CONFIG);
  });

  /**
   * **Property 10.1: Investment Agent 提示词完整性**
   * Investment Agent 的系统提示词必须包含所有关键要素
   * **Validates: Requirements 4.3, 4.9**
   */
  it('should preserve Investment Agent system prompt integrity', () => {
    const config = service.getAgentConfig('investment');
    
    // 验证提示词包含关键要素
    expect(config.systemPrompt).toContain('投资顾问');
    expect(config.systemPrompt).toContain('专业');
    expect(config.systemPrompt).toContain('风险');
    expect(config.systemPrompt).toContain('投资组合');
    expect(config.systemPrompt).toContain('市场趋势');
    
    // 验证提示词与常量一致
    expect(config.systemPrompt).toBe(INVESTMENT_AGENT_PROMPT);
  });

  /**
   * **Property 10.2: Agent 配置不可变性**
   * Agent 配置在运行时不应被意外修改
   */
  it('should maintain Agent config immutability', () => {
    fc.assert(
      fc.property(agentTypeArb, (agentType) => {
        const config1 = service.getAgentConfig(agentType);
        const config2 = service.getAgentConfig(agentType);
        
        // 配置应该相等
        expect(config1.systemPrompt).toBe(config2.systemPrompt);
        expect(config1.personality.voice).toBe(config2.personality.voice);
        expect(config1.knowledgeNamespace).toBe(config2.knowledgeNamespace);
        expect(config1.databaseTarget).toBe(config2.databaseTarget);
        
        // 验证与原始配置一致
        expect(config1.systemPrompt).toBe(AGENT_CONFIGS[agentType].systemPrompt);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * **Property 10.3: Agent 知识库隔离**
   * 每个 Agent 必须使用正确的知识库命名空间
   * **Validates: Requirements 5.2, 5.3**
   */
  it('should isolate Agent knowledge namespaces', () => {
    const investmentConfig = service.getAgentConfig('investment');
    const dailyConfig = service.getAgentConfig('daily');
    
    // 命名空间必须不同
    expect(investmentConfig.knowledgeNamespace).not.toBe(dailyConfig.knowledgeNamespace);
    
    // 验证正确的命名空间
    expect(investmentConfig.knowledgeNamespace).toBe('investment');
    expect(dailyConfig.knowledgeNamespace).toBe('daily');
    
    // 验证数据库目标
    expect(investmentConfig.databaseTarget).toBe('riskcontrol');
    expect(dailyConfig.databaseTarget).toBe('echo');
  });

  /**
   * **Property 10.4: 话题检测准确性**
   * 投资相关话题应该路由到 Investment Agent
   */
  it('should detect investment topics correctly', () => {
    fc.assert(
      fc.property(investmentTextArb, (text) => {
        const detectedAgent = service.detectTopicAgent(text);
        expect(detectedAgent).toBe('investment');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 10.5: 话题检测准确性（日常）**
   * 日常相关话题应该路由到 Daily Agent
   */
  it('should detect daily topics correctly', () => {
    fc.assert(
      fc.property(dailyTextArb, (text) => {
        const detectedAgent = service.detectTopicAgent(text);
        expect(detectedAgent).toBe('daily');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 10.6: Agent 工具配置完整性**
   * 每个 Agent 必须有正确的工具配置
   */
  it('should have correct tools for each Agent', () => {
    fc.assert(
      fc.property(agentTypeArb, (agentType) => {
        const config = service.getAgentConfig(agentType);
        
        // 必须有工具
        expect(config.tools.length).toBeGreaterThan(0);
        
        // 每个工具必须有名称和描述
        for (const tool of config.tools) {
          expect(tool.name).toBeTruthy();
          expect(tool.description).toBeTruthy();
        }
        
        // Investment Agent 必须有投资相关工具
        if (agentType === 'investment') {
          const toolNames = config.tools.map(t => t.name);
          expect(toolNames).toContain('query_portfolio');
        }
        
        // Daily Agent 必须有日常相关工具
        if (agentType === 'daily') {
          const toolNames = config.tools.map(t => t.name);
          expect(toolNames).toContain('search_notes');
        }
      }),
      { numRuns: 20 }
    );
  });
});

// ============================================
// 单元测试
// ============================================

describe('DualAgentVoiceService Unit Tests', () => {
  let service: DualAgentVoiceService;

  beforeEach(() => {
    service = new DualAgentVoiceService(TEST_CONFIG);
  });

  describe('Agent Configuration', () => {
    it('should return correct Investment Agent config', () => {
      const config = service.getAgentConfig('investment');
      
      expect(config.type).toBe('investment');
      expect(config.personality.style).toBe('professional');
      expect(config.databaseTarget).toBe('riskcontrol');
    });

    it('should return correct Daily Agent config', () => {
      const config = service.getAgentConfig('daily');
      
      expect(config.type).toBe('daily');
      expect(config.personality.style).toBe('friendly');
      expect(config.databaseTarget).toBe('echo');
    });

    it('should have different prompts for each Agent', () => {
      const investmentConfig = service.getAgentConfig('investment');
      const dailyConfig = service.getAgentConfig('daily');
      
      expect(investmentConfig.systemPrompt).not.toBe(dailyConfig.systemPrompt);
    });
  });

  describe('Topic Detection', () => {
    it('should detect investment keywords', () => {
      expect(service.detectTopicAgent('股票分析')).toBe('investment');
      expect(service.detectTopicAgent('投资组合')).toBe('investment');
      expect(service.detectTopicAgent('stock analysis')).toBe('investment');
    });

    it('should detect daily keywords', () => {
      expect(service.detectTopicAgent('记个笔记')).toBe('daily');
      expect(service.detectTopicAgent('今天的任务')).toBe('daily');
      expect(service.detectTopicAgent('check calendar')).toBe('daily');
    });

    it('should default to daily for ambiguous text', () => {
      expect(service.detectTopicAgent('你好')).toBe('daily');
      expect(service.detectTopicAgent('hello')).toBe('daily');
    });
  });

  describe('Session Management', () => {
    it('should return undefined for non-existent session', () => {
      const session = service.getSession('non-existent');
      expect(session).toBeUndefined();
    });

    it('should return empty array when no active sessions', () => {
      const sessions = service.getActiveSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe('System Prompts', () => {
    it('should have Investment Agent prompt with key elements', () => {
      expect(INVESTMENT_AGENT_PROMPT).toContain('投资顾问');
      expect(INVESTMENT_AGENT_PROMPT).toContain('不提供具体的买卖建议');
      expect(INVESTMENT_AGENT_PROMPT).toContain('风险意识');
    });

    it('should have Daily Agent prompt with key elements', () => {
      expect(DAILY_AGENT_PROMPT).toContain('日常助手');
      expect(DAILY_AGENT_PROMPT).toContain('笔记');
      expect(DAILY_AGENT_PROMPT).toContain('任务');
      expect(DAILY_AGENT_PROMPT).toContain('不涉及投资建议');
    });
  });
});

// ============================================
// VoiceServiceError 测试
// ============================================

describe('VoiceServiceError', () => {
  it('should create error with correct properties', () => {
    const error = new VoiceServiceError('SESSION_NOT_FOUND', 'Session not found');
    
    expect(error.code).toBe('SESSION_NOT_FOUND');
    expect(error.message).toBe('Session not found');
    expect(error.name).toBe('VoiceServiceError');
  });

  it('should be instanceof Error', () => {
    const error = new VoiceServiceError('CONFIG_ERROR', 'Config error');
    expect(error).toBeInstanceOf(Error);
  });
});
