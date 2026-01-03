/**
 * Agent Memory System
 * 
 * Implements long-term memory for agents across sessions.
 * Inspired by Agno's enable_agentic_memory feature.
 * 
 * @see .kiro/specs/multi-agent-analysis/design.md - Section 6.1 Agent Memory Manager
 * @see .kiro/specs/multi-agent-analysis/requirements.md - Requirement 1.3
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Memory entry type classification
 */
export type MemoryEntryType = 'insight' | 'pattern' | 'decision' | 'outcome';

/**
 * Memory retrieval strategy
 */
export type MemoryRetrievalStrategy = 'recency' | 'relevance' | 'hybrid';

/**
 * Long-term memory entry for cross-session learning
 */
export interface MemoryEntry {
  /** Unique identifier for the memory entry */
  id: string;
  
  /** ID of the agent that created this memory */
  agentId: string;
  
  /** Type of memory: insight, pattern, decision, or outcome */
  type: MemoryEntryType;
  
  /** The actual memory content */
  content: string;
  
  /** Additional context associated with this memory */
  context: Record<string, unknown>;
  
  /** Importance score from 0 to 1 */
  importance: number;
  
  /** Timestamp when the memory was created */
  createdAt: number;
  
  /** Timestamp when the memory was last accessed */
  lastAccessedAt: number;
  
  /** Number of times this memory has been accessed */
  accessCount: number;
}

/**
 * Input for creating a new memory entry (without auto-generated fields)
 */
export type MemoryEntryInput = Omit<
  MemoryEntry,
  'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'
>;

/**
 * Memory configuration for agents
 */
export interface AgentMemoryConfig {
  /** Enable short-term memory within session */
  shortTermEnabled: boolean;
  
  /** Enable long-term memory across sessions */
  longTermEnabled: boolean;
  
  /** Maximum entries in long-term memory */
  maxLongTermEntries: number;
  
  /** Memory retrieval strategy */
  retrievalStrategy: MemoryRetrievalStrategy;
}

/**
 * Options for memory retrieval
 */
export interface MemoryRetrievalOptions {
  /** Retrieval strategy to use */
  strategy: MemoryRetrievalStrategy;
  
  /** Maximum number of memories to return */
  limit: number;
}

/**
 * Context for relevance-based retrieval
 */
export interface RetrievalContext {
  /** The query or topic to match against */
  query: string;
  
  /** Additional context fields for matching */
  [key: string]: unknown;
}

// ============================================================================
// Memory Storage Interface
// ============================================================================

/**
 * Memory storage interface for persistence
 * Allows different storage backends (localStorage, IndexedDB, etc.)
 */
export interface MemoryStorage {
  /**
   * Save a memory entry to storage
   */
  save(entry: MemoryEntry): Promise<void>;
  
  /**
   * Get all memories for a specific agent
   */
  getByAgent(agentId: string): Promise<MemoryEntry[]>;
  
  /**
   * Get all memories across all agents
   */
  getAll(): Promise<MemoryEntry[]>;
  
  /**
   * Update an existing memory entry
   */
  update(entry: MemoryEntry): Promise<void>;
  
  /**
   * Delete multiple memories by their IDs
   */
  deleteMany(ids: string[]): Promise<void>;
  
  /**
   * Clear all memories (for testing or reset)
   */
  clear(): Promise<void>;
}

// ============================================================================
// LocalStorage Memory Implementation
// ============================================================================

/**
 * LocalStorage-based memory storage for browser environments
 */
export class LocalStorageMemory implements MemoryStorage {
  private readonly KEY_PREFIX = 'agent_memory_';
  private readonly INDEX_KEY = 'agent_memory_index';
  
  /**
   * Save a memory entry to localStorage
   */
  async save(entry: MemoryEntry): Promise<void> {
    const key = this.getKey(entry.agentId);
    const existing = await this.getByAgent(entry.agentId);
    
    // Check if entry already exists (update case)
    const existingIndex = existing.findIndex(m => m.id === entry.id);
    if (existingIndex >= 0) {
      existing[existingIndex] = entry;
    } else {
      existing.push(entry);
    }
    
    this.setItem(key, existing);
    this.updateIndex(entry.agentId);
  }
  
  /**
   * Get all memories for a specific agent
   */
  async getByAgent(agentId: string): Promise<MemoryEntry[]> {
    const key = this.getKey(agentId);
    return this.getItem<MemoryEntry[]>(key) || [];
  }
  
