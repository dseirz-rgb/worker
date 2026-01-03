/**
 * Research Agent - 多轮自主研究能力
 * 
 * 类似 Khoj Research Mode，支持:
 * - 多轮迭代研究
 * - RAG + Web 搜索
 * - 来源引用和置信度评估
 * - 流式输出进度
 */

import { AiModelFactory } from './aiModelFactory';
import { tavily } from '@tavily/core';
import { getGlobalConfig } from '@server/routerTrpc/config';
import { prisma } from '@server/prisma';

// 研究配置
export interface ResearchConfig {
  maxIterations: number;        // 最大迭代次数，默认 5
  searchDepth: 'shallow' | 'deep';
  tools: ('rag' | 'web' | 'files')[];
  timeout: number;              // 超时时间 (ms)
}

// 研究来源
export interface ResearchSource {
  type: 'note' | 'web' | 'file';
  title: string;
  url?: string;
  noteId?: number;
  snippet: string;
  relevance: number;
}

// 研究迭代
export interface ResearchIteration {
  iteration: number;
  query: string;
  findings: string;
  sources: ResearchSource[];
  nextSteps: string[];
  timestamp: Date;
}

// 研究结果
export interface ResearchResult {
  summary: string;
  sources: ResearchSource[];
  iterations: ResearchIteration[];
  confidence: number;
  totalTime: number;
  status: 'completed' | 'partial' | 'timeout';
}

// 研究错误
export class ResearchError extends Error {
  constructor(
    message: string,
    public code: 'TIMEOUT' | 'NO_RESULTS' | 'TOOL_FAILED' | 'ITERATION_LIMIT' | 'CONFIG_ERROR',
    public partialResult?: Partial<ResearchResult>
  ) {
    super(message);
    this.name = 'ResearchError';
  }
}

// 默认配置
const DEFAULT_CONFIG: ResearchConfig = {
  maxIterations: 5,
  searchDepth: 'deep',
  tools: ['rag', 'web'],
  timeout: 120000, // 2 分钟
};

/**
 * Research Agent 类
 */
export class ResearchAgent {
  private config: ResearchConfig;
  private accountId: number;
  private startTime: number = 0;

