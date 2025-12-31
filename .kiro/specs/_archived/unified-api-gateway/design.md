# Design Document - 统一 API 网关

## Overview

本设计文档描述如何在 Blinko 后端建立统一的 API 网关架构，将所有外部服务（Khoj、Janitor、Paperless、SeekDB）的 API 调用统一代理，消除 CORS 问题并提供统一的服务管理。

### 设计原则

1. **单一入口** - 前端只访问 Blinko 后端 (localhost:1111)
2. **透明代理** - 后端转发请求到各服务，前端无感知
3. **优雅降级** - 服务不可用时返回友好错误
4. **统一监控** - 集中健康检查和日志记录
5. **渐进迁移** - 逐步迁移现有代码，不破坏现有功能

### 技术选型

| 组件 | 技术 | 理由 |
|------|------|------|
| API 框架 | tRPC | Blinko 已使用，类型安全 |
| HTTP 客户端 | axios | 现有客户端已使用 |
| 服务发现 | 环境变量 | 简单可靠 |
| 健康检查 | 定时轮询 | 实现简单 |

---

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Blinko Frontend                                  │
│                         (React + tRPC Client)                           │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Khoj UI     │  │  Janitor UI  │  │  Files UI    │  │  Search UI   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │          │
│         └─────────────────┼─────────────────┼─────────────────┘          │
│                           │                 │                            │
│                           ▼                 ▼                            │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    Frontend Service Layer                          │ │
│  │                    (统一调用 /api/trpc/*)                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ HTTP (同源)
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      Blinko Backend (localhost:1111)                     │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      tRPC Router (_app.ts)                         │ │
│  │                                                                     │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │ │
│  │  │ khojRouter  │  │janitorRouter│  │paperlessRouter│ │seekdbRouter│ │ │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘ │ │
│  │         │                │                │               │        │ │
│  └─────────┼────────────────┼────────────────┼───────────────┼────────┘ │
│            │                │                │               │          │
│  ┌─────────▼────────────────▼────────────────▼───────────────▼────────┐ │
│  │                      Service Client Layer                          │ │
│  │                                                                     │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │ │
│  │  │ KhojClient  │  │JanitorClient│  │PaperlessClient│ │SeekDBClient│ │ │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘ │ │
│  │         │                │                │               │        │ │
│  └─────────┼────────────────┼────────────────┼───────────────┼────────┘ │
│            │                │                │               │          │
│  ┌─────────▼────────────────▼────────────────▼───────────────▼────────┐ │
│  │                    Service Registry & Health Monitor               │ │
│  │                    (统一配置、健康检查、日志)                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ HTTP (内部网络)
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Khoj (42110)   │  │ Janitor (8766)  │  │ Paperless (8000)│
│  AI 知识助手    │  │ AI 文件整理     │  │ 文档管理        │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │
         ▼
┌─────────────────┐
│ SeekDB (8765)   │
│ 向量搜索        │
└─────────────────┘
```

### 数据流

```
用户操作 (搜索/对话/文件管理)
         │
         ▼
┌─────────────────┐
│  Frontend UI    │
└────────┬────────┘
         │ tRPC 调用 (同源)
         ▼
┌─────────────────┐
│  tRPC Router    │
│  (khoj.chat)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Service Client │
│  (KhojClient)   │
└────────┬────────┘
         │ HTTP (内部)
         ▼
┌─────────────────┐
│  Khoj Server    │
│  (42110)        │
└─────────────────┘
```

---

## Components and Interfaces

### 1. Service Registry (服务注册表)

```typescript
// server/lib/serviceRegistry.ts

/**
 * 服务配置
 */
export interface ServiceConfig {
  name: string;
  displayName: string;
  baseUrl: string;
  healthEndpoint: string;
  timeout: number;
  enabled: boolean;
}

/**
 * 服务状态
 */
export interface ServiceStatus {
  name: string;
  displayName: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck: string;
  latency?: number;
  error?: string;
}

/**
 * 服务注册表
 * 管理所有外部服务的配置和状态
 */
export class ServiceRegistry {
  private services: Map<string, ServiceConfig> = new Map();
  private statuses: Map<string, ServiceStatus> = new Map();

  constructor() {
    this.initializeServices();
  }

  /**
   * 从环境变量初始化服务配置
   */
  private initializeServices(): void {
    // Khoj
    this.register({
      name: 'khoj',
      displayName: 'Khoj AI',
      baseUrl: process.env.KHOJ_API_URL || 'http://localhost:42110',
      healthEndpoint: '/api/health',
      timeout: 10000,
      enabled: true,
    });

    // Janitor
    this.register({
      name: 'janitor',
      displayName: 'Janitor',
      baseUrl: process.env.JANITOR_API_URL || 'http://localhost:8766',
      healthEndpoint: '/health',
      timeout: 10000,
      enabled: true,
    });

    // Paperless
    this.register({
      name: 'paperless',
      displayName: 'Paperless',
      baseUrl: process.env.PAPERLESS_API_URL || 'http://localhost:8000',
      healthEndpoint: '/api/tags/', // Paperless 没有专门的 health 端点
      timeout: 10000,
      enabled: !!process.env.PAPERLESS_API_TOKEN,
    });

    // SeekDB
    this.register({
      name: 'seekdb',
      displayName: 'SeekDB',
      baseUrl: process.env.SEEKDB_API_URL || 'http://localhost:8765',
      healthEndpoint: '/health',
      timeout: 10000,
      enabled: true,
    });
  }

  /**
   * 注册服务
   */
  register(config: ServiceConfig): void {
    this.services.set(config.name, config);
    this.statuses.set(config.name, {
      name: config.name,
      displayName: config.displayName,
      status: 'unknown',
      lastCheck: new Date().toISOString(),
    });
  }

  /**
   * 获取服务配置
   */
  getConfig(name: string): ServiceConfig | undefined {
    return this.services.get(name);
  }

  /**
   * 获取所有服务配置
   */
  getAllConfigs(): ServiceConfig[] {
    return Array.from(this.services.values());
  }

  /**
   * 更新服务状态
   */
  updateStatus(name: string, status: Partial<ServiceStatus>): void {
    const current = this.statuses.get(name);
    if (current) {
      this.statuses.set(name, { ...current, ...status, lastCheck: new Date().toISOString() });
    }
  }

  /**
   * 获取服务状态
   */
  getStatus(name: string): ServiceStatus | undefined {
    return this.statuses.get(name);
  }

  /**
   * 获取所有服务状态
   */
  getAllStatuses(): ServiceStatus[] {
    return Array.from(this.statuses.values());
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(name: string): boolean {
    const status = this.statuses.get(name);
    return status?.status === 'healthy';
  }
}

// 单例
export const serviceRegistry = new ServiceRegistry();
```

### 2. Health Monitor (健康监控器)

```typescript
// server/lib/healthMonitor.ts

import { serviceRegistry, ServiceConfig } from './serviceRegistry';

/**
 * 健康监控器
 * 定期检查所有服务的健康状态
 */
export class HealthMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private checkInterval: number = 30000; // 30 秒

  /**
   * 启动健康监控
   */
  start(): void {
    // 立即执行一次检查
    this.checkAllServices();

    // 定期检查
    this.intervalId = setInterval(() => {
      this.checkAllServices();
    }, this.checkInterval);

    console.log('[HealthMonitor] Started with interval:', this.checkInterval, 'ms');
  }

  /**
   * 停止健康监控
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[HealthMonitor] Stopped');
    }
  }

  /**
   * 检查所有服务
   */
  async checkAllServices(): Promise<void> {
    const configs = serviceRegistry.getAllConfigs();
    
    await Promise.all(
      configs.map(config => this.checkService(config))
    );
  }

  /**
   * 检查单个服务
   */
  async checkService(config: ServiceConfig): Promise<void> {
    if (!config.enabled) {
      serviceRegistry.updateStatus(config.name, {
        status: 'unknown',
        error: 'Service disabled',
      });
      return;
    }

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(`${config.baseUrl}${config.healthEndpoint}`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (response.ok) {
        serviceRegistry.updateStatus(config.name, {
          status: 'healthy',
          latency,
          error: undefined,
        });
      } else {
        serviceRegistry.updateStatus(config.name, {
          status: 'unhealthy',
          latency,
          error: `HTTP ${response.status}`,
        });
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      serviceRegistry.updateStatus(config.name, {
        status: 'unhealthy',
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 手动检查单个服务
   */
  async checkServiceByName(name: string): Promise<void> {
    const config = serviceRegistry.getConfig(name);
    if (config) {
      await this.checkService(config);
    }
  }
}

// 单例
export const healthMonitor = new HealthMonitor();
```

### 3. Khoj Client (完整版)

```typescript
// server/lib/khojClient.ts

import axios, { AxiosInstance } from 'axios';
import { serviceRegistry } from './serviceRegistry';

/**
 * Khoj 聊天消息
 */
export interface KhojChatMessage {
  role: 'user' | 'assistant' | 'khoj';
  message: string;
  context?: string[];
  created: string;
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
 * Khoj 自动化任务
 */
export interface KhojAutomation {
  id: string;
  subject: string;
  query_to_run: string;
  scheduling_request: string;
  schedule: string;
  next_run_at: string;
}

/**
 * Khoj 客户端错误
 */
export class KhojClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'KhojClientError';
  }
}

/**
 * Khoj 客户端
 * 封装与 Khoj Server 的所有通信
 */
export class KhojClient {
  private client: AxiosInstance;

  constructor() {
    const config = serviceRegistry.getConfig('khoj');
    const baseUrl = config?.baseUrl || 'http://localhost:42110';

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 60000, // 60 秒（AI 响应可能较慢）
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // ============ 健康检查 ============

  async healthCheck(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.get('/api/health', { timeout: 10000 });
      return { success: response.status === 200, message: 'Khoj 服务正常' };
    } catch (error) {
      return { success: false, message: this.getErrorMessage(error) };
    }
  }

  // ============ 聊天 API ============

  /**
   * 发送聊天消息
   */
  async chat(
    message: string,
    options?: {
      conversationId?: string;
      agent?: string;
      stream?: boolean;
    }
  ): Promise<KhojChatMessage | ReadableStream> {
    try {
      const params = new URLSearchParams({ q: message });
      if (options?.conversationId) params.set('conversation_id', options.conversationId);
      if (options?.agent) params.set('agent', options.agent);
      if (options?.stream) params.set('stream', 'true');

      const response = await this.client.get(`/api/chat?${params}`, {
        responseType: options?.stream ? 'stream' : 'json',
      });

      return response.data;
    } catch (error) {
      throw new KhojClientError('聊天请求失败', undefined, error as Error);
    }
  }

  /**
   * 获取对话历史
   */
  async getConversations(): Promise<Array<{ id: string; title: string; created: string }>> {
    try {
      const response = await this.client.get('/api/chat/sessions');
      return response.data;
    } catch (error) {
      throw new KhojClientError('获取对话历史失败', undefined, error as Error);
    }
  }

  /**
   * 获取单个对话
   */
  async getConversation(id: string): Promise<KhojChatMessage[]> {
    try {
      const response = await this.client.get(`/api/chat/session/${id}`);
      return response.data;
    } catch (error) {
      throw new KhojClientError('获取对话失败', undefined, error as Error);
    }
  }

  /**
   * 删除对话
   */
  async deleteConversation(id: string): Promise<void> {
    try {
      await this.client.delete(`/api/chat/session/${id}`);
    } catch (error) {
      throw new KhojClientError('删除对话失败', undefined, error as Error);
    }
  }

  // ============ 搜索 API ============

  /**
   * 语义搜索
   */
  async search(
    query: string,
    options?: {
      type?: 'all' | 'org' | 'markdown' | 'pdf';
      limit?: number;
      rerank?: boolean;
    }
  ): Promise<KhojSearchResult[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        n: String(options?.limit || 10),
        r: String(options?.rerank ?? true),
      });
      if (options?.type && options.type !== 'all') {
        params.set('t', options.type);
      }

      const response = await this.client.get(`/api/search?${params}`);
      return response.data;
    } catch (error) {
      throw new KhojClientError('搜索失败', undefined, error as Error);
    }
  }

  // ============ Agent API ============

  /**
   * 获取 Agent 列表
   */
  async getAgents(): Promise<KhojAgent[]> {
    try {
      const response = await this.client.get('/api/agents');
      return response.data;
    } catch (error) {
      throw new KhojClientError('获取 Agent 列表失败', undefined, error as Error);
    }
  }

  /**
   * 获取单个 Agent
   */
  async getAgent(slug: string): Promise<KhojAgent> {
    try {
      const response = await this.client.get(`/api/agents/${slug}`);
      return response.data;
    } catch (error) {
      throw new KhojClientError('获取 Agent 失败', undefined, error as Error);
    }
  }

  /**
   * 创建 Agent
   */
  async createAgent(data: Partial<KhojAgent>): Promise<KhojAgent> {
    try {
      const response = await this.client.post('/api/agents', data);
      return response.data;
    } catch (error) {
      throw new KhojClientError('创建 Agent 失败', undefined, error as Error);
    }
  }

  /**
   * 更新 Agent
   */
  async updateAgent(slug: string, data: Partial<KhojAgent>): Promise<KhojAgent> {
    try {
      const response = await this.client.patch(`/api/agents/${slug}`, data);
      return response.data;
    } catch (error) {
      throw new KhojClientError('更新 Agent 失败', undefined, error as Error);
    }
  }

  /**
   * 删除 Agent
   */
  async deleteAgent(slug: string): Promise<void> {
    try {
      await this.client.delete(`/api/agents/${slug}`);
    } catch (error) {
      throw new KhojClientError('删除 Agent 失败', undefined, error as Error);
    }
  }

  // ============ 自动化 API ============

  /**
   * 获取自动化任务列表
   */
  async getAutomations(): Promise<KhojAutomation[]> {
    try {
      const response = await this.client.get('/api/automations');
      return response.data;
    } catch (error) {
      throw new KhojClientError('获取自动化任务失败', undefined, error as Error);
    }
  }

  /**
   * 创建自动化任务
   */
  async createAutomation(data: Partial<KhojAutomation>): Promise<KhojAutomation> {
    try {
      const response = await this.client.post('/api/automations', data);
      return response.data;
    } catch (error) {
      throw new KhojClientError('创建自动化任务失败', undefined, error as Error);
    }
  }

  /**
   * 删除自动化任务
   */
  async deleteAutomation(id: string): Promise<void> {
    try {
      await this.client.delete(`/api/automations/${id}`);
    } catch (error) {
      throw new KhojClientError('删除自动化任务失败', undefined, error as Error);
    }
  }

  // ============ 索引 API ============

  /**
   * 索引文档
   */
  async indexDocument(content: string, filename: string): Promise<{ success: boolean }> {
    try {
      const formData = new FormData();
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append('file', blob, filename);

      const response = await this.client.post('/api/index/update', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { success: response.status === 200 };
    } catch (error) {
      throw new KhojClientError('索引文档失败', undefined, error as Error);
    }
  }

  /**
   * 获取索引状态
   */
  async getIndexStatus(): Promise<{ indexed_files: number; last_updated: string }> {
    try {
      const response = await this.client.get('/api/index/status');
      return response.data;
    } catch (error) {
      throw new KhojClientError('获取索引状态失败', undefined, error as Error);
    }
  }

  // ============ 私有方法 ============

  private getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') return '无法连接到 Khoj 服务';
      if (error.code === 'ETIMEDOUT') return '连接 Khoj 超时';
      return error.message;
    }
    return error instanceof Error ? error.message : '未知错误';
  }
}

// 单例
let khojClientInstance: KhojClient | null = null;

export function getKhojClient(): KhojClient {
  if (!khojClientInstance) {
    khojClientInstance = new KhojClient();
  }
  return khojClientInstance;
}
```

### 4. Khoj tRPC Router (完整版)

```typescript
// server/routerTrpc/khoj.ts

import { router, publicProcedure } from '../middleware';
import { z } from 'zod';
import { getKhojClient, KhojClientError } from '../lib/khojClient';
import { serviceRegistry } from '../lib/serviceRegistry';
import { TRPCError } from '@trpc/server';

/**
 * 统一错误处理
 */
function handleKhojError(error: unknown): never {
  if (error instanceof KhojClientError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message,
      cause: error,
    });
  }
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: error instanceof Error ? error.message : '未知错误',
  });
}

