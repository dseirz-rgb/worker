/**
 * API Gateway 服务
 * 
 * 统一路由 Echo 和 RiskControl 的 API 请求
 * - /api/echo/* → Echo 后端 (Express + tRPC)
 * - /api/rc/* → RiskControl 后端 (Vercel Functions)
 * 
 * @module @echoai/shared/gateway
 */

// ============================================
// 类型定义
// ============================================

export type TargetService = 'echo' | 'riskcontrol';

export interface RouteConfig {
  pattern: string;
  target: TargetService;
  requiresAuth: boolean;
  rateLimit?: RateLimitConfig;
  timeout?: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface GatewayConfig {
  echoBaseUrl: string;
  rcBaseUrl: string;
  defaultTimeout?: number;
}

export interface GatewayHealth {
  echo: ServiceHealth;
  riskcontrol: ServiceHealth;
  timestamp: Date;
}

export interface ServiceHealth {
  available: boolean;
  latency?: number;
  lastCheck: Date;
  error?: string;
}

export interface RouteMatch {
  matched: boolean;
  target?: TargetService;
  config?: RouteConfig;
  remainingPath?: string;
}

// ============================================
// 默认路由配置
// ============================================

export const DEFAULT_ROUTES: RouteConfig[] = [
  // Echo 路由
  { pattern: '/api/echo', target: 'echo', requiresAuth: false },
  { pattern: '/api/trpc', target: 'echo', requiresAuth: false },
  { pattern: '/api/auth', target: 'echo', requiresAuth: false },
  { pattern: '/api/file', target: 'echo', requiresAuth: true },
  { pattern: '/api/rss', target: 'echo', requiresAuth: false },
  { pattern: '/api/livekit', target: 'echo', requiresAuth: true },
  { pattern: '/v1', target: 'echo', requiresAuth: true }, // OpenAI 兼容 API
  
  // RiskControl 路由
  { pattern: '/api/rc', target: 'riskcontrol', requiresAuth: true },
  { pattern: '/api/positions', target: 'riskcontrol', requiresAuth: true },
  { pattern: '/api/transactions', target: 'riskcontrol', requiresAuth: true },
  { pattern: '/api/risk', target: 'riskcontrol', requiresAuth: true },
  { pattern: '/api/watchlist', target: 'riskcontrol', requiresAuth: true },
  { pattern: '/api/dashboard', target: 'riskcontrol', requiresAuth: true },
  { pattern: '/api/alerts', target: 'riskcontrol', requiresAuth: true },
  { pattern: '/api/ibkr', target: 'riskcontrol', requiresAuth: true },
];

// ============================================
// API Gateway 类
// ============================================

export class APIGateway {
  private config: GatewayConfig;
  private routes: RouteConfig[];
  private healthCache: GatewayHealth | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: GatewayConfig, routes: RouteConfig[] = DEFAULT_ROUTES) {
    this.config = {
      defaultTimeout: 30000,
      ...config,
    };
    this.routes = routes;
  }

  /**
   * 匹配路由
   * 
   * @param path URL 路径
   * @returns 路由匹配结果
   */
  matchRoute(path: string): RouteMatch {
    // 规范化路径
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    for (const route of this.routes) {
      if (normalizedPath.startsWith(route.pattern)) {
        return {
          matched: true,
          target: route.target,
          config: route,
          remainingPath: normalizedPath.slice(route.pattern.length) || '/',
        };
      }
    }

    return { matched: false };
  }

  /**
   * 获取目标服务的基础 URL
   */
  getTargetUrl(target: TargetService): string {
    return target === 'echo' ? this.config.echoBaseUrl : this.config.rcBaseUrl;
  }

  /**
   * 构建完整的目标 URL
   */
  buildTargetUrl(path: string): string | null {
    const match = this.matchRoute(path);
    if (!match.matched || !match.target) {
      return null;
    }

    const baseUrl = this.getTargetUrl(match.target);
    return `${baseUrl}${path}`;
  }

  /**
   * 检查路由是否需要认证
   */
  requiresAuth(path: string): boolean {
    const match = this.matchRoute(path);
    return match.config?.requiresAuth ?? true;
  }

