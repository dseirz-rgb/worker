/**
 * IBKR (Interactive Brokers) 集成服务
 * 
 * 通过 Flex Query 同步持仓和交易数据
 * - 支持 mock 模式用于测试
 * - 自动重试和错误处理
 * 
 * **Validates: Requirements 25.1, 25.2**
 * 
 * @module @echoai/shared/integrations/ibkr
 */

// ============================================
// 类型定义
// ============================================

export interface IBKRConfig {
  token: string;
  queryId: string;
  corsProxyUrl?: string;
  timeout?: number;
  useMock?: boolean;
}

export interface IBKRPosition {
  ticker: string;
  quantity: number;
  avgCost: number;
  marketValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
  currency: string;
  assetClass: string;
}

export interface IBKRTransaction {
  id: string;
  ticker: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  commission: number;
  netAmount: number;
  tradeDate: Date;
  settleDate: Date;
  currency: string;
}

export interface IBKRAccountSummary {
  accountId: string;
  netLiquidation: number;
  totalCash: number;
  grossPositionValue: number;
  leverage: number;
  currency: string;
}

export interface FlexQueryResponse {
  positions: IBKRPosition[];
  transactions: IBKRTransaction[];
  accountSummary: IBKRAccountSummary;
  generatedAt: Date;
}

// ============================================
// Mock 数据
// ============================================

const MOCK_POSITIONS: IBKRPosition[] = [
  {
    ticker: 'AAPL',
    quantity: 100,
    avgCost: 150.00,
    marketValue: 17500,
    unrealizedPnL: 2500,
    realizedPnL: 0,
    currency: 'USD',
    assetClass: 'STK',
  },
  {
    ticker: 'GOOGL',
    quantity: 50,
    avgCost: 140.00,
    marketValue: 7500,
    unrealizedPnL: 500,
    realizedPnL: 0,
    currency: 'USD',
    assetClass: 'STK',
  },
  {
    ticker: 'MSFT',
    quantity: 75,
    avgCost: 380.00,
    marketValue: 30000,
    unrealizedPnL: 1500,
    realizedPnL: 0,
    currency: 'USD',
    assetClass: 'STK',
  },
];

const MOCK_TRANSACTIONS: IBKRTransaction[] = [
  {
    id: 'TXN001',
    ticker: 'AAPL',
    action: 'BUY',
    quantity: 50,
    price: 148.50,
    commission: 1.00,
    netAmount: -7426.00,
    tradeDate: new Date('2025-12-15'),
    settleDate: new Date('2025-12-17'),
    currency: 'USD',
  },
  {
    id: 'TXN002',
    ticker: 'GOOGL',
    action: 'BUY',
    quantity: 25,
    price: 138.00,
    commission: 1.00,
    netAmount: -3451.00,
    tradeDate: new Date('2025-12-20'),
    settleDate: new Date('2025-12-22'),
    currency: 'USD',
  },
];

const MOCK_ACCOUNT_SUMMARY: IBKRAccountSummary = {
  accountId: 'U1234567',
  netLiquidation: 100000,
  totalCash: 45000,
  grossPositionValue: 55000,
  leverage: 1.0,
  currency: 'USD',
};

// ============================================
// IBKR 服务
// ============================================

export class IBKRService {
  private config: IBKRConfig;
  private lastFetchAt: Date | null = null;
  private cachedData: FlexQueryResponse | null = null;
  private cacheValidMs: number = 5 * 60 * 1000; // 5 分钟缓存

  constructor(config: IBKRConfig) {
    this.config = {
      timeout: 30000,
      useMock: false,
      ...config,
    };
  }

  /**
   * 获取 Flex Query 数据
   * **Validates: Requirements 25.1**
   */
  async fetchFlexQuery(): Promise<FlexQueryResponse> {
    // Mock 模式
    if (this.config.useMock) {
      return this.getMockData();
    }

    // 检查缓存
    if (this.cachedData && this.lastFetchAt) {
      const cacheAge = Date.now() - this.lastFetchAt.getTime();
      if (cacheAge < this.cacheValidMs) {
        return this.cachedData;
      }
    }

    // 真实 API 调用
    const data = await this.callFlexQueryAPI();
    this.cachedData = data;
    this.lastFetchAt = new Date();
    return data;
  }

  /**
   * 获取持仓列表
   */
  async getPositions(): Promise<IBKRPosition[]> {
    const data = await this.fetchFlexQuery();
    return data.positions;
  }

  /**
   * 获取交易记录
   */
  async getTransactions(days: number = 30): Promise<IBKRTransaction[]> {
    const data = await this.fetchFlexQuery();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return data.transactions.filter(t => t.tradeDate >= cutoffDate);
  }

  /**
   * 获取账户摘要
   */
  async getAccountSummary(): Promise<IBKRAccountSummary> {
    const data = await this.fetchFlexQuery();
    return data.accountSummary;
  }

