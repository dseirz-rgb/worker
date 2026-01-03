/**
 * Property-Based Tests for Agent Memory System
 *
 * Tests the memory system using fast-check for property-based testing.
 *
 * @module agents/memory.test
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for design specification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  AgentMemoryManager,
  InMemoryStorage,
  MemoryEntry,
  MemoryEntryInput,
  MemoryEntryType,
  MemoryRetrievalStrategy,
  MemoryRetrievalOptions,
  RetrievalContext,
} from './memory';

// =============================================================================
// Test Helpers and Generators
// =============================================================================

/**
 * Generate a random MemoryEntryType
 */
const memoryTypeArb = fc.constantFrom('insight', 'pattern', 'decision', 'outcome') as fc.Arbitrary<MemoryEntryType>;

/**
 * Generate a random MemoryRetrievalStrategy
 */
const strategyArb = fc.constantFrom('recency', 'relevance', 'hybrid') as fc.Arbitrary<MemoryRetrievalStrategy>;

/**
 * Generate a random agent ID
 */
const agentIdArb = fc.constantFrom(
  'position_analyst',
  'risk_analyst',
  'market_analyst',
  'advisor',
  'web_surfer'
);

/**
 * Generate a random MemoryEntryInput
 */
const memoryInputArb = fc.record({
  agentId: agentIdArb,
  type: memoryTypeArb,
  content: fc.string({ minLength: 5, maxLength: 200 }),
  context: fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ minLength: 1, maxLength: 50 })),
  importance: fc.float({ min: 0, max: 1, noNaN: true }),
});

/**
 * Create a memory manager with in-memory storage for testing
 */
function createTestMemoryManager(): AgentMemoryManager {
  return new AgentMemoryManager(new InMemoryStorage());
}

// =============================================================================
// Property Tests for Memory System
// =============================================================================

