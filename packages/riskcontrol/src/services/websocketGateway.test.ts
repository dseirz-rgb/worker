/**
 * WebSocket Gateway 属性测试
 * Feature: realtime-market-platform
 * 
 * Property 10: WebSocket 订阅状态恢复
 * Validates: Requirements 2.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { 
  websocketGateway, 
  verifySubscriptionRestore,
  type ConnectionState 
} from './websocketGateway';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  
  private sentMessages: string[] = [];

  constructor(public url: string) {
    // 模拟异步连接
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }

  getSentMessages(): string[] {
    return this.sentMessages;
  }

  // 模拟接收消息
  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  // 模拟断开连接
  simulateDisconnect(): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: 1006, reason: 'Connection lost' }));
    }
  }
}

// 保存原始 WebSocket
const OriginalWebSocket = global.WebSocket;

describe('WebSocket Gateway', () => {
  let mockWs: MockWebSocket | null = null;

  beforeEach(() => {
    // Mock WebSocket 构造函数
    const MockWebSocketClass = class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        mockWs = this;
      }
    };
    (global as Record<string, unknown>).WebSocket = MockWebSocketClass;
    
    websocketGateway.reset();
  });

  afterEach(() => {
    websocketGateway.reset();
    (global as Record<string, unknown>).WebSocket = OriginalWebSocket;
    mockWs = null;
    vi.clearAllTimers();
  });

  describe('verifySubscriptionRestore', () => {
    /**
     * Property 10: WebSocket 订阅状态恢复
     * For any WebSocket 重连场景，重连成功后应恢复之前的所有订阅状态，不丢失任何订阅
     * Validates: Requirements 2.4
     */
    it('should verify subscription restore correctly', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[A-Za-z0-9]+$/.test(s)), { minLength: 0, maxLength: 20 }),
          (tickers) => {
            const normalized = tickers.map(t => t.toUpperCase());
            
            // 相同的订阅应该验证通过
            expect(verifySubscriptionRestore(normalized, normalized)).toBe(true);
            
            // 顺序不同也应该通过
            const shuffled = [...normalized].sort(() => Math.random() - 0.5);
            expect(verifySubscriptionRestore(normalized, shuffled)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect missing subscriptions', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[A-Za-z0-9]+$/.test(s)), { minLength: 2, maxLength: 20 }),
          (tickers) => {
            const normalized = tickers.map(t => t.toUpperCase());
            const unique = [...new Set(normalized)];
            
            if (unique.length >= 2) {
              // 移除一个订阅应该验证失败
              const incomplete = unique.slice(1);
              expect(verifySubscriptionRestore(unique, incomplete)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle case insensitivity', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[A-Za-z]+$/.test(s)), { minLength: 1, maxLength: 10 }),
          (tickers) => {
            const lower = tickers.map(t => t.toLowerCase());
            const upper = tickers.map(t => t.toUpperCase());
            
            // 大小写不同应该视为相同
            expect(verifySubscriptionRestore(lower, upper)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Subscription Management', () => {
    it('should track subscriptions correctly', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[A-Za-z0-9]+$/.test(s)), { minLength: 1, maxLength: 20 }),
          (tickers) => {
            websocketGateway.reset();
            
            // 订阅
            websocketGateway.subscribe(tickers);
            
            const subscriptions = websocketGateway.getSubscriptions();
            const normalizedInput = tickers.map(t => t.toUpperCase());
            const uniqueInput = [...new Set(normalizedInput)];
            
            // 订阅数量应该等于去重后的数量
            expect(subscriptions.length).toBe(uniqueInput.length);
            
            // 所有订阅都应该存在
            uniqueInput.forEach(ticker => {
              expect(subscriptions).toContain(ticker);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove subscriptions correctly', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[A-Za-z0-9]+$/.test(s)), { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 0 }),
          (tickers, removeIndex) => {
            websocketGateway.reset();
            
            const normalized = [...new Set(tickers.map(t => t.toUpperCase()))];
            if (normalized.length < 2) return;
            
            // 订阅所有
            websocketGateway.subscribe(normalized);
            
            // 取消订阅一个
            const indexToRemove = removeIndex % normalized.length;
            const tickerToRemove = normalized[indexToRemove];
            websocketGateway.unsubscribe([tickerToRemove]);
            
            const remaining = websocketGateway.getSubscriptions();
            
            // 被移除的不应该存在
            expect(remaining).not.toContain(tickerToRemove);
            
            // 其他的应该还在
            expect(remaining.length).toBe(normalized.length - 1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Connection State', () => {
    it('should start in disconnected state', () => {
      expect(websocketGateway.getConnectionState()).toBe('disconnected');
      expect(websocketGateway.isConnected()).toBe(false);
    });

    it('should track connection state changes', async () => {
      const states: ConnectionState[] = [];
      
      websocketGateway.onConnectionChange((state) => {
        states.push(state);
      });

      // 开始连接
      const connectPromise = websocketGateway.connect();
      
      // 等待连接完成
      await connectPromise;
      
      expect(states).toContain('connecting');
      expect(states).toContain('connected');
      expect(websocketGateway.isConnected()).toBe(true);
    });
  });

  describe('Subscription Restore on Reconnect', () => {
    /**
     * Property 10: WebSocket 订阅状态恢复
     * Validates: Requirements 2.4
     */
    it('should preserve subscriptions across reconnect', async () => {
      vi.useFakeTimers();
      
      const testTickers = ['AAPL', 'GOOGL', 'MSFT'];
      
      // 连接并订阅
      const connectPromise = websocketGateway.connect();
      await vi.advanceTimersByTimeAsync(20);
      await connectPromise;
      
      websocketGateway.subscribe(testTickers);
      
      // 验证订阅
      expect(websocketGateway.getSubscriptions()).toEqual(expect.arrayContaining(testTickers));
      
      // 模拟断开
      if (mockWs) {
        mockWs.simulateDisconnect();
      }
      
      // 等待重连
      await vi.advanceTimersByTimeAsync(3100);
      
      // 验证订阅仍然存在
      const subscriptionsAfterReconnect = websocketGateway.getSubscriptions();
      expect(subscriptionsAfterReconnect).toEqual(expect.arrayContaining(testTickers));
      
      vi.useRealTimers();
    });

    it('should notify on subscription restore', async () => {
      vi.useFakeTimers();
      
      const testTickers = ['TSLA', 'NVDA'];
      let restoreNotified = false;
      let restoredTickers: string[] = [];
      let originalTickers: string[] = [];
      
      websocketGateway.onSubscriptionRestore((restored, original) => {
        restoreNotified = true;
        restoredTickers = restored;
        originalTickers = original;
      });
      
      // 连接并订阅
      const connectPromise = websocketGateway.connect();
      await vi.advanceTimersByTimeAsync(20);
      await connectPromise;
      
      websocketGateway.subscribe(testTickers);
      
      // 模拟断开
      if (mockWs) {
        mockWs.simulateDisconnect();
      }
      
      // 等待重连
      await vi.advanceTimersByTimeAsync(3100);
      
      // 验证恢复通知
      expect(restoreNotified).toBe(true);
      expect(verifySubscriptionRestore(originalTickers, restoredTickers)).toBe(true);
      
      vi.useRealTimers();
    });
  });

  describe('Quote Handling', () => {
    it('should notify quote callbacks', async () => {
      vi.useFakeTimers();
      
      const receivedQuotes: unknown[] = [];
      
      websocketGateway.onQuote((quote) => {
        receivedQuotes.push(quote);
      });
      
      // 连接
      const connectPromise = websocketGateway.connect();
      await vi.advanceTimersByTimeAsync(20);
      await connectPromise;
      
      // 模拟接收行情
      if (mockWs) {
        mockWs.simulateMessage({
          type: 'quote',
          payload: {
            ticker: 'AAPL',
            price: 150.00,
            changePercent: 1.5,
            previousClose: 147.78,
            volume: 1000000,
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
        });
      }
      
      expect(receivedQuotes.length).toBe(1);
      expect((receivedQuotes[0] as { ticker: string }).ticker).toBe('AAPL');
      
      vi.useRealTimers();
    });
  });

  describe('Stats', () => {
    it('should provide accurate stats', async () => {
      vi.useFakeTimers();
      
      const stats = websocketGateway.getStats();
      
      expect(stats.connectionState).toBe('disconnected');
      expect(stats.subscriptionCount).toBe(0);
      expect(stats.reconnectAttempts).toBe(0);
      
      // 添加订阅
      websocketGateway.subscribe(['AAPL', 'GOOGL']);
      
      const statsAfterSubscribe = websocketGateway.getStats();
      expect(statsAfterSubscribe.subscriptionCount).toBe(2);
      
      vi.useRealTimers();
    });
  });
});
