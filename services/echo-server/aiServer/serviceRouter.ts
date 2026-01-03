/**
 * AI 服务路由器 - AI 服务统一
 * 
 * 统一使用 Mastra 进行 AI 服务
 * Khoj 已整合，不再需要外部依赖
 * 
 * **Validates: Requirements 7.1, 7.2, 7.4**
 */

import { prisma } from '@server/prisma';
import { ResearchAgent } from './researchAgent';
import { agentManager } from './agentManager';

// 功能类型
type FeatureType = 'research' | 'agent' | 'automation' | 'chat';

// 使用指标
interface UsageMetrics {
  requests: number;
  successes: number;
  failures: number;
  avgLatency: number;
}

/**
 * AI 服务路由器
 * 
 * 统一使用 Mastra 进行 AI 服务
 */
export class AIServiceRouter {
  private metrics: UsageMetrics = {
    requests: 0,
    successes: 0,
    failures: 0,
    avgLatency: 0,
  };

  /**
   * 获取功能对应的 feature flag key
   */
  private getFeatureFlagKey(feature: FeatureType): string {
    const flagMap: Record<FeatureType, string> = {
      research: 'use_mastra_research',
      agent: 'use_mastra_agents',
      automation: 'use_mastra_automation',
      chat: 'use_mastra_agents',
    };
    return flagMap[feature];
  }

  /**
   * 检查功能是否启用
   */
  async isFeatureEnabled(feature: FeatureType, accountId: number): Promise<boolean> {
    const flagKey = this.getFeatureFlagKey(feature);

    try {
      // 先查用户设置
      const userFlag = await prisma.featureFlag.findFirst({
        where: { key: flagKey, accountId },
      });

      if (userFlag) {
        return userFlag.value;
      }

      // 再查全局设置
      const globalFlag = await prisma.featureFlag.findFirst({
        where: { key: flagKey, accountId: null },
      });

      if (globalFlag) {
        return globalFlag.value;
      }

      // 默认启用
      return true;
    } catch (error) {
      console.warn('[AIServiceRouter] Failed to check feature flag:', error);
      return true;
    }
  }

  /**
   * 记录使用指标
   */
  private recordMetrics(success: boolean, latency: number): void {
    this.metrics.requests++;
    
    if (success) {
      this.metrics.successes++;
    } else {
      this.metrics.failures++;
    }

    // 计算移动平均延迟
    this.metrics.avgLatency = 
      (this.metrics.avgLatency * (this.metrics.requests - 1) + latency) / this.metrics.requests;
  }

  /**
   * 执行研究查询
   */
  async research(
    query: string,
    accountId: number,
    config?: { maxIterations?: number; timeout?: number }
  ): Promise<any> {
    const startTime = Date.now();

    try {
      const agent = new ResearchAgent(accountId, config);
      const iterations: any[] = [];

      for await (const iteration of agent.research(query)) {
        iterations.push(iteration);
      }

      const result = {
        iterations,
        summary: iterations[iterations.length - 1]?.findings || '',
        sources: iterations.flatMap(i => i.sources || []),
      };

      this.recordMetrics(true, Date.now() - startTime);
      return result;
    } catch (error) {
      this.recordMetrics(false, Date.now() - startTime);
      console.error('[AIServiceRouter] Research failed:', error);
      throw error;
    }
  }

  /**
   * 执行 Agent 对话
   */
  async chat(
    agentId: number | undefined,
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    accountId: number
  ): Promise<any> {
    const startTime = Date.now();

    try {
      if (agentId) {
        const result = await agentManager.chat(agentId, messages, { accountId });
        this.recordMetrics(true, Date.now() - startTime);
        return result;
      } else {
        // 无指定 Agent 时使用默认对话
        throw new Error('Agent ID is required for chat');
      }
    } catch (error) {
      this.recordMetrics(false, Date.now() - startTime);
      console.error('[AIServiceRouter] Chat failed:', error);
      throw error;
    }
  }

  /**
   * 获取使用指标
   */
  getMetrics(): UsageMetrics {
    return { ...this.metrics };
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = {
      requests: 0,
      successes: 0,
      failures: 0,
      avgLatency: 0,
    };
  }

  /**
   * 获取服务健康状态
   */
  getHealthStatus(): { healthy: boolean; successRate: number } {
    const successRate = this.metrics.requests > 0
      ? this.metrics.successes / this.metrics.requests
      : 1;

    return {
      healthy: successRate > 0.9,
      successRate,
    };
  }
}

// 导出单例
export const aiServiceRouter = new AIServiceRouter();
