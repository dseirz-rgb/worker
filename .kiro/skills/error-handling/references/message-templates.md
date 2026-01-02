# 错误消息模板

> 中文错误消息模板和结构化日志格式指南

## 目录

- [错误消息设计原则](#错误消息设计原则)
- [用户友好消息模板](#用户友好消息模板)
- [结构化日志格式](#结构化日志格式)
- [错误码体系](#错误码体系)
- [国际化支持](#国际化支持)

---

## 错误消息设计原则

### 用户消息三要素

1. **说明发生了什么** - 简洁描述问题
2. **解释为什么发生** - 可能的原因（可选）
3. **建议如何解决** - 可操作的下一步

### 消息风格指南

| ❌ 避免 | ✅ 推荐 |
|--------|--------|
| Error: ECONNREFUSED | 网络连接失败，请检查网络设置 |
| 500 Internal Server Error | 服务暂时不可用，请稍后重试 |
| Invalid token | 登录已过期，请重新登录 |
| Validation failed | 请检查输入内容是否正确 |
| null pointer exception | 操作失败，请刷新页面重试 |
| Permission denied | 您没有权限执行此操作 |

### 语气要求

- **友好**: 不要责怪用户
- **简洁**: 避免技术术语
- **有帮助**: 提供解决方案
- **诚实**: 不要隐瞒问题

---

## 用户友好消息模板

### 网络错误

```typescript
// src/constants/error-messages.ts

export const NETWORK_ERRORS = {
  // 连接失败
  CONNECTION_FAILED: {
    title: '网络连接失败',
    message: '无法连接到服务器，请检查网络设置后重试',
    action: '重试',
  },

  // 请求超时
  TIMEOUT: {
    title: '请求超时',
    message: '服务器响应时间过长，请稍后重试',
    action: '重试',
  },

  // DNS 解析失败
  DNS_FAILED: {
    title: '无法访问服务器',
    message: '请检查网络连接是否正常',
    action: '检查网络',
  },

  // 离线状态
  OFFLINE: {
    title: '网络已断开',
    message: '请连接网络后重试',
    action: '刷新',
  },
} as const;
```

### 认证错误

```typescript
export const AUTH_ERRORS = {
  // 未登录
  UNAUTHORIZED: {
    title: '请先登录',
    message: '您需要登录后才能执行此操作',
    action: '去登录',
  },

  // 登录过期
  SESSION_EXPIRED: {
    title: '登录已过期',
    message: '为了您的账户安全，请重新登录',
    action: '重新登录',
  },

  // Token 无效
  INVALID_TOKEN: {
    title: '认证失败',
    message: '登录信息无效，请重新登录',
    action: '重新登录',
  },

  // 登录失败
  LOGIN_FAILED: {
    title: '登录失败',
    message: '用户名或密码错误，请重试',
    action: '重试',
  },

  // 账户被锁定
  ACCOUNT_LOCKED: {
    title: '账户已锁定',
    message: '由于多次登录失败，账户已被临时锁定，请 {minutes} 分钟后重试',
    action: '联系客服',
  },
} as const;
```

### 权限错误

```typescript
export const PERMISSION_ERRORS = {
  // 无权限
  FORBIDDEN: {
    title: '没有权限',
    message: '您没有权限执行此操作',
    action: '返回',
  },

  // 需要升级
  UPGRADE_REQUIRED: {
    title: '功能受限',
    message: '此功能需要升级到高级版本',
    action: '了解更多',
  },

  // 资源受限
  RESOURCE_LIMIT: {
    title: '已达上限',
    message: '您已达到当前套餐的使用上限',
    action: '升级套餐',
  },
} as const;
```

### 验证错误

```typescript
export const VALIDATION_ERRORS = {
  // 通用验证失败
  INVALID_INPUT: {
    title: '输入有误',
    message: '请检查输入内容是否正确',
  },

  // 必填字段
  REQUIRED_FIELD: {
    message: '{field} 不能为空',
  },

  // 格式错误
  INVALID_FORMAT: {
    message: '{field} 格式不正确',
  },

  // 长度限制
  LENGTH_LIMIT: {
    message: '{field} 长度应在 {min} 到 {max} 个字符之间',
  },

  // 数值范围
  NUMBER_RANGE: {
    message: '{field} 应在 {min} 到 {max} 之间',
  },

  // 邮箱格式
  INVALID_EMAIL: {
    message: '请输入有效的邮箱地址',
  },

  // 手机号格式
  INVALID_PHONE: {
    message: '请输入有效的手机号码',
  },

  // 密码强度
  WEAK_PASSWORD: {
    message: '密码强度不够，请包含字母、数字和特殊字符',
  },

  // 确认密码不匹配
  PASSWORD_MISMATCH: {
    message: '两次输入的密码不一致',
  },
} as const;
```

### 业务错误

```typescript
export const BUSINESS_ERRORS = {
  // 资源不存在
  NOT_FOUND: {
    title: '内容不存在',
    message: '您访问的内容不存在或已被删除',
    action: '返回首页',
  },

  // 资源已存在
  ALREADY_EXISTS: {
    title: '已存在',
    message: '{resource} 已存在，请使用其他名称',
  },

  // 操作冲突
  CONFLICT: {
    title: '操作冲突',
    message: '数据已被其他人修改，请刷新后重试',
    action: '刷新',
  },

  // 余额不足
  INSUFFICIENT_BALANCE: {
    title: '余额不足',
    message: '您的账户余额不足，请充值后重试',
    action: '去充值',
  },

  // 库存不足
  OUT_OF_STOCK: {
    title: '库存不足',
    message: '商品库存不足，请调整数量或选择其他商品',
  },

  // 操作频繁
  RATE_LIMITED: {
    title: '操作太频繁',
    message: '请稍后再试',
    retryAfter: '{seconds} 秒后可重试',
  },
} as const;
```

### 服务器错误

```typescript
export const SERVER_ERRORS = {
  // 服务器错误
  INTERNAL_ERROR: {
    title: '服务异常',
    message: '服务器开小差了，请稍后重试',
    action: '重试',
  },

  // 服务不可用
  SERVICE_UNAVAILABLE: {
    title: '服务暂不可用',
    message: '系统正在维护中，请稍后访问',
    action: '刷新',
  },

  // 网关错误
  BAD_GATEWAY: {
    title: '服务异常',
    message: '服务器连接失败，请稍后重试',
    action: '重试',
  },

  // 功能暂不支持
  NOT_IMPLEMENTED: {
    title: '功能开发中',
    message: '此功能正在开发中，敬请期待',
  },
} as const;
```

### 文件操作错误

```typescript
export const FILE_ERRORS = {
  // 文件过大
  FILE_TOO_LARGE: {
    title: '文件过大',
    message: '文件大小不能超过 {maxSize}',
  },

  // 文件类型不支持
  INVALID_FILE_TYPE: {
    title: '文件类型不支持',
    message: '请上传 {allowedTypes} 格式的文件',
  },

  // 上传失败
  UPLOAD_FAILED: {
    title: '上传失败',
    message: '文件上传失败，请重试',
    action: '重试',
  },

  // 下载失败
  DOWNLOAD_FAILED: {
    title: '下载失败',
    message: '文件下载失败，请重试',
    action: '重试',
  },
} as const;
```

---

## 结构化日志格式

### 日志级别定义

```typescript
// src/services/logger/types.ts

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export interface LogEntry {
  /** 时间戳 (ISO 8601) */
  timestamp: string;
  /** 日志级别 */
  level: LogLevel;
  /** 日志消息 */
  message: string;
  /** 服务名称 */
  service: string;
  /** 请求 ID */
  requestId?: string;
  /** 用户 ID */
  userId?: string;
  /** 错误信息 */
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
  /** 上下文数据 */
  context?: Record<string, unknown>;
  /** 标签 */
  tags?: string[];
}
```

### 日志格式化器

```typescript
// src/services/logger/formatter.ts

import { LogEntry, LogLevel } from './types';

/**
 * JSON 格式化（生产环境）
 */
export function formatJson(entry: LogEntry): string {
  return JSON.stringify({
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  });
}

/**
 * 可读格式化（开发环境）
 */
export function formatReadable(entry: LogEntry): string {
  const { timestamp, level, message, error, context } = entry;
  const time = new Date(timestamp).toLocaleTimeString();
  const levelIcon = getLevelIcon(level);

  let output = `${levelIcon} [${time}] ${message}`;

  if (error) {
    output += `\n  错误: ${error.name}: ${error.message}`;
    if (error.stack) {
      output += `\n  堆栈: ${error.stack.split('\n').slice(1, 4).join('\n        ')}`;
    }
  }

  if (context && Object.keys(context).length > 0) {
    output += `\n  上下文: ${JSON.stringify(context, null, 2)}`;
  }

  return output;
}

function getLevelIcon(level: LogLevel): string {
  const icons: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: '🔍',
    [LogLevel.INFO]: 'ℹ️',
    [LogLevel.WARN]: '⚠️',
    [LogLevel.ERROR]: '❌',
    [LogLevel.FATAL]: '💀',
  };
  return icons[level] || '📝';
}
```

### 日志记录器

```typescript
// src/services/logger/index.ts

import { LogEntry, LogLevel } from './types';
import { formatJson, formatReadable } from './formatter';

const isDev = process.env.NODE_ENV === 'development';

class Logger {
  private service: string;
  private defaultContext: Record<string, unknown>;

  constructor(service: string, defaultContext: Record<string, unknown> = {}) {
    this.service = service;
    this.defaultContext = defaultContext;
  }

  private log(level: LogLevel, message: string, data?: Partial<LogEntry>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      ...data,
      context: {
        ...this.defaultContext,
        ...data?.context,
      },
    };

    const formatted = isDev ? formatReadable(entry) : formatJson(entry);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formatted);
        break;
    }

    // 生产环境发送到日志服务
    if (!isDev && level !== LogLevel.DEBUG) {
      this.sendToLogService(entry);
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, message, { context });
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, { context });
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, { context });
  }

  error(message: string, error?: Error, context?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, {
      error: error ? {
        name: error.name,
        message: error.message,
        code: (error as any).code,
        stack: error.stack,
      } : undefined,
      context,
    });
  }

  fatal(message: string, error?: Error, context?: Record<string, unknown>) {
    this.log(LogLevel.FATAL, message, {
      error: error ? {
        name: error.name,
        message: error.message,
        code: (error as any).code,
        stack: error.stack,
      } : undefined,
      context,
    });
  }

  /**
   * 创建子日志器
   */
  child(context: Record<string, unknown>): Logger {
    return new Logger(this.service, {
      ...this.defaultContext,
      ...context,
    });
  }

  private async sendToLogService(entry: LogEntry) {
    // 实现日志上报逻辑
    // 例如发送到 Sentry, LogRocket, 自建日志服务等
  }
}

// 导出默认日志器
export const logger = new Logger('app');

// 创建模块专用日志器
export function createLogger(module: string): Logger {
  return new Logger(module);
}
```

### 错误日志模板

```typescript
// src/services/logger/templates.ts

import { logger } from './index';

/**
 * API 请求错误日志
 */
export function logApiError(
  endpoint: string,
  method: string,
  error: Error,
  context?: {
    requestId?: string;
    userId?: string;
    params?: Record<string, unknown>;
    duration?: number;
  }
) {
  logger.error(`API 请求失败: ${method} ${endpoint}`, error, {
    endpoint,
    method,
    ...context,
  });
}

/**
 * 业务操作错误日志
 */
export function logBusinessError(
  operation: string,
  error: Error,
  context?: Record<string, unknown>
) {
  logger.error(`业务操作失败: ${operation}`, error, {
    operation,
    ...context,
  });
}

/**
 * 用户操作日志
 */
export function logUserAction(
  action: string,
  userId: string,
  context?: Record<string, unknown>
) {
  logger.info(`用户操作: ${action}`, {
    action,
    userId,
    ...context,
  });
}

/**
 * 性能警告日志
 */
export function logPerformanceWarning(
  operation: string,
  duration: number,
  threshold: number
) {
  logger.warn(`性能警告: ${operation} 耗时 ${duration}ms (阈值: ${threshold}ms)`, {
    operation,
    duration,
    threshold,
  });
}

/**
 * 降级事件日志
 */
export function logFallbackEvent(
  feature: string,
  level: number,
  reason: string
) {
  logger.warn(`服务降级: ${feature} 降级到级别 ${level}`, {
    feature,
    level,
    reason,
  });
}
```

---

## 错误码体系

### 错误码设计

```typescript
// src/constants/error-codes.ts

/**
 * 错误码格式: XXYYYY
 * XX: 模块代码 (01-99)
 * YYYY: 错误序号 (0001-9999)
 */

export const ERROR_CODES = {
  // 01: 通用错误
  UNKNOWN: '010000',
  NETWORK_ERROR: '010001',
  TIMEOUT: '010002',
  INVALID_REQUEST: '010003',

  // 02: 认证错误
  UNAUTHORIZED: '020001',
  TOKEN_EXPIRED: '020002',
  INVALID_TOKEN: '020003',
  LOGIN_FAILED: '020004',
  ACCOUNT_LOCKED: '020005',

  // 03: 权限错误
  FORBIDDEN: '030001',
  INSUFFICIENT_PERMISSIONS: '030002',
  RESOURCE_LIMIT_EXCEEDED: '030003',

  // 04: 验证错误
  VALIDATION_FAILED: '040001',
  REQUIRED_FIELD_MISSING: '040002',
  INVALID_FORMAT: '040003',
  VALUE_OUT_OF_RANGE: '040004',

  // 05: 资源错误
  NOT_FOUND: '050001',
  ALREADY_EXISTS: '050002',
  CONFLICT: '050003',
  GONE: '050004',

  // 06: 业务错误
  INSUFFICIENT_BALANCE: '060001',
  OUT_OF_STOCK: '060002',
  ORDER_CANCELLED: '060003',
  PAYMENT_FAILED: '060004',

  // 07: 服务器错误
  INTERNAL_ERROR: '070001',
  SERVICE_UNAVAILABLE: '070002',
  DATABASE_ERROR: '070003',
  EXTERNAL_SERVICE_ERROR: '070004',

  // 08: 文件错误
  FILE_TOO_LARGE: '080001',
  INVALID_FILE_TYPE: '080002',
  UPLOAD_FAILED: '080003',
  STORAGE_FULL: '080004',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
```

### 错误码映射

```typescript
// src/constants/error-code-messages.ts

import { ERROR_CODES } from './error-codes';

export const ERROR_CODE_MESSAGES: Record<string, {
  title: string;
  message: string;
  action?: string;
}> = {
  [ERROR_CODES.NETWORK_ERROR]: {
    title: '网络错误',
    message: '网络连接失败，请检查网络设置',
    action: '重试',
  },
  [ERROR_CODES.UNAUTHORIZED]: {
    title: '未登录',
    message: '请先登录后再进行操作',
    action: '去登录',
  },
  // ... 其他错误码映射
};

/**
 * 根据错误码获取用户友好消息
 */
export function getErrorMessage(code: string): {
  title: string;
  message: string;
  action?: string;
} {
  return ERROR_CODE_MESSAGES[code] || {
    title: '操作失败',
    message: '发生未知错误，请稍后重试',
    action: '重试',
  };
}
```

---

## 国际化支持

### 消息模板国际化

```typescript
// src/i18n/error-messages.ts

export const errorMessages = {
  zh: {
    network: {
      connectionFailed: '网络连接失败，请检查网络设置',
      timeout: '请求超时，请稍后重试',
      offline: '网络已断开，请连接网络后重试',
    },
    auth: {
      unauthorized: '请先登录',
      sessionExpired: '登录已过期，请重新登录',
      loginFailed: '用户名或密码错误',
    },
    validation: {
      required: '{field} 不能为空',
      invalidFormat: '{field} 格式不正确',
      lengthRange: '{field} 长度应在 {min} 到 {max} 之间',
    },
    // ...
  },
  en: {
    network: {
      connectionFailed: 'Network connection failed, please check your settings',
      timeout: 'Request timed out, please try again later',
      offline: 'You are offline, please connect to the network',
    },
    auth: {
      unauthorized: 'Please log in first',
      sessionExpired: 'Session expired, please log in again',
      loginFailed: 'Invalid username or password',
    },
    validation: {
      required: '{field} is required',
      invalidFormat: '{field} format is invalid',
      lengthRange: '{field} must be between {min} and {max} characters',
    },
    // ...
  },
};

/**
 * 获取本地化错误消息
 */
export function getLocalizedErrorMessage(
  key: string,
  locale: 'zh' | 'en' = 'zh',
  params?: Record<string, string | number>
): string {
  const keys = key.split('.');
  let message: any = errorMessages[locale];

  for (const k of keys) {
    message = message?.[k];
  }

  if (typeof message !== 'string') {
    return key;
  }

  // 替换参数
  if (params) {
    return message.replace(
      /\{(\w+)\}/g,
      (_, key) => String(params[key] ?? `{${key}}`)
    );
  }

  return message;
}

// 使用示例
getLocalizedErrorMessage('validation.required', 'zh', { field: '用户名' });
// => "用户名 不能为空"

getLocalizedErrorMessage('validation.lengthRange', 'zh', {
  field: '密码',
  min: 8,
  max: 20,
});
// => "密码 长度应在 8 到 20 之间"
```

### React 组件集成

```typescript
// src/components/ErrorMessage.tsx

import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '@/constants/error-code-messages';

interface ErrorMessageProps {
  code?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function ErrorMessage({ code, message, action }: ErrorMessageProps) {
  const { t } = useTranslation('errors');

  const errorInfo = code ? getErrorMessage(code) : null;
  const displayMessage = message || errorInfo?.message || t('unknown');
  const displayTitle = errorInfo?.title || t('error');

  return (
    <div className="error-message">
      <h3 className="error-title">{displayTitle}</h3>
      <p className="error-description">{displayMessage}</p>
      {action && (
        <button onClick={action.onClick} className="error-action">
          {action.label}
        </button>
      )}
    </div>
  );
}
```
