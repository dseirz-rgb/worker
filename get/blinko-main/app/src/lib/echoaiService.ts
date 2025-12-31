/**
 * EchoAI 服务模块
 * 提供 EchoAI (基于 Khoj) 的连接和配置管理
 */

const DEFAULT_ECHOAI_URL = 'http://localhost:42110';
const STORAGE_KEY_URL = 'echoai_url';
const STORAGE_KEY_ENABLED = 'echoai_enabled';

// 兼容旧的 storage key
const LEGACY_STORAGE_KEY_URL = 'khoj_url';
const LEGACY_STORAGE_KEY_ENABLED = 'khoj_enabled';

/**
 * EchoAI 连接配置
 */
export interface EchoAIConfig {
  baseUrl: string;
  enabled: boolean;
}

/**
 * 迁移旧的 Khoj 配置到 EchoAI
 */
function migrateLegacyConfig(): void {
  if (typeof window === 'undefined') return;

  // 如果有旧的 Khoj 配置，迁移到新的 key
  const legacyUrl = localStorage.getItem(LEGACY_STORAGE_KEY_URL);
  const legacyEnabled = localStorage.getItem(LEGACY_STORAGE_KEY_ENABLED);

  if (legacyUrl && !localStorage.getItem(STORAGE_KEY_URL)) {
    localStorage.setItem(STORAGE_KEY_URL, legacyUrl);
  }
  if (legacyEnabled && !localStorage.getItem(STORAGE_KEY_ENABLED)) {
    localStorage.setItem(STORAGE_KEY_ENABLED, legacyEnabled);
  }
}

/**
 * 获取 EchoAI 配置
 * 从 localStorage 读取，如果没有则使用默认值
 */
export function getEchoAIConfig(): EchoAIConfig {
  if (typeof window === 'undefined') {
    return {
      baseUrl: DEFAULT_ECHOAI_URL,
      enabled: true,
    };
  }

  // 先尝试迁移旧配置
  migrateLegacyConfig();

  const savedUrl = localStorage.getItem(STORAGE_KEY_URL);
  const savedEnabled = localStorage.getItem(STORAGE_KEY_ENABLED);

  return {
    baseUrl: savedUrl || DEFAULT_ECHOAI_URL,
    enabled: savedEnabled === null ? true : savedEnabled === 'true',
  };
}

/**
 * 初始化 EchoAI 配置
 */
export function initEchoAIConfig(): void {
  if (typeof window === 'undefined') return;

  migrateLegacyConfig();

  if (!localStorage.getItem(STORAGE_KEY_URL)) {
    localStorage.setItem(STORAGE_KEY_URL, DEFAULT_ECHOAI_URL);
  }
  
  if (!localStorage.getItem(STORAGE_KEY_ENABLED)) {
    localStorage.setItem(STORAGE_KEY_ENABLED, 'true');
  }
}

/**
 * 保存 EchoAI 配置
 */
export function saveEchoAIConfig(config: Partial<EchoAIConfig>): void {
  if (typeof window === 'undefined') return;

  if (config.baseUrl !== undefined) {
    localStorage.setItem(STORAGE_KEY_URL, config.baseUrl);
  }
  if (config.enabled !== undefined) {
    localStorage.setItem(STORAGE_KEY_ENABLED, String(config.enabled));
  }
}

/**
 * 检查 EchoAI 服务是否可用
 */
export async function checkEchoAIHealth(customUrl?: string): Promise<boolean> {
  // 优先通过后端代理检查
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const proxyResponse = await fetch('/api/trpc/khoj.getStatus', {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (proxyResponse.ok) {
      const data = await proxyResponse.json();
      return data?.result?.data?.success === true;
    }
  } catch (proxyError) {
    console.warn('Backend proxy health check failed:', proxyError);
  }

  // 直接访问
  const config = getEchoAIConfig();
  const baseUrl = customUrl || config.baseUrl;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'GET',
      signal: controller.signal,
      mode: 'cors',
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('Direct EchoAI health check failed:', error);
    return false;
  }
}