  /**
   * Get all memories across all agents
   */
  async getAll(): Promise<MemoryEntry[]> {
    const agentIds = this.getAgentIds();
    const allMemories: MemoryEntry[] = [];
    
    for (const agentId of agentIds) {
      const memories = await this.getByAgent(agentId);
      allMemories.push(...memories);
    }
    
    return allMemories;
  }
  
  /**
   * Update an existing memory entry
   */
  async update(entry: MemoryEntry): Promise<void> {
    await this.save(entry);
  }
  
  /**
   * Delete multiple memories by their IDs
   */
  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    
    const idSet = new Set(ids);
    const agentIds = this.getAgentIds();
    
    for (const agentId of agentIds) {
      const key = this.getKey(agentId);
      const memories = await this.getByAgent(agentId);
      const filtered = memories.filter(m => !idSet.has(m.id));
      
      if (filtered.length !== memories.length) {
        if (filtered.length === 0) {
          this.removeItem(key);
          this.removeFromIndex(agentId);
        } else {
          this.setItem(key, filtered);
        }
      }
    }
  }
  
  /**
   * Clear all memories
   */
  async clear(): Promise<void> {
    const agentIds = this.getAgentIds();
    
    for (const agentId of agentIds) {
      this.removeItem(this.getKey(agentId));
    }
    
    this.removeItem(this.INDEX_KEY);
  }
  
  // Private helper methods
  
  private getKey(agentId: string): string {
    return `${this.KEY_PREFIX}${agentId}`;
  }
  
  private getItem<T>(key: string): T | null {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }
  
  private setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }
  
  private removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  }
  
  private getAgentIds(): string[] {
    return this.getItem<string[]>(this.INDEX_KEY) || [];
  }
  
  private updateIndex(agentId: string): void {
    const agentIds = this.getAgentIds();
    if (!agentIds.includes(agentId)) {
      agentIds.push(agentId);
      this.setItem(this.INDEX_KEY, agentIds);
    }
  }
  
  private removeFromIndex(agentId: string): void {
    const agentIds = this.getAgentIds();
    const filtered = agentIds.filter(id => id !== agentId);
    this.setItem(this.INDEX_KEY, filtered);
  }
}

// ============================================================================
// In-Memory Storage Implementation (for testing)
// ============================================================================

/**
 * In-memory storage implementation for testing
 */
export class InMemoryStorage implements MemoryStorage {
  private memories: Map<string, MemoryEntry[]> = new Map();
  
  async save(entry: MemoryEntry): Promise<void> {
    const existing = this.memories.get(entry.agentId) || [];
    const existingIndex = existing.findIndex(m => m.id === entry.id);
    
    if (existingIndex >= 0) {
      existing[existingIndex] = entry;
    } else {
      existing.push(entry);
    }
    
    this.memories.set(entry.agentId, existing);
  }
  
  async getByAgent(agentId: string): Promise<MemoryEntry[]> {
    return [...(this.memories.get(agentId) || [])];
  }
  
  async getAll(): Promise<MemoryEntry[]> {
    const all: MemoryEntry[] = [];
    const values = Array.from(this.memories.values());
    for (const memories of values) {
      all.push(...memories);
    }
    return all;
  }
  
  async update(entry: MemoryEntry): Promise<void> {
    await this.save(entry);
  }
  
  async deleteMany(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    
    const entries = Array.from(this.memories.entries());
    for (const [agentId, memories] of entries) {
      const filtered = memories.filter((m: MemoryEntry) => !idSet.has(m.id));
      if (filtered.length === 0) {
        this.memories.delete(agentId);
      } else {
        this.memories.set(agentId, filtered);
      }
    }
  }
  
  async clear(): Promise<void> {
    this.memories.clear();
  }
}

// ============================================================================
// Agent Memory Manager
// ============================================================================

/**
 * Manages long-term memory for agents across sessions
 * Inspired by Agno's enable_agentic_memory feature
 * 
 * Features:
 * - Store insights, patterns, decisions, and outcomes
 * - Retrieve memories using recency, relevance, or hybrid strategies
 * - Automatic pruning of low-importance memories
 * - Cross-session persistence via configurable storage backend
 */
export class AgentMemoryManager {
  private storage: MemoryStorage;
  
  constructor(storage?: MemoryStorage) {
    this.storage = storage || new LocalStorageMemory();
  }
  
