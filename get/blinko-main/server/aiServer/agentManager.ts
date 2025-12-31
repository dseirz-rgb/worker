/**
 * Agent 管理系统 - AI 服务统一迁移
 * 
 * 支持:
 * - Agent CRUD 操作
 * - Agent 对话功能
 * - 默认 Agent 管理
 * - 工具权限控制
 */

import { prisma } from '@server/prisma';
import { AiModelFactory } from './aiModelFactory';
import { ToolRegistry } from './tools/toolRegistry';
import { Agent, Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import dayjs from 'dayjs';

// Agent 配置接口
export interface AgentConfig {
  id: number;
  slug: string;
  name: string;
  persona: string | null;
  systemPrompt: string;
  tools: string[];
  modelId: number | null;
  privacy: 'public' | 'private';
  accountId: number;
  createdAt: Date;
  updatedAt: Date;
}

// 创建 Agent 输入
export interface CreateAgentInput {
  name: string;
  persona?: string;
  systemPrompt: string;
  tools?: string[];
  modelId?: number;
  privacy?: 'public' | 'private';
  accountId: number;
}

// 更新 Agent 输入
export interface UpdateAgentInput {
  name?: string;
  persona?: string;
  systemPrompt?: string;
  tools?: string[];
  modelId?: number;
  privacy?: 'public' | 'private';
}

// Agent 响应
export interface AgentResponse {
  text: string;
  toolCalls?: any[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

// 默认 Agent 定义
const DEFAULT_AGENTS: Omit<CreateAgentInput, 'accountId'>[] = [
  {
    name: 'General Assistant',
    persona: '我是一个友好、专业的通用助手，可以帮助你完成各种任务。',
    systemPrompt: `你是 Blinko 的通用助手。你可以:
1. 回答问题和解释概念
2. 提供建议和分析
3. 帮助规划和组织想法
4. 协助内容创作和编辑
5. 执行基本计算和推理

始终使用用户的语言回复。保持友好和专业的对话风格。`,
    tools: ['searchNotes', 'createNote', 'webSearch'],
    privacy: 'public',
  },
  {
    name: 'Research Expert',
    persona: '我是一个专注于深度研究的专家，擅长收集、分析和综合信息。',
    systemPrompt: `你是 Blinko 的研究专家。你的专长是:
1. 深度研究和信息收集
2. 多来源信息综合
3. 批判性分析和评估
4. 生成研究报告
5. 引用来源和验证信息

在回答时，始终:
- 引用信息来源
- 区分事实和观点
- 提供多角度分析
- 指出信息的局限性`,
    tools: ['searchNotes', 'webSearch', 'readWebpage', 'searchFiles'],
    privacy: 'public',
  },
  {
    name: 'Writing Helper',
    persona: '我是一个写作助手，专注于帮助你改进和创作各种文本内容。',
    systemPrompt: `你是 Blinko 的写作助手。你可以帮助:
1. 润色和改进文本
2. 扩展和丰富内容
3. 调整语气和风格
4. 检查语法和表达
5. 提供写作建议

写作原则:
- 保持原意的同时改进表达
- 适应不同的写作场景
- 提供具体的修改建议
- 解释修改的原因`,
    tools: ['searchNotes', 'createNote'],
    privacy: 'public',
  },
];

/**
 * Agent 管理器类
 */
export class AgentManager {
  /**
   * 生成 slug
   */
  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-|-$/g, '');
    const timestamp = Date.now().toString(36);
    return `${base}-${timestamp}`;
  }

  /**
   * 创建 Agent
   */
  async createAgent(data: CreateAgentInput): Promise<AgentConfig> {
    const slug = this.generateSlug(data.name);

    const agent = await prisma.agent.create({
      data: {
        slug,
        name: data.name,
        persona: data.persona || null,
        systemPrompt: data.systemPrompt,
        tools: data.tools || [],
        modelId: data.modelId || null,
        privacy: data.privacy || 'private',
        accountId: data.accountId,
      },
    });

    return this.mapToAgentConfig(agent);
  }

  /**
   * 获取 Agent
   */
  async getAgent(id: number): Promise<AgentConfig | null> {
    const agent = await prisma.agent.findUnique({
      where: { id },
    });

    return agent ? this.mapToAgentConfig(agent) : null;
  }

  /**
   * 通过 slug 获取 Agent
   */
  async getAgentBySlug(slug: string): Promise<AgentConfig | null> {
    const agent = await prisma.agent.findUnique({
      where: { slug },
    });

    return agent ? this.mapToAgentConfig(agent) : null;
  }

  /**
   * 获取 Agent 列表
   */
  async getAgents(accountId: number): Promise<AgentConfig[]> {
    const agents = await prisma.agent.findMany({
      where: {
        OR: [
          { accountId },
          { privacy: 'public' },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return agents.map(a => this.mapToAgentConfig(a));
  }

  /**
   * 更新 Agent
   */
  async updateAgent(id: number, data: UpdateAgentInput): Promise<AgentConfig> {
    const agent = await prisma.agent.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.persona !== undefined && { persona: data.persona }),
        ...(data.systemPrompt && { systemPrompt: data.systemPrompt }),
        ...(data.tools && { tools: data.tools }),
        ...(data.modelId !== undefined && { modelId: data.modelId }),
        ...(data.privacy && { privacy: data.privacy }),
      },
    });

    return this.mapToAgentConfig(agent);
  }

  /**
   * 删除 Agent
   */
  async deleteAgent(id: number): Promise<void> {
    await prisma.agent.delete({
      where: { id },
    });
  }

  /**
   * 使用 Agent 进行对话
   */
  async chat(
    agentId: number,
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options?: { stream?: boolean; accountId?: number }
  ): Promise<AgentResponse> {
    const agentConfig = await this.getAgent(agentId);
    if (!agentConfig) {
      throw new Error('Agent not found');
    }

    // 获取 AI 提供者
    const provider = await AiModelFactory.GetProvider();

    // 构建系统消息
    const systemMessages: Array<{ role: 'system'; content: string }> = [
      { role: 'system', content: agentConfig.systemPrompt },
    ];

    if (agentConfig.persona) {
      systemMessages.push({
        role: 'system',
        content: `你的名字是 ${agentConfig.name}。${agentConfig.persona}`,
      });
    }

    // 添加时间上下文
    systemMessages.push({
      role: 'system',
      content: `当前时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`,
    });

    // 获取可用工具
    const tools = ToolRegistry.toMastraTools(agentConfig.tools);

    // 创建 Mastra Agent
    const mastraAgent = new Agent({
      name: agentConfig.name,
      instructions: systemMessages.map(m => m.content).join('\n\n'),
      model: provider.LLM!,
      ...(Object.keys(tools).length > 0 ? { tools } : {}),
    });

    const mastra = new Mastra({
      agents: { [agentConfig.slug]: mastraAgent },
      logger: process.env.NODE_ENV === 'development'
        ? new PinoLogger({ name: 'AgentManager', level: 'debug' })
        : undefined,
    });

    const agent = mastra.getAgent(agentConfig.slug);

    // 设置运行时上下文
    const runtimeContext = new Map<string, any>();
    runtimeContext.set('accountId', options?.accountId || agentConfig.accountId);
    runtimeContext.set('agentId', agentId);

    // 生成响应
    const response = await agent.generate(
      [...systemMessages, ...messages],
      { runtimeContext } as any
    );

    return {
      text: response.text || '',
      toolCalls: response.toolCalls,
      usage: response.usage ? {
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
      } : undefined,
    };
  }

  /**
   * 流式对话
   */
  async *streamChat(
    agentId: number,
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options?: { accountId?: number }
  ): AsyncGenerator<string, void> {
    const agentConfig = await this.getAgent(agentId);
    if (!agentConfig) {
      throw new Error('Agent not found');
    }

    const provider = await AiModelFactory.GetProvider();

    const systemMessages: Array<{ role: 'system'; content: string }> = [
      { role: 'system', content: agentConfig.systemPrompt },
    ];

    if (agentConfig.persona) {
      systemMessages.push({
        role: 'system',
        content: `你的名字是 ${agentConfig.name}。${agentConfig.persona}`,
      });
    }

    const tools = ToolRegistry.toMastraTools(agentConfig.tools);

    const mastraAgent = new Agent({
      name: agentConfig.name,
      instructions: systemMessages.map(m => m.content).join('\n\n'),
      model: provider.LLM!,
      ...(Object.keys(tools).length > 0 ? { tools } : {}),
    });

    const mastra = new Mastra({
      agents: { [agentConfig.slug]: mastraAgent },
    });

    const agent = mastra.getAgent(agentConfig.slug);

    const runtimeContext = new Map<string, any>();
    runtimeContext.set('accountId', options?.accountId || agentConfig.accountId);
    runtimeContext.set('agentId', agentId);

    const stream = await agent.stream(
      [...systemMessages, ...messages],
      { runtimeContext } as any
    );

    for await (const chunk of stream.textStream) {
      yield chunk;
    }
  }

  /**
   * 初始化默认 Agent
   */
  async initializeDefaultAgents(accountId: number): Promise<void> {
    for (const defaultAgent of DEFAULT_AGENTS) {
      // 检查是否已存在同名 Agent
      const existing = await prisma.agent.findFirst({
        where: {
          name: defaultAgent.name,
          privacy: 'public',
        },
      });

      if (!existing) {
        await this.createAgent({
          ...defaultAgent,
          accountId,
        });
        console.log(`[AgentManager] Created default agent: ${defaultAgent.name}`);
      }
    }
  }

  /**
   * 获取默认 Agent 列表
   */
  async getDefaultAgents(): Promise<AgentConfig[]> {
    const agents = await prisma.agent.findMany({
      where: {
        privacy: 'public',
        name: {
          in: DEFAULT_AGENTS.map(a => a.name),
        },
      },
    });

    return agents.map(a => this.mapToAgentConfig(a));
  }

  /**
   * 映射数据库记录到 AgentConfig
   */
  private mapToAgentConfig(agent: any): AgentConfig {
    return {
      id: agent.id,
      slug: agent.slug,
      name: agent.name,
      persona: agent.persona,
      systemPrompt: agent.systemPrompt,
      tools: agent.tools || [],
      modelId: agent.modelId,
      privacy: agent.privacy as 'public' | 'private',
      accountId: agent.accountId,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }
}

// 导出单例
export const agentManager = new AgentManager();
