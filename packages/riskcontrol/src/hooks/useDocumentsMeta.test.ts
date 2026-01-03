/**
 * useDocumentsMeta Tests
 * 
 * Property-based tests for book aggregation logic
 * **Validates: Requirements 1.2, 6.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types
interface DocumentMeta {
  id: string;
  title: string;
  source_type: string;
  chunk_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface KnowledgeBook {
  title: string;
  count: number;
  ids: string[];
  last_updated: string;
  source_type: string;
}

/**
 * 聚合书籍逻辑 (复制自 hook 以便测试)
 */
function aggregateBooks(documents: DocumentMeta[]): {
  books: KnowledgeBook[];
  others: DocumentMeta[];
} {
  const bookMap: Record<string, KnowledgeBook> = {};
  const others: DocumentMeta[] = [];

  for (const doc of documents) {
    if (doc.source_type === 'uploaded_file' && /\(Part \d+\)$/.test(doc.title)) {
      const baseTitle = doc.title.replace(/\s*\(Part \d+\)$/, '');
      
      if (!bookMap[baseTitle]) {
        bookMap[baseTitle] = {
          title: baseTitle,
          count: 0,
          ids: [],
          last_updated: doc.created_at,
          source_type: 'book'
        };
      }
      
      const book = bookMap[baseTitle];
      book.count += doc.chunk_count || 1;
      book.ids.push(doc.id);
      
      if (new Date(doc.created_at) > new Date(book.last_updated)) {
        book.last_updated = doc.created_at;
      }
    } else {
      others.push(doc);
    }
  }

  const books = Object.values(bookMap).sort(
    (a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
  );

  return { books, others };
}

// ============================================================================
// Property 2: Book Aggregation Consistency
// ============================================================================

describe('Property 2: Book Aggregation Consistency', () => {
  // Filter out JavaScript reserved property names and ensure no trailing spaces
  const reservedNames = ['constructor', 'prototype', '__proto__', 'toString', 'valueOf'];
  const safeBookTitle = fc.string({ minLength: 1, maxLength: 50 })
    .map(s => s.trim()) // Remove leading/trailing spaces
    .filter(s => 
      !s.includes('(Part') && 
      s.length > 0 &&
      !reservedNames.includes(s)
    );
  
  it('should aggregate documents with "(Part N)" pattern into single book', () => {
    fc.assert(
      fc.property(
        safeBookTitle,
        fc.integer({ min: 2, max: 10 }),
        (bookTitle, numParts) => {
          const parts: DocumentMeta[] = [];
          for (let i = 1; i <= numParts; i++) {
            parts.push({
              id: `id-${i}`,
              title: `${bookTitle} (Part ${i})`,
              source_type: 'uploaded_file',
              chunk_count: 1,
              metadata: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
          
          const { books, others } = aggregateBooks(parts);
          
          expect(books.length).toBe(1);
          expect(books[0].title).toBe(bookTitle);
          expect(books[0].ids.length).toBe(numParts);
          expect(others.length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  it('should not aggregate documents without "(Part N)" pattern', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (numDocs) => {
          const documents: DocumentMeta[] = [];
          for (let i = 0; i < numDocs; i++) {
            documents.push({
              id: `id-${i}`,
              title: `Article ${i}`,
              source_type: 'wechat_article',
              chunk_count: 1,
              metadata: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
          
          const { books, others } = aggregateBooks(documents);
          
          expect(books.length).toBe(0);
          expect(others.length).toBe(numDocs);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should preserve total chunk count when aggregating', () => {
    fc.assert(
      fc.property(
        safeBookTitle,
        fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 2, maxLength: 10 }),
        (bookTitle, chunkCounts) => {
          const parts: DocumentMeta[] = chunkCounts.map((count, i) => ({
            id: `id-${i}`,
            title: `${bookTitle} (Part ${i + 1})`,
            source_type: 'uploaded_file',
            chunk_count: count,
            metadata: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));
          
          const { books } = aggregateBooks(parts);
          
          const expectedTotal = chunkCounts.reduce((sum, c) => sum + c, 0);
          expect(books[0].count).toBe(expectedTotal);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should handle mixed documents (books and non-books)', () => {
    fc.assert(
      fc.property(
        safeBookTitle,
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (bookTitle, numParts, numOthers) => {
          const bookParts: DocumentMeta[] = [];
          for (let i = 1; i <= numParts; i++) {
            bookParts.push({
              id: `book-${i}`,
              title: `${bookTitle} (Part ${i})`,
              source_type: 'uploaded_file',
              chunk_count: 1,
              metadata: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
          
          const otherDocs: DocumentMeta[] = [];
          for (let i = 0; i < numOthers; i++) {
            otherDocs.push({
              id: `other-${i}`,
              title: `Article ${i}`,
              source_type: 'wechat_article',
              chunk_count: 1,
              metadata: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
          
          const allDocs = [...bookParts, ...otherDocs];
          const { books, others } = aggregateBooks(allDocs);
          
          expect(books.length).toBe(1);
          expect(books[0].ids.length).toBe(numParts);
          expect(others.length).toBe(numOthers);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  it('should handle multiple different books', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }),
        (numBooks) => {
          const allParts: DocumentMeta[] = [];
          for (let b = 0; b < numBooks; b++) {
            for (let i = 1; i <= 2; i++) {
              allParts.push({
                id: `book${b}-part${i}`,
                title: `Book ${b} (Part ${i})`,
                source_type: 'uploaded_file',
                chunk_count: 1,
                metadata: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            }
          }
          
          const { books, others } = aggregateBooks(allParts);
          
          expect(books.length).toBe(numBooks);
          for (const book of books) {
            expect(book.ids.length).toBe(2);
          }
          expect(others.length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Unit Tests for edge cases
// ============================================================================

describe('Book Aggregation - Edge Cases', () => {
  
  it('should handle empty document list', () => {
    const { books, others } = aggregateBooks([]);
    expect(books.length).toBe(0);
    expect(others.length).toBe(0);
  });
  
  it('should handle single part book', () => {
    const doc: DocumentMeta = {
      id: '1',
      title: 'Test Book (Part 1)',
      source_type: 'uploaded_file',
      chunk_count: 5,
      metadata: {},
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };
    
    const { books, others } = aggregateBooks([doc]);
    
    expect(books.length).toBe(1);
    expect(books[0].title).toBe('Test Book');
    expect(books[0].count).toBe(5);
    expect(others.length).toBe(0);
  });
  
  it('should not aggregate non-uploaded_file with Part pattern', () => {
    const doc: DocumentMeta = {
      id: '1',
      title: 'Article (Part 1)',
      source_type: 'wechat_article',
      chunk_count: 1,
      metadata: {},
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };
    
    const { books, others } = aggregateBooks([doc]);
    
    expect(books.length).toBe(0);
    expect(others.length).toBe(1);
  });
});
