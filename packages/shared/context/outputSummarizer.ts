/**
 * 大输出摘要触发器
 * 
 * 检测 MCP 工具输出的 token 数量，超过阈值时触发摘要
 */

/** 默认摘要阈值（token 数） */
const DEFAULT_SUMMARIZATION_THRESHOLD = 1000;

/** 摘要选项 */
export interface SummarizationOptions {
  /** 触发摘要的 token 阈值 */
  threshold: number;
  /** token 计数函数 */
  tokenCounter: (content: string) => number;
  /** 摘要生成函数（可选，用于实际生成摘要） */
  summarizer?: (content: string) => Promise<string>;
}

/** 摘要检查结果 */
export interface SummarizationCheckResult {
  /** 是否需要摘要 */
  needsSummarization: boolean;
  /** 原始 token 数 */
  tokenCount: number;
  /** 阈值 */
  threshold: number;
  /** 超出的 token 数 */
  excessTokens: number;
}

/** 摘要结果 */
export interface SummarizationResult {
  /** 是否进行了摘要 */
  wasSummarized: boolean;
  /** 原始内容 */
  originalContent: string;
  /** 结果内容（可能是摘要或原始内容） */
  resultContent: string;
  /** 原始 token 数 */
  originalTokens: number;
  /** 结果 token 数 */
  resultTokens: number;
}

/**
 * 输出摘要器类
 */
export class OutputSummarizer {
  private options: SummarizationOptions;

  constructor(options?: Partial<SummarizationOptions>) {
    this.options = {
      threshold: options?.threshold ?? DEFAULT_SUMMARIZATION_THRESHOLD,
      tokenCounter: options?.tokenCounter ?? defaultTokenCounter,
      summarizer: options?.summarizer,
    };
  }

  /**
   * 检查输出是否需要摘要
   * 
   * @param content - 输出内容
   * @returns 检查结果
   */
  checkNeedsSummarization(content: string): SummarizationCheckResult {
    const tokenCount = this.options.tokenCounter(content);
    const needsSummarization = tokenCount > this.options.threshold;
    const excessTokens = Math.max(0, tokenCount - this.options.threshold);

    return {
      needsSummarization,
      tokenCount,
      threshold: this.options.threshold,
      excessTokens,
    };
  }

  /**
   * 处理输出（如果需要则摘要）
   * 
   * @param content - 输出内容
   * @returns 处理结果
   */
  async processOutput(content: string): Promise<SummarizationResult> {
    const check = this.checkNeedsSummarization(content);

    if (!check.needsSummarization) {
      return {
        wasSummarized: false,
        originalContent: content,
        resultContent: content,
        originalTokens: check.tokenCount,
        resultTokens: check.tokenCount,
      };
    }

    // 如果提供了摘要函数，使用它
    if (this.options.summarizer) {
      const summary = await this.options.summarizer(content);
      const summaryTokens = this.options.tokenCounter(summary);

      return {
        wasSummarized: true,
        originalContent: content,
        resultContent: summary,
        originalTokens: check.tokenCount,
        resultTokens: summaryTokens,
      };
    }

    // 否则使用简单的截断策略
    const truncated = this.truncateOutput(content, this.options.threshold);
    const truncatedTokens = this.options.tokenCounter(truncated);

    return {
      wasSummarized: true,
      originalContent: content,
      resultContent: truncated,
      originalTokens: check.tokenCount,
      resultTokens: truncatedTokens,
    };
  }

  /**
   * 简单截断输出
   * 
   * @param content - 原始内容
   * @param targetTokens - 目标 token 数
   * @returns 截断后的内容
   */
  private truncateOutput(content: string, targetTokens: number): string {
    const tokenCounter = this.options.tokenCounter;
    
    // 预留空间给省略标记
    const reservedTokens = 50;
    const effectiveTarget = targetTokens - reservedTokens;

    // 二分查找合适的截断点
    let low = 0;
    let high = content.length;

    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      const truncated = content.slice(0, mid);

      if (tokenCounter(truncated) <= effectiveTarget) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    // 尝试在行边界截断
    const truncatePoint = content.lastIndexOf('\n', low);
    const finalPoint = truncatePoint > low * 0.8 ? truncatePoint : low;

    const truncated = content.slice(0, finalPoint);
    const remaining = content.length - finalPoint;
    const remainingTokens = this.options.tokenCounter(content.slice(finalPoint));

    return `${truncated}\n\n[... 输出已截断，省略了约 ${remainingTokens} tokens (${remaining} 字符) ...]`;
  }

  /**
   * 获取当前阈值
   */
  getThreshold(): number {
    return this.options.threshold;
  }

  /**
   * 设置阈值
   */
  setThreshold(threshold: number): void {
    if (threshold > 0) {
      this.options.threshold = threshold;
    }
  }

  /**
   * 设置摘要函数
   */
  setSummarizer(summarizer: (content: string) => Promise<string>): void {
    this.options.summarizer = summarizer;
  }
}

/**
 * 默认 token 计数器（基于字符数估算）
 */
function defaultTokenCounter(content: string): number {
  // 粗略估算：平均每 4 个字符约 1 个 token
  return Math.ceil(content.length / 4);
}

/**
 * 创建输出摘要器实例
 */
export function createOutputSummarizer(
  options?: Partial<SummarizationOptions>
): OutputSummarizer {
  return new OutputSummarizer(options);
}

/**
 * 快速检查是否需要摘要
 * 
 * @param content - 输出内容
 * @param threshold - 阈值（默认 1000）
 * @param tokenCounter - token 计数函数
 * @returns 是否需要摘要
 */
export function needsSummarization(
  content: string,
  threshold: number = DEFAULT_SUMMARIZATION_THRESHOLD,
  tokenCounter: (content: string) => number = defaultTokenCounter
): boolean {
  return tokenCounter(content) > threshold;
}