  /**
   * 获取路由的超时配置
   */
  getTimeout(path: string): number {
    const match = this.matchRoute(path);
    return match.config?.timeout ?? this.config.defaultTimeout ?? 30000;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<GatewayHealth> {
    const [echoHealth, rcHealth] = await Promise.all([
      this.checkServiceHealth('echo'),
      this.checkServiceHealth('riskcontrol'),
    ]);

    this.healthCache = {
      echo: echoHealth,
      riskcontrol: rcHealth,
      timestamp: new Date(),
    };

    return this.healthCache;
  }

  /**
   * 获取缓存的健康状态
   */
  getCachedHealth(): GatewayHealth | null {
    return this.healthCache;
  }

  /**
   * 启动定期健康检查
   */
  startHealthCheck(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // 立即执行一次
    this.healthCheck().catch(console.error);

    // 定期执行
    this.healthCheckInterval = setInterval(() => {
      this.healthCheck().catch(console.error);
    }, intervalMs);
  }

  /**
   * 停止健康检查
   */
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * 添加自定义路由
   */
  addRoute(route: RouteConfig): void {
    // 检查是否已存在相同 pattern
    const existingIndex = this.routes.findIndex(r => r.pattern === route.pattern);
    if (existingIndex >= 0) {
      this.routes[existingIndex] = route;
    } else {
      this.routes.push(route);
    }
    // 按 pattern 长度降序排序，确保更具体的路由优先匹配
    this.routes.sort((a, b) => b.pattern.length - a.pattern.length);
  }

  /**
   * 移除路由
   */
  removeRoute(pattern: string): boolean {
    const index = this.routes.findIndex(r => r.pattern === pattern);
    if (index >= 0) {
      this.routes.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 获取所有路由配置
   */
  getRoutes(): RouteConfig[] {
    return [...this.routes];
  }

  // ============================================
  // 私有方法
  // ============================================

  private async checkServiceHealth(service: TargetService): Promise<ServiceHealth> {
    const baseUrl = this.getTargetUrl(service);
    const healthEndpoint = service === 'echo' ? '/health' : '/api/health';
    const url = `${baseUrl}${healthEndpoint}`;

    const start = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return {
        available: response.ok,
        latency: Date.now() - start,
        lastCheck: new Date(),
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        available: false,
        latency: Date.now() - start,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// ============================================
// Gateway 错误类
// ============================================

export class GatewayError extends Error {
  constructor(
    public code: 'ROUTE_NOT_FOUND' | 'SERVICE_UNAVAILABLE' | 'AUTH_REQUIRED' | 'TIMEOUT' | 'PROXY_ERROR',
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

// ============================================
// Express 中间件工厂
// ============================================

export interface GatewayMiddlewareOptions {
  gateway: APIGateway;
  authValidator?: (req: any) => Promise<boolean>;
  onError?: (error: GatewayError, req: any, res: any) => void;
}

/**
 * 创建 Express 中间件
 * 用于在 Echo 后端中代理 RiskControl 请求
 */
export function createGatewayMiddleware(options: GatewayMiddlewareOptions) {
  const { gateway, authValidator, onError } = options;

  return async (req: any, res: any, next: any) => {
    const path = req.path;
    const match = gateway.matchRoute(path);

    // 如果路由不匹配或目标是 echo，继续下一个中间件
    if (!match.matched || match.target === 'echo') {
      return next();
    }

    // 检查认证
    if (match.config?.requiresAuth && authValidator) {
      const isAuthed = await authValidator(req);
      if (!isAuthed) {
        const error = new GatewayError('AUTH_REQUIRED', 'Authentication required', 401);
        if (onError) {
          return onError(error, req, res);
        }
        return res.status(401).json({ error: 'Authentication required' });
      }
    }

    // 代理请求到 RiskControl
    try {
      const targetUrl = gateway.buildTargetUrl(path);
      if (!targetUrl) {
        throw new GatewayError('ROUTE_NOT_FOUND', 'Route not found', 404);
      }

      const timeout = gateway.getTimeout(path);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          ...req.headers,
          host: new URL(targetUrl).host,
        },
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 转发响应
      res.status(response.status);
      response.headers.forEach((value, key) => {
        if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      const body = await response.text();
      res.send(body);
    } catch (error) {
      if (error instanceof GatewayError) {
        if (onError) {
          return onError(error, req, res);
        }
        return res.status(error.statusCode).json({ error: error.message });
      }

      const gatewayError = new GatewayError(
        'PROXY_ERROR',
        error instanceof Error ? error.message : 'Proxy error',
        502
      );

      if (onError) {
        return onError(gatewayError, req, res);
      }
      return res.status(502).json({ error: 'Service unavailable' });
    }
  };
}

// ============================================
// 单例导出
// ============================================

let gatewayInstance: APIGateway | null = null;

export function initGateway(config: GatewayConfig, routes?: RouteConfig[]): APIGateway {
  gatewayInstance = new APIGateway(config, routes);
  return gatewayInstance;
}

export function getGateway(): APIGateway | null {
  return gatewayInstance;
}

export default APIGateway;