describe('AgentMemoryManager', () => {
  let memoryManager: AgentMemoryManager;

  beforeEach(() => {
    memoryManager = createTestMemoryManager();
  });

  describe('Property 36: Memory Storage Round-Trip', () => {
    /**
     * Property 36: Memory Storage Round-Trip
     * *For any* valid memory entry, storing and then retrieving it
     * should return the same content.
     *
     * **Validates: Requirements 1.3.1**
     */
    it('should store and retrieve memory entries correctly', async () => {
      await fc.assert(
        fc.asyncProperty(memoryInputArb, async (input) => {
          const stored = await memoryManager.store(input as MemoryEntryInput);

          // Property 1: Stored entry should have an ID
          expect(stored.id).toBeDefined();
          expect(stored.id.length).toBeGreaterThan(0);

          // Property 2: Stored entry should have timestamps
          expect(stored.createdAt).toBeGreaterThan(0);
          expect(stored.lastAccessedAt).toBeGreaterThan(0);

          // Property 3: Content should match input
          expect(stored.content).toBe(input.content);
          expect(stored.agentId).toBe(input.agentId);
          expect(stored.type).toBe(input.type);

          // Property 4: Importance should be clamped to [0, 1]
          expect(stored.importance).toBeGreaterThanOrEqual(0);
          expect(stored.importance).toBeLessThanOrEqual(1);

          // Property 5: Retrieved memories should include the stored entry
          const retrieved = await memoryManager.getAllForAgent(input.agentId);
          const found = retrieved.find(m => m.id === stored.id);
          expect(found).toBeDefined();
          expect(found?.content).toBe(input.content);

          return true;
        }),
        { numRuns: 30 }
      );
    });

    it('should clamp importance to valid range', async () => {
      await fc.assert(
        fc.asyncProperty(
          agentIdArb,
          memoryTypeArb,
          fc.float({ min: -10, max: 10, noNaN: true }),
          async (agentId, type, importance) => {
            const input: MemoryEntryInput = {
              agentId,
              type,
              content: 'Test content',
              context: {},
              importance,
            };

            const stored = await memoryManager.store(input);

            // Property: Importance should always be in [0, 1]
            expect(stored.importance).toBeGreaterThanOrEqual(0);
            expect(stored.importance).toBeLessThanOrEqual(1);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 37: Memory Retrieval Strategy Compliance', () => {
    /**
     * Property 37: Memory Retrieval Strategy Compliance
     * *For any* retrieval strategy, the returned memories should
     * respect the limit and be ordered according to the strategy.
     *
     * **Validates: Requirements 1.3.3**
     */
    it('should respect retrieval limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          agentIdArb,
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 5 }),
          strategyArb,
          async (agentId, numEntries, limit, strategy) => {
            // Create fresh manager for each test run
            const manager = createTestMemoryManager();
            
            // Store multiple entries
            for (let i = 0; i < numEntries; i++) {
              await manager.store({
                agentId,
                type: 'insight',
                content: `Memory entry ${i}`,
                context: { index: i },
                importance: Math.random(),
              });
            }

            const options: MemoryRetrievalOptions = { strategy, limit };
            const context: RetrievalContext = { query: 'test query' };

            const retrieved = await manager.retrieve(agentId, context, options);

            // Property: Retrieved count should not exceed limit
            expect(retrieved.length).toBeLessThanOrEqual(limit);

            // Property: Retrieved count should be min(stored, limit)
            expect(retrieved.length).toBe(Math.min(numEntries, limit));

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should order by recency when using recency strategy', async () => {
      const agentId = 'test_agent';

      // Store entries with different timestamps
      const entries: MemoryEntry[] = [];
      for (let i = 0; i < 5; i++) {
        const entry = await memoryManager.store({
          agentId,
          type: 'insight',
          content: `Entry ${i}`,
          context: {},
          importance: 0.5,
        });
        entries.push(entry);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      const options: MemoryRetrievalOptions = { strategy: 'recency', limit: 3 };
      const context: RetrievalContext = { query: '' };

      const retrieved = await memoryManager.retrieve(agentId, context, options);

      // Property: Should return most recent entries
      expect(retrieved.length).toBe(3);

      // Property: Should be ordered by lastAccessedAt descending
      for (let i = 1; i < retrieved.length; i++) {
        expect(retrieved[i - 1].lastAccessedAt).toBeGreaterThanOrEqual(
          retrieved[i].lastAccessedAt
        );
      }
    });

    it('should prioritize relevant content when using relevance strategy', async () => {
      const agentId = 'test_agent';

      // Store entries with different content
      await memoryManager.store({
        agentId,
        type: 'insight',
        content: 'Portfolio risk analysis shows high concentration',
        context: { topic: 'risk' },
        importance: 0.5,
      });

      await memoryManager.store({
        agentId,
        type: 'insight',
        content: 'Market sentiment is bullish',
        context: { topic: 'market' },
        importance: 0.5,
      });

      await memoryManager.store({
        agentId,
        type: 'insight',
        content: 'Risk metrics indicate elevated volatility',
        context: { topic: 'risk' },
        importance: 0.5,
      });

      const options: MemoryRetrievalOptions = { strategy: 'relevance', limit: 2 };
      const context: RetrievalContext = { query: 'risk analysis' };

      const retrieved = await memoryManager.retrieve(agentId, context, options);

      // Property: Should prioritize entries containing query terms
      expect(retrieved.length).toBe(2);
      expect(retrieved.every(m => m.content.toLowerCase().includes('risk'))).toBe(true);
    });
  });

  describe('Property 38: Memory Pruning Limit Enforcement', () => {
    /**
     * Property 38: Memory Pruning Limit Enforcement
     * *For any* maxEntries limit, after pruning, the number of
     * entries should not exceed the limit.
     *
     * **Validates: Requirements 1.3.4, 1.3.5**
     */
    it('should enforce entry limit after pruning', async () => {
      await fc.assert(
        fc.asyncProperty(
          agentIdArb,
          fc.integer({ min: 5, max: 15 }),
          fc.integer({ min: 2, max: 5 }),
          async (agentId, numEntries, maxEntries) => {
            // Create fresh manager for each test run
            const manager = createTestMemoryManager();
            
            // Store more entries than the limit
            for (let i = 0; i < numEntries; i++) {
              await manager.store({
                agentId,
                type: 'insight',
                content: `Memory entry ${i}`,
                context: { index: i },
                importance: Math.random(),
              });
            }

            // Verify we have more than maxEntries
            const beforePrune = await manager.getAllForAgent(agentId);
            expect(beforePrune.length).toBe(numEntries);

            // Prune to maxEntries
            const deleted = await manager.prune(agentId, maxEntries);

            // Property 1: Should have deleted entries if over limit
            if (numEntries > maxEntries) {
              expect(deleted).toBe(numEntries - maxEntries);
            } else {
              expect(deleted).toBe(0);
            }

            // Property 2: After pruning, should have at most maxEntries
            const afterPrune = await manager.getAllForAgent(agentId);
            expect(afterPrune.length).toBeLessThanOrEqual(maxEntries);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should keep high-importance entries during pruning', async () => {
      const agentId = 'test_agent';

      // Store entries with varying importance
      const highImportance = await memoryManager.store({
        agentId,
        type: 'insight',
        content: 'Critical insight',
        context: {},
        importance: 1.0,
      });

      const lowImportance = await memoryManager.store({
        agentId,
        type: 'insight',
        content: 'Minor observation',
        context: {},
        importance: 0.1,
      });

      const mediumImportance = await memoryManager.store({
        agentId,
        type: 'insight',
        content: 'Moderate insight',
        context: {},
        importance: 0.5,
      });

      // Prune to keep only 2
      await memoryManager.prune(agentId, 2);

      const remaining = await memoryManager.getAllForAgent(agentId);

      // Property: High importance entry should be kept
      expect(remaining.length).toBe(2);
      expect(remaining.some(m => m.id === highImportance.id)).toBe(true);

      // Property: Low importance entry should be pruned
      expect(remaining.some(m => m.id === lowImportance.id)).toBe(false);
    });

    it('should not prune if under limit', async () => {
      const agentId = 'test_agent';

      // Store fewer entries than limit
      await memoryManager.store({
        agentId,
        type: 'insight',
        content: 'Entry 1',
        context: {},
        importance: 0.5,
      });

      await memoryManager.store({
        agentId,
        type: 'insight',
        content: 'Entry 2',
        context: {},
        importance: 0.5,
      });

      const deleted = await memoryManager.prune(agentId, 10);

      // Property: Should not delete anything
      expect(deleted).toBe(0);

      const remaining = await memoryManager.getAllForAgent(agentId);
      expect(remaining.length).toBe(2);
    });
  });

  describe('Property: Access Metadata Updates', () => {
    /**
     * Property: Retrieving memories should update access metadata.
     */
    it('should update lastAccessedAt and accessCount on retrieval', async () => {
      const agentId = 'test_agent';

      const entry = await memoryManager.store({
        agentId,
        type: 'insight',
        content: 'Test entry',
        context: {},
        importance: 0.5,
      });

      const initialAccessCount = entry.accessCount;
      const initialLastAccessed = entry.lastAccessedAt;

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 10));

      // Retrieve the memory
      const options: MemoryRetrievalOptions = { strategy: 'recency', limit: 10 };
      const context: RetrievalContext = { query: '' };
      await memoryManager.retrieve(agentId, context, options);

      // Get the updated entry
      const updated = await memoryManager.getAllForAgent(agentId);
      const updatedEntry = updated.find(m => m.id === entry.id);

      // Property: Access count should increase
      expect(updatedEntry?.accessCount).toBeGreaterThan(initialAccessCount);

      // Property: Last accessed should be updated
      expect(updatedEntry?.lastAccessedAt).toBeGreaterThanOrEqual(initialLastAccessed);
    });
  });

  describe('Property: Clear Operations', () => {
    it('should clear all memories for an agent', async () => {
      const agentId = 'test_agent';

      // Store some entries
      await memoryManager.store({
        agentId,
        type: 'insight',
        content: 'Entry 1',
        context: {},
        importance: 0.5,
      });

      await memoryManager.store({
        agentId,
        type: 'insight',
        content: 'Entry 2',
        context: {},
        importance: 0.5,
      });

      // Clear agent memories
      await memoryManager.clearAgent(agentId);

      const remaining = await memoryManager.getAllForAgent(agentId);
      expect(remaining.length).toBe(0);
    });

    it('should clear all memories across all agents', async () => {
      // Store entries for multiple agents
      await memoryManager.store({
        agentId: 'agent1',
        type: 'insight',
        content: 'Entry 1',
        context: {},
        importance: 0.5,
      });

      await memoryManager.store({
        agentId: 'agent2',
        type: 'insight',
        content: 'Entry 2',
        context: {},
        importance: 0.5,
      });

      // Clear all
      await memoryManager.clearAll();

      const all = await memoryManager.getAll();
      expect(all.length).toBe(0);
    });
  });

  describe('Property: Import/Export', () => {
    it('should export and import memories correctly', async () => {
      // Store some entries
      await memoryManager.store({
        agentId: 'agent1',
        type: 'insight',
        content: 'Entry 1',
        context: { key: 'value1' },
        importance: 0.8,
      });

      await memoryManager.store({
        agentId: 'agent2',
        type: 'pattern',
        content: 'Entry 2',
        context: { key: 'value2' },
        importance: 0.6,
      });

      // Export
      const exported = await memoryManager.exportMemories();
      expect(exported.size).toBe(2);

      // Clear and import to new manager
      const newManager = createTestMemoryManager();
      const allMemories = Array.from(exported.values()).flat();
      await newManager.importMemories(allMemories);

      // Verify import
      const imported = await newManager.getAll();
      expect(imported.length).toBe(2);
      expect(imported.some(m => m.content === 'Entry 1')).toBe(true);
      expect(imported.some(m => m.content === 'Entry 2')).toBe(true);
    });
  });
});

// =============================================================================
// Unit Tests for InMemoryStorage
// =============================================================================

describe('InMemoryStorage', () => {
  it('should store and retrieve entries', async () => {
    const storage = new InMemoryStorage();
    const entry: MemoryEntry = {
      id: 'test-id',
      agentId: 'test-agent',
      type: 'insight',
      content: 'Test content',
      context: {},
      importance: 0.5,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
    };

    await storage.save(entry);
    const retrieved = await storage.getByAgent('test-agent');

    expect(retrieved.length).toBe(1);
    expect(retrieved[0].id).toBe('test-id');
  });

  it('should delete entries', async () => {
    const storage = new InMemoryStorage();
    const entry: MemoryEntry = {
      id: 'test-id',
      agentId: 'test-agent',
      type: 'insight',
      content: 'Test content',
      context: {},
      importance: 0.5,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
    };

    await storage.save(entry);
    await storage.deleteMany(['test-id']);

    const retrieved = await storage.getByAgent('test-agent');
    expect(retrieved.length).toBe(0);
  });
});
