/**
 * 文档全文搜索服务
 * 使用 PostgreSQL 的 tsvector 实现全文搜索
 * 
 * 功能:
 * - 全文搜索 (支持中英文)
 * - 搜索结果高亮
 * - 搜索排名
 * - 模糊匹配
 * 
 * 来源: PostgreSQL Full Text Search
 * https://www.postgresql.org/docs/current/textsearch.html
 */

import { prisma } from '../prisma';

// ============ 类型定义 ============

/** 搜索结果项 */
export interface SearchResultItem {
  /** 文档 ID */
  id: number;
  /** 文档标题 */
  title: string;
  /** 原始文件名 */
  originalFilename: string;
  /** MIME 类型 */
  mimeType: string;
  /** 文件大小 */
  fileSize: bigint;
  /** 文档类型 ID */
  documentTypeId: number | null;
  /** 通讯者 ID */
  correspondentId: number | null;
  /** 创建时间 */
  createdAt: Date;
  /** 搜索排名分数 */
  rank?: number;
  /** 高亮的标题 */
  highlightedTitle?: string;
  /** 高亮的内容片段 */
  highlightedContent?: string;
  /** 匹配的标签 ID 列表 */
  matchedTagIds?: number[];
}

/** 搜索结果 */
export interface SearchResult {
  /** 搜索结果列表 */
  items: SearchResultItem[];
  /** 总数 */
  total: number;
  /** 搜索耗时 (毫秒) */
  searchTime: number;
  /** 搜索关键词 */
  query: string;
}

/** 搜索选项 */
export interface SearchOptions {
  /** 账户 ID */
  accountId: number;
  /** 搜索关键词 */
  query: string;
  /** 页码 (从 1 开始) */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 标签 ID 过滤 */
  tagIds?: number[];
  /** 文档类型 ID 过滤 */
  documentTypeId?: number;
  /** 通讯者 ID 过滤 */
  correspondentId?: number;
  /** 日期范围 - 开始 */
  dateFrom?: Date;
  /** 日期范围 - 结束 */
  dateTo?: Date;
  /** 是否包含高亮 */
  includeHighlight?: boolean;
}

// ============ 辅助函数 ============

/**
 * 转义 PostgreSQL 全文搜索特殊字符
 */
