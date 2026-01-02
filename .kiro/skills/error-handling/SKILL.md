---
name: error-handling
description: |
  错误处理技能：提供系统化的错误处理工作流、分类体系和最佳实践。
  Use when: 需要处理异常、实现重试逻辑、设计降级策略、编写错误消息。
  Triggers: "错误", "异常", "重试", "降级", "fallback", "error", "exception", "retry"
category: development
triggers:
  - 错误处理
  - 异常处理
  - 重试逻辑
  - 优雅降级
  - error handling
  - exception
  - retry
  - fallback
---

# Error Handling (错误处理)

> 🛡️ **核心理念**: 错误是程序的一部分，优雅地处理错误比避免错误更重要。

## 🔴 第一原则：永不崩溃，优雅降级

**任何错误都不应该导致整个应用崩溃！**

```
❌ 错误思路: "这个错误不应该发生，直接 throw"
✅ 正确思路: "这个错误可能发生，准备好降级方案"

❌ 错误思路: "用户看到错误信息就知道怎么做了"  
✅ 正确思路: "用户需要明确的指引和可操作的建议"
```

**处理优先级**: 预防 > 捕获 > 降级 > 通知用户

## When to Use This Skill

使用此技能当你需要：
- 设计错误处理架构
- 实现重试逻辑（指数退避）
- 编写用户友好的错误消息
- 实现优雅降级策略
- 设计结构化日志格式
- 处理 API 调用失败

## Not For / Boundaries

此技能不适用于：
- 业务逻辑验证（使用表单验证）
- 类型检查（使用 TypeScript）
- 安全漏洞处理（使用安全审计）

---

## Quick Reference

### 🎯 错误处理决策流程

```
错误发生 → 分类识别 → 可恢复? → 重试/降级 → 记录日志
                ↓
            不可恢复 → 友好提示 → 记录日志 → 上报监控
```

### 📋 错误处理检查清单

| 检查项 | 目的 |
|--------|------|
| 1. 错误是否被正确分类？ | 确定处理策略 |
| 2. 是否需要重试？ | 临时性错误可重试 |
| 3. 有没有降级方案？ | 保证基本功能可用 |
| 4. 用户消息是否友好？ | 避免技术术语 |
| 5. 日志是否完整？ | 便于问题排查 |
| 6. 是否需要上报？ | 严重错误需要告警 |

### 🔍 错误分类体系

| 类型 | 示例 | 是否重试 | 处理方式 |
|------|------|---------|----------|
| 网络错误 | 连接超时、DNS 失败 | ✅ | 指数退避重试 |
| 认证错误 | Token 过期、未授权 | ❌ | 刷新 Token 或重新登录 |
| 权限错误 | 无访问权限 | ❌ | 提示用户联系管理员 |
| 验证错误 | 参数格式错误 | ❌ | 显示具体字段错误 |
| 限流错误 | 请求过于频繁 | ✅ | 等待 Retry-After 后重试 |
| 服务器错误 | 500、503 | ✅ | 重试 + 降级 |
| 业务错误 | 余额不足、库存不足 | ❌ | 显示业务提示 |

### ✅ 错误处理最佳实践

```typescript
// ✅ 正确：分层处理，优雅降级
try {
  return await primaryService.fetch();
} catch (error) {
  if (isRetryable(error)) {
    return await withRetry(() => primaryService.fetch());
  }
  if (hasFallback) {
    return await fallbackService.fetch();
  }
  logError(error);
  throw new UserFriendlyError('服务暂时不可用，请稍后重试');
}

// ❌ 错误：直接抛出原始错误
try {
  return await service.fetch();
} catch (error) {
  throw error; // 用户看到 "TypeError: Cannot read property..."
}
```

### 🚫 禁止行为

| ❌ 禁止 | ✅ 正确 |
|--------|--------|
| 吞掉错误不处理 | 至少记录日志 |
| 显示技术错误信息 | 显示用户友好消息 |
| 所有错误都重试 | 只重试临时性错误 |
| 无限重试 | 设置最大重试次数 |
| 立即重试 | 使用指数退避 |
| 忽略错误上下文 | 保留错误链和堆栈 |

---

## 错误处理工作流

### Phase 1: 错误捕获

