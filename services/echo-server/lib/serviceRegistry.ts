/**
 * 服务注册表
 * 管理所有外部服务的配置和状态
 * 
 * 支持的服务：
 * - Janitor: AI 文件整理
 * 
 * 已整合的服务（不再需要外部依赖）：
 * - Khoj: AI 知识助手 → 已整合到 AiService + Mastra Agent
 * - Paperless: 文档管理 → 已整合到 PostgreSQL + postgresSearchService
 */

// ============ 类型定义 ============

/**
 * 服务配置
 */
export interface ServiceConfig {
  name: string;
  displayName: string;
  baseUrl: string;
  healthEndpoint: string;
  timeout: number;
  enabled: boolean;
}

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

// ============ 服务注册表类 ============

/**
 * 服务注册表
 * 管理所有外部服务的配置和状态
 */
export class ServiceRegistry {
  private services: Map<string, ServiceConfig> = new Map();
  private statuses: Map<string, ServiceStatus> = new Map();

  constructor() {
    this.initializeServices();
  }

  /**
   * 从环境变量初始化服务配置
   */
  private initializeServices(): void {
    // Janitor - AI 文件整理
    this.register({
      name: 'janitor',
      displayName: 'Janitor',
      baseUrl: process.env.JANITOR_API_URL || 'http://localhost:8766',
      healthEndpoint: '/health',
      timeout: 10000,
      enabled: true,
    });
  }

  /**
   * 注册服务
   */
  register(config: ServiceConfig): void {
    this.services.set(config.name, config);
    this.statuses.set(config.name, {
      name: config.name,
      displayName: config.displayName,
      status: 'unknown',
      lastCheck: new Date().toISOString(),
    });
  }

  /**
   * 获取服务配置
   */
  getConfig(name: string): ServiceConfig | undefined {
    return this.services.get(name);
  }

  /**
   * 获取所有服务配置
   */
  getAllConfigs(): ServiceConfig[] {
    return Array.from(this.services.values());
  }

  /**
   * 更新服务状态
   */
  updateStatus(name: string, status: Partial<ServiceStatus>): void {
    const current = this.statuses.get(name);
    if (current) {
      this.statuses.set(name, { 
        ...current, 
        ...status, 
        lastCheck: new Date().toISOString() 
      });
    }
  }

  /**
   * 获取服务状态
   */
  getStatus(name: string): ServiceStatus | undefined {
    return this.statuses.get(name);
  }

  /**
   * 获取所有服务状态
   */
  getAllStatuses(): ServiceStatus[] {
    return Array.from(this.statuses.values());
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(name: string): boolean {
    const status = this.statuses.get(name);
    return status?.status === 'healthy';
  }

  /**
   * 获取已启用的服务
   */
  getEnabledServices(): ServiceConfig[] {
    return Array.from(this.services.values()).filter(config => config.enabled);
  }

  /**
   * 启用/禁用服务
   */
  setEnabled(name: string, enabled: boolean): void {
    const config = this.services.get(name);
    if (config) {
      config.enabled = enabled;
      this.services.set(name, config);
    }
  }
}

// ============ 单例导出 ============

export const serviceRegistry = new ServiceRegistry();
