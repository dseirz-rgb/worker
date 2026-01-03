/**
 * 内置工具定义 - AI 服务统一迁移
 * 
 * 包含: searchNotes, webSearch, readWebpage, createNote
 */

import { z } from 'zod/v3';
import { tavily } from '@tavily/core';
import * as cheerio from 'cheerio';
import { prisma } from '@server/prisma';
import { getGlobalConfig } from '@server/routerTrpc/config';
import { AiModelFactory } from '../aiModelFactory';
import { ToolDefinition, ToolContext, ToolRegistry } from './toolRegistry';

/**
 * 笔记搜索工具 - 使用 RAG 进行语义搜索
 */
const searchNotesTool: ToolDefinition = {
  name: 'searchNotes',
  description: '搜索用户笔记，使用语义搜索找到相关内容',
  category: 'search',
  parameters: z.object({
    query: z.string().describe('搜索查询'),
    limit: z.number().optional().default(10).describe('返回结果数量'),
  }),
  execute: async (params, ctx: ToolContext) => {
    try {
      const { notes } = await AiModelFactory.queryVector(params.query, ctx.accountId, params.limit);
      
      return {
        success: true,
        notes: notes.map(note => ({
          id: note.id,
          content: note.content.slice(0, 500), // 限制内容长度
          score: note.score,
          createdAt: note.createdAt,
          tags: note.tags?.map(t => t.tag?.name).filter(Boolean),
        })),
        count: notes.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
        notes: [],
        count: 0,
      };
    }
  },
};

/**
 * 网络搜索工具 - 使用 Tavily API
 */
const webSearchTool: ToolDefinition = {
  name: 'webSearch',
  description: '搜索互联网获取最新信息',
  category: 'web',
  permissions: ['web_access'],
  parameters: z.object({
    query: z.string().describe('搜索查询'),
    maxResults: z.number().optional().default(5).describe('最大结果数'),
  }),
  execute: async (params, _ctx: ToolContext) => {
    try {
      const config = await getGlobalConfig({ useAdmin: true });
      
      if (!config.tavilyApiKey) {
        return {
          success: false,
          error: 'Tavily API key not configured. Please set it in settings.',
          results: [],
        };
      }

      const client = tavily({ apiKey: config.tavilyApiKey });
      const result = await client.search(params.query, {
        max_results: params.maxResults,
      });

      return {
        success: true,
        results: result.results?.map(r => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
        })) || [],
        query: params.query,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Web search failed',
        results: [],
      };
    }
  },
};

/**
 * 网页内容提取工具
 */
const readWebpageTool: ToolDefinition = {
  name: 'readWebpage',
  description: '读取网页内容并提取正文',
  category: 'web',
  permissions: ['web_access'],
  parameters: z.object({
    url: z.string().url().describe('要读取的网页 URL'),
    maxLength: z.number().optional().default(5000).describe('最大内容长度'),
  }),
  execute: async (params, _ctx: ToolContext) => {
    try {
      const response = await fetch(params.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BlinkoBot/1.0)',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          content: '',
        };
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // 移除不需要的元素
      $('script, style, nav, footer, header, aside, iframe, noscript').remove();
      $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();
      $('.nav, .navbar, .footer, .header, .sidebar, .ad, .advertisement').remove();

      // 提取标题
      const title = $('title').text().trim() || $('h1').first().text().trim();

      // 提取正文
      let content = '';
      
      // 尝试找到主要内容区域
      const mainSelectors = ['article', 'main', '[role="main"]', '.content', '.post', '.entry'];
      for (const selector of mainSelectors) {
        const main = $(selector);
        if (main.length > 0) {
          content = main.text();
          break;
        }
      }

      // 如果没找到主要内容，使用 body
      if (!content) {
        content = $('body').text();
      }

      // 清理空白
      content = content
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim()
        .slice(0, params.maxLength);

      return {
        success: true,
        title,
        content,
        url: params.url,
        length: content.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read webpage',
        content: '',
      };
    }
  },
};

/**
 * 创建笔记工具
 */
const createNoteTool: ToolDefinition = {
  name: 'createNote',
  description: '创建新笔记',
  category: 'notes',
  permissions: ['write_notes'],
  parameters: z.object({
    content: z.string().describe('笔记内容'),
    type: z.enum(['blinko', 'note', 'todo']).optional().default('note').describe('笔记类型'),
  }),
  execute: async (params, ctx: ToolContext) => {
    try {
      // 类型映射: blinko=0, note=1, todo=2
      const typeMap = { blinko: 0, note: 1, todo: 2 };
      const noteType = typeMap[params.type] ?? 1;

      const note = await prisma.notes.create({
        data: {
          content: params.content,
          type: noteType,
          accountId: ctx.accountId,
        },
      });

      return {
        success: true,
        note: {
          id: note.id,
          content: note.content,
          type: params.type,
          createdAt: note.createdAt,
        },
        message: `Note created successfully with ID ${note.id}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create note',
      };
    }
  },
};

/**
 * 文件搜索工具 - 搜索附件内容
 */
const searchFilesTool: ToolDefinition = {
  name: 'searchFiles',
  description: '搜索文件和附件内容',
  category: 'files',
  parameters: z.object({
    query: z.string().describe('搜索查询'),
    fileType: z.string().optional().describe('文件类型过滤 (如 pdf, docx)'),
    limit: z.number().optional().default(10).describe('返回结果数量'),
  }),
  execute: async (params, ctx: ToolContext) => {
    try {
      const whereClause: any = {
        accountId: ctx.accountId,
        content: {
          contains: params.query,
          mode: 'insensitive',
        },
      };

      if (params.fileType) {
        whereClause.type = {
          contains: params.fileType,
          mode: 'insensitive',
        };
      }

      const files = await prisma.attachments.findMany({
        where: whereClause,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          type: true,
          path: true,
          content: true,
          createdAt: true,
        },
      });

      return {
        success: true,
        files: files.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          path: f.path,
          snippet: f.content?.slice(0, 200) || '',
          createdAt: f.createdAt,
        })),
        count: files.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'File search failed',
        files: [],
        count: 0,
      };
    }
  },
};

/**
 * 注册所有内置工具
 */
export function registerBuiltinTools(): void {
  const builtinTools: ToolDefinition[] = [
    searchNotesTool,
    webSearchTool,
    readWebpageTool,
    createNoteTool,
    searchFilesTool,
  ];

  ToolRegistry.registerMany(builtinTools);
  console.log(`[ToolRegistry] Registered ${builtinTools.length} builtin tools`);
}

// 导出单个工具定义供测试使用
export {
  searchNotesTool,
  webSearchTool,
  readWebpageTool,
  createNoteTool,
  searchFilesTool,
};
