/**
 * SeekDB 服务客户端
 * 封装与 Python Sidecar 的通信
 */

const SIDECAR_URL = 'http://localhost:8765';

// ============== 类型定义 ==============

export interface NoteCreate {
  id: string;
  content: string;
  domain: string;
  tags: string[];
  createdAt: string;
}

export interface NoteUpdate {
  content?: string;
  domain?: string;
  tags?: string[];
}

export interface NoteResponse {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface TaskCreate {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  deadline?: string;
  domain: string;
  createdAt: string;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  deadline?: string;
  domain?: string;
  completedAt?: string;
}

export interface MemoryCreate {
  id: string;
  content: string;
  userId: string;
  source: string;
  sourceId?: string;
  category: string;
  domain: string;
  createdAt: string;
}

export interface SearchParams {
  query: string;
  collection?: string;
  limit?: number;
  domain?: string;
  searchType?: 'vector' | 'fulltext' | 'hybrid';
}

/** 向量查询参数 (Blinko 兼容) */
export interface VectorQueryParams {
  indexName: string;
  queryVector: number[];
  topK: number;
  filter?: Record<string, unknown>;
}

/** 向量 Upsert 参数 (Blinko 兼容) */
export interface VectorUpsertParams {
  indexName: string;
  vectors: number[][];
  metadata: Array<Record<string, unknown>>;
  ids?: string[];
}

/** 创建索引参数 */
export interface CreateIndexParams {
  indexName: string;
  dimension: number;
  metric?: 'cosine' | 'l2' | 'ip';
}

/** 删除索引参数 */
export interface DeleteIndexParams {
  indexName: string;
}

/** 清空索引参数 */
export interface TruncateIndexParams {
  indexName: string;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface HealthResponse {
  status: string;
  database: string;
  collections: string[];
}

// ============== SeekDB 服务类 ==============

export class SeekDBService {
  private baseUrl: string;

  constructor(baseUrl: string = SIDECAR_URL) {
    this.baseUrl = baseUrl;
  }

  // ============== 健康检查 ==============

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 获取健康状态详情
   */
  async getHealth(): Promise<HealthResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  // ============== Notes API ==============

  /**
   * 创建笔记
   */
  async createNote(note: NoteCreate): Promise<{ id: string; status: string }> {
    const response = await fetch(`${this.baseUrl}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: note.id,
        content: note.content,
        domain: note.domain,
        tags: note.tags,
        created_at: note.createdAt,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`创建笔记失败: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * 获取笔记
   */
  async getNote(noteId: string): Promise<NoteResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/notes/${noteId}`);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  /**
   * 列出所有笔记
   */
  async listNotes(limit = 100, domain?: string): Promise<NoteResponse[]> {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (domain) params.append('domain', domain);
      
      const response = await fetch(`${this.baseUrl}/notes?${params}`);
      if (!response.ok) return [];
      return response.json();
    } catch {
      return [];
    }
  }

  /**
   * 更新笔记
   */
  async updateNote(
    noteId: string,
    updates: NoteUpdate
  ): Promise<{ id: string; status: string }> {
    const response = await fetch(`${this.baseUrl}/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      throw new Error(`更新笔记失败: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * 删除笔记
   */
  async deleteNote(noteId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/notes/${noteId}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ============== Tasks API ==============

  /**
   * 创建任务
   */
  async createTask(task: TaskCreate): Promise<{ id: string; status: string }> {
    const response = await fetch(`${this.baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        deadline: task.deadline,
        domain: task.domain,
        created_at: task.createdAt,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`创建任务失败: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * 获取任务
   */
  async getTask(taskId: string): Promise<NoteResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/tasks/${taskId}`);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  /**
   * 列出所有任务
   */
  async listTasks(limit = 100, status?: string): Promise<NoteResponse[]> {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (status) params.append('status', status);
      
      const response = await fetch(`${this.baseUrl}/tasks?${params}`);
      if (!response.ok) return [];
      return response.json();
    } catch {
      return [];
    }
  }

  /**
   * 更新任务
   */
  async updateTask(
    taskId: string,
    updates: TaskUpdate
  ): Promise<{ id: string; status: string }> {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: updates.title,
        description: updates.description,
        priority: updates.priority,
        status: updates.status,
        deadline: updates.deadline,
        domain: updates.domain,
        completed_at: updates.completedAt,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`更新任务失败: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/tasks/${taskId}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ============== Memories API ==============

  /**
   * 创建记忆
   */
  async createMemory(memory: MemoryCreate): Promise<{ id: string; status: string }> {
    const response = await fetch(`${this.baseUrl}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: memory.id,
        content: memory.content,
        user_id: memory.userId,
        source: memory.source,
        source_id: memory.sourceId,
        category: memory.category,
        domain: memory.domain,
        created_at: memory.createdAt,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`创建记忆失败: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * 获取记忆
   */
  async getMemory(memoryId: string): Promise<NoteResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/memories/${memoryId}`);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  /**
   * 列出记忆
   */
  async listMemories(
    limit = 100,
    userId?: string,
    domain?: string
  ): Promise<NoteResponse[]> {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (userId) params.append('user_id', userId);
      if (domain) params.append('domain', domain);
      
      const response = await fetch(`${this.baseUrl}/memories?${params}`);
      if (!response.ok) return [];
      return response.json();
    } catch {
      return [];
    }
  }

  /**
   * 删除记忆
   */
  async deleteMemory(memoryId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/memories/${memoryId}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ============== 搜索 API ==============

  /**
   * 搜索
   */
  async search(params: SearchParams): Promise<SearchResult[]> {
    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: params.query,
          collection: params.collection || 'notes',
          limit: params.limit || 10,
          domain: params.domain,
          search_type: params.searchType || 'hybrid',
        }),
      });
      
