/**
 * 数据源健康监控服务 - Data Source Health Monitor
 * 追踪数据源的成功率、延迟和健康状态
 * 
 * Property 9: 数据源健康状态追踪
 * Validates: Requirements 9.1, 9.2
 */

// ============ 类型定义 ============

export type DataSource = 'longport' | 'openbb' | 'tencent';

export interface DataSourceMetrics {
  source: DataSource;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalLatency: number;
  consecutiveFailures: number;
  lastRequestTime: number;
  lastError?: string;
  isHealthy: boolean;
}

export interface DataSourceHealth {
  source: DataSource;
  isHealthy: boolean;
  successRate: number;
  avgLatency: number;
  lastError?: string;
  consecutiveFailures: number;
}

export interface HealthCheckResult {
  source: DataSource;
  success: boolean;
  latency: number;
  error?: string;
}

// ============ 配置常量 ============

const CONSECUTIVE_FAILURES_THRESHOLD = 3;
const RECOVERY_CHECK_INTERVAL = 5 * 60 * 1000; // 5 分钟
const MAX_LATENCY_RECORDS = 100;

// ============ 健康监控类 ============

class DataSourceHealthMonitor {
  private metrics: Map<DataSource, DataSourceMetrics> = new Map();
  private latencyHistory: Map<DataSource, number[]> = new Map();
  private recoveryTimers: Map<DataSource, NodeJS.Timeout> = new Map();
  private onHealthChangeCallbacks: Array<(source: DataSource, isHealthy: boolean) => void> = [];

  constructor() {
    // 初始化所有数据源的指标
    const sources: DataSource[] = ['longport', 'openbb', 'tencent'];
    sources.forEach(source => {
      this.metrics.set(source, this.createEmptyMetrics(source));
      this.latencyHistory.set(source, []);
    });
  }

  private createEmptyMetrics(source: DataSource): DataSourceMetrics {
    return {
      source,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatency: 0,
      consecutiveFailures: 0,
      lastRequestTime: 0,
      isHealthy: true,
    };
  }

  /**
   * 记录请求结果
   * Property 9: 正确记录成功率和延迟
   */
  recordRequest(source: DataSource, success: boolean, latency: number, error?: string): void {
    const metrics = this.metrics.get(source);
    if (!metrics) return;

    metrics.totalRequests++;
    metrics.lastRequestTime = Date.now();
    metrics.totalLatency += latency;

    // 记录延迟历史
    const history = this.latencyHistory.get(source) || [];
    history.push(latency);
    if (history.length > MAX_LATENCY_RECORDS) {
      history.shift();
    }
    this.latencyHistory.set(source, history);

    if (success) {
      metrics.successfulRequests++;
      metrics.consecutiveFailures = 0;
      
      // 如果之前不健康，现在恢复了
      if (!metrics.isHealthy) {
        this.markHealthy(source);
      }
    } else {
      metrics.failedRequests++;
      metrics.consecutiveFailures++;
      metrics.lastError = error;

      // Property 9: 连续 3 次失败后标记为不健康
      if (metrics.consecutiveFailures >= CONSECUTIVE_FAILURES_THRESHOLD && metrics.isHealthy) {
        this.markUnhealthy(source);
      }
    }
  }

  /**
   * 标记数据源为不健康
   */
  private markUnhealthy(source: DataSource): void {
    const metrics = this.metrics.get(source);
    if (!metrics) return;

    const wasHealthy = metrics.isHealthy;
    metrics.isHealthy = false;

    if (wasHealthy) {
      console.warn(`[DataSourceHealth] ${source} marked as unhealthy after ${metrics.consecutiveFailures} consecutive failures`);
      
      // 通知监听器
      this.onHealthChangeCallbacks.forEach(cb => cb(source, false));

      // 设置恢复检测定时器
      this.scheduleRecoveryCheck(source);
    }
  }

  /**
   * 标记数据源为健康
   */
  private markHealthy(source: DataSource): void {
    const metrics = this.metrics.get(source);
    if (!metrics) return;

    const wasUnhealthy = !metrics.isHealthy;
    metrics.isHealthy = true;

    if (wasUnhealthy) {
      console.log(`[DataSourceHealth] ${source} recovered and marked as healthy`);
      
      // 通知监听器
      this.onHealthChangeCallbacks.forEach(cb => cb(source, true));

      // 清除恢复检测定时器
      const timer = this.recoveryTimers.get(source);
      if (timer) {
        clearTimeout(timer);
        this.recoveryTimers.delete(source);
      }
    }
  }

