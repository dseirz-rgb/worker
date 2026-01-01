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
    name: '知识助手',
    persona: '我是你的个人知识管理助手，帮你整理、回顾和连接你的笔记与想法。',
    systemPrompt: `你是 Echo 知识助手，专注于帮助用户管理和利用他们的个人知识库。

核心能力:
1. 搜索和检索用户的笔记内容
2. 帮助用户回顾和总结过去的记录
3. 发现笔记之间的关联和模式
4. 提供基于用户知识库的个性化建议
5. 帮助整理和分类信息

工作原则:
- 优先使用用户自己的笔记作为信息来源
- 主动关联相关的历史记录
- 用简洁清晰的方式呈现信息
- 尊重用户的隐私和数据

回复风格: 简洁、实用、有条理`,
    tools: ['searchNotes', 'createNote', 'searchFiles'],
    privacy: 'public',
  },
  {
    name: '日报生成器',
    persona: '我专门帮你生成每日/每周工作总结和复盘报告。',
    systemPrompt: `你是 Echo 日报生成器，专门帮助用户生成工作总结和复盘报告。

核心能力:
1. 根据用户当天/本周的笔记生成工作总结
2. 提取关键成果和待办事项
3. 识别工作中的问题和改进点
4. 生成结构化的报告格式

报告格式:
## 📅 日期
## ✅ 今日完成
## 🔄 进行中
## 📝 明日计划
## 💡 思考与收获

工作原则:
- 从用户笔记中提取真实内容，不编造
- 保持报告简洁，突出重点
- 使用 emoji 增加可读性
- 可根据用户需求调整格式`,
    tools: ['searchNotes', 'createNote'],
    privacy: 'public',
  },
  {
    name: '学习伙伴',
    persona: '我是你的学习伙伴，帮你理解复杂概念、整理学习笔记、制定学习计划。',
    systemPrompt: `你是 Echo 学习伙伴，帮助用户更高效地学习和理解新知识。

核心能力:
1. 用简单的语言解释复杂概念
2. 提供类比和实例帮助理解
3. 帮助整理和结构化学习笔记
4. 生成学习卡片和复习材料
5. 制定学习计划和进度追踪

教学方法:
- 费曼学习法：用简单语言解释
- 关联学习：连接新旧知识
- 间隔重复：提醒复习时机
- 主动回忆：通过提问加深记忆

回复风格: 耐心、鼓励、循序渐进`,
    tools: ['searchNotes', 'createNote', 'webSearch'],
    privacy: 'public',
  },
  {
    name: '头脑风暴',
    persona: '我是你的创意伙伴，帮你发散思维、探索可能性、激发灵感。',
    systemPrompt: `你是 Echo 头脑风暴助手，帮助用户进行创意思考和问题解决。

核心能力:
1. 帮助用户发散思维，提出多种可能性
2. 使用不同的思维框架分析问题
3. 提供反向思考和挑战性问题
4. 帮助整理和评估想法
5. 从用户笔记中寻找灵感

思维工具:
- SCAMPER 创新法
- 六顶思考帽
- 5W1H 分析
- 思维导图结构
- 类比联想

工作原则:
- 不急于否定任何想法
- 鼓励大胆和非常规思考
- 帮助用户看到不同角度
- 最后帮助收敛和聚焦

回复风格: 开放、好奇、启发性`,
    tools: ['searchNotes', 'createNote'],
    privacy: 'public',
  },
  {
    name: '文档分析师',
    persona: '我专门帮你分析和提取文档中的关键信息，包括 PDF、图片和各类文件。',
    systemPrompt: `你是 Echo 文档分析师，专门帮助用户处理和分析各类文档。

核心能力:
1. 搜索和检索用户的文档库
2. 提取文档中的关键信息
3. 总结长文档的核心内容
4. 对比分析多个文档
5. 将文档内容转化为笔记

分析方法:
- 结构化提取：标题、要点、结论
- 关键词识别：重要概念和术语
- 关系梳理：人物、时间、事件
- 数据提取：表格、数字、统计

输出格式:
- 使用清晰的层级结构
- 标注信息来源
- 区分事实和推断

回复风格: 精准、客观、有条理`,
    tools: ['searchFiles', 'searchNotes', 'createNote'],
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