      if (!response.ok) return [];
      return response.json();
    } catch {
      return [];
    }
  }

  /**
   * 向量搜索
   */
  async vectorSearch(params: SearchParams): Promise<SearchResult[]> {
    return this.search({ ...params, searchType: 'vector' });
  }

  /**
   * 全文搜索
   */
  async fulltextSearch(params: SearchParams): Promise<SearchResult[]> {
    return this.search({ ...params, searchType: 'fulltext' });
  }

  /**
   * 混合搜索
   */
  async hybridSearch(params: SearchParams): Promise<SearchResult[]> {
    return this.search({ ...params, searchType: 'hybrid' });
  }

  // ============== 导入导出 API ==============

  /**
   * 导出数据
   */
  async exportData(): Promise<Record<string, unknown[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/export`);
      if (!response.ok) return {};
      return response.json();
    } catch {
      return {};
    }
  }

  /**
   * 导入数据
   */
  async importData(data: Record<string, unknown[]>): Promise<{ imported: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) return { imported: 0 };
      return response.json();
    } catch {
      return { imported: 0 };
    }
  }

  // ============== Collections API ==============

  /**
   * 列出所有集合
   */
  async listCollections(): Promise<Array<{ name: string; count: number }>> {
    try {
      const response = await fetch(`${this.baseUrl}/collections`);
      if (!response.ok) return [];
      return response.json();
    } catch {
      return [];
    }
  }

  // ============== Blinko 兼容向量 API ==============

  /**
   * 创建向量索引 (Blinko 兼容)
   */
  async createIndex(params: CreateIndexParams): Promise<{ status: string; indexName: string }> {
    const response = await fetch(`${this.baseUrl}/vector/index/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        index_name: params.indexName,
        dimension: params.dimension,
        metric: params.metric || 'cosine',
      }),
    });
    
    if (!response.ok) {
      throw new Error(`创建索引失败: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * 删除向量索引 (Blinko 兼容)
   */
  async deleteIndex(params: DeleteIndexParams): Promise<{ status: string; indexName: string }> {
    const response = await fetch(`${this.baseUrl}/vector/index/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        index_name: params.indexName,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`删除索引失败: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * 清空向量索引 (Blinko 兼容)
   */
  async truncateIndex(params: TruncateIndexParams): Promise<{ status: string; indexName: string; deletedCount: number }> {
    const response = await fetch(`${this.baseUrl}/vector/index/truncate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        index_name: params.indexName,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`清空索引失败: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * 向量 Upsert (Blinko 兼容)
   */
  async vectorUpsert(params: VectorUpsertParams): Promise<{ status: string; inserted: number; updated: number }> {
    const response = await fetch(`${this.baseUrl}/vector/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        index_name: params.indexName,
        vectors: params.vectors,
        metadata: params.metadata,
        ids: params.ids,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Upsert 失败: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * 向量查询 (Blinko 兼容)
   */
  async vectorQuery(params: VectorQueryParams): Promise<SearchResult[]> {
    try {
      const response = await fetch(`${this.baseUrl}/vector/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          index_name: params.indexName,
          query_vector: params.queryVector,
          top_k: params.topK,
          filter: params.filter,
        }),
      });
      
      if (!response.ok) return [];
      return response.json();
    } catch {
      return [];
    }
  }

  /**
   * 删除向量 (Blinko 兼容)
   */
  async vectorDelete(indexName: string, ids: string[]): Promise<{ status: string; count: number }> {
    const response = await fetch(`${this.baseUrl}/vector/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids),
    });
    
    if (!response.ok) {
      throw new Error(`删除向量失败: ${response.statusText}`);
    }
    return response.json();
  }
}

// 单例导出
export const seekdbService = new SeekDBService();
