/**
 * 文件管理服务
 * 参考 Paperless-ngx 的设计
 * 
 * 功能：
 * - 文件夹监控 (Folder Watching)
 * - 文档 OCR (Document OCR)
 * - 智能分类 (Smart Classification)
 * - 全文搜索 (Full-text Search)
 * - 语义搜索 (Semantic Search)
 * - 标签管理 (Tag Management)
 * - 文档预览 (Document Preview)
 */

import { invoke } from '@tauri-apps/api/core';
import { getGeminiClient } from '../ai/gemini';
import type { DbResult, LifeDomain } from '../../types/database';

// ============================================================================
// 类型定义
// ============================================================================

/** 文件索引项 */
export interface FileIndex {
  id: string;
  path: string;
  name: string;
  extension: string;
  size: number;
  domain?: LifeDomain;
  content?: string;
  ocrText?: string;
  summary?: string;
  tags: string[];
  correspondent?: string;  // 通讯方/来源 (参考 Paperless-ngx)
  documentType?: string;   // 文档类型
  indexedAt: string;
  modifiedAt: string;
  archivedAt?: string;     // 归档时间
}

/** 搜索结果 */
export interface FileSearchResult {
  file: FileIndex;
  score: number;
  highlights: string[];
  matchType: 'name' | 'content' | 'ocr' | 'tag' | 'semantic';
}

/** 搜索选项 */
export interface SearchOptions {
  domain?: LifeDomain;
  extensions?: string[];
  tags?: string[];
  types?: string[];
  correspondent?: string;
  documentType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

/** 文档类型 (参考 Paperless-ngx) */
export const DOCUMENT_TYPES = [
  { id: 'invoice', name: '发票', icon: '🧾' },
  { id: 'receipt', name: '收据', icon: '🧾' },
  { id: 'contract', name: '合同', icon: '📄' },
  { id: 'report', name: '报告', icon: '📊' },
  { id: 'letter', name: '信件', icon: '✉️' },
  { id: 'manual', name: '手册', icon: '📖' },
  { id: 'certificate', name: '证书', icon: '📜' },
  { id: 'photo', name: '照片', icon: '🖼️' },
  { id: 'note', name: '笔记', icon: '📝' },
  { id: 'other', name: '其他', icon: '📁' },
] as const;

/** 支持的文件类型 */
export const SUPPORTED_EXTENSIONS = {
  documents: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'md'],
  images: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'],
  spreadsheets: ['xls', 'xlsx', 'csv', 'ods'],
  presentations: ['ppt', 'pptx', 'odp'],
  archives: ['zip', 'rar', '7z', 'tar', 'gz'],
};

// ============================================================================
// 文件夹监控
// ============================================================================

/** 监控的文件夹列表 (内存缓存) */
let watchedFolders: string[] = [];

/**
 * 添加监控文件夹
 */
export async function addWatchFolder(path: string): Promise<DbResult<void>> {
  try {
    await invoke('add_watch_folder', { path });
    
    if (!watchedFolders.includes(path)) {
      watchedFolders.push(path);
    }
    
    // 开始索引文件夹中的文件
    await indexFolder(path);
    
    return { success: true };
  } catch (error) {
    console.error('添加监控文件夹失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '添加监控文件夹失败',
    };
  }
}

/**
 * 移除监控文件夹
 */
export async function removeWatchFolder(path: string): Promise<DbResult<void>> {
  try {
    await invoke('remove_watch_folder', { path });
    watchedFolders = watchedFolders.filter((f) => f !== path);
    return { success: true };
  } catch (error) {
    console.error('移除监控文件夹失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '移除监控文件夹失败',
    };
  }
}

/**
 * 获取监控的文件夹列表
 */
export function getWatchedFolders(): string[] {
  return [...watchedFolders];
}

/**
 * 从后端同步监控文件夹列表
 */
export async function syncWatchedFolders(): Promise<DbResult<string[]>> {
  try {
    const folders = await invoke<string[]>('get_watched_folders');
    watchedFolders = folders;
    return { success: true, data: folders };
  } catch (error) {
    console.error('同步监控文件夹失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '同步监控文件夹失败',
    };
  }
}

// ============================================================================
// 文件索引
// ============================================================================

/**
 * 索引单个文件
 */
export async function indexFile(path: string): Promise<DbResult<FileIndex>> {
  try {
    const fileIndex = await invoke<FileIndex>('index_file', { path });
    return { success: true, data: fileIndex };
  } catch (error) {
    console.error('索引文件失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '索引文件失败',
    };
  }
}

