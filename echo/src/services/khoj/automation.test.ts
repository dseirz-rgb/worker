/**
 * Khoj 自动化服务测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  KhojAutomationService,
  type AutomationConfig,
  type KhojNotification,
} from './automation';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${Date.now()}`,
});

describe('KhojAutomationService', () => {
  let service: KhojAutomationService;

  beforeEach(() => {
    localStorageMock.clear();
    service = new KhojAutomationService();
  });

  describe('自动化任务管理', () => {
    it('应该创建自动化任务', () => {
      const config = {
        name: 'Test Automation',
        type: 'research' as const,
        query: 'Test query',
        enabled: true,
      };

      const automation = service.createAutomation(config);

      expect(automation.id).toBeDefined();
      expect(automation.name).toBe('Test Automation');
      expect(automation.type).toBe('research');
      expect(automation.createdAt).toBeDefined();
    });

    it('应该获取所有自动化任务', () => {
      service.createAutomation({
        name: 'Task 1',
        type: 'research',
        query: 'Query 1',
        enabled: true,
      });
      service.createAutomation({
        name: 'Task 2',
        type: 'summary',
        query: 'Query 2',
        enabled: false,
      });

      const automations = service.getAutomations();

      expect(automations).toHaveLength(2);
    });

    it('应该获取单个自动化任务', () => {
      const created = service.createAutomation({
        name: 'Test',
        type: 'research',
        query: 'Query',
        enabled: true,
      });

      const automation = service.getAutomation(created.id);

      expect(automation).toBeDefined();
      expect(automation?.name).toBe('Test');
    });

    it('应该更新自动化任务', () => {
      const created = service.createAutomation({
        name: 'Original',
        type: 'research',
        query: 'Query',
        enabled: true,
      });

      const updated = service.updateAutomation(created.id, {
        name: 'Updated',
        enabled: false,
      });

      expect(updated?.name).toBe('Updated');
      expect(updated?.enabled).toBe(false);
      expect(updated?.id).toBe(created.id); // ID 不变
    });

    it('应该删除自动化任务', () => {
      const created = service.createAutomation({
        name: 'To Delete',
        type: 'research',
        query: 'Query',
        enabled: true,
      });

      const result = service.deleteAutomation(created.id);

      expect(result).toBe(true);
      expect(service.getAutomation(created.id)).toBeUndefined();
    });

    it('删除不存在的任务应返回 false', () => {
      const result = service.deleteAutomation('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('通知管理', () => {
    it('应该添加通知', () => {
      const notification = service.addNotification({
        type: 'research',
        title: 'Test Notification',
        content: 'Test content',
      });

      expect(notification.id).toBeDefined();
      expect(notification.title).toBe('Test Notification');
      expect(notification.read).toBe(false);
    });

    it('应该获取所有通知（按时间倒序）', () => {
      service.addNotification({
        type: 'research',
        title: 'First',
        content: 'Content 1',
      });
      
      // 稍微延迟以确保时间戳不同
      service.addNotification({
        type: 'reminder',
        title: 'Second',
        content: 'Content 2',
      });

      const notifications = service.getNotifications();

      expect(notifications).toHaveLength(2);
      expect(notifications[0].title).toBe('Second'); // 最新的在前
    });

    it('应该获取未读通知数量', () => {
      service.addNotification({
        type: 'research',
        title: 'Unread 1',
        content: 'Content',
      });
      service.addNotification({
        type: 'research',
        title: 'Unread 2',
        content: 'Content',
      });

      expect(service.getUnreadCount()).toBe(2);
    });

    it('应该标记通知为已读', () => {
      const notification = service.addNotification({
        type: 'research',
        title: 'Test',
        content: 'Content',
      });

      const result = service.markAsRead(notification.id);

      expect(result).toBe(true);
      expect(service.getUnreadCount()).toBe(0);
    });

    it('应该标记所有通知为已读', () => {
      service.addNotification({
        type: 'research',
        title: 'Test 1',
        content: 'Content',
      });
      service.addNotification({
        type: 'research',
        title: 'Test 2',
        content: 'Content',
      });

      service.markAllAsRead();

      expect(service.getUnreadCount()).toBe(0);
    });

    it('应该删除通知', () => {
      const notification = service.addNotification({
        type: 'research',
        title: 'To Delete',
        content: 'Content',
      });

      const result = service.deleteNotification(notification.id);

      expect(result).toBe(true);
      expect(service.getNotifications()).toHaveLength(0);
    });

    it('应该清空所有通知', () => {
      service.addNotification({
        type: 'research',
        title: 'Test 1',
        content: 'Content',
      });
      service.addNotification({
        type: 'research',
        title: 'Test 2',
        content: 'Content',
      });

      service.clearNotifications();

      expect(service.getNotifications()).toHaveLength(0);
    });

    it('应该限制通知数量为 100', () => {
      // 添加 105 个通知
      for (let i = 0; i < 105; i++) {
        service.addNotification({
          type: 'research',
          title: `Notification ${i}`,
          content: 'Content',
        });
      }

      expect(service.getNotifications().length).toBeLessThanOrEqual(100);
    });
  });

  describe('数据持久化', () => {
    it('应该保存自动化任务到 localStorage', () => {
      service.createAutomation({
        name: 'Persistent Task',
        type: 'research',
        query: 'Query',
        enabled: true,
      });

      const stored = localStorageMock.getItem('khoj_automations');
      expect(stored).toBeDefined();
      expect(JSON.parse(stored!)).toHaveLength(1);
    });

    it('应该从 localStorage 加载自动化任务', () => {
      const automations: AutomationConfig[] = [
        {
          id: 'test-id',
          name: 'Loaded Task',
          type: 'research',
          query: 'Query',
          enabled: true,
          createdAt: new Date().toISOString(),
        },
      ];
      localStorageMock.setItem('khoj_automations', JSON.stringify(automations));

      const newService = new KhojAutomationService();
      const loaded = newService.getAutomations();

      expect(loaded).toHaveLength(1);
      expect(loaded[0].name).toBe('Loaded Task');
    });

    it('应该保存通知到 localStorage', () => {
      service.addNotification({
        type: 'research',
        title: 'Persistent Notification',
        content: 'Content',
      });

      const stored = localStorageMock.getItem('khoj_notifications');
      expect(stored).toBeDefined();
      expect(JSON.parse(stored!)).toHaveLength(1);
    });
  });
});
