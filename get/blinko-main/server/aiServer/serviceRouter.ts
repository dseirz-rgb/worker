/**
 * AI 服务路由器 - AI 服务统一迁移
 * 
 * 根据 feature flag 路由请求到 Mastra 或 Khoj
 * 支持服务降级和使用指标追踪
 * 
 * **Validates: Requirements 7.1, 7.2, 7.4**
 */

import { prisma } from '@server/prisma';
import { AiModelFactory } from './aiModelFactory';
import { ResearchAgent } from './researchAgent';
import { agentManager } from './agentManager';
import { automationManager } from './automationManager';

// 服务类型
type ServiceType = 'mastra' | 'khoj';

// 功能类型
type FeatureType = 'research' | 'agent' | 'automation' | 'chat';

// 使用指标
interface UsageMetrics {
  mastra: {
    requests: number;
    successes: number;
    failures: number;
    avgLatency: number;
  };
  khoj: {
    requests: number;
    successes: number;
    failures: number;
    avgLatency: number;
  };
}

// 路由配置
interface RouterConfig {
  defaultService: ServiceType;
  fallbackEnabled: boolean;
  hybridMode: boolean;
}

/**
 * AI 服务路由器
 * 
 * 根据 feature flag 和配置决定使用哪个服务
 */
export class AIServiceRouter {
  private metrics: UsageMetrics = {
    mastra: { requests: 0, successes: 0, failures: 0, avgLatency: 0 },
    khoj: { requests: 0, successes: 0, failures: 0, avgLatency: 0 },
  };

  private config: RouterConfig = {
    defaultService: 'mastra',
    fallbackEnabled: true,
    hybridMode: true,
  };

  /**
   * 获取功能对应的 feature flag key
   */
  private getFeatureFlagKey(feature: FeatureType): string {
    const flagMap: Record<FeatureType, string> = {
      research: 'use_mastra_research',
      agent: 'use_mastra_agents',
      automation: 'use_mastra_automation',
      chat: 'use_mastra_agents', // chat 使用 agent flag
    };
    return flagMap[feature];
  }

  /**
   * 检查是否应该使用 Mastra
   */
  async shouldUseMastra(feature: FeatureType, accountId: number): Promise<boolean> {
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

      // 默认使用 Mastra
      return true;
    } catch (error) {
      console.warn('[AIServiceRouter] Failed to check feature flag:', error);
      return true; // 默认使用 Mastra
    }
  }

  /**
   * 检查是否启用降级
   */
  async isFallbackEnabled(accountId: number): Promise<boolean> {
    try {
      const flag = await prisma.featureFlag.findFirst({
        where: {
          key: 'khoj_fallback_enabled',
          OR: [{ accountId }, { accountId: null }],
        },
        orderBy: { accountId: 'desc' }, // 用户设置优先
      });

      return flag?.value ?? this.config.fallbackEnabled;
    } catch {
      return this.config.fallbackEnabled;
    }
  }

  /**
   * 记录使用指标
   */
  private recordMetrics(
    service: ServiceType,
    success: boolean,
    latency: number
  ): void {
    const metrics = this.metrics[service];
    metrics.requests++;
    
    if (success) {
      metrics.successes++;
    } else {
      metrics.failures++;
    }

    // 计算移动平均延迟
    metrics.avgLatency = (metrics.avgLatency * (metrics.requests - 1) + latency) / metrics.requests;
  }

  /**
   * 执行研究查询
   */
  async research(
    query: string,
    accountId: number,
    config?: { maxIterations?: number; timeout?: number }
  ): Promise<any> {
    const useMastra = await this.shouldUseMastra('research', accountId);
    const fallbackEnabled = await this.isFallbackEnabled(accountId);
    const startTime = Date.now();

    if (useMastra) {
      try {
        const agent = new ResearchAgent(accountId, config);
        const iterations: any[] = [];
        let result: any;

        for await (const iteration of agent.research(query)) {
          iterations.push(iteration);
        }

        // 获取最终结果
        result = {
          iterations,
          summary: iterations[iterations.length - 1]?.findings || '',
          sources: iterations.flatMap(i => i.sources || []),
        };

        this.recordMetrics('mastra', true, Date.now() - startTime);
        return result;
      } catch (error) {
        this.recordMetrics('mastra', false, Date.now() - startTime);
        console.error('[AIServiceRouter] Mastra research failed:', error);

        if (fallbackEnabled) {
          console.log('[AIServiceRouter] Falling back to Khoj');
          return this.khojResearch(query, accountId);
        }
        throw error;
      }
    } else {
      return this.khojResearch(query, accountId);
    }
  }

  /**
   * Khoj 研究（降级方案）
   */
  private async khojResearch(query: string, accountId: number): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 使用 Khoj API 进行研究
      const { KhojClient } = await import('@server/lib/khojClient');
      const khoj = new KhojClient();
      
      // 创建临时对话进行研究
      const { conversation_id } = await khoj.createConversation();
      const result = await khoj.chat(query, conversation_id);
      
      this.recordMetrics('khoj', true, Date.now() - startTime);
      return {
        summary: result.response,
        sources: (result as any).context || [],
        iterations: [],
      };
    } catch (error) {
      this.recordMetrics('khoj', false, Date.now() - startTime);
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
    const useMastra = await this.shouldUseMastra('agent', accountId);
    const fallbackEnabled = await this.isFallbackEnabled(accountId);
    const startTime = Date.now();

    if (useMastra && agentId) {
      try {
        const result = await agentManager.chat(agentId, messages, { accountId });
        this.recordMetrics('mastra', true, Date.now() - startTime);
        return result;
      } catch (error) {
        this.recordMetrics('mastra', false, Date.now() - startTime);
        console.error('[AIServiceRouter] Mastra chat failed:', error);

        if (fallbackEnabled) {
          console.log('[AIServiceRouter] Falling back to Khoj');
          return this.khojChat(messages, accountId);
        }
        throw error;
      }
    } else {
      return this.khojChat(messages, accountId);
    }
  }

  /**
   * Khoj 对话（降级方案）
   */
  private async khojChat(
    messages: Array<{ role: string; content: string }>,
    accountId: number
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      const { KhojClient } = await import('@server/lib/khojClient');
      const khoj = new KhojClient();
      
      // 创建临时对话
      const { conversation_id } = await khoj.createConversation();
      const lastMessage = messages[messages.length - 1];
      const result = await khoj.chat(lastMessage.content, conversation_id);
      
      this.recordMetrics('khoj', true, Date.now() - startTime);
      return { text: result.response };
    } catch (error) {
      this.recordMetrics('khoj', false, Date.now() - startTime);
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
      mastra: { requests: 0, successes: 0, failures: 0, avgLatency: 0 },
      khoj: { requests: 0, successes: 0, failures: 0, avgLatency: 0 },
    };
  }

  /**
   * 获取服务健康状态
   */
  getHealthStatus(): {
    mastra: { healthy: boolean; successRate: number };
    khoj: { healthy: boolean; successRate: number };
  } {
    const mastraRate = this.metrics.mastra.requests > 0
      ? this.metrics.mastra.successes / this.metrics.mastra.requests
      : 1;
    
    const khojRate = this.metrics.khoj.requests > 0
      ? this.metrics.khoj.successes / this.metrics.khoj.requests
      : 1;

    return {
      mastra: {
        healthy: mastraRate > 0.9,
        successRate: mastraRate,
      },
      khoj: {
        healthy: khojRate > 0.9,
        successRate: khojRate,
      },
    };
  }
}

// 导出单例
export const aiServiceRouter = new AIServiceRouter();
