/**
 * 文件管理 tRPC 路由
 * 
 * 双层架构:
 * - 快速层 (PostgreSQL): 文件列表、标签、文档类型、快速关键词搜索
 * - 深度搜索层 (SeekDB): 语义/向量搜索 - 仅在用户明确请求时使用
 */

import { router, authProcedure } from '../middleware';
import { z } from 'zod';
import { 
  SeekDBError, 
  createSeekDBClient,
  DEFAULT_SEEKDB_CONFIG,
} from '../lib/seekdbClient';
import { 
  getPostgresSearchService,
  type SearchFilters,
  type ListFilters,
  type ListOptions 
} from '../lib/postgresSearchService';
import { prisma } from '../prisma';

// ============ 辅助函数 ============

/**
 * 获取 PostgreSQL 搜索服务（快速操作）
 */
function getPostgresService() {
  return getPostgresSearchService();
}

/**
 * 获取 SeekDB 客户端（仅用于深度搜索）
 */
function getSeekDBClient() {
  const baseUrl = process.env.SEEKDB_API_URL || DEFAULT_SEEKDB_CONFIG.baseUrl;
  return createSeekDBClient({ baseUrl });
}

// ============ 输入验证 Schema ============

const listDocumentsInput = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  ordering: z.string().optional(),
  tagIds: z.array(z.number()).optional(),
  documentTypeId: z.number().optional(),
  correspondentId: z.number().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  type: z.string().optional(),
  accountId: z.number().optional(),
});

// 快速搜索输入 (PostgreSQL)
const fastSearchInput = z.object({
  query: z.string().min(1),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  accountId: z.number().optional(),
  type: z.string().optional(),
});

// 深度搜索输入 (SeekDB 向量搜索)
const deepSearchInput = z.object({
  query: z.string().min(1),
  alpha: z.number().min(0).max(1).default(0.7), // 默认偏向向量搜索
  sourceType: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});

// 混合搜索结果 schema
const hybridSearchResultSchema = z.object({
  id: z.string(),
  content: z.string(),
  source_type: z.string(),
  source_path: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  score: z.number(),
  text_score: z.number().nullable().optional(),
  vector_score: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
});

const hybridSearchResponseSchema = z.object({
  results: z.array(hybridSearchResultSchema),
  total: z.number(),
  query: z.string(),
  alpha: z.number(),
  embedding_available: z.boolean(),
});

const uploadDocumentInput = z.object({
  fileBase64: z.string(),
  filename: z.string(),
  title: z.string().optional(),
  documentTypeId: z.number().optional(),
  tagIds: z.array(z.number()).optional(),
});

const updateDocumentInput = z.object({
  id: z.number(),
  title: z.string().optional(),
  tagIds: z.array(z.number()).optional(),
  documentTypeId: z.number().nullable().optional(),
  correspondentId: z.number().nullable().optional(),
});

const createTagInput = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const createDocumentTypeInput = z.object({
  name: z.string().min(1).max(100),
});


// ============ 路由定义 ============

