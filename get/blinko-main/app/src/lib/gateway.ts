/**
 * 网关服务
 * 提供统一的服务状态查询和管理
 */

import { api } from './trpc';

/**
 * 服务状态
 */
export interface ServiceStatus {
  name: string;
  displayName: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck: string;
  latency?: number;
  error?: string;
}

/**
 * 网关服务
 * 提供统一的服务状态查询和管理
 */
export const gatewayService = {
  /**
   * 获取所有服务状态
   */
  getAllStatuses: async (): Promise<ServiceStatus[]> => {
    const result = await api.gateway.getAllStatuses.query();
    return result.services;
  },

  /**
   * 获取单个服务状态
   */
  getServiceStatus: async (name: string): Promise<ServiceStatus | null> => {
    const result = await api.gateway.getServiceStatus.query({ name });
    if (!result.success) return null;
    return result as ServiceStatus;
  },

  /**
   * 刷新服务状态
   */
  refreshStatus: async (name?: string): Promise<void> => {
    await api.gateway.refreshStatus.mutate({ name });
  },

  /**
   * 检查服务是否可用
   */
  isServiceAvailable: async (name: string): Promise<boolean> => {
    const status = await gatewayService.getServiceStatus(name);
    return status?.status === 'healthy';
  },
};
