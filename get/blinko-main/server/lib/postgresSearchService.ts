/**
 * PostgreSQL 搜索服务
 * 使用 pg_trgm 扩展实现中文全文搜索
 * 
 * 特点：
 * - 使用 GIN 索引加速搜索
 * - 支持中文模糊匹配
 * - 响应时间 <100ms
 */

import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

// ============ 类型定义 ============

export interface SearchFilters {
  accountId?: number;
  type?: string;
  noteId?: number;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface SearchResult {
  id: number;
  name: string;
  path: string;
  type: string;
  size: number;
  content: string;
  noteId: number | null;
  accountId: number | null;
  createdAt: Date;
  updatedAt: Date;
  score: number;  // 相似度分数
}

export interface PaginatedSearchResult {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ListFilters {
  accountId?: number;
  type?: string;
  noteId?: number;
  perfixPath?: string;
}

export interface ListOptions {
  page?: number;
  pageSize?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name' | 'size';
  orderDir?: 'asc' | 'desc';
}

// ============ PostgresSearchService ============

export class PostgresSearchService {
  /**
   * 全文搜索附件
   * 使用 pg_trgm 的 ILIKE 和 similarity 函数
   */
  async search(
    query: string,
    filters?: SearchFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedSearchResult> {
    const offset = (page - 1) * pageSize;
    const searchPattern = `%${query}%`;

    // 构建 WHERE 条件
    const whereConditions: string[] = [
      `(name ILIKE $1 OR content ILIKE $1)`
    ];
    const params: (string | number | Date)[] = [searchPattern];
    let paramIndex = 2;

    if (filters?.accountId) {
      whereConditions.push(`"accountId" = $${paramIndex}`);
      params.push(filters.accountId);
      paramIndex++;
    }

    if (filters?.type) {
      whereConditions.push(`type = $${paramIndex}`);
      params.push(filters.type);
      paramIndex++;
    }

    if (filters?.noteId) {
      whereConditions.push(`"noteId" = $${paramIndex}`);
      params.push(filters.noteId);
      paramIndex++;
    }

    if (filters?.createdAfter) {
      whereConditions.push(`"createdAt" >= $${paramIndex}`);
      params.push(filters.createdAfter);
      paramIndex++;
    }

    if (filters?.createdBefore) {
      whereConditions.push(`"createdAt" <= $${paramIndex}`);
      params.push(filters.createdBefore);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // 执行搜索查询
    const searchSql = `
      SELECT 
        id, name, path, type, size::float, content,
        "noteId", "accountId", "createdAt", "updatedAt",
        GREATEST(
          similarity(name, $${paramIndex}),
          similarity(content, $${paramIndex})
        ) AS score
      FROM attachments
      WHERE ${whereClause}
      ORDER BY score DESC, "createdAt" DESC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `;

    // 执行计数查询
    const countSql = `
      SELECT COUNT(*) as total
      FROM attachments
      WHERE ${whereClause}
    `;

    params.push(query);  // 用于 similarity 函数
    const searchParams = [...params, pageSize, offset];

    try {
      const [results, countResult] = await Promise.all([
        prisma.$queryRawUnsafe<SearchResult[]>(searchSql, ...searchParams),
        prisma.$queryRawUnsafe<[{ total: bigint }]>(countSql, ...params)
      ]);

      const total = Number(countResult[0]?.total || 0);

      return {
        results: results.map(r => ({
          ...r,
          size: Number(r.size),
          score: Number(r.score)
        })),
        total,
        page,
        pageSize,
        hasMore: offset + results.length < total
      };
    } catch (error) {
      console.error('PostgreSQL search error:', error);
      throw new Error(`搜索失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 列出附件（带分页和过滤）
   */
  async list(
    filters?: ListFilters,
    options?: ListOptions
  ): Promise<PaginatedSearchResult> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const orderBy = options?.orderBy || 'createdAt';
    const orderDir = options?.orderDir || 'desc';

    const where: Prisma.attachmentsWhereInput = {};

    if (filters?.accountId) {
      where.accountId = filters.accountId;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.noteId) {
      where.noteId = filters.noteId;
    }

    if (filters?.perfixPath) {
      where.perfixPath = filters.perfixPath;
    }

    try {
      const [results, total] = await Promise.all([
        prisma.attachments.findMany({
          where,
          orderBy: { [orderBy]: orderDir },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.attachments.count({ where })
      ]);

      return {
        results: results.map(r => ({
          id: r.id,
          name: r.name,
          path: r.path,
          type: r.type,
          size: Number(r.size),
          content: r.content,
          noteId: r.noteId,
          accountId: r.accountId,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          score: 1.0  // 列表查询没有相似度分数
        })),
        total,
        page,
        pageSize,
        hasMore: (page - 1) * pageSize + results.length < total
      };
    } catch (error) {
      console.error('PostgreSQL list error:', error);
      throw new Error(`列表查询失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取单个附件
   */
  async getById(id: number): Promise<SearchResult | null> {
    try {
      const result = await prisma.attachments.findUnique({
        where: { id }
      });

      if (!result) return null;

      return {
        id: result.id,
        name: result.name,
        path: result.path,
        type: result.type,
        size: Number(result.size),
        content: result.content,
        noteId: result.noteId,
        accountId: result.accountId,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        score: 1.0
      };
    } catch (error) {
      console.error('PostgreSQL getById error:', error);
      throw new Error(`获取附件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 更新附件内容（用于索引）
   */
  async updateContent(id: number, content: string): Promise<void> {
    try {
      await prisma.attachments.update({
        where: { id },
        data: { content }
      });
    } catch (error) {
      console.error('PostgreSQL updateContent error:', error);
      throw new Error(`更新内容失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 批量更新附件内容
   */
  async batchUpdateContent(updates: { id: number; content: string }[]): Promise<void> {
    try {
      await prisma.$transaction(
        updates.map(({ id, content }) =>
          prisma.attachments.update({
            where: { id },
            data: { content }
          })
        )
      );
    } catch (error) {
      console.error('PostgreSQL batchUpdateContent error:', error);
      throw new Error(`批量更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取搜索统计信息
   */
  async getStats(accountId?: number): Promise<{
    totalCount: number;
    indexedCount: number;
    totalSize: number;
  }> {
    const where: Prisma.attachmentsWhereInput = {};
    if (accountId) {
      where.accountId = accountId;
    }

    try {
      const [total, indexed, sizeResult] = await Promise.all([
        prisma.attachments.count({ where }),
        prisma.attachments.count({
          where: {
            ...where,
            content: { not: '' }
          }
        }),
        prisma.attachments.aggregate({
          where,
          _sum: { size: true }
        })
      ]);

      return {
        totalCount: total,
        indexedCount: indexed,
        totalSize: Number(sizeResult._sum.size || 0)
      };
    } catch (error) {
      console.error('PostgreSQL getStats error:', error);
      throw new Error(`获取统计失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}

// ============ 单例导出 ============

let _instance: PostgresSearchService | null = null;

export function getPostgresSearchService(): PostgresSearchService {
  if (!_instance) {
    _instance = new PostgresSearchService();
  }
  return _instance;
}

export default PostgresSearchService;
