/**
 * Janitor tRPC 路由
 * AI 驱动的文件整理服务（基于 LlamaFS）
 * 
 * 功能：
 * - 分析目录并获取 AI 分类建议
 * - 提交文件移动操作
 * - 查看操作历史
 * - 撤销操作
 */

import { router, authProcedure } from '../middleware';
import { z } from 'zod';
import { 
  JanitorClient, 
  JanitorError, 
  createJanitorClient,
  DEFAULT_JANITOR_CONFIG,
  JanitorFullConfig,
  CategoryConfig,
  PathValidationResult,
} from '../lib/janitorClient';

// ============ 辅助函数 ============

/**
 * 获取 Janitor 客户端
 */
function getJanitorClient(): JanitorClient {
  const baseUrl = process.env.JANITOR_API_URL || DEFAULT_JANITOR_CONFIG.baseUrl;
  return createJanitorClient({ baseUrl });
}

// ============ 输入验证 Schema ============

const analyzeDirectoryInput = z.object({
  path: z.string().min(1),
  instruction: z.string().optional(),
});

const commitMoveInput = z.object({
  basePath: z.string().min(1),
  srcPath: z.string().min(1),
  dstPath: z.string().min(1),
  category: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().optional(),
});

const commitBatchInput = z.object({
  basePath: z.string().min(1),
  suggestions: z.array(z.object({
    src_path: z.string(),
    dst_path: z.string(),
    category: z.string(),
    confidence: z.number(),
    reason: z.string(),
    summary: z.string(),
  })),
});

const historyInput = z.object({
  limit: z.number().min(1).max(1000).default(100),
});

const undoInput = z.object({
  count: z.number().min(1).max(100).optional(),
  since: z.string().optional(),
});

const testConnectionInput = z.object({
  baseUrl: z.string(),
});

// ============ 配置管理 Schema ============

const groqConfigSchema = z.object({
  model: z.string(),
});

const ollamaConfigSchema = z.object({
  host: z.string(),
  model: z.string(),
});

const seekdbConfigSchema = z.object({
  auto_index: z.boolean(),
});

const categoryConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  path: z.string(),
  keywords: z.array(z.string()),
  color: z.string().optional(),
});

const fullConfigSchema = z.object({
  groq: groqConfigSchema,
  ollama: ollamaConfigSchema,
  inbox_dirs: z.array(z.string()),
  output_base: z.string(),
  confidence_threshold: z.number().min(0).max(1),
  categories: z.record(z.string(), categoryConfigSchema),
  seekdb: seekdbConfigSchema,
});

const updateConfigInput = z.object({
  groq: groqConfigSchema.optional(),
  ollama: ollamaConfigSchema.optional(),
  inbox_dirs: z.array(z.string()).optional(),
  output_base: z.string().optional(),
  confidence_threshold: z.number().min(0).max(1).optional(),
  categories: z.record(z.string(), categoryConfigSchema).optional(),
  seekdb: seekdbConfigSchema.optional(),
});

const validatePathInput = z.object({
  path: z.string().min(1),
});

const validatePathsInput = z.object({
  paths: z.array(z.string().min(1)),
});

const pathValidationResultSchema = z.object({
  path: z.string(),
  expanded_path: z.string(),
  exists: z.boolean(),
  is_dir: z.boolean(),
  is_file: z.boolean(),
  is_writable: z.boolean(),
  parent_exists: z.boolean(),
});

const addCategoryInput = z.object({
  categoryId: z.string().min(1),
  path: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  name: z.string().optional(),
  color: z.string().optional(),
});

const updateCategoryInput = z.object({
  categoryId: z.string().min(1),
  path: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  name: z.string().optional(),
  color: z.string().optional(),
});

const deleteCategoryInput = z.object({
  categoryId: z.string().min(1),
});

// ============ 路由定义 ============

