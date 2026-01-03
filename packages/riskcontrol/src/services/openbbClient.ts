/**
 * OpenBB Data Service Client
 * TypeScript 客户端，用于调用 OpenBB FastAPI 服务
 * 
 * @module openbbClient
 */

// ============ Types ============

export interface LiveQuote {
  ticker: string;
  price: number;
  prevClose: number;
  changePercent: number;
  volume: number;
  timestamp: number;
  source: string;
  market: string;
  currency: string;
  open?: number;
  high?: number;
  low?: number;
  name?: string;
}

export interface HistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ApiMeta {
  source: string;
  cached: boolean;
  timestamp: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
  meta: ApiMeta;
}

export interface ProviderHealth {
  healthy: boolean;
  successRate: number;
  avgLatency: number;
  totalRequests: number;
  consecutiveFailures: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  providers: Record<string, ProviderHealth>;
  uptime: number;
  version: string;
}

export interface CompanyOverview {
  symbol: string;
  name: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  employees?: number;
  pe?: number;
  pb?: number;
  roe?: number;
  dividendYield?: number;
}

export interface OpenBBClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

// ============ Client Implementation ============

export class OpenBBClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private retryDelay: number;

  constructor(config: OpenBBClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // 移除尾部斜杠
    this.timeout = config.timeout ?? 10000;
    this.retries = config.retries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
  }

  // ============ Quote Methods ============

  /**
   * 获取单个股票的实时报价
   */
  async getQuote(ticker: string, provider?: string): Promise<LiveQuote> {
    const params = new URLSearchParams({ ticker });
    if (provider) params.append('provider', provider);
    
    const response = await this.fetch<ApiResponse<LiveQuote>>(
      `/api/v1/equity/price/quote?${params}`
    );
    
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch quote');
    }
    
    return this.normalizeQuote(response.data);
  }

  /**
   * 批量获取多个股票的实时报价
   */
  async getQuotes(tickers: string[]): Promise<Map<string, LiveQuote>> {
    const promises = tickers.map(t => 
      this.getQuote(t).catch(err => {
        console.warn(`Failed to fetch quote for ${t}:`, err.message);
        return null;
      })
    );
    
    const results = await Promise.all(promises);
    
    const map = new Map<string, LiveQuote>();
    results.forEach((result, index) => {
      if (result) {
        map.set(tickers[index], result);
      }
    });
    
    return map;
  }

  // ============ Historical Methods ============

  /**
   * 获取历史价格数据
   */
  async getHistorical(
    ticker: string,
    startDate?: string,
    endDate?: string,
    provider?: string
  ): Promise<HistoricalBar[]> {
    const params = new URLSearchParams({ ticker });
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (provider) params.append('provider', provider);
    
    const response = await this.fetch<ApiResponse<HistoricalBar[]>>(
      `/api/v1/equity/price/historical?${params}`
    );
    
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch historical data');
    }
    
    return response.data;
  }

  // ============ Fundamental Methods ============

  /**
   * 获取公司概况
   */
  async getOverview(ticker: string, provider?: string): Promise<CompanyOverview> {
    const params = new URLSearchParams({ ticker });
    if (provider) params.append('provider', provider);
    
    const response = await this.fetch<ApiResponse<CompanyOverview>>(
      `/api/v1/equity/fundamental/overview?${params}`
    );
    
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch overview');
    }
    
    return response.data;
  }

  // ============ Economy Methods ============

  /**
   * 获取 GDP 数据
   */
  async getGDP(country: string = 'united_states'): Promise<any[]> {
    const params = new URLSearchParams({ country });
    
    const response = await this.fetch<ApiResponse<any[]>>(
      `/api/v1/economy/gdp?${params}`
    );
    
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch GDP data');
    }
    
    return response.data;
  }

  /**
   * 获取 CPI 数据
   */
  async getCPI(country: string = 'united_states'): Promise<any[]> {
    const params = new URLSearchParams({ country });
    
    const response = await this.fetch<ApiResponse<any[]>>(
      `/api/v1/economy/cpi?${params}`
    );
    
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch CPI data');
    }
    
    return response.data;
  }

  // ============ Health Methods ============

  /**
   * 获取服务健康状态
   */
  async getHealth(): Promise<HealthStatus> {
    const response = await this.fetch<HealthStatus>('/health');
    return response;
  }

  /**
   * 获取监控指标
   */
  async getMetrics(): Promise<any> {
    const response = await this.fetch<any>('/metrics');
    return response;
  }

  /**
   * 检查服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.getHealth();
      return health.status !== 'unhealthy';
    } catch {
      return false;
    }
  }

  // ============ Private Methods ============

  /**
   * 发送 HTTP 请求，支持重试和超时
   */
  private async fetch<T>(path: string): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(`${this.baseUrl}${path}`, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        lastError = error as Error;
        
        // 如果是最后一次尝试，不再等待
        if (attempt < this.retries - 1) {
          // 指数退避
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this.delay(delay);
        }
      }
    }
    
    throw lastError || new Error('Request failed');
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 标准化报价数据（snake_case -> camelCase）
   */
  private normalizeQuote(data: any): LiveQuote {
    return {
      ticker: data.ticker,
      price: data.price,
      prevClose: data.prev_close ?? data.prevClose,
      changePercent: data.change_percent ?? data.changePercent,
      volume: data.volume,
      timestamp: data.timestamp,
      source: data.source,
      market: data.market,
      currency: data.currency,
      open: data.open,
      high: data.high,
      low: data.low,
      name: data.name,
    };
  }
}

// ============ Singleton Export ============

/**
 * 默认 OpenBB 客户端实例
 */
export const openbbClient = new OpenBBClient({
  baseUrl: import.meta.env.VITE_OPENBB_API_URL || 'http://localhost:6900',
  timeout: 10000,
  retries: 3,
});

export default openbbClient;
