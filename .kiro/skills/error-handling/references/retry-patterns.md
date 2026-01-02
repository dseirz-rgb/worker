# 重试逻辑模板

> 指数退避重试策略的完整实现指南

## 目录

- [重试策略概述](#重试策略概述)
- [指数退避算法](#指数退避算法)
- [重试条件判断](#重试条件判断)
- [实现模板](#实现模板)
- [高级模式](#高级模式)
- [最佳实践](#最佳实践)

---

## 重试策略概述

### 何时重试

| 错误类型 | 是否重试 | 原因 |
|----------|---------|------|
| 网络超时 | ✅ | 临时性网络问题 |
| 连接失败 | ✅ | 网络波动 |
| 429 限流 | ✅ | 等待后可恢复 |
| 500 服务器错误 | ✅ | 服务可能恢复 |
| 502/503/504 | ✅ | 网关/服务临时不可用 |
| 400 请求错误 | ❌ | 请求本身有问题 |
| 401 认证失败 | ❌ | 需要重新认证 |
| 403 权限不足 | ❌ | 权限问题 |
| 404 资源不存在 | ❌ | 资源确实不存在 |
| 422 验证失败 | ❌ | 数据格式问题 |

### 重试参数说明

| 参数 | 说明 | 推荐值 |
|------|------|--------|
| maxRetries | 最大重试次数 | 3-5 |
| baseDelay | 基础延迟（毫秒） | 1000 |
| maxDelay | 最大延迟（毫秒） | 30000 |
| backoffFactor | 退避因子 | 2 |
| jitter | 是否添加抖动 | true |

---

## 指数退避算法

### 基础公式

```
delay = min(baseDelay * (backoffFactor ^ attempt), maxDelay)
```

### 带抖动的公式

```
jitteredDelay = delay * (1 + random(-0.25, 0.25))
```

### 延迟计算示例

| 重试次数 | 基础延迟 | 带抖动范围 |
|----------|----------|------------|
| 1 | 1000ms | 750-1250ms |
| 2 | 2000ms | 1500-2500ms |
| 3 | 4000ms | 3000-5000ms |
| 4 | 8000ms | 6000-10000ms |
| 5 | 16000ms | 12000-20000ms |

---

## 重试条件判断

### 可重试错误判断

```typescript
// src/services/retry/conditions.ts

import { ApiError, ErrorCode } from '../api/errors';

/**
 * 可重试的错误码集合
 */
export const RETRYABLE_ERROR_CODES = new Set([
  ErrorCode.NETWORK_ERROR,
  ErrorCode.TIMEOUT,
  ErrorCode.RATE_LIMIT_EXCEEDED,
  ErrorCode.INTERNAL_ERROR,
  ErrorCode.SERVICE_UNAVAILABLE,
]);

/**
 * 可重试的 HTTP 状态码
 */
export const RETRYABLE_STATUS_CODES = new Set([
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: unknown): boolean {
  // ApiError 类型
  if (error instanceof ApiError) {
    return RETRYABLE_ERROR_CODES.has(error.code);
  }

  // HTTP 响应错误
  if (isHttpError(error)) {
    return RETRYABLE_STATUS_CODES.has(error.response.status);
  }

  // 网络错误
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('failed to fetch')
    );
  }

  // 超时错误
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  return false;
}

function isHttpError(error: unknown): error is { response: Response } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'response' in error &&
    error.response instanceof Response
  );
}
```

### 幂等性检查

```typescript
/**
 * 判断操作是否幂等（可安全重试）
 */
export function isIdempotentOperation(method: string): boolean {
  const idempotentMethods = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'];
  return idempotentMethods.includes(method.toUpperCase());
}

/**
 * 判断是否应该重试
 */
export function shouldRetry(
  error: unknown,
  attempt: number,
  config: RetryConfig,
  method: string
): boolean {
  // 超过最大重试次数
  if (attempt >= config.maxRetries) {
    return false;
  }

  // 非幂等操作默认不重试（除非明确配置）
  if (!isIdempotentOperation(method) && !config.retryNonIdempotent) {
    return false;
  }

  // 检查错误是否可重试
  if (config.retryCondition) {
    return config.retryCondition(error);
  }

  return isRetryableError(error);
}
```

---

## 实现模板

### 基础重试函数

```typescript
// src/services/retry/index.ts

export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 基础延迟（毫秒） */
  baseDelay: number;
  /** 最大延迟（毫秒） */
  maxDelay: number;
  /** 退避因子 */
  backoffFactor: number;
  /** 是否添加抖动 */
  jitter: boolean;
  /** 自定义重试条件 */
  retryCondition?: (error: unknown) => boolean;
  /** 重试回调 */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
  /** 是否重试非幂等操作 */
  retryNonIdempotent?: boolean;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  retryNonIdempotent: false,
};

/**
 * 计算重试延迟
 */
export function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  // 指数退避
  let delay = config.baseDelay * Math.pow(config.backoffFactor, attempt);

  // 限制最大延迟
  delay = Math.min(delay, config.maxDelay);

  // 添加抖动（±25%）
  if (config.jitter) {
    const jitterRange = delay * 0.25;
    delay += Math.random() * jitterRange * 2 - jitterRange;
  }

  return Math.floor(delay);
}

/**
 * 延迟执行
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试的异步函数执行器
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig: RetryConfig = { ...DEFAULT_CONFIG, ...config };
  const retryCondition = finalConfig.retryCondition || isRetryableError;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 最后一次尝试，不再重试
      if (attempt === finalConfig.maxRetries) {
        break;
      }

      // 检查是否应该重试
      if (!retryCondition(error)) {
        throw error;
      }

      // 计算延迟
      let delay: number;

      // 特殊处理速率限制
      if (error instanceof RateLimitError && error.retryAfter) {
        delay = error.retryAfter * 1000;
      } else {
        delay = calculateDelay(attempt, finalConfig);
      }

      // 回调通知
      finalConfig.onRetry?.(error, attempt + 1, delay);

      // 等待后重试
      await sleep(delay);
    }
  }

  throw lastError;
}
```

### 带取消支持的重试

```typescript
// src/services/retry/cancellable.ts

export interface CancellableRetryConfig extends RetryConfig {
  /** AbortSignal 用于取消 */
  signal?: AbortSignal;
}

/**
 * 可取消的重试执行器
 */
export async function withCancellableRetry<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  config: Partial<CancellableRetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const retryCondition = finalConfig.retryCondition || isRetryableError;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    // 检查是否已取消
    if (finalConfig.signal?.aborted) {
      throw new DOMException('操作已取消', 'AbortError');
    }

    try {
      return await fn(finalConfig.signal);
    } catch (error) {
      // 取消错误不重试
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === finalConfig.maxRetries) {
        break;
      }

      if (!retryCondition(error)) {
        throw error;
      }

      const delay = calculateDelay(attempt, finalConfig);
      finalConfig.onRetry?.(error, attempt + 1, delay);

      // 可取消的延迟
      await cancellableSleep(delay, finalConfig.signal);
    }
  }

  throw lastError;
}

/**
 * 可取消的延迟
 */
function cancellableSleep(
  ms: number,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('操作已取消', 'AbortError'));
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new DOMException('操作已取消', 'AbortError'));
    });
  });
}

// 使用示例
const controller = new AbortController();

// 5 秒后取消
setTimeout(() => controller.abort(), 5000);

try {
  const result = await withCancellableRetry(
    (signal) => fetch('/api/data', { signal }),
    { signal: controller.signal }
  );
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('请求已取消');
  }
}
```

### 类装饰器模式

```typescript
// src/services/retry/decorator.ts

/**
 * 重试装饰器
 */
export function Retry(config: Partial<RetryConfig> = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return withRetry(
        () => originalMethod.apply(this, args),
        config
      );
    };

    return descriptor;
  };
}

// 使用示例
class UserService {
  @Retry({ maxRetries: 3, baseDelay: 1000 })
  async getUser(id: string): Promise<User> {
    return api.users.get(id);
  }

  @Retry({
    maxRetries: 5,
    onRetry: (error, attempt) => {
      console.log(`重试获取用户列表 (${attempt})`);
    },
  })
  async listUsers(): Promise<User[]> {
    return api.users.list();
  }
}
```

---

## 高级模式

### 1. 带熔断器的重试

```typescript
// src/services/retry/with-circuit-breaker.ts

import { CircuitBreaker, CircuitState } from '../circuit-breaker';

/**
 * 结合熔断器的重试
 */
export async function withRetryAndCircuitBreaker<T>(
  fn: () => Promise<T>,
  circuitBreaker: CircuitBreaker,
  retryConfig: Partial<RetryConfig> = {}
): Promise<T> {
  // 先检查熔断器状态
  if (circuitBreaker.getState() === CircuitState.OPEN) {
    throw new Error('服务熔断中，请稍后重试');
  }

  return withRetry(
    async () => {
      try {
        const result = await circuitBreaker.execute(fn);
        return result;
      } catch (error) {
        // 熔断器打开时不再重试
        if (circuitBreaker.getState() === CircuitState.OPEN) {
          throw error;
        }
        throw error;
      }
    },
    retryConfig
  );
}
```

### 2. 批量重试

```typescript
// src/services/retry/batch.ts

interface BatchRetryResult<T> {
  succeeded: T[];
  failed: Array<{ item: unknown; error: Error }>;
}

/**
 * 批量操作重试
 */
export async function batchWithRetry<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  config: Partial<RetryConfig> & {
    /** 并发数 */
    concurrency?: number;
    /** 单项失败是否继续 */
    continueOnError?: boolean;
  } = {}
): Promise<BatchRetryResult<R>> {
  const { concurrency = 5, continueOnError = true, ...retryConfig } = config;

  const results: R[] = [];
  const errors: Array<{ item: T; error: Error }> = [];

  // 分批处理
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map((item) =>
        withRetry(() => processor(item), retryConfig)
      )
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const error = result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason));
        errors.push({ item: batch[j], error });

        if (!continueOnError) {
          throw error;
        }
      }
    }
  }

  return { succeeded: results, failed: errors };
}
```

### 3. 渐进式重试

```typescript
// src/services/retry/progressive.ts

interface ProgressiveRetryConfig extends RetryConfig {
  /** 重试策略升级阈值 */
  escalationThreshold: number;
  /** 升级后的配置 */
  escalatedConfig: Partial<RetryConfig>;
}

/**
 * 渐进式重试（失败次数多时升级策略）
 */
export async function withProgressiveRetry<T>(
  fn: () => Promise<T>,
  config: Partial<ProgressiveRetryConfig>
): Promise<T> {
  const {
    escalationThreshold = 2,
    escalatedConfig = { maxRetries: 5, baseDelay: 2000 },
    ...baseConfig
  } = config;

  let attempt = 0;
  let currentConfig = { ...DEFAULT_CONFIG, ...baseConfig };

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;

      // 升级重试策略
      if (attempt === escalationThreshold) {
        console.warn('[ProgressiveRetry] 升级重试策略');
        currentConfig = { ...currentConfig, ...escalatedConfig };
      }

      if (attempt > currentConfig.maxRetries) {
        throw error;
      }

      if (!isRetryableError(error)) {
        throw error;
      }

      const delay = calculateDelay(attempt - 1, currentConfig);
      currentConfig.onRetry?.(error, attempt, delay);
      await sleep(delay);
    }
  }
}
```

---

## 最佳实践

### 1. 日志记录

```typescript
const result = await withRetry(
  () => api.fetchData(),
  {
    maxRetries: 3,
    onRetry: (error, attempt, delay) => {
      console.warn(
        `[Retry] 第 ${attempt} 次重试，等待 ${delay}ms`,
        {
          error: error instanceof Error ? error.message : String(error),
          endpoint: '/api/data',
          timestamp: new Date().toISOString(),
        }
      );
    },
  }
);
```

### 2. 监控指标

```typescript
// 记录重试指标
function trackRetryMetrics(
  endpoint: string,
  attempt: number,
  success: boolean,
  error?: Error
) {
  metrics.increment('api.retry.count', {
    endpoint,
    attempt: String(attempt),
    success: String(success),
  });

  if (!success && error) {
    metrics.increment('api.retry.failure', {
      endpoint,
      errorType: error.name,
    });
  }
}
```

### 3. 测试重试逻辑

```typescript
describe('withRetry', () => {
  it('应该在临时错误后成功重试', async () => {
    let attempts = 0;
    const fn = jest.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        throw new NetworkError('连接失败');
      }
      return 'success';
    });

    const result = await withRetry(fn, { maxRetries: 3 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('不应该重试不可重试的错误', async () => {
    const fn = jest.fn().mockRejectedValue(
      new ValidationError('参数错误', {})
    );

    await expect(withRetry(fn)).rejects.toThrow(ValidationError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('应该遵守最大重试次数', async () => {
    const fn = jest.fn().mockRejectedValue(new NetworkError('失败'));

    await expect(
      withRetry(fn, { maxRetries: 3 })
    ).rejects.toThrow(NetworkError);

    expect(fn).toHaveBeenCalledTimes(4); // 1 初始 + 3 重试
  });

  it('应该使用指数退避延迟', async () => {
    const delays: number[] = [];
    const fn = jest.fn().mockRejectedValue(new NetworkError('失败'));

    await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 100,
      jitter: false,
      onRetry: (_, __, delay) => delays.push(delay),
    }).catch(() => {});

    expect(delays).toEqual([100, 200, 400]);
  });
});
```

### 4. React Query 集成

```typescript
// src/hooks/useRetryQuery.ts

import { useQuery, UseQueryOptions } from '@tanstack/react-query';

export function useRetryQuery<T>(
  queryKey: string[],
  fetcher: () => Promise<T>,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey,
    queryFn: () => withRetry(fetcher, {
      maxRetries: 3,
      onRetry: (error, attempt) => {
        console.log(`查询重试 ${attempt}:`, queryKey);
      },
    }),
    retry: false, // 使用自定义重试逻辑
    ...options,
  });
}
```
