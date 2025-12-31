/**
 * 文件管理 tRPC 路由
 * 使用 SeekDB 作为后端（替代 Paperless-ngx）
 */

import { router, authProcedure } from '../middleware';
import { z } from 'zod';
import { 
  SeekDBClient, 
  SeekDBError, 
  createSeekDBClient,
  DEFAULT_SEEKDB_CONFIG,
  type SeekDBConfig 
} from '../lib/seekdbClient';

// ============ 类型定义 ============

interface SeekDBConfigValue {
  baseUrl: string;
  enabled: boolean;
}

// ============ 辅助函数 ============

/**
 * 获取 SeekDB 客户端
 * SeekDB 不需要 API Token，直接连接即可
 */
function getSeekDBClient(): SeekDBClient {
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
});

const searchDocumentsInput = z.object({
  query: z.string().min(1),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
});

// 混合搜索输入
const hybridSearchInput = z.object({
  query: z.string().min(1),
  alpha: z.number().min(0).max(1).default(0.5),
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

const seekdbConfigInput = z.object({
  baseUrl: z.string().url(),
  enabled: z.boolean().default(true),
});


// ============ 路由定义 ============

export const paperlessRouter = router({
  // ============ 文档操作 ============

  /**
   * 获取文档列表
   */
  listDocuments: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/paperless/documents', 
        summary: '获取文档列表', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(listDocumentsInput)
    .output(z.any())
    .query(async ({ input }) => {
      const client = getSeekDBClient();
      return client.listDocuments({
        page: input.page,
        page_size: input.pageSize,
        ordering: input.ordering,
        tags__id__in: input.tagIds,
        document_type__id: input.documentTypeId,
        correspondent__id: input.correspondentId,
        created__date__gt: input.dateFrom,
        created__date__lt: input.dateTo,
      });
    }),

  /**
   * 搜索文档
   */
  searchDocuments: authProcedure
    .meta({ 
      openapi: { 
        method: 'GET', 
        path: '/v1/paperless/documents/search', 
        summary: '搜索文档', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(searchDocumentsInput)
    .output(z.any())
    .query(async ({ input }) => {
      const client = getSeekDBClient();
      return client.searchDocuments(input.query, {
        page: input.page,
        page_size: input.pageSize,
      });
    }),

  /**
   * 获取文档详情
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
      const client = getSeekDBClient();
      return client.getDocument(input.id);
    }),

  /**
   * 上传文档
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
      const client = getSeekDBClient();
      const buffer = Buffer.from(input.fileBase64, 'base64');
      return client.uploadDocument(buffer, input.filename, {
        title: input.title,
        document_type: input.documentTypeId,
        tags: input.tagIds,
      });
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
      const client = getSeekDBClient();
      const [buffer, doc] = await Promise.all([
        client.downloadDocument(input.id),
        client.getDocument(input.id),
      ]);
      return {
        data: buffer.toString('base64'),
        filename: doc.original_file_name || `document-${input.id}`,
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
      const client = getSeekDBClient();
      const buffer = await client.getDocumentPreview(input.id);
      return {
        data: buffer.toString('base64'),
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
      const client = getSeekDBClient();
      const buffer = await client.getDocumentThumbnail(input.id);
      return {
        data: buffer.toString('base64'),
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
      const client = getSeekDBClient();
      return client.updateDocument(input.id, {
        title: input.title,
        tags: input.tagIds,
        document_type: input.documentTypeId,
        correspondent: input.correspondentId,
      });
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
      const client = getSeekDBClient();
      await client.deleteDocument(input.id);
      return { success: true };
    }),


  // ============ 标签操作 ============

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
      const client = getSeekDBClient();
      return client.listTags();
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
      const client = getSeekDBClient();
      return client.createTag(input);
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
      const client = getSeekDBClient();
      await client.deleteTag(input.id);
      return { success: true };
    }),

  // ============ 文档类型操作 ============

  /**
   * 获取文档类型列表
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
      const client = getSeekDBClient();
      return client.listDocumentTypes();
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
      const client = getSeekDBClient();
      return client.createDocumentType(input);
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
      const client = getSeekDBClient();
      return client.listCorrespondents();
    }),

  // ============ 配置操作 ============

  /**
   * 获取配置
   * SeekDB 不需要复杂配置，返回默认值
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
      // SeekDB 默认启用，不需要 API Token
      const baseUrl = process.env.SEEKDB_API_URL || DEFAULT_SEEKDB_CONFIG.baseUrl;
      return {
        baseUrl,
        apiToken: 'not-required',  // SeekDB 不需要 Token
        enabled: true,
      };
    }),

  /**
   * 保存配置
   * SeekDB 配置简化，只需要 baseUrl
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
      baseUrl: z.string().url(),
      apiToken: z.string().optional(),  // 忽略，SeekDB 不需要
      enabled: z.boolean().default(true),
    }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      // 测试连接
      const client = createSeekDBClient({ baseUrl: input.baseUrl });
      await client.testConnection();
      
      // SeekDB 配置通过环境变量管理，这里只验证连接
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
      baseUrl: z.string(),  // 允许空字符串，使用默认配置
      apiToken: z.string().optional(),  // 忽略
    }))
    .output(z.object({ 
      success: z.boolean(), 
      error: z.string().nullable() 
    }))
    .mutation(async ({ input }) => {
      try {
        // 如果 baseUrl 为空，使用默认配置
        const url = input.baseUrl || process.env.SEEKDB_API_URL || DEFAULT_SEEKDB_CONFIG.baseUrl;
        const client = createSeekDBClient({ baseUrl: url });
        await client.testConnection();
        return { success: true, error: null };
      } catch (error) {
        const message = error instanceof SeekDBError 
          ? error.message 
          : '连接测试失败';
        return { success: false, error: message };
      }
    }),

  // ============ 混合搜索 API ============

  /**
   * 混合搜索（向量 + 全文）
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
        summary: '混合搜索（向量+全文）', 
        protect: true, 
        tags: ['Paperless'] 
      } 
    })
    .input(hybridSearchInput)
    .output(hybridSearchResponseSchema)
    .mutation(async ({ input }) => {
      const client = getSeekDBClient();
      return client.hybridSearch({
        query: input.query,
        alpha: input.alpha,
        source_type: input.sourceType,
        limit: input.limit,
      });
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
      const client = getSeekDBClient();
      return client.getEmbeddingStatus();
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
      const client = getSeekDBClient();
      return client.generateEmbedding(input.text);
    }),
});