function escapeSearchQuery(query: string): string {
  // 移除特殊字符，保留字母、数字、中文和空格
  return query
    .replace(/[&|!():*<>'"\\]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .join(' & '); // 使用 AND 连接多个词
}

/**
 * 将搜索词转换为 tsquery 格式
 * 支持前缀匹配
 */
function toTsQuery(query: string): string {
  const escaped = escapeSearchQuery(query);
  if (!escaped) return '';
  
  // 为每个词添加前缀匹配
  return escaped
    .split(' & ')
    .map(word => `${word}:*`)
    .join(' & ');
}

/**
 * 生成高亮 SQL 片段
 */
function getHighlightSql(column: string, query: string): string {
  const tsQuery = toTsQuery(query);
  if (!tsQuery) return `${column}`;
  
  return `ts_headline(
    'simple',
    ${column},
    to_tsquery('simple', '${tsQuery}'),
    'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20, MaxFragments=3'
  )`;
}

// ============ 搜索服务类 ============

export class DocumentSearchService {
  /**
   * 全文搜索文档
   */
  async search(options: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now();
    const {
      accountId,
      query,
      page = 1,
      pageSize = 20,
      tagIds,
      documentTypeId,
      correspondentId,
      dateFrom,
      dateTo,
      includeHighlight = true,
    } = options;

    const offset = (page - 1) * pageSize;
    const tsQuery = toTsQuery(query);

    // 如果搜索词为空，返回空结果
    if (!tsQuery) {
      return {
        items: [],
        total: 0,
        searchTime: Date.now() - startTime,
        query,
      };
    }

    // 构建 WHERE 条件
    const whereConditions: string[] = [
      `d."accountId" = ${accountId}`,
    ];

    // 全文搜索条件 (标题 + 内容 + 文件名)
    whereConditions.push(`(
      to_tsvector('simple', COALESCE(d.title, '')) ||
      to_tsvector('simple', COALESCE(d.content, '')) ||
      to_tsvector('simple', COALESCE(d."originalFilename", ''))
    ) @@ to_tsquery('simple', '${tsQuery}')`);

    // 标签过滤
    if (tagIds && tagIds.length > 0) {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM "documentToTag" dt
        WHERE dt."documentId" = d.id
        AND dt."tagId" IN (${tagIds.join(',')})
      )`);
    }

    // 文档类型过滤
    if (documentTypeId) {
      whereConditions.push(`d."documentTypeId" = ${documentTypeId}`);
    }

    // 通讯者过滤
    if (correspondentId) {
      whereConditions.push(`d."correspondentId" = ${correspondentId}`);
    }

    // 日期范围过滤
    if (dateFrom) {
      whereConditions.push(`d."createdAt" >= '${dateFrom.toISOString()}'`);
    }
    if (dateTo) {
      whereConditions.push(`d."createdAt" <= '${dateTo.toISOString()}'`);
    }

    const whereClause = whereConditions.join(' AND ');

    // 构建排名 SQL
    const rankSql = `ts_rank(
      to_tsvector('simple', COALESCE(d.title, '')) ||
      to_tsvector('simple', COALESCE(d.content, '')) ||
      to_tsvector('simple', COALESCE(d."originalFilename", '')),
      to_tsquery('simple', '${tsQuery}')
    )`;

    // 构建高亮 SQL
    const highlightTitleSql = includeHighlight
      ? getHighlightSql('d.title', query)
      : 'd.title';
    const highlightContentSql = includeHighlight
      ? getHighlightSql('COALESCE(d.content, \'\')', query)
      : 'LEFT(d.content, 200)';

    // 执行搜索查询
    const searchSql = `
      SELECT
        d.id,
        d.title,
        d."originalFilename",
        d."mimeType",
        d."fileSize",
        d."documentTypeId",
        d."correspondentId",
        d."createdAt",
        ${rankSql} as rank,
        ${highlightTitleSql} as "highlightedTitle",
        ${highlightContentSql} as "highlightedContent"
      FROM document d
      WHERE ${whereClause}
      ORDER BY rank DESC, d."createdAt" DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    // 执行计数查询
    const countSql = `
      SELECT COUNT(*) as total
      FROM document d
      WHERE ${whereClause}
    `;

    try {
      // 并行执行搜索和计数
      const [searchResults, countResult] = await Promise.all([
        prisma.$queryRawUnsafe<SearchResultItem[]>(searchSql),
        prisma.$queryRawUnsafe<[{ total: bigint }]>(countSql),
      ]);

      const total = Number(countResult[0]?.total || 0);

      return {
        items: searchResults,
        total,
        searchTime: Date.now() - startTime,
        query,
      };
    } catch (error) {
      console.error('[Search] 搜索失败:', error);
      
      // 降级到简单的 LIKE 搜索
      return this.fallbackSearch(options, startTime);
    }
  }

  /**
   * 降级搜索 (使用 LIKE)
   * 当全文搜索失败时使用
   */
  private async fallbackSearch(
    options: SearchOptions,
    startTime: number
  ): Promise<SearchResult> {
    const {
      accountId,
      query,
      page = 1,
      pageSize = 20,
      tagIds,
      documentTypeId,
      correspondentId,
      dateFrom,
      dateTo,
    } = options;

    const skip = (page - 1) * pageSize;
    const searchPattern = `%${query}%`;

    // 构建 Prisma 查询条件
    const where: any = {
      accountId,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
        { originalFilename: { contains: query, mode: 'insensitive' } },
      ],
    };

    // 添加过滤条件
    if (tagIds && tagIds.length > 0) {
      where.tags = {
        some: {
          tagId: { in: tagIds },
        },
      };
    }

    if (documentTypeId) {
      where.documentTypeId = documentTypeId;
    }

    if (correspondentId) {
      where.correspondentId = correspondentId;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    // 执行查询
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          originalFilename: true,
          mimeType: true,
          fileSize: true,
          documentTypeId: true,
          correspondentId: true,
          createdAt: true,
          content: true,
        },
      }),
      prisma.document.count({ where }),
    ]);

    // 转换结果
    const items: SearchResultItem[] = documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      documentTypeId: doc.documentTypeId,
      correspondentId: doc.correspondentId,
      createdAt: doc.createdAt,
      highlightedTitle: this.simpleHighlight(doc.title, query),
      highlightedContent: this.simpleHighlight(
        doc.content?.substring(0, 200) || '',
        query
      ),
    }));

    return {
      items,
      total,
      searchTime: Date.now() - startTime,
      query,
    };
  }

  /**
   * 简单的高亮实现
   */
  private simpleHighlight(text: string, query: string): string {
    if (!text || !query) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  /**
   * 搜索建议 (自动补全)
   */
  async suggest(
    accountId: number,
    prefix: string,
    limit: number = 5
  ): Promise<string[]> {
    if (!prefix || prefix.length < 2) {
      return [];
    }

    // 从标题中提取建议
    const documents = await prisma.document.findMany({
      where: {
        accountId,
        title: {
          startsWith: prefix,
          mode: 'insensitive',
        },
      },
      take: limit,
      select: {
        title: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return documents.map(d => d.title);
  }

  /**
   * 获取热门搜索词
   * 基于文档标题的词频统计
   */
  async getPopularTerms(
    accountId: number,
    limit: number = 10
  ): Promise<string[]> {
    // 简单实现：返回最近文档的标题关键词
    const documents = await prisma.document.findMany({
      where: { accountId },
      take: 50,
      select: { title: true },
      orderBy: { createdAt: 'desc' },
    });

    // 提取词频
    const wordCount = new Map<string, number>();
    for (const doc of documents) {
      const words = doc.title
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2);
      
      for (const word of words) {
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
      }
    }

    // 排序并返回
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word]) => word);
  }
}

// ============ 单例导出 ============

let searchServiceInstance: DocumentSearchService | null = null;

/**
 * 获取搜索服务实例
 */
export function getDocumentSearchService(): DocumentSearchService {
  if (!searchServiceInstance) {
    searchServiceInstance = new DocumentSearchService();
  }
  return searchServiceInstance;
}

/**
 * 便捷搜索函数
 */
export async function searchDocuments(
  options: SearchOptions
): Promise<SearchResult> {
  const service = getDocumentSearchService();
  return service.search(options);
}
