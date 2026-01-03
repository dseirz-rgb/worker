/**
 * 工具注册系统 - AI 服务统一迁移
 * 
 * 提供统一的工具管理、权限控制和执行日志功能
 */

import { z } from 'zod/v3';
import { createTool } from '@mastra/core/tools';
import { prisma } from '@server/prisma';

// 工具上下文接口
export interface ToolContext {
  accountId: number;
  agentId?: number;
  conversationId?: number;
}

// 工具定义接口
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (params: any, context: ToolContext) => Promise<any>;
  permissions?: string[];
  category?: 'search' | 'web' | 'notes' | 'files' | 'system';
}

// 工具执行日志
interface ToolExecutionLog {
  toolName: string;
  params: any;
  context: ToolContext;
  result?: any;
  error?: string;
  duration: number;
  timestamp: Date;
}

// 权限检查结果
interface PermissionCheckResult {
  allowed: boolean;
  missingPermissions?: string[];
}

/**
 * 工具注册表 - 单例模式
 */
class ToolRegistryClass {
  private tools: Map<string, ToolDefinition> = new Map();
  private executionLogs: ToolExecutionLog[] = [];
  private maxLogSize = 1000;

  constructor() {
    // 初始化时不注册内置工具，由外部调用 registerBuiltinTools
  }

  /**
   * 注册工具
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] Tool "${tool.name}" already registered, overwriting`);
    }
    this.tools.set(tool.name, tool);
    console.log(`[ToolRegistry] Registered tool: ${tool.name}`);
  }

  /**
   * 批量注册工具
   */
  registerMany(tools: ToolDefinition[]): void {
    tools.forEach(tool => this.register(tool));
  }

  /**
   * 获取工具
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取多个工具
   */
  getTools(names?: string[]): ToolDefinition[] {
    if (!names) {
      return Array.from(this.tools.values());
    }
    return names
      .map(n => this.tools.get(n))
      .filter((t): t is ToolDefinition => t !== undefined);
  }

  /**
   * 按类别获取工具
   */
  getToolsByCategory(category: ToolDefinition['category']): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(t => t.category === category);
  }

  /**
   * 获取所有工具名称
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 检查权限
   */
  async checkPermissions(
    toolName: string,
    context: ToolContext
  ): Promise<PermissionCheckResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { allowed: false, missingPermissions: ['tool_not_found'] };
    }

    // 如果工具没有权限要求，直接允许
    if (!tool.permissions || tool.permissions.length === 0) {
      return { allowed: true };
    }

    // 如果有 agentId，检查 agent 的工具权限
    if (context.agentId) {
      const agent = await prisma.agent.findUnique({
        where: { id: context.agentId },
      });

      if (!agent) {
        return { allowed: false, missingPermissions: ['agent_not_found'] };
      }

      // 检查 agent 是否有该工具的权限
      const agentTools = agent.tools || [];
      if (!agentTools.includes(toolName)) {
        return { allowed: false, missingPermissions: [toolName] };
      }
    }

    return { allowed: true };
  }

  /**
   * 执行工具
   */
  async execute(
    name: string,
    params: any,
    context: ToolContext
  ): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    // 检查权限
    const permissionCheck = await this.checkPermissions(name, context);
    if (!permissionCheck.allowed) {
      const error = `Permission denied for tool "${name}". Missing: ${permissionCheck.missingPermissions?.join(', ')}`;
      this.logExecution(name, params, context, undefined, error, 0);
      throw new Error(error);
    }

    const startTime = Date.now();
    let result: any;
    let error: string | undefined;

    try {
      // 验证参数
      const validatedParams = tool.parameters.parse(params);
      
      // 执行工具
      result = await tool.execute(validatedParams, context);
      
      return result;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      const duration = Date.now() - startTime;
      this.logExecution(name, params, context, result, error, duration);
    }
  }

  /**
   * 记录执行日志
   */
  private logExecution(
    toolName: string,
    params: any,
    context: ToolContext,
    result: any,
    error: string | undefined,
    duration: number
  ): void {
    const log: ToolExecutionLog = {
      toolName,
      params,
      context,
      result: error ? undefined : result,
      error,
      duration,
      timestamp: new Date(),
    };

    this.executionLogs.push(log);

    // 限制日志大小
    if (this.executionLogs.length > this.maxLogSize) {
      this.executionLogs = this.executionLogs.slice(-this.maxLogSize);
    }

    // 控制台日志
    if (error) {
      console.error(`[ToolRegistry] ${toolName} failed (${duration}ms):`, error);
    } else {
      console.log(`[ToolRegistry] ${toolName} completed (${duration}ms)`);
    }
  }

  /**
   * 获取执行日志
   */
  getExecutionLogs(options?: {
    toolName?: string;
    accountId?: number;
    limit?: number;
  }): ToolExecutionLog[] {
    let logs = [...this.executionLogs];

    if (options?.toolName) {
      logs = logs.filter(l => l.toolName === options.toolName);
    }

    if (options?.accountId) {
      logs = logs.filter(l => l.context.accountId === options.accountId);
    }

    if (options?.limit) {
      logs = logs.slice(-options.limit);
    }

    return logs;
  }

  /**
   * 清除日志
   */
  clearLogs(): void {
    this.executionLogs = [];
  }

  /**
   * 将工具转换为 Mastra 格式
   */
  toMastraTools(names?: string[]): Record<string, any> {
    const tools = this.getTools(names);
    const mastraTools: Record<string, any> = {};

    for (const tool of tools) {
      mastraTools[tool.name] = createTool({
        id: tool.name,
        description: tool.description,
        inputSchema: tool.parameters as any,
        execute: async ({ context: params, runtimeContext }) => {
          const accountId = runtimeContext?.get('accountId');
          const agentId = runtimeContext?.get('agentId');
          
          return this.execute(tool.name, params, {
            accountId: accountId || 0,
            agentId,
          });
        },
      });
    }

    return mastraTools;
  }
}

// 导出单例
export const ToolRegistry = new ToolRegistryClass();

// 导出类型
export type { ToolExecutionLog, PermissionCheckResult };
