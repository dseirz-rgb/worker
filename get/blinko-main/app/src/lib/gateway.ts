// app/src/lib/gateway.ts

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

/**
 * Khoj 服务
 * 通过 API 网关访问 Khoj
 */
export const khojService = {
  /**
   * 发送聊天消息
   */
  chat: async (message: string, options?: { conversationId?: string; agent?: string }) => {
    return await api.khoj.chat.mutate({
      message,
      conversationId: options?.conversationId,
      agent: options?.agent,
    });
  },

  /**
   * 获取对话列表
   */
  getConversations: async () => {
    return await api.khoj.getConversations.query();
  },

  /**
   * 获取对话详情
   */
  getConversation: async (id: string) => {
    return await api.khoj.getConversation.query({ id });
  },

  /**
   * 删除对话
   */
  deleteConversation: async (id: string) => {
    return await api.khoj.deleteConversation.mutate({ id });
  },

  /**
   * 语义搜索
   */
  search: async (query: string, options?: { type?: string; limit?: number }) => {
    return await api.khoj.search.query({
      query,
      type: options?.type as 'all' | 'org' | 'markdown' | 'pdf',
      limit: options?.limit,
    });
  },

  /**
   * 获取 Agent 列表
   */
  getAgents: async () => {
    return await api.khoj.getAgents.query();
  },

  /**
   * 获取服务状态
   */
  getStatus: async () => {
    return await api.khoj.getStatus.query();
  },
};