/**
 * 检查服务可用性
 */
function ensureServiceAvailable(): void {
  if (!serviceRegistry.isAvailable('khoj')) {
    throw new TRPCError({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Khoj 服务当前不可用',
    });
  }
}

export const khojRouter = router({
  // ============ 健康检查 ============
  
  testConnection: publicProcedure
    .input(z.object({ baseUrl: z.string().optional() }))
    .mutation(async () => {
      const client = getKhojClient();
      return await client.healthCheck();
    }),

  getStatus: publicProcedure.query(async () => {
    const status = serviceRegistry.getStatus('khoj');
    return {
      success: status?.status === 'healthy',
      message: status?.error || 'Khoj 服务正常',
      url: serviceRegistry.getConfig('khoj')?.baseUrl,
      latency: status?.latency,
      lastCheck: status?.lastCheck,
    };
  }),

  // ============ 聊天 API ============

  chat: publicProcedure
    .input(z.object({
      message: z.string().min(1),
      conversationId: z.string().optional(),
      agent: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        const response = await client.chat(input.message, {
          conversationId: input.conversationId,
          agent: input.agent,
          stream: false,
        });
        return response;
      } catch (error) {
        handleKhojError(error);
      }
    }),

  getConversations: publicProcedure.query(async () => {
    ensureServiceAvailable();
    try {
      const client = getKhojClient();
      return await client.getConversations();
    } catch (error) {
      handleKhojError(error);
    }
  }),

  getConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        return await client.getConversation(input.id);
      } catch (error) {
        handleKhojError(error);
      }
    }),

  deleteConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        await client.deleteConversation(input.id);
        return { success: true };
      } catch (error) {
        handleKhojError(error);
      }
    }),

  // ============ 搜索 API ============

  search: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      type: z.enum(['all', 'org', 'markdown', 'pdf']).optional(),
      limit: z.number().min(1).max(100).optional(),
      rerank: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        return await client.search(input.query, {
          type: input.type,
          limit: input.limit,
          rerank: input.rerank,
        });
      } catch (error) {
        handleKhojError(error);
      }
    }),

  // ============ Agent API ============

  getAgents: publicProcedure.query(async () => {
    ensureServiceAvailable();
    try {
      const client = getKhojClient();
      return await client.getAgents();
    } catch (error) {
      handleKhojError(error);
    }
  }),

  getAgent: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        return await client.getAgent(input.slug);
      } catch (error) {
        handleKhojError(error);
      }
    }),

  createAgent: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      personality: z.string(),
      tools: z.array(z.string()).optional(),
      public: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        return await client.createAgent(input);
      } catch (error) {
        handleKhojError(error);
      }
    }),

  updateAgent: publicProcedure
    .input(z.object({
      slug: z.string(),
      name: z.string().optional(),
      personality: z.string().optional(),
      tools: z.array(z.string()).optional(),
      public: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        const { slug, ...data } = input;
        return await client.updateAgent(slug, data);
      } catch (error) {
        handleKhojError(error);
      }
    }),

  deleteAgent: publicProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        await client.deleteAgent(input.slug);
        return { success: true };
      } catch (error) {
        handleKhojError(error);
      }
    }),

  // ============ 自动化 API ============

  getAutomations: publicProcedure.query(async () => {
    ensureServiceAvailable();
    try {
      const client = getKhojClient();
      return await client.getAutomations();
    } catch (error) {
      handleKhojError(error);
    }
  }),

  createAutomation: publicProcedure
    .input(z.object({
      subject: z.string(),
      query_to_run: z.string(),
      scheduling_request: z.string(),
    }))
    .mutation(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        return await client.createAutomation(input);
      } catch (error) {
        handleKhojError(error);
      }
    }),

  deleteAutomation: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        await client.deleteAutomation(input.id);
        return { success: true };
      } catch (error) {
        handleKhojError(error);
      }
    }),

  // ============ 索引 API ============

  indexDocument: publicProcedure
    .input(z.object({
      content: z.string(),
      filename: z.string(),
    }))
    .mutation(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        return await client.indexDocument(input.content, input.filename);
      } catch (error) {
        handleKhojError(error);
      }
    }),

  getIndexStatus: publicProcedure.query(async () => {
    ensureServiceAvailable();
    try {
      const client = getKhojClient();
      return await client.getIndexStatus();
    } catch (error) {
      handleKhojError(error);
    }
  }),
});
```

### 5. 统一错误处理

```typescript
// server/lib/gatewayError.ts

