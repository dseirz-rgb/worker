/**
 * Steering 文件加载器
 * 
 * 负责加载和管理 steering 文件，支持三种加载模式：
 * - always: 始终加载
 * - fileMatch: 当匹配文件在上下文中时加载
 * - manual: 仅当用户显式引用时加载
 */

import {
  ContextItem,
  InclusionMode,
  Priority,
  SteeringLevel,
  PRIORITY_WEIGHTS,
} from './types';
import { parseFileReferences } from './fileReferenceParser';

/** Steering 文件的 front-matter 配置 */
export interface SteeringFrontMatter {
  /** 加载模式，默认 always */
  inclusion?: InclusionMode;
  /** fileMatch 模式的匹配规则 */
  fileMatchPattern?: string;
  /** 优先级，默认 medium */
  priority?: Priority;
}

/** Steering 文件信息 */
export interface SteeringFile {
  /** 文件路径 */
  path: string;
  /** 文件内容（不含 front-matter） */
  content: string;
  /** front-matter 配置 */
  frontMatter: SteeringFrontMatter;
  /** 来源层级 */
  level: SteeringLevel;
}

/** 加载选项 */
export interface LoadOptions {
  /** 当前活跃的文件列表 */
  activeFiles: string[];
  /** 用户显式引用的 steering 文件 */
  manualReferences: string[];
}

/**
 * 解析 front-matter
 * 
 * @param content - 文件完整内容
 * @returns front-matter 和正文内容
 */
export function parseFrontMatter(content: string): {
  frontMatter: SteeringFrontMatter;
  body: string;
} {
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = frontMatterRegex.exec(content);
  
  if (!match) {
    return {
      frontMatter: {},
      body: content,
    };
  }
  
  const frontMatterStr = match[1];
  const body = content.slice(match[0].length);
  
  // 简单的 YAML 解析（仅支持基本键值对）
  const frontMatter: SteeringFrontMatter = {};
  const lines = frontMatterStr.split('\n');
  
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
    
    // 移除引号
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    switch (key) {
      case 'inclusion':
        if (isValidInclusionMode(value)) {
          frontMatter.inclusion = value;
        }
        break;
      case 'fileMatchPattern':
        frontMatter.fileMatchPattern = value;
        break;
      case 'priority':
        if (isValidPriority(value)) {
          frontMatter.priority = value;
        }
        break;
    }
  }
  
  return { frontMatter, body };
}

/**
 * 验证 inclusion mode 是否有效
 */
function isValidInclusionMode(value: string): value is InclusionMode {
  return ['always', 'fileMatch', 'manual'].includes(value);
}

/**
 * 验证 priority 是否有效
 */
function isValidPriority(value: string): value is Priority {
  return ['critical', 'high', 'medium', 'low'].includes(value);
}

/**
 * 检查文件是否匹配 glob 模式
 * 
 * @param filePath - 文件路径
 * @param pattern - glob 模式
 * @returns 是否匹配
 */
export function matchesPattern(filePath: string, pattern: string): boolean {
  // 将 glob 模式转换为正则表达式
  const regexPattern = pattern
    .replace(/\./g, '\\.')           // 转义点号
    .replace(/\*\*/g, '{{GLOBSTAR}}') // 临时替换 **
    .replace(/\*/g, '[^/]*')          // * 匹配非斜杠字符
    .replace(/\?/g, '[^/]')           // ? 匹配单个非斜杠字符
    .replace(/\{\{GLOBSTAR\}\}/g, '.*'); // ** 匹配任意字符
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}

/**
 * 判断 steering 文件是否应该被加载
 * 
 * @param file - steering 文件
 * @param options - 加载选项
 * @returns 是否应该加载
 */
export function shouldLoadSteeringFile(
  file: SteeringFile,
  options: LoadOptions
): boolean {
  const mode = file.frontMatter.inclusion ?? 'always';
  
  switch (mode) {
    case 'always':
      return true;
      
    case 'fileMatch': {
      const pattern = file.frontMatter.fileMatchPattern;
      if (!pattern) return false;
      
      // 检查是否有任何活跃文件匹配模式
      return options.activeFiles.some((f) => matchesPattern(f, pattern));
    }
    
    case 'manual':
      // 检查是否被用户显式引用
      return options.manualReferences.includes(file.path);
      
    default:
      return false;
  }
}

/**
 * 解决 steering 文件冲突
 * 
 * 规则：
 * 1. workspace 级别优先于 global 级别
 * 2. 相同级别时，高优先级优先于低优先级
 * 
 * @param files - steering 文件列表
 * @returns 去重后的文件列表
 */
export function resolveConflicts(files: SteeringFile[]): SteeringFile[] {
  // 按文件名分组
  const groups = new Map<string, SteeringFile[]>();
  
  for (const file of files) {
    const fileName = getFileName(file.path);
    const existing = groups.get(fileName) ?? [];
    existing.push(file);
    groups.set(fileName, existing);
  }
  
  // 对每组选择优先级最高的
  const result: SteeringFile[] = [];
  
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
    } else {
      // 排序：workspace > global，然后按 priority
      group.sort((a, b) => {
        // 先比较 level
        if (a.level !== b.level) {
          return a.level === 'workspace' ? -1 : 1;
        }
        // 再比较 priority
        const priorityA = a.frontMatter.priority ?? 'medium';
        const priorityB = b.frontMatter.priority ?? 'medium';
        return PRIORITY_WEIGHTS[priorityB] - PRIORITY_WEIGHTS[priorityA];
      });
      result.push(group[0]);
    }
  }
  
  return result;
}

/**
 * 从路径中提取文件名
 */
function getFileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] ?? path;
}

/**
 * 将 steering 文件转换为 ContextItem
 * 
 * @param file - steering 文件
 * @param tokenCounter - token 计数函数
 * @returns ContextItem
 */
export function steeringFileToContextItem(
  file: SteeringFile,
  tokenCounter: (content: string) => number
): ContextItem {
  const now = new Date();
  const tokenCount = tokenCounter(file.content);
  
  return {
    id: `steering:${file.path}`,
    type: 'steering',
    content: file.content,
    tokenCount,
    priority: file.frontMatter.priority ?? 'medium',
    metadata: {
      source: file.path,
      inclusionMode: file.frontMatter.inclusion ?? 'always',
      fileMatchPattern: file.frontMatter.fileMatchPattern,
      steeringLevel: file.level,
    },
    createdAt: now,
    lastAccessedAt: now,
  };
}

/**
 * 加载 steering 文件并转换为 ContextItem
 * 
 * @param files - 所有 steering 文件
 * @param options - 加载选项
 * @param tokenCounter - token 计数函数
 * @returns 应该加载的 ContextItem 列表
 */
export function loadSteeringFiles(
  files: SteeringFile[],
  options: LoadOptions,
  tokenCounter: (content: string) => number
): ContextItem[] {
  // 1. 过滤应该加载的文件
  const filesToLoad = files.filter((f) => shouldLoadSteeringFile(f, options));
  
  // 2. 解决冲突
  const resolvedFiles = resolveConflicts(filesToLoad);
  
  // 3. 转换为 ContextItem
  return resolvedFiles.map((f) => steeringFileToContextItem(f, tokenCounter));
}

/**
 * 获取 steering 文件中的文件引用
 * 
 * @param file - steering 文件
 * @returns 文件引用路径列表
 */
export function getSteeringFileReferences(file: SteeringFile): string[] {
  const references = parseFileReferences(file.content);
  return references.map((ref) => ref.path);
}