export const janitorRouter = router({
  // ============ 核心操作 ============

  /**
   * 分析目录
   * 返回 AI 建议的文件分类和重命名方案
   */
  analyzeDirectory: authProcedure
    .meta({ 
      openapi: { 
        method: 'POST', 
        path: '/v1/janitor/analyze', 
        summary: '分析目录获取分类建议', 
        protect: true, 
        tags: ['Janitor'] 
      } 
    })
    .input(analyzeDirectoryInput)
    .output(z.array(z.object({
      src_path: z.string(),
      dst_path: z.string(),
      category: z.string(),
      confidence: z.number(),
      reason: z.string(),
      summary: z.string(),
    })))
    .mutation(async ({ input }) => {
      const client = getJanitorClient();
      return client.analyzeDirectory(input.path, input.instruction);
    }),

  /**
   * 提交单个文件移动
   */
  commitMove: authProcedure
    .meta({ 
      openapi: { 
        method: 'POST', 
        path: '/v1/janitor/commit', 
        summary: '提交文件移动', 
        protect: true, 
        tags: ['Janitor'] 
      } 
    })
    .input(commitMoveInput)
    .output(z.object({ message: z.string() }))
    .mutation(async ({ input }) => {
      const client = getJanitorClient();
      return client.commitMove({
        base_path: input.basePath,
        src_path: input.srcPath,
        dst_path: input.dstPath,
        category: input.category,
        confidence: input.confidence,
        reason: input.reason,
      });
    }),

  /**
   * 批量提交文件移动
   */
  commitBatch: authProcedure
    .meta({ 
      openapi: { 
        method: 'POST', 
        path: '/v1/janitor/commit-batch', 
        summary: '批量提交文件移动', 
        protect: true, 
        tags: ['Janitor'] 
      } 
    })
    .input(commitBatchInput)
    .output(z.object({
      success: z.number(),
      failed: z.number(),
      results: z.array(z.object({
        success: z.boolean(),
        error: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const client = getJanitorClient();
      return client.commitBatch(input.basePath, input.suggestions);
    }),

  // ============ 历史和撤销 ============

  /**
   * 获取操作历史
   */
  getHistory: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/janitor/history', 
        summary: '获取操作历史', 
        protect: true, 
        tags: ['Janitor'] 
      } 
    })
    .input(historyInput)
    .output(z.object({
      count: z.number(),
      records: z.array(z.object({
        timestamp: z.string(),
        src_path: z.string(),
        dst_path: z.string(),
        original_name: z.string(),
        new_name: z.string(),
        category: z.string(),
        confidence: z.number(),
        reason: z.string(),
      })),
    }))
    .query(async ({ input }) => {
      const client = getJanitorClient();
      return client.getHistory(input.limit);
    }),

  /**
   * 撤销操作
   */
  undo: authProcedure
    .meta({ 
      openapi: { 
        method: 'POST', 
        path: '/v1/janitor/undo', 
        summary: '撤销操作', 
        protect: true, 
        tags: ['Janitor'] 
      } 
    })
    .input(undoInput)
    .output(z.object({
      total: z.number(),
      success: z.number(),
      failed: z.number(),
      results: z.array(z.object({
        success: z.boolean(),
        src_path: z.string(),
        dst_path: z.string(),
        error: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const client = getJanitorClient();
      if (input.since) {
        return client.undoSince(input.since);
      }
      return client.undoLast(input.count || 1);
    }),

  // ============ 配置和状态 ============

  /**
   * 获取配置
   */
  getConfig: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/janitor/config', 
        summary: '获取 Janitor 配置', 
        protect: true, 
        tags: ['Janitor'] 
      } 
    })
    .input(z.void())
    .output(z.object({
      baseUrl: z.string(),
      enabled: z.boolean(),
    }))
    .query(async () => {
      const baseUrl = process.env.JANITOR_API_URL || DEFAULT_JANITOR_CONFIG.baseUrl;
      return {
        baseUrl,
        enabled: true,
      };
    }),

  /**
   * 获取服务状态
   */
  getHealth: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/janitor/health', 
        summary: '获取服务状态', 
        protect: true, 
        tags: ['Janitor'] 
      } 
    })
    .input(z.void())
    .output(z.object({
      status: z.string(),
      service: z.string(),
      version: z.string(),
    }))
    .query(async () => {
      const client = getJanitorClient();
      return client.getHealth();
    }),

  /**
   * 测试连接
   */
  testConnection: authProcedure
    .meta({ 
      openapi: { 
        method: 'POST', 
        path: '/v1/janitor/test-connection', 
        summary: '测试 Janitor 连接', 
        protect: true, 
        tags: ['Janitor'] 
      } 
    })
    .input(testConnectionInput)
    .output(z.object({ 
      success: z.boolean(), 
      error: z.string().nullable() 
    }))
    .mutation(async ({ input }) => {
      try {
        // 如果 baseUrl 为空，使用默认配置
        const url = input.baseUrl || process.env.JANITOR_API_URL || DEFAULT_JANITOR_CONFIG.baseUrl;
        const client = createJanitorClient({ baseUrl: url });
        await client.testConnection();
        return { success: true, error: null };
      } catch (error) {
        const message = error instanceof JanitorError 
          ? error.message 
          : '连接测试失败';
        return { success: false, error: message };
      }
    }),

  // ============ 配置管理端点 ============

  /**
   * 获取完整配置
   */
  getFullConfig: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/janitor/full-config', 
        summary: '获取 Janitor 完整配置', 
        protect: true, 
        tags: ['Janitor'] 
      } 
    })
    .input(z.void())
    .output(fullConfigSchema)
    .query(async () => {
      const client = getJanitorClient();
      return client.getFullConfig();
    }),

  /**
   * 更新配置
   */
  updateFullConfig: authProcedure
    .meta({ 
      openapi: { 
        method: 'POST', 
        path: '/v1/janitor/full-config', 
        summary: '更新 Janitor 配置', 
        protect: true, 
        tags: ['Janitor'] 
      } 
    })
    .input(updateConfigInput)
    .output(fullConfigSchema)
    .mutation(async ({ input }) => {
      const client = getJanitorClient();
      return client.updateConfig(input);
    }),

  /**
   * 验证单个路径
   */
  validatePath: authProcedure
    .meta({ 
      openapi: { 
        method: 'POST', 
        path: '/v1/janitor/validate-path', 
        summary: '验证路径是否存在', 
        protect: true, 
        tags: ['Janitor'] 
      } 
    })
    .input(validatePathInput)
    .output(pathValidationResultSchema)
    .mutation(async ({ input }) => {
      const client = getJanitorClient();
      return client.validatePath(input.path);
    }),

  /**
   * 批量验证路径
   */
  validatePaths: authProcedure
    .meta({ 
      openapi: { 
        method: 'POST', 
        path: '/v1/janitor/validate-paths', 
        summary: '批量验证路径', 
        protect: true, 
        tags: ['Janitor'] 
      } 
    })
    .input(validatePathsInput)
    .output(z.array(pathValidationResultSchema))
    .mutation(async ({ input }) => {
      const client = getJanitorClient();
      return client.validatePaths(input.paths);
    }),

  /**
   * 获取所有分类
   */
  getCategories: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/janitor/categories', 
        summary: '获取所有分类', 
        protect: true, 
        tags: ['Janitor'] 
      } 
    })
    .input(z.void())
    .output(z.record(z.string(), categoryConfigSchema))
    .query(async () => {
      const client = getJanitorClient();
      return client.getCategories();
    }),

  /**
   * 添加分类
   */
  addCategory: authProcedure
    .meta({ 
      openapi: { 
        method: 'POST', 
        path: '/v1/janitor/categories', 
        summary: '添加分类', 
        protect: true, 
        tags: ['Janitor'] 
      } 
    })
    .input(addCategoryInput)
    .output(categoryConfigSchema)
    .mutation(async ({ input }) => {
      const client = getJanitorClient();
      return client.addCategory(input.categoryId, {
        path: input.path,
        keywords: input.keywords,
        name: input.name,
        color: input.color,
      });
    }),

  /**
   * 更新分类
   */
  updateCategory: authProcedure
    .meta({ 
      openapi: { 
        method: 'PUT', 
        path: '/v1/janitor/categories/{categoryId}', 
        summary: '更新分类', 
        protect: true, 
        tags: ['Janitor'] 
      } 
    })
    .input(updateCategoryInput)
    .output(categoryConfigSchema)
    .mutation(async ({ input }) => {
      const { categoryId, ...updates } = input;
      const client = getJanitorClient();
      return client.updateCategory(categoryId, updates);
    }),

  /**
   * 删除分类
   */
  deleteCategory: authProcedure
    .meta({ 
      openapi: { 
        method: 'DELETE', 
        path: '/v1/janitor/categories/{categoryId}', 
        summary: '删除分类', 
        protect: true, 
        tags: ['Janitor'] 
      } 
    })
    .input(deleteCategoryInput)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      const client = getJanitorClient();
      return client.deleteCategory(input.categoryId);
    }),
});
