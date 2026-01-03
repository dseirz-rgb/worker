/**
 * Adaptive RAG Service Tests
 *
 * Tests for the main orchestration service including:
 * - Property 6: Retry Mechanism Enforcement
 * - Property 11: Backward Compatibility
 * - Property 12: Fallback Chain
 * - Integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdaptiveRAGService } from './adaptiveRagService';
import type { GraphState, Citation } from './types';

// Mock dependencies
vi.mock('../lightragClient', () => ({
  queryKnowledge: vi.fn(),
  isLightRAGAvailable: vi.fn(),
}));

vi.mock('../supabaseData', () => ({
  getClient: vi.fn(),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AdaptiveRAGService', () => {
  let service: AdaptiveRAGService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdaptiveRAGService({ max_retries: 3 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Property 11: Backward Compatibility', () => {
    /**
     * For any call to getInvestmentContext(query), the response SHALL contain:
     * - text field as string
     * - citations field as array of Citation objects
     */

    it('should return text and citations fields', async () => {
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        datasource: 'vectorstore',
                        confidence: 0.8,
                        reasoning: 'test',
                      }),
                    },
                  ],
                },
              },
            ],
          }),
      });

      // Mock generation response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Test response' }],
                },
              },
            ],
          }),
      });

      // Mock grading responses
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        binary_score: 'yes',
                        confidence: 0.9,
                        explanation: 'Good',
                      }),
                    },
                  ],
                },
              },
            ],
          }),
      });

      const result = await service.getInvestmentContext('test query');

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('citations');
      expect(typeof result.text).toBe('string');
      expect(Array.isArray(result.citations)).toBe(true);
    });

    it('should return valid response even on error', async () => {
      // Mock all fetches to fail
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.getInvestmentContext('test query');

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('citations');
      expect(typeof result.text).toBe('string');
      expect(Array.isArray(result.citations)).toBe(true);
    });

    it('should handle empty query', async () => {
      const result = await service.getInvestmentContext('');

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('citations');
    });
  });

  describe('Property 6: Retry Mechanism Enforcement', () => {
    /**
     * For any execution where hallucination is detected:
     * - loop_step SHALL increment by 1
     * - Regeneration triggered if loop_step <= max_retries
     * - Return best available response if loop_step > max_retries
     * - loop_step SHALL never exceed max_retries + 1
     */

    it('should respect max_retries configuration', () => {
      const customService = new AdaptiveRAGService({ max_retries: 5 });
      expect(customService.getConfig().max_retries).toBe(5);
    });

    it('should use default max_retries of 3', () => {
      const defaultService = new AdaptiveRAGService();
      expect(defaultService.getConfig().max_retries).toBe(3);
    });
  });

  describe('Configuration', () => {
    it('should allow updating configuration', () => {
      service.updateConfig({ max_retries: 5 });
      expect(service.getConfig().max_retries).toBe(5);
    });

    it('should preserve other config when updating', () => {
      const originalConfig = service.getConfig();
      service.updateConfig({ max_retries: 5 });

      const newConfig = service.getConfig();
      expect(newConfig.router).toEqual(originalConfig.router);
      expect(newConfig.documentGrader).toEqual(originalConfig.documentGrader);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.getInvestmentContext('test');

      expect(result.text).toBeTruthy();
      expect(result.citations).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await service.getInvestmentContext('test');

      expect(result.text).toBeTruthy();
      expect(result.citations).toBeDefined();
    });
  });
});

describe('Citation Format', () => {
  it('should have valid citation structure', () => {
    const citation: Citation = {
      source: 'Test Source',
      title: 'Test Title',
      content_snippet: 'Test snippet...',
    };

    expect(citation.source).toBeTruthy();
    expect(citation.title).toBeTruthy();
    expect(citation.content_snippet).toBeTruthy();
  });

  it('should allow optional url in citation', () => {
    const citation: Citation = {
      source: 'Test Source',
      title: 'Test Title',
      content_snippet: 'Test snippet...',
      url: 'https://example.com',
    };

    expect(citation.url).toBe('https://example.com');
  });
});
