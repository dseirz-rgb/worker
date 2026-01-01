/**
 * 原生文档服务
 * 实现与 PaperlessClient 相同的接口，使用本地数据库和存储
 * 
 * 来源: 自定义实现，基于 Prisma ORM
 */

import { prisma } from '../prisma';
import { getStorageService, calculateChecksum } from './storageService';
import { needsOcr } from './ocrService';
import { triggerDocumentOcr } from '../jobs/documentOcrJob';
import type { 
  PaperlessDocument, 
  PaperlessTag, 
  PaperlessDocumentType, 
  PaperlessCorrespondent,
  PaginatedResponse,
  DocumentListParams,
  SearchParams,
  UploadMetadata,
} from './paperlessClient';

// OCR 状态常量 (与 Prisma 枚举对应)
const OCR_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;

// ============ 类型转换 ============

/**
 * 将数据库文档转换为 Paperless 格式
 */
function toDocumentFormat(doc: any): PaperlessDocument {
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content || '',
    created: doc.documentDate?.toISOString() || doc.createdAt.toISOString(),
    modified: doc.updatedAt.toISOString(),
    added: doc.createdAt.toISOString(),
    correspondent: doc.correspondentId,
    document_type: doc.documentTypeId,
    tags: doc.tags?.map((t: any) => t.tagId) || [],
    archive_serial_number: null,
    original_file_name: doc.originalFilename,
    archived_file_name: doc.archivedPath || '',
  };
}

/**
 * 将数据库标签转换为 Paperless 格式
 */
function toTagFormat(tag: any): PaperlessTag {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    match: '',
    matching_algorithm: 0,
    is_insensitive: true,
  };
}

/**
 * 将数据库文档类型转换为 Paperless 格式
 */
function toDocumentTypeFormat(type: any): PaperlessDocumentType {
  return {
    id: type.id,
    name: type.name,
    match: '',
    matching_algorithm: 0,
    is_insensitive: true,
  };
}

/**
 * 将数据库通讯者转换为 Paperless 格式
 */
function toCorrespondentFormat(corr: any): PaperlessCorrespondent {
  return {
    id: corr.id,
    name: corr.name,
    match: '',
    matching_algorithm: 0,
    is_insensitive: true,
  };
}

// ============ 文档服务类 ============

export class DocumentService {
  private accountId: number;
  private storage = getStorageService();

  constructor(accountId: number) {
    this.accountId = accountId;
  }

  // ============ 文档操作 ============

