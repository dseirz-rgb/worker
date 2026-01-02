# 优雅降级模式

> 当主要功能不可用时，提供替代方案保证基本功能可用

## 目录

- [降级策略概述](#降级策略概述)
- [降级模式分类](#降级模式分类)
- [实现模板](#实现模板)
- [React 组件降级](#react-组件降级)
- [API 服务降级](#api-服务降级)
- [最佳实践](#最佳实践)

---

## 降级策略概述

### 降级决策流程

```
主服务调用 → 成功? → 返回结果
              ↓
            失败 → 有缓存? → 返回缓存（标记为陈旧）
                      ↓
                    无缓存 → 有备用服务? → 调用备用服务
                                  ↓
                                无备用 → 返回默认值/静态数据
                                          ↓
                                        无默认值 → 显示友好错误
```

### 降级级别

| 级别 | 描述 | 用户体验 |
|------|------|----------|
| L0 | 完全正常 | 100% 功能 |
| L1 | 使用缓存 | 数据可能不是最新 |
| L2 | 使用备用服务 | 功能可能受限 |
| L3 | 使用默认值 | 基本功能可用 |
| L4 | 功能不可用 | 显示友好提示 |

---

## 降级模式分类

### 1. 缓存降级

当实时数据不可用时，使用缓存数据。

```typescript
// src/services/fallback/cache-fallback.ts

interface CacheOptions {
  /** 缓存有效期（毫秒） */
  ttl: number;
  /** 是否允许使用过期缓存 */
  staleWhileRevalidate: boolean;
  /** 缓存键前缀 */
  keyPrefix?: string;
}

const DEFAULT_OPTIONS: CacheOptions = {
  ttl: 5 * 60 * 1000, // 5 分钟
  staleWhileRevalidate: true,
  keyPrefix: 'cache:',
};

/**
 * 带缓存降级的数据获取
 */
export async function withCacheFallback<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: Partial<CacheOptions> = {}
): Promise<{ data: T; isStale: boolean }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cacheKey = `${opts.keyPrefix}${key}`;

  try {
    // 尝试获取新数据
    const data = await fetcher();
    
    // 更新缓存
    await cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });
    
    return { data, isStale: false };
  } catch (error) {
    // 尝试使用缓存
    const cached = await cache.get<{ data: T; timestamp: number }>(cacheKey);
    
    if (cached) {
      const isExpired = Date.now() - cached.timestamp > opts.ttl;
      
      if (!isExpired || opts.staleWhileRevalidate) {
        console.warn(`[CacheFallback] 使用${isExpired ? '过期' : ''}缓存: ${key}`);
        return { data: cached.data, isStale: isExpired };
      }
    }
    
    // 无可用缓存
    throw error;
  }
}
```

### 2. 备用服务降级

当主服务不可用时，切换到备用服务。

```typescript
// src/services/fallback/service-fallback.ts

interface ServiceConfig<T> {
  primary: () => Promise<T>;
  fallback: () => Promise<T>;
  shouldFallback?: (error: unknown) => boolean;
  onFallback?: (error: unknown) => void;
}

/**
 * 带备用服务的调用
 */
export async function withServiceFallback<T>(
  config: ServiceConfig<T>
): Promise<T> {
  const {
    primary,
    fallback,
    shouldFallback = () => true,
    onFallback,
  } = config;

  try {
    return await primary();
  } catch (error) {
    if (!shouldFallback(error)) {
      throw error;
    }

    console.warn('[ServiceFallback] 切换到备用服务', error);
    onFallback?.(error);
    
    return fallback();
  }
}

// 使用示例
const userData = await withServiceFallback({
  primary: () => primaryApi.getUser(id),
  fallback: () => backupApi.getUser(id),
  shouldFallback: (error) => {
    // 只在服务不可用时降级
    return error instanceof ServiceUnavailableError;
  },
  onFallback: (error) => {
    // 上报监控
    monitor.report('primary_service_down', { error });
  },
});
```

### 3. 默认值降级

当无法获取数据时，返回预设的默认值。

```typescript
// src/services/fallback/default-fallback.ts

/**
 * 带默认值的数据获取
 */
export async function withDefaultFallback<T>(
  fetcher: () => Promise<T>,
  defaultValue: T,
  options: {
    logError?: boolean;
    errorMessage?: string;
  } = {}
): Promise<T> {
  const { logError = true, errorMessage } = options;

  try {
    return await fetcher();
  } catch (error) {
    if (logError) {
      console.warn(
        errorMessage || '[DefaultFallback] 使用默认值',
        error
      );
    }
    return defaultValue;
  }
}

// 使用示例
const settings = await withDefaultFallback(
  () => api.getSettings(),
  DEFAULT_SETTINGS,
  { errorMessage: '获取设置失败，使用默认配置' }
);
```

### 4. 功能降级

当某些功能不可用时，禁用相关功能。

```typescript
// src/services/fallback/feature-fallback.ts

interface FeatureStatus {
  available: boolean;
  reason?: string;
  fallbackBehavior?: string;
}

class FeatureManager {
  private features = new Map<string, FeatureStatus>();

  /**
   * 检查功能是否可用
   */
  isAvailable(feature: string): boolean {
    return this.features.get(feature)?.available ?? true;
  }

  /**
   * 标记功能不可用
   */
  markUnavailable(feature: string, reason: string): void {
    this.features.set(feature, {
      available: false,
      reason,
    });
    console.warn(`[Feature] ${feature} 已禁用: ${reason}`);
  }

  /**
   * 恢复功能
   */
  markAvailable(feature: string): void {
    this.features.set(feature, { available: true });
    console.info(`[Feature] ${feature} 已恢复`);
  }

  /**
   * 带功能检查的执行
   */
  async executeIfAvailable<T>(
    feature: string,
    fn: () => Promise<T>,
    fallback?: () => T
  ): Promise<T | undefined> {
    if (!this.isAvailable(feature)) {
      return fallback?.();
    }

    try {
      return await fn();
    } catch (error) {
      this.markUnavailable(feature, String(error));
      return fallback?.();
    }
  }
}

export const featureManager = new FeatureManager();
```

---

## 实现模板

### 通用降级包装器

```typescript
// src/services/fallback/index.ts

export interface FallbackChain<T> {
  /** 主要数据源 */
  primary: () => Promise<T>;
  /** 降级链（按优先级排序） */
  fallbacks: Array<{
    name: string;
    fn: () => Promise<T> | T;
    condition?: (error: unknown) => boolean;
  }>;
  /** 最终默认值 */
  defaultValue?: T;
  /** 回调 */
  onFallback?: (level: number, name: string, error: unknown) => void;
}

/**
 * 链式降级执行
 */
export async function executeFallbackChain<T>(
  chain: FallbackChain<T>
): Promise<{ data: T; fallbackLevel: number; fallbackName?: string }> {
  // 尝试主要数据源
  try {
    const data = await chain.primary();
    return { data, fallbackLevel: 0 };
  } catch (primaryError) {
    // 遍历降级链
    for (let i = 0; i < chain.fallbacks.length; i++) {
      const fallback = chain.fallbacks[i];
      
      // 检查降级条件
      if (fallback.condition && !fallback.condition(primaryError)) {
        continue;
      }

      try {
        const data = await fallback.fn();
        chain.onFallback?.(i + 1, fallback.name, primaryError);
        return {
          data,
          fallbackLevel: i + 1,
          fallbackName: fallback.name,
        };
      } catch {
        // 继续尝试下一个降级
        continue;
      }
    }

    // 使用默认值
    if (chain.defaultValue !== undefined) {
      chain.onFallback?.(
        chain.fallbacks.length + 1,
        'default',
        primaryError
      );
      return {
        data: chain.defaultValue,
        fallbackLevel: chain.fallbacks.length + 1,
        fallbackName: 'default',
      };
    }

    // 所有降级都失败
    throw primaryError;
  }
}

// 使用示例
const result = await executeFallbackChain({
  primary: () => api.getProducts(),
  fallbacks: [
    {
      name: 'cache',
      fn: () => cache.get('products'),
      condition: (error) => !(error instanceof AuthError),
    },
    {
      name: 'backup-api',
      fn: () => backupApi.getProducts(),
    },
    {
      name: 'static-data',
      fn: () => import('./static/products.json'),
    },
  ],
  defaultValue: [],
  onFallback: (level, name, error) => {
    console.warn(`降级到 ${name} (级别 ${level})`, error);
  },
});
```

---

## React 组件降级

### 错误边界降级

```typescript
// src/components/ErrorBoundary.tsx

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: ReactNode | ((error: Error) => ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      return typeof fallback === 'function'
        ? fallback(this.state.error!)
        : fallback;
    }

    return this.props.children;
  }
}

// 使用示例
<ErrorBoundary
  fallback={<div>组件加载失败，请刷新页面</div>}
  onError={(error) => logError('组件错误', error)}
>
  <RiskyComponent />
</ErrorBoundary>
```

### Suspense 降级

```typescript
// src/components/AsyncComponent.tsx

import { Suspense, lazy } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

const LazyComponent = lazy(() => import('./HeavyComponent'));

export function AsyncComponent() {
  return (
    <ErrorBoundary fallback={<div>加载失败</div>}>
      <Suspense fallback={<div>加载中...</div>}>
        <LazyComponent />
      </Suspense>
    </ErrorBoundary>
  );
}
```

### 数据加载降级

```typescript
// src/hooks/useDataWithFallback.ts

import { useQuery } from '@tanstack/react-query';

interface UseDataOptions<T> {
  queryKey: string[];
  fetcher: () => Promise<T>;
  fallbackData?: T;
  staleTime?: number;
}

export function useDataWithFallback<T>({
  queryKey,
  fetcher,
  fallbackData,
  staleTime = 5 * 60 * 1000,
}: UseDataOptions<T>) {
  const query = useQuery({
    queryKey,
    queryFn: fetcher,
    staleTime,
    placeholderData: fallbackData,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    data: query.data ?? fallbackData,
    isLoading: query.isLoading,
    isError: query.isError,
    isStale: query.isStale,
    isFallback: query.isError && fallbackData !== undefined,
    error: query.error,
    refetch: query.refetch,
  };
}

// 使用示例
function ProductList() {
  const { data, isLoading, isFallback } = useDataWithFallback({
    queryKey: ['products'],
    fetcher: () => api.getProducts(),
    fallbackData: STATIC_PRODUCTS,
  });

  if (isLoading) return <Skeleton />;

  return (
    <div>
      {isFallback && (
        <Banner type="warning">
          数据可能不是最新的
        </Banner>
      )}
      <ProductGrid products={data} />
    </div>
  );
}
```

---

## API 服务降级

### 多级降级服务

```typescript
// src/services/api/resilient-api.ts

export class ResilientApiService<T> {
  constructor(
    private config: {
      primary: () => Promise<T>;
      cache?: {
        get: () => Promise<T | null>;
        set: (data: T) => Promise<void>;
        ttl: number;
      };
      backup?: () => Promise<T>;
      defaultValue?: T;
    }
  ) {}

  async fetch(): Promise<{
    data: T;
    source: 'primary' | 'cache' | 'backup' | 'default';
  }> {
    // 1. 尝试主服务
    try {
      const data = await this.config.primary();
      
      // 更新缓存
      if (this.config.cache) {
        await this.config.cache.set(data).catch(() => {});
      }
      
      return { data, source: 'primary' };
    } catch (primaryError) {
      console.warn('[ResilientApi] 主服务失败', primaryError);
    }

    // 2. 尝试缓存
    if (this.config.cache) {
      try {
        const cached = await this.config.cache.get();
        if (cached) {
          return { data: cached, source: 'cache' };
        }
      } catch (cacheError) {
        console.warn('[ResilientApi] 缓存读取失败', cacheError);
      }
    }

    // 3. 尝试备用服务
    if (this.config.backup) {
      try {
        const data = await this.config.backup();
        return { data, source: 'backup' };
      } catch (backupError) {
        console.warn('[ResilientApi] 备用服务失败', backupError);
      }
    }

    // 4. 返回默认值
    if (this.config.defaultValue !== undefined) {
      return { data: this.config.defaultValue, source: 'default' };
    }

    throw new Error('所有数据源都不可用');
  }
}
```

---

## 最佳实践

### 1. 降级透明度

```typescript
// 告知用户当前处于降级状态
interface DataResponse<T> {
  data: T;
  meta: {
    source: 'live' | 'cache' | 'fallback';
    timestamp?: Date;
    message?: string;
  };
}

// UI 中显示降级状态
{meta.source !== 'live' && (
  <Alert variant="warning">
    {meta.source === 'cache' 
      ? `数据更新于 ${formatTime(meta.timestamp)}`
      : '当前显示的是离线数据'}
  </Alert>
)}
```

### 2. 降级监控

```typescript
// 记录降级事件
function trackFallback(event: {
  feature: string;
  level: number;
  reason: string;
}) {
  analytics.track('feature_degraded', event);
  
  // 严重降级告警
  if (event.level >= 3) {
    alerting.notify({
      severity: 'warning',
      message: `${event.feature} 降级到级别 ${event.level}`,
    });
  }
}
```

### 3. 降级恢复

```typescript
// 定期检查服务恢复
class ServiceHealthChecker {
  private checkInterval: NodeJS.Timer | null = null;

  startMonitoring(
    healthCheck: () => Promise<boolean>,
    onRecover: () => void,
    interval = 30000
  ) {
    this.checkInterval = setInterval(async () => {
      try {
        const isHealthy = await healthCheck();
        if (isHealthy) {
          onRecover();
          this.stopMonitoring();
        }
      } catch {
        // 继续监控
      }
    }, interval);
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}
```

### 4. 降级测试

```typescript
// 测试降级场景
describe('ProductService 降级', () => {
  it('主服务失败时应使用缓存', async () => {
    // 模拟主服务失败
    mockPrimaryApi.mockRejectedValue(new Error('Service down'));
    mockCache.get.mockResolvedValue(CACHED_PRODUCTS);

    const result = await productService.fetch();

    expect(result.source).toBe('cache');
    expect(result.data).toEqual(CACHED_PRODUCTS);
  });

  it('所有服务失败时应返回默认值', async () => {
    mockPrimaryApi.mockRejectedValue(new Error('Primary down'));
    mockCache.get.mockResolvedValue(null);
    mockBackupApi.mockRejectedValue(new Error('Backup down'));

    const result = await productService.fetch();

    expect(result.source).toBe('default');
    expect(result.data).toEqual(DEFAULT_PRODUCTS);
  });
});
```