```typescript
// 1. 使用 try-catch 捕获同步错误
try {
  riskyOperation();
} catch (error) {
  handleError(error);
}

// 2. 使用 .catch() 捕获异步错误
asyncOperation()
  .catch(handleError);

// 3. 使用全局错误处理器
window.addEventListener('unhandledrejection', (event) => {
  handleError(event.reason);
});
```

### Phase 2: 错误分类

```typescript
function classifyError(error: unknown): ErrorCategory {
  if (error instanceof NetworkError) return 'network';
  if (error instanceof AuthError) return 'auth';
  if (error instanceof ValidationError) return 'validation';
  if (error instanceof RateLimitError) return 'rate_limit';
  if (error instanceof ServerError) return 'server';
  return 'unknown';
}
```

### Phase 3: 错误处理

```typescript
async function handleError(error: unknown): Promise<void> {
  const category = classifyError(error);
  
  switch (category) {
    case 'network':
      await handleNetworkError(error);
      break;
    case 'auth':
      await handleAuthError(error);
      break;
    case 'rate_limit':
      await handleRateLimitError(error);
      break;
    default:
      await handleUnknownError(error);
  }
}
```

### Phase 4: 用户通知

```typescript
function notifyUser(error: AppError): void {
  const message = getLocalizedMessage(error);
  const action = getSuggestedAction(error);
  
  toast.error(message, {
    action: action ? {
      label: action.label,
      onClick: action.handler,
    } : undefined,
  });
}
```

---

## Examples

### Example 1: API 调用错误处理

**Input:** "需要调用外部 API，可能会失败"

**Steps:**
1. 识别可能的错误类型
2. 实现重试逻辑
3. 准备降级方案
4. 编写用户友好消息

**Expected Output:**
```typescript
async function fetchUserData(userId: string): Promise<User> {
  try {
    return await withRetry(
      () => api.users.get(userId),
      {
        maxRetries: 3,
        baseDelay: 1000,
        retryCondition: isRetryableError,
      }
    );
  } catch (error) {
    // 降级：返回缓存数据
    const cached = await cache.get(`user:${userId}`);
    if (cached) {
      logWarning('使用缓存数据', { userId, error });
      return cached;
    }
    
    // 无法降级，抛出用户友好错误
    throw new UserFriendlyError(
      '无法获取用户信息，请检查网络连接后重试',
      { cause: error }
    );
  }
}
```

### Example 2: 表单提交错误处理

**Input:** "表单提交可能返回验证错误"

**Expected Output:**
```typescript
async function submitForm(data: FormData): Promise<Result> {
  try {
    return await api.submit(data);
  } catch (error) {
    if (error instanceof ValidationError) {
      // 显示字段级错误
      return {
        success: false,
        fieldErrors: error.fieldErrors,
      };
    }
    
    if (error instanceof ConflictError) {
      return {
        success: false,
        message: '数据已被修改，请刷新后重试',
      };
    }
    
    // 其他错误
    logError('表单提交失败', error);
    return {
      success: false,
      message: '提交失败，请稍后重试',
    };
  }
}
```

### Example 3: 批量操作错误处理

**Input:** "批量处理多个项目，部分可能失败"

**Expected Output:**
```typescript
async function batchProcess<T>(
  items: T[],
  processor: (item: T) => Promise<void>
): Promise<BatchResult> {
  const results = await Promise.allSettled(
    items.map(item => processor(item))
  );
  
  const succeeded = results.filter(r => r.status === 'fulfilled');
  const failed = results.filter(r => r.status === 'rejected');
  
  if (failed.length > 0) {
    logWarning('批量处理部分失败', {
      total: items.length,
      succeeded: succeeded.length,
      failed: failed.length,
      errors: failed.map(r => (r as PromiseRejectedResult).reason),
    });
  }
  
  return {
    total: items.length,
    succeeded: succeeded.length,
    failed: failed.length,
    message: failed.length > 0
      ? `处理完成，${failed.length} 项失败`
      : '全部处理成功',
  };
}
```

---

## References

- `references/graceful-degradation.md`: 优雅降级模式
- `references/retry-patterns.md`: 重试逻辑模板（指数退避）
- `references/message-templates.md`: 中文错误消息模板、结构化日志格式

---

## Maintenance

- **Sources**: 项目最佳实践, 社区经验总结
- **Last Updated**: 2025-01-01
- **Known Limits**: 
  - 错误分类需根据具体业务调整
  - 重试策略需考虑幂等性
