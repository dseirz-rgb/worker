/**
 * State Persistence Manager for Multi-Agent Orchestration System
 *
 * Implements state persistence functionality for saving and restoring
 * orchestrator state across sessions. Supports multiple storage backends.
 *
 * @module agents/stateManager
 * @see {@link .kiro/specs/multi-agent-analysis/requirements.md} - Requirements 1.1.4, 1.1.5
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} - Section 6.2 State Persistence
 */

import type {
  OrchestratorState,
  AgentState,
  CacheState,
  MemoryEntry,
  OrchestrationMode,
} from './types';

// =============================================================================
// Storage Interface
// =============================================================================

/**
 * Interface for state storage backends.
 * Allows different storage implementations (localStorage, IndexedDB, etc.)
 */
export interface StateStorage {
  /**
   * Save state data to storage.
   *
   * @param key - Storage key
   * @param data - Data to store (will be serialized)
   * @returns Promise that resolves when save is complete
   */
  save(key: string, data: unknown): Promise<void>;

  /**
   * Load state data from storage.
   *
   * @param key - Storage key
   * @returns Promise with the stored data, or null if not found
   */
  load<T>(key: string): Promise<T | null>;

  /**
   * Remove state data from storage.
   *
   * @param key - Storage key
   * @returns Promise that resolves when removal is complete
   */
  remove(key: string): Promise<void>;

  /**
   * Check if storage is available.
   *
   * @returns True if storage is available and functional
   */
  isAvailable(): boolean;
}

// =============================================================================
// LocalStorage Implementation
// =============================================================================

/**
 * LocalStorage-based state storage for browser environments.
 * Provides persistent storage across browser sessions.
 *
 * @example
 * ```typescript
 * const storage = new LocalStorageStateStorage();
 * await storage.save('orchestrator_state', state);
 * const loaded = await storage.load<OrchestratorState>('orchestrator_state');
 * ```
 */
export class LocalStorageStateStorage implements StateStorage {
  /** Prefix for all storage keys to avoid collisions */
  private readonly keyPrefix: string;

  /**
   * Create a new LocalStorageStateStorage instance.
   *
   * @param keyPrefix - Prefix for storage keys (default: 'agent_state_')
   */
  constructor(keyPrefix: string = 'agent_state_') {
    this.keyPrefix = keyPrefix;
  }

