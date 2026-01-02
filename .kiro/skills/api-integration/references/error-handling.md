# API 错误处理模式

> 🛡️ 完整的 API 错误处理策略和代码模板

## 目录

1. [错误分类体系](#错误分类体系)
2. [自定义错误类](#自定义错误类)
3. [错误处理策略](#错误处理策略)
4. [重试策略](#重试策略)
5. [降级方案](#降级方案)
6. [用户友好错误](#用户友好错误)

---

## 错误分类体系

### HTTP 状态码分类

| 状态码范围 | 类型 | 是否重试 | 处理策略 |
|-----------|------|---------|----------|
| 400 | 请求错误 | ❌ | 检查请求参数 |
| 401 | 未认证 | ❌ | 刷新 token 或重新登录 |
| 403 | 无权限 | ❌ | 提示权限不足 |
| 404 | 资源不存在 | ❌ | 返回 null 或提示 |
| 409 | 冲突 | ❌ | 提示资源冲突 |
| 422 | 验证失败 | ❌ | 显示验证错误 |
| 429 | 速率限制 | ✅ | 等待后重试 |
| 500 | 服务器错误 | ✅ | 指数退避重试 |
| 502 | 网关错误 | ✅ | 指数退避重试 |
| 503 | 服务不可用 | ✅ | 指数退避重试 |
| 504 | 网关超时 | ✅ | 指数退避重试 |

### 错误来源分类

```typescript
enum ErrorSource {
  NETWORK = 'network',      // 网络层错误
  CLIENT = 'client',        // 客户端错误 (4xx)
  SERVER = 'server',        // 服务器错误 (5xx)
  TIMEOUT = 'timeout',      // 超时错误
  PARSE = 'parse',          // 响应解析错误
  VALIDATION = 'validation' // 数据验证错误
}
```


---

## 自定义错误类

### 基础错误类

```typescript
// errors/apiErrors.ts

/**
 * API 错误基类
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly retryable: boolean = false,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    
    // 保持正确的原型链
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      retryable: this.retryable,
      details: this.details,
    };
  }
}

/**
 * 网络错误
 */
export class NetworkError extends ApiError {
  constructor(message: string = '网络连接失败') {
    super(message, 0, 'NETWORK_ERROR', true);
    this.name = 'NetworkError';
  }
}

/**
 * 超时错误
 */
export class TimeoutError extends ApiError {
  constructor(public readonly timeoutMs: number) {
    super(`请求超时 (${timeoutMs}ms)`, 0, 'TIMEOUT', true);
    this.name = 'TimeoutError';
  }
}

/**
 * 认证错误
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = '认证失败，请重新登录') {
    super(message, 401, 'AUTHENTICATION_FAILED', false);
    this.name = 'AuthenticationError';
  }
}

/**
 * 授权错误
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = '权限不足') {
    super(message, 403, 'AUTHORIZATION_FAILED', false);
    this.name = 'AuthorizationError';
  }
}

/**
 * 资源不存在错误
 */
export class NotFoundError extends ApiError {
  constructor(resource: string = '资源') {
    super(`${resource}不存在`, 404, 'NOT_FOUND', false);
    this.name = 'NotFoundError';
  }
}

/**
 * 速率限制错误
 */
export class RateLimitError extends ApiError {
  constructor(public readonly retryAfter: number) {
    super(`请求过于频繁，请 ${retryAfter} 秒后重试`, 429, 'RATE_LIMITED', true);
    this.name = 'RateLimitError';
  }
}

/**
 * 验证错误
 */
export class ValidationError extends ApiError {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string[]>
  ) {
    super(message, 422, 'VALIDATION_FAILED', false, { fieldErrors });
    this.name = 'ValidationError';
  }
}

/**
 * 服务器错误
 */
export class ServerError extends ApiError {
  constructor(message: string = '服务器内部错误', statusCode: number = 500) {
    super(message, statusCode, 'SERVER_ERROR', true);
    this.name = 'ServerError';
  }
}
```


---

## 错误处理策略

### 错误转换器

```typescript
// errors/errorTransformer.ts

import {
  ApiError,
  NetworkError,
  TimeoutError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  ServerError,
} from './apiErrors';

interface RawErrorResponse {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
    fieldErrors?: Record<string, string[]>;
  };
}

/**
 * 将原始错误转换为类型化的 API 错误
 */
export function transformError(error: unknown): ApiError {
  // 已经是 ApiError
  if (error instanceof ApiError) {
    return error;
  }

  // 网络错误
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new NetworkError();
  }

  // Axios 错误
  if (isAxiosError(error)) {
    return transformAxiosError(error);
  }

  // ky 错误
  if (isKyError(error)) {
    return transformKyError(error);
  }

  // 未知错误
  return new ApiError(
    error instanceof Error ? error.message : '未知错误',
    0,
    'UNKNOWN_ERROR',
    false
  );
}

function transformAxiosError(error: AxiosError): ApiError {
  const response = error.response;
  const data = response?.data as RawErrorResponse | undefined;

  if (!response) {
    if (error.code === 'ECONNABORTED') {
      return new TimeoutError(error.config?.timeout ?? 0);
    }
    return new NetworkError();
  }

  return createErrorFromStatus(
    response.status,
    data?.error?.message,
    data?.error?.code,
    data?.error?.fieldErrors,
    response.headers
  );
}

function createErrorFromStatus(
  status: number,
  message?: string,
  code?: string,
  fieldErrors?: Record<string, string[]>,
  headers?: Record<string, string>
): ApiError {
  switch (status) {
    case 401:
      return new AuthenticationError(message);
    case 403:
      return new AuthorizationError(message);
    case 404:
      return new NotFoundError();
    case 422:
      return new ValidationError(message ?? '验证失败', fieldErrors ?? {});
    case 429:
      const retryAfter = parseInt(headers?.['retry-after'] ?? '60', 10);
      return new RateLimitError(retryAfter);
    default:
      if (status >= 500) {
        return new ServerError(message, status);
      }
      return new ApiError(message ?? `HTTP ${status}`, status, code ?? 'HTTP_ERROR', false);
  }
}
```

### 全局错误处理器

```typescript
// errors/globalErrorHandler.ts

import { ApiError, AuthenticationError, RateLimitError } from './apiErrors';

type ErrorHandler = (error: ApiError) => void;

const errorHandlers: Map<string, ErrorHandler> = new Map();

/**
 * 注册错误处理器
 */
export function registerErrorHandler(errorType: string, handler: ErrorHandler) {
  errorHandlers.set(errorType, handler);
}

/**
 * 处理 API 错误
 */
export function handleApiError(error: ApiError): void {
  // 特定错误类型处理
  const handler = errorHandlers.get(error.name);
  if (handler) {
    handler(error);
    return;
  }

  // 默认处理
  console.error('[API Error]', error.toJSON());
  
  // 显示用户友好的错误提示
  showErrorToast(error.message);
}

// 注册默认处理器
registerErrorHandler('AuthenticationError', (error) => {
  // 清除本地 token
  localStorage.removeItem('token');
  // 跳转到登录页
  window.location.href = '/login';
});

registerErrorHandler('RateLimitError', (error) => {
  const rateLimitError = error as RateLimitError;
  showErrorToast(`请求过于频繁，请 ${rateLimitError.retryAfter} 秒后重试`);
});
```


---

## 重试策略

### 指数退避重试

```typescript
// utils/retry.ts

import pRetry, { type Options as RetryOptions } from 'p-retry';
import { ApiError, RateLimitError } from '@/errors/apiErrors';

interface RetryConfig {
  maxRetries?: number;
  minTimeout?: number;
  maxTimeout?: number;
  factor?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

const defaultConfig: RetryConfig = {
  maxRetries: 3,
  minTimeout: 1000,
  maxTimeout: 30000,
  factor: 2,
};

/**
 * 带重试的异步操作执行器
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const mergedConfig = { ...defaultConfig, ...config };

  return pRetry(operation, {
    retries: mergedConfig.maxRetries,
    minTimeout: mergedConfig.minTimeout,
    maxTimeout: mergedConfig.maxTimeout,
    factor: mergedConfig.factor,
    
    onFailedAttempt: (error) => {
      console.log(
        `[Retry] 第 ${error.attemptNumber} 次尝试失败，` +
        `剩余 ${error.retriesLeft} 次重试机会`
      );
      mergedConfig.onRetry?.(error, error.attemptNumber);
    },

    shouldRetry: (error) => {
      // 只重试可重试的错误
      if (error instanceof ApiError) {
        return error.retryable;
      }
      // 网络错误总是重试
      return error.name === 'TypeError' || error.message.includes('network');
    },
  });
}

/**
 * 处理速率限制的重试
 */
export async function withRateLimitRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (error instanceof RateLimitError) {
        console.log(`[Rate Limit] 等待 ${error.retryAfter} 秒后重试...`);
        await sleep(error.retryAfter * 1000);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### 断路器模式

```typescript
// utils/circuitBreaker.ts

enum CircuitState {
  CLOSED = 'closed',     // 正常状态
  OPEN = 'open',         // 熔断状态
  HALF_OPEN = 'half_open' // 半开状态
}

interface CircuitBreakerConfig {
  failureThreshold: number;  // 失败阈值
  resetTimeout: number;      // 重置超时 (ms)
  halfOpenRequests: number;  // 半开状态允许的请求数
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenSuccesses: number = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenSuccesses = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.config.halfOpenRequests) {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
```


---

## 降级方案

### 缓存降级

```typescript
// utils/fallback.ts

import { ApiError } from '@/errors/apiErrors';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * 带缓存降级的 API 调用
 */
export async function withCacheFallback<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { ttl?: number; staleTtl?: number } = {}
): Promise<T> {
  const { ttl = 5 * 60 * 1000, staleTtl = 30 * 60 * 1000 } = options;

  try {
    const data = await fetcher();
    
    // 更新缓存
    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
    
    return data;
  } catch (error) {
    // 尝试使用缓存
    const cached = cache.get(key) as CacheEntry<T> | undefined;
    
    if (cached) {
      const age = Date.now() - cached.timestamp;
      
      // 缓存未过期
      if (age < cached.ttl) {
        return cached.data;
      }
      
      // 缓存已过期但在容忍范围内（降级使用）
      if (age < staleTtl) {
        console.warn(`[Fallback] 使用过期缓存: ${key}`);
        return cached.data;
      }
    }
    
    throw error;
  }
}
```

### 多源降级

```typescript
// utils/multiSourceFallback.ts

type DataSource<T> = () => Promise<T>;

/**
 * 多数据源降级
 */
export async function withMultiSourceFallback<T>(
  sources: DataSource<T>[],
  options: { timeout?: number } = {}
): Promise<T> {
  const { timeout = 5000 } = options;
  let lastError: Error | null = null;

  for (const source of sources) {
    try {
      const result = await Promise.race([
        source(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        ),
      ]);
      return result;
    } catch (error) {
      lastError = error as Error;
      console.warn(`[Fallback] 数据源失败，尝试下一个...`);
      continue;
    }
  }

  throw lastError ?? new Error('所有数据源都失败了');
}

// 使用示例
const data = await withMultiSourceFallback([
  () => primaryApi.getData(),
  () => backupApi.getData(),
  () => localCache.getData(),
]);
```

---

## 用户友好错误

### 错误消息映射

```typescript
// utils/errorMessages.ts

const errorMessages: Record<string, string> = {
  // 网络错误
  NETWORK_ERROR: '网络连接失败，请检查网络后重试',
  TIMEOUT: '请求超时，请稍后重试',
  
  // 认证错误
  AUTHENTICATION_FAILED: '登录已过期，请重新登录',
  AUTHORIZATION_FAILED: '您没有权限执行此操作',
  
  // 业务错误
  NOT_FOUND: '请求的资源不存在',
  VALIDATION_FAILED: '输入数据有误，请检查后重试',
  RATE_LIMITED: '操作过于频繁，请稍后重试',
  
  // 服务器错误
  SERVER_ERROR: '服务器开小差了，请稍后重试',
  SERVICE_UNAVAILABLE: '服务暂时不可用，请稍后重试',
  
  // 默认
  UNKNOWN_ERROR: '发生未知错误，请稍后重试',
};

/**
 * 获取用户友好的错误消息
 */
export function getUserFriendlyMessage(error: ApiError): string {
  return errorMessages[error.code] ?? error.message ?? errorMessages.UNKNOWN_ERROR;
}
```

### React 错误边界

```typescript
// components/ApiErrorBoundary.tsx

import { Component, type ReactNode } from 'react';
import { ApiError } from '@/errors/apiErrors';
import { getUserFriendlyMessage } from '@/utils/errorMessages';

interface Props {
  children: ReactNode;
  fallback?: (error: ApiError, retry: () => void) => ReactNode;
}

interface State {
  error: ApiError | null;
}

export class ApiErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    if (error instanceof ApiError) {
      return { error };
    }
    return { error: new ApiError(error.message, 0, 'UNKNOWN_ERROR') };
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      if (fallback) {
        return fallback(error, this.retry);
      }

      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-red-800 font-medium">出错了</h3>
          <p className="text-red-600 mt-1">{getUserFriendlyMessage(error)}</p>
          {error.retryable && (
            <button
              onClick={this.retry}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              重试
            </button>
          )}
        </div>
      );
    }

    return children;
  }
}
```

### Toast 通知集成

```typescript
// utils/errorToast.ts

import { toast } from 'sonner'; // 或其他 toast 库
import { ApiError } from '@/errors/apiErrors';
import { getUserFriendlyMessage } from './errorMessages';

/**
 * 显示 API 错误 Toast
 */
export function showApiErrorToast(error: ApiError): void {
  const message = getUserFriendlyMessage(error);

  if (error.retryable) {
    toast.error(message, {
      action: {
        label: '重试',
        onClick: () => {
          // 触发重试逻辑
          window.dispatchEvent(new CustomEvent('api-retry', { detail: error }));
        },
      },
    });
  } else {
    toast.error(message);
  }
}
```

---

## 最佳实践总结

### ✅ 推荐做法

1. **统一错误处理**: 在 API 客户端层统一处理，不要在每个调用点重复
2. **类型化错误**: 使用自定义错误类，便于区分和处理
3. **智能重试**: 只对可重试的错误进行重试
4. **优雅降级**: 准备缓存和备用数据源
5. **用户友好**: 将技术错误转换为用户能理解的消息

### ❌ 避免做法

1. **吞掉错误**: 不要 `catch` 后什么都不做
2. **暴露技术细节**: 不要把堆栈信息展示给用户
3. **无限重试**: 设置最大重试次数
4. **忽略速率限制**: 遵守 API 的速率限制
5. **硬编码错误消息**: 使用映射表便于维护和国际化
