/**
 * WebSocket Gateway - WebSocket 实时推送网关
 * Feature: realtime-market-platform
 * 
 * 提供 WebSocket 连接管理、自动重连、心跳机制和订阅状态恢复
 * 
 * Property 10: WebSocket 订阅状态恢复
 * Validates: Requirements 2.1, 2.3, 2.4, 2.5
 */

import type { LiveQuote } from './realtimeMarketService';

// ============ 类型定义 ============

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface WebSocketConfig {
  url: string;
  reconnectDelay: number;        // 重连延迟（毫秒）
  maxReconnectDelay: number;     // 最大重连延迟（毫秒）
  reconnectBackoff: number;      // 重连退避系数
  maxReconnectAttempts: number;  // 最大重连次数
  heartbeatInterval: number;     // 心跳间隔（毫秒）
  heartbeatTimeout: number;      // 心跳超时（毫秒）
}

export interface WebSocketMessage {
  type: 'quote' | 'subscribe' | 'unsubscribe' | 'heartbeat' | 'error';
  payload?: unknown;
  timestamp: number;
}

export interface QuoteMessage {
  ticker: string;
  price: number;
  changePercent: number;
  previousClose: number;
  volume?: number;
  timestamp: number;
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: WebSocketConfig = {
  url: import.meta.env.VITE_WS_URL || 'wss://api.example.com/ws/quotes',
  reconnectDelay: 1000,          // 1秒初始重连延迟
  maxReconnectDelay: 30000,      // 最大30秒
  reconnectBackoff: 1.5,         // 退避系数
  maxReconnectAttempts: 10,      // 最多重连10次
  heartbeatInterval: 30000,      // 30秒心跳
  heartbeatTimeout: 5000,        // 5秒心跳超时
};

// ============ WebSocket Gateway 类 ============

class WebSocketGateway {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig = DEFAULT_CONFIG;
  private connectionState: ConnectionState = 'disconnected';
  private subscriptions: Set<string> = new Set();
  private pendingSubscriptions: Set<string> = new Set();
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatTimeoutTimer: NodeJS.Timeout | null = null;
  private lastHeartbeatResponse: number = 0;
  private subscriptionSnapshot: string[] = []; // 用于验证恢复
  
  // 回调
  private onQuoteCallbacks: Array<(quote: LiveQuote) => void> = [];
  private onConnectionChangeCallbacks: Array<(state: ConnectionState) => void> = [];
  private onErrorCallbacks: Array<(error: Error) => void> = [];
  private onSubscriptionRestoreCallbacks: Array<(restored: string[], original: string[]) => void> = [];

  /**
   * 配置 WebSocket Gateway
   */
  configure(config: Partial<WebSocketConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): WebSocketConfig {
    return { ...this.config };
  }

  /**
   * 连接到 WebSocket 服务器
   * Requirements: 2.1
   */
  async connect(): Promise<void> {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return;
    }

    this.setConnectionState('connecting');
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);
        
