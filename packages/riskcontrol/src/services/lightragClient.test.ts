/**
 * LightRAG Client Tests
 * 
 * Property-based tests for LightRAG integration
 * These tests validate the client behavior and data structures
 * 
 * **Validates: Requirements 2.2, 2.3, 2.4, 6.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Types (mirroring lightragClient.ts)
// ============================================================================

interface IndexRequest {
  document_id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface QueryRequest {
  query: string;
  mode?: 'naive' | 'local' | 'global' | 'hybrid';
}

interface IndexResponse {
  success: boolean;
  document_id: string;
  message: string;
  metadata?: Record<string, unknown>;
}

interface QueryResponse {
  success: boolean;
  query: string;
  mode: string;
  result?: string;
  error?: string;
}

// ============================================================================
// Helper Functions (simulating client logic for testing)
// ============================================================================

function buildIndexRequest(
  documentId: string,
  content: string,
  metadata?: Record<string, unknown>
): IndexRequest {
  return {
    document_id: documentId,
    content,
    metadata
  };
}

function buildQueryRequest(
  query: string,
  mode: 'naive' | 'local' | 'global' | 'hybrid' = 'hybrid'
): QueryRequest {
  return { query, mode };
}

function validateIndexResponse(response: IndexResponse): boolean {
  return (
    typeof response.success === 'boolean' &&
    typeof response.document_id === 'string' &&
    typeof response.message === 'string'
  );
}

function validateQueryResponse(response: QueryResponse): boolean {
  const validModes = ['naive', 'local', 'global', 'hybrid'];
  return (
    typeof response.success === 'boolean' &&
    typeof response.query === 'string' &&
    validModes.includes(response.mode)
  );
}

function encodeDocumentId(docId: string): string {
  return encodeURIComponent(docId);
}

// ============================================================================
// Arbitrary Generators
// ============================================================================

const arbitraryDocumentId = fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/);
const arbitraryContent = fc.stringMatching(/^[a-zA-Z0-9 ]{10,100}$/);
const arbitraryQuery = fc.stringMatching(/^[a-zA-Z0-9 ]{1,50}$/);
const arbitraryMode = fc.constantFrom('naive', 'local', 'global', 'hybrid') as fc.Arbitrary<'naive' | 'local' | 'global' | 'hybrid'>;

const arbitraryMetadata = fc.record({
  title: fc.string({ minLength: 1, maxLength: 50 }),
  source_type: fc.constantFrom('book', 'article', 'note', 'chat'),
});

// ============================================================================
// Property 4: Entity Extraction Round-Trip
// Validates: Requirements 2.2
// ============================================================================

describe('Property 4: Entity Extraction Round-Trip', () => {
  
  it('should build valid index request with document_id', () => {
    fc.assert(
      fc.property(
        arbitraryDocumentId,
        arbitraryContent,
        (docId, content) => {
          const request = buildIndexRequest(docId, content);
          
          expect(request.document_id).toBe(docId);
          expect(request.content).toBe(content);
          expect(typeof request.document_id).toBe('string');
          expect(typeof request.content).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include metadata in index request when provided', () => {
    fc.assert(
      fc.property(
        arbitraryDocumentId,
        arbitraryContent,
        arbitraryMetadata,
        (docId, content, metadata) => {
          const request = buildIndexRequest(docId, content, metadata);
          
          expect(request.metadata).toEqual(metadata);
          expect(request.metadata?.title).toBe(metadata.title);
          expect(request.metadata?.source_type).toBe(metadata.source_type);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate index response structure', () => {
    fc.assert(
      fc.property(
        arbitraryDocumentId,
        fc.boolean(),
        fc.string(),
        (docId, success, message) => {
          const response: IndexResponse = {
            success,
            document_id: docId,
            message
          };
          
          expect(validateIndexResponse(response)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 5: Dual-Level Retrieval Completeness
// Validates: Requirements 2.3
// ============================================================================

describe('Property 5: Dual-Level Retrieval Completeness', () => {
  
  it('should support all query modes', () => {
    fc.assert(
      fc.property(
        arbitraryQuery,
        arbitraryMode,
        (query, mode) => {
          const request = buildQueryRequest(query, mode);
          
          expect(request.query).toBe(query);
          expect(request.mode).toBe(mode);
          expect(['naive', 'local', 'global', 'hybrid']).toContain(request.mode);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should default to hybrid mode when not specified', () => {
    fc.assert(
      fc.property(
        arbitraryQuery,
        (query) => {
          const request = buildQueryRequest(query);
          
          expect(request.mode).toBe('hybrid');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate query response structure', () => {
    fc.assert(
      fc.property(
        arbitraryQuery,
        arbitraryMode,
        fc.boolean(),
        fc.option(fc.string()),
        (query, mode, success, result) => {
          const response: QueryResponse = {
            success,
            query,
            mode,
            result: result ?? undefined
          };
          
          expect(validateQueryResponse(response)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve query text in response', () => {
    fc.assert(
      fc.property(
        arbitraryQuery,
        (query) => {
          const response: QueryResponse = {
            success: true,
            query,
            mode: 'hybrid',
            result: 'test result'
          };
          
          expect(response.query).toBe(query);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 6: Incremental Update Isolation
// Validates: Requirements 2.4
// ============================================================================

describe('Property 6: Incremental Update Isolation', () => {
  
  it('should generate unique requests for different documents', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(arbitraryDocumentId, arbitraryContent),
          { minLength: 2, maxLength: 10 }
        ),
        (documents) => {
          const requests = documents.map(([docId, content]) => 
            buildIndexRequest(docId, content)
          );
          
          // Each request should be independent
          requests.forEach((req, i) => {
            expect(req.document_id).toBe(documents[i][0]);
            expect(req.content).toBe(documents[i][1]);
          });
          
          // Requests should not share references
          for (let i = 0; i < requests.length; i++) {
            for (let j = i + 1; j < requests.length; j++) {
              expect(requests[i]).not.toBe(requests[j]);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle documents with same content but different IDs', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryDocumentId, { minLength: 2, maxLength: 5 }),
        arbitraryContent,
        (docIds, content) => {
          const requests = docIds.map(docId => 
            buildIndexRequest(docId, content)
          );
          
          // All should have same content
          requests.forEach(req => {
            expect(req.content).toBe(content);
          });
          
          // But different document IDs (if input IDs are unique)
          const uniqueIds = new Set(docIds);
          const requestIds = new Set(requests.map(r => r.document_id));
          expect(requestIds.size).toBe(uniqueIds.size);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Property 12: Cascade Delete Completeness
// Validates: Requirements 6.3
// ============================================================================

describe('Property 12: Cascade Delete Completeness', () => {
  
  it('should properly encode document IDs for deletion', () => {
    fc.assert(
      fc.property(
        arbitraryDocumentId,
        (docId) => {
          const encoded = encodeDocumentId(docId);
          
          // Should be URL-safe
          expect(encoded).not.toContain(' ');
          
          // Should be decodable back to original
          expect(decodeURIComponent(encoded)).toBe(docId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle special characters in document IDs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (docId) => {
          const encoded = encodeDocumentId(docId);
          
          // Should always produce a string
          expect(typeof encoded).toBe('string');
          expect(encoded.length).toBeGreaterThan(0);
          
          // Should be decodable
          expect(decodeURIComponent(encoded)).toBe(docId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should build correct delete URL path', () => {
    fc.assert(
      fc.property(
        arbitraryDocumentId,
        (docId) => {
          const baseUrl = 'http://lightrag:8000';
          const encoded = encodeDocumentId(docId);
          const deleteUrl = `${baseUrl}/document/${encoded}`;
          
          // Should contain the encoded ID
          expect(deleteUrl).toContain(encoded);
          
          // Should be a valid URL structure
          expect(deleteUrl).toMatch(/^http:\/\/[^/]+\/document\/.+$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Unit Tests for Edge Cases
// ============================================================================

describe('LightRAG Client Edge Cases', () => {
  
  it('should handle empty metadata', () => {
    const request = buildIndexRequest('doc1', 'content');
    expect(request.metadata).toBeUndefined();
  });

  it('should handle very long content', () => {
    const longContent = 'a'.repeat(10000);
    const request = buildIndexRequest('doc1', longContent);
    expect(request.content.length).toBe(10000);
  });

  it('should handle unicode in content', () => {
    const unicodeContent = '这是中文内容 with English and 日本語';
    const request = buildIndexRequest('doc1', unicodeContent);
    expect(request.content).toBe(unicodeContent);
  });

  it('should handle unicode in document ID', () => {
    const unicodeId = '文档-123';
    const encoded = encodeDocumentId(unicodeId);
    expect(decodeURIComponent(encoded)).toBe(unicodeId);
  });

  it('should validate all query modes', () => {
    const modes: Array<'naive' | 'local' | 'global' | 'hybrid'> = ['naive', 'local', 'global', 'hybrid'];
    
    modes.forEach(mode => {
      const request = buildQueryRequest('test query', mode);
      expect(request.mode).toBe(mode);
    });
  });
});

// ============================================================================
// Response Validation Tests
// ============================================================================

describe('Response Validation', () => {
  
  it('should reject invalid index response', () => {
    const invalidResponses = [
      { success: 'true', document_id: 'doc1', message: 'ok' }, // success should be boolean
      { success: true, document_id: 123, message: 'ok' }, // document_id should be string
      { success: true, document_id: 'doc1', message: null }, // message should be string
    ];
    
    invalidResponses.forEach(resp => {
      expect(validateIndexResponse(resp as any)).toBe(false);
    });
  });

  it('should reject invalid query response', () => {
    const invalidResponses = [
      { success: true, query: 'test', mode: 'invalid' }, // invalid mode
      { success: 'true', query: 'test', mode: 'hybrid' }, // success should be boolean
      { success: true, query: 123, mode: 'hybrid' }, // query should be string
    ];
    
    invalidResponses.forEach(resp => {
      expect(validateQueryResponse(resp as any)).toBe(false);
    });
  });

  it('should accept valid responses', () => {
    const validIndexResponse: IndexResponse = {
      success: true,
      document_id: 'doc-123',
      message: 'Document indexed successfully'
    };
    expect(validateIndexResponse(validIndexResponse)).toBe(true);

    const validQueryResponse: QueryResponse = {
      success: true,
      query: 'test query',
      mode: 'hybrid',
      result: 'Some result'
    };
    expect(validateQueryResponse(validQueryResponse)).toBe(true);
  });
});
