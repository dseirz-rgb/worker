/**
 * WebSocket Gateway 服务
 * 
 * 管理 WebSocket 连接、订阅和自动重连
 * - 自动重连（指数退避）
 * - 心跳机制
 * - 订阅状态恢复
 * 
 * **Validates: Requirements 33.1, 33.2, 33.3, 33.4**
 * 
 * @module @echoai/shared/websocket
 */

// ============================================
// 类型定义
// ============================================

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export type MessageType = 
  | 'subscribe'
  | 'unsubscribe'
  | 'ping'
  | 'pong'
  | 'data'
  | 'error'
  | 'ack';

export interface WebSocketMessage {
  type: MessageType;
  channel?: string;
  payload?: unknown;
  timestamp: number;
  id?: string;
}

export interface SubscriptionInfo {
  channel: string;
  subscribedAt: Date;
  lastMessageAt: Date | null;
}

export interface ReconnectConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface HeartbeatConfig {
  intervalMs: number;
  timeoutMs: number;
}

export interface WebSocketGatewayConfig {
  url: string;
  reconnect: ReconnectConfig;
  heartbeat: HeartbeatConfig;
  autoReconnect: boolean;
}

export interface ConnectionStats {
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  reconnectAttempts: number;
  totalReconnects: number;
  messagesReceived: number;
  messagesSent: number;
}

// ============================================
// 默认配置
// ============================================

/**
 * 默认重连配置
 * **Validates: Requirements 33.1, 33.4**
 */
export const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxAttempts: 10,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 1.5,
};

/**
 * 默认心跳配置
 */
export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  intervalMs: 30000,  // 30 秒
  timeoutMs: 10000,   // 10 秒超时
};

// ============================================
// WebSocket Gateway
// ============================================

export class WebSocketGateway {
  private config: WebSocketGatewayConfig;
  private socket: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private subscriptions: Map<string, SubscriptionInfo> = new Map();
  private pendingSubscriptions: Set<string> = new Set();
  private reconnectAttempt: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPongAt: Date | null = null;
  private stats: ConnectionStats = {
    connectedAt: null,
    disconnectedAt: null,
    reconnectAttempts: 0,
    totalReconnects: 0,
    messagesReceived: 0,
    messagesSent: 0,
  };
  private messageHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
  private stateChangeHandlers: Set<(state: ConnectionState) => void> = new Set();

  constructor(config: Partial<WebSocketGatewayConfig> = {}) {
    this.config = {
      url: config.url || 'ws://localhost:8080',
      reconnect: { ...DEFAULT_RECONNECT_CONFIG, ...config.reconnect },
      heartbeat: { ...DEFAULT_HEARTBEAT_CONFIG, ...config.heartbeat },
      autoReconnect: config.autoReconnect ?? true,
    };
  }

  // ============================================
  // 连接管理
  // ============================================

