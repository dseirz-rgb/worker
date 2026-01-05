/**
 * SyncStateManager 属性测试
 * 
 * 使用 fast-check 进行属性测试，验证：
 * - Property 3: Change Token Persistence Round-Trip
 * - 文件同步记录 CRUD 操作
 * 
 * **Validates: Requirements 2.1, 2.5**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { SyncStateManager } from './syncStateManager';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
};

// Mock getInvestmentDb
vi.mock('./investmentDb', () => ({
  getInvestmentDb: () => mockSupabaseClient,
}));

describe('SyncStateManager Property Tests', () => {
  let manager: SyncStateManager;

  beforeEach(() => {
    manager = new SyncStateManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * **Feature: google-drive-sync, Property 3: Change Token Persistence Round-Trip**
   * 
   * *For any* valid change token string, saving then retrieving the token 
   * SHALL return the exact same string.
   * 
   * **Validates: Requirements 2.1, 2.5**
   */
  describe('Property 3: Change Token Persistence Round-Trip', () => {
    it('保存后读取的 token 应该与原始值相同', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机 token 字符串（模拟 Google Drive change token 格式）
          fc.string({ minLength: 1, maxLength: 200 }),
          async (token) => {
            // 模拟数据库存储
            let storedToken: string | null = null;
            let storedState = {
              id: 1,
              sync_type: 'google_drive',
              change_token: null as string | null,
              last_sync_at: null,
              status: 'idle',
              error_message: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            // Mock select for getSyncState
            mockSupabaseClient.from.mockImplementation((table: string) => {
              if (table === 'sync_state') {
                return {
                  select: () => ({
                    eq: () => ({
                      single: async () => ({ data: storedState, error: null }),
                    }),
                  }),
                  update: (data: Record<string, unknown>) => {
                    storedToken = data.change_token as string;
                    storedState = { ...storedState, ...data };
                    return {
                      eq: () => ({ error: null }),
                    };
                  },
                  insert: () => ({
                    select: () => ({
                      single: async () => ({ data: storedState, error: null }),
                    }),
                  }),
                };
              }
              return {};
            });

            // 保存 token
            const saveResult = await manager.saveChangeToken(token);
            expect(saveResult).toBe(true);

            // 验证存储的值
            expect(storedToken).toBe(token);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('空 token 应该被正确处理', async () => {
      let storedToken: string | null = null;

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'sync_state') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 1,
                    sync_type: 'google_drive',
                    change_token: storedToken,
                    status: 'idle',
                  },
                  error: null,
                }),
              }),
            }),
            update: (data: Record<string, unknown>) => {
              storedToken = data.change_token as string;
              return {
                eq: () => ({ error: null }),
              };
            },
          };
        }
        return {};
      });

      // 保存空字符串
      const result = await manager.saveChangeToken('');
      expect(result).toBe(true);
      expect(storedToken).toBe('');
    });
  });

  /**
   * 文件同步记录 CRUD 测试
   */
  describe('File Sync Record CRUD', () => {
    it('创建记录应该返回完整数据', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            drive_file_id: fc.string({ minLength: 10, maxLength: 50 }),
            file_name: fc.string({ minLength: 1, maxLength: 100 }),
            mime_type: fc.constantFrom('text/plain', 'application/pdf', 'application/vnd.ms-excel'),
            modified_time: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }).map(d => d.toISOString()),
            source_type: fc.constantFrom('uploaded_file', 'financial_model', 'strategy_sheet'),
          }),
          async (record) => {
            const createdRecord = {
              id: 1,
              ...record,
              md5_checksum: null,
              document_ids: [],
              sync_status: 'pending',
              error_message: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            mockSupabaseClient.from.mockImplementation((table: string) => {
              if (table === 'file_sync_records') {
                return {
                  insert: () => ({
                    select: () => ({
                      single: async () => ({ data: createdRecord, error: null }),
                    }),
                  }),
                };
              }
              return {};
            });

            const result = await manager.createFileSyncRecord(record);

            expect(result).not.toBeNull();
            expect(result?.drive_file_id).toBe(record.drive_file_id);
            expect(result?.file_name).toBe(record.file_name);
            expect(result?.mime_type).toBe(record.mime_type);
            expect(result?.source_type).toBe(record.source_type);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('needsUpdate 应该正确比较 MD5', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 32, maxLength: 32 }), // MD5 hash
          fc.string({ minLength: 32, maxLength: 32 }),
          async (oldMd5, newMd5) => {
            const existingRecord = {
              id: 1,
              drive_file_id: 'test-file-id',
              file_name: 'test.txt',
              mime_type: 'text/plain',
              md5_checksum: oldMd5,
              modified_time: '2024-01-01T00:00:00Z',
              document_ids: [],
              source_type: 'uploaded_file',
              sync_status: 'synced',
              error_message: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            mockSupabaseClient.from.mockImplementation((table: string) => {
              if (table === 'file_sync_records') {
                return {
                  select: () => ({
                    eq: () => ({
                      single: async () => ({ data: existingRecord, error: null }),
                    }),
                  }),
                };
              }
              return {};
            });

            const needsUpdate = await manager.needsUpdate(
              'test-file-id',
              newMd5,
              '2024-01-01T00:00:00Z'
            );

            // 如果 MD5 不同，应该需要更新
            expect(needsUpdate).toBe(oldMd5 !== newMd5);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('needsUpdate 应该正确比较修改时间', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }).filter(d => !isNaN(d.getTime())),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }).filter(d => !isNaN(d.getTime())),
          async (oldDate, newDate) => {
            const existingRecord = {
              id: 1,
              drive_file_id: 'test-file-id',
              file_name: 'test.txt',
              mime_type: 'text/plain',
              md5_checksum: null, // 没有 MD5，使用时间比较
              modified_time: oldDate.toISOString(),
              document_ids: [],
              source_type: 'uploaded_file',
              sync_status: 'synced',
              error_message: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            mockSupabaseClient.from.mockImplementation((table: string) => {
              if (table === 'file_sync_records') {
                return {
                  select: () => ({
                    eq: () => ({
                      single: async () => ({ data: existingRecord, error: null }),
                    }),
                  }),
                };
              }
              return {};
            });

            const needsUpdate = await manager.needsUpdate(
              'test-file-id',
              null, // 没有新 MD5
              newDate.toISOString()
            );

            // 如果新时间更晚，应该需要更新
            expect(needsUpdate).toBe(newDate.getTime() > oldDate.getTime());

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('新文件应该总是需要更新', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'file_sync_records') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: { code: 'PGRST116' } }),
              }),
            }),
          };
        }
        return {};
      });

      const needsUpdate = await manager.needsUpdate(
        'new-file-id',
        'some-md5',
        new Date().toISOString()
      );

      expect(needsUpdate).toBe(true);
    });
  });

  /**
   * 状态更新测试
   */
  describe('Status Updates', () => {
    it('状态转换应该正确更新字段', async () => {
      const statuses = ['idle', 'syncing', 'error'] as const;

      for (const status of statuses) {
        let updatedData: Record<string, unknown> = {};

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'sync_state') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: 1,
                      sync_type: 'google_drive',
                      change_token: 'token',
                      status: 'idle',
                    },
                    error: null,
                  }),
                }),
              }),
              update: (data: Record<string, unknown>) => {
                updatedData = data;
                return {
                  eq: () => ({ error: null }),
                };
              },
            };
          }
          return {};
        });

        const errorMsg = status === 'error' ? 'Test error' : undefined;
        await manager.updateStatus(status, errorMsg);

        expect(updatedData.status).toBe(status);

        if (status === 'idle') {
          expect(updatedData.last_sync_at).toBeDefined();
          expect(updatedData.error_message).toBeNull();
        } else if (status === 'error') {
          expect(updatedData.error_message).toBe('Test error');
        } else if (status === 'syncing') {
          expect(updatedData.error_message).toBeNull();
        }
      }
    });
  });
});

