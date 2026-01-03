/**
 * WebSocket Gateway 属性测试
 * 
 * **Feature: riskcontrol-integration**
 * **Property 8: WebSocket 订阅恢复**
 * **Validates: Requirements 33.1, 33.2, 33.3, 33.4**
 * 
 * @module @echoai/shared/websocket/tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  WebSocketGateway,
  DEFAULT_RECONNECT_CONFIG,
  DEFAULT_HEARTBEAT_CONFIG,
  type ConnectionState,
  type WebSocketMessage,
} from './index';

// ============================================
// Mock WebSocket
// ============================================

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  private sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    // 模拟异步连接
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sentMessages.push(data);

    // 模拟服务器响应
    const message: WebSocketMessage = JSON.parse(data);
    if (message.type === 'ping') {
      setTimeout(() => {
        this.simulateMessage({ type: 'pong', timestamp: Date.now() });
      }, 5);
    } else if (message.type === 'subscribe') {
      setTimeout(() => {
        this.simulateMessage({ type: 'ack', channel: message.channel, timestamp: Date.now() });
      }, 5);
    }
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code || 1000, reason: reason || '', wasClean: true } as CloseEvent);
  }

  // 测试辅助方法
  getSentMessages(): string[] {
    return [...this.sentMessages];
  }

  simulateMessage(data: WebSocketMessage): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateError(): void {
    this.onerror?.(new Event('error'));
  }

  simulateClose(code: number = 1006): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason: '', wasClean: false } as CloseEvent);
  }
}

// 全局 mock
vi.stubGlobal('WebSocket', MockWebSocket);

// ============================================
// 辅助函数
// ============================================

// 生成有效的频道名称
const channelArb = fc.stringOf(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '_'),
  { minLength: 1, maxLength: 20 }
);

// 生成频道列表
const channelListArb = fc.array(channelArb, { minLength: 1, maxLength: 10 });

// 等待连接
async function waitForConnection(gateway: WebSocketGateway, timeout = 100): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (gateway.isConnected()) return true;
    await new Promise(r => setTimeout(r, 10));
  }
  return false;
}

// ============================================
// 属性测试
// ============================================

describe('WebSocketGateway Property Tests', () => {
  let gateway: WebSocketGateway;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    gateway = new WebSocketGateway({ url: 'ws://test.example.com' });
  });

  afterEach(() => {
    gateway.disconnect();
    vi.useRealTimers();
  });

  /**
   * **Property 8.1: 订阅状态在重连后恢复**
   * 断开重连后，所有订阅应该被恢复
   * **Validates: Requirements 33.2, 33.3**
   */
  it('should restore all subscriptions after reconnection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(channelArb, { minLength: 1, maxLength: 10 }),
        async (channels) => {
          // 连接
          gateway.connect();
          await vi.advanceTimersByTimeAsync(50);
          
          // 订阅
          gateway.subscribe(channels);
          await vi.advanceTimersByTimeAsync(50);
          
          const originalSubs = new Set(gateway.getSubscriptions());
          
          // 断开
          gateway.disconnect();
          
          // 重连
          gateway.connect();
          await vi.advanceTimersByTimeAsync(50);
          
          // 恢复订阅
          await gateway.restoreSubscriptions();
          await vi.advanceTimersByTimeAsync(50);
          
          // 验证订阅恢复
          const restoredSubs = new Set(gateway.getSubscriptions());
          expect(restoredSubs).toEqual(originalSubs);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 8.2: 订阅顺序无关性**
   * 无论订阅顺序如何，最终订阅集合应该相同
   * **Validates: Requirements 33.2**
   */
  it('should have same subscriptions regardless of order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(channelArb, { minLength: 2, maxLength: 10 }),
        async (channels) => {
          const gateway1 = new WebSocketGateway({ url: 'ws://test1.example.com' });
          const gateway2 = new WebSocketGateway({ url: 'ws://test2.example.com' });
          
          gateway1.connect();
          gateway2.connect();
          await vi.advanceTimersByTimeAsync(50);
          
          // 正序订阅
          gateway1.subscribe(channels);
          
          // 逆序订阅
          gateway2.subscribe([...channels].reverse());
          
          await vi.advanceTimersByTimeAsync(50);
          
          // 订阅集合应该相同
          const subs1 = new Set(gateway1.getSubscriptions());
          const subs2 = new Set(gateway2.getSubscriptions());
          
          expect(subs1).toEqual(subs2);
          
          gateway1.disconnect();
          gateway2.disconnect();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 8.3: 重复订阅幂等性**
   * 多次订阅同一频道，结果应该与订阅一次相同
   * **Validates: Requirements 33.2**
   */
  it('should be idempotent for duplicate subscriptions', async () => {
    await fc.assert(
      fc.asyncProperty(
        channelArb,
        fc.integer({ min: 2, max: 10 }),
        async (channel, times) => {
          gateway.connect();
          await vi.advanceTimersByTimeAsync(50);
          
          // 多次订阅同一频道
          for (let i = 0; i < times; i++) {
            gateway.subscribe(channel);
          }
          
          await vi.advanceTimersByTimeAsync(50);
          
          // 应该只有一个订阅
          const subs = gateway.getSubscriptions();
          const channelCount = subs.filter(s => s === channel).length;
          
          expect(channelCount).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 8.4: 取消订阅后不再包含**
   * 取消订阅后，该频道不应出现在订阅列表中
   * **Validates: Requirements 33.2**
   */
  it('should remove channel after unsubscribe', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(channelArb, { minLength: 2, maxLength: 10 }),
        async (channels) => {
          gateway.connect();
          await vi.advanceTimersByTimeAsync(50);
          
          // 订阅所有
          gateway.subscribe(channels);
          await vi.advanceTimersByTimeAsync(50);
          
          // 取消第一个
          const toRemove = channels[0];
          gateway.unsubscribe(toRemove);
          
          // 验证已移除
          const subs = gateway.getSubscriptions();
          expect(subs).not.toContain(toRemove);
          
          // 其他仍在
          for (let i = 1; i < channels.length; i++) {
            expect(subs).toContain(channels[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 8.5: 离线订阅在连接后发送**
   * 在断开状态下订阅的频道，应该在连接后自动发送
   * **Validates: Requirements 33.2, 33.3**
   */
  it('should send pending subscriptions after connect', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(channelArb, { minLength: 1, maxLength: 5 }),
        async (channels) => {
          // 先订阅（离线状态）
          gateway.subscribe(channels);
          
          // 然后连接
          gateway.connect();
          await vi.advanceTimersByTimeAsync(100);
          
          // 验证订阅已发送
          const subs = gateway.getSubscriptions();
          for (const channel of channels) {
            expect(subs).toContain(channel);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// 单元测试
// ============================================

describe('WebSocketGateway Unit Tests', () => {
  let gateway: WebSocketGateway;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    gateway = new WebSocketGateway({ url: 'ws://test.example.com' });
  });

  afterEach(() => {
    gateway.disconnect();
    vi.useRealTimers();
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      const result = gateway.connect();
      await vi.advanceTimersByTimeAsync(50);
      
      expect(await result).toBe(true);
      expect(gateway.isConnected()).toBe(true);
      expect(gateway.getState()).toBe('connected');
    });

    it('should disconnect cleanly', async () => {
      gateway.connect();
      await vi.advanceTimersByTimeAsync(50);
      
      gateway.disconnect();
      
      expect(gateway.isConnected()).toBe(false);
      expect(gateway.getState()).toBe('disconnected');
    });

    it('should track connection stats', async () => {
      gateway.connect();
      await vi.advanceTimersByTimeAsync(50);
      
      const stats = gateway.getStats();
      expect(stats.connectedAt).not.toBeNull();
    });

    it('should notify state changes', async () => {
      const states: ConnectionState[] = [];
      gateway.onStateChange(state => states.push(state));
      
      gateway.connect();
      await vi.advanceTimersByTimeAsync(50);
      
      expect(states).toContain('connecting');
      expect(states).toContain('connected');
    });
  });

  describe('Subscription Management', () => {
    it('should subscribe to channel', async () => {
      gateway.connect();
      await vi.advanceTimersByTimeAsync(50);
      
      gateway.subscribe('test-channel');
      
      expect(gateway.isSubscribed('test-channel')).toBe(true);
      expect(gateway.getSubscriptions()).toContain('test-channel');
    });

    it('should subscribe to multiple channels', async () => {
      gateway.connect();
      await vi.advanceTimersByTimeAsync(50);
      
      gateway.subscribe(['channel-1', 'channel-2', 'channel-3']);
      
      expect(gateway.getSubscriptions()).toHaveLength(3);
    });

    it('should unsubscribe from channel', async () => {
      gateway.connect();
      await vi.advanceTimersByTimeAsync(50);
      
      gateway.subscribe('test-channel');
      gateway.unsubscribe('test-channel');
      
      expect(gateway.isSubscribed('test-channel')).toBe(false);
    });

    it('should get subscription info', async () => {
      gateway.connect();
      await vi.advanceTimersByTimeAsync(50);
      
      gateway.subscribe('test-channel');
      
      const info = gateway.getSubscriptionInfo('test-channel');
      expect(info).toBeDefined();
      expect(info?.channel).toBe('test-channel');
      expect(info?.subscribedAt).toBeInstanceOf(Date);
    });
  });

  describe('Message Handling', () => {
    it('should handle incoming messages', async () => {
      gateway.connect();
      await vi.advanceTimersByTimeAsync(50);
      
      const messages: unknown[] = [];
      gateway.onMessage('test-channel', data => messages.push(data));
      gateway.subscribe('test-channel');
      
      // 模拟接收消息
      const socket = (gateway as any).socket as MockWebSocket;
      socket.simulateMessage({
        type: 'data',
        channel: 'test-channel',
        payload: { value: 123 },
        timestamp: Date.now(),
      });
      
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ value: 123 });
    });

    it('should track message stats', async () => {
      gateway.connect();
      await vi.advanceTimersByTimeAsync(50);
      
      gateway.subscribe('test-channel');
      await vi.advanceTimersByTimeAsync(50);
      
      const stats = gateway.getStats();
      expect(stats.messagesSent).toBeGreaterThan(0);
    });
  });

  describe('Reconnection', () => {
    it('should restore subscriptions after reconnect', async () => {
      gateway.connect();
      await vi.advanceTimersByTimeAsync(50);
      
      gateway.subscribe(['channel-1', 'channel-2']);
      await vi.advanceTimersByTimeAsync(50);
      
      const originalSubs = gateway.getSubscriptions();
      
      // 断开
      gateway.disconnect();
      
      // 重连
      gateway.connect();
      await vi.advanceTimersByTimeAsync(50);
      await gateway.restoreSubscriptions();
      
      expect(gateway.getSubscriptions()).toEqual(originalSubs);
    });

    it('should track reconnect attempts', async () => {
      gateway.connect();
      await vi.advanceTimersByTimeAsync(50);
      
      gateway.disconnect();
      
      await gateway.reconnect();
      await vi.advanceTimersByTimeAsync(50);
      
      const stats = gateway.getStats();
      expect(stats.reconnectAttempts).toBe(1);
      expect(stats.totalReconnects).toBe(1);
    });
  });
});

// ============================================
// 配置验证测试
// ============================================

describe('Default Configuration Validation', () => {
  it('should have correct reconnect config', () => {
    expect(DEFAULT_RECONNECT_CONFIG.maxAttempts).toBe(10);
    expect(DEFAULT_RECONNECT_CONFIG.initialDelayMs).toBe(1000);
    expect(DEFAULT_RECONNECT_CONFIG.maxDelayMs).toBe(30000);
    expect(DEFAULT_RECONNECT_CONFIG.backoffMultiplier).toBe(1.5);
  });

  it('should have correct heartbeat config', () => {
    expect(DEFAULT_HEARTBEAT_CONFIG.intervalMs).toBe(30000);
    expect(DEFAULT_HEARTBEAT_CONFIG.timeoutMs).toBe(10000);
  });

  it('should use default config when not specified', () => {
    const gateway = new WebSocketGateway();
    const config = gateway.getConfig();
    
    expect(config.reconnect).toEqual(DEFAULT_RECONNECT_CONFIG);
    expect(config.heartbeat).toEqual(DEFAULT_HEARTBEAT_CONFIG);
    expect(config.autoReconnect).toBe(true);
  });

  it('should allow custom config', () => {
    const gateway = new WebSocketGateway({
      url: 'ws://custom.example.com',
      reconnect: { maxAttempts: 5, initialDelayMs: 500, maxDelayMs: 10000, backoffMultiplier: 2 },
      autoReconnect: false,
    });
    
    const config = gateway.getConfig();
    expect(config.url).toBe('ws://custom.example.com');
    expect(config.reconnect.maxAttempts).toBe(5);
    expect(config.autoReconnect).toBe(false);
  });
});
