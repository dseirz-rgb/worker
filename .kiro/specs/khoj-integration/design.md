# Design Document - Khoj 集成

## Overview

本设计文档描述将 Khoj 作为知识检索后端集成到 Echo 应用的技术方案，同时将 Khoj 的前端功能有机融合进 Echo 的 UI。

### 设计原则

1. **双引擎架构** - Echo 本地数据 + Khoj 知识库并行
2. **统一体验** - Khoj 功能无缝融入 Echo UI
3. **优雅降级** - Khoj 不可用时自动回退到本地模式
4. **渐进增强** - 核心功能不依赖 Khoj，Khoj 提供增强能力

### 技术选型

| 组件 | 技术 | 理由 |
|------|------|------|
| Khoj 服务 | Self-hosted Docker | 本地部署，数据隐私 |
| API 通信 | REST API | Khoj 原生支持 |
| 状态管理 | React Query | 缓存、重试、离线支持 |
| 同步策略 | 增量同步 | 减少网络开销 |

---

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Echo Application                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Echo Frontend (React)                     │    │
│  │                                                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │    │
│  │  │  Chat UI     │  │  Search UI   │  │ Knowledge UI │       │    │
│  │  │  (统一对话)  │  │  (统一搜索)  │  │ (知识管理)   │       │    │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │    │
│  │         │                 │                 │                │    │
│  │         └─────────────────┼─────────────────┘                │    │
│  │                           │                                  │    │
│  │  ┌────────────────────────▼────────────────────────────┐    │    │
│  │  │              Unified Service Layer                   │    │    │
│  │  │                                                      │    │    │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │    │
│  │  │  │ Chat Service│  │Search Service│ │ Sync Service│  │    │    │
│  │  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │    │    │
│  │  │         │                │                │          │    │    │
│  │  └─────────┼────────────────┼────────────────┼──────────┘    │    │
│  │            │                │                │               │    │
│  └────────────┼────────────────┼────────────────┼───────────────┘    │
│               │                │                │                    │
│  ┌────────────▼────────────────▼────────────────▼───────────────┐   │
│  │                    Khoj Client Service                        │   │
│  │                                                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │   │
│  │  │  /api/chat  │  │ /api/search │  │ /api/index  │           │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘           │   │
│  │                                                               │   │
│  └───────────────────────────┬───────────────────────────────────┘   │
│                              │ HTTP                                  │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────────┐
│                      Khoj Server (Docker)                            │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │  Django Backend │  │  PostgreSQL     │  │  Vector Store   │      │
│  │  (API Server)   │  │  (Metadata)     │  │  (Embeddings)   │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
│                                                                      │
│  http://localhost:42110                                              │
└──────────────────────────────────────────────────────────────────────┘
```


### 数据流

```
用户操作 (搜索/对话/创建笔记)
         │
         ▼
┌─────────────────┐
│  Echo Frontend  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Unified Service │────►│  Local Storage  │
│    Layer        │     │  (SQLite/SeekDB)│
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Khoj Client    │
│  Service        │
└────────┬────────┘
         │ HTTP REST
         ▼
┌─────────────────┐
│  Khoj Server    │
│                 │
│  1. 语义搜索    │
│  2. RAG 对话    │
│  3. 文档索引    │
│  4. Agent 管理  │
└─────────────────┘
```

---

## Components and Interfaces

### 1. Khoj Client Service

```typescript
// services/khoj/khojClient.ts

const DEFAULT_KHOJ_URL = 'http://localhost:42110';

/**
 * Khoj 配置接口
 */
export interface KhojConfig {
  baseUrl: string;
  apiKey?: string;
  username?: string;
  timeout?: number;
}

/**
 * Khoj 搜索结果
 */
export interface KhojSearchResult {
  entry: string;
  score: number;
  file: string;
  compiled: string;
  additional: {
    file: string;
    heading?: string;
  };
}

/**
 * Khoj 对话消息
 */
export interface KhojChatMessage {
  role: 'user' | 'assistant' | 'khoj';
  message: string;
  context?: string[];
  onlineContext?: Record<string, unknown>;
  created: string;
}

/**
 * Khoj Agent
 */