  /**
   * 获取文档列表
   */
  async listDocuments(params?: DocumentListParams): Promise<PaginatedResponse<PaperlessDocument>> {
    const page = params?.page || 1;
    const pageSize = params?.page_size || 20;
    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const where: any = {
      accountId: this.accountId,
    };

    if (params?.document_type__id) {
      where.documentTypeId = params.document_type__id;
    }

    if (params?.correspondent__id) {
      where.correspondentId = params.correspondent__id;
    }

    if (params?.tags__id__in?.length) {
      where.tags = {
        some: {
          tagId: { in: params.tags__id__in },
        },
      };
    }

    if (params?.created__date__gt) {
      where.createdAt = { ...where.createdAt, gt: new Date(params.created__date__gt) };
    }

    if (params?.created__date__lt) {
      where.createdAt = { ...where.createdAt, lt: new Date(params.created__date__lt) };
    }

    // 构建排序
    let orderBy: any = { createdAt: 'desc' };
    if (params?.ordering) {
      const desc = params.ordering.startsWith('-');
      const field = params.ordering.replace(/^-/, '');
      const fieldMap: Record<string, string> = {
        added: 'createdAt',
        created: 'documentDate',
        title: 'title',
        correspondent: 'correspondentId',
      };
      const dbField = fieldMap[field] || 'createdAt';
      orderBy = { [dbField]: desc ? 'desc' : 'asc' };
    }

    // 执行查询
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          tags: true,
        },
      }),
      prisma.document.count({ where }),
    ]);

    const results = documents.map(toDocumentFormat);
    const hasNext = skip + pageSize < total;
    const hasPrev = page > 1;

    return {
      count: total,
      next: hasNext ? `?page=${page + 1}` : null,
      previous: hasPrev ? `?page=${page - 1}` : null,
      results,
    };
  }

  /**
   * 搜索文档 (全文搜索)
   */
  async searchDocuments(query: string, params?: SearchParams): Promise<PaginatedResponse<PaperlessDocument>> {
    const page = params?.page || 1;
    const pageSize = params?.page_size || 20;
    const skip = (page - 1) * pageSize;

    // 使用 PostgreSQL 的 ILIKE 进行模糊搜索
    const where = {
      accountId: this.accountId,
      OR: [
        { title: { contains: query, mode: 'insensitive' as const } },
        { content: { contains: query, mode: 'insensitive' as const } },
        { originalFilename: { contains: query, mode: 'insensitive' as const } },
      ],
    };

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          tags: true,
        },
      }),
      prisma.document.count({ where }),
    ]);

    const results = documents.map(toDocumentFormat);
    const hasNext = skip + pageSize < total;
    const hasPrev = page > 1;

    return {
      count: total,
      next: hasNext ? `?page=${page + 1}` : null,
      previous: hasPrev ? `?page=${page - 1}` : null,
      results,
    };
  }

  /**
   * 获取单个文档详情
   */
  async getDocument(id: number): Promise<PaperlessDocument> {
    const doc = await prisma.document.findFirst({
      where: {
        id,
        accountId: this.accountId,
      },
      include: {
        tags: true,
      },
    });

    if (!doc) {
      throw new Error(`文档不存在: ${id}`);
    }

    return toDocumentFormat(doc);
  }

  /**
   * 上传文档
   */
  async uploadDocument(
    file: Buffer,
    filename: string,
    metadata?: UploadMetadata
  ): Promise<{ task_id: string }> {
    // 计算文件信息
    const checksum = calculateChecksum(file);
    const mimeType = this.getMimeType(filename);

    // 检查是否已存在相同文件 (去重)
    const existing = await prisma.document.findFirst({
      where: {
        accountId: this.accountId,
        checksum,
      },
    });

    if (existing) {
      return { task_id: `existing-${existing.id}` };
    }

    // 上传到存储
    const uploadResult = await this.storage.upload(
      this.accountId,
      filename,
      file,
      mimeType
    );

    // 创建文档记录
    const doc = await prisma.document.create({
      data: {
        title: metadata?.title || filename.replace(/\.[^/.]+$/, ''),
        originalFilename: filename,
        storagePath: uploadResult.path,
        mimeType,
        fileSize: BigInt(uploadResult.size),
        checksum: uploadResult.checksum,
        ocrStatus: this.needsOcrProcessing(mimeType) ? OCR_STATUS.PENDING : OCR_STATUS.SKIPPED,
        accountId: this.accountId,
        documentTypeId: metadata?.document_type || null,
        correspondentId: metadata?.correspondent || null,
        tags: metadata?.tags?.length ? {
          create: metadata.tags.map(tagId => ({ tagId })),
        } : undefined,
      },
    });

    // 异步触发 OCR 处理
    if (this.needsOcrProcessing(mimeType)) {
      // 使用 setImmediate 避免阻塞响应
      setImmediate(() => {
        triggerDocumentOcr(doc.id, this.accountId).catch(err => {
          console.error(`[DocumentService] OCR 触发失败:`, err);
        });
      });
    }

    return { task_id: `doc-${doc.id}` };
  }

  /**
   * 下载原始文档
   */
  async downloadDocument(id: number): Promise<Buffer> {
    const doc = await prisma.document.findFirst({
      where: {
        id,
        accountId: this.accountId,
      },
    });

    if (!doc) {
      throw new Error(`文档不存在: ${id}`);
    }

    return this.storage.download(doc.storagePath);
  }

  /**
   * 获取文档预览
   */
  async getDocumentPreview(id: number): Promise<Buffer> {
    // 对于 PDF，直接返回原文件
    // 对于图片，返回原文件
    // 其他类型可能需要转换
    return this.downloadDocument(id);
  }

  /**
   * 获取文档缩略图
   */
  async getDocumentThumbnail(id: number): Promise<Buffer> {
    // TODO: 实现缩略图生成
    // 暂时返回原文件
    return this.downloadDocument(id);
  }

  /**
   * 更新文档
   */
  async updateDocument(id: number, data: Partial<PaperlessDocument>): Promise<PaperlessDocument> {
    // 验证文档存在
    const existing = await prisma.document.findFirst({
      where: {
        id,
        accountId: this.accountId,
      },
    });

    if (!existing) {
      throw new Error(`文档不存在: ${id}`);
    }

    // 更新文档
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.document_type !== undefined) updateData.documentTypeId = data.document_type;
    if (data.correspondent !== undefined) updateData.correspondentId = data.correspondent;

    // 更新标签 (如果提供)
    if (data.tags !== undefined) {
      // 删除现有标签关联
      await prisma.documentToTag.deleteMany({
        where: { documentId: id },
      });

      // 创建新的标签关联
      if (data.tags.length > 0) {
        await prisma.documentToTag.createMany({
          data: data.tags.map(tagId => ({
            documentId: id,
            tagId,
          })),
        });
      }
    }

    const updated = await prisma.document.update({
      where: { id },
      data: updateData,
      include: {
        tags: true,
      },
    });

    return toDocumentFormat(updated);
  }

  /**
   * 删除文档
   */
  async deleteDocument(id: number): Promise<void> {
    const doc = await prisma.document.findFirst({
      where: {
        id,
        accountId: this.accountId,
      },
    });

    if (!doc) {
      throw new Error(`文档不存在: ${id}`);
    }

    // 删除存储的文件
    await this.storage.delete(doc.storagePath);
    if (doc.archivedPath) {
      await this.storage.delete(doc.archivedPath);
    }

    // 删除数据库记录 (级联删除标签关联)
    await prisma.document.delete({
      where: { id },
    });
  }

  // ============ 标签操作 ============

  /**
   * 获取所有标签
   */
  async listTags(): Promise<PaperlessTag[]> {
    const tags = await prisma.documentTag.findMany({
      where: { accountId: this.accountId },
      orderBy: { name: 'asc' },
    });

    return tags.map(toTagFormat);
  }

  /**
   * 创建标签
   */
  async createTag(data: { name: string; color?: string }): Promise<PaperlessTag> {
    const tag = await prisma.documentTag.create({
      data: {
        name: data.name,
        color: data.color || '#3B82F6',
        accountId: this.accountId,
      },
    });

    return toTagFormat(tag);
  }

  /**
   * 更新标签
   */
  async updateTag(id: number, data: { name?: string; color?: string }): Promise<PaperlessTag> {
    const tag = await prisma.documentTag.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.color && { color: data.color }),
      },
    });

    return toTagFormat(tag);
  }

  /**
   * 删除标签
   */
  async deleteTag(id: number): Promise<void> {
    await prisma.documentTag.delete({
      where: { id },
    });
  }

  // ============ 文档类型操作 ============

  /**
   * 获取所有文档类型
   */
  async listDocumentTypes(): Promise<PaperlessDocumentType[]> {
    const types = await prisma.documentType.findMany({
      where: { accountId: this.accountId },
      orderBy: { name: 'asc' },
    });

    return types.map(toDocumentTypeFormat);
  }

  /**
   * 创建文档类型
   */
  async createDocumentType(data: { name: string }): Promise<PaperlessDocumentType> {
    const type = await prisma.documentType.create({
      data: {
        name: data.name,
        accountId: this.accountId,
      },
    });

    return toDocumentTypeFormat(type);
  }

  /**
   * 删除文档类型
   */
  async deleteDocumentType(id: number): Promise<void> {
    await prisma.documentType.delete({
      where: { id },
    });
  }

  // ============ 通讯者操作 ============

  /**
   * 获取所有通讯者
   */
  async listCorrespondents(): Promise<PaperlessCorrespondent[]> {
    const correspondents = await prisma.correspondent.findMany({
      where: { accountId: this.accountId },
      orderBy: { name: 'asc' },
    });

    return correspondents.map(toCorrespondentFormat);
  }

  /**
   * 创建通讯者
   */
  async createCorrespondent(data: { name: string }): Promise<PaperlessCorrespondent> {
    const corr = await prisma.correspondent.create({
      data: {
        name: data.name,
        accountId: this.accountId,
      },
    });

    return toCorrespondentFormat(corr);
  }

  /**
   * 删除通讯者
   */
  async deleteCorrespondent(id: number): Promise<void> {
    await prisma.correspondent.delete({
      where: { id },
    });
  }

  // ============ 连接测试 ============

  /**
   * 测试连接 (原生服务始终返回 true)
   */
  async testConnection(): Promise<boolean> {
    return true;
  }

  // ============ 私有方法 ============

  /**
   * 根据文件名获取 MIME 类型
   */
  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      tiff: 'image/tiff',
      tif: 'image/tiff',
      txt: 'text/plain',
      md: 'text/markdown',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * 判断文件是否需要 OCR 处理
   */
  private needsOcrProcessing(mimeType: string): boolean {
    return needsOcr(mimeType);
  }
}

// ============ 工厂函数 ============

/**
 * 创建文档服务实例
 */
export function createDocumentService(accountId: number): DocumentService {
  return new DocumentService(accountId);
}