/**
 * 索引整个文件夹
 */
export async function indexFolder(path: string): Promise<DbResult<number>> {
  try {
    // TODO: 实现文件夹递归索引
    // 这里需要调用 Rust 后端遍历文件夹
    console.log('开始索引文件夹:', path);
    return { success: true, data: 0 };
  } catch (error) {
    console.error('索引文件夹失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '索引文件夹失败',
    };
  }
}

/**
 * 对文件进行 OCR
 */
export async function ocrFile(path: string): Promise<DbResult<string>> {
  try {
    const content = await invoke<string>('read_file_content', { path });
    
    // 如果是图片文件，使用 Gemini Vision OCR
    const ext = path.split('.').pop()?.toLowerCase();
    if (SUPPORTED_EXTENSIONS.images.includes(ext || '')) {
      const client = getGeminiClient();
      const prompt = `请识别图片中的所有文字，保持原文格式。只返回识别到的文字，不要添加解释。`;
      
      const ocrText = await client.generateContent(prompt, {
        generationConfig: { temperature: 0.1, maxOutputTokens: 4000 },
      });
      
      return { success: true, data: ocrText.trim() };
    }
    
    // 其他文件类型直接返回内容
    return { success: true, data: content };
  } catch (error) {
    console.error('OCR 文件失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OCR 文件失败',
    };
  }
}

// ============================================================================
// 智能分类 (参考 Paperless-ngx 的自动分类)
// ============================================================================

/**
 * 自动分类文档
 * 使用 AI 分析文档内容，自动分配标签、类型和领域
 */
export async function classifyDocument(
  filePath: string
): Promise<DbResult<{
  domain: LifeDomain;
  documentType: string;
  tags: string[];
  correspondent?: string;
  summary: string;
}>> {
  try {
    // 读取文件内容
    const contentResult = await readFileContent(filePath);
    if (!contentResult.success || !contentResult.data) {
      return { success: false, error: contentResult.error || '无法读取文件内容' };
    }
    
    const content = contentResult.data;
    const fileName = filePath.split('/').pop() || filePath;
    
    const client = getGeminiClient();
    
    const prompt = `分析以下文档内容，返回 JSON 格式的分类结果。

文件名: ${fileName}
内容:
${content.slice(0, 3000)}

请返回以下格式的 JSON（不要添加其他内容）:
{
  "domain": "work|investment|development|learning|family|health|entertainment|general",
  "documentType": "invoice|receipt|contract|report|letter|manual|certificate|photo|note|other",
  "tags": ["标签1", "标签2"],
  "correspondent": "来源/发送方（如果能识别）",
  "summary": "一句话摘要（不超过50字）"
}`;

    const response = await client.generateContent(prompt, {
      generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
    });

    // 解析 JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法解析分类结果');
    }

    const result = JSON.parse(jsonMatch[0]);
    
    return {
      success: true,
      data: {
        domain: result.domain || 'general',
        documentType: result.documentType || 'other',
        tags: result.tags || [],
        correspondent: result.correspondent,
        summary: result.summary || '',
      },
    };
  } catch (error) {
    console.error('文档分类失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '文档分类失败',
    };
  }
}

// ============================================================================
// 搜索功能
// ============================================================================

/**
 * 搜索文件
 */
export async function searchFiles(
  query: string,
  options?: SearchOptions
): Promise<DbResult<FileSearchResult[]>> {
  try {
    const results = await invoke<FileSearchResult[]>('search_files', {
      query,
      options,
    });
    return { success: true, data: results };
  } catch (error) {
    console.error('搜索文件失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '搜索文件失败',
    };
  }
}

/**
 * 语义搜索文件
 * 使用 AI 理解查询意图，进行更智能的搜索
 */
