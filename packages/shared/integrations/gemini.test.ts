/**
 * Gemini API 服务测试
 * 
 * **Validates: Requirements 39.1, 39.2**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  GeminiService,
  GeminiError,
  initGeminiService,
  getGeminiService,
  createGeminiServiceFromEnv,
  type GeminiConfig,
} from './gemini';

describe('GeminiService', () => {
  let service: GeminiService;

  beforeEach(() => {
    service = new GeminiService({
      apiKey: 'test-api-key',
      useMock: true,
    });
    service.clearHistory();
  });

  // ============================================
  // 基础功能测试
  // ============================================

  describe('Mock Mode', () => {
    /**
     * **Validates: Requirements 39.1**
     */
    it('should return mock response in mock mode', async () => {
      const response = await service.chat('Hello');
      
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });

    it('should identify mock mode correctly', () => {
      expect(service.isMockMode()).toBe(true);

      const realService = new GeminiService({
        apiKey: 'key',
        useMock: false,
      });
      expect(realService.isMockMode()).toBe(false);
    });

    it('should return healthy status in mock mode', async () => {
      const health = await service.healthCheck();
      expect(health.available).toBe(true);
      expect(health.message).toContain('Mock');
    });
  });

  describe('chat', () => {
    /**
     * **Validates: Requirements 39.1**
     */
    it('should return response for chat message', async () => {
      const response = await service.chat('What is the weather?');
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });

    it('should maintain conversation history', async () => {
      await service.chat('Hello');
      await service.chat('How are you?');
      
      const history = service.getHistory();
      expect(history.length).toBe(4); // 2 user + 2 model messages
    });

    it('should support system prompt', async () => {
      const response = await service.chat('Hello', {
        systemPrompt: 'You are a helpful assistant.',
      });
      expect(response).toBeDefined();
    });

    it('should support temperature option', async () => {
      const response = await service.chat('Hello', {
        temperature: 0.5,
      });
      expect(response).toBeDefined();
    });

    it('should support maxTokens option', async () => {
      const response = await service.chat('Hello', {
        maxTokens: 100,
      });
      expect(response).toBeDefined();
    });
  });

  describe('generate', () => {
    /**
     * **Validates: Requirements 39.2**
     */
    it('should return response without maintaining history', async () => {
      await service.generate('Generate a poem');
      
      const history = service.getHistory();
      expect(history.length).toBe(0);
    });

    it('should support all options', async () => {
      const response = await service.generate('Hello', {
        systemPrompt: 'Be brief',
        temperature: 0.3,
        maxTokens: 50,
      });
      expect(response).toBeDefined();
    });
  });

  describe('History Management', () => {
    it('should clear history', async () => {
      await service.chat('Hello');
      expect(service.getHistory().length).toBeGreaterThan(0);
      
      service.clearHistory();
      expect(service.getHistory().length).toBe(0);
    });

    it('should return copy of history', async () => {
      await service.chat('Hello');
      
      const history1 = service.getHistory();
      const history2 = service.getHistory();
      
      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });

  describe('Model Configuration', () => {
    it('should return configured model', () => {
      const customService = new GeminiService({
        apiKey: 'key',
        model: 'gemini-pro',
        useMock: true,
      });
      
      expect(customService.getModel()).toBe('gemini-pro');
    });

    it('should use default model when not specified', () => {
      expect(service.getModel()).toContain('gemini');
    });
  });

  // ============================================
  // 错误处理测试
  // ============================================

  describe('Error Handling', () => {
    it('should report unavailable when API key missing', async () => {
      const noKeyService = new GeminiService({
        apiKey: '',
        useMock: false,
      });

      const health = await noKeyService.healthCheck();
      expect(health.available).toBe(false);
      expect(health.message).toContain('Missing');
    });

    it('should create GeminiError with correct properties', () => {
      const error = new GeminiError('API_ERROR', 'Test error');

      expect(error.name).toBe('GeminiError');
      expect(error.code).toBe('API_ERROR');
      expect(error.message).toBe('Test error');
    });
  });

  // ============================================
  // 工厂函数测试
  // ============================================

  describe('Factory Functions', () => {
    it('should initialize and get service instance', () => {
      const config: GeminiConfig = {
        apiKey: 'test',
        useMock: true,
      };

      const instance = initGeminiService(config);
      expect(instance).toBeInstanceOf(GeminiService);

      const retrieved = getGeminiService();
      expect(retrieved).toBe(instance);
    });

    it('should create service from env with mock when no API key', () => {
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const envService = createGeminiServiceFromEnv();
      expect(envService.isMockMode()).toBe(true);

      if (originalKey) process.env.GEMINI_API_KEY = originalKey;
    });
  });

  // ============================================
  // 属性测试
  // ============================================

  describe('Property Tests', () => {
    /**
     * **Validates: Requirements 39.1**
     * 属性：chat 应该总是返回非空字符串（mock 模式）
     */
    it('chat should always return non-empty string', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (message) => {
            service.clearHistory();
            const response = await service.chat(message);
            return typeof response === 'string' && response.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性：generate 不应该影响历史
     */
    it('generate should not affect history', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (prompt) => {
            service.clearHistory();
            const historyBefore = service.getHistory().length;
            await service.generate(prompt);
            const historyAfter = service.getHistory().length;
            return historyBefore === historyAfter;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性：chat 应该增加历史记录
     */
    it('chat should increase history', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (count) => {
            service.clearHistory();
            
            for (let i = 0; i < count; i++) {
              await service.chat(`Message ${i}`);
            }
            
            // 每次 chat 添加 2 条记录（user + model）
            return service.getHistory().length === count * 2;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性：clearHistory 应该清空所有历史
     */
    it('clearHistory should empty all history', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (count) => {
            service.clearHistory();
            
            for (let i = 0; i < count; i++) {
              await service.chat(`Message ${i}`);
            }
            
            service.clearHistory();
            return service.getHistory().length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