import { TRPCError } from '@trpc/server';

/**
 * 网关错误类型
 */
export type GatewayErrorCode = 
  | 'SERVICE_UNAVAILABLE'
  | 'SERVICE_TIMEOUT'
  | 'SERVICE_ERROR'
  | 'INVALID_REQUEST'
  | 'UNKNOWN_ERROR';

/**
 * 网关错误
 */
export class GatewayError extends Error {
  constructor(
    message: string,
    public code: GatewayErrorCode,
    public serviceName: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

/**
 * 统一错误响应格式
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: GatewayErrorCode;
    message: string;
    service: string;
    timestamp: string;
  };
}

/**
 * 创建统一错误响应
 */
export function createErrorResponse(
  code: GatewayErrorCode,
  message: string,
  serviceName: string
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      service: serviceName,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * 将网关错误转换为 tRPC 错误
 */
export function toTRPCError(error: GatewayError): TRPCError {
  const codeMap: Record<GatewayErrorCode, TRPCError['code']> = {
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    SERVICE_TIMEOUT: 'TIMEOUT',
    SERVICE_ERROR: 'INTERNAL_SERVER_ERROR',
    INVALID_REQUEST: 'BAD_REQUEST',
    UNKNOWN_ERROR: 'INTERNAL_SERVER_ERROR',
  };

  return new TRPCError({
    code: codeMap[error.code] || 'INTERNAL_SERVER_ERROR',
    message: `[${error.serviceName}] ${error.message}`,
    cause: error.originalError,
  });
}

/**
 * 错误处理装饰器
 * 用于统一处理服务调用错误
 */
export function withErrorHandling<T>(
  serviceName: string,
  operation: () => Promise<T>
): Promise<T> {
  return operation().catch((error) => {
    if (error instanceof GatewayError) {
      throw toTRPCError(error);
    }

    // 处理 axios 错误
    if (error?.code === 'ECONNREFUSED') {
      throw toTRPCError(new GatewayError(
        '服务连接被拒绝',
        'SERVICE_UNAVAILABLE',
        serviceName,
        error
      ));
    }

    if (error?.code === 'ETIMEDOUT') {
      throw toTRPCError(new GatewayError(
        '服务响应超时',
        'SERVICE_TIMEOUT',
        serviceName,
        error
      ));
    }

    throw toTRPCError(new GatewayError(
      error?.message || '未知错误',
      'UNKNOWN_ERROR',
      serviceName,
      error
    ));
  });
}
```

### 6. Gateway Router (统一服务状态)

```typescript
// server/routerTrpc/gateway.ts

import { router, publicProcedure } from '../middleware';
import { z } from 'zod';
import { serviceRegistry } from '../lib/serviceRegistry';
import { healthMonitor } from '../lib/healthMonitor';

export const gatewayRouter = router({
  /**
   * 获取所有服务状态
   */
  getAllStatuses: publicProcedure.query(async () => {
    return {
      services: serviceRegistry.getAllStatuses(),
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * 获取单个服务状态
   */
  getServiceStatus: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      const status = serviceRegistry.getStatus(input.name);
      if (!status) {
        return { success: false, message: '服务不存在' };
      }
      return {
        success: true,
        ...status,
      };
    }),

  /**
   * 手动刷新服务状态
   */
  refreshStatus: publicProcedure
    .input(z.object({ name: z.string().optional() }))
    .mutation(async ({ input }) => {
      if (input.name) {
        await healthMonitor.checkServiceByName(input.name);
        return serviceRegistry.getStatus(input.name);
      } else {
        await healthMonitor.checkAllServices();
        return {
          services: serviceRegistry.getAllStatuses(),
          timestamp: new Date().toISOString(),
        };
      }
    }),

  /**
   * 获取服务配置（不含敏感信息）
   */
  getServiceConfigs: publicProcedure.query(async () => {
    const configs = serviceRegistry.getAllConfigs();
    return configs.map(config => ({
      name: config.name,
      displayName: config.displayName,
      enabled: config.enabled,
      // 不暴露 baseUrl 等敏感信息
    }));
  }),
});
```

### 7. 前端服务层

```typescript
// app/src/lib/gateway.ts

import { api } from './trpc';

/**
 * 服务状态
 */
export interface ServiceStatus {
  name: string;
  displayName: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck: string;
  latency?: number;
  error?: string;
}

/**
 * 网关服务
 * 提供统一的服务状态查询和管理
 */
export const gatewayService = {
  /**
   * 获取所有服务状态
   */
  getAllStatuses: async (): Promise<ServiceStatus[]> => {
    const result = await api.gateway.getAllStatuses.query();
    return result.services;
  },

  /**
   * 获取单个服务状态
   */
  getServiceStatus: async (name: string): Promise<ServiceStatus | null> => {
    const result = await api.gateway.getServiceStatus.query({ name });
    if (!result.success) return null;
    return result as ServiceStatus;
  },

  /**
   * 刷新服务状态
   */
  refreshStatus: async (name?: string): Promise<void> => {
    await api.gateway.refreshStatus.mutate({ name });
  },

  /**
   * 检查服务是否可用
   */
  isServiceAvailable: async (name: string): Promise<boolean> => {
    const status = await gatewayService.getServiceStatus(name);
    return status?.status === 'healthy';
  },
};

/**
 * Khoj 服务
 * 通过 API 网关访问 Khoj
 */
export const khojService = {
  /**
   * 发送聊天消息
   */
  chat: async (message: string, options?: { conversationId?: string; agent?: string }) => {
    return await api.khoj.chat.mutate({
      message,
      conversationId: options?.conversationId,
      agent: options?.agent,
    });
  },

  /**
   * 获取对话列表
   */
  getConversations: async () => {
    return await api.khoj.getConversations.query();
  },

  /**
   * 获取对话详情
   */
  getConversation: async (id: string) => {
    return await api.khoj.getConversation.query({ id });
  },

  /**
   * 删除对话
   */
  deleteConversation: async (id: string) => {
    return await api.khoj.deleteConversation.mutate({ id });
  },

  /**
   * 语义搜索
   */
  search: async (query: string, options?: { type?: string; limit?: number }) => {
    return await api.khoj.search.query({
      query,
      type: options?.type as 'all' | 'org' | 'markdown' | 'pdf',
      limit: options?.limit,
    });
  },

  /**
   * 获取 Agent 列表
   */
  getAgents: async () => {
    return await api.khoj.getAgents.query();
  },

  /**
   * 获取服务状态
   */
  getStatus: async () => {
    return await api.khoj.getStatus.query();
  },
};
```

### 8. 服务状态 Hook

```typescript
// app/src/hooks/useServiceStatus.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gatewayService, ServiceStatus } from '../lib/gateway';

/**
 * 获取所有服务状态
 */
export function useAllServiceStatuses() {
  return useQuery({
    queryKey: ['gateway', 'statuses'],
    queryFn: () => gatewayService.getAllStatuses(),
    refetchInterval: 30000, // 30 秒自动刷新
    staleTime: 10000, // 10 秒内认为数据新鲜
  });
}

/**
 * 获取单个服务状态
 */
export function useServiceStatus(name: string) {
  return useQuery({
    queryKey: ['gateway', 'status', name],
    queryFn: () => gatewayService.getServiceStatus(name),
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

/**
 * 刷新服务状态
 */
export function useRefreshServiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name?: string) => gatewayService.refreshStatus(name),
    onSuccess: () => {
      // 刷新后重新获取状态
      queryClient.invalidateQueries({ queryKey: ['gateway'] });
    },
  });
}

/**
 * 检查服务是否可用
 */
export function useIsServiceAvailable(name: string): boolean {
  const { data } = useServiceStatus(name);
  return data?.status === 'healthy';
}
```

---

## Correctness Properties

### 属性 1: 服务状态一致性

```
PROPERTY: ServiceStatusConsistency
FOR ALL services s IN ServiceRegistry:
  IF healthMonitor.checkService(s) returns healthy
  THEN serviceRegistry.getStatus(s.name).status == 'healthy'
  AND serviceRegistry.getStatus(s.name).lastCheck is recent (< 60s)
```

### 属性 2: 错误传播正确性

```
PROPERTY: ErrorPropagation
FOR ALL requests r TO khojRouter:
  IF KhojClient throws KhojClientError(message, code)
  THEN tRPC response contains:
    - error.code == mapped_trpc_code(code)
    - error.message contains message
```

### 属性 3: 服务不可用时的优雅降级

```
PROPERTY: GracefulDegradation
FOR ALL services s:
  IF serviceRegistry.isAvailable(s.name) == false
  THEN all router procedures for s:
    - THROW TRPCError with code 'SERVICE_UNAVAILABLE'
    - DO NOT attempt to call the service
```

### 属性 4: 健康检查不阻塞

```
PROPERTY: NonBlockingHealthCheck
FOR ALL health checks:
  - healthMonitor.checkService(s) completes within s.timeout
  - healthMonitor.checkAllServices() runs in parallel
  - Failed health check does not affect other services
```

---

## Testing Strategy

### 单元测试

```typescript
// server/lib/__tests__/serviceRegistry.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceRegistry } from '../serviceRegistry';

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  it('should initialize with default services', () => {
    const configs = registry.getAllConfigs();
    expect(configs.length).toBe(4);
    expect(configs.map(c => c.name)).toContain('khoj');
    expect(configs.map(c => c.name)).toContain('janitor');
  });

  it('should update service status', () => {
    registry.updateStatus('khoj', { status: 'healthy', latency: 100 });
    const status = registry.getStatus('khoj');
    expect(status?.status).toBe('healthy');
    expect(status?.latency).toBe(100);
  });

  it('should check service availability', () => {
    registry.updateStatus('khoj', { status: 'healthy' });
    expect(registry.isAvailable('khoj')).toBe(true);
    
    registry.updateStatus('khoj', { status: 'unhealthy' });
    expect(registry.isAvailable('khoj')).toBe(false);
  });
});
```

### 集成测试

```typescript
// server/routerTrpc/__tests__/khoj.integration.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCaller } from '../_app';
import { serviceRegistry } from '../../lib/serviceRegistry';

describe('khojRouter integration', () => {
  const caller = createCaller({});

  beforeEach(() => {
    // 模拟服务可用
    serviceRegistry.updateStatus('khoj', { status: 'healthy' });
  });

  it('should return service unavailable when khoj is down', async () => {
    serviceRegistry.updateStatus('khoj', { status: 'unhealthy' });
    
    await expect(caller.khoj.chat({ message: 'test' }))
      .rejects.toThrow('SERVICE_UNAVAILABLE');
  });

  it('should return status with latency', async () => {
    serviceRegistry.updateStatus('khoj', { 
      status: 'healthy', 
      latency: 150,
      lastCheck: new Date().toISOString(),
    });
    
    const status = await caller.khoj.getStatus();
    expect(status.success).toBe(true);
    expect(status.latency).toBe(150);
  });
});
```

### E2E 测试

```typescript
// e2e/gateway.spec.ts

import { test, expect } from '@playwright/test';

test.describe('API Gateway', () => {
  test('should show all service statuses', async ({ page }) => {
    await page.goto('/settings');
    
    // 等待服务状态加载
    await expect(page.locator('[data-testid="service-status-khoj"]')).toBeVisible();
    await expect(page.locator('[data-testid="service-status-janitor"]')).toBeVisible();
    await expect(page.locator('[data-testid="service-status-seekdb"]')).toBeVisible();
  });

  test('should refresh service status on click', async ({ page }) => {
    await page.goto('/settings');
    
    const refreshButton = page.locator('[data-testid="refresh-status-button"]');
    await refreshButton.click();
    
    // 验证状态已更新
    await expect(page.locator('[data-testid="last-check-time"]')).toContainText(/刚刚|秒前/);
  });
});
```

---

## File Structure

```
get/blinko-main/
├── server/
│   ├── lib/
│   │   ├── serviceRegistry.ts      # 服务注册表
│   │   ├── healthMonitor.ts        # 健康监控器
│   │   ├── gatewayError.ts         # 统一错误处理
│   │   ├── khojClient.ts           # Khoj 客户端 (新建)
│   │   ├── janitorClient.ts        # Janitor 客户端 (已有)
│   │   ├── paperlessClient.ts      # Paperless 客户端 (已有)
│   │   └── seekdbClient.ts         # SeekDB 客户端 (已有)
│   └── routerTrpc/
│       ├── _app.ts                 # 添加 gateway router
│       ├── gateway.ts              # 网关路由 (新建)
│       ├── khoj.ts                 # Khoj 路由 (重构)
│       ├── janitor.ts              # Janitor 路由 (已有)
│       ├── paperless.ts            # Paperless 路由 (已有)
│       └── ingest.ts               # SeekDB 路由 (已有)
├── app/src/
│   ├── lib/
│   │   └── gateway.ts              # 前端网关服务
│   ├── hooks/
│   │   └── useServiceStatus.ts     # 服务状态 Hook
│   └── components/
│       └── Layout/
│           └── ServiceStatus.tsx   # 服务状态组件 (已有，需更新)
```
