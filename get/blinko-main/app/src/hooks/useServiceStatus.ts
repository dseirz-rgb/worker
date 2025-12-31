/**
 * 服务状态 Hook
 * 
 * 提供服务状态查询和刷新功能
 * 使用 useState + useEffect 模式，与项目架构保持一致
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/trpc';

/**
 * 服务状态类型
 */
export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  latency?: number;
  lastCheck?: string;
  error?: string;
}

/**
 * 服务状态（带显示名称）
 */
export interface ServiceStatusWithDisplay extends ServiceStatus {
  displayName: string;
}

/**
 * 获取所有服务状态
 * 返回数组格式，便于组件遍历
 */
export function useAllServiceStatuses() {
  const [data, setData] = useState<ServiceStatusWithDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async (isRefetch = false) => {
    if (isRefetch) {
      setIsRefetching(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      const result = await api.gateway.getAllStatuses.query();
      // 保持数组格式，添加 displayName
      const services = result?.services || [];
      if (Array.isArray(services)) {
        const displayNames: Record<string, string> = {
          seekdb: 'SeekDB',
          janitor: 'Janitor',
          khoj: 'Khoj AI',
          paperless: 'Paperless',
        };
        const statusList: ServiceStatusWithDisplay[] = services.map((s: ServiceStatus) => ({
          ...s,
          displayName: displayNames[s.name] || s.name,
        }));
        setData(statusList);
      } else {
        setData([]);
      }
    } catch (err) {
      console.warn('[useAllServiceStatuses] Failed to fetch:', err);
      setError(err as Error);
      // 出错时返回空数组，不影响页面渲染
      setData([]);
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    // 30 秒自动刷新
    const interval = setInterval(() => refetch(true), 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { data, isLoading, isRefetching, error, refetch };
}

/**
 * 获取单个服务状态
 */
export function useServiceStatus(name: string) {
  const [data, setData] = useState<ServiceStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.gateway.getServiceStatus.query({ name });
      if (result && 'status' in result && result.status) {
        setData({
          name,
          status: result.status as 'healthy' | 'unhealthy' | 'unknown',
          latency: 'latency' in result ? result.latency : undefined,
          lastCheck: 'lastCheck' in result ? result.lastCheck : undefined,
          error: 'error' in result ? result.error : undefined,
        });
      } else {
        setData(null);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [name]);

  useEffect(() => {
    refetch();
    // 30 秒自动刷新
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { data, isLoading, error, refetch };
}

/**
 * 刷新服务状态
 * 返回 mutate 方法，与 React Query 风格保持一致
 */
export function useRefreshServiceStatus() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const mutate = useCallback(async (name?: string) => {
    setIsRefreshing(true);
    try {
      await api.gateway.refreshStatus.mutate({ name });
    } catch (err) {
      console.warn('[useRefreshServiceStatus] Failed to refresh:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return { mutate, isRefreshing };
}

/**
 * 检查服务是否可用
 */
export function useIsServiceAvailable(name: string): boolean {
  const { data } = useServiceStatus(name);
  return data?.status === 'healthy';
}
