/**
 * Search Result Grouping Tests
 * 
 * Property-based tests for search result grouping logic
 * **Validates: Requirements 6.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types matching the API
interface SearchResult {
  id: string;
  content_preview: string;
  score: number;
  metadata: Record<string, unknown>;
  source_type: string;
  parent_title?: string;
}

interface GroupedSearchResults {
  query: string;
  total: number;
  groups: {
    title: string;
    source_type: string;
    results: SearchResult[];
    total_score: number;
  }[];
}

/**
 * 将搜索结果按来源分组 (复制自 API 以便测试)
 * 使用 Map 避免 JavaScript 保留属性名冲突
 */
function groupSearchResults(results: SearchResult[], query: string): GroupedSearchResults {
  const groupMap = new Map<string, {
    title: string;
    source_type: string;
    results: SearchResult[];
    total_score: number;
  }>();
  
  for (const result of results) {
    const groupKey = result.parent_title || result.source_type || 'other';
    const groupTitle = result.parent_title || getSourceTypeLabel(result.source_type);
    
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        title: groupTitle,
        source_type: result.source_type,
        results: [],
        total_score: 0
      });
    }
    
    const group = groupMap.get(groupKey)!;
    group.results.push(result);
    group.total_score += result.score;
  }
  
  const groups = Array.from(groupMap.values()).sort((a, b) => b.total_score - a.total_score);
  
  for (const group of groups) {
    group.results.sort((a, b) => b.score - a.score);
  }
  
  return {
    query,
    total: results.length,
    groups
  };
}

function getSourceTypeLabel(sourceType: string): string {
  const labels: Record<string, string> = {
    'uploaded_file': '上传文件',
    'article': '文章',
    'note': '笔记',
    'book': '书籍',
    'web': '网页'
  };
  return labels[sourceType] || sourceType;
}

// ============================================================================
// Arbitraries
// ============================================================================

const sourceTypes = ['uploaded_file', 'article', 'note', 'book', 'web'];

const searchResultArb: fc.Arbitrary<SearchResult> = fc.record({
  id: fc.uuid(),
  content_preview: fc.string({ minLength: 10, maxLength: 200 }),
  score: fc.float({ min: 0, max: 1, noNaN: true }),
  metadata: fc.constant({}),
  source_type: fc.constantFrom(...sourceTypes),
  parent_title: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined })
});

// ============================================================================
// Property 13: Search Result Grouping
// ============================================================================

