#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ConfigManager } from './services/config.js';
import { ToolRegistry } from './tools/registry.js';
import { initLogger, getLogger } from './utils/logger.js';
import { ErrorCode } from './types/index.js';
import { createError } from './utils/errors.js';

// Import tool modules
import { screenTools } from './tools/screen.js';
import { mouseTools } from './tools/mouse.js';
import { keyboardTools } from './tools/keyboard.js';
import { scrollTools } from './tools/scroll.js';
import { guiTaskTools, initGUITaskTools } from './tools/gui-task.js';
import { windowTools } from './tools/window.js';
// UE5 工具已禁用 - 不需要游戏引擎相关功能
// import { ue5Tools } from './tools/ue5/index.js';
// import { blueprintTools } from './tools/ue5/blueprint.js';
import { devTools } from './tools/dev.js';

class UITarsMCPServer {
  private server: Server;
  private configManager: ConfigManager;
  private toolRegistry: ToolRegistry;

  constructor() {
    this.configManager = new ConfigManager();
    this.toolRegistry = new ToolRegistry();

    // Initialize logger
    initLogger(this.configManager.getConfig().logging);

    // Create MCP server
    this.server = new Server(
      {
        name: 'ui-tars-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.registerTools();
  }

  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.toolRegistry.toMCPTools(),
      };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const logger = getLogger();

      logger.info(`Received tool call: ${name}`);

      const result = await this.toolRegistry.invoke(name, args);

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.error, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private registerTools(): void {
    const logger = getLogger();
    logger.info('Registering tools...');

    // Initialize GUI task tools with config manager
    initGUITaskTools(this.configManager);

    // Register screen tools (screenshot, screen_info)
    for (const tool of screenTools) {
      this.toolRegistry.register(tool);
    }

    // Register mouse tools (click, double_click, right_click, drag, hover)
    for (const tool of mouseTools) {
      this.toolRegistry.register(tool);
    }

    // Register keyboard tools (type_text, press_key, hotkey)
    for (const tool of keyboardTools) {
      this.toolRegistry.register(tool);
    }

    // Register scroll tools (scroll)
    for (const tool of scrollTools) {
      this.toolRegistry.register(tool);
    }

    // Register GUI task tools (run_gui_task, cancel_gui_task, gui_task_status)
    for (const tool of guiTaskTools) {
      this.toolRegistry.register(tool);
    }

    // Register window tools (window_list, window_focus, window_resize)
    for (const tool of windowTools) {
      this.toolRegistry.register(tool);
    }

    // UE5 工具已禁用 - 不需要游戏引擎相关功能
    // // Register UE5 basic tools (ue_find_element, ue_click_menu, ue_import_asset, ue_set_material)
    // for (const tool of ue5Tools) {
    //   this.toolRegistry.register(tool);
    // }

    // // Register UE5 blueprint/material tools
    // for (const tool of blueprintTools) {
    //   this.toolRegistry.register(tool);
    // }

    // Register development assistant tools
    for (const tool of devTools) {
      this.toolRegistry.register(tool);
    }

    logger.info(`Registered ${this.toolRegistry.listNames().length} tools`);
  }

  async start(): Promise<void> {
    const logger = getLogger();
    logger.info('Starting UI-TARS MCP Server...');

    // Validate configuration (warn but don't fail if VLM not configured)
    const configResult = this.configManager.validateConfig();
    if (!configResult.valid) {
      logger.warn(`Configuration warning: ${configResult.error?.message}`);
      logger.warn('Some features may not work without valid VLM configuration');
    }

    // Connect via stdio
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info('UI-TARS MCP Server started successfully');
  }

  async stop(): Promise<void> {
    const logger = getLogger();
    logger.info('Stopping UI-TARS MCP Server...');
    await this.server.close();
    logger.info('UI-TARS MCP Server stopped');
  }
}

// Main entry point
async function main() {
  const server = new UITarsMCPServer();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });

  await server.start();
}

main().catch((error) => {
  console.error('Failed to start UI-TARS MCP Server:', error);
  process.exit(1);
});

export { UITarsMCPServer };
