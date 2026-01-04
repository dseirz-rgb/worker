/**
 * Ingest tRPC 路由
 * 文件处理和摄入服务
 * 
 * 功能：
 * - 上传视频/PPT 文件
 * - 查询处理状态
 * - 重试失败任务
 * - 获取队列状态
 */

import { router, authProcedure } from '../middleware';
import { z } from 'zod/v3';

// ============ 配置 ============

const DEFAULT_INGEST_CONFIG = {
  baseUrl: process.env.INGEST_API_URL || 'http://localhost:8766',
};

// ============ 类型定义 ============

interface IngestTask {
  task_id: string;
  file_path: string;
  file_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  chunks_count: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  queue_running: boolean;
}

// ============ 客户端 ============

class IngestClient {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_INGEST_CONFIG.baseUrl) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('请求失败');
    }
  }

  async getHealth(): Promise<{ status: string; service: string; timestamp: string }> {
    return this.request('/health');
  }

  async processFile(
    filePath: string,
    fileType: string,
    options?: { generate_embedding?: boolean; whisper_model?: string }
  ): Promise<{ task_id: string; status: string; message: string }> {
    return this.request('/process', {
      method: 'POST',
      body: JSON.stringify({
        file_path: filePath,
        file_type: fileType,
        options,
      }),
    });
  }

  async getTaskStatus(taskId: string): Promise<IngestTask> {
    return this.request(`/tasks/${taskId}`);
  }

  async listTasks(
    status?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ tasks: IngestTask[]; total: number }> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    
    return this.request(`/tasks?${params.toString()}`);
  }

  async retryTask(taskId: string): Promise<{ task_id: string; status: string; message: string }> {
    return this.request(`/tasks/${taskId}/retry`, { method: 'POST' });
  }

  async cancelTask(taskId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/tasks/${taskId}`, { method: 'DELETE' });
  }

  async getQueueStatus(): Promise<QueueStatus> {
    return this.request('/queue/status');
  }
}

function getIngestClient(): IngestClient {
  return new IngestClient();
}

// ============ 输入验证 Schema ============

const processFileInput = z.object({
  filePath: z.string().min(1),
  fileType: z.enum(['video', 'ppt']),
  generateEmbedding: z.boolean().default(true),
  whisperModel: z.string().default('base'),
});

const getTaskInput = z.object({
  taskId: z.string().min(1),
});

const listTasksInput = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

const retryTaskInput = z.object({
  taskId: z.string().min(1),
});

const cancelTaskInput = z.object({
  taskId: z.string().min(1),
});

// ============ 输出 Schema ============

const taskSchema = z.object({
  task_id: z.string(),
  file_path: z.string(),
  file_type: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  progress: z.number(),
  chunks_count: z.number(),
  error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
});

const taskListSchema = z.object({
  tasks: z.array(taskSchema),
  total: z.number(),
});

const queueStatusSchema = z.object({
  pending: z.number(),
  processing: z.number(),
  completed: z.number(),
  failed: z.number(),
  queue_running: z.boolean(),
});

const processResponseSchema = z.object({
  task_id: z.string(),
  status: z.string(),
  message: z.string(),
});

// ============ 路由定义 ============

export const ingestRouter = router({
  /**
   * 获取服务状态
   */
  getHealth: authProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/v1/ingest/health',
        summary: '获取 Ingest 服务状态',
        protect: true,
        tags: ['Ingest'],
      },
    })
    .input(z.void())
    .output(z.object({
      status: z.string(),
      service: z.string(),
      timestamp: z.string(),
    }))
    .query(async () => {
      const client = getIngestClient();
      return client.getHealth();
    }),

  /**
   * 处理文件
   */
  processFile: authProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/v1/ingest/process',
        summary: '处理视频/PPT 文件',
        protect: true,
        tags: ['Ingest'],
      },
    })
    .input(processFileInput)
    .output(processResponseSchema)
    .mutation(async ({ input }) => {
      const client = getIngestClient();
      return client.processFile(input.filePath, input.fileType, {
        generate_embedding: input.generateEmbedding,
        whisper_model: input.whisperModel,
      });
    }),

  /**
   * 获取任务状态
   */
  getTaskStatus: authProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/v1/ingest/tasks/{taskId}',
        summary: '获取任务状态',
        protect: true,
        tags: ['Ingest'],
      },
    })
    .input(getTaskInput)
    .output(taskSchema)
    .query(async ({ input }) => {
      const client = getIngestClient();
      return client.getTaskStatus(input.taskId);
    }),

  /**
   * 获取任务列表
   */
  listTasks: authProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/v1/ingest/tasks',
        summary: '获取任务列表',
        protect: true,
        tags: ['Ingest'],
      },
    })
    .input(listTasksInput)
    .output(taskListSchema)
    .query(async ({ input }) => {
      const client = getIngestClient();
      return client.listTasks(input.status, input.limit, input.offset);
    }),

  /**
   * 重试任务
   */
  retryTask: authProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/v1/ingest/tasks/{taskId}/retry',
        summary: '重试失败的任务',
        protect: true,
        tags: ['Ingest'],
      },
    })
    .input(retryTaskInput)
    .output(processResponseSchema)
    .mutation(async ({ input }) => {
      const client = getIngestClient();
      return client.retryTask(input.taskId);
    }),

  /**
   * 取消任务
   */
  cancelTask: authProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/v1/ingest/tasks/{taskId}',
        summary: '取消/删除任务',
        protect: true,
        tags: ['Ingest'],
      },
    })
    .input(cancelTaskInput)
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
    }))
    .mutation(async ({ input }) => {
      const client = getIngestClient();
      return client.cancelTask(input.taskId);
    }),

  /**
   * 获取队列状态
   */
  getQueueStatus: authProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/v1/ingest/queue/status',
        summary: '获取处理队列状态',
        protect: true,
        tags: ['Ingest'],
      },
    })
    .input(z.void())
    .output(queueStatusSchema)
    .query(async () => {
      const client = getIngestClient();
      return client.getQueueStatus();
    }),
});