describe('Property 13: Search Result Grouping', () => {
  
  it('should preserve total result count after grouping', () => {
    fc.assert(
      fc.property(
        fc.array(searchResultArb, { minLength: 0, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (results, query) => {
          const grouped = groupSearchResults(results, query);
          
          // Total should match input count
          expect(grouped.total).toBe(results.length);
          
          // Sum of all group results should equal total
          const sumInGroups = grouped.groups.reduce((sum, g) => sum + g.results.length, 0);
          expect(sumInGroups).toBe(results.length);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should group results with same parent_title together', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 2, max: 10 }),
        (parentTitle, numResults) => {
          const results: SearchResult[] = [];
          for (let i = 0; i < numResults; i++) {
            results.push({
              id: `id-${i}`,
              content_preview: `Content ${i}`,
              score: Math.random(),
              metadata: {},
              source_type: 'article',
              parent_title: parentTitle
            });
          }
          
          const grouped = groupSearchResults(results, 'test query');
          
          // Should have exactly one group
          expect(grouped.groups.length).toBe(1);
          expect(grouped.groups[0].title).toBe(parentTitle);
          expect(grouped.groups[0].results.length).toBe(numResults);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  it('should group results by source_type when no parent_title', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...sourceTypes),
        fc.integer({ min: 2, max: 10 }),
        (sourceType, numResults) => {
          const results: SearchResult[] = [];
          for (let i = 0; i < numResults; i++) {
            results.push({
              id: `id-${i}`,
              content_preview: `Content ${i}`,
              score: Math.random(),
              metadata: {},
              source_type: sourceType,
              parent_title: undefined
            });
          }
          
          const grouped = groupSearchResults(results, 'test query');
          
          expect(grouped.groups.length).toBe(1);
          expect(grouped.groups[0].source_type).toBe(sourceType);
          expect(grouped.groups[0].results.length).toBe(numResults);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  it('should sort groups by total_score descending', () => {
    fc.assert(
      fc.property(
        fc.array(searchResultArb, { minLength: 5, maxLength: 30 }),
        (results) => {
          const grouped = groupSearchResults(results, 'test');
          
          // Verify groups are sorted by total_score descending
          for (let i = 1; i < grouped.groups.length; i++) {
            expect(grouped.groups[i - 1].total_score).toBeGreaterThanOrEqual(
              grouped.groups[i].total_score
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should sort results within each group by score descending', () => {
    fc.assert(
      fc.property(
        fc.array(searchResultArb, { minLength: 5, maxLength: 30 }),
        (results) => {
          const grouped = groupSearchResults(results, 'test');
          
          for (const group of grouped.groups) {
            for (let i = 1; i < group.results.length; i++) {
              expect(group.results[i - 1].score).toBeGreaterThanOrEqual(
                group.results[i].score
              );
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should calculate total_score correctly for each group', () => {
    fc.assert(
      fc.property(
        fc.array(searchResultArb, { minLength: 1, maxLength: 20 }),
        (results) => {
          const grouped = groupSearchResults(results, 'test');
          
          for (const group of grouped.groups) {
            const expectedScore = group.results.reduce((sum, r) => sum + r.score, 0);
            expect(Math.abs(group.total_score - expectedScore)).toBeLessThan(0.0001);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should handle empty results', () => {
    const grouped = groupSearchResults([], 'empty query');
    
    expect(grouped.query).toBe('empty query');
    expect(grouped.total).toBe(0);
    expect(grouped.groups.length).toBe(0);
  });
  
  it('should preserve query in output', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.array(searchResultArb, { minLength: 0, maxLength: 10 }),
        (query, results) => {
          const grouped = groupSearchResults(results, query);
          expect(grouped.query).toBe(query);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Unit Tests for edge cases
// ============================================================================

describe('Search Grouping - Edge Cases', () => {
  
  it('should handle results with mixed parent_title and source_type grouping', () => {
    const results: SearchResult[] = [
      { id: '1', content_preview: 'A', score: 0.9, metadata: {}, source_type: 'article', parent_title: 'Book A' },
      { id: '2', content_preview: 'B', score: 0.8, metadata: {}, source_type: 'article', parent_title: 'Book A' },
      { id: '3', content_preview: 'C', score: 0.7, metadata: {}, source_type: 'note', parent_title: undefined },
      { id: '4', content_preview: 'D', score: 0.6, metadata: {}, source_type: 'note', parent_title: undefined },
    ];
    
    const grouped = groupSearchResults(results, 'test');
    
    expect(grouped.groups.length).toBe(2);
    expect(grouped.total).toBe(4);
    
    // Book A group should have higher total score (0.9 + 0.8 = 1.7)
    expect(grouped.groups[0].title).toBe('Book A');
    expect(grouped.groups[0].results.length).toBe(2);
    
    // Note group (0.7 + 0.6 = 1.3)
    expect(grouped.groups[1].source_type).toBe('note');
    expect(grouped.groups[1].results.length).toBe(2);
  });
  
  it('should use source_type label when no parent_title', () => {
    const results: SearchResult[] = [
      { id: '1', content_preview: 'A', score: 0.5, metadata: {}, source_type: 'uploaded_file', parent_title: undefined },
    ];
    
    const grouped = groupSearchResults(results, 'test');
    
    expect(grouped.groups[0].title).toBe('上传文件');
  });
  
  it('should handle unknown source_type', () => {
    const results: SearchResult[] = [
      { id: '1', content_preview: 'A', score: 0.5, metadata: {}, source_type: 'unknown_type', parent_title: undefined },
    ];
    
    const grouped = groupSearchResults(results, 'test');
    
    expect(grouped.groups[0].title).toBe('unknown_type');
  });
});
