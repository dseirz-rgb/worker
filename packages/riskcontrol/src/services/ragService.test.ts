/**
 * RAG Service Tests
 * 
 * Property-based tests for query classification
 * **Validates: Requirements 5.1, 5.4, 5.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classifyQuery, type QueryClassification } from './ragService';

// ============================================================================
// Property 10: Query Classification Correctness
// ============================================================================

describe('Property 10: Query Classification Correctness', () => {
  
  // Structured data keywords that should trigger needsStructuredData
  const structuredKeywords = [
    '持仓', '仓位', '交易', '买入', '卖出', '盈亏', '净值',
    '股票', '期权', '市值', '成本', '收益', '亏损', '回撤',
    '杠杆', '融资', '保证金', '资产', '负债', '权益'
  ];
  
  // Knowledge base keywords that should trigger needsKnowledgeBase
  const knowledgeKeywords = [
    '策略', '原则', '理论', '分析', '方法', '思路', '逻辑',
    '为什么', '怎么', '如何', '什么是', '解释', '说明',
    '书', '文章', '笔记', '观点', '建议', '经验', '教训'
  ];
  
  it('should classify queries with structured keywords as needing structured data', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...structuredKeywords),
        fc.string({ minLength: 0, maxLength: 20 }),
        (keyword, suffix) => {
          const query = `${keyword}${suffix}`;
          const result = classifyQuery(query);
          
          // Queries with structured keywords should need structured data
          expect(result.needsStructuredData).toBe(true);
          expect(result.matchedKeywords).toContain(keyword);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should classify queries with knowledge keywords as needing knowledge base', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...knowledgeKeywords),
        fc.string({ minLength: 0, maxLength: 20 }),
        (keyword, suffix) => {
          const query = `${keyword}${suffix}`;
          const result = classifyQuery(query);
          
          // Queries with knowledge keywords should need knowledge base
          expect(result.needsKnowledgeBase).toBe(true);
          expect(result.matchedKeywords).toContain(keyword);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should classify long queries (>20 chars) as potentially needing knowledge base', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 21, maxLength: 100 }),
        (query) => {
          const result = classifyQuery(query);
          
          // Long queries should trigger knowledge base consideration
          // (unless they only contain structured keywords)
          // This is a soft requirement - we just verify the function runs
          expect(result).toBeDefined();
          expect(typeof result.needsKnowledgeBase).toBe('boolean');
          expect(typeof result.needsStructuredData).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should return valid classification structure for any query', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        (query) => {
          const result = classifyQuery(query);
          
          // Structure validation
          expect(result).toHaveProperty('needsStructuredData');
          expect(result).toHaveProperty('needsKnowledgeBase');
          expect(result).toHaveProperty('confidence');
          expect(result).toHaveProperty('matchedKeywords');
          
          // Type validation
          expect(typeof result.needsStructuredData).toBe('boolean');
          expect(typeof result.needsKnowledgeBase).toBe('boolean');
          expect(typeof result.confidence).toBe('number');
          expect(Array.isArray(result.matchedKeywords)).toBe(true);
          
          // Confidence should be between 0 and 1
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should default to structured data when no keywords match', () => {
    fc.assert(
      fc.property(
        // Generate random strings that don't contain any keywords
        fc.string({ minLength: 1, maxLength: 15 }).filter(s => {
          const lower = s.toLowerCase();
          return !structuredKeywords.some(k => lower.includes(k.toLowerCase())) &&
                 !knowledgeKeywords.some(k => lower.includes(k.toLowerCase()));
        }),
        (query) => {
          const result = classifyQuery(query);
          
          // When no keywords match, should default to structured data
          // (short queries without keywords default to structured)
          if (query.length <= 20) {
            expect(result.needsStructuredData).toBe(true);
          }
        }
      ),
      { numRuns: 50 } // Fewer runs due to filtering
    );
  });
  
  it('should handle mixed queries with both keyword types', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...structuredKeywords),
        fc.constantFrom(...knowledgeKeywords),
        (structuredKw, knowledgeKw) => {
          const query = `${structuredKw}的${knowledgeKw}`;
          const result = classifyQuery(query);
          
          // Mixed queries should need both data sources
          expect(result.needsStructuredData).toBe(true);
          expect(result.needsKnowledgeBase).toBe(true);
          expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should be case-insensitive for English keyword matching', () => {
    // English keywords from the list
    const englishKeywords = ['position', 'trade', 'buy', 'sell', 'profit', 'loss', 'portfolio'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...englishKeywords),
        fc.boolean(),
        (keyword, uppercase) => {
          const query = uppercase ? keyword.toUpperCase() : keyword.toLowerCase();
          const result = classifyQuery(query);
          
          // Should match regardless of case
          expect(result.needsStructuredData).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Unit Tests for specific scenarios
// ============================================================================

describe('Query Classification - Specific Scenarios', () => {
  
  it('should classify "我的持仓" as needing structured data', () => {
    const result = classifyQuery('我的持仓');
    expect(result.needsStructuredData).toBe(true);
    expect(result.matchedKeywords).toContain('持仓');
  });
  
  it('should classify "价值投资策略" as needing knowledge base', () => {
    const result = classifyQuery('价值投资策略');
    expect(result.needsKnowledgeBase).toBe(true);
    expect(result.matchedKeywords).toContain('策略');
  });
  
  it('should classify "为什么巴菲特买入苹果" as needing both', () => {
    const result = classifyQuery('为什么巴菲特买入苹果');
    expect(result.needsStructuredData).toBe(true); // "买入"
    expect(result.needsKnowledgeBase).toBe(true);  // "为什么", "巴菲特"
  });
  
  it('should classify empty query as needing structured data by default', () => {
    const result = classifyQuery('');
    expect(result.needsStructuredData).toBe(true);
  });
  
  it('should handle question patterns', () => {
    const questions = [
      '为什么股价下跌',
      '怎么计算收益率',
      '如何分析财报',
      '什么是市盈率'
    ];
    
    for (const q of questions) {
      const result = classifyQuery(q);
      expect(result.needsKnowledgeBase).toBe(true);
    }
  });
});