        this.ws.onopen = () => {
          console.log('[WebSocketGateway] Connected');
          this.setConnectionState('connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          
          // 恢复之前的订阅状态
          // Requirements: 2.4
          this.restoreSubscriptions();
          
          resolve();
        };
        
        this.ws.onclose = (event) => {
          console.log('[WebSocketGateway] Disconnected:', event.code, event.reason);
          this.handleDisconnect();
        };
        
        this.ws.onerror = (error) => {
          console.error('[WebSocketGateway] Error:', error);
          this.notifyError(new Error('WebSocket connection error'));
          
          if (this.connectionState === 'connecting') {
            reject(new Error('Failed to connect'));
          }
        };
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.setConnectionState('disconnected');
        reject(error);
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.clearReconnectTimer();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setConnectionState('disconnected');
    console.log('[WebSocketGateway] Manually disconnected');
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connectionState === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * 订阅股票行情
   */
  subscribe(tickers: string[]): void {
    const normalizedTickers = tickers.map(t => t.toUpperCase());
    
    normalizedTickers.forEach(ticker => {
      this.subscriptions.add(ticker);
    });
    
    if (this.isConnected()) {
      this.sendSubscribe(normalizedTickers);
    } else {
      // 保存待订阅列表，连接后恢复
      normalizedTickers.forEach(ticker => {
        this.pendingSubscriptions.add(ticker);
      });
    }
  }

  /**
   * 取消订阅
   */
  unsubscribe(tickers: string[]): void {
    const normalizedTickers = tickers.map(t => t.toUpperCase());
    
    normalizedTickers.forEach(ticker => {
      this.subscriptions.delete(ticker);
      this.pendingSubscriptions.delete(ticker);
    });
    
    if (this.isConnected()) {
      this.sendUnsubscribe(normalizedTickers);
    }
  }

  /**
   * 获取当前订阅列表
   * Property 10: WebSocket 订阅状态恢复
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  /**
   * 注册行情回调
   */
  onQuote(callback: (quote: LiveQuote) => void): () => void {
    this.onQuoteCallbacks.push(callback);
    return () => {
      const index = this.onQuoteCallbacks.indexOf(callback);
      if (index > -1) {
        this.onQuoteCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 注册连接状态变化回调
   */
  onConnectionChange(callback: (state: ConnectionState) => void): () => void {
    this.onConnectionChangeCallbacks.push(callback);
    return () => {
      const index = this.onConnectionChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.onConnectionChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 注册错误回调
   */
  onError(callback: (error: Error) => void): () => void {
    this.onErrorCallbacks.push(callback);
    return () => {
      const index = this.onErrorCallbacks.indexOf(callback);
      if (index > -1) {
        this.onErrorCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 注册订阅恢复回调
   * Property 10: WebSocket 订阅状态恢复
   */
  onSubscriptionRestore(callback: (restored: string[], original: string[]) => void): () => void {
    this.onSubscriptionRestoreCallbacks.push(callback);
    return () => {
      const index = this.onSubscriptionRestoreCallbacks.indexOf(callback);
      if (index > -1) {
        this.onSubscriptionRestoreCallbacks.splice(index, 1);
      }
    };
  }

  // ============ 私有方法 ============

  /**
   * 设置连接状态并通知
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.onConnectionChangeCallbacks.forEach(cb => cb(state));
    }
  }

  /**
   * 处理断开连接
   * Requirements: 2.3 - 3秒内自动重连
   */
  private handleDisconnect(): void {
    this.stopHeartbeat();
    this.ws = null;
    
    // 保存断开前的订阅快照，用于恢复验证
    // Property 10: WebSocket 订阅状态恢复
    if (this.subscriptionSnapshot.length === 0) {
      this.subscriptionSnapshot = Array.from(this.subscriptions);
    }
    
    if (this.connectionState !== 'disconnected') {
      this.setConnectionState('reconnecting');
      this.scheduleReconnect();
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[WebSocketGateway] Max reconnect attempts reached');
      this.setConnectionState('disconnected');
      this.notifyError(new Error('Max reconnect attempts reached'));
      return;
    }
    
    // 计算重连延迟（指数退避）
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(this.config.reconnectBackoff, this.reconnectAttempts),
      this.config.maxReconnectDelay
    );
    
    // 确保在 3 秒内重连（Requirements: 2.3）
    const actualDelay = Math.min(delay, 3000);
    
    console.log(`[WebSocketGateway] Reconnecting in ${actualDelay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      try {
        await this.connect();
      } catch (error) {
        console.error('[WebSocketGateway] Reconnect failed:', error);
        this.handleDisconnect();
      }
    }, actualDelay);
  }

  /**
   * 清除重连定时器
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 恢复订阅状态
   * Property 10: WebSocket 订阅状态恢复
   * Requirements: 2.4
   */
  private restoreSubscriptions(): void {
    const allSubscriptions = new Set<string>();
    this.subscriptions.forEach(sub => allSubscriptions.add(sub));
    this.pendingSubscriptions.forEach(sub => allSubscriptions.add(sub));
    
    if (allSubscriptions.size > 0) {
      const subscriptionsToRestore = Array.from(allSubscriptions);
      console.log(`[WebSocketGateway] Restoring ${subscriptionsToRestore.length} subscriptions`);
      this.sendSubscribe(subscriptionsToRestore);
      
      // 通知订阅恢复回调
      const originalSnapshot = this.subscriptionSnapshot.length > 0 
        ? this.subscriptionSnapshot 
        : subscriptionsToRestore;
      
      this.onSubscriptionRestoreCallbacks.forEach(cb => 
        cb(subscriptionsToRestore, originalSnapshot)
      );
      
      // 清理
      this.pendingSubscriptions.clear();
      this.subscriptionSnapshot = [];
    }
  }

  /**
   * 发送订阅消息
   */
  private sendSubscribe(tickers: string[]): void {
    this.sendMessage({
      type: 'subscribe',
      payload: { tickers },
      timestamp: Date.now(),
    });
  }

  /**
   * 发送取消订阅消息
   */
  private sendUnsubscribe(tickers: string[]): void {
    this.sendMessage({
      type: 'unsubscribe',
      payload: { tickers },
      timestamp: Date.now(),
    });
  }

  /**
   * 发送消息
   */
  private sendMessage(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * 处理收到的消息
   * Requirements: 2.2 - 100ms 内推送更新
   */
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      
      switch (message.type) {
        case 'quote':
          this.handleQuoteMessage(message.payload as QuoteMessage);
          break;
        case 'heartbeat':
          this.handleHeartbeatResponse();
          break;
        case 'error':
          this.notifyError(new Error(String(message.payload)));
          break;
      }
    } catch (error) {
      console.error('[WebSocketGateway] Failed to parse message:', error);
    }
  }

  /**
   * 处理行情消息
   */
  private handleQuoteMessage(quoteMsg: QuoteMessage): void {
    const quote: LiveQuote = {
      ticker: quoteMsg.ticker,
      price: quoteMsg.price,
      changePercent: quoteMsg.changePercent,
      previousClose: quoteMsg.previousClose,
      volume: quoteMsg.volume,
      timestamp: quoteMsg.timestamp,
      source: 'websocket',
      isStale: false,
    };
    
    this.onQuoteCallbacks.forEach(cb => cb(quote));
  }

  /**
   * 启动心跳
   * Requirements: 2.5 - 30秒心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  /**
   * 发送心跳
   */
  private sendHeartbeat(): void {
    this.sendMessage({
      type: 'heartbeat',
      timestamp: Date.now(),
    });
    
    // 设置心跳超时
    this.heartbeatTimeoutTimer = setTimeout(() => {
      console.warn('[WebSocketGateway] Heartbeat timeout');
      this.ws?.close(4000, 'Heartbeat timeout');
    }, this.config.heartbeatTimeout);
  }

  /**
   * 处理心跳响应
   */
  private handleHeartbeatResponse(): void {
    this.lastHeartbeatResponse = Date.now();
    
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  /**
   * 通知错误
   */
  private notifyError(error: Error): void {
    this.onErrorCallbacks.forEach(cb => cb(error));
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    connectionState: ConnectionState;
    subscriptionCount: number;
    reconnectAttempts: number;
    lastHeartbeat: number;
  } {
    return {
      connectionState: this.connectionState,
      subscriptionCount: this.subscriptions.size,
      reconnectAttempts: this.reconnectAttempts,
      lastHeartbeat: this.lastHeartbeatResponse,
    };
  }

  /**
   * 重置状态（用于测试）
   */
  reset(): void {
    this.disconnect();
    this.subscriptions.clear();
    this.pendingSubscriptions.clear();
    this.subscriptionSnapshot = [];
    this.reconnectAttempts = 0;
    this.onQuoteCallbacks = [];
    this.onConnectionChangeCallbacks = [];
    this.onErrorCallbacks = [];
    this.onSubscriptionRestoreCallbacks = [];
  }
}

// ============ 单例导出 ============

export const websocketGateway = new WebSocketGateway();

// ============ 辅助函数 ============

/**
 * 验证订阅状态恢复
 * Property 10: WebSocket 订阅状态恢复
 */
export function verifySubscriptionRestore(
  originalSubscriptions: string[],
  restoredSubscriptions: string[]
): boolean {
  if (originalSubscriptions.length !== restoredSubscriptions.length) {
    return false;
  }
  
  const originalSet = new Set(originalSubscriptions.map(s => s.toUpperCase()));
  const restoredSet = new Set(restoredSubscriptions.map(s => s.toUpperCase()));
  
  let allFound = true;
  originalSet.forEach(sub => {
    if (!restoredSet.has(sub)) {
      allFound = false;
    }
  });
  
  if (!allFound) {
    return false;
  }
  
  return true;
}
