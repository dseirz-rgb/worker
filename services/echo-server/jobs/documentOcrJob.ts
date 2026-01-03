/**
 * 文档 OCR 异步任务
 * 使用 pg-boss 处理文档 OCR 任务队列
 * 
 * 功能:
 * - 异步处理文档 OCR
 * - 自动重试失败任务
 * - 更新文档 OCR 状态
 * - 支持批量处理
 */

import { prisma } from '../prisma';
import { getStorageService } from '../lib/storageService';
import { extractText, needsOcr, terminateOcrWorker } from '../lib/ocrService';

// ============ 类型定义 ============

/** OCR 任务数据 */
export interface DocumentOcrJobData {
  /** 文档 ID */
  documentId: number;
  /** 账户 ID */
  accountId: number;
  /** 优先级 (可选) */
  priority?: number;
}

/** OCR 任务结果 */
export interface DocumentOcrJobResult {
  /** 是否成功 */
  success: boolean;
  /** 文档 ID */
  documentId: number;
  /** 提取的文本长度 */
  textLength?: number;
  /** 置信度 */
  confidence?: number;
  /** 处理耗时 (毫秒) */
  processingTime?: number;
  /** 错误信息 */
  error?: string;
}

// ============ 常量 ============

/** 任务队列名称 */
export const DOCUMENT_OCR_QUEUE = 'document-ocr';

/** 任务配置 */
export const OCR_JOB_OPTIONS = {
  /** 任务超时时间 (5 分钟) */
  expireInMinutes: 5,
  /** 最大重试次数 */
  retryLimit: 3,
  /** 重试延迟 (秒) */
  retryDelay: 30,
  /** 任务保留时间 (天) */
  retentionDays: 7,
};

// ============ OCR 状态常量 ============

/** OCR 状态枚举值 (与 Prisma 枚举对应) */
const OCR_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;

// ============ 任务处理函数 ============

/**
 * 处理单个文档的 OCR 任务
 */