export const paperlessRouter = router({
  // ============ 文档操作 (PostgreSQL 快速层) ============

  /**
   * 获取文档列表 - 使用 PostgreSQL
   * 响应时间 <100ms
   */
  listDocuments: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/paperless/documents', 
        summary: '获取文档列表 (快速)', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(listDocumentsInput)
    .output(z.any())
    .query(async ({ input }) => {
      const service = getPostgresService();
      
      const filters: ListFilters = {};
      if (input.accountId) filters.accountId = input.accountId;
      if (input.type) filters.type = input.type;
      
      const options: ListOptions = {
        page: input.page,
        pageSize: input.pageSize,
        orderBy: 'createdAt',
        orderDir: input.ordering === 'created' ? 'asc' : 'desc'
      };
      
      const result = await service.list(filters, options);
      
      // 转换为前端期望的格式
      return {
        count: result.total,
        next: result.hasMore ? `?page=${input.page + 1}` : null,
        previous: input.page > 1 ? `?page=${input.page - 1}` : null,
        results: result.results.map(r => ({
          id: r.id,
          title: r.name,
          original_file_name: r.name,
          created: r.createdAt.toISOString(),
          modified: r.updatedAt.toISOString(),
          added: r.createdAt.toISOString(),
          archive_serial_number: null,
          correspondent: null,
          document_type: null,
          storage_path: r.path,
          tags: [],
          content: '',
          notes: [],
        }))
      };
    }),

  /**
   * 快速搜索 - 使用 PostgreSQL pg_trgm
   * 响应时间 <100ms，适合实时搜索
   */
  searchDocuments: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/paperless/documents/search', 
        summary: '快速搜索 (PostgreSQL)', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(fastSearchInput)
    .output(z.any())
    .query(async ({ input }) => {
      const service = getPostgresService();
      
      const filters: SearchFilters = {};
      if (input.accountId) filters.accountId = input.accountId;
      if (input.type) filters.type = input.type;
      
      const result = await service.search(
        input.query,
        filters,
        input.page,
        input.pageSize
      );
      
      // 转换为前端期望的格式
      return {
        count: result.total,
        next: result.hasMore ? `?page=${input.page + 1}` : null,
        previous: input.page > 1 ? `?page=${input.page - 1}` : null,
        results: result.results.map(r => ({
          id: r.id,
          title: r.name,
          original_file_name: r.name,
          created: r.createdAt.toISOString(),
          modified: r.updatedAt.toISOString(),
          added: r.createdAt.toISOString(),
          archive_serial_number: null,
          correspondent: null,
          document_type: null,
          storage_path: r.path,
          tags: [],
          content: '',
          notes: [],
          score: r.score,  // 相似度分数
        }))
      };
    }),

  /**
   * 获取文档详情 - 使用 PostgreSQL
   */
  getDocument: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/paperless/documents/{id}', 
        summary: '获取文档详情', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(z.object({ id: z.number() }))
    .output(z.any())
    .query(async ({ input }) => {
      const service = getPostgresService();
      const doc = await service.getById(input.id);
      
      if (!doc) {
        throw new Error('文档不存在');
      }
      
      return {
        id: doc.id,
        title: doc.name,
        original_file_name: doc.name,
        created: doc.createdAt.toISOString(),
        modified: doc.updatedAt.toISOString(),
        added: doc.createdAt.toISOString(),
        archive_serial_number: null,
        correspondent: null,
        document_type: null,
        storage_path: doc.path,
        tags: [],
        content: '',
        notes: [],
      };
    }),

  /**
   * 上传文档 - 直接存储到 PostgreSQL
   */
  uploadDocument: authProcedure
    .meta({ 
      openapi: { 
        method: 'POST', 
        path: '/v1/paperless/documents/upload', 
        summary: '上传文档', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(uploadDocumentInput)
    .output(z.object({ task_id: z.string() }))
    .mutation(async ({ input }) => {
      // 创建附件记录
      const attachment = await prisma.attachments.create({
        data: {
          name: input.title || input.filename,
          path: `/uploads/${Date.now()}_${input.filename}`,
          type: input.filename.split('.').pop() || 'unknown',
          size: Buffer.from(input.fileBase64, 'base64').length,
        }
      });
      
      // TODO: 实际保存文件到存储
      // TODO: 如果是视频/PPT，触发 ingest 处理
      
      return { task_id: `local_${attachment.id}` };
    }),

  /**
   * 下载文档
   */
  downloadDocument: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/paperless/documents/{id}/download', 
        summary: '下载文档', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(z.object({ id: z.number() }))
    .output(z.object({ data: z.string(), filename: z.string() }))
    .query(async ({ input }) => {
      const service = getPostgresService();
      const doc = await service.getById(input.id);
      
      if (!doc) {
        throw new Error('文档不存在');
      }
      
      // TODO: 从存储读取文件内容
      return {
        data: '',  // base64 内容
        filename: doc.name,
      };
    }),

  /**
   * 获取文档预览
   */
  getPreview: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/paperless/documents/{id}/preview', 
        summary: '获取文档预览', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(z.object({ id: z.number() }))
    .output(z.object({ data: z.string(), contentType: z.string() }))
    .query(async ({ input }) => {
      const service = getPostgresService();
      const doc = await service.getById(input.id);
      
      if (!doc) {
        throw new Error('文档不存在');
      }
      
      // TODO: 生成预览
      return {
        data: '',
        contentType: 'application/pdf',
      };
    }),

  /**
   * 获取文档缩略图
   */
  getThumbnail: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/paperless/documents/{id}/thumbnail', 
        summary: '获取文档缩略图', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(z.object({ id: z.number() }))
    .output(z.object({ data: z.string(), contentType: z.string() }))
    .query(async ({ input }) => {
      const service = getPostgresService();
      const doc = await service.getById(input.id);
      
      if (!doc) {
        throw new Error('文档不存在');
      }
      
      // TODO: 生成缩略图
      return {
        data: '',
        contentType: 'image/webp',
      };
    }),

  /**
   * 更新文档
   */
  updateDocument: authProcedure
    .meta({ 
      openapi: { 
        method: 'PATCH', 
        path: '/v1/paperless/documents/{id}', 
        summary: '更新文档', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(updateDocumentInput)
    .output(z.any())
    .mutation(async ({ input }) => {
      const updated = await prisma.attachments.update({
        where: { id: input.id },
        data: {
          name: input.title,
        }
      });
      
      return {
        id: updated.id,
        title: updated.name,
      };
    }),

  /**
   * 删除文档
   */
  deleteDocument: authProcedure
    .meta({ 
      openapi: { 
        method: 'DELETE', 
        path: '/v1/paperless/documents/{id}', 
        summary: '删除文档', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(z.object({ id: z.number() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      await prisma.attachments.delete({
        where: { id: input.id }
      });
      return { success: true };
    }),


  // ============ 标签操作 (PostgreSQL) ============

  /**
   * 获取标签列表
   */
  listTags: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/paperless/tags', 
        summary: '获取标签列表', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(z.void())
    .output(z.any())
    .query(async () => {
      const tags = await prisma.tag.findMany({
        orderBy: { name: 'asc' }
      });
      
      return {
        count: tags.length,
        results: tags.map(t => ({
          id: t.id,
          name: t.name,
          color: t.icon || '#3B82F6',
          slug: t.name.toLowerCase().replace(/\s+/g, '-'),
          match: '',
          matching_algorithm: 0,
          is_insensitive: true,
          document_count: 0,
        }))
      };
    }),

  /**
   * 创建标签
   */
  createTag: authProcedure
    .meta({ 
      openapi: { 
        method: 'POST', 
        path: '/v1/paperless/tags', 
        summary: '创建标签', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(createTagInput)
    .output(z.any())
    .mutation(async ({ input }) => {
      const tag = await prisma.tag.create({
        data: {
          name: input.name,
          icon: input.color || '#3B82F6',
        }
      });
      
      return {
        id: tag.id,
        name: tag.name,
        color: tag.icon,
      };
    }),

  /**
   * 删除标签
   */
  deleteTag: authProcedure
    .meta({ 
      openapi: { 
        method: 'DELETE', 
        path: '/v1/paperless/tags/{id}', 
        summary: '删除标签', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(z.object({ id: z.number() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      await prisma.tag.delete({
        where: { id: input.id }
      });
      return { success: true };
    }),

  // ============ 文档类型操作 (PostgreSQL) ============

  /**
   * 获取文档类型列表
   * 从 attachments 表的 type 字段聚合
   */
  listDocumentTypes: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/paperless/document-types', 
        summary: '获取文档类型列表', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(z.void())
    .output(z.any())
    .query(async () => {
      // 从 attachments 表聚合文档类型
      const types = await prisma.attachments.groupBy({
        by: ['type'],
        _count: { type: true }
      });
      
      return {
        count: types.length,
        results: types.map((t, idx) => ({
          id: idx + 1,
          name: t.type || 'unknown',
          slug: (t.type || 'unknown').toLowerCase(),
          match: '',
          matching_algorithm: 0,
          is_insensitive: true,
          document_count: t._count.type,
        }))
      };
    }),

  /**
   * 创建文档类型
   */
  createDocumentType: authProcedure
    .meta({ 
      openapi: { 
        method: 'POST', 
        path: '/v1/paperless/document-types', 
        summary: '创建文档类型', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(createDocumentTypeInput)
    .output(z.any())
    .mutation(async ({ input }) => {
      // 文档类型是从 attachments.type 聚合的，不需要单独存储
      return {
        id: Date.now(),
        name: input.name,
        slug: input.name.toLowerCase(),
      };
    }),

  // ============ 通讯者操作 ============

  /**
   * 获取通讯者列表
   */
  listCorrespondents: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/paperless/correspondents', 
        summary: '获取通讯者列表', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(z.void())
    .output(z.any())
    .query(async () => {
      // 暂不支持通讯者功能
      return {
        count: 0,
        results: []
      };
    }),

  // ============ 配置操作 ============

  /**
   * 获取配置
   */
  getConfig: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/paperless/config', 
        summary: '获取配置', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(z.void())
    .output(z.object({
      baseUrl: z.string(),
      apiToken: z.string(),
      enabled: z.boolean(),
    }).nullable())
    .query(async () => {
      const baseUrl = process.env.SEEKDB_API_URL || DEFAULT_SEEKDB_CONFIG.baseUrl;
      return {
        baseUrl,
        apiToken: 'not-required',
        enabled: true,
      };
    }),

  /**
   * 保存配置
   */
  saveConfig: authProcedure
    .meta({ 
      openapi: { 
        method: 'POST', 
        path: '/v1/paperless/config', 
        summary: '保存配置', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(z.object({
      baseUrl: z.string(),
      apiToken: z.string().optional(),
      enabled: z.boolean().default(true),
    }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      // 测试 SeekDB 连接（如果提供了 URL）
      if (input.baseUrl) {
        try {
          const client = createSeekDBClient({ baseUrl: input.baseUrl });
          await client.testConnection();
        } catch {
          // SeekDB 连接失败不影响基本功能
          console.warn('SeekDB 连接测试失败，深度搜索功能可能不可用');
        }
      }
      return { success: true };
    }),

  /**
   * 测试连接
   */
  testConnection: authProcedure
    .meta({ 
      openapi: { 
        method: 'POST', 
        path: '/v1/paperless/test-connection', 
        summary: '测试连接', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(z.object({
      baseUrl: z.string(),
      apiToken: z.string().optional(),
    }))
    .output(z.object({ 
      success: z.boolean(), 
      error: z.string().nullable(),
      postgresOk: z.boolean(),
      seekdbOk: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      let postgresOk = false;
      let seekdbOk = false;
      let error: string | null = null;
      
      // 测试 PostgreSQL
      try {
        await prisma.$queryRaw`SELECT 1`;
        postgresOk = true;
      } catch (e) {
        error = `PostgreSQL 连接失败: ${e instanceof Error ? e.message : '未知错误'}`;
      }
      
      // 测试 SeekDB（可选）
      if (input.baseUrl) {
        try {
          const client = createSeekDBClient({ baseUrl: input.baseUrl });
          await client.testConnection();
          seekdbOk = true;
        } catch (e) {
          // SeekDB 失败不是致命错误
          console.warn('SeekDB 连接失败:', e);
        }
      }
      
      return { 
        success: postgresOk, 
        error,
        postgresOk,
        seekdbOk,
      };
    }),

  // ============ 深度搜索 API (SeekDB) ============

  /**
   * 深度搜索（向量 + 全文）
   * 仅在用户明确请求时使用
   * 
   * alpha 参数控制搜索权重:
   * - alpha = 0: 纯全文搜索
   * - alpha = 1: 纯向量搜索
   * - 0 < alpha < 1: 混合搜索
   */
  hybridSearch: authProcedure
    .meta({ 
      openapi: { 
        method: 'POST', 
        path: '/v1/paperless/search/hybrid', 
        summary: '深度搜索（向量+全文）', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(deepSearchInput)
    .output(hybridSearchResponseSchema)
    .mutation(async ({ input }) => {
      try {
        const client = getSeekDBClient();
        return await client.hybridSearch({
          query: input.query,
          alpha: input.alpha,
          source_type: input.sourceType,
          limit: input.limit,
        });
      } catch (error) {
        // SeekDB 不可用时，回退到 PostgreSQL 搜索
        console.warn('SeekDB 不可用，回退到 PostgreSQL 搜索:', error);
        
        const service = getPostgresService();
        const result = await service.search(input.query, {}, 1, input.limit);
        
        return {
          results: result.results.map(r => ({
            id: String(r.id),
            content: r.name,
            source_type: r.type,
            source_path: r.path,
            metadata: r.metadata || {},
            score: r.score,
            text_score: r.score,
            vector_score: null,
            created_at: r.createdAt.toISOString(),
          })),
          total: result.total,
          query: input.query,
          alpha: 0,  // 回退到纯文本搜索
          embedding_available: false,
        };
      }
    }),

  /**
   * 获取 embedding 服务状态
   */
  getEmbeddingStatus: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/paperless/embedding/status', 
        summary: '获取 embedding 服务状态', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(z.void())
    .output(z.object({
      available: z.boolean(),
      model: z.string(),
      host: z.string(),
    }))
    .query(async () => {
      try {
        const client = getSeekDBClient();
        return await client.getEmbeddingStatus();
      } catch {
        return {
          available: false,
          model: 'unknown',
          host: 'unknown',
        };
      }
    }),

  /**
   * 生成文本 embedding
   */
  generateEmbedding: authProcedure
    .meta({ 
      openapi: { 
        method: 'POST', 
        path: '/v1/paperless/embedding/generate', 
        summary: '生成文本 embedding', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(z.object({ text: z.string().min(1) }))
    .output(z.object({
      embedding: z.array(z.number()).nullable(),
      success: z.boolean(),
      error: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const client = getSeekDBClient();
        return await client.generateEmbedding(input.text);
      } catch (error) {
        return {
          embedding: null,
          success: false,
          error: error instanceof SeekDBError ? error.message : '生成 embedding 失败',
        };
      }
    }),

  // ============ 统计信息 ============

  /**
   * 获取文件统计信息
   */
  getStats: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/paperless/stats', 
        summary: '获取文件统计信息', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(z.object({ accountId: z.number().optional() }))
    .output(z.object({
      totalCount: z.number(),
      indexedCount: z.number(),
      totalSize: z.number(),
    }))
    .query(async ({ input }) => {
      const service = getPostgresService();
      return await service.getStats(input.accountId);
    }),
});
