/**
 * 压缩引擎
 * 
 * 负责在上下文超出预算时进行智能压缩：
 * - 按优先级压缩（低优先级先压缩）
 * - 保护 critical 优先级的内容
 * - 记录所有压缩操作日志
 */

import {
  ContextItem,
  CompressionResult,
  CompressionLogEntry,
  CompressionAction,
  Priority,
  PRIORITY_WEIGHTS,
} from './types';

/** 压缩选项 */
export interface CompressionOptions {
  /** 目标 token 数 */
  targetTokens: number;
  /** 是否保护 critical 优先级 */
  preserveCritical: boolean;
  /** token 计数函数 */
  tokenCounter: (content: string) => number;
}

/**
 * 压缩引擎类
 */
export class CompressionEngine {
  private compressionLog: CompressionLogEntry[] = [];

  /**
   * 压缩上下文以适应预算
   * 
   * @param items - 上下文项列表
   * @param options - 压缩选项
   * @returns 压缩结果
   */
  compress(items: ContextItem[], options: CompressionOptions): CompressionResult {
    this.compressionLog = [];
    
    const { targetTokens, preserveCritical, tokenCounter } = options;
    
    // 计算当前总 token 数
    let currentTotal = items.reduce((sum, item) => sum + item.tokenCount, 0);
    
    // 如果未超出目标，直接返回
    if (currentTotal <= targetTokens) {
      return {
        items: [...items],
        removedItems: [],
        compressionLog: [],
      };
    }
    
    // 分离 critical 和非 critical 项
    const criticalItems: ContextItem[] = [];
    const compressibleItems: ContextItem[] = [];
    
    for (const item of items) {
      if (preserveCritical && item.priority === 'critical') {
        criticalItems.push(item);
      } else {
        compressibleItems.push(item);
      }
    }
    
    // 按优先级排序（低优先级在前，先被压缩）
    compressibleItems.sort((a, b) => {
      return PRIORITY_WEIGHTS[a.priority] - PRIORITY_WEIGHTS[b.priority];
    });
    
    const resultItems: ContextItem[] = [...criticalItems];
    const removedItems: ContextItem[] = [];
    
    // 计算 critical 项的 token 数
    const criticalTokens = criticalItems.reduce((sum, item) => sum + item.tokenCount, 0);
    let remainingBudget = targetTokens - criticalTokens;
    
    // 处理可压缩项
    for (const item of compressibleItems) {
      if (remainingBudget <= 0) {
        // 预算用尽，移除剩余项
        this.logCompression(item.id, 'removed', item.tokenCount, 0, '预算用尽');
        removedItems.push(item);
        continue;
      }
      
      if (item.tokenCount <= remainingBudget) {
        // 可以完整保留
        resultItems.push(item);
        remainingBudget -= item.tokenCount;
      } else {
        // 需要压缩或移除
        const compressed = this.compressItem(item, remainingBudget, tokenCounter);
        
        if (compressed) {
          resultItems.push(compressed);
          remainingBudget -= compressed.tokenCount;
        } else {
          this.logCompression(item.id, 'removed', item.tokenCount, 0, '无法压缩到目标大小');
          removedItems.push(item);
        }
      }
    }
    
    return {
      items: resultItems,
      removedItems,
      compressionLog: [...this.compressionLog],
    };
  }

  /**
   * 压缩单个上下文项
   * 
   * @param item - 要压缩的项
   * @param targetTokens - 目标 token 数
   * @param tokenCounter - token 计数函数
   * @returns 压缩后的项，如果无法压缩则返回 null
   */
  private compressItem(
    item: ContextItem,
    targetTokens: number,
    tokenCounter: (content: string) => number
  ): ContextItem | null {
    // 如果目标太小，无法压缩
    if (targetTokens < 50) {
      return null;
    }
    
    const originalTokens = item.tokenCount;
    let compressedContent: string;
    let action: CompressionAction;
    
    // 根据类型选择压缩策略
    switch (item.type) {
      case 'file':
        compressedContent = this.compressFileContent(item.content, targetTokens, tokenCounter);
        action = 'truncated';
        break;
      case 'conversation':
        compressedContent = this.compressConversationContent(item.content, targetTokens, tokenCounter);
        action = 'summarized';
        break;
      default:
        compressedContent = this.truncateContent(item.content, targetTokens, tokenCounter);
        action = 'truncated';
    }
    
    const newTokenCount = tokenCounter(compressedContent);
    
    if (newTokenCount > targetTokens) {
      return null;
    }
    
    this.logCompression(item.id, action, originalTokens, newTokenCount, `压缩到 ${targetTokens} tokens`);
    
    return {
      ...item,
      content: compressedContent,
      tokenCount: newTokenCount,
      metadata: {
        ...item.metadata,
        isCompressed: true,
        originalTokenCount: originalTokens,
      },
    };
  }

