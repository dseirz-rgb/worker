/**
 * Spec 文档加载器
 * 
 * 负责智能加载 spec 文档：
 * - 任务执行模式：自动加载对应的 requirements.md 和 design.md
 * - 非任务模式：不自动加载 spec 文档
 * - 支持 #[[file:]] 引用的外部文件按需加载
 */

import { ContextItem, TaskContext } from './types';
import { parseFileReferences, getUniqueFilePaths } from './fileReferenceParser';

/** Spec 文档类型 */
export type SpecDocType = 'requirements' | 'design' | 'tasks';

/** Spec 文档信息 */
export interface SpecDocument {
  /** 文档类型 */
  type: SpecDocType;
  /** 文件路径 */
  path: string;
  /** 文档内容 */
  content: string;
  /** 引用的外部文件路径 */
  referencedFiles: string[];
}

/** Spec 目录结构 */
export interface SpecDirectory {
  /** spec 目录路径 */
  path: string;
  /** 功能名称 */
  featureName: string;
  /** requirements.md 内容 */
  requirements?: string;
  /** design.md 内容 */
  design?: string;
  /** tasks.md 内容 */
  tasks?: string;
}

/**
 * 检测当前是否在任务执行模式
 * 
 * @param taskContext - 任务上下文
 * @returns 是否在任务执行模式
 */
export function isTaskExecutionMode(taskContext?: TaskContext): boolean {
  return taskContext !== undefined && 
         taskContext.specPath !== '' && 
         taskContext.taskId !== '';
}

/**
 * 从 spec 路径提取功能名称
 * 
 * @param specPath - spec 目录路径
 * @returns 功能名称
 */
export function extractFeatureName(specPath: string): string {
  // 路径格式: .kiro/specs/{feature-name}/
  const parts = specPath.split(/[/\\]/);
  const specsIndex = parts.indexOf('specs');
  
  if (specsIndex !== -1 && specsIndex < parts.length - 1) {
    return parts[specsIndex + 1];
  }
  
  // 回退：使用最后一个非空部分
  return parts.filter(Boolean).pop() ?? 'unknown';
}

/**
 * 构建 spec 文档路径
 * 
 * @param specPath - spec 目录路径
 * @param docType - 文档类型
 * @returns 完整文件路径
 */
export function buildSpecDocPath(specPath: string, docType: SpecDocType): string {
  const fileName = `${docType}.md`;
  const separator = specPath.includes('\\') ? '\\' : '/';
  
  // 确保路径末尾没有分隔符
  const basePath = specPath.replace(/[/\\]$/, '');
  
  return `${basePath}${separator}${fileName}`;
}

/**
 * 解析 spec 文档内容
 * 
 * @param content - 文档内容
 * @param path - 文档路径
 * @param type - 文档类型
 * @returns SpecDocument
 */
export function parseSpecDocument(
  content: string,
  path: string,
  type: SpecDocType
): SpecDocument {
  const referencedFiles = getUniqueFilePaths(content);
  
  return {
    type,
    path,
    content,
    referencedFiles,
  };
}

/**
 * 获取任务执行时应该加载的 spec 文档类型
 * 
 * @returns 应该加载的文档类型列表
 */
export function getRequiredSpecDocs(): SpecDocType[] {
  // 任务执行时自动加载 requirements 和 design
  return ['requirements', 'design'];
}

/**
 * 将 spec 文档转换为 ContextItem
 * 
 * @param doc - spec 文档
 * @param tokenCounter - token 计数函数
 * @returns ContextItem
 */
export function specDocToContextItem(
  doc: SpecDocument,
  tokenCounter: (content: string) => number
): ContextItem {
  const now = new Date();
  const tokenCount = tokenCounter(doc.content);
  
  return {
    id: `spec:${doc.path}`,
    type: 'spec',
    content: doc.content,
    tokenCount,
    priority: 'high', // spec 文档默认高优先级
    metadata: {
      source: doc.path,
    },
    createdAt: now,
    lastAccessedAt: now,
  };
}

/**
 * 加载 spec 文档
 * 
 * @param specDir - spec 目录信息
 * @param taskContext - 任务上下文（可选）
 * @param tokenCounter - token 计数函数
 * @returns 应该加载的 ContextItem 列表
 */
export function loadSpecDocuments(
  specDir: SpecDirectory,
  taskContext: TaskContext | undefined,
  tokenCounter: (content: string) => number
): ContextItem[] {
  // 非任务执行模式，不自动加载
  if (!isTaskExecutionMode(taskContext)) {
    return [];
  }
  
  const items: ContextItem[] = [];
  const requiredDocs = getRequiredSpecDocs();
  
  for (const docType of requiredDocs) {
    const content = getSpecContent(specDir, docType);
    if (!content) continue;
    
    const path = buildSpecDocPath(specDir.path, docType);
    const doc = parseSpecDocument(content, path, docType);
    const item = specDocToContextItem(doc, tokenCounter);
    
    items.push(item);
  }
  
  return items;
}

/**
 * 获取 spec 目录中指定类型的文档内容
 */
function getSpecContent(specDir: SpecDirectory, docType: SpecDocType): string | undefined {
  switch (docType) {
    case 'requirements':
      return specDir.requirements;
    case 'design':
      return specDir.design;
    case 'tasks':
      return specDir.tasks;
    default:
      return undefined;
  }
}

/**
 * 获取 spec 文档中所有引用的外部文件
 * 
 * @param specDir - spec 目录信息
 * @returns 所有引用的文件路径
 */
export function getAllReferencedFiles(specDir: SpecDirectory): string[] {
  const allPaths = new Set<string>();
  
  const contents = [
    specDir.requirements,
    specDir.design,
    specDir.tasks,
  ].filter(Boolean) as string[];
  
  for (const content of contents) {
    const paths = getUniqueFilePaths(content);
    paths.forEach((p) => allPaths.add(p));
  }
  
  return Array.from(allPaths);
}

/**
 * 检查 spec 目录是否有效
 * 
 * @param specDir - spec 目录信息
 * @returns 是否有效（至少有一个文档）
 */
export function isValidSpecDirectory(specDir: SpecDirectory): boolean {
  return !!(specDir.requirements || specDir.design || specDir.tasks);
}

/**
 * 获取当前上下文中的 spec 文档信息
 * 
 * @param items - 当前上下文项列表
 * @returns spec 文档路径列表
 */
export function getActiveSpecDocs(items: ContextItem[]): string[] {
  return items
    .filter((item) => item.type === 'spec')
    .map((item) => item.metadata.source);
}
