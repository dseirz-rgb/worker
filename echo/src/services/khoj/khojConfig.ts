/**
 * Khoj 配置存储服务
 * 负责从 localStorage 读取和保存 Khoj 配置
 */

import type {
  KhojSettings,
  KhojConnectionConfig,
} from '../../types/khoj';
import { DEFAULT_KHOJ_SETTINGS } from '../../types/khoj';

/** localStorage 存储键 */
const STORAGE_KEY = 'echo_khoj_settings';

/** 连接测试超时时间（毫秒） */
const CONNECTION_TEST_TIMEOUT = 5000;

/** 配置缓存 */
let settingsCache: KhojSettings | null = null;

/**
 * 连接测试结果
 */
export interface ConnectionTestResult {
  /** 是否成功 */
  success: boolean;
  /** 结果消息 */
  message: string;
}

/**
 * 从 localStorage 加载 Khoj 配置
 * @returns Khoj 配置，如果不存在则返回默认配置
 */
export function loadKhojSettings(): KhojSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    
    if (!stored) {
      // 没有存储的配置，返回默认值
      return { ...DEFAULT_KHOJ_SETTINGS };
    }

    const parsed = JSON.parse(stored) as Partial<KhojSettings>;
    
    // 合并默认配置，确保所有字段都存在
    const settings: KhojSettings = {
      connection: {
        ...DEFAULT_KHOJ_SETTINGS.connection,
        ...parsed.connection,
      },
      features: {
        ...DEFAULT_KHOJ_SETTINGS.features,
        ...parsed.features,
      },
    };

    // 更新缓存
    settingsCache = settings;
    
    return settings;
  } catch (error) {
    console.error('加载 Khoj 配置失败:', error);
    // 解析失败，返回默认配置
    return { ...DEFAULT_KHOJ_SETTINGS };
  }
}

/**
 * 保存 Khoj 配置到 localStorage
 * @param settings - 要保存的配置
 */
export function saveKhojSettings(settings: KhojSettings): void {
  try {
    const serialized = JSON.stringify(settings);
    localStorage.setItem(STORAGE_KEY, serialized);
    
    // 更新缓存
    settingsCache = settings;
  } catch (error) {
    console.error('保存 Khoj 配置失败:', error);
    throw new Error(`保存配置失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 测试 Khoj 服务器连接
 * @param config - 连接配置
 * @returns 测试结果
 */
export async function testKhojConnection(
  config: KhojConnectionConfig
): Promise<ConnectionTestResult> {
  // 检查是否启用
  if (!config.enabled) {
    return {
      success: false,
      message: 'Khoj 服务未启用',
    };
  }

  // 检查 URL 是否有效
  if (!config.baseUrl || config.baseUrl.trim() === '') {
    return {
      success: false,
      message: '服务器 URL 不能为空',
    };
  }

  // 验证 URL 格式
  try {
    new URL(config.baseUrl);
  } catch {
    return {
      success: false,
      message: '服务器 URL 格式无效',
    };
  }

  // 构建请求头
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  // 创建超时控制器
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TEST_TIMEOUT);

  try {
    const response = await fetch(`${config.baseUrl}/api/health`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return {
        success: true,
        message: '连接成功',
      };
    }

    // 根据状态码返回不同的错误信息
    switch (response.status) {
      case 401:
        return {
          success: false,
          message: 'API 密钥无效或已过期',
        };
      case 403:
        return {
          success: false,
          message: '访问被拒绝，请检查权限配置',
        };
      case 404:
        return {
          success: false,
          message: '健康检查端点不存在，请确认 Khoj 版本',
        };
      case 500:
      case 502:
      case 503:
        return {
          success: false,
          message: '服务器内部错误，请稍后重试',
        };
      default:
        return {
          success: false,
          message: `连接失败: HTTP ${response.status}`,
        };
    }
  } catch (error) {
    clearTimeout(timeoutId);

    // 处理不同类型的错误
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: '连接超时，请检查服务器是否运行',
        };
      }
      
      // 网络错误
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        return {
          success: false,
          message: '无法连接到服务器，请检查网络和服务器地址',
        };
      }

      return {
        success: false,
        message: `连接失败: ${error.message}`,
      };
    }

    return {
      success: false,
      message: '连接失败: 未知错误',
    };
  }
}

/**
 * 获取当前 Khoj 配置（带缓存）
 * 优先返回缓存的配置，如果缓存不存在则从 localStorage 加载
 * @returns Khoj 配置
 */
export function getKhojSettings(): KhojSettings {
  if (settingsCache) {
    return settingsCache;
  }
  
  return loadKhojSettings();
}

/**
 * 部分更新 Khoj 配置
 * @param partial - 要更新的配置部分
 * @returns 更新后的完整配置
 */
export function updateKhojSettings(
  partial: Partial<{
    connection: Partial<KhojConnectionConfig>;
    features: Partial<KhojSettings['features']>;
  }>
): KhojSettings {
  // 获取当前配置
  const current = getKhojSettings();

  // 合并更新
  const updated: KhojSettings = {
    connection: {
      ...current.connection,
      ...partial.connection,
    },
    features: {
      ...current.features,
      ...partial.features,
    },
  };

  // 保存更新后的配置
  saveKhojSettings(updated);

  return updated;
}

/**
 * 重置配置缓存
 * 主要用于测试或强制重新加载配置
 */
export function resetSettingsCache(): void {
  settingsCache = null;
}

/**
 * 清除所有 Khoj 配置
 * 从 localStorage 删除配置并重置缓存
 */
export function clearKhojSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    settingsCache = null;
  } catch (error) {
    console.error('清除 Khoj 配置失败:', error);
  }
}