export interface KhojAgent {
  slug: string;
  name: string;
  personality: string;
  avatar?: string;
  tools: string[];
  public: boolean;
}

/**
 * Khoj 客户端服务
 * 封装与 Khoj Server 的所有通信
 */
export class KhojClient {
  private config: KhojConfig;
  private isConnected: boolean = false;

  constructor(config: KhojConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/health`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      this.isConnected = response.ok;
      return response.ok;
    } catch {
      this.isConnected = false;
      return false;
    }
  }

  /**
   * 语义搜索
   */
  async search(query: string, options?: {
    type?: 'all' | 'org' | 'markdown' | 'pdf';
    limit?: number;
    rerank?: boolean;
  }): Promise<KhojSearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      n: String(options?.limit || 10),
      r: String(options?.rerank ?? true),
    });
    
    if (options?.type && options.type !== 'all') {
      params.set('t', options.type);
    }

    const response = await fetch(
      `${this.config.baseUrl}/api/search?${params}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 对话
   */
  async chat(
    message: string,
    options?: {
      conversationId?: string;
      agent?: string;
      stream?: boolean;
    }
  ): Promise<KhojChatMessage | ReadableStream> {
    const body: Record<string, unknown> = {
      q: message,
      stream: options?.stream ?? false,
    };

    if (options?.conversationId) {
      body.conversation_id = options.conversationId;
    }

    if (options?.agent) {
      body.agent = options.agent;
    }

    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Chat failed: ${response.statusText}`);
    }

    if (options?.stream) {
      return response.body!;
    }

    return response.json();
  }

  /**
   * 获取 Agent 列表
   */
  async getAgents(): Promise<KhojAgent[]> {
    const response = await fetch(`${this.config.baseUrl}/api/agents`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Get agents failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 索引文档
   */
  async indexDocument(
    content: string,
    filename: string,
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean }> {
    const formData = new FormData();
    const blob = new Blob([content], { type: 'text/plain' });
    formData.append('file', blob, filename);
    
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await fetch(`${this.config.baseUrl}/api/index/update`, {
      method: 'POST',
      headers: {
        Authorization: this.config.apiKey ? `Bearer ${this.config.apiKey}` : '',
      },
      body: formData,
    });

    return { success: response.ok };
  }

  /**
   * 删除文档
   */
  async deleteDocument(filename: string): Promise<boolean> {
    const response = await fetch(
      `${this.config.baseUrl}/api/index/delete?filename=${encodeURIComponent(filename)}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      }
    );

