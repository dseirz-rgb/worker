/**
 * File Parser
 * 
 * 解析多种文件格式为文本内容，支持：
 * - TXT 纯文本
 * - Markdown
 * - PDF
 * - Excel (xlsx/xls)
 * - Google Sheets (已导出为文本)
 * 
 * @module services/echo-server/lib/fileParser
 */

import * as XLSX from 'xlsx';

// pdf-parse 在导入时会尝试加载测试文件，使用动态导入避免这个问题
let pdfParse: typeof import('pdf-parse') | null = null;
async function getPdfParser() {
  if (!pdfParse) {
    pdfParse = await import('pdf-parse');
  }
  return pdfParse.default;
}

// ============================================================================
// 类型定义
// ============================================================================

export type SourceType = 
  | 'uploaded_file'     // 书籍文件 (TXT/PDF/Markdown)
  | 'strategy_sheet'    // Google Sheets 投资策略
  | 'financial_model';  // Excel 财务模型

export interface ParsedContent {
  text: string;
  metadata: Record<string, unknown>;
  sourceType: SourceType;
}

export interface ChunkOptions {
  chunkSize?: number;   // 每个分片的字符数，默认 1000
  overlap?: number;     // 分片重叠字符数，默认 100
}

export interface TextChunk {
  content: string;
  index: number;
  totalChunks: number;
}

// ============================================================================
// 文件解析
// ============================================================================

/**
 * 解析文件内容
 */
export async function parseFile(
  content: Buffer,
  mimeType: string,
  fileName: string
): Promise<ParsedContent> {
  const extension = getExtension(fileName);
  
  switch (mimeType) {
    case 'text/plain':
      return parseTxt(content, fileName);
    
    case 'text/markdown':
    case 'text/x-markdown':
      return parseMarkdown(content, fileName);
    
    case 'application/pdf':
      return parsePdf(content, fileName);
    
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel':
      return parseExcel(content, fileName);
    
    case 'application/vnd.google-apps.spreadsheet':
      // Google Sheets 应该已经被导出为文本
      return {
        text: content.toString('utf-8'),
        metadata: { originalFilename: fileName, mimeType },
        sourceType: 'strategy_sheet',
      };
    
    default:
      // 尝试根据扩展名判断
      if (extension === 'txt') {
        return parseTxt(content, fileName);
      }
      if (extension === 'md' || extension === 'markdown') {
        return parseMarkdown(content, fileName);
      }
      if (extension === 'xlsx' || extension === 'xls') {
        return parseExcel(content, fileName);
      }
      
      throw new Error(`不支持的文件类型: ${mimeType} (${fileName})`);
  }
}

/**
 * 解析 TXT 文件
 */
function parseTxt(content: Buffer, fileName: string): ParsedContent {
  return {
    text: content.toString('utf-8'),
    metadata: {
      originalFilename: fileName,
      mimeType: 'text/plain',
    },
    sourceType: 'uploaded_file',
  };
}

/**
 * 解析 Markdown 文件
 */
function parseMarkdown(content: Buffer, fileName: string): ParsedContent {
  // Markdown 直接作为文本处理，保留格式
  return {
    text: content.toString('utf-8'),
    metadata: {
      originalFilename: fileName,
      mimeType: 'text/markdown',
    },
    sourceType: 'uploaded_file',
  };
}

/**
 * 解析 PDF 文件
 */
