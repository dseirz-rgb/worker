/**
 * Khoj 集成测试
 * 测试完整的搜索、对话、同步流程
 * 
 * 注意：这些测试需要运行中的 Khoj 服务器
 * 在没有 Khoj 服务器时会跳过
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  KhojClient,
  initKhojClient,
  getKhojClient,
  resetKhojClient,
} from './khojClient';
import { KhojAutomationService } from './automation';

// 测试配置
const TEST_KHOJ_URL = process.env.KHOJ_TEST_URL || 'http://localhost:42110';
const SKIP_INTEGRATION = process.env.SKIP_KHOJ_INTEGRATION === 'true';

// Mock fetch for unit tests
const mockFetch = vi.fn();

describe('Khoj 集成测试', () => {
  let client: KhojClient;
  let isKhojAvailable = false;

  beforeAll(async () => {
    // 检查 Khoj 是否可用
    try {
      const response = await fetch(`${TEST_KHOJ_URL}/api/health`, {
        signal: AbortSignal.timeout(5000),
      });
      isKhojAvailable = response.ok;
    } catch {
      isKhojAvailable = false;
    }

    if (isKhojAvailable) {
      client = initKhojClient({ baseUrl: TEST_KHOJ_URL });
    }
  });

  afterAll(() => {
    resetKhojClient();
  });

  describe('健康检查', () => {
    it('应该能够检查 Khoj 服务状态', async () => {
      if (!isKhojAvailable) {
        console.log('跳过：Khoj 服务不可用');
        return;
      }

      const healthy = await client.healthCheck();
      expect(healthy).toBe(true);
    });
  });

  describe('搜索功能', () => {
    it('应该能够执行搜索', async () => {
      if (!isKhojAvailable) {
        console.log('跳过：Khoj 服务不可用');
        return;
      }

      const results = await client.search('test', { limit: 5 });
      expect(Array.isArray(results)).toBe(true);
    });

    it('应该支持搜索选项', async () => {
      if (!isKhojAvailable) {
        console.log('跳过：Khoj 服务不可用');
        return;
      }

      const results = await client.search('test', {
        type: 'markdown',
        limit: 10,
        rerank: true,
      });
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('对话功能', () => {
    it('应该能够进行对话', async () => {
      if (!isKhojAvailable) {
        console.log('跳过：Khoj 服务不可用');
        return;
      }

      const response = await client.chat('Hello, how are you?', {
        stream: false,
      });

      expect(response).toBeDefined();
      if ('message' in response) {
        expect(typeof response.message).toBe('string');
      }
    });
  });

  describe('Agent 功能', () => {
    it('应该能够获取 Agent 列表', async () => {
      if (!isKhojAvailable) {
        console.log('跳过：Khoj 服务不可用');
        return;
      }

      const agents = await client.getAgents();
      expect(Array.isArray(agents)).toBe(true);
    });
  });

  describe('索引功能', () => {
    it('应该能够获取索引状态', async () => {
      if (!isKhojAvailable) {
        console.log('跳过：Khoj 服务不可用');
        return;
      }

      const status = await client.getIndexStatus();
      expect(status).toHaveProperty('indexed_files');
    });

    it('应该能够索引文档', async () => {
      if (!isKhojAvailable) {
        console.log('跳过：Khoj 服务不可用');
        return;
      }

      const result = await client.indexDocument(
        '# Test Document\n\nThis is a test document for integration testing.',
        'integration-test.md',
        { source: 'integration-test' }
      );

      expect(result.success).toBe(true);
    });

    it('应该能够删除文档', async () => {
      if (!isKhojAvailable) {
        console.log('跳过：Khoj 服务不可用');
        return;
      }

      // 先索引一个文档
      await client.indexDocument(
        '# To Delete\n\nThis document will be deleted.',
        'to-delete.md'
      );

      // 然后删除
      const result = await client.deleteDocument('to-delete.md');
      expect(result).toBe(true);
    });
  });
});

describe('优雅降级测试', () => {
  beforeAll(() => {
    // 使用 mock fetch 模拟离线状态
    global.fetch = mockFetch;
  });

  afterAll(() => {
    // 恢复原始 fetch
    global.fetch = fetch;
  });

  it('应该在服务不可用时优雅降级', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const client = new KhojClient({ baseUrl: 'http://localhost:42110' });
    const healthy = await client.healthCheck();

    expect(healthy).toBe(false);
    expect(client.connected).toBe(false);
  });

  it('搜索应该在服务不可用时抛出错误', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const client = new KhojClient({ baseUrl: 'http://localhost:42110' });

    await expect(client.search('test')).rejects.toThrow();
  });

  it('索引文档应该在服务不可用时返回失败', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const client = new KhojClient({ baseUrl: 'http://localhost:42110' });
    const result = await client.indexDocument('content', 'test.md');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('自动化服务集成测试', () => {
  let automationService: KhojAutomationService;

  beforeAll(() => {
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach(key => delete store[key]);
      },
    });

    vi.stubGlobal('crypto', {
      randomUUID: () => `test-${Date.now()}-${Math.random()}`,
    });

    automationService = new KhojAutomationService();
  });

  it('应该能够创建和管理自动化任务', () => {
    const automation = automationService.createAutomation({
      name: 'Integration Test Task',
      type: 'research',
      query: 'Test query for integration',
      enabled: true,
    });

    expect(automation.id).toBeDefined();
    expect(automationService.getAutomation(automation.id)).toBeDefined();

    // 更新
    const updated = automationService.updateAutomation(automation.id, {
      name: 'Updated Task',
    });
    expect(updated?.name).toBe('Updated Task');

    // 删除
    const deleted = automationService.deleteAutomation(automation.id);
    expect(deleted).toBe(true);
    expect(automationService.getAutomation(automation.id)).toBeUndefined();
  });

  it('应该能够管理通知', () => {
    const notification = automationService.addNotification({
      type: 'research',
      title: 'Integration Test Notification',
      content: 'Test content',
    });

    expect(notification.id).toBeDefined();
    expect(automationService.getUnreadCount()).toBeGreaterThan(0);

    automationService.markAsRead(notification.id);
    expect(automationService.getNotifications().find(n => n.id === notification.id)?.read).toBe(true);

    automationService.deleteNotification(notification.id);
    expect(automationService.getNotifications().find(n => n.id === notification.id)).toBeUndefined();
  });
});
