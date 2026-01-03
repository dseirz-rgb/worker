/**
 * OCR 服务
 * 提供文档文本提取功能，支持多种文件格式
 * 
 * 支持的格式:
 * - PDF: 使用 pdf-parse 提取文本
 * - 图片 (PNG/JPG/TIFF/GIF): 使用 tesseract.js OCR
 * - DOCX: 使用 mammoth 提取文本
 * - XLSX: 使用 xlsx 提取文本
 * - 纯文本: 直接读取
 * 
 * 来源: tesseract.js (https://github.com/naptha/tesseract.js)
 */

import Tesseract from 'tesseract.js';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// ============ 类型定义 ============

/** OCR 处理结果 */
export interface OcrResult {
  /** 提取的文本内容 */
  text: string;
  /** 置信度 (0-100)，仅图片 OCR 有效 */
  confidence?: number;
  /** 处理耗时 (毫秒) */
  processingTime: number;
  /** 使用的提取方法 */
  method: 'pdf-parse' | 'tesseract' | 'mammoth' | 'xlsx' | 'plain-text';
  /** 错误信息 (如果有) */
  error?: string;
}

/** OCR 配置选项 */
export interface OcrOptions {
  /** OCR 语言，默认 'eng+chi_sim' (英文+简体中文) */
  language?: string;
  /** 是否启用自动旋转 */
  rotateAuto?: boolean;
  /** 页面分割模式 */
  pageSegMode?: string;
}

// ============ 常量 ============

/** 支持 OCR 的图片 MIME 类型 */
const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/tiff',
  'image/webp',
  'image/bmp',
];

/** 默认 OCR 语言 (英文 + 简体中文) */
const DEFAULT_LANGUAGE = 'eng+chi_sim';

// ============ Tesseract Worker 管理 ============

/** 全局 Worker 实例 (复用以提高性能) */
let globalWorker: Tesseract.Worker | null = null;
let workerLanguage: string = '';

/**
 * 获取或创建 Tesseract Worker
 * 复用 Worker 实例以避免重复初始化开销
 */