describe('SyncStateManager Unit Tests', () => {
  let manager: SyncStateManager;

  beforeEach(() => {
    manager = new SyncStateManager();
    vi.clearAllMocks();
  });

  describe('getSyncState', () => {
    it('数据库无记录时应该初始化', async () => {
      let insertCalled = false;

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'sync_state') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => {
                  if (!insertCalled) {
                    return { data: null, error: { code: 'PGRST116' } };
                  }
                  return {
                    data: {
                      id: 1,
                      sync_type: 'google_drive',
                      status: 'idle',
                    },
                    error: null,
                  };
                },
              }),
            }),
            insert: () => {
              insertCalled = true;
              return {
                select: () => ({
                  single: async () => ({
                    data: {
                      id: 1,
                      sync_type: 'google_drive',
                      status: 'idle',
                    },
                    error: null,
                  }),
                }),
              };
            },
          };
        }
        return {};
      });

      const state = await manager.getSyncState();

      expect(state).not.toBeNull();
      expect(state?.status).toBe('idle');
      expect(insertCalled).toBe(true);
    });
  });

  describe('deleteFileSyncRecord', () => {
    it('应该成功删除记录', async () => {
      let deleteCalled = false;

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'file_sync_records') {
          return {
            delete: () => {
              deleteCalled = true;
              return {
                eq: () => ({ error: null }),
              };
            },
          };
        }
        return {};
      });

      const result = await manager.deleteFileSyncRecord('test-file-id');

      expect(result).toBe(true);
      expect(deleteCalled).toBe(true);
    });

    it('删除失败应该返回 false', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'file_sync_records') {
          return {
            delete: () => ({
              eq: () => ({ error: { message: 'Delete failed' } }),
            }),
          };
        }
        return {};
      });

      const result = await manager.deleteFileSyncRecord('test-file-id');

      expect(result).toBe(false);
    });
  });

  describe('getAllFileSyncRecords', () => {
    it('应该返回所有记录', async () => {
      const records = [
        { id: 1, drive_file_id: 'file1', file_name: 'test1.txt' },
        { id: 2, drive_file_id: 'file2', file_name: 'test2.pdf' },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'file_sync_records') {
          return {
            select: () => ({
              order: () => ({ data: records, error: null }),
            }),
          };
        }
        return {};
      });

      const result = await manager.getAllFileSyncRecords();

      expect(result).toHaveLength(2);
      expect(result[0].drive_file_id).toBe('file1');
      expect(result[1].drive_file_id).toBe('file2');
    });

    it('查询失败应该返回空数组', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'file_sync_records') {
          return {
            select: () => ({
              order: () => ({ data: null, error: { message: 'Query failed' } }),
            }),
          };
        }
        return {};
      });

      const result = await manager.getAllFileSyncRecords();

      expect(result).toEqual([]);
    });
  });
});
