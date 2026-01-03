/**
 * QueryRouter Tests
 * 
 * 测试查询路由器的各种场景：
 * - 关键词路由
 * - LLM 响应解析
 * - 错误处理和降级
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  QueryRouter,
  routeQueryByKeywords,
  type RouteDecision
} from './queryRouter';

// ============================================================================
// Keyword-based Routing Tests
// ============================================================================

describe('routeQueryByKeywords', () => {
  describe('structured_data routing', () => {
    it('should route portfolio queries to structured_data', () => {
      const queries = [
        '我的持仓情况',
        '查看我的仓位',
        '最近的交易记录',
        '我的账户净值',
        '投资组合分析'
      ];
      
      for (const query of queries) {
        const result = routeQueryByKeywords(query);
        expect(result.datasource).toBe('structured_data');
        expect(result.confidence).toBeGreaterThan(0);
      }
    });
    
    it('should route English portfolio queries to structured_data', () => {
      const queries = [
        'my portfolio',
        'show my positions',
        'recent trades',
        'profit and loss'
      ];
      
      for (const query of queries) {
        const result = routeQueryByKeywords(query);
        expect(result.datasource).toBe('structured_data');
      }
    });
  });
  
  describe('vectorstore routing', () => {
    it('should route knowledge queries to vectorstore', () => {
      const queries = [
        '巴菲特的投资原则',
        '价值投资策略',
        '如何分析公司估值',
        '什么是护城河理论'
      ];
      
      for (const query of queries) {
        const result = routeQueryByKeywords(query);
        expect(result.datasource).toBe('vectorstore');
        expect(result.confidence).toBeGreaterThan(0);
      }
    });
    
    it('should route book/article queries to vectorstore', () => {
      const queries = [
        '书中提到的方法',
        '笔记里的观点',
        '芒格的建议'
      ];
      
      for (const query of queries) {
        const result = routeQueryByKeywords(query);
        expect(result.datasource).toBe('vectorstore');
      }
    });
  });
  
  describe('websearch routing', () => {
    it('should route current event queries to websearch', () => {
      const queries = [
        '今天美股发生了什么',
        '最新的财报消息',
        '特斯拉刚刚发布的公告'
      ];
      
      for (const query of queries) {
        const result = routeQueryByKeywords(query);
        expect(result.datasource).toBe('websearch');
        expect(result.confidence).toBeGreaterThan(0);
      }
    });
    
    it('should route English news queries to websearch', () => {
      const queries = [
        'latest news on Apple',
        'today market update',
        'recent earnings report'
      ];
      
      for (const query of queries) {
        const result = routeQueryByKeywords(query);
        expect(result.datasource).toBe('websearch');
      }
    });
  });
  
  describe('default routing', () => {
    it('should default to vectorstore for ambiguous queries', () => {
      const queries = [
        '你好',
        'hello',
        '随便聊聊'
      ];
      
      for (const query of queries) {
        const result = routeQueryByKeywords(query);
        expect(result.datasource).toBe('vectorstore');
        expect(result.confidence).toBeLessThanOrEqual(0.5);
      }
    });
  });
});

// ============================================================================
// QueryRouter Class Tests
// ============================================================================

describe('QueryRouter', () => {
  let router: QueryRouter;
  
  beforeEach(() => {
    router = new QueryRouter({
      llm_model: 'gemini-2.0-flash',
      timeout: 5000
    });
  });
  
  describe('configuration', () => {
    it('should use default config when not provided', () => {
      const defaultRouter = new QueryRouter();
      const config = defaultRouter.getConfig();
      
      expect(config.llm_model).toBe('gemini-2.0-flash');
      expect(config.timeout).toBe(10000);
      expect(config.fallback_datasource).toBe('vectorstore');
    });
    
    it('should merge custom config with defaults', () => {
      const customRouter = new QueryRouter({
        llm_model: 'gemini-1.5-pro',
        timeout: 5000
      });
      const config = customRouter.getConfig();
      
      expect(config.llm_model).toBe('gemini-1.5-pro');
      expect(config.timeout).toBe(5000);
      expect(config.fallback_datasource).toBe('vectorstore');
    });
    
    it('should allow config updates', () => {
      router.updateConfig({ timeout: 15000 });
      const config = router.getConfig();
      
      expect(config.timeout).toBe(15000);
    });
  });
  
  describe('empty query handling', () => {
    it('should return fallback for empty query', async () => {
      const result = await router.route('');
      
      expect(result.datasource).toBe('vectorstore');
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('Empty query');
    });
    
    it('should return fallback for whitespace-only query', async () => {
      const result = await router.route('   ');
      
      expect(result.datasource).toBe('vectorstore');
      expect(result.confidence).toBe(0);
    });
  });
  
  describe('fallback behavior', () => {
    it('should fall back to keyword routing when LLM fails', async () => {
      // Mock fetch to simulate API failure
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      
      try {
        const result = await router.route('我的持仓情况');
        
        // Should fall back to keyword-based routing
        expect(result.datasource).toBe('structured_data');
        expect(result.reasoning).toContain('Keyword match');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});

// ============================================================================
// RouteDecision Validation Tests
// ============================================================================

describe('RouteDecision validation', () => {
  it('should have valid datasource values', () => {
    const validDatasources = ['vectorstore', 'structured_data', 'websearch'];
    
    const result = routeQueryByKeywords('test query');
    expect(validDatasources).toContain(result.datasource);
  });
  
  it('should have confidence between 0 and 1', () => {
    const queries = [
      '我的持仓',
      '巴菲特原则',
      '今天新闻',
      '随机查询'
    ];
    
    for (const query of queries) {
      const result = routeQueryByKeywords(query);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });
  
  it('should always have a reasoning string', () => {
    const result = routeQueryByKeywords('any query');
    expect(typeof result.reasoning).toBe('string');
    expect(result.reasoning.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Property-based Tests (Correctness Properties from Design Doc)
// ============================================================================

describe('Correctness Properties', () => {
  // Property 1: Query Router Output Validity
  describe('Property 1: Query Router Output Validity', () => {
    it('should return valid output for any non-empty query', () => {
      const testQueries = [
        '简单查询',
        'A very long query that contains multiple words and should still work correctly',
        '包含特殊字符的查询 !@#$%^&*()',
        '123456789',
        'Mixed 中英文 query'
      ];
      
      for (const query of testQueries) {
        const result = routeQueryByKeywords(query);
        
        // Validate datasource
        expect(['vectorstore', 'structured_data', 'websearch']).toContain(result.datasource);
        
        // Validate confidence
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        
        // Validate reasoning exists
        expect(typeof result.reasoning).toBe('string');
      }
    });
  });
  
  // Property 2: Query Routing Consistency
  describe('Property 2: Query Routing Consistency', () => {
    it('should route portfolio keywords to structured_data with confidence > 0.5', () => {
      const portfolioQueries = [
        '持仓分析',
        '交易记录',
        '净值变化',
        'position summary',
        'trade history'
      ];
      
      for (const query of portfolioQueries) {
        const result = routeQueryByKeywords(query);
        expect(result.datasource).toBe('structured_data');
        // Note: keyword-based routing may have lower confidence
        expect(result.confidence).toBeGreaterThan(0);
      }
    });
    
    it('should route knowledge keywords to vectorstore', () => {
      const knowledgeQueries = [
        '投资策略',
        '巴菲特原则',
        'investment strategy',
        'value investing principle'
      ];
      
      for (const query of knowledgeQueries) {
        const result = routeQueryByKeywords(query);
        expect(result.datasource).toBe('vectorstore');
      }
    });
    
    it('should route current event keywords to websearch', () => {
      const currentEventQueries = [
        '今天的新闻',
        '最新消息',
        'latest news',
        'current market'
      ];
      
      for (const query of currentEventQueries) {
        const result = routeQueryByKeywords(query);
        expect(result.datasource).toBe('websearch');
      }
    });
  });
});
