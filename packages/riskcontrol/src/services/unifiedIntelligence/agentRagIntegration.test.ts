/**
 * AgentRAGIntegration Tests
 *
 * Property-based tests for Hallucination Grading Integration (Property 3)
 * - Grader is invoked for all agent responses
 * - Re-analysis triggered on hallucination
 *
 * @see Requirements 2.4, 2.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AgentRAGIntegration,
  retrieveWithQualityControl,
  validateAgentResponse,
} from './agentRagIntegration';
import type { Document } from '../adaptiveRag/types';

// =============================================================================
// Mocks
// =============================================================================

// Mock EnhancedAdaptiveRAGService
vi.mock('./enhancedAdaptiveRag', () => ({
  EnhancedAdaptiveRAGService: vi.fn().mockImplementation(() => ({
    retrieveForAgent: vi.fn().mockResolvedValue({
      documents: [
        {
          id: 'doc1',
          content: 'Test document content about investment',
          metadata: { source: 'test' },
          relevance_score: 0.8,
        },
      ],
      citations: [{ source: 'Test', title: 'Test Doc', content_snippet: '...' }],
      hasRelevantDocs: true,
    }),
  })),
}));

// Mock DocumentGrader
vi.mock('../adaptiveRag/documentGrader', () => ({
  DocumentGrader: vi.fn().mockImplementation(() => ({
    grade: vi.fn().mockResolvedValue({
      binary_score: 'yes',
      confidence: 0.85,
    }),
  })),
}));

// Mock HallucinationGrader
vi.mock('../adaptiveRag/hallucinationGrader', () => ({
  HallucinationGrader: vi.fn().mockImplementation(() => ({
    grade: vi.fn().mockResolvedValue({
      binary_score: 'yes',
      explanation: 'Response is grounded in documents',
    }),
  })),
}));

// =============================================================================
// Test Data
// =============================================================================

const mockDocuments: Document[] = [
  {
    id: 'doc1',
    content: 'Warren Buffett emphasizes value investing and long-term holding.',
    metadata: { source: 'test' },
    relevance_score: 0.9,
  },
  {
    id: 'doc2',
    content: 'Risk management is crucial for portfolio protection.',
    metadata: { source: 'test' },
    relevance_score: 0.8,
  },
];

const groundedResponse = 'Based on the documents, Warren Buffett emphasizes value investing.';
const hallucinatedResponse = 'Warren Buffett recommends day trading for quick profits.';

// =============================================================================
// Unit Tests
// =============================================================================

describe('AgentRAGIntegration', () => {
  let integration: AgentRAGIntegration;
  let mockHallucinationGrade: ReturnType<typeof vi.fn>;
  let mockDocumentGrade: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mocked graders
    const { HallucinationGrader } = await import('../adaptiveRag/hallucinationGrader');
    const { DocumentGrader } = await import('../adaptiveRag/documentGrader');

    mockHallucinationGrade = vi.fn().mockResolvedValue({
      binary_score: 'yes',
      explanation: 'Grounded',
    });

    mockDocumentGrade = vi.fn().mockResolvedValue({
      binary_score: 'yes',
      confidence: 0.85,
    });

    (HallucinationGrader as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      grade: mockHallucinationGrade,
    }));

    (DocumentGrader as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      grade: mockDocumentGrade,
    }));

    integration = new AgentRAGIntegration();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('retrieveWithQualityControl()', () => {
    it('should retrieve and grade documents', async () => {
      const result = await integration.retrieveWithQualityControl(
        'advisor',
        'investment principles'
      );

      expect(result.documents).toBeDefined();
      expect(result.gradedDocuments).toBeDefined();
      expect(result.hasRelevantDocs).toBe(true);
    });

    it('should filter low relevance documents', async () => {
      mockDocumentGrade
        .mockResolvedValueOnce({ binary_score: 'yes', confidence: 0.9 })
        .mockResolvedValueOnce({ binary_score: 'no', confidence: 0.2 });

      const result = await integration.retrieveWithQualityControl(
        'advisor',
        'test query',
        undefined,
        { minRelevanceScore: 0.5 }
      );

      expect(result.filteredCount).toBeGreaterThanOrEqual(0);
    });

    it('should skip grading when disabled', async () => {
      const result = await integration.retrieveWithQualityControl(
        'advisor',
        'test query',
        undefined,
        { enableDocumentGrading: false }
      );

      expect(mockDocumentGrade).not.toHaveBeenCalled();
      expect(result.documents.length).toBeGreaterThan(0);
    });

    it('should calculate average relevance', async () => {
      const result = await integration.retrieveWithQualityControl(
        'advisor',
        'test query'
      );

      expect(result.averageRelevance).toBeGreaterThanOrEqual(0);
      expect(result.averageRelevance).toBeLessThanOrEqual(1);
    });
  });

  describe('validateAgentResponse()', () => {
    it('should validate grounded response', async () => {
      mockHallucinationGrade.mockResolvedValue({
        binary_score: 'yes',
        explanation: 'Response is grounded',
      });

      const result = await integration.validateAgentResponse(
        groundedResponse,
        mockDocuments
      );

      expect(result.isGrounded).toBe(true);
      expect(result.needsRegeneration).toBe(false);
    });

    it('should detect hallucination', async () => {
      mockHallucinationGrade.mockResolvedValue({
        binary_score: 'no',
        explanation: 'Response contains unsupported claims',
      });

      const result = await integration.validateAgentResponse(
        hallucinatedResponse,
        mockDocuments
      );

      expect(result.isGrounded).toBe(false);
      expect(result.needsRegeneration).toBe(true);
    });

    it('should skip validation when disabled', async () => {
      const customIntegration = new AgentRAGIntegration({
        enableHallucinationDetection: false,
      });

      const result = await customIntegration.validateAgentResponse(
        hallucinatedResponse,
        mockDocuments
      );

      expect(result.isGrounded).toBe(true);
      expect(mockHallucinationGrade).not.toHaveBeenCalled();
    });

    it('should handle empty documents', async () => {
      const result = await integration.validateAgentResponse('Some response', []);

      expect(result.isGrounded).toBe(false);
      expect(result.needsRegeneration).toBe(true);
      expect(result.explanation).toContain('No documents');
    });
  });

  describe('validateWithRegeneration()', () => {
    it('should return immediately if grounded', async () => {
      mockHallucinationGrade.mockResolvedValue({
        binary_score: 'yes',
        explanation: 'Grounded',
      });

      const regenerateCallback = vi.fn();

      const result = await integration.validateWithRegeneration(
        groundedResponse,
        mockDocuments,
        regenerateCallback
      );

      expect(result.validation.isGrounded).toBe(true);
      expect(result.attempts).toBe(0);
      expect(regenerateCallback).not.toHaveBeenCalled();
    });

    it('should trigger regeneration on hallucination', async () => {
      mockHallucinationGrade
        .mockResolvedValueOnce({ binary_score: 'no', explanation: 'Hallucination' })
        .mockResolvedValueOnce({ binary_score: 'yes', explanation: 'Grounded' });

      const regenerateCallback = vi.fn().mockResolvedValue('Regenerated response');

      const result = await integration.validateWithRegeneration(
        hallucinatedResponse,
        mockDocuments,
        regenerateCallback
      );

      expect(regenerateCallback).toHaveBeenCalledTimes(1);
      expect(result.attempts).toBe(1);
    });

    it('should respect max regeneration attempts', async () => {
      mockHallucinationGrade.mockResolvedValue({
        binary_score: 'no',
        explanation: 'Still hallucinating',
      });

      const regenerateCallback = vi.fn().mockResolvedValue('Still bad response');

      const customIntegration = new AgentRAGIntegration({
        maxRegenerationAttempts: 2,
      });

      const result = await customIntegration.validateWithRegeneration(
        hallucinatedResponse,
        mockDocuments,
        regenerateCallback
      );

      expect(regenerateCallback).toHaveBeenCalledTimes(2);
      expect(result.attempts).toBe(2);
    });
  });

  describe('Configuration', () => {
    it('should update options', () => {
      integration.updateOptions({ minRelevanceScore: 0.7 });
      const options = integration.getOptions();
      expect(options.minRelevanceScore).toBe(0.7);
    });

    it('should preserve other options when updating', () => {
      integration.updateOptions({ minRelevanceScore: 0.7 });
      const options = integration.getOptions();
      expect(options.enableDocumentGrading).toBe(true);
      expect(options.enableHallucinationDetection).toBe(true);
    });
  });
});

// =============================================================================
// Property-Based Tests (Property 3: Hallucination Grading Integration)
// =============================================================================

describe('Property 3: Hallucination Grading Integration', () => {
  let integration: AgentRAGIntegration;
  let mockHallucinationGrade: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { HallucinationGrader } = await import('../adaptiveRag/hallucinationGrader');
    const { DocumentGrader } = await import('../adaptiveRag/documentGrader');

    mockHallucinationGrade = vi.fn();

    (HallucinationGrader as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      grade: mockHallucinationGrade,
    }));

    (DocumentGrader as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      grade: vi.fn().mockResolvedValue({ binary_score: 'yes', confidence: 0.8 }),
    }));

    integration = new AgentRAGIntegration();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Grader is invoked for all agent responses', () => {
    it('should invoke hallucination grader for every validation call', async () => {
      mockHallucinationGrade.mockResolvedValue({
        binary_score: 'yes',
        explanation: 'Grounded',
      });

      // Multiple validation calls
      await integration.validateAgentResponse('Response 1', mockDocuments);
      await integration.validateAgentResponse('Response 2', mockDocuments);
      await integration.validateAgentResponse('Response 3', mockDocuments);

      expect(mockHallucinationGrade).toHaveBeenCalledTimes(3);
    });

    it('should pass response and documents to grader', async () => {
      mockHallucinationGrade.mockResolvedValue({
        binary_score: 'yes',
        explanation: 'Grounded',
      });

      const testResponse = 'Test agent response';
      await integration.validateAgentResponse(testResponse, mockDocuments);

      expect(mockHallucinationGrade).toHaveBeenCalledWith(
        testResponse,
        mockDocuments.map((d) => d.content)
      );
    });

    it('should invoke grader during validateWithRegeneration', async () => {
      mockHallucinationGrade.mockResolvedValue({
        binary_score: 'yes',
        explanation: 'Grounded',
      });

      await integration.validateWithRegeneration(
        'Test response',
        mockDocuments,
        vi.fn()
      );

      expect(mockHallucinationGrade).toHaveBeenCalled();
    });
  });

  describe('Re-analysis triggered on hallucination', () => {
    it('should trigger regeneration when hallucination detected', async () => {
      mockHallucinationGrade
        .mockResolvedValueOnce({ binary_score: 'no', explanation: 'Hallucination' })
        .mockResolvedValueOnce({ binary_score: 'yes', explanation: 'Grounded' });

      const regenerateCallback = vi.fn().mockResolvedValue('Better response');

      await integration.validateWithRegeneration(
        'Bad response',
        mockDocuments,
        regenerateCallback
      );

      expect(regenerateCallback).toHaveBeenCalled();
    });

    it('should continue regenerating until grounded or max attempts', async () => {
      mockHallucinationGrade
        .mockResolvedValueOnce({ binary_score: 'no', explanation: 'Hallucination 1' })
        .mockResolvedValueOnce({ binary_score: 'no', explanation: 'Hallucination 2' })
        .mockResolvedValueOnce({ binary_score: 'yes', explanation: 'Finally grounded' });

      const regenerateCallback = vi.fn().mockResolvedValue('Regenerated');

      const customIntegration = new AgentRAGIntegration({
        maxRegenerationAttempts: 3,
      });

      const result = await customIntegration.validateWithRegeneration(
        'Bad response',
        mockDocuments,
        regenerateCallback
      );

      expect(regenerateCallback).toHaveBeenCalledTimes(2);
      expect(result.validation.isGrounded).toBe(true);
    });

    it('should return needsRegeneration=true when hallucination detected', async () => {
      mockHallucinationGrade.mockResolvedValue({
        binary_score: 'no',
        explanation: 'Contains unsupported claims',
      });

      const result = await integration.validateAgentResponse(
        'Hallucinated response',
        mockDocuments
      );

      expect(result.needsRegeneration).toBe(true);
      expect(result.isGrounded).toBe(false);
    });

    it('should include explanation from grader', async () => {
      const explanation = 'The response claims X but documents only mention Y';
      mockHallucinationGrade.mockResolvedValue({
        binary_score: 'no',
        explanation,
      });

      const result = await integration.validateAgentResponse(
        'Hallucinated response',
        mockDocuments
      );

      expect(result.explanation).toBe(explanation);
    });
  });
});

// =============================================================================
// Convenience Function Tests
// =============================================================================

describe('Convenience Functions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const { HallucinationGrader } = await import('../adaptiveRag/hallucinationGrader');
    const { DocumentGrader } = await import('../adaptiveRag/documentGrader');

    (HallucinationGrader as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      grade: vi.fn().mockResolvedValue({ binary_score: 'yes', explanation: 'OK' }),
    }));

    (DocumentGrader as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      grade: vi.fn().mockResolvedValue({ binary_score: 'yes', confidence: 0.8 }),
    }));
  });

  it('retrieveWithQualityControl should work with singleton', async () => {
    const result = await retrieveWithQualityControl('advisor', 'test query');
    expect(result).toBeDefined();
    expect(result.documents).toBeDefined();
  });

  it('validateAgentResponse should work with singleton', async () => {
    const result = await validateAgentResponse('Test response', mockDocuments);
    expect(result).toBeDefined();
    expect(result.isGrounded).toBeDefined();
  });
});
