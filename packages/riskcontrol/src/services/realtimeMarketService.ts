/**
 * Realtime Market Service - 实时行情服务
 * Feature: realtime-market-platform
 * 
 * 管理实时行情订阅，支持不同优先级的刷新频率
 * 
 * Property 1: Live Quote 结构完整性
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6
 */

import { fetchStockData, fetchMultipleStocks } from './marketData';
import { processQuoteUpdate, type QuoteData } from './priceAlertService';
import { riskIntegrationService, type QuoteUpdate as RiskQuoteUpdate } from './riskIntegrationService';
import { isMarketTrading } from './marketStatusService';
import type { StockInfo, Market } from '../types';

// ============ 类型定义 ============

export type SubscriptionPriority = 'high' | 'normal';

export interface Subscription {
  ticker: string;
  priority: SubscriptionPriority;
  market: Market;
  lastUpdate: number;
  callbacks: Set<(quote: LiveQuote) => void>;
}

export interface LiveQuote {
  ticker: string;
  price: number;
  changePercent: number;
  previousClose: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  timestamp: number;
  source: string;
  isStale: boolean;
}

export interface RealtimeServiceConfig {
  highPriorityInterval: number;   // 高优先级刷新间隔（毫秒）
  normalPriorityInterval: number; // 普通优先级刷新间隔（毫秒）
  staleThreshold: number;         // 数据过期阈值（毫秒）
  enableAlertProcessing: boolean; // 是否启用警报处理
  enableRiskIntegration: boolean; // 是否启用风控集成
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: RealtimeServiceConfig = {
  highPriorityInterval: 5000,     // 5秒
  normalPriorityInterval: 30000,  // 30秒
  staleThreshold: 60000,          // 1分钟
  enableAlertProcessing: true,
  enableRiskIntegration: true,
};

// ============ 实时行情服务类 ============

class RealtimeMarketService {
  private subscriptions: Map<string, Subscription> = new Map();
  private config: RealtimeServiceConfig = DEFAULT_CONFIG;
  private highPriorityTimer: NodeJS.Timeout | null = null;
  private normalPriorityTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastQuotes: Map<string, LiveQuote> = new Map();
  private onDataUpdateCallbacks: Array<(quotes: Map<string, LiveQuote>) => void> = [];

  /**
   * 配置服务
   */
  configure(config: Partial<RealtimeServiceConfig>): void {
    this.config = { ...this.config, ...config };
    
    // 如果正在运行，重新启动以应用新配置
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): RealtimeServiceConfig {
    return { ...this.config };
  }

  /**
   * 订阅股票行情
   * Requirements: 1.1
   */
  subscribe(
    ticker: string,
    priority: SubscriptionPriority,
    callback?: (quote: LiveQuote) => void
  ): () => void {
    const upperTicker = ticker.toUpperCase();
    
    let subscription = this.subscriptions.get(upperTicker);
    
    if (!subscription) {
      subscription = {
        ticker: upperTicker,
        priority,
        market: this.detectMarket(upperTicker),
        lastUpdate: 0,
        callbacks: new Set(),
      };
      this.subscriptions.set(upperTicker, subscription);
    } else {
      // 升级优先级（高优先级覆盖普通优先级）
      if (priority === 'high' && subscription.priority === 'normal') {
        subscription.priority = 'high';
      }
    }
    
    if (callback) {
      subscription.callbacks.add(callback);
    }
    
    // 立即获取一次数据
    this.fetchQuote(upperTicker);
    
    // 返回取消订阅函数
    return () => this.unsubscribe(upperTicker, callback);
  }

  /**
   * 取消订阅
   */
  unsubscribe(ticker: string, callback?: (quote: LiveQuote) => void): void {
    const upperTicker = ticker.toUpperCase();
    const subscription = this.subscriptions.get(upperTicker);
    
    if (!subscription) return;
    
    if (callback) {
      subscription.callbacks.delete(callback);
    }
    
    // 如果没有回调了，移除订阅
    if (subscription.callbacks.size === 0) {
      this.subscriptions.delete(upperTicker);
    }
  }

