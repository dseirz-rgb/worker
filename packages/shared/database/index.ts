/**
 * 双数据库客户端 (DualDatabaseClient)
 * 
 * 管理 Echo 和 RiskControl 两个独立的数据库连接
 * - Echo: PostgreSQL (Prisma) - 笔记、任务、日历
 * - RiskControl: Supabase (pgvector) - 持仓、交易、风险指标
 * 
 * 核心原则：数据完全隔离，互不污染
 * 
 * @module @echoai/shared/database
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================
// 类型定义
// ============================================

/**
 * 数据类型枚举
 * 用于自动路由到正确的数据库
 */
export type DataType =
  // Echo 数据类型 -> Echo DB
  | 'notes'
  | 'tasks'
  | 'calendar'
  | 'tags'
  | 'attachments'
  | 'daily_knowledge'
  // RiskControl 数据类型 -> RiskControl DB
  | 'positions'
  | 'transactions'
  | 'risk_metrics'
  | 'watchlist'
  | 'investment_docs'
  | 'dashboard_snapshots'
  | 'trade_reviews';

/**
 * 数据库配置
 */
export interface DatabaseConfig {
  // RiskControl Supabase 配置
  rcSupabaseUrl: string;
  rcSupabaseAnonKey: string;
  // Echo 数据库配置（可选，用于直接访问）
  echoSupabaseUrl?: string;
  echoSupabaseAnonKey?: string;
}

/**
 * 数据库健康状态
 */
export interface DatabaseHealth {
  echo: {
    connected: boolean;
    latency?: number;
    error?: string;
  };
  riskcontrol: {
    connected: boolean;
    latency?: number;
    error?: string;
  };
}

// ============================================
// 数据类型到数据库的映射
// ============================================

const DATA_TYPE_MAPPING: Record<DataType, 'echo' | 'riskcontrol'> = {
  // Echo 数据
  notes: 'echo',
  tasks: 'echo',
  calendar: 'echo',
  tags: 'echo',
  attachments: 'echo',
  daily_knowledge: 'echo',
  // RiskControl 数据
  positions: 'riskcontrol',
  transactions: 'riskcontrol',
  risk_metrics: 'riskcontrol',
  watchlist: 'riskcontrol',
  investment_docs: 'riskcontrol',
  dashboard_snapshots: 'riskcontrol',
  trade_reviews: 'riskcontrol',
};

// ============================================
// 双数据库客户端
// ============================================

export class DualDatabaseClient {
  private rcClient: SupabaseClient | null = null;
  private echoClient: SupabaseClient | null = null;

  constructor(config: DatabaseConfig) {
    // 初始化 RiskControl Supabase 客户端
    if (config.rcSupabaseUrl && config.rcSupabaseAnonKey) {
      this.rcClient = createClient(config.rcSupabaseUrl, config.rcSupabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }

    // 初始化 Echo Supabase 客户端（如果配置了）
    if (config.echoSupabaseUrl && config.echoSupabaseAnonKey) {
      this.echoClient = createClient(config.echoSupabaseUrl, config.echoSupabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
  }

  /**
   * 获取 RiskControl 数据库客户端
   */
  get riskcontrol(): SupabaseClient {
    if (!this.rcClient) {
      throw new Error('RiskControl database client not initialized');
    }
    return this.rcClient;
  }

  /**
   * 获取 Echo 数据库客户端
   * 注意：Echo 主要使用 Prisma，这里是可选的 Supabase 客户端
   */
  get echo(): SupabaseClient | null {
    return this.echoClient;
  }

  /**
   * 根据数据类型自动路由到正确的数据库
   * 
   * @param type 数据类型
   * @returns 对应的 Supabase 客户端
   * @throws 如果数据类型未知或客户端未初始化
   */
  getClientForDataType(type: DataType): SupabaseClient {
    const target = DATA_TYPE_MAPPING[type];

    if (!target) {
      throw new Error(`Unknown data type: ${type}`);
    }

    if (target === 'riskcontrol') {
      if (!this.rcClient) {
        throw new Error('RiskControl database client not initialized');
      }
      return this.rcClient;
    }

    // Echo 数据类型
    if (this.echoClient) {
      return this.echoClient;
    }

    // 如果 Echo Supabase 未配置，抛出错误
    // 实际使用中，Echo 数据应该通过 Prisma 访问
    throw new Error('Echo database client not initialized. Use Prisma for Echo data.');
  }

  /**
   * 检查数据库连接健康状态
   */
  async healthCheck(): Promise<DatabaseHealth> {
    const health: DatabaseHealth = {
      echo: { connected: false },
      riskcontrol: { connected: false },
    };

    // 检查 RiskControl 连接
    if (this.rcClient) {
      const start = Date.now();
      try {
        const { error } = await this.rcClient
          .from('dashboard_snapshots')
          .select('id')
          .limit(1);
        
        health.riskcontrol = {
          connected: !error,
          latency: Date.now() - start,
          error: error?.message,
        };
      } catch (error) {
        health.riskcontrol = {
          connected: false,
          latency: Date.now() - start,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // 检查 Echo 连接（如果配置了）
    if (this.echoClient) {
      const start = Date.now();
      try {
        const { error } = await this.echoClient
          .from('notes')
          .select('id')
          .limit(1);
        
        health.echo = {
          connected: !error,
          latency: Date.now() - start,
          error: error?.message,
        };
      } catch (error) {
        health.echo = {
          connected: false,
          latency: Date.now() - start,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return health;
  }

  /**
   * 判断数据类型属于哪个数据库
   */
  static getTargetDatabase(type: DataType): 'echo' | 'riskcontrol' {
    return DATA_TYPE_MAPPING[type];
  }

  /**
   * 获取所有 Echo 数据类型
   */
  static getEchoDataTypes(): DataType[] {
    return Object.entries(DATA_TYPE_MAPPING)
      .filter(([_, target]) => target === 'echo')
      .map(([type]) => type as DataType);
  }

  /**
   * 获取所有 RiskControl 数据类型
   */
  static getRiskControlDataTypes(): DataType[] {
    return Object.entries(DATA_TYPE_MAPPING)
      .filter(([_, target]) => target === 'riskcontrol')
      .map(([type]) => type as DataType);
  }
}

// ============================================
// 数据库错误类
// ============================================

export class DatabaseError extends Error {
  constructor(
    public database: 'echo' | 'riskcontrol',
    public code: 'CONNECTION_FAILED' | 'QUERY_FAILED' | 'TIMEOUT' | 'NOT_INITIALIZED',
    message: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

// ============================================
// 单例导出
// ============================================

let databaseClientInstance: DualDatabaseClient | null = null;

export function initDatabaseClient(config: DatabaseConfig): DualDatabaseClient {
  databaseClientInstance = new DualDatabaseClient(config);
  return databaseClientInstance;
}

export function getDatabaseClient(): DualDatabaseClient | null {
  return databaseClientInstance;
}

export default DualDatabaseClient;