  constructor(accountId: number, config?: Partial<ResearchConfig>) {
    this.accountId = accountId;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行多轮研究 - 异步生成器
   */
  async *research(query: string): AsyncGenerator<ResearchIteration, ResearchResult> {
    this.startTime = Date.now();
    const iterations: ResearchIteration[] = [];
    const allSources: ResearchSource[] = [];
    let currentQuery = query;

    try {
      for (let i = 0; i < this.config.maxIterations; i++) {
        // 检查超时
        if (this.isTimeout()) {
          throw new ResearchError(
            'Research timeout',
            'TIMEOUT',
            this.buildPartialResult(query, iterations, allSources)
          );
        }

        console.log(`[ResearchAgent] Iteration ${i + 1}: "${currentQuery}"`);

        // 1. 搜索本地笔记 (RAG)
        const ragResults = this.config.tools.includes('rag')
          ? await this.searchNotes(currentQuery)
          : [];

        // 2. 搜索网络 (如果启用)
        const webResults = this.config.tools.includes('web')
          ? await this.searchWeb(currentQuery)
          : [];

        // 3. 搜索文件 (如果启用)
        const fileResults = this.config.tools.includes('files')
          ? await this.searchFiles(currentQuery)
          : [];

        const combinedSources = [...ragResults, ...webResults, ...fileResults];

        // 4. 分析结果，生成发现
        const findings = await this.analyzeResults(currentQuery, combinedSources, iterations);

        // 5. 决定下一步
        const nextSteps = await this.planNextSteps(query, findings, iterations);

        const iteration: ResearchIteration = {
          iteration: i + 1,
          query: currentQuery,
          findings: findings.summary,
          sources: findings.sources,
          nextSteps,
          timestamp: new Date(),
        };

        iterations.push(iteration);
        allSources.push(...findings.sources);

        // 流式返回迭代结果
        yield iteration;

        // 如果没有下一步或标记完成，结束研究
        if (nextSteps.length === 0 || nextSteps[0] === 'COMPLETE') {
          console.log(`[ResearchAgent] Research completed at iteration ${i + 1}`);
          break;
        }

        // 更新查询为下一步
        currentQuery = nextSteps[0];
      }

      // 生成最终总结
      const summary = await this.generateSummary(query, iterations);
      const uniqueSources = this.deduplicateSources(allSources);
      const confidence = this.calculateConfidence(iterations, uniqueSources);

      const result: ResearchResult = {
        summary,
        sources: uniqueSources,
        iterations,
        confidence,
        totalTime: Date.now() - this.startTime,
        status: 'completed',
      };

      // 保存研究会话
      await this.saveSession(query, result);

      return result;
    } catch (error) {
      if (error instanceof ResearchError) {
        // 返回部分结果
        if (error.partialResult) {
          const partialSummary = await this.generateSummary(query, iterations);
          return {
            summary: partialSummary + '\n\n[注意: 研究因超时而提前结束]',
            sources: this.deduplicateSources(allSources),
            iterations,
            confidence: this.calculateConfidence(iterations, allSources) * 0.7,
            totalTime: Date.now() - this.startTime,
            status: 'partial',
          };
        }
      }
      throw error;
    }
  }

  /**
   * 搜索笔记 (RAG)
   */
  private async searchNotes(query: string): Promise<ResearchSource[]> {
    try {
      const { notes } = await AiModelFactory.queryVector(query, this.accountId, 10);
      
      return notes.map(note => ({
        type: 'note' as const,
        title: this.extractTitle(note.content),
        noteId: note.id,
        snippet: note.content.slice(0, 300),
        relevance: note.score || 0.5,
      }));
    } catch (error) {
      console.error('[ResearchAgent] RAG search failed:', error);
      return [];
    }
  }

  /**
   * 搜索网络
   */
  private async searchWeb(query: string): Promise<ResearchSource[]> {
    try {
      const config = await getGlobalConfig({ useAdmin: true });
      
      if (!config.tavilyApiKey) {
        console.warn('[ResearchAgent] Tavily API key not configured');
        return [];
      }

      const client = tavily({ apiKey: config.tavilyApiKey });
      const maxResults = this.config.searchDepth === 'deep' ? 10 : 5;
      
      const result = await client.search(query, { max_results: maxResults });

      return (result.results || []).map(r => ({
        type: 'web' as const,
        title: r.title || 'Untitled',
        url: r.url,
        snippet: r.content || '',
        relevance: r.score || 0.5,
      }));
    } catch (error) {
      console.error('[ResearchAgent] Web search failed:', error);
      return [];
    }
  }

  /**
   * 搜索文件
   */
  private async searchFiles(query: string): Promise<ResearchSource[]> {
    try {
      const files = await prisma.attachments.findMany({
        where: {
          accountId: this.accountId,
          content: {
            contains: query,
            mode: 'insensitive',
          },
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });

      return files.map(f => ({
        type: 'file' as const,
        title: f.name,
        snippet: f.content?.slice(0, 300) || '',
        relevance: 0.6,
      }));
    } catch (error) {
      console.error('[ResearchAgent] File search failed:', error);
      return [];
    }
  }

  /**
   * 分析搜索结果
   */
  private async analyzeResults(
    query: string,
    sources: ResearchSource[],
    previousIterations: ResearchIteration[]
  ): Promise<{ summary: string; sources: ResearchSource[] }> {
    if (sources.length === 0) {
      return { summary: '未找到相关信息', sources: [] };
    }

    try {
      const agent = await AiModelFactory.BaseChatAgent({ withTools: false });
      
      // 构建上下文
      const sourcesContext = sources
        .slice(0, 10)
        .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}`)
        .join('\n\n');

      const previousContext = previousIterations.length > 0
        ? `\n\n之前的发现:\n${previousIterations.map(it => it.findings).join('\n')}`
        : '';

      const response = await agent.generate([
        {
          role: 'system',
          content: `你是一个研究分析专家。分析提供的信息来源，提取与查询相关的关键发现。
保持客观，引用来源编号。输出简洁的发现总结（200-400字）。`,
        },
        {
          role: 'user',
          content: `查询: ${query}\n\n信息来源:\n${sourcesContext}${previousContext}\n\n请分析并总结关键发现:`,
        },
      ]);

      // 根据分析结果过滤相关来源
      const relevantSources = sources
        .filter(s => s.relevance >= 0.4)
        .slice(0, 8);

      return {
        summary: response.text || '分析完成',
        sources: relevantSources,
      };
    } catch (error) {
      console.error('[ResearchAgent] Analysis failed:', error);
      return {
        summary: sources.map(s => s.snippet).join('\n').slice(0, 500),
        sources: sources.slice(0, 5),
      };
    }
  }

  /**
   * 规划下一步
   */
  private async planNextSteps(
    originalQuery: string,
    currentFindings: { summary: string; sources: ResearchSource[] },
    iterations: ResearchIteration[]
  ): Promise<string[]> {
    // 如果已经有足够的信息，结束研究
    if (iterations.length >= 3 && currentFindings.sources.length >= 5) {
      return ['COMPLETE'];
    }

    try {
      const agent = await AiModelFactory.BaseChatAgent({ withTools: false });

      const iterationsSummary = iterations
        .map(it => `迭代 ${it.iteration}: ${it.query} -> ${it.findings.slice(0, 100)}...`)
        .join('\n');

      const response = await agent.generate([
        {
          role: 'system',
          content: `你是一个研究规划专家。基于当前研究进展，决定下一步行动。

规则:
1. 如果已经收集到足够信息回答原始问题，返回 "COMPLETE"
2. 如果需要更多信息，返回一个具体的后续查询
3. 避免重复之前的查询
4. 只返回一个查询或 "COMPLETE"，不要其他内容`,
        },
        {
          role: 'user',
          content: `原始问题: ${originalQuery}

研究进展:
${iterationsSummary}

当前发现: ${currentFindings.summary}

下一步应该是什么？`,
        },
      ]);

      const nextStep = response.text?.trim() || 'COMPLETE';
      
      // 检查是否是完成标记
      if (nextStep.toUpperCase().includes('COMPLETE')) {
        return ['COMPLETE'];
      }

      return [nextStep];
    } catch (error) {
      console.error('[ResearchAgent] Planning failed:', error);
      return ['COMPLETE'];
    }
  }

  /**
   * 生成最终总结
   */
  private async generateSummary(
    query: string,
    iterations: ResearchIteration[]
  ): Promise<string> {
    if (iterations.length === 0) {
      return '未能找到相关信息。';
    }

    try {
      const agent = await AiModelFactory.BaseChatAgent({ withTools: false });

      const allFindings = iterations
        .map(it => `## 迭代 ${it.iteration}\n查询: ${it.query}\n发现: ${it.findings}`)
        .join('\n\n');

      const allSources = iterations
        .flatMap(it => it.sources)
        .slice(0, 15);

      const sourcesRef = allSources
        .map((s, i) => `[${i + 1}] ${s.title}${s.url ? ` (${s.url})` : ''}`)
        .join('\n');

      const response = await agent.generate([
        {
          role: 'system',
          content: `你是一个研究报告撰写专家。基于多轮研究的发现，撰写一份全面的总结报告。

要求:
1. 直接回答原始问题
2. 整合所有迭代的发现
3. 使用 [n] 格式引用来源
4. 结构清晰，重点突出
5. 500-1000字`,
        },
        {
          role: 'user',
          content: `原始问题: ${query}

研究发现:
${allFindings}

可用来源:
${sourcesRef}

请撰写研究总结:`,
        },
      ]);

      return response.text || '研究完成，但无法生成总结。';
    } catch (error) {
      console.error('[ResearchAgent] Summary generation failed:', error);
      // 降级：直接拼接发现
      return iterations.map(it => it.findings).join('\n\n');
    }
  }

  /**
   * 来源去重
   */
  private deduplicateSources(sources: ResearchSource[]): ResearchSource[] {
    const seen = new Set<string>();
    return sources.filter(s => {
      const key = s.noteId?.toString() || s.url || s.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    iterations: ResearchIteration[],
    sources: ResearchSource[]
  ): number {
    if (iterations.length === 0) return 0;

    // 基础分数
    let score = 0.3;

    // 迭代数量贡献 (最多 0.2)
    score += Math.min(iterations.length * 0.04, 0.2);

    // 来源数量贡献 (最多 0.3)
    score += Math.min(sources.length * 0.03, 0.3);

    // 来源多样性贡献 (最多 0.2)
    const sourceTypes = new Set(sources.map(s => s.type));
    score += sourceTypes.size * 0.07;

    // 平均相关性贡献
    if (sources.length > 0) {
      const avgRelevance = sources.reduce((sum, s) => sum + s.relevance, 0) / sources.length;
      score += avgRelevance * 0.1;
    }

    return Math.min(score, 1);
  }

  /**
   * 提取标题
   */
  private extractTitle(content: string): string {
    // 尝试提取第一行作为标题
    const firstLine = content.split('\n')[0]?.trim() || '';
    // 移除 markdown 标记
    const cleaned = firstLine.replace(/^#+\s*/, '').replace(/\*\*/g, '');
    return cleaned.slice(0, 50) || 'Untitled';
  }

  /**
   * 检查是否超时
   */
  private isTimeout(): boolean {
    return Date.now() - this.startTime > this.config.timeout;
  }

  /**
   * 构建部分结果
   */
  private buildPartialResult(
    query: string,
    iterations: ResearchIteration[],
    sources: ResearchSource[]
  ): Partial<ResearchResult> {
    return {
      iterations,
      sources: this.deduplicateSources(sources),
      confidence: this.calculateConfidence(iterations, sources) * 0.5,
      totalTime: Date.now() - this.startTime,
      status: 'timeout',
    };
  }

  /**
   * 保存研究会话
   */
  private async saveSession(query: string, result: ResearchResult): Promise<void> {
    try {
      await prisma.researchSession.create({
        data: {
          query,
          summary: result.summary,
          iterations: result.iterations as any,
          sources: result.sources as any,
          confidence: result.confidence,
          status: result.status,
          accountId: this.accountId,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('[ResearchAgent] Failed to save session:', error);
    }
  }
}

/**
 * 辅助函数：收集所有迭代结果
 */
export async function collectResearchIterations(
  generator: AsyncGenerator<ResearchIteration, ResearchResult>
): Promise<ResearchResult> {
  let result: ResearchResult | undefined;
  
  for await (const iteration of generator) {
    // 处理每个迭代（可用于流式更新 UI）
    console.log(`[Research] Iteration ${iteration.iteration} completed`);
  }

  // 获取最终结果
  const final = await generator.next();
  if (final.done && final.value) {
    result = final.value;
  }

  if (!result) {
    throw new Error('Research did not produce a result');
  }

  return result;
}