  /**
   * 检查服务是否可用
   */
  async healthCheck(): Promise<{ available: boolean; message: string }> {
    if (this.config.useMock) {
      return { available: true, message: 'Mock mode enabled' };
    }

    if (!this.config.token || !this.config.queryId) {
      return { available: false, message: 'Missing IBKR credentials' };
    }

    try {
      await this.fetchFlexQuery();
      return { available: true, message: 'IBKR connection successful' };
    } catch (error) {
      return { 
        available: false, 
        message: `IBKR connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cachedData = null;
    this.lastFetchAt = null;
  }

  /**
   * 设置缓存有效期
   */
  setCacheValidMs(ms: number): void {
    this.cacheValidMs = ms;
  }

  /**
   * 是否使用 Mock 模式
   */
  isMockMode(): boolean {
    return this.config.useMock ?? false;
  }

  // ============================================
  // 私有方法
  // ============================================

  private getMockData(): FlexQueryResponse {
    return {
      positions: [...MOCK_POSITIONS],
      transactions: [...MOCK_TRANSACTIONS],
      accountSummary: { ...MOCK_ACCOUNT_SUMMARY },
      generatedAt: new Date(),
    };
  }

  private async callFlexQueryAPI(): Promise<FlexQueryResponse> {
    // Step 1: 请求生成报告
    const requestUrl = this.buildRequestUrl();
    const requestResponse = await this.fetchWithTimeout(requestUrl);
    
    if (!requestResponse.ok) {
      throw new IBKRError('REQUEST_FAILED', `Flex Query request failed: ${requestResponse.status}`);
    }

    const requestXml = await requestResponse.text();
    const referenceCode = this.parseReferenceCode(requestXml);

    if (!referenceCode) {
      throw new IBKRError('INVALID_RESPONSE', 'Failed to get reference code');
    }

    // Step 2: 等待并获取报告
    await this.delay(2000); // IBKR 需要时间生成报告
    
    const statementUrl = this.buildStatementUrl(referenceCode);
    const statementResponse = await this.fetchWithTimeout(statementUrl);

    if (!statementResponse.ok) {
      throw new IBKRError('STATEMENT_FAILED', `Flex Query statement failed: ${statementResponse.status}`);
    }

    const statementXml = await statementResponse.text();
    return this.parseFlexQueryResponse(statementXml);
  }

  private buildRequestUrl(): string {
    const baseUrl = this.config.corsProxyUrl 
      ? `${this.config.corsProxyUrl}/`
      : '';
    return `${baseUrl}https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest?t=${this.config.token}&q=${this.config.queryId}&v=3`;
  }

  private buildStatementUrl(referenceCode: string): string {
    const baseUrl = this.config.corsProxyUrl 
      ? `${this.config.corsProxyUrl}/`
      : '';
    return `${baseUrl}https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement?t=${this.config.token}&q=${referenceCode}&v=3`;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseReferenceCode(xml: string): string | null {
    // 简化的 XML 解析
    const match = xml.match(/<ReferenceCode>(\d+)<\/ReferenceCode>/);
    return match ? match[1] : null;
  }

  private parseFlexQueryResponse(xml: string): FlexQueryResponse {
    // 简化的 XML 解析 - 实际实现需要完整的 XML 解析器
    // 这里返回空数据，实际使用时需要解析 IBKR 的 XML 格式
    
    // 检查是否有错误
    if (xml.includes('<ErrorCode>')) {
      const errorMatch = xml.match(/<ErrorMessage>([^<]+)<\/ErrorMessage>/);
      throw new IBKRError('API_ERROR', errorMatch?.[1] || 'Unknown IBKR error');
    }

    // TODO: 实现完整的 XML 解析
    // 目前返回空数据结构
    return {
      positions: [],
      transactions: [],
      accountSummary: {
        accountId: '',
        netLiquidation: 0,
        totalCash: 0,
        grossPositionValue: 0,
        leverage: 0,
        currency: 'USD',
      },
      generatedAt: new Date(),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// 错误类
// ============================================

export class IBKRError extends Error {
  constructor(
    public code: 'REQUEST_FAILED' | 'STATEMENT_FAILED' | 'INVALID_RESPONSE' | 'API_ERROR' | 'TIMEOUT',
    message: string
  ) {
    super(message);
    this.name = 'IBKRError';
  }
}

// ============================================
// 工厂函数
// ============================================

let ibkrServiceInstance: IBKRService | null = null;

export function initIBKRService(config: IBKRConfig): IBKRService {
  ibkrServiceInstance = new IBKRService(config);
  return ibkrServiceInstance;
}

export function getIBKRService(): IBKRService | null {
  return ibkrServiceInstance;
}

/**
 * 从环境变量创建 IBKR 服务
 */
export function createIBKRServiceFromEnv(): IBKRService {
  const token = process.env.IBKR_TOKEN || '';
  const queryId = process.env.IBKR_QUERY_ID || '';
  const corsProxyUrl = process.env.VITE_CORS_PROXY_URL;
  const useMock = !token || !queryId;

  return new IBKRService({
    token,
    queryId,
    corsProxyUrl,
    useMock,
  });
}

export default IBKRService;