  /**
   * 安排恢复检测
   */
  private scheduleRecoveryCheck(source: DataSource): void {
    // 清除现有定时器
    const existingTimer = this.recoveryTimers.get(source);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 设置新定时器
    const timer = setTimeout(() => {
      const metrics = this.metrics.get(source);
      if (metrics && !metrics.isHealthy) {
        // 重置连续失败计数，允许重新尝试
        metrics.consecutiveFailures = 0;
        console.log(`[DataSourceHealth] ${source} recovery check - allowing retry`);
      }
      this.recoveryTimers.delete(source);
    }, RECOVERY_CHECK_INTERVAL);

    this.recoveryTimers.set(source, timer);
  }

  /**
   * 获取数据源健康状态
   */
  getHealth(source: DataSource): DataSourceHealth {
    const metrics = this.metrics.get(source);
    if (!metrics) {
      return {
        source,
        isHealthy: true,
        successRate: 1,
        avgLatency: 0,
        consecutiveFailures: 0,
      };
    }

    const successRate = metrics.totalRequests > 0
      ? metrics.successfulRequests / metrics.totalRequests
      : 1;

    const avgLatency = metrics.totalRequests > 0
      ? metrics.totalLatency / metrics.totalRequests
      : 0;

    return {
      source,
      isHealthy: metrics.isHealthy,
      successRate,
      avgLatency,
      lastError: metrics.lastError,
      consecutiveFailures: metrics.consecutiveFailures,
    };
  }

  /**
   * 获取所有数据源的健康状态
   */
  getAllHealth(): DataSourceHealth[] {
    const sources: DataSource[] = ['longport', 'openbb', 'tencent'];
    return sources.map(source => this.getHealth(source));
  }

  /**
   * 检查数据源是否健康
   */
  isHealthy(source: DataSource): boolean {
    const metrics = this.metrics.get(source);
    return metrics?.isHealthy ?? true;
  }

  /**
   * 获取健康的数据源列表（按优先级排序）
   */
  getHealthySources(market: 'US' | 'HK' | 'CN'): DataSource[] {
    const priorityMap: Record<string, DataSource[]> = {
      'US': ['longport', 'openbb'],
      'HK': ['longport', 'tencent'],
      'CN': ['tencent', 'longport'],
    };

    const sources = priorityMap[market] || ['longport', 'openbb', 'tencent'];
    return sources.filter(source => this.isHealthy(source));
  }

  /**
   * 获取下一个可用的数据源（故障转移）
   * Property 2: 数据源故障转移
   */
  getNextAvailableSource(market: 'US' | 'HK' | 'CN', excludeSource?: DataSource): DataSource | null {
    const healthySources = this.getHealthySources(market);
    
    if (excludeSource) {
      const filtered = healthySources.filter(s => s !== excludeSource);
      return filtered[0] || null;
    }

    return healthySources[0] || null;
  }

  /**
   * 注册健康状态变化回调
   */
  onHealthChange(callback: (source: DataSource, isHealthy: boolean) => void): () => void {
    this.onHealthChangeCallbacks.push(callback);
    return () => {
      const index = this.onHealthChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.onHealthChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 重置数据源指标
   */
  reset(source?: DataSource): void {
    if (source) {
      this.metrics.set(source, this.createEmptyMetrics(source));
      this.latencyHistory.set(source, []);
    } else {
      const sources: DataSource[] = ['longport', 'openbb', 'tencent'];
      sources.forEach(s => {
        this.metrics.set(s, this.createEmptyMetrics(s));
        this.latencyHistory.set(s, []);
      });
    }
  }

  /**
   * 获取延迟百分位数
   */
  getLatencyPercentile(source: DataSource, percentile: number): number {
    const history = this.latencyHistory.get(source) || [];
    if (history.length === 0) return 0;

    const sorted = [...history].sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[Math.min(index, sorted.length - 1)];
  }

  /**
   * 获取详细指标
   */
  getDetailedMetrics(source: DataSource): DataSourceMetrics | null {
    return this.metrics.get(source) || null;
  }
}

// ============ 单例导出 ============

export const dataSourceHealthMonitor = new DataSourceHealthMonitor();

// ============ 辅助函数 ============

/**
 * 带健康监控的请求包装器
 */
export async function withHealthTracking<T>(
  source: DataSource,
  request: () => Promise<T>
): Promise<{ data: T | null; success: boolean; latency: number }> {
  const startTime = Date.now();
  
  try {
    const data = await request();
    const latency = Date.now() - startTime;
    dataSourceHealthMonitor.recordRequest(source, true, latency);
    return { data, success: true, latency };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    dataSourceHealthMonitor.recordRequest(source, false, latency, errorMessage);
    return { data: null, success: false, latency };
  }
}
