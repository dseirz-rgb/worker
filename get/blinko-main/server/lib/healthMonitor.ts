/**
 * 健康监控器
 * 定期检查所有服务的健康状态
 * 
 * 功能：
 * - 定时轮询所有服务的健康端点
 * - 更新服务注册表中的状态
 * - 支持手动触发检查
 */

import { serviceRegistry, ServiceConfig } from './serviceRegistry';

// ============ 健康监控器类 ============

/**
 * 健康监控器
 * 定期检查所有服务的健康状态
 */
export class HealthMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private checkInterval: number = 30000; // 30 秒

  /**
   * 启动健康监控
   */
  start(): void {
    // 立即执行一次检查
    this.checkAllServices();

    // 定期检查
    this.intervalId = setInterval(() => {
      this.checkAllServices();
    }, this.checkInterval);

    console.log('[HealthMonitor] Started with interval:', this.checkInterval, 'ms');
  }

  /**
   * 停止健康监控
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[HealthMonitor] Stopped');
    }
  }

  /**
   * 设置检查间隔
   */
  setCheckInterval(interval: number): void {
    this.checkInterval = interval;
    
    // 如果已经在运行，重新启动以应用新间隔
    if (this.intervalId) {
      this.stop();
      this.start();
    }
  }

  /**
   * 获取检查间隔
   */
  getCheckInterval(): number {
    return this.checkInterval;
  }

  /**
   * 检查监控器是否正在运行
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * 检查所有服务
   */
  async checkAllServices(): Promise<void> {
    const configs = serviceRegistry.getAllConfigs();
    
    await Promise.all(
      configs.map(config => this.checkService(config))
    );
  }

  /**
   * 检查单个服务
   */
  async checkService(config: ServiceConfig): Promise<void> {
    if (!config.enabled) {
      serviceRegistry.updateStatus(config.name, {
        status: 'unknown',
        error: 'Service disabled',
      });
      return;
    }

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(`${config.baseUrl}${config.healthEndpoint}`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (response.ok) {
        serviceRegistry.updateStatus(config.name, {
          status: 'healthy',
          latency,
          error: undefined,
        });
      } else {
        serviceRegistry.updateStatus(config.name, {
          status: 'unhealthy',
          latency,
          error: `HTTP ${response.status}`,
        });
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      
      // 处理不同类型的错误
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timeout';
        } else if (error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Connection refused';
        } else if (error.message.includes('ETIMEDOUT')) {
          errorMessage = 'Connection timeout';
        } else if (error.message.includes('ENOTFOUND')) {
          errorMessage = 'Host not found';
        } else {
          errorMessage = error.message;
        }
      }

      serviceRegistry.updateStatus(config.name, {
        status: 'unhealthy',
        latency,
        error: errorMessage,
      });
    }
  }

  /**
   * 手动检查单个服务（通过服务名）
   */
  async checkServiceByName(name: string): Promise<void> {
    const config = serviceRegistry.getConfig(name);
    if (config) {
      await this.checkService(config);
    } else {
      console.warn(`[HealthMonitor] Service not found: ${name}`);
    }
  }

  /**
   * 获取所有服务的健康摘要
   */
  getHealthSummary(): {
    total: number;
    healthy: number;
    unhealthy: number;
    unknown: number;
  } {
    const statuses = serviceRegistry.getAllStatuses();
    
    return {
      total: statuses.length,
      healthy: statuses.filter(s => s.status === 'healthy').length,
      unhealthy: statuses.filter(s => s.status === 'unhealthy').length,
      unknown: statuses.filter(s => s.status === 'unknown').length,
    };
  }
}

// ============ 单例导出 ============

export const healthMonitor = new HealthMonitor();
