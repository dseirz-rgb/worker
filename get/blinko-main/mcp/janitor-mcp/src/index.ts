/**
 * Janitor MCP Server
 * 将 Echo Janitor 的文件整理能力暴露为 MCP 工具
 * 
 * 工具列表:
 * - janitor_analyze: 分析目录，获取整理建议
 * - janitor_commit: 执行文件移动
 * - janitor_history: 查看操作历史
 * - janitor_undo: 撤销操作
 * - janitor_categories: 获取分类列表
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Janitor API 配置
const JANITOR_API_URL = process.env.JANITOR_API_URL || "http://localhost:8766";

// 创建 MCP Server
const server = new Server(
  {
    name: "janitor-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 工具定义
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "janitor_analyze",
        description: "分析指定目录，获取 AI 整理建议。返回每个文件的建议目标路径、分类和置信度。",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "要分析的目录路径，如 ~/Downloads 或 /Users/xxx/Desktop",
            },
            instruction: {
              type: "string",
              description: "可选的整理指令，如 '按文件类型分类' 或 '按日期整理'",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "janitor_commit",
        description: "执行文件移动操作。将文件从源路径移动到目标路径，并记录操作以支持撤销。",
        inputSchema: {
          type: "object",
          properties: {
            base_path: {
              type: "string",
              description: "基础路径",
            },
            src_path: {
              type: "string",
              description: "源文件相对路径",
            },
            dst_path: {
              type: "string",
              description: "目标文件相对路径",
            },
            category: {
              type: "string",
              description: "文件分类",
            },
            reason: {
              type: "string",
              description: "移动原因",
            },
          },
          required: ["base_path", "src_path", "dst_path"],
        },
      },
      {
        name: "janitor_history",
        description: "获取文件整理操作历史记录",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "返回记录数量，默认 20",
            },
          },
        },
      },
      {
        name: "janitor_undo",
        description: "撤销最近的文件整理操作",
        inputSchema: {
          type: "object",
          properties: {
            count: {
              type: "number",
              description: "撤销操作数量，默认 1",
            },
          },
        },
      },
      {
        name: "janitor_categories",
        description: "获取所有可用的文件分类",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "janitor_health",
        description: "检查 Janitor 服务是否正常运行",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// 工具执行
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "janitor_analyze": {
        const response = await fetch(`${JANITOR_API_URL}/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: args?.path,
            instruction: args?.instruction || "",
            incognito: false,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Janitor API error: ${response.status}`);
        }
        
        const result = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "janitor_commit": {
        const response = await fetch(`${JANITOR_API_URL}/commit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base_path: args?.base_path,
            src_path: args?.src_path,
            dst_path: args?.dst_path,
            category: args?.category || "",
            reason: args?.reason || "",
            auto_index: true,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Janitor API error: ${response.status}`);
        }
        
        const result = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "janitor_history": {
        const limit = args?.limit || 20;
        const response = await fetch(`${JANITOR_API_URL}/history?limit=${limit}`);
        
        if (!response.ok) {
          throw new Error(`Janitor API error: ${response.status}`);
        }
        
        const result = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "janitor_undo": {
        const response = await fetch(`${JANITOR_API_URL}/undo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            count: args?.count || 1,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Janitor API error: ${response.status}`);
        }
        
        const result = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "janitor_categories": {
        const response = await fetch(`${JANITOR_API_URL}/config/categories`);
        
        if (!response.ok) {
          throw new Error(`Janitor API error: ${response.status}`);
        }
        
        const result = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "janitor_health": {
        const response = await fetch(`${JANITOR_API_URL}/health`);
        
        if (!response.ok) {
          throw new Error(`Janitor service is not available`);
        }
        
        const result = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Janitor MCP Server running on stdio");
}

main().catch(console.error);