  /**
   * Store a new memory entry
   * 
   * @param entry - Memory entry data (without auto-generated fields)
   * @returns The complete memory entry with generated ID and timestamps
   */
  async store(entry: MemoryEntryInput): Promise<MemoryEntry> {
    // Validate importance is within bounds
    const importance = Math.max(0, Math.min(1, entry.importance));
    
    const fullEntry: MemoryEntry = {
      ...entry,
      importance,
      id: this.generateId(),
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
    };
    
    await this.storage.save(fullEntry);
    return fullEntry;
  }
  
  /**
   * Retrieve relevant memories for a given context
   * 
   * @param agentId - The agent to retrieve memories for
   * @param context - Context for relevance-based retrieval
   * @param options - Retrieval options (strategy and limit)
   * @returns Array of relevant memory entries
   */
  async retrieve(
    agentId: string,
    context: RetrievalContext,
    options: MemoryRetrievalOptions
  ): Promise<MemoryEntry[]> {
    const allMemories = await this.storage.getByAgent(agentId);
    
    if (allMemories.length === 0) {
      return [];
    }
    
    let result: MemoryEntry[];
    
    switch (options.strategy) {
      case 'recency':
        result = this.retrieveByRecency(allMemories, options.limit);
        break;
      case 'relevance':
        result = this.retrieveByRelevance(allMemories, context, options.limit);
        break;
      case 'hybrid':
        result = this.retrieveHybrid(allMemories, context, options.limit);
        break;
      default:
        result = this.retrieveByRecency(allMemories, options.limit);
    }
    
    // Update access metadata for retrieved memories
    await this.updateAccessMetadata(result);
    
    return result;
  }
  
  /**
   * Prune old/low-importance memories to stay within limits
   * 
   * @param agentId - The agent to prune memories for
   * @param maxEntries - Maximum number of entries to keep
   * @returns Number of entries deleted
   */
  async prune(agentId: string, maxEntries: number): Promise<number> {
    const memories = await this.storage.getByAgent(agentId);
    
    if (memories.length <= maxEntries) {
      return 0;
    }
    
    // Score memories by importance * recency decay
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const decayPeriod = 30 * dayMs; // 30-day decay period
    
    const scored = memories.map(m => ({
      memory: m,
      score: this.calculatePruneScore(m, now, decayPeriod),
    }));
    
    // Sort by score descending (higher score = keep)
    scored.sort((a, b) => b.score - a.score);
    
    // Delete entries beyond maxEntries
    const toDelete = scored.slice(maxEntries).map(s => s.memory.id);
    await this.storage.deleteMany(toDelete);
    
    return toDelete.length;
  }
  
  /**
   * Get all memories for an agent (for debugging/export)
   */
  async getAllForAgent(agentId: string): Promise<MemoryEntry[]> {
    return this.storage.getByAgent(agentId);
  }
  
  /**
   * Get all memories across all agents (for state persistence)
   */
  async getAll(): Promise<MemoryEntry[]> {
    return this.storage.getAll();
  }
  
  /**
   * Clear all memories for an agent
   */
  async clearAgent(agentId: string): Promise<void> {
    const memories = await this.storage.getByAgent(agentId);
    const ids = memories.map(m => m.id);
    await this.storage.deleteMany(ids);
  }
  
  /**
   * Clear all memories (for testing or reset)
   */
  async clearAll(): Promise<void> {
    await this.storage.clear();
  }
  
  /**
   * Import memories from a state snapshot (for state restoration)
   */
  async importMemories(memories: MemoryEntry[]): Promise<void> {
    for (const memory of memories) {
      await this.storage.save(memory);
    }
  }
  
  /**
   * Export memories for state persistence
   */
  async exportMemories(): Promise<Map<string, MemoryEntry[]>> {
    const all = await this.storage.getAll();
    const byAgent = new Map<string, MemoryEntry[]>();
    
    for (const memory of all) {
      const existing = byAgent.get(memory.agentId) || [];
      existing.push(memory);
      byAgent.set(memory.agentId, existing);
    }
    
    return byAgent;
  }
  
  // ============================================================================
  // Private Methods - Retrieval Strategies
  // ============================================================================
  
  /**
   * Retrieve memories by recency (most recent first)
   */
  private retrieveByRecency(memories: MemoryEntry[], limit: number): MemoryEntry[] {
    return [...memories]
      .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
      .slice(0, limit);
  }
  
