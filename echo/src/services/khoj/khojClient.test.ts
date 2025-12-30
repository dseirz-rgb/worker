/**
 * Khoj 客户端服务测试
 * 测试 Khoj API 集成功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  KhojClient,
  KhojClientError,
  initKhojClient,
  getKhojClient,
  isKhojClientInitialized,
  resetKhojClient,
} from './khojClient';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('KhojClient', () => {
  let client: KhojClient;

  beforeEach(() => {
    client = new KhojClient({
      baseUrl: 'http://localhost:42110',
      apiKey: 'test-api-key',
    });
    mockFetch.mockReset();
  });

  describe('healthCheck', () => {
    it('应该在服务健康时返回 true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });

      const result = await client.healthCheck();

      expect(result).toBe(true);
      expect(client.connected).toBe(true);
    });

    it('应该在服务不可用时返回 false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const result = await client.healthCheck();

      expect(result).toBe(false);
      expect(client.connected).toBe(false);
    });

    it('应该在网络错误时返回 false', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.healthCheck();

      expect(result).toBe(false);
      expect(client.connected).toBe(false);
    });
  });

  describe('search', () => {
    it('应该正确执行搜索请求', async () => {
      const mockResults = [
        {
          entry: 'Test content',
          score: 0.95,
          file: 'test.md',
          compiled: 'Test content compiled',
          additional: { file: 'test.md', heading: 'Test' },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults,
      });

      const results = await client.search('test query');

      expect(results).toEqual(mockResults);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('应该在搜索失败时抛出错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.search('test')).rejects.toThrow(KhojClientError);
    });
  });

  describe('chat', () => {
    it('应该正确发送对话请求', async () => {
      const mockResponse = {
        role: 'assistant',
        message: 'Hello!',
        context: ['context1'],
        created: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.chat('Hello');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('应该支持指定 Agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Response' }),
      });

      await client.chat('Hello', { agent: 'test-agent' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.agent).toBe('test-agent');
    });
  });

  describe('getAgents', () => {
    it('应该获取 Agent 列表', async () => {
      const mockAgents = [
        {
          slug: 'default',
          name: 'Default Agent',
          personality: 'Helpful assistant',
          tools: ['search'],
          public: true,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAgents,
      });

      const agents = await client.getAgents();

      expect(agents).toEqual(mockAgents);
    });
  });

  describe('indexDocument', () => {
    it('应该成功索引文档', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await client.indexDocument('content', 'test.md');

      expect(result.success).toBe(true);
    });

    it('应该在索引失败时返回错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request',
      });

      const result = await client.indexDocument('content', 'test.md');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('deleteDocument', () => {
    it('应该成功删除文档', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await client.deleteDocument('test.md');

      expect(result).toBe(true);
    });

    it('应该在删除失败时返回 false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await client.deleteDocument('test.md');

      expect(result).toBe(false);
    });
  });

  describe('getIndexStatus', () => {
    it('应该获取索引状态', async () => {
      const mockStatus = {
        indexed_files: 100,
        last_updated: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus,
      });

      const status = await client.getIndexStatus();

      expect(status).toEqual(mockStatus);
    });
  });

  describe('updateConfig', () => {
    it('应该更新配置', () => {
      client.updateConfig({ baseUrl: 'http://new-url:42110' });

      expect(client.serverUrl).toBe('http://new-url:42110');
      expect(client.connected).toBe(false); // 配置更新后重置连接状态
    });
  });
});

describe('Khoj 客户端单例管理', () => {
  beforeEach(() => {
    resetKhojClient();
  });

  afterEach(() => {
    resetKhojClient();
  });

  it('应该正确初始化客户端', () => {
    expect(isKhojClientInitialized()).toBe(false);

    initKhojClient({ baseUrl: 'http://localhost:42110' });

    expect(isKhojClientInitialized()).toBe(true);
  });

  it('应该获取已初始化的客户端', () => {
    initKhojClient({ baseUrl: 'http://localhost:42110' });

    const client = getKhojClient();

    expect(client).toBeInstanceOf(KhojClient);
  });

  it('应该在未初始化时抛出错误', () => {
    expect(() => getKhojClient()).toThrow(KhojClientError);
  });

  it('应该正确重置客户端', () => {
    initKhojClient({ baseUrl: 'http://localhost:42110' });
    expect(isKhojClientInitialized()).toBe(true);

    resetKhojClient();

    expect(isKhojClientInitialized()).toBe(false);
  });
});
