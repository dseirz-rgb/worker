/**
 * Khoj 服务模块
 * 提供 Khoj AI 助手的连接和配置管理
 */

const DEFAULT_KHOJ_URL = 'http://localhost:42110';
const STORAGE_KEY_URL = 'khoj_url';
const STORAGE_KEY_ENABLED = 'khoj_enabled';

/**
 * Khoj 连接配置
 */
export interface KhojConfig {
  baseUrl: string;
  enabled: boolean;
}

/**
 * 获取 Khoj 配置
 * 从 localStorage 读取，如果没有则使用默认值
 */
export function getKhojConfig(): KhojConfig {
  if (typeof window === 'undefined') {
    return {
      baseUrl: DEFAULT_KHOJ_URL,
      enabled: true,
    };
  }

  const savedUrl = localStorage.getItem(STORAGE_KEY_URL);
  const savedEnabled = localStorage.getItem(STORAGE_KEY_ENABLED);

  return {
    baseUrl: savedUrl || DEFAULT_KHOJ_URL,
    // 如果没有保存过设置，默认启用
    enabled: savedEnabled === null ? true : savedEnabled === 'true',
  };
}

/**
 * 初始化 Khoj 配置
 * 如果没有保存过配置，设置默认值
 */
export function initKhojConfig(): void {
  if (typeof window === 'undefined') return;

  // 如果没有保存过 URL，设置默认值
  if (!localStorage.getItem(STORAGE_KEY_URL)) {
    localStorage.setItem(STORAGE_KEY_URL, DEFAULT_KHOJ_URL);
  }
  
  // 如果没有保存过启用状态，默认启用
  if (!localStorage.getItem(STORAGE_KEY_ENABLED)) {
    localStorage.setItem(STORAGE_KEY_ENABLED, 'true');
  }
}

/**
 * 保存 Khoj 配置
 */
export function saveKhojConfig(config: Partial<KhojConfig>): void {
  if (typeof window === 'undefined') return;

  if (config.baseUrl !== undefined) {
    localStorage.setItem(STORAGE_KEY_URL, config.baseUrl);
  }
  if (config.enabled !== undefined) {
    localStorage.setItem(STORAGE_KEY_ENABLED, String(config.enabled));
  }
}

/**
 * 检查 Khoj 服务是否可用
 * 优先通过后端代理检查，避免 CORS 问题
 */
export async function checkKhojHealth(customUrl?: string): Promise<boolean> {
  // 优先通过后端代理检查（避免 CORS 问题）
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // 通过后端 tRPC 检查
    const proxyResponse = await fetch('/api/trpc/khoj.getStatus', {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (proxyResponse.ok) {
      const data = await proxyResponse.json();
      // tRPC 返回格式: { result: { data: { success: boolean, ... } } }
      return data?.result?.data?.success === true;
    }
  } catch (proxyError) {
    console.warn('Backend proxy health check failed:', proxyError);
  }

  // 如果后端代理失败，尝试直接访问（可能在同一域名下）
  const config = getKhojConfig();
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
    console.warn('Direct Khoj health check also failed:', error);
    return false;
  }
}

/**
 * 获取 Khoj Chat URL
 * 用于 iframe 嵌入
 */
export function getKhojChatUrl(): string {
  const config = getKhojConfig();
  return `${config.baseUrl}/chat`;
}

/**
 * 获取 Khoj 基础 URL
 */
export function getKhojBaseUrl(): string {
  const config = getKhojConfig();
  return config.baseUrl;
}

/**
 * 重置 Khoj 配置为默认值
 */
export function resetKhojConfig(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_ENABLED);
}

/**
 * 连接状态类型
 */
export type KhojConnectionStatus = 'checking' | 'connected' | 'disconnected';

/**
 * 错误类型
 */
export type KhojErrorType = 
  | 'server_not_running'
  | 'network_error'
  | 'timeout'
  | 'iframe_blocked'
  | 'unknown';

/**
 * 根据错误获取错误类型
 */
export function getKhojErrorType(error: unknown): KhojErrorType {
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
export function getKhojErrorMessage(errorType: KhojErrorType): string {
  switch (errorType) {
    case 'server_not_running':
      return 'Khoj 服务未启动';
    case 'network_error':
      return '网络连接失败';
    case 'timeout':
      return '连接超时';
    case 'iframe_blocked':
      return '无法加载 Khoj 界面';
    default:
      return '未知错误';
  }
}

/**
 * 获取错误提示
 */
export function getKhojErrorHint(errorType: KhojErrorType): string {
  switch (errorType) {
    case 'server_not_running':
      return '请运行: docker-compose -f docker-compose.khoj.yml up -d';
    case 'network_error':
      return '请检查网络连接和 Khoj 服务地址';
    case 'timeout':
      return '服务响应超时，请稍后重试';
    case 'iframe_blocked':
      return '浏览器可能阻止了 iframe 加载';
    default:
      return '请检查控制台日志获取更多信息';
  }
}
