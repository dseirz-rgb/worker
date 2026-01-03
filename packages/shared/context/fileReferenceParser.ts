/**
 * 文件引用解析器
 * 
 * 解析 #[[file:<path>]] 语法，支持相对路径和绝对路径
 */

import { FileReference } from './types';

/** 文件引用语法的正则表达式 */
const FILE_REFERENCE_REGEX = /#\[\[file:([^\]]+)\]\]/g;

/**
 * 解析内容中的所有文件引用
 * 
 * @param content - 要解析的内容
 * @returns 解析出的文件引用列表
 */
export function parseFileReferences(content: string): FileReference[] {
  const references: FileReference[] = [];
  
  // 重置正则表达式的 lastIndex
  FILE_REFERENCE_REGEX.lastIndex = 0;
  
  let match: RegExpExecArray | null;
  while ((match = FILE_REFERENCE_REGEX.exec(content)) !== null) {
    const syntax = match[0];
    const path = match[1].trim();
    const startIndex = match.index;
    const endIndex = startIndex + syntax.length;
    
    references.push({
      syntax,
      path,
      startIndex,
      endIndex,
    });
  }
  
  return references;
}

/**
 * 从文件引用构建原始语法
 * 
 * @param path - 文件路径
 * @returns 构建的语法字符串
 */
export function buildFileReferenceSyntax(path: string): string {
  return `#[[file:${path}]]`;
}

/**
 * 验证文件引用语法是否有效
 * 
 * @param syntax - 要验证的语法字符串
 * @returns 是否有效
 */
export function isValidFileReferenceSyntax(syntax: string): boolean {
  // 重置正则表达式
  const regex = /^#\[\[file:([^\]]+)\]\]$/;
  return regex.test(syntax);
}

/**
 * 从语法中提取路径
 * 
 * @param syntax - 文件引用语法
 * @returns 提取的路径，如果语法无效则返回 null
 */
export function extractPathFromSyntax(syntax: string): string | null {
  const regex = /^#\[\[file:([^\]]+)\]\]$/;
  const match = regex.exec(syntax);
  return match ? match[1].trim() : null;
}

/**
 * 替换内容中的文件引用为实际内容
 * 
 * @param content - 原始内容
 * @param replacements - 路径到替换内容的映射
 * @returns 替换后的内容
 */
export function replaceFileReferences(
  content: string,
  replacements: Map<string, string>
): string {
  return content.replace(FILE_REFERENCE_REGEX, (match, path) => {
    const trimmedPath = path.trim();
    return replacements.get(trimmedPath) ?? match;
  });
}

/**
 * 规范化文件路径
 * 
 * @param path - 原始路径
 * @param basePath - 基础路径（用于解析相对路径）
 * @returns 规范化后的路径
 */
export function normalizePath(path: string, basePath?: string): string {
  // 移除开头和结尾的空白
  let normalized = path.trim();
  
  // 如果是相对路径且提供了基础路径，则解析为绝对路径
  if (basePath && !isAbsolutePath(normalized)) {
    // 移除基础路径的文件名部分，保留目录
    const baseDir = basePath.replace(/[^/\\]+$/, '');
    normalized = joinPaths(baseDir, normalized);
  }
  
  // 规范化路径分隔符
  normalized = normalized.replace(/\\/g, '/');
  
  // 处理 ./ 和 ../
  const parts = normalized.split('/');
  const result: string[] = [];
  
  for (const part of parts) {
    if (part === '.' || part === '') {
      continue;
    } else if (part === '..') {
      result.pop();
    } else {
      result.push(part);
    }
  }
  
  // 保留开头的 / 如果是绝对路径
  const prefix = normalized.startsWith('/') ? '/' : '';
  return prefix + result.join('/');
}

/**
 * 检查路径是否为绝对路径
 */
function isAbsolutePath(path: string): boolean {
  // Unix 绝对路径以 / 开头
  // Windows 绝对路径以盘符开头（如 C:）
  return path.startsWith('/') || /^[a-zA-Z]:/.test(path);
}

/**
 * 连接路径
 */
function joinPaths(base: string, relative: string): string {
  if (!base) return relative;
  if (!relative) return base;
  
  const separator = '/';
  const baseEndsWithSep = base.endsWith(separator) || base.endsWith('\\');
  const relativeStartsWithSep = relative.startsWith(separator) || relative.startsWith('\\');
  
  if (baseEndsWithSep && relativeStartsWithSep) {
    return base + relative.slice(1);
  } else if (baseEndsWithSep || relativeStartsWithSep) {
    return base + relative;
  } else {
    return base + separator + relative;
  }
}

/**
 * 获取内容中所有唯一的文件路径
 * 
 * @param content - 要解析的内容
 * @returns 唯一路径列表
 */
export function getUniqueFilePaths(content: string): string[] {
  const references = parseFileReferences(content);
  const paths = new Set(references.map((ref) => ref.path));
  return Array.from(paths);
}
