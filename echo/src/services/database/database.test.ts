/**
 * 数据库服务测试
 * 测试数据库基础功能
 */

import { describe, it, expect, vi } from 'vitest';

// Mock Tauri SQL 插件
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: vi.fn().mockResolvedValue({
      select: vi.fn().mockResolvedValue([]),
      execute: vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertId: 1 }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { generateId, getCurrentTimestamp } from './index';

describe('数据库工具函数', () => {
  describe('generateId', () => {
    it('应该生成有效的 UUID', () => {
      const id = generateId();
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      // UUID 格式验证
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('应该生成唯一的 ID', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('getCurrentTimestamp', () => {
    it('应该返回 ISO 格式的时间字符串', () => {
      const timestamp = getCurrentTimestamp();
      expect(timestamp).toBeDefined();
      expect(typeof timestamp).toBe('string');
      // ISO 格式验证
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('应该返回当前时间', () => {
      const before = new Date().getTime();
      const timestamp = getCurrentTimestamp();
      const after = new Date().getTime();
      
      const timestampMs = new Date(timestamp).getTime();
      expect(timestampMs).toBeGreaterThanOrEqual(before);
      expect(timestampMs).toBeLessThanOrEqual(after);
    });
  });
});