  /**
   * 批量订阅
   */
  subscribeMultiple(
    tickers: string[],
    priority: SubscriptionPriority,
    callback?: (quote: LiveQuote) => void
  ): () => void {
    const unsubscribes = tickers.map(ticker => 
      this.subscribe(ticker, priority, callback)
    );
    
    return () => unsubscribes.forEach(unsub => unsub());
  }

  /**
   * 启动服务
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // 启动高优先级定时器
    this.highPriorityTimer = setInterval(
      () => this.fetchHighPriorityQuotes(),
      this.config.highPriorityInterval
    );
    
    // 启动普通优先级定时器
    this.normalPriorityTimer = setInterval(
      () => this.fetchNormalPriorityQuotes(),
      this.config.normalPriorityInterval
    );
    
    console.log('[RealtimeMarket] Service started');
  }

  /**
   * 停止服务
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.highPriorityTimer) {
      clearInterval(this.highPriorityTimer);
      this.highPriorityTimer = null;
    }
    
    if (this.normalPriorityTimer) {
      clearInterval(this.normalPriorityTimer);
      this.normalPriorityTimer = null;
    }
    
    console.log('[RealtimeMarket] Service stopped');
  }

  /**
   * 获取高优先级行情
   * Requirements: 1.3 - 持仓 5 秒刷新
   */
  private async fetchHighPriorityQuotes(): Promise<void> {
    const highPriorityTickers = Array.from(this.subscriptions.values())
      .filter(sub => sub.priority === 'high')
      .map(sub => sub.ticker);
    
    if (highPriorityTickers.length === 0) return;
    
    await this.fetchQuotes(highPriorityTickers);
  }

  /**
   * 获取普通优先级行情
   * Requirements: 1.4 - 观察列表 30 秒刷新
   */
  private async fetchNormalPriorityQuotes(): Promise<void> {
    const normalPriorityTickers = Array.from(this.subscriptions.values())
      .filter(sub => sub.priority === 'normal')
      .map(sub => sub.ticker);
    
    if (normalPriorityTickers.length === 0) return;
    
    await this.fetchQuotes(normalPriorityTickers);
  }

  /**
   * 批量获取行情
   */
  private async fetchQuotes(tickers: string[]): Promise<void> {
    try {
      const stockInfoMap = await fetchMultipleStocks(tickers);
      const updatedQuotes = new Map<string, LiveQuote>();
      
      stockInfoMap.forEach((stockInfo, ticker) => {
        const quote = this.stockInfoToLiveQuote(stockInfo);
        this.lastQuotes.set(ticker, quote);
        updatedQuotes.set(ticker, quote);
        
        // 更新订阅的最后更新时间
        const subscription = this.subscriptions.get(ticker);
        if (subscription) {
          subscription.lastUpdate = Date.now();
          
          // 通知订阅回调
          subscription.callbacks.forEach(cb => cb(quote));
        }
        
        // 处理警报
        if (this.config.enableAlertProcessing) {
          this.processAlerts(quote);
        }
        
        // 风控集成
        if (this.config.enableRiskIntegration) {
          this.updateRiskMetrics(quote);
        }
      });
      
      // 通知全局回调
      if (updatedQuotes.size > 0) {
        this.onDataUpdateCallbacks.forEach(cb => cb(updatedQuotes));
      }
    } catch (error) {
      console.error('[RealtimeMarket] Failed to fetch quotes:', error);
    }
  }

  /**
   * 获取单个行情
   */
  private async fetchQuote(ticker: string): Promise<void> {
    try {
      const response = await fetchStockData(ticker);
      
      if (response.success && response.data) {
        const quote = this.stockInfoToLiveQuote(response.data);
        this.lastQuotes.set(ticker, quote);
        
        // 更新订阅
        const subscription = this.subscriptions.get(ticker);
        if (subscription) {
          subscription.lastUpdate = Date.now();
          subscription.callbacks.forEach(cb => cb(quote));
        }
        
        // 处理警报
        if (this.config.enableAlertProcessing) {
          this.processAlerts(quote);
        }
        
        // 风控集成
        if (this.config.enableRiskIntegration) {
          this.updateRiskMetrics(quote);
        }
      }
    } catch (error) {
      console.error(`[RealtimeMarket] Failed to fetch quote for ${ticker}:`, error);
    }
  }