async function getWorker(language: string): Promise<Tesseract.Worker> {
  // 如果语言相同，复用现有 Worker
  if (globalWorker && workerLanguage === language) {
    return globalWorker;
  }

  // 如果语言不同，先终止旧 Worker
  if (globalWorker) {
    await globalWorker.terminate();
    globalWorker = null;
  }

  // 创建新 Worker
  console.log(`[OCR] 初始化 Tesseract Worker，语言: ${language}`);
  const worker = await Tesseract.createWorker(language, Tesseract.OEM.LSTM_ONLY, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        // 只在识别阶段输出进度
        console.log(`[OCR] 识别进度: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  globalWorker = worker;
  workerLanguage = language;
  return worker;
}

/**
 * 终止全局 Worker (用于清理资源)
 */
export async function terminateOcrWorker(): Promise<void> {
  if (globalWorker) {
    await globalWorker.terminate();
    globalWorker = null;
    workerLanguage = '';
    console.log('[OCR] Worker 已终止');
  }
}

// ============ 文本提取函数 ============

/**
 * 从 PDF 文件提取文本
 */
async function extractTextFromPdf(buffer: Buffer): Promise<OcrResult> {
  const startTime = Date.now();
  
  try {
    const data = await pdfParse(buffer);
    const text = data.text.trim();
    
    return {
      text,
      processingTime: Date.now() - startTime,
      method: 'pdf-parse',
    };
  } catch (error) {
    return {
      text: '',
      processingTime: Date.now() - startTime,
      method: 'pdf-parse',
      error: `PDF 解析失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 从图片文件提取文本 (OCR)
 */
async function extractTextFromImage(
  buffer: Buffer,
  options: OcrOptions = {}
): Promise<OcrResult> {
  const startTime = Date.now();
  const language = options.language || DEFAULT_LANGUAGE;
  
  try {
    const worker = await getWorker(language);
    
    // 执行 OCR
    const { data } = await worker.recognize(buffer, {
      rotateAuto: options.rotateAuto ?? true,
    });
    
    return {
      text: data.text.trim(),
      confidence: data.confidence,
      processingTime: Date.now() - startTime,
      method: 'tesseract',
    };
  } catch (error) {
    return {
      text: '',
      processingTime: Date.now() - startTime,
      method: 'tesseract',
      error: `OCR 失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 从 DOCX 文件提取文本
 */
async function extractTextFromDocx(buffer: Buffer): Promise<OcrResult> {
  const startTime = Date.now();
  
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    
    // 记录警告信息
    if (result.messages.length > 0) {
      console.log('[OCR] DOCX 解析警告:', result.messages);
    }
    
    return {
      text,
      processingTime: Date.now() - startTime,
      method: 'mammoth',
    };
  } catch (error) {
    return {
      text: '',
      processingTime: Date.now() - startTime,
      method: 'mammoth',
      error: `DOCX 解析失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 从 XLSX/XLS 文件提取文本
 */
async function extractTextFromXlsx(buffer: Buffer): Promise<OcrResult> {
  const startTime = Date.now();
  
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const textParts: string[] = [];
    
    // 遍历所有工作表
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      
      // 添加工作表名称
      textParts.push(`[${sheetName}]`);
      
      // 转换为文本
      const text = XLSX.utils.sheet_to_txt(sheet);
      if (text.trim()) {
        textParts.push(text.trim());
      }
      
      textParts.push(''); // 空行分隔
    }
    
    return {
      text: textParts.join('\n').trim(),
      processingTime: Date.now() - startTime,
      method: 'xlsx',
    };
  } catch (error) {
    return {
      text: '',
      processingTime: Date.now() - startTime,
      method: 'xlsx',
      error: `Excel 解析失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 从纯文本文件提取文本
 */
async function extractTextFromPlainText(buffer: Buffer): Promise<OcrResult> {
  const startTime = Date.now();
  
  try {
    const text = buffer.toString('utf-8').trim();
    
    return {
      text,
      processingTime: Date.now() - startTime,
      method: 'plain-text',
    };
  } catch (error) {
    return {
      text: '',
      processingTime: Date.now() - startTime,
      method: 'plain-text',
      error: `文本读取失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ============ 主入口函数 ============

/**
 * 根据 MIME 类型自动选择提取方法
 * 
 * @param buffer - 文件内容
 * @param mimeType - 文件 MIME 类型
 * @param options - OCR 选项 (仅图片有效)
 * @returns OCR 结果
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  options: OcrOptions = {}
): Promise<OcrResult> {
  const normalizedMime = mimeType.toLowerCase();
  
  // PDF
  if (normalizedMime === 'application/pdf') {
    const result = await extractTextFromPdf(buffer);
    
    // 如果 PDF 文本提取失败或内容为空，尝试 OCR (可能是扫描件)
    if (!result.text && !result.error) {
      console.log('[OCR] PDF 无文本内容，可能是扫描件，跳过 OCR');
      // TODO: 将 PDF 转换为图片后进行 OCR (需要额外依赖)
    }
    
    return result;
  }
  
  // 图片
  if (IMAGE_MIME_TYPES.includes(normalizedMime)) {
    return extractTextFromImage(buffer, options);
  }
  
  // DOCX
  if (
    normalizedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    normalizedMime === 'application/msword'
  ) {
    return extractTextFromDocx(buffer);
  }
  
  // XLSX/XLS
  if (
    normalizedMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    normalizedMime === 'application/vnd.ms-excel'
  ) {
    return extractTextFromXlsx(buffer);
  }
  
  // 纯文本
  if (
    normalizedMime.startsWith('text/') ||
    normalizedMime === 'application/json' ||
    normalizedMime === 'application/xml'
  ) {
    return extractTextFromPlainText(buffer);
  }
  
  // 不支持的类型
  return {
    text: '',
    processingTime: 0,
    method: 'plain-text',
    error: `不支持的文件类型: ${mimeType}`,
  };
}

/**
 * 判断文件是否需要 OCR 处理
 */
export function needsOcr(mimeType: string): boolean {
  const normalizedMime = mimeType.toLowerCase();
  
  // 这些类型需要 OCR 或文本提取
  const ocrTypes = [
    'application/pdf',
    ...IMAGE_MIME_TYPES,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  
  return ocrTypes.includes(normalizedMime);
}

/**
 * 获取支持的 MIME 类型列表
 */
export function getSupportedMimeTypes(): string[] {
  return [
    'application/pdf',
    ...IMAGE_MIME_TYPES,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/xml',
  ];
}
