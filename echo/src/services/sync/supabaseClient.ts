/**
 * Supabase 客户端配置
 * 管理 Supabase 连接和认证
 */

import type { SupabaseConfig } from '../../types/sync';

// ============== 存储键 ==============

const STORAGE_KEY = 'echo_supabase_config';

// ============== Supabase 客户端类 ==============

/**
 * 简化的 Supabase 客户端
 * 使用 REST API 直接与 Supabase 通信，避免引入额外依赖
 */
export class SupabaseClient {
  private url: string;
  private anonKey: string;
  private userId: string | null = null;

  constructor(url: string, anonKey: string) {
    this.url = url.replace(/\/$/, ''); // 移除末尾斜杠
    this.anonKey = anonKey;
  }

  // ============== 认证相关 ==============

  /**
   * 设置用户 ID（用于数据隔离）
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * 获取用户 ID
   */
  getUserId(): string {
    // 如果没有设置用户 ID，使用设备 ID
    if (!this.userId) {
      this.userId = this.getOrCreateDeviceId();
    }
    return this.userId;
  }

  /**
   * 获取或创建设备 ID
   */
  private getOrCreateDeviceId(): string {
    const key = 'echo_device_id';
    let deviceId = localStorage.getItem(key);
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem(key, deviceId);
    }
    return deviceId;
  }

  // ============== HTTP 请求 ==============

  /**
   * 构建请求头
   */
  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'apikey': this.anonKey,
      'Authorization': `Bearer ${this.anonKey}`,
      'Prefer': 'return=representation',
    };
  }

  /**
   * 发送 GET 请求
   */
  async get<T>(table: string, params?: Record<string, string>): Promise<T[]> {
    const url = new URL(`${this.url}/rest/v1/${table}`);
    
    // 添加用户 ID 过滤
    url.searchParams.append('user_id', `eq.${this.getUserId()}`);
    
    // 添加其他参数
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GET ${table} 失败: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 发送 POST 请求（插入）
   */
  async insert<T>(table: string, data: Partial<T> | Partial<T>[]): Promise<T[]> {
    const records = Array.isArray(data) ? data : [data];
    
    // 为每条记录添加 user_id
    const recordsWithUserId = records.map(record => ({
      ...record,
      user_id: this.getUserId(),
    }));

    const response = await fetch(`${this.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(recordsWithUserId),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`INSERT ${table} 失败: ${error}`);
    }

    return response.json();
  }

  /**
   * 发送 PATCH 请求（更新）
   */
  async update<T>(
    table: string,
    id: string,
    data: Partial<T>
  ): Promise<T[]> {
    const url = new URL(`${this.url}/rest/v1/${table}`);
    url.searchParams.append('id', `eq.${id}`);
    url.searchParams.append('user_id', `eq.${this.getUserId()}`);

    const response = await fetch(url.toString(), {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`UPDATE ${table} 失败: ${error}`);
    }

    return response.json();
  }

  /**
   * 发送 DELETE 请求
   */
  async delete(table: string, id: string): Promise<void> {
    const url = new URL(`${this.url}/rest/v1/${table}`);
    url.searchParams.append('id', `eq.${id}`);
    url.searchParams.append('user_id', `eq.${this.getUserId()}`);

    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`DELETE ${table} 失败: ${response.statusText}`);
    }
  }

  /**
   * 软删除（设置 deleted_at）
   */
  async softDelete<T>(table: string, id: string): Promise<T[]> {
    return this.update<T>(table, id, {
      deleted_at: new Date().toISOString(),
    } as Partial<T>);
  }

  /**
   * 获取指定时间后更新的记录
   */
  async getUpdatedSince<T>(table: string, since: string): Promise<T[]> {
    const url = new URL(`${this.url}/rest/v1/${table}`);
    url.searchParams.append('user_id', `eq.${this.getUserId()}`);
    url.searchParams.append('updated_at', `gt.${since}`);
    url.searchParams.append('order', 'updated_at.asc');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GET ${table} 失败: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 批量 upsert（插入或更新）
   */
  async upsert<T>(table: string, data: Partial<T>[]): Promise<T[]> {
    const recordsWithUserId = data.map(record => ({
      ...record,
      user_id: this.getUserId(),
    }));

    const response = await fetch(`${this.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(recordsWithUserId),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`UPSERT ${table} 失败: ${error}`);
    }

    return response.json();
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.url}/rest/v1/`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ============== 配置管理 ==============

/**
 * 获取保存的 Supabase 配置
 */
export function getSupabaseConfig(): SupabaseConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('[Supabase] 读取配置失败:', error);
  }
  
  return {
    url: '',
    anonKey: '',
    enabled: false,
  };
}

/**
 * 保存 Supabase 配置
 */
export function saveSupabaseConfig(config: SupabaseConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('[Supabase] 保存配置失败:', error);
  }
}

/**
 * 清除 Supabase 配置
 */
export function clearSupabaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ============== 客户端实例管理 ==============

let clientInstance: SupabaseClient | null = null;

/**
 * 获取 Supabase 客户端实例
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (clientInstance) {
    return clientInstance;
  }

  const config = getSupabaseConfig();
  if (config.enabled && config.url && config.anonKey) {
    clientInstance = new SupabaseClient(config.url, config.anonKey);
    return clientInstance;
  }

  return null;
}

/**
 * 初始化 Supabase 客户端
 */
export function initSupabaseClient(config: SupabaseConfig): SupabaseClient | null {
  if (!config.url || !config.anonKey) {
    console.warn('[Supabase] 配置不完整，无法初始化客户端');
    return null;
  }

  clientInstance = new SupabaseClient(config.url, config.anonKey);
  saveSupabaseConfig({ ...config, enabled: true });
  
  return clientInstance;
}

/**
 * 重置客户端实例
 */
export function resetSupabaseClient(): void {
  clientInstance = null;
}

/**
 * 测试 Supabase 连接
 */
export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = new SupabaseClient(url, anonKey);
    const isHealthy = await client.healthCheck();
    
    if (isHealthy) {
      return { success: true };
    } else {
      return { success: false, error: '无法连接到 Supabase' };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '连接测试失败',
    };
  }
}
