/**
 * Gateway Router - 统一服务状态管理
 * 
 * 提供所有外部服务的状态查询和管理功能：
 * - 获取所有服务状态
 * - 获取单个服务状态
 * - 手动刷新服务状态
 * - 获取服务配置
 */

import { router, publicProcedure } from '../middleware';
import { z } from 'zod';
import { serviceRegistry } from '../lib/serviceRegistry';
import { healthMonitor } from '../lib/healthMonitor';

export const gatewayRouter = router({
  /**
   * 获取所有服务状态
   * 返回所有已注册服务的当前状态
   */
  getAllStatuses: publicProcedure.query(async () => {
    return {
      services: serviceRegistry.getAllStatuses(),
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * 获取单个服务状态
   * @param name - 服务名称 (khoj, janitor, paperless)
   */
  getServiceStatus: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      const status = serviceRegistry.getStatus(input.name);
      if (!status) {
        return { success: false, message: '服务不存在' };
      }
      return {
        success: true,
        ...status,
      };
    }),

  /**
   * 手动刷新服务状态
   * @param name - 可选，指定服务名称。不指定则刷新所有服务
   */
  refreshStatus: publicProcedure
    .input(z.object({ name: z.string().optional() }))
    .mutation(async ({ input }) => {
      if (input.name) {
        // 刷新单个服务
        await healthMonitor.checkServiceByName(input.name);
        return serviceRegistry.getStatus(input.name);
      } else {
        // 刷新所有服务
        await healthMonitor.checkAllServices();
        return {
          services: serviceRegistry.getAllStatuses(),
          timestamp: new Date().toISOString(),
        };
      }
    }),

  /**
   * 获取服务配置（不含敏感信息）
   * 返回所有服务的基本配置信息
   */
  getServiceConfigs: publicProcedure.query(async () => {
    const configs = serviceRegistry.getAllConfigs();
    return configs.map(config => ({
      name: config.name,
      displayName: config.displayName,
      enabled: config.enabled,
      // 不暴露 baseUrl 等敏感信息
    }));
  }),
});
