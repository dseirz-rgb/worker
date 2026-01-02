import { ToolDefinition, ToolResult, MCPError, ErrorCode } from '../types/index.js';
import { getLogger } from '../utils/logger.js';
import { createError } from '../utils/errors.js';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      getLogger().warn(`Tool ${tool.name} is being overwritten`);
    }
    this.tools.set(tool.name, tool);
    getLogger().debug(`Registered tool: ${tool.name}`);
  }

  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  listNames(): string[] {
    return Array.from(this.tools.keys());
  }

  async invoke(name: string, params: unknown): Promise<ToolResult> {
    const logger = getLogger();
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        error: createError(
          ErrorCode.ELEMENT_NOT_FOUND,
          `Tool not found: ${name}`,
          { tool: name }
        ),
      };
    }

    const startTime = Date.now();
    logger.toolInvocation(name, params);

    try {
      const result = await tool.handler(params);
      const duration = Date.now() - startTime;
      logger.toolResult(name, result.success, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.toolResult(name, false, duration);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: createError(
          ErrorCode.TASK_FAILED,
          `Tool execution failed: ${errorMessage}`,
          { tool: name, params }
        ),
      };
    }
  }

  // Convert to MCP tool format
  toMCPTools(): Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }> {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }
}