export async function processDocumentOcr(
  data: DocumentOcrJobData
): Promise<DocumentOcrJobResult> {
  const { documentId, accountId } = data;
  const startTime = Date.now();

  console.log(`[OCR Job] 开始处理文档 ${documentId}`);

  try {
    // 1. 获取文档信息
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        accountId,
      },
    });

    if (!document) {
      return {
        success: false,
        documentId,
        error: '文档不存在',
      };
    }

    // 2. 检查是否需要 OCR
    if (!needsOcr(document.mimeType)) {
      // 更新状态为跳过
      await prisma.document.update({
        where: { id: documentId },
        data: { ocrStatus: OCR_STATUS.SKIPPED },
      });

      return {
        success: true,
        documentId,
        processingTime: Date.now() - startTime,
      };
    }

    // 3. 更新状态为处理中
    await prisma.document.update({
      where: { id: documentId },
      data: { ocrStatus: OCR_STATUS.PROCESSING },
    });

    // 4. 下载文件
    const storage = getStorageService();
    const fileBuffer = await storage.download(document.storagePath);

    // 5. 执行 OCR
    const ocrResult = await extractText(fileBuffer, document.mimeType);

    if (ocrResult.error) {
      // OCR 失败
      await prisma.document.update({
        where: { id: documentId },
        data: {
          ocrStatus: OCR_STATUS.FAILED,
          ocrError: ocrResult.error,
        },
      });

      return {
        success: false,
        documentId,
        processingTime: Date.now() - startTime,
        error: ocrResult.error,
      };
    }

    // 6. 更新文档内容
    await prisma.document.update({
      where: { id: documentId },
      data: {
        content: ocrResult.text,
        ocrStatus: OCR_STATUS.COMPLETED,
        ocrError: null,
      },
    });

    console.log(
      `[OCR Job] 文档 ${documentId} 处理完成，` +
      `提取 ${ocrResult.text.length} 字符，` +
      `耗时 ${ocrResult.processingTime}ms`
    );

    return {
      success: true,
      documentId,
      textLength: ocrResult.text.length,
      confidence: ocrResult.confidence,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[OCR Job] 文档 ${documentId} 处理失败:`, errorMessage);

    // 更新状态为失败
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          ocrStatus: OCR_STATUS.FAILED,
          ocrError: errorMessage,
        },
      });
    } catch (updateError) {
      console.error('[OCR Job] 更新失败状态时出错:', updateError);
    }

    return {
      success: false,
      documentId,
      processingTime: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

/**
 * 批量处理待处理的 OCR 任务
 * 用于启动时处理积压的任务
 */
export async function processPendingOcrTasks(
  accountId?: number,
  limit: number = 10
): Promise<DocumentOcrJobResult[]> {
  console.log(`[OCR Job] 开始处理待处理任务，限制: ${limit}`);

  // 查询待处理的文档
  const pendingDocs = await prisma.document.findMany({
    where: {
      ocrStatus: OCR_STATUS.PENDING,
      ...(accountId && { accountId }),
    },
    take: limit,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      accountId: true,
    },
  });

  if (pendingDocs.length === 0) {
    console.log('[OCR Job] 没有待处理的任务');
    return [];
  }

  console.log(`[OCR Job] 找到 ${pendingDocs.length} 个待处理任务`);

  // 逐个处理
  const results: DocumentOcrJobResult[] = [];
  for (const doc of pendingDocs) {
    const result = await processDocumentOcr({
      documentId: doc.id,
      accountId: doc.accountId,
    });
    results.push(result);
  }

  // 处理完成后清理 Worker
  await terminateOcrWorker();

  const successCount = results.filter(r => r.success).length;
  console.log(
    `[OCR Job] 批量处理完成，成功: ${successCount}/${results.length}`
  );

  return results;
}

/**
 * 重试失败的 OCR 任务
 */
export async function retryFailedOcrTasks(
  accountId?: number,
  limit: number = 5
): Promise<DocumentOcrJobResult[]> {
  console.log(`[OCR Job] 开始重试失败任务，限制: ${limit}`);

  // 查询失败的文档
  const failedDocs = await prisma.document.findMany({
    where: {
      ocrStatus: OCR_STATUS.FAILED,
      ...(accountId && { accountId }),
    },
    take: limit,
    orderBy: { updatedAt: 'asc' },
    select: {
      id: true,
      accountId: true,
    },
  });

  if (failedDocs.length === 0) {
    console.log('[OCR Job] 没有失败的任务需要重试');
    return [];
  }

  console.log(`[OCR Job] 找到 ${failedDocs.length} 个失败任务`);

  // 重置状态为待处理
  await prisma.document.updateMany({
    where: {
      id: { in: failedDocs.map(d => d.id) },
    },
    data: {
      ocrStatus: OCR_STATUS.PENDING,
      ocrError: null,
    },
  });

  // 逐个处理
  const results: DocumentOcrJobResult[] = [];
  for (const doc of failedDocs) {
    const result = await processDocumentOcr({
      documentId: doc.id,
      accountId: doc.accountId,
    });
    results.push(result);
  }

  // 处理完成后清理 Worker
  await terminateOcrWorker();

  return results;
}

/**
 * 获取 OCR 任务统计信息
 */
export async function getOcrTaskStats(accountId?: number): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  skipped: number;
  total: number;
}> {
  const where = accountId ? { accountId } : {};

  const [pending, processing, completed, failed, skipped] = await Promise.all([
    prisma.document.count({ where: { ...where, ocrStatus: OCR_STATUS.PENDING } }),
    prisma.document.count({ where: { ...where, ocrStatus: OCR_STATUS.PROCESSING } }),
    prisma.document.count({ where: { ...where, ocrStatus: OCR_STATUS.COMPLETED } }),
    prisma.document.count({ where: { ...where, ocrStatus: OCR_STATUS.FAILED } }),
    prisma.document.count({ where: { ...where, ocrStatus: OCR_STATUS.SKIPPED } }),
  ]);

  return {
    pending,
    processing,
    completed,
    failed,
    skipped,
    total: pending + processing + completed + failed + skipped,
  };
}

/**
 * 触发单个文档的 OCR 处理
 * 用于文档上传后立即触发
 */
export async function triggerDocumentOcr(
  documentId: number,
  accountId: number
): Promise<void> {
  console.log(`[OCR Job] 触发文档 ${documentId} 的 OCR 处理`);

  // 直接处理 (同步方式，适合小文件)
  // TODO: 对于大文件，应该使用 pg-boss 队列异步处理
  const result = await processDocumentOcr({ documentId, accountId });

  if (!result.success) {
    console.warn(`[OCR Job] 文档 ${documentId} OCR 处理失败:`, result.error);
  }
}