    return response.ok;
  }

  /**
   * 获取索引状态
   */
  async getIndexStatus(): Promise<{
    indexed_files: number;
    last_updated: string;
  }> {
    const response = await fetch(`${this.config.baseUrl}/api/index/status`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Get index status failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 获取对话历史
   */
  async getConversations(): Promise<Array<{
    id: string;
    title: string;
    created: string;
  }>> {
    const response = await fetch(`${this.config.baseUrl}/api/conversations`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Get conversations failed: ${response.statusText}`);
    }

    return response.json();
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  /**
   * 检查连接状态
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

// 单例导出
let khojClientInstance: KhojClient | null = null;

export function initKhojClient(config: KhojConfig): KhojClient {
  khojClientInstance = new KhojClient(config);
  return khojClientInstance;
}

export function getKhojClient(): KhojClient {
  if (!khojClientInstance) {
    throw new Error('Khoj client not initialized');
  }
  return khojClientInstance;
}
```


### 2. 统一搜索服务

```typescript
// services/search/unifiedSearch.ts

import { getKhojClient, KhojSearchResult } from '../khoj/khojClient';
import { searchMemories, MemorySearchResult } from '../memory';
import { searchNotes } from '../database/noteService';

/**
 * 统一搜索结果
 */
export interface UnifiedSearchResult {
  id: string;
  content: string;
  score: number;
  source: 'echo' | 'khoj';
  type: 'note' | 'task' | 'memory' | 'document';
  metadata: {
    file?: string;
    domain?: string;
    createdAt?: string;
  };
}

/**
 * 统一搜索服务
 * 同时查询 Echo 本地数据和 Khoj 知识库
 */
export class UnifiedSearchService {
  /**
   * 执行统一搜索
   */
  async search(
    query: string,
    options?: {
      sources?: ('echo' | 'khoj')[];
      types?: ('note' | 'task' | 'memory' | 'document')[];
      limit?: number;
      domain?: string;
    }
  ): Promise<UnifiedSearchResult[]> {
    const sources = options?.sources || ['echo', 'khoj'];
    const limit = options?.limit || 20;
    const results: UnifiedSearchResult[] = [];

    // 并行查询
    const promises: Promise<void>[] = [];

    // Echo 本地搜索
    if (sources.includes('echo')) {
      promises.push(
        this.searchEcho(query, options).then(echoResults => {
          results.push(...echoResults);
        })
      );
    }

    // Khoj 搜索
    if (sources.includes('khoj')) {
      promises.push(
        this.searchKhoj(query, options).then(khojResults => {
          results.push(...khojResults);
        }).catch(error => {
          console.warn('Khoj search failed, using local only:', error);
        })
      );
    }

    await Promise.all(promises);

    // 合并排序
    return this.mergeAndRank(results, limit);
  }

  /**
   * Echo 本地搜索
   */
  private async searchEcho(
    query: string,
    options?: { domain?: string; limit?: number }
  ): Promise<UnifiedSearchResult[]> {
    const results: UnifiedSearchResult[] = [];

    // 搜索记忆
    const memories = await searchMemories(query, {
      domain: options?.domain as any,
      limit: options?.limit,
    });

    for (const m of memories) {
      results.push({
        id: m.item.id,
        content: m.item.summary,
        score: m.relevance,
        source: 'echo',
        type: 'memory',
        metadata: {
          domain: m.item.domain,
          createdAt: m.item.createdAt,
        },
      });
    }

    // 搜索笔记
    const notes = await searchNotes(query, options?.domain);
    for (const note of notes) {
      results.push({
        id: note.id,
        content: note.content,
        score: 0.8, // 本地搜索默认分数
        source: 'echo',
        type: 'note',
        metadata: {
          domain: note.domain,
          createdAt: note.createdAt,
        },
      });
    }

    return results;
  }

  /**
   * Khoj 搜索
   */
  private async searchKhoj(
    query: string,
    options?: { limit?: number }
  ): Promise<UnifiedSearchResult[]> {
    try {
      const khojClient = getKhojClient();
      
      if (!khojClient.connected) {
        const isHealthy = await khojClient.healthCheck();
        if (!isHealthy) {
          return [];
        }
      }

      const khojResults = await khojClient.search(query, {
        limit: options?.limit,
        rerank: true,
      });

      return khojResults.map(r => ({
        id: r.additional.file + ':' + r.entry.slice(0, 50),
        content: r.entry,
        score: r.score,
        source: 'khoj' as const,
        type: 'document' as const,
        metadata: {
          file: r.additional.file,
        },
      }));
    } catch (error) {
      console.error('Khoj search error:', error);
      return [];
    }
  }

  /**
   * 合并和排序结果
   */
  private mergeAndRank(
    results: UnifiedSearchResult[],
    limit: number
  ): UnifiedSearchResult[] {
    // 按分数降序排序
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export const unifiedSearchService = new UnifiedSearchService();
```

### 3. 统一对话服务

```typescript
// services/chat/unifiedChat.ts

import { getKhojClient, KhojChatMessage } from '../khoj/khojClient';
import { getGeminiClient } from '../ai/gemini';
import { getMemoryContext } from '../memory';

/**
 * 对话消息
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    type: 'echo' | 'khoj';
    content: string;
    file?: string;
  }>;
  timestamp: string;
}

/**
 * 对话模式
 */
export type ChatMode = 'echo' | 'khoj' | 'hybrid';

/**
 * 统一对话服务
 * 支持 Echo 原生 AI、Khoj AI 和混合模式
 */
export class UnifiedChatService {
  private mode: ChatMode = 'hybrid';
  private conversationId?: string;
  private currentAgent?: string;

  /**
   * 设置对话模式
   */
  setMode(mode: ChatMode): void {
    this.mode = mode;
  }

  /**
   * 设置 Agent
   */
  setAgent(agentSlug?: string): void {
    this.currentAgent = agentSlug;
  }

  /**
   * 发送消息
   */
  async sendMessage(
    message: string,
    options?: {
      mode?: ChatMode;
      agent?: string;
    }
  ): Promise<ChatMessage> {
    const mode = options?.mode || this.mode;
    const agent = options?.agent || this.currentAgent;

    switch (mode) {
      case 'khoj':
        return this.chatWithKhoj(message, agent);
      case 'echo':
        return this.chatWithEcho(message);
      case 'hybrid':
      default:
        return this.chatHybrid(message, agent);
    }
  }

  /**
   * 使用 Khoj 对话
   */
  private async chatWithKhoj(
    message: string,
    agent?: string
  ): Promise<ChatMessage> {
    const khojClient = getKhojClient();
    
    const response = await khojClient.chat(message, {
      conversationId: this.conversationId,
      agent,
      stream: false,
    }) as KhojChatMessage;

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response.message,
      sources: response.context?.map(ctx => ({
        type: 'khoj' as const,
        content: ctx,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 使用 Echo 原生 AI 对话
   */
  private async chatWithEcho(message: string): Promise<ChatMessage> {
    const geminiClient = getGeminiClient();
    
    // 获取记忆上下文
    const memoryContext = await getMemoryContext(message);
    
    const prompt = memoryContext
      ? `${memoryContext}\n\n用户消息: ${message}`
      : message;

    const response = await geminiClient.generateContent(prompt);

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response,
      sources: memoryContext ? [{
        type: 'echo',
        content: memoryContext,
      }] : undefined,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 混合模式对话
   * 先用 Khoj 搜索相关文档，再用 Echo AI 生成回复
   */
  private async chatHybrid(
    message: string,
    agent?: string
  ): Promise<ChatMessage> {
    try {
      // 尝试使用 Khoj
      const khojClient = getKhojClient();
      const isHealthy = await khojClient.healthCheck();
      
      if (isHealthy) {
        // Khoj 可用，使用 Khoj 对话
        return this.chatWithKhoj(message, agent);
      }
    } catch (error) {
      console.warn('Khoj unavailable, falling back to Echo:', error);
    }

    // Khoj 不可用，回退到 Echo
    return this.chatWithEcho(message);
  }

  /**
   * 获取可用的 Agents
   */
  async getAvailableAgents(): Promise<Array<{
    slug: string;
    name: string;
    description: string;
    avatar?: string;
  }>> {
    try {
      const khojClient = getKhojClient();
      const agents = await khojClient.getAgents();
      
      return agents.map(a => ({
        slug: a.slug,
        name: a.name,
        description: a.personality,
        avatar: a.avatar,
      }));
    } catch {
      return [];
    }
  }
}

export const unifiedChatService = new UnifiedChatService();
```


### 4. 文档同步服务

```typescript
// services/sync/khojSync.ts

import { getKhojClient } from '../khoj/khojClient';
import { query } from '../database';
import type { Note, Task } from '../../types/database';

/**
 * 同步状态
 */
export interface SyncStatus {
  lastSyncAt: string | null;
  pendingCount: number;
  isOnline: boolean;
  isSyncing: boolean;
}

/**
 * 同步队列项
 */
interface SyncQueueItem {
  id: string;
  type: 'note' | 'task' | 'memory';
  action: 'create' | 'update' | 'delete';
  data: unknown;
  createdAt: string;
  retryCount: number;
}

/**
 * Khoj 同步服务
 * 将 Echo 数据同步到 Khoj 知识库
 */
export class KhojSyncService {
  private syncQueue: SyncQueueItem[] = [];
  private isSyncing: boolean = false;
  private lastSyncAt: string | null = null;

  /**
   * 同步笔记到 Khoj
   */
  async syncNote(note: Note, action: 'create' | 'update' | 'delete'): Promise<void> {
    const queueItem: SyncQueueItem = {
      id: note.id,
      type: 'note',
      action,
      data: note,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    this.syncQueue.push(queueItem);
    await this.processSyncQueue();
  }

  /**
   * 同步任务到 Khoj
   */
  async syncTask(task: Task, action: 'create' | 'update' | 'delete'): Promise<void> {
    const queueItem: SyncQueueItem = {
      id: task.id,
      type: 'task',
      action,
      data: task,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    this.syncQueue.push(queueItem);
    await this.processSyncQueue();
  }

  /**
   * 处理同步队列
   */
  private async processSyncQueue(): Promise<void> {
    if (this.isSyncing || this.syncQueue.length === 0) {
      return;
    }

    this.isSyncing = true;

    try {
      const khojClient = getKhojClient();
      const isHealthy = await khojClient.healthCheck();

      if (!isHealthy) {
        console.warn('Khoj server unavailable, queuing sync');
        this.isSyncing = false;
        return;
      }

      while (this.syncQueue.length > 0) {
        const item = this.syncQueue[0];

        try {
          await this.syncItem(item);
          this.syncQueue.shift(); // 成功，移除队列
        } catch (error) {
          console.error('Sync item failed:', error);
          item.retryCount++;

          if (item.retryCount >= 3) {
            console.error('Max retries reached, dropping item:', item);
            this.syncQueue.shift();
          } else {
            // 移到队列末尾重试
            this.syncQueue.shift();
            this.syncQueue.push(item);
            break; // 暂停处理，稍后重试
          }
        }
      }

      this.lastSyncAt = new Date().toISOString();
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 同步单个项目
   */
  private async syncItem(item: SyncQueueItem): Promise<void> {
    const khojClient = getKhojClient();

    if (item.action === 'delete') {
      const filename = `echo_${item.type}_${item.id}.md`;
      await khojClient.deleteDocument(filename);
      return;
    }

    // 创建或更新
    const content = this.formatForKhoj(item);
    const filename = `echo_${item.type}_${item.id}.md`;

    await khojClient.indexDocument(content, filename, {
      source: 'echo',
      type: item.type,
      id: item.id,
    });
  }

  /**
   * 格式化数据为 Khoj 可索引格式
   */
  private formatForKhoj(item: SyncQueueItem): string {
    switch (item.type) {
      case 'note': {
        const note = item.data as Note;
        return `# Echo Note\n\n**Domain:** ${note.domain}\n**Created:** ${note.createdAt}\n\n${note.content}`;
      }
      case 'task': {
        const task = item.data as Task;
        return `# Echo Task: ${task.title}\n\n**Status:** ${task.status}\n**Priority:** ${task.priority}\n**Domain:** ${task.domain}\n**Deadline:** ${task.deadline || 'None'}\n\n${task.description || ''}`;
      }
      default:
        return JSON.stringify(item.data);
    }
  }

  /**
   * 获取同步状态
   */
  async getStatus(): Promise<SyncStatus> {
    const khojClient = getKhojClient();
    const isOnline = await khojClient.healthCheck();

    return {
      lastSyncAt: this.lastSyncAt,
      pendingCount: this.syncQueue.length,
      isOnline,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * 强制同步所有数据
   */
  async fullSync(): Promise<void> {
    // 获取所有笔记
    const notes = await query<Note>('SELECT * FROM notes', []);
    for (const note of notes) {
      await this.syncNote(note, 'create');
    }

    // 获取所有任务
    const tasks = await query<Task>('SELECT * FROM tasks', []);
    for (const task of tasks) {
      await this.syncTask(task, 'create');
    }
  }
}

export const khojSyncService = new KhojSyncService();
```

---

## Data Models

### Khoj 配置存储

```typescript
// types/khoj.ts

/**
 * Khoj 连接配置
 */
export interface KhojConnectionConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey?: string;
  username?: string;
  autoSync: boolean;
  syncInterval: number; // 分钟
}

/**
 * Khoj 功能开关
 */
export interface KhojFeatureFlags {
  search: boolean;
  chat: boolean;
  agents: boolean;
  automation: boolean;
  documentUpload: boolean;
}

/**
 * 完整 Khoj 配置
 */
export interface KhojSettings {
  connection: KhojConnectionConfig;
  features: KhojFeatureFlags;
}

// 默认配置
export const DEFAULT_KHOJ_SETTINGS: KhojSettings = {
  connection: {
    enabled: false,
    baseUrl: 'http://localhost:42110',
    autoSync: true,
    syncInterval: 30,
  },
  features: {
    search: true,
    chat: true,
    agents: true,
    automation: false,
    documentUpload: true,
  },
};
```

---

## UI Components

### 1. 统一搜索组件

```typescript
// components/search/UnifiedSearch.tsx

import { useState } from 'react';
import { Search, FileText, Brain, Globe } from 'lucide-react';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { unifiedSearchService, UnifiedSearchResult } from '../../services/search/unifiedSearch';

export function UnifiedSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      const searchResults = await unifiedSearchService.search(query);
      setResults(searchResults);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="搜索笔记、文档、记忆..."
          className="pl-10"
        />
      </div>

      <div className="space-y-2">
        {results.map((result) => (
          <SearchResultCard key={result.id} result={result} />
        ))}
      </div>
    </div>
  );
}