  /**
   * 压缩文件内容（保留关键结构）
   */
  private compressFileContent(
    content: string,
    targetTokens: number,
    tokenCounter: (content: string) => number
  ): string {
    // 尝试保留函数签名和类定义
    const lines = content.split('\n');
    const importantLines: string[] = [];
    const otherLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      // 保留函数、类、接口定义
      if (
        trimmed.startsWith('function ') ||
        trimmed.startsWith('class ') ||
        trimmed.startsWith('interface ') ||
        trimmed.startsWith('type ') ||
        trimmed.startsWith('export ') ||
        trimmed.startsWith('import ') ||
        trimmed.startsWith('const ') ||
        trimmed.startsWith('let ') ||
        trimmed.startsWith('var ') ||
        trimmed.startsWith('def ') ||  // Python
        trimmed.startsWith('async ') ||
        trimmed.startsWith('public ') ||
        trimmed.startsWith('private ') ||
        trimmed.startsWith('protected ')
      ) {
        importantLines.push(line);
      } else {
        otherLines.push(line);
      }
    }
    
    // 先尝试只保留重要行
    let result = importantLines.join('\n');
    if (tokenCounter(result) <= targetTokens) {
      // 如果还有空间，添加一些其他行
      for (const line of otherLines) {
        const newResult = result + '\n' + line;
        if (tokenCounter(newResult) > targetTokens) {
          break;
        }
        result = newResult;
      }
      return result + '\n\n[... 内容已压缩 ...]';
    }
    
    // 如果重要行也超出，则截断
    return this.truncateContent(result, targetTokens, tokenCounter);
  }

  /**
   * 压缩对话内容
   */
  private compressConversationContent(
    content: string,
    targetTokens: number,
    tokenCounter: (content: string) => number
  ): string {
    // 保留最近的对话
    const lines = content.split('\n');
    const result: string[] = [];
    
    // 从后往前添加，保留最近的内容
    for (let i = lines.length - 1; i >= 0; i--) {
      const newResult = [lines[i], ...result];
      if (tokenCounter(newResult.join('\n')) > targetTokens) {
        break;
      }
      result.unshift(lines[i]);
    }
    
    if (result.length < lines.length) {
      result.unshift('[... 早期对话已省略 ...]');
    }
    
    return result.join('\n');
  }

  /**
   * 简单截断内容
   */
  private truncateContent(
    content: string,
    targetTokens: number,
    tokenCounter: (content: string) => number
  ): string {
    // 二分查找合适的截断点
    let low = 0;
    let high = content.length;
    
    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      const truncated = content.slice(0, mid);
      
      if (tokenCounter(truncated) <= targetTokens - 20) { // 留出空间给省略标记
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    
    if (low < content.length) {
      return content.slice(0, low) + '\n\n[... 内容已截断 ...]';
    }
    
    return content;
  }

  /**
   * 记录压缩操作
   */
  private logCompression(
    itemId: string,
    action: CompressionAction,
    originalTokens: number,
    resultTokens: number,
    reason: string
  ): void {
    this.compressionLog.push({
      itemId,
      action,
      originalTokens,
      resultTokens,
      reason,
    });
  }

  /**
   * 获取压缩日志
   */
  getCompressionLog(): CompressionLogEntry[] {
    return [...this.compressionLog];
  }

  /**
   * 清除压缩日志
   */
  clearLog(): void {
    this.compressionLog = [];
  }
}

/**
 * 创建压缩引擎实例
 */
export function createCompressionEngine(): CompressionEngine {
  return new CompressionEngine();
}

/**
 * 简单的 token 计数器（基于字符数估算）
 * 实际使用时应替换为真正的 tokenizer
 */
export function estimateTokenCount(content: string): number {
  // 粗略估算：平均每 4 个字符约 1 个 token
  return Math.ceil(content.length / 4);
}