  /**
   * 转换 StockInfo 到 LiveQuote
   * Property 1: Live Quote 结构完整性
   * Requirements: 1.6
   */
  private stockInfoToLiveQuote(stockInfo: StockInfo): LiveQuote {
    const now = Date.now();
    const isStale = (now - stockInfo.lastUpdated) > this.config.staleThreshold;
    
    return {
      ticker: stockInfo.ticker,
      price: stockInfo.currentPrice,
      changePercent: stockInfo.changePercent,
      previousClose: stockInfo.previousClose,
      timestamp: stockInfo.lastUpdated,
      source: stockInfo.market,
      isStale,
    };
  }

  /**
   * 处理价格警报
   * Requirements: 1.2, 4.1
   */
  private async processAlerts(quote: LiveQuote): Promise<void> {
    const quoteData: QuoteData = {
      ticker: quote.ticker,
      price: quote.price,
      changePercent: quote.changePercent,
      previousClose: quote.previousClose,
    };
    
    try {
      await processQuoteUpdate(quoteData);
    } catch (error) {
      console.error('[RealtimeMarket] Failed to process alerts:', error);
    }
  }

  /**
   * 更新风控指标
   * Requirements: 5.1
   */
  private updateRiskMetrics(quote: LiveQuote): void {
    const riskQuote: RiskQuoteUpdate = {
      ticker: quote.ticker,
      price: quote.price,
      changePercent: quote.changePercent,
      previousClose: quote.previousClose,
      timestamp: quote.timestamp,
    };
    
    riskIntegrationService.onQuoteUpdate(riskQuote);
  }

  /**
   * 获取最新行情
   */
  getQuote(ticker: string): LiveQuote | null {
    return this.lastQuotes.get(ticker.toUpperCase()) || null;
  }

  /**
   * 获取所有最新行情
   */
  getAllQuotes(): Map<string, LiveQuote> {
    return new Map(this.lastQuotes);
  }

  /**
   * 获取订阅列表
   */
  getSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * 注册数据更新回调
   * Requirements: 1.2
   */
  onDataUpdate(callback: (quotes: Map<string, LiveQuote>) => void): () => void {
    this.onDataUpdateCallbacks.push(callback);
    return () => {
      const index = this.onDataUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.onDataUpdateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 检测市场类型
   */
  private detectMarket(ticker: string): Market {
    if (/^\d{6}$/.test(ticker)) return 'CN';
    if (/^\d{4,5}$/.test(ticker) || ticker.endsWith('.HK')) return 'HK';
    return 'US';
  }

  /**
   * 检查数据是否过期
   */
  isQuoteStale(ticker: string): boolean {
    const quote = this.lastQuotes.get(ticker.toUpperCase());
    if (!quote) return true;
    return quote.isStale;
  }

  /**
   * 强制刷新所有订阅
   */
  async refresh(): Promise<void> {
    const allTickers = Array.from(this.subscriptions.keys());
    if (allTickers.length > 0) {
      await this.fetchQuotes(allTickers);
    }
  }

  /**
   * 清除所有订阅
   */
  clear(): void {
    this.subscriptions.clear();
    this.lastQuotes.clear();
  }
}

// ============ 单例导出 ============

export const realtimeMarketService = new RealtimeMarketService();

// ============ 辅助函数 ============

/**
 * 验证 LiveQuote 结构完整性
 * Property 1: Live Quote 结构完整性
 */
export function validateLiveQuote(quote: LiveQuote): boolean {
  return (
    typeof quote.ticker === 'string' &&
    quote.ticker.length > 0 &&
    typeof quote.price === 'number' &&
    !isNaN(quote.price) &&
    quote.price >= 0 &&
    typeof quote.changePercent === 'number' &&
    !isNaN(quote.changePercent) &&
    typeof quote.previousClose === 'number' &&
    !isNaN(quote.previousClose) &&
    typeof quote.timestamp === 'number' &&
    quote.timestamp > 0 &&
    typeof quote.source === 'string' &&
    typeof quote.isStale === 'boolean'
  );
}