async function parsePdf(content: Buffer, fileName: string): Promise<ParsedContent> {
  try {
    const pdf = await getPdfParser();
    const data = await pdf(content);
    return {
      text: data.text,
      metadata: {
        originalFilename: fileName,
        mimeType: 'application/pdf',
        pageCount: data.numpages,
        info: data.info,
      },
      sourceType: 'uploaded_file',
    };
  } catch (error) {
    throw new Error(`PDF 解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 解析 Excel 文件
 */
function parseExcel(content: Buffer, fileName: string): ParsedContent {
  try {
    const workbook = XLSX.read(content, { type: 'buffer' });
    const allContent: string[] = [];
    const sheetNames = workbook.SheetNames;

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      
      // 转换为 JSON 数组
      const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { 
        header: 1,
        defval: '',
      });

      if (jsonData.length === 0) continue;

      // 构建表格格式
      allContent.push(`## Sheet: ${sheetName}\n`);
      
      // 表头
      const headers = jsonData[0] as string[];
      if (headers.length > 0) {
        allContent.push('| ' + headers.map(h => String(h)).join(' | ') + ' |');
        allContent.push('| ' + headers.map(() => '---').join(' | ') + ' |');
        
        // 数据行
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as unknown[];
          // 确保每行有足够的列，并保持数值精度
          const cells = headers.map((_, idx) => {
            const value = row[idx];
            if (value === undefined || value === null || value === '') {
              return '';
            }
            // 保持数值精度
            if (typeof value === 'number') {
              return formatNumber(value);
            }
            return String(value);
          });
          allContent.push('| ' + cells.join(' | ') + ' |');
        }
      }
      
      allContent.push('');
    }

    return {
      text: allContent.join('\n'),
      metadata: {
        originalFilename: fileName,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sheetCount: sheetNames.length,
        sheetNames,
      },
      sourceType: 'financial_model',
    };
  } catch (error) {
    throw new Error(`Excel 解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// 文本切片
// ============================================================================

/**
 * 将文本切分为多个分片
 * 
 * @param text 原始文本
 * @param options 切片选项
 * @returns 文本分片数组
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const { chunkSize = 1000, overlap = 100 } = options;
  
  if (chunkSize <= 0) {
    throw new Error('chunkSize 必须大于 0');
  }
  if (overlap < 0) {
    throw new Error('overlap 不能为负数');
  }
  if (overlap >= chunkSize) {
    throw new Error('overlap 必须小于 chunkSize');
  }
  
  if (!text || text.length === 0) {
    return [];
  }
  
  const chunks: TextChunk[] = [];
  let start = 0;
  const step = chunkSize - overlap;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push({
      content: text.slice(start, end),
      index: chunks.length,
      totalChunks: 0, // 稍后更新
    });
    start += step;
    
    // 如果剩余内容不足一个 step，直接结束
    if (start >= text.length) break;
  }
  
  // 更新 totalChunks
  const total = chunks.length;
  for (const chunk of chunks) {
    chunk.totalChunks = total;
  }
  
  return chunks;
}

/**
 * 从分片重建原始文本（去除重叠部分）
 * 用于验证切片的正确性
 */
export function reconstructText(chunks: TextChunk[], overlap: number = 100): string {
  if (chunks.length === 0) return '';
  if (chunks.length === 1) return chunks[0].content;
  
  // 按索引排序
  const sorted = [...chunks].sort((a, b) => a.index - b.index);
  
  let result = sorted[0].content;
  
  for (let i = 1; i < sorted.length; i++) {
    const chunk = sorted[i];
    // 跳过重叠部分
    const nonOverlapPart = chunk.content.slice(overlap);
    result += nonOverlapPart;
  }
  
  return result;
}

// ============================================================================
// 标题生成
// ============================================================================

/**
 * 从文件名生成文档标题
 * 
 * @param fileName 文件名（包含扩展名）
 * @param partIndex 分片索引（可选）
 * @param totalParts 总分片数（可选）
 * @returns 文档标题
 */
export function generateTitle(
  fileName: string,
  partIndex?: number,
  totalParts?: number
): string {
  // 移除扩展名
  const baseName = removeExtension(fileName);
  
  // 如果有分片信息，添加 Part 标记
  if (partIndex !== undefined && totalParts !== undefined && totalParts > 1) {
    return `${baseName} (Part ${partIndex + 1})`;
  }
  
  return baseName;
}

/**
 * 移除文件扩展名
 */
export function removeExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) {
    return fileName;
  }
  return fileName.slice(0, lastDot);
}

/**
 * 获取文件扩展名（小写）
 */
export function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1 || lastDot === fileName.length - 1) {
    return '';
  }
  return fileName.slice(lastDot + 1).toLowerCase();
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 格式化数字，保持精度
 */
function formatNumber(value: number): string {
  // 检查是否是整数
  if (Number.isInteger(value)) {
    return value.toString();
  }
  
  // 对于小数，保持合理的精度
  // 避免浮点数精度问题导致的过长小数
  const str = value.toString();
  
  // 如果是科学计数法，保持原样
  if (str.includes('e') || str.includes('E')) {
    return str;
  }
  
  // 限制小数位数为 10 位
  const parts = str.split('.');
  if (parts.length === 2 && parts[1].length > 10) {
    return value.toFixed(10).replace(/\.?0+$/, '');
  }
  
  return str;
}

/**
 * 根据 MIME 类型判断 source_type
 */
export function getSourceType(mimeType: string): SourceType {
  switch (mimeType) {
    case 'application/vnd.google-apps.spreadsheet':
      return 'strategy_sheet';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel':
      return 'financial_model';
    default:
      return 'uploaded_file';
  }
}

export default {
  parseFile,
  chunkText,
  reconstructText,
  generateTitle,
  removeExtension,
  getExtension,
  getSourceType,
};