  /**
   * 连接到 WebSocket 服务器
   */
  async connect(): Promise<boolean> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return this.state === 'connected';
    }

    this.setState('connecting');

    return new Promise((resolve) => {
      try {
        this.socket = this.createSocket();

        this.socket.onopen = () => {
          this.handleOpen();
          resolve(true);
        };

        this.socket.onerror = () => {
          this.handleError();
          resolve(false);
        };

        this.socket.onclose = (event) => {
          this.handleClose(event);
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event);
        };
      } catch {
        this.setState('disconnected');
        resolve(false);
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.clearTimers();
    
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }

    this.setState('disconnected');
    this.stats.disconnectedAt = new Date();
  }

  /**
   * 重新连接
   * 
   * **Property 8: WebSocket 订阅恢复**
   * **Validates: Requirements 33.2, 33.3**
   */
  async reconnect(): Promise<boolean> {
    if (this.state === 'reconnecting') {
      return false;
    }

    this.setState('reconnecting');
    this.reconnectAttempt++;
    this.stats.reconnectAttempts++;

    const connected = await this.connect();

    if (connected) {
      // 恢复订阅
      await this.restoreSubscriptions();
      this.reconnectAttempt = 0;
      this.stats.totalReconnects++;
      return true;
    }

    return false;
  }

  /**
   * 恢复所有订阅
   * 
   * **Property 8: WebSocket 订阅恢复**
   * **Validates: Requirements 33.2, 33.3**
   */
  async restoreSubscriptions(): Promise<void> {
    const channels = Array.from(this.subscriptions.keys());
    
    for (const channel of channels) {
      await this.sendSubscribe(channel);
    }
  }

  // ============================================
  // 订阅管理
  // ============================================

  /**
   * 订阅频道
   */
  subscribe(channels: string | string[]): void {
    const channelList = Array.isArray(channels) ? channels : [channels];

    for (const channel of channelList) {
      if (this.subscriptions.has(channel)) {
        continue;
      }

      this.subscriptions.set(channel, {
        channel,
        subscribedAt: new Date(),
        lastMessageAt: null,
      });

      if (this.state === 'connected') {
        this.sendSubscribe(channel);
      } else {
        this.pendingSubscriptions.add(channel);
      }
    }
  }

  /**
   * 取消订阅
   */
  unsubscribe(channels: string | string[]): void {
    const channelList = Array.isArray(channels) ? channels : [channels];

    for (const channel of channelList) {
      this.subscriptions.delete(channel);
      this.pendingSubscriptions.delete(channel);

      if (this.state === 'connected') {
        this.sendUnsubscribe(channel);
      }
    }
  }

  /**
   * 获取当前订阅列表
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * 获取订阅详情
   */
  getSubscriptionInfo(channel: string): SubscriptionInfo | undefined {
    return this.subscriptions.get(channel);
  }

  /**
   * 检查是否已订阅
   */
  isSubscribed(channel: string): boolean {
    return this.subscriptions.has(channel);
  }

  // ============================================
  // 消息处理
  // ============================================

  /**
   * 添加消息处理器
   */
  onMessage(channel: string, handler: (data: unknown) => void): () => void {
    if (!this.messageHandlers.has(channel)) {
      this.messageHandlers.set(channel, new Set());
    }
    this.messageHandlers.get(channel)!.add(handler);

    // 返回取消订阅函数
    return () => {
      this.messageHandlers.get(channel)?.delete(handler);
    };
  }

  /**
   * 添加状态变化处理器
   */
  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateChangeHandlers.add(handler);
    return () => {
      this.stateChangeHandlers.delete(handler);
    };
  }

  /**
   * 发送消息
   */
  send(message: Omit<WebSocketMessage, 'timestamp'>): boolean {
    if (this.state !== 'connected' || !this.socket) {
      return false;
    }

    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: Date.now(),
    };

    try {
      this.socket.send(JSON.stringify(fullMessage));
      this.stats.messagesSent++;
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // 状态查询
  // ============================================

  /**
   * 获取连接状态
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * 获取连接统计
   */
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * 获取配置
   */
  getConfig(): WebSocketGatewayConfig {
    return { ...this.config };
  }

  // ============================================
  // 私有方法
  // ============================================

  private createSocket(): WebSocket {
    // 在测试环境中，可能需要 mock
    if (typeof WebSocket === 'undefined') {
      throw new Error('WebSocket not available');
    }
    return new WebSocket(this.config.url);
  }

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.stateChangeHandlers.forEach(handler => handler(state));
    }
  }

  private handleOpen(): void {
    this.setState('connected');
    this.stats.connectedAt = new Date();
    this.reconnectAttempt = 0;

    // 发送待处理的订阅
    for (const channel of this.pendingSubscriptions) {
      this.sendSubscribe(channel);
    }
    this.pendingSubscriptions.clear();

    // 启动心跳
    this.startHeartbeat();
  }

  private handleClose(event: CloseEvent): void {
    this.clearTimers();
    this.stats.disconnectedAt = new Date();

    // 非正常关闭且启用自动重连
    if (event.code !== 1000 && this.config.autoReconnect) {
      this.scheduleReconnect();
    } else {
      this.setState('disconnected');
    }
  }

  private handleError(): void {
    // 错误通常会触发 close 事件，这里只记录
    console.error('WebSocket error occurred');
  }

  private handleMessage(event: MessageEvent): void {
    this.stats.messagesReceived++;

    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'pong':
          this.handlePong();
          break;
        case 'data':
          this.handleDataMessage(message);
          break;
        case 'ack':
          // 订阅确认
          break;
        case 'error':
          console.error('WebSocket server error:', message.payload);
          break;
      }
    } catch {
      console.error('Failed to parse WebSocket message');
    }
  }

  private handleDataMessage(message: WebSocketMessage): void {
    if (message.channel) {
      const handlers = this.messageHandlers.get(message.channel);
      if (handlers) {
        handlers.forEach(handler => handler(message.payload));
      }

      // 更新订阅信息
      const sub = this.subscriptions.get(message.channel);
      if (sub) {
        sub.lastMessageAt = new Date();
      }
    }
  }

  private handlePong(): void {
    this.lastPongAt = new Date();
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private sendSubscribe(channel: string): void {
    this.send({
      type: 'subscribe',
      channel,
    });
  }

  private sendUnsubscribe(channel: string): void {
    this.send({
      type: 'unsubscribe',
      channel,
    });
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendPing();
    }, this.config.heartbeat.intervalMs);
  }

  private sendPing(): void {
    const sent = this.send({ type: 'ping' });
    
    if (sent) {
      // 设置超时检测
      this.heartbeatTimeoutTimer = setTimeout(() => {
        // 心跳超时，触发重连
        console.warn('Heartbeat timeout, reconnecting...');
        this.socket?.close(4000, 'Heartbeat timeout');
      }, this.config.heartbeat.timeoutMs);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= this.config.reconnect.maxAttempts) {
      this.setState('disconnected');
      return;
    }

    this.setState('reconnecting');

    // 计算延迟（指数退避）
    const delay = Math.min(
      this.config.reconnect.initialDelayMs * 
        Math.pow(this.config.reconnect.backoffMultiplier, this.reconnectAttempt),
      this.config.reconnect.maxDelayMs
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnect();
    }, delay);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }
}

// ============================================
// 错误类
// ============================================

export class WebSocketError extends Error {
  constructor(
    public code: 'CONNECTION_FAILED' | 'SEND_FAILED' | 'TIMEOUT' | 'INVALID_MESSAGE',
    message: string
  ) {
    super(message);
    this.name = 'WebSocketError';
  }
}

// ============================================
// 单例导出
// ============================================

let gatewayInstance: WebSocketGateway | null = null;

export function initWebSocketGateway(config?: Partial<WebSocketGatewayConfig>): WebSocketGateway {
  gatewayInstance = new WebSocketGateway(config);
  return gatewayInstance;
}

export function getWebSocketGateway(): WebSocketGateway | null {
  return gatewayInstance;
}

export default WebSocketGateway;