/**
 * 获取 EchoAI Chat URL
 */
export function getEchoAIChatUrl(): string {
  const config = getEchoAIConfig();
  return `${config.baseUrl}/chat`;
}

/**
 * 获取 EchoAI 基础 URL
 */
export function getEchoAIBaseUrl(): string {
  const config = getEchoAIConfig();
  return config.baseUrl;
}

/**
 * 重置 EchoAI 配置为默认值
 */
export function resetEchoAIConfig(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_ENABLED);
  // 也清理旧的 key
  localStorage.removeItem(LEGACY_STORAGE_KEY_URL);
  localStorage.removeItem(LEGACY_STORAGE_KEY_ENABLED);
}

/**
 * 连接状态类型
 */
export type EchoAIConnectionStatus = 'checking' | 'connected' | 'disconnected';

/**
 * 错误类型
 */
export type EchoAIErrorType = 
  | 'server_not_running'
  | 'network_error'
  | 'timeout'
  | 'iframe_blocked'
  | 'unknown';

/**
 * 根据错误获取错误类型
 */
export function getEchoAIErrorType(error: unknown): EchoAIErrorType {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'network_error';
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'timeout';
  }
  return 'server_not_running';
}

/**
 * 获取错误消息
 */
export function getEchoAIErrorMessage(errorType: EchoAIErrorType): string {
  switch (errorType) {
    case 'server_not_running':
      return 'EchoAI 服务未启动';
    case 'network_error':
      return '网络连接失败';
    case 'timeout':
      return '连接超时';
    case 'iframe_blocked':
      return '无法加载 EchoAI 界面';
    default:
      return '未知错误';
  }
}

/**
 * 获取错误提示
 */
export function getEchoAIErrorHint(errorType: EchoAIErrorType): string {
  switch (errorType) {
    case 'server_not_running':
      return '请运行: docker-compose -f docker-compose.khoj.yml up -d';
    case 'network_error':
      return '请检查网络连接和 EchoAI 服务地址';
    case 'timeout':
      return '服务响应超时，请稍后重试';
    case 'iframe_blocked':
      return '浏览器可能阻止了 iframe 加载';
    default:
      return '请检查控制台日志获取更多信息';
  }
}

// ============================================
// 兼容性导出 - 保持旧的 API 可用
// ============================================

/** @deprecated 使用 EchoAIConfig */
export type KhojConfig = EchoAIConfig;

/** @deprecated 使用 getEchoAIConfig */
export const getKhojConfig = getEchoAIConfig;

/** @deprecated 使用 initEchoAIConfig */
export const initKhojConfig = initEchoAIConfig;

/** @deprecated 使用 saveEchoAIConfig */
export const saveKhojConfig = saveEchoAIConfig;

/** @deprecated 使用 checkEchoAIHealth */
export const checkKhojHealth = checkEchoAIHealth;

/** @deprecated 使用 getEchoAIChatUrl */
export const getKhojChatUrl = getEchoAIChatUrl;

/** @deprecated 使用 getEchoAIBaseUrl */
export const getKhojBaseUrl = getEchoAIBaseUrl;

/** @deprecated 使用 resetEchoAIConfig */
export const resetKhojConfig = resetEchoAIConfig;

/** @deprecated 使用 EchoAIConnectionStatus */
export type KhojConnectionStatus = EchoAIConnectionStatus;

/** @deprecated 使用 EchoAIErrorType */
export type KhojErrorType = EchoAIErrorType;

/** @deprecated 使用 getEchoAIErrorType */
export const getKhojErrorType = getEchoAIErrorType;

/** @deprecated 使用 getEchoAIErrorMessage */
export const getKhojErrorMessage = getEchoAIErrorMessage;

/** @deprecated 使用 getEchoAIErrorHint */
export const getKhojErrorHint = getEchoAIErrorHint;
