/**
 * 数据库服务
 * 封装 Tauri SQL 插件，提供统一的数据库访问接口
 */

import Database from '@tauri-apps/plugin-sql';

// 数据库实例
let db: Database | null = null;

// 数据库路径
const DB_PATH = 'sqlite:echo.db';

/**
 * 初始化数据库连接
 */
export async function initDatabase(): Promise<Database> {
  if (db) {
    return db;
  }
  
  try {
    db = await Database.load(DB_PATH);
    console.log('数据库连接成功');
    return db;
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw error;
  }
}

/**
 * 获取数据库实例
 */
export async function getDatabase(): Promise<Database> {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    console.log('数据库连接已关闭');
  }
}

/**
 * 执行查询（返回结果）
 */
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const database = await getDatabase();
  return database.select<T[]>(sql, params);
}

/**
 * 执行语句（不返回结果）
 */
export async function execute(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number; lastInsertId: number }> {
  const database = await getDatabase();
  const result = await database.execute(sql, params);
  return {
    rowsAffected: result.rowsAffected,
    lastInsertId: result.lastInsertId ?? 0,
  };
}

/**
 * 生成 UUID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 获取当前时间的 ISO 字符串
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// 导出数据库类型
export type { Database };
