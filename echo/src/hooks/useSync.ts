/**
 * 同步状态 Hook
 * 提供同步功能的 React 接口
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  SyncStatus,
  SyncResult,
  SyncConflict,
  SyncConfig,
  SyncCollection,
  SupabaseConfig,
} from '../types/sync';
import {
  getSyncService,
  initSyncService,
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  initSupabaseClient,
} from '../services/sync';

/**
 * 同步 Hook 返回类型
 */
interface UseSyncReturn {
  // 状态
  status: SyncStatus;
  config: SyncConfig;
  isConfigured: boolean;
  isInitialized: boolean;
  
  // 操作
  sync: () => Promise<SyncResult>;
  syncCollection: (collection: SyncCollection) => Promise<SyncResult>;
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote') => Promise<void>;
  
  // 配置
  updateConfig: (config: Partial<SyncConfig>) => void;
  configureSupabase: (config: SupabaseConfig) => Promise<boolean>;
  testConnection: (url: string, anonKey: string) => Promise<{ success: boolean; error?: string }>;
  
  // 队列
  clearQueue: () => void;
  getConflicts: () => SyncConflict[];
  queueLength: number;
}

/**
 * 同步 Hook
 */
export function useSync(): UseSyncReturn {
  const [status, setStatus] = useState<SyncStatus>({
    status: 'idle',
    isOnline: navigator.onLine,
    pendingChanges: 0,
    conflicts: 0,
  });
  const [config, setConfig] = useState<SyncConfig>(() => {
    const service = getSyncService();
    return service.getConfig();
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [queueLength, setQueueLength] = useState(0);

  // 初始化同步服务
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const service = await initSyncService();
        
        if (mounted) {
          setStatus(service.getStatus());
          setConfig(service.getConfig());
          setQueueLength(service.getQueueLength());
          setIsInitialized(true);
        }

        // 订阅状态变化
        const unsubscribe = service.subscribe((newStatus) => {
          if (mounted) {
            setStatus(newStatus);
            setQueueLength(service.getQueueLength());
          }
        });

        return () => {
          unsubscribe();
        };
      } catch (error) {
        console.error('[useSync] 初始化失败:', error);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // 检查是否已配置
  const isConfigured = useCallback(() => {
    const supabaseConfig = getSupabaseConfig();
    return supabaseConfig.enabled && !!supabaseConfig.url && !!supabaseConfig.anonKey;
  }, []);

  // 执行同步
  const sync = useCallback(async (): Promise<SyncResult> => {
    const service = getSyncService();
    return service.sync();
  }, []);

  // 同步单个集合
  const syncCollection = useCallback(async (collection: SyncCollection): Promise<SyncResult> => {
    const service = getSyncService();
    return service.syncCollection(collection);
  }, []);

  // 解决冲突
  const resolveConflict = useCallback(async (
    conflictId: string,
    resolution: 'local' | 'remote'
  ): Promise<void> => {
    const service = getSyncService();
    return service.resolveConflict(conflictId, resolution);
  }, []);

  // 更新配置
  const updateConfig = useCallback((updates: Partial<SyncConfig>): void => {
    const service = getSyncService();
    service.updateConfig(updates);
    setConfig(service.getConfig());
  }, []);

  // 配置 Supabase
  const configureSupabase = useCallback(async (supabaseConfig: SupabaseConfig): Promise<boolean> => {
    try {
      // 先测试连接
      if (supabaseConfig.enabled) {
        const result = await testSupabaseConnection(supabaseConfig.url, supabaseConfig.anonKey);
        if (!result.success) {
          console.error('[useSync] 连接测试失败:', result.error);
          return false;
        }
      }

      // 保存配置
      saveSupabaseConfig(supabaseConfig);
      
      // 初始化客户端
      if (supabaseConfig.enabled) {
        initSupabaseClient(supabaseConfig);
      }

      // 更新同步服务配置
      const service = getSyncService();
      service.updateConfig({ supabase: supabaseConfig });
      
      // 重新初始化
      await service.initialize();
      
      setConfig(service.getConfig());
      setStatus(service.getStatus());
      
      return true;
    } catch (error) {
      console.error('[useSync] 配置 Supabase 失败:', error);
      return false;
    }
  }, []);

  // 测试连接
  const testConnection = useCallback(async (
    url: string,
    anonKey: string
  ): Promise<{ success: boolean; error?: string }> => {
    return testSupabaseConnection(url, anonKey);
  }, []);

  // 清空队列
  const clearQueue = useCallback((): void => {
    const service = getSyncService();
    service.clearQueue();
    setQueueLength(0);
  }, []);

  // 获取冲突列表
  const getConflicts = useCallback((): SyncConflict[] => {
    const service = getSyncService();
    return service.getConflicts();
  }, []);

  return {
    status,
    config,
    isConfigured: isConfigured(),
    isInitialized,
    sync,
    syncCollection,
    resolveConflict,
    updateConfig,
    configureSupabase,
    testConnection,
    clearQueue,
    getConflicts,
    queueLength,
  };
}
