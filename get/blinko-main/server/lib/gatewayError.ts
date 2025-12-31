/**
 * 统一错误处理
 * 提供网关层的错误类型定义和处理工具
 * 
 * 功能：
 * - 统一的错误类型定义
 * - 错误响应格式化
 * - tRPC 错误转换
 * - 错误处理装饰器
 */

import { TRPCError } from '@trpc/server';

// ============ 类型定义 ============

/**
 * 网关错误类型
 */
export type GatewayErrorCode = 
  | 'SERVICE_UNAVAILABLE'
  | 'SERVICE_TIMEOUT'
  | 'SERVICE_ERROR'
  | 'INVALID_REQUEST'
  | 'UNKNOWN_ERROR';

/**
 * 统一错误响应格式
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: GatewayErrorCode;
    message: string;
    service: string;
    timestamp: string;
  };
}

// ============ 错误类 ============

/**
 * 网关错误
 * 用于表示网关层的错误
 */
export class GatewayError extends Error {
  constructor(
    message: string,
    public code: GatewayErrorCode,
    public serviceName: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

// ============ 工具函数 ============

/**
 * 创建统一错误响应
 */
export function createErrorResponse(
  code: GatewayErrorCode,
  message: string,
  serviceName: string
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      service: serviceName,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * 将网关错误转换为 tRPC 错误
 */
export function toTRPCError(error: GatewayError): TRPCError {
  // 错误码映射
  const codeMap: Record<GatewayErrorCode, TRPCError['code']> = {
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    SERVICE_TIMEOUT: 'TIMEOUT',
    SERVICE_ERROR: 'INTERNAL_SERVER_ERROR',
    INVALID_REQUEST: 'BAD_REQUEST',
    UNKNOWN_ERROR: 'INTERNAL_SERVER_ERROR',
  };

  return new TRPCError({
    code: codeMap[error.code] || 'INTERNAL_SERVER_ERROR',
    message: `[${error.serviceName}] ${error.message}`,
    cause: error.originalError,
  });
}

/**
 * 从原始错误创建网关错误
 */
export function fromError(
  error: unknown,
  serviceName: string
): GatewayError {
  // 如果已经是 GatewayError，直接返回
  if (error instanceof GatewayError) {
    return error;
  }

  // 处理 axios 错误
  if (isAxiosError(error)) {
    if (error.code === 'ECONNREFUSED') {
      return new GatewayError(
        '服务连接被拒绝',
        'SERVICE_UNAVAILABLE',
        serviceName,
        error
      );
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'TIMEOUT') {
      return new GatewayError(
        '服务响应超时',
        'SERVICE_TIMEOUT',
        serviceName,
        error
      );
    }

    if (error.code === 'ENOTFOUND') {
      return new GatewayError(
        '服务地址无法解析',
        'SERVICE_UNAVAILABLE',
        serviceName,
        error
      );
    }

    // HTTP 错误
    const status = error.response?.status;
    if (status) {
      if (status >= 500) {
        return new GatewayError(
          `服务内部错误 (HTTP ${status})`,
          'SERVICE_ERROR',
          serviceName,
          error
        );
      }
      if (status >= 400) {
        return new GatewayError(
          `请求错误 (HTTP ${status})`,
          'INVALID_REQUEST',
          serviceName,
          error
        );
      }
    }
  }

  // 处理普通 Error
  if (error instanceof Error) {
    return new GatewayError(
      error.message,
      'UNKNOWN_ERROR',
      serviceName,
      error
    );
  }

  // 处理未知类型
  return new GatewayError(
    '未知错误',
    'UNKNOWN_ERROR',
    serviceName
  );
}

/**
 * 错误处理装饰器
 * 用于统一处理服务调用错误
 * 
 * @example
 * ```typescript
 * const result = await withErrorHandling('khoj', async () => {
 *   return await khojClient.chat(message);
 * });
 * ```
 */
export async function withErrorHandling<T>(
  serviceName: string,
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const gatewayError = fromError(error, serviceName);
    throw toTRPCError(gatewayError);
  }
}

/**
 * 同步版本的错误处理装饰器
 */
export function withErrorHandlingSync<T>(
  serviceName: string,
  operation: () => T
): T {
  try {
    return operation();
  } catch (error) {
    const gatewayError = fromError(error, serviceName);
    throw toTRPCError(gatewayError);
  }
}

// ============ 辅助函数 ============

/**
 * 检查是否为 axios 错误
 */
function isAxiosError(error: unknown): error is AxiosLikeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as { isAxiosError: boolean }).isAxiosError === true
  );
}

/**
 * Axios 错误类型（简化版）
 */
interface AxiosLikeError extends Error {
  isAxiosError: boolean;
  code?: string;
  response?: {
    status: number;
    data?: unknown;
  };
}

// ============ 错误消息常量 ============

export const ERROR_MESSAGES = {
  SERVICE_UNAVAILABLE: '服务当前不可用，请稍后重试',
  SERVICE_TIMEOUT: '服务响应超时，请稍后重试',
  SERVICE_ERROR: '服务内部错误，请联系管理员',
  INVALID_REQUEST: '请求参数错误',
  UNKNOWN_ERROR: '发生未知错误',
} as const;

/**
 * 获取用户友好的错误消息
 */
export function getUserFriendlyMessage(code: GatewayErrorCode): string {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN_ERROR;
}