  /**
   * Retrieve memories by relevance to current context
   * Uses keyword matching (could be enhanced with embeddings)
   */
  private retrieveByRelevance(
    memories: MemoryEntry[],
    context: RetrievalContext,
    limit: number
  ): MemoryEntry[] {
    const queryTerms = this.extractKeyTerms(context.query);
    
    if (queryTerms.length === 0) {
      // Fall back to recency if no query terms
      return this.retrieveByRecency(memories, limit);
    }
    
    const scored = memories.map(m => ({
      memory: m,
      score: this.calculateRelevanceScore(m, queryTerms, context),
    }));
    
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.memory);
  }
  
  /**
   * Hybrid retrieval: combine recency, relevance, and importance
   */
  private retrieveHybrid(
    memories: MemoryEntry[],
    context: RetrievalContext,
    limit: number
  ): MemoryEntry[] {
    const queryTerms = this.extractKeyTerms(context.query);
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const decayPeriod = 7 * dayMs; // 7-day decay for recency
    
    const scored = memories.map(m => {
      const relevanceScore = this.calculateRelevanceScore(m, queryTerms, context);
      const recencyScore = Math.exp(-(now - m.lastAccessedAt) / decayPeriod);
      const importanceScore = m.importance;
      
      // Weighted combination: 50% relevance, 30% recency, 20% importance
      const finalScore = 
        0.5 * relevanceScore + 
        0.3 * recencyScore + 
        0.2 * importanceScore;
      
      return { memory: m, score: finalScore };
    });
    
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.memory);
  }
  
  // ============================================================================
  // Private Methods - Scoring and Utilities
  // ============================================================================
  
  /**
   * Calculate relevance score for a memory based on query terms
   */
  private calculateRelevanceScore(
    memory: MemoryEntry,
    queryTerms: string[],
    context: RetrievalContext
  ): number {
    if (queryTerms.length === 0) {
      return 0;
    }
    
    const contentLower = memory.content.toLowerCase();
    const contextStr = JSON.stringify(memory.context).toLowerCase();
    
    let matchCount = 0;
    for (const term of queryTerms) {
      const termLower = term.toLowerCase();
      if (contentLower.includes(termLower) || contextStr.includes(termLower)) {
        matchCount++;
      }
    }
    
    // Normalize by query term count
    return matchCount / queryTerms.length;
  }
  
  /**
   * Calculate prune score (higher = more likely to keep)
   */
  private calculatePruneScore(
    memory: MemoryEntry,
    now: number,
    decayPeriod: number
  ): number {
    const recencyFactor = Math.exp(-(now - memory.lastAccessedAt) / decayPeriod);
    const accessFactor = Math.min(1, memory.accessCount / 10); // Cap at 10 accesses
    
    // Weighted: 50% importance, 30% recency, 20% access frequency
    return (
      0.5 * memory.importance +
      0.3 * recencyFactor +
      0.2 * accessFactor
    );
  }
  
  /**
   * Extract key terms from query for relevance matching
   */
  private extractKeyTerms(query: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'my', 'i', 'me', 'we', 'you', 'your', 'our',
      'what', 'how', 'why', 'when', 'where', 'which', 'who',
      'do', 'does', 'did', 'have', 'has', 'had',
      'to', 'of', 'in', 'on', 'at', 'for', 'with', 'by',
      'and', 'or', 'but', 'if', 'then', 'so', 'as',
      'this', 'that', 'these', 'those', 'it', 'its',
    ]);
    
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }
  
  /**
   * Update access metadata for retrieved memories
   */
  private async updateAccessMetadata(memories: MemoryEntry[]): Promise<void> {
    const now = Date.now();
    
    for (const memory of memories) {
      const updated: MemoryEntry = {
        ...memory,
        lastAccessedAt: now,
        accessCount: memory.accessCount + 1,
      };
      await this.storage.update(updated);
    }
  }
  
  /**
   * Generate a unique ID for a memory entry
   */
  private generateId(): string {
    // Use crypto.randomUUID if available, otherwise fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback for environments without crypto.randomUUID
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

// ============================================================================
// Default Export and Factory
// ============================================================================

/**
 * Create a memory manager with default localStorage backend
 */
export function createMemoryManager(storage?: MemoryStorage): AgentMemoryManager {
  return new AgentMemoryManager(storage);
}

/**
 * Default memory configuration
 */
export const DEFAULT_MEMORY_CONFIG: AgentMemoryConfig = {
  shortTermEnabled: true,
  longTermEnabled: true,
  maxLongTermEntries: 100,
  retrievalStrategy: 'hybrid',
};

export default AgentMemoryManager;