function SearchResultCard({ result }: { result: UnifiedSearchResult }) {
  const SourceIcon = result.source === 'khoj' ? Globe : Brain;
  
  return (
    <div className="p-3 border rounded-lg hover:bg-accent/50 cursor-pointer">
      <div className="flex items-start gap-3">
        <SourceIcon className="h-4 w-4 mt-1 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <p className="text-sm line-clamp-2">{result.content}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {result.source === 'khoj' ? 'Khoj' : 'Echo'}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {result.type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              相关度: {(result.score * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
```


### 2. Agent 选择器组件

```typescript
// components/chat/AgentSelector.tsx

import { useState, useEffect } from 'react';
import { Bot, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { unifiedChatService } from '../../services/chat/unifiedChat';

interface Agent {
  slug: string;
  name: string;
  description: string;
  avatar?: string;
}

export function AgentSelector({
  onSelect,
}: {
  onSelect: (agent: Agent | null) => void;
}) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    const availableAgents = await unifiedChatService.getAvailableAgents();
    setAgents(availableAgents);
  };

  const handleSelect = (agent: Agent | null) => {
    setSelected(agent);
    onSelect(agent);
    unifiedChatService.setAgent(agent?.slug);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bot className="h-4 w-4" />
          {selected?.name || 'Default AI'}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuItem onClick={() => handleSelect(null)}>
          <div>
            <p className="font-medium">Default AI</p>
            <p className="text-xs text-muted-foreground">Echo 默认助手</p>
          </div>
        </DropdownMenuItem>
        {agents.map((agent) => (
          <DropdownMenuItem
            key={agent.slug}
            onClick={() => handleSelect(agent)}
          >
            <div>
              <p className="font-medium">{agent.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {agent.description}
              </p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 3. 知识库管理页面

```typescript
// pages/Knowledge.tsx

import { useState, useEffect } from 'react';
import { Upload, Trash2, RefreshCw, FileText, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { getKhojClient } from '../services/khoj/khojClient';
import { khojSyncService } from '../services/sync/khojSync';

export function KnowledgePage() {
  const [indexStatus, setIndexStatus] = useState<{
    indexed_files: number;
    last_updated: string;
  } | null>(null);
  const [syncStatus, setSyncStatus] = useState<{
    isOnline: boolean;
    pendingCount: number;
    isSyncing: boolean;
  } | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const khojClient = getKhojClient();
      const status = await khojClient.getIndexStatus();
      setIndexStatus(status);

      const sync = await khojSyncService.getStatus();
      setSyncStatus(sync);
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  };

  const handleFullSync = async () => {
    await khojSyncService.fullSync();
    await loadStatus();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">知识库</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadStatus}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button onClick={handleFullSync}>
            <Upload className="h-4 w-4 mr-2" />
            全量同步
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">索引文档</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {indexStatus?.indexed_files || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">同步状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  syncStatus?.isOnline ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm">
                {syncStatus?.isOnline ? '已连接' : '离线'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">待同步</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {syncStatus?.pendingCount || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 文档上传区域 */}
      <Card>
        <CardHeader>
          <CardTitle>上传文档</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              拖拽文件到此处，或点击上传
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              支持 PDF, Markdown, Word, 纯文本
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do.*

### Property 1: Graceful Degradation
*For any* Khoj server unavailability, the Echo application SHALL continue to function with local data only, and all local features SHALL remain fully operational.
**Validates: Requirements 1.4, 9.1, 9.5**

### Property 2: Search Result Consistency
*For any* search query, the unified search SHALL return results from both Echo and Khoj (when available), and results SHALL be correctly attributed to their source.
**Validates: Requirements 2.1, 2.2, 8.1, 8.3**

### Property 3: Sync Queue Persistence
*For any* document change made while offline, the change SHALL be queued and successfully synced when connection is restored.
**Validates: Requirements 3.4, 9.2, 9.3**

### Property 4: Chat Mode Switching
*For any* chat mode switch (echo/khoj/hybrid), the chat service SHALL correctly route messages to the appropriate backend and return properly formatted responses.
**Validates: Requirements 4.1, 4.5**

### Property 5: Agent Availability
*For any* request for available agents, the service SHALL return the current list from Khoj server, or an empty list if Khoj is unavailable.
**Validates: Requirements 5.1, 5.2**

### Property 6: Document Sync Round-Trip
*For any* note or task created in Echo, after sync to Khoj, searching for that content in Khoj SHALL return the synced document.
**Validates: Requirements 3.1, 3.2, 3.3**

---

## Error Handling

### 错误处理策略

```typescript
// 错误类型定义
export class KhojError extends Error {
  constructor(
    message: string,
    public readonly code: KhojErrorCode,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'KhojError';
  }
}

export enum KhojErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  AUTH_FAILED = 'AUTH_FAILED',
  SEARCH_FAILED = 'SEARCH_FAILED',
  CHAT_FAILED = 'CHAT_FAILED',
  SYNC_FAILED = 'SYNC_FAILED',
  INDEX_FAILED = 'INDEX_FAILED',
}

// 优雅降级包装器
async function withKhojFallback<T>(
  khojOperation: () => Promise<T>,
  fallbackOperation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await khojOperation();
  } catch (error) {
    console.warn(`[Khoj] ${context} 失败，使用本地回退:`, error);
    return await fallbackOperation();
  }
}
```

---

## Testing Strategy

### 测试框架

| 类型 | 框架 | 用途 |
|------|------|------|
| 单元测试 | Vitest | 服务和组件测试 |
| 属性测试 | fast-check | 正确性属性验证 |
| 集成测试 | Vitest | Khoj API 集成测试 |
| Mock | MSW | Khoj API Mock |

### 属性测试配置

```typescript
import fc from 'fast-check';

const FC_CONFIG = { numRuns: 100 };

// 生成器
const arbitrarySearchQuery = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 1, maxLength: 200 })
    .filter(s => s.trim().length > 0);

const arbitraryChatMessage = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 1, maxLength: 1000 })
    .filter(s => s.trim().length > 0);
```

---

## Docker 部署

### Khoj Server 部署

```yaml
# docker-compose.khoj.yml
version: '3.8'

services:
  khoj:
    image: ghcr.io/khoj-ai/khoj:latest
    container_name: echo-khoj
    ports:
      - "42110:42110"
    environment:
      - KHOJ_ADMIN_EMAIL=admin@echo.local
      - KHOJ_ADMIN_PASSWORD=your-secure-password
      - KHOJ_DJANGO_SECRET_KEY=your-secret-key
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    volumes:
      - khoj_data:/root/.khoj
    restart: unless-stopped

volumes:
  khoj_data:
```

### 启动脚本

```bash
#!/bin/bash
# scripts/start-khoj.sh

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running. Please start Docker first."
  exit 1
fi

# 启动 Khoj
docker-compose -f docker-compose.khoj.yml up -d

# 等待 Khoj 启动
echo "Waiting for Khoj to start..."
for i in {1..30}; do
  if curl -s http://localhost:42110/api/health > /dev/null; then
    echo "Khoj is ready!"
    exit 0
  fi
  sleep 1
done

echo "Khoj failed to start within 30 seconds"
exit 1
```