export async function semanticSearchFiles(
  query: string,
  options?: SearchOptions
): Promise<DbResult<FileSearchResult[]>> {
  try {
    const client = getGeminiClient();

    // 使用 AI 扩展搜索查询
    const prompt = `用户想要搜索文件，查询是："${query}"

请分析用户意图，生成搜索策略。返回 JSON 格式：
{
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "documentTypes": ["可能的文档类型"],
  "domains": ["可能的领域"],
  "dateHint": "时间提示（如果有）"
}

只返回 JSON，不要其他内容。`;

    const response = await client.generateContent(prompt, {
      generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // 降级到普通搜索
      return searchFiles(query, options);
    }

    const strategy = JSON.parse(jsonMatch[0]);
    const combinedQuery = strategy.keywords?.join(' ') || query;

    // 使用扩展的查询进行搜索
    return searchFiles(combinedQuery, {
      ...options,
      documentType: strategy.documentTypes?.[0],
    });
  } catch (error) {
    console.error('语义搜索文件失败:', error);
    // 降级到普通搜索
    return searchFiles(query, options);
  }
}

// ============================================================================
// 文档预览和摘要
// ============================================================================

/**
 * 获取文件摘要
 */
export async function getFileSummary(path: string): Promise<DbResult<string>> {
  try {
    const content = await invoke<string>('read_file_content', { path });

    const client = getGeminiClient();
    const prompt = `请为以下文件内容生成一个简短的摘要（不超过 100 字）：

${content.slice(0, 5000)}

只返回摘要内容，不要其他解释。`;

    const summary = await client.generateContent(prompt, {
      generationConfig: { temperature: 0.5, maxOutputTokens: 200 },
    });

    return { success: true, data: summary.trim() };
  } catch (error) {
    console.error('获取文件摘要失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取文件摘要失败',
    };
  }
}

/**
 * 读取文件内容
 */
export async function readFileContent(path: string): Promise<DbResult<string>> {
  try {
    const content = await invoke<string>('read_file_content', { path });
    return { success: true, data: content };
  } catch (error) {
    console.error('读取文件内容失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '读取文件内容失败',
    };
  }
}

// ============================================================================
// 标签管理
// ============================================================================

/**
 * 获取所有标签
 */
export async function getAllTags(): Promise<DbResult<string[]>> {
  try {
    // TODO: 从数据库获取所有标签
    return { success: true, data: [] };
  } catch (error) {
    console.error('获取标签失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取标签失败',
    };
  }
}

/**
 * 为文件添加标签
 */
export async function addTagToFile(
  fileId: string,
  tag: string
): Promise<DbResult<void>> {
  try {
    // TODO: 更新数据库
    console.log(`为文件 ${fileId} 添加标签: ${tag}`);
    return { success: true };
  } catch (error) {
    console.error('添加标签失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '添加标签失败',
    };
  }
}

/**
 * 从文件移除标签
 */
export async function removeTagFromFile(
  fileId: string,
  tag: string
): Promise<DbResult<void>> {
  try {
    // TODO: 更新数据库
    console.log(`从文件 ${fileId} 移除标签: ${tag}`);
    return { success: true };
  } catch (error) {
    console.error('移除标签失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '移除标签失败',
    };
  }
}

// ============================================================================
// 文件操作
// ============================================================================

/**
 * 选择文件夹对话框
 */
export async function selectFolder(): Promise<DbResult<string | null>> {
  try {
    const selected = await invoke<string | null>('select_folder');
    return { success: true, data: selected };
  } catch (error) {
    console.error('选择文件夹失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '选择文件夹失败',
    };
  }
}

/**
 * 打开文件
 */
export async function openFile(path: string): Promise<DbResult<void>> {
  try {
    // 使用系统默认程序打开文件
    await invoke('open_file', { path });
    return { success: true };
  } catch (error) {
    console.error('打开文件失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '打开文件失败',
    };
  }
}

/**
 * 在文件管理器中显示文件
 */
export async function showInFolder(path: string): Promise<DbResult<void>> {
  try {
    await invoke('show_in_folder', { path });
    return { success: true };
  } catch (error) {
    console.error('显示文件失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '显示文件失败',
    };
  }
}

// ============================================================================
// 统计信息
// ============================================================================

/** 文件统计 */
export interface FileStats {
  totalFiles: number;
  totalSize: number;
  tagCount: number;
  recentCount: number;
  pendingCount: number;
  lastIndexed?: string;
  byExtension: Record<string, number>;
  byDomain: Record<string, number>;
  byDocumentType: Record<string, number>;
  typeDistribution: Record<string, number>;
  topTags: { name: string; count: number }[];
  recentlyIndexed: number;
}

/**
 * 获取文件统计信息
 */
export async function getFileStats(): Promise<DbResult<FileStats>> {
  try {
    // TODO: 从数据库获取统计信息
    return {
      success: true,
      data: {
        totalFiles: 0,
        totalSize: 0,
        tagCount: 0,
        recentCount: 0,
        pendingCount: 0,
        lastIndexed: undefined,
        byExtension: {},
        byDomain: {},
        byDocumentType: {},
        typeDistribution: {
          document: 0,
          image: 0,
          archive: 0,
        },
        topTags: [],
        recentlyIndexed: 0,
      },
    };
  } catch (error) {
    console.error('获取文件统计失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取文件统计失败',
    };
  }
}