  /**
   * Save state data to localStorage.
   *
   * @param key - Storage key (will be prefixed)
   * @param data - Data to store
   * @throws Error if localStorage is not available or quota exceeded
   */
  async save(key: string, data: unknown): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('LocalStorage is not available');
    }

    try {
      const serialized = this.serialize(data);
      localStorage.setItem(this.getFullKey(key), serialized);
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('LocalStorage quota exceeded, attempting cleanup...');
        this.cleanupOldEntries();
        // Retry once after cleanup
        const serialized = this.serialize(data);
        localStorage.setItem(this.getFullKey(key), serialized);
      } else {
        throw error;
      }
    }
  }

  /**
   * Load state data from localStorage.
   *
   * @param key - Storage key (will be prefixed)
   * @returns Deserialized data or null if not found
   */
  async load<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const serialized = localStorage.getItem(this.getFullKey(key));
      if (serialized === null) {
        return null;
      }
      return this.deserialize<T>(serialized);
    } catch (error) {
      console.warn(`Failed to load state for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove state data from localStorage.
   *
   * @param key - Storage key (will be prefixed)
   */
  async remove(key: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      localStorage.removeItem(this.getFullKey(key));
    } catch (error) {
      console.warn(`Failed to remove state for key ${key}:`, error);
    }
  }

  /**
   * Check if localStorage is available.
   *
   * @returns True if localStorage is available and functional
   */
  isAvailable(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the full storage key with prefix.
   *
   * @param key - Base key
   * @returns Full key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Serialize data for storage.
   * Handles Map objects by converting to arrays.
   *
   * @param data - Data to serialize
   * @returns JSON string
   */
  private serialize(data: unknown): string {
    return JSON.stringify(data, (key, value) => {
      // Convert Map to array of entries for JSON serialization
      if (value instanceof Map) {
        return {
          __type: 'Map',
          entries: Array.from(value.entries()),
        };
      }
      return value;
    });
  }

  /**
   * Deserialize data from storage.
   * Handles Map objects by converting from arrays.
   *
   * @param serialized - JSON string
   * @returns Deserialized data
   */
  private deserialize<T>(serialized: string): T {
    return JSON.parse(serialized, (key, value) => {
      // Convert array of entries back to Map
      if (value && typeof value === 'object' && value.__type === 'Map') {
        return new Map(value.entries);
      }
      return value;
    });
  }

  /**
   * Clean up old entries when quota is exceeded.
   * Removes entries older than 7 days.
   */
  private cleanupOldEntries(): void {
    const keysToRemove: string[] = [];
    const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.keyPrefix)) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed.timestamp && parsed.timestamp < cutoffTime) {
              keysToRemove.push(key);
            }
          }
        } catch {
          // If we can't parse it, consider it for removal
          keysToRemove.push(key);
        }
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }
}

// =============================================================================
// In-Memory Storage Implementation (for testing)
// =============================================================================

/**
 * In-memory state storage for testing purposes.
 * Data is lost when the instance is destroyed.
 *
 * @example
 * ```typescript
 * const storage = new InMemoryStateStorage();
 * const stateManager = new StateManager(storage);
 * // Use for testing without affecting localStorage
 * ```
 */
export class InMemoryStateStorage implements StateStorage {
  /** Internal storage map */
  private storage: Map<string, string> = new Map();

  /**
   * Save state data to memory.
   *
   * @param key - Storage key
   * @param data - Data to store
   */
  async save(key: string, data: unknown): Promise<void> {
    const serialized = JSON.stringify(data, (_, value) => {
      if (value instanceof Map) {
        return {
          __type: 'Map',
          entries: Array.from(value.entries()),
        };
      }
      return value;
    });
    this.storage.set(key, serialized);
  }

  /**
   * Load state data from memory.
   *
   * @param key - Storage key
   * @returns Deserialized data or null if not found
   */
  async load<T>(key: string): Promise<T | null> {
    const serialized = this.storage.get(key);
    if (serialized === undefined) {
      return null;
    }
    return JSON.parse(serialized, (_, value) => {
      if (value && typeof value === 'object' && value.__type === 'Map') {
        return new Map(value.entries);
      }
      return value;
    });
  }

  /**
   * Remove state data from memory.
   *
   * @param key - Storage key
   */
  async remove(key: string): Promise<void> {
    this.storage.delete(key);
  }

  /**
   * Check if storage is available (always true for in-memory).
   *
   * @returns Always true
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Clear all stored data (useful for test cleanup).
   */
  clear(): void {
    this.storage.clear();
  }

  /**
   * Get the number of stored entries (useful for testing).
   *
   * @returns Number of entries
   */
  size(): number {
    return this.storage.size;
  }
}

// =============================================================================
// State Manager
// =============================================================================

/** Default storage key for orchestrator state */
const DEFAULT_STATE_KEY = 'orchestrator_state';

/**
 * Manages state persistence for the multi-agent orchestration system.
 * Provides methods to save, load, and clear orchestrator state.
 *
 * @example
 * ```typescript
 * // Create with default localStorage backend
 * const stateManager = new StateManager();
 *
 * // Save orchestrator state
 * await stateManager.saveState(orchestratorState);
 *
 * // Load state on startup
 * const savedState = await stateManager.loadState();
 * if (savedState) {
 *   orchestrator.restoreState(savedState);
 * }
 *
 * // Clear state when done
 * await stateManager.clearState();
 * ```
 *
 * @see Requirements 1.1.4, 1.1.5
 */
export class StateManager {
  /** Storage backend */
  private storage: StateStorage;

  /** Storage key for the state */
  private stateKey: string;

  /**
   * Create a new StateManager instance.
   *
   * @param storage - Storage backend (default: LocalStorageStateStorage)
   * @param stateKey - Key for storing state (default: 'orchestrator_state')
   */
  constructor(
    storage?: StateStorage,
    stateKey: string = DEFAULT_STATE_KEY
  ) {
    this.storage = storage || new LocalStorageStateStorage();
    this.stateKey = stateKey;
  }

  /**
   * Save the complete orchestrator state.
   *
   * Serializes and persists the orchestrator state including:
   * - Current orchestration mode
   * - All agent states
   * - Cache state
   * - Memory state
   *
   * @param state - The orchestrator state to save
   * @throws Error if storage is not available or save fails
   *
   * @example
   * ```typescript
   * const state: OrchestratorState = {
   *   mode: 'sequential',
   *   agentStates: new Map([['advisor', agentState]]),
   *   cacheState: { entries: [], timestamp: Date.now() },
   *   timestamp: Date.now(),
   *   memoryState: new Map()
   * };
   * await stateManager.saveState(state);
   * ```
   */
  async saveState(state: OrchestratorState): Promise<void> {
    if (!this.storage.isAvailable()) {
      throw new Error('State storage is not available');
    }

    // Validate state before saving
    this.validateState(state);

    // Add/update timestamp
    const stateToSave: OrchestratorState = {
      ...state,
      timestamp: Date.now(),
    };

    await this.storage.save(this.stateKey, stateToSave);
  }

  /**
   * Load the saved orchestrator state.
   *
   * Retrieves and deserializes the previously saved state.
   * Returns null if no state is found or if the state is invalid.
   *
   * @returns The saved orchestrator state, or null if not found
   *
   * @example
   * ```typescript
   * const savedState = await stateManager.loadState();
   * if (savedState) {
   *   console.log(`Loaded state from ${new Date(savedState.timestamp)}`);
   *   orchestrator.restoreState(savedState);
   * }
   * ```
   */
  async loadState(): Promise<OrchestratorState | null> {
    if (!this.storage.isAvailable()) {
      return null;
    }

    const state = await this.storage.load<OrchestratorState>(this.stateKey);

    if (state === null) {
      return null;
    }

    // Validate loaded state
    if (!this.isValidState(state)) {
      console.warn('Loaded state is invalid, returning null');
      return null;
    }

    // Check if state is too old (older than 24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - state.timestamp > maxAge) {
      console.warn('Loaded state is too old, returning null');
      return null;
    }

    return state;
  }

  /**
   * Clear the saved orchestrator state.
   *
   * Removes the persisted state from storage.
   *
   * @example
   * ```typescript
   * // Clear state after successful completion
   * await stateManager.clearState();
   * ```
   */
  async clearState(): Promise<void> {
    await this.storage.remove(this.stateKey);
  }

  /**
   * Check if there is a saved state available.
   *
   * @returns True if a valid state exists in storage
   *
   * @example
   * ```typescript
   * if (await stateManager.hasState()) {
   *   const state = await stateManager.loadState();
   *   // Resume from saved state
   * }
   * ```
   */
  async hasState(): Promise<boolean> {
    const state = await this.loadState();
    return state !== null;
  }

  /**
   * Get the timestamp of the saved state without loading the full state.
   *
   * @returns Timestamp of the saved state, or null if no state exists
   */
  async getStateTimestamp(): Promise<number | null> {
    const state = await this.storage.load<OrchestratorState>(this.stateKey);
    return state?.timestamp ?? null;
  }

  /**
   * Validate state before saving.
   *
   * @param state - State to validate
   * @throws Error if state is invalid
   */
  private validateState(state: OrchestratorState): void {
    if (!state) {
      throw new Error('State cannot be null or undefined');
    }

    if (!state.mode) {
      throw new Error('State must have a mode');
    }

    if (!(state.agentStates instanceof Map)) {
      throw new Error('State agentStates must be a Map');
    }

    if (!state.cacheState || typeof state.cacheState !== 'object') {
      throw new Error('State must have a valid cacheState');
    }
  }

  /**
   * Check if a loaded state is valid.
   *
   * @param state - State to check
   * @returns True if state is valid
   */
  private isValidState(state: unknown): state is OrchestratorState {
    if (!state || typeof state !== 'object') {
      return false;
    }

    const s = state as Partial<OrchestratorState>;

    // Check required fields
    if (!s.mode || !s.agentStates || !s.cacheState || !s.timestamp) {
      return false;
    }

    // Check mode is valid
    const validModes: OrchestrationMode[] = [
      'sequential',
      'selector',
      'handoff',
      'respond_directly',
    ];
    if (!validModes.includes(s.mode)) {
      return false;
    }

    // Check agentStates is a Map
    if (!(s.agentStates instanceof Map)) {
      return false;
    }

    // Check timestamp is a valid number
    if (typeof s.timestamp !== 'number' || isNaN(s.timestamp)) {
      return false;
    }

    return true;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a StateManager with localStorage backend.
 *
 * @param stateKey - Optional custom storage key
 * @returns StateManager instance
 *
 * @example
 * ```typescript
 * const stateManager = createStateManager();
 * await stateManager.saveState(state);
 * ```
 */
export function createStateManager(stateKey?: string): StateManager {
  return new StateManager(new LocalStorageStateStorage(), stateKey);
}

/**
 * Create a StateManager with in-memory backend (for testing).
 *
 * @param stateKey - Optional custom storage key
 * @returns StateManager instance with in-memory storage
 *
 * @example
 * ```typescript
 * const stateManager = createInMemoryStateManager();
 * // Use for testing without affecting localStorage
 * ```
 */
export function createInMemoryStateManager(stateKey?: string): StateManager {
  return new StateManager(new InMemoryStateStorage(), stateKey);
}

// =============================================================================
// Helper Functions for State Creation
// =============================================================================

/**
 * Create an empty orchestrator state.
 *
 * @param mode - Orchestration mode (default: 'sequential')
 * @returns Empty OrchestratorState
 *
 * @example
 * ```typescript
 * const state = createEmptyOrchestratorState('selector');
 * ```
 */
export function createEmptyOrchestratorState(
  mode: OrchestrationMode = 'sequential'
): OrchestratorState {
  return {
    mode,
    agentStates: new Map<string, AgentState>(),
    cacheState: createEmptyCacheState(),
    timestamp: Date.now(),
    memoryState: new Map<string, MemoryEntry[]>(),
  };
}

/**
 * Create an empty cache state.
 *
 * @returns Empty CacheState
 */
export function createEmptyCacheState(): CacheState {
  return {
    entries: [],
    timestamp: Date.now(),
  };
}

/**
 * Create an agent state from current agent data.
 *
 * @param agentId - Agent identifier
 * @param internalState - Agent's internal state data
 * @returns AgentState object
 *
 * @example
 * ```typescript
 * const agentState = createAgentState('advisor', {
 *   lastAnalyzedTickers: ['AAPL', 'GOOGL'],
 *   analysisCount: 5
 * });
 * ```
 */
export function createAgentState(
  agentId: string,
  internalState: Record<string, unknown> = {}
): AgentState {
  return {
    agentId,
    timestamp: Date.now(),
    internalState,
    messageHistory: [],
  };
}

// =============================================================================
// Default Export
// =============================================================================

export default StateManager;
