/**
 * 执行投资数据库 Schema
 * 使用 PostgreSQL 直接连接创建所有表结构
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// ESM 模块中获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 投资数据库配置
const DATABASE_URL = 'postgresql://postgres:DIDIdache2025@db.lyqspnecudllmnajrrlm.supabase.co:5432/postgres';
const INVESTMENT_DB_URL = 'https://lyqspnecudllmnajrrlm.supabase.co';
const INVESTMENT_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5cXNwbmVjdWRsbG1uYWpycmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE0NDU4NSwiZXhwIjoyMDgxNTA0NTg1fQ.-ekqAI1NyEw7s-1pQKLa7m3Eq6ZF9F3E6XCJN9vjwko';

// 需要创建的表
const REQUIRED_TABLES = [
  'asset_snapshots',
  'dashboard_snapshots',
  'nav_changes',
  'cash_reports',
  'transactions',
  'stock_positions',
  'watchlist',
  'user_settings',
  'risk_metrics',
  'trade_reviews'
];

async function executeSchema() {
  console.log('🔧 开始执行投资数据库 Schema...\n');
  
  // 创建 PostgreSQL 客户端
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ 已连接到数据库\n');

    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'investment-db-schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    
    console.log('📄 SQL 文件已读取，开始执行...\n');

    // 执行整个 SQL 文件
    await client.query(sqlContent);
    
    console.log('✅ SQL Schema 执行完成\n');

  } catch (err: any) {
    console.error('❌ 执行 SQL 时出错:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

async function verifyTables() {
  console.log('🔍 验证表结构...\n');
  
  // 使用 PostgreSQL 直接验证表
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const existingTables: string[] = [];
    const missingTables: string[] = [];

    for (const table of REQUIRED_TABLES) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table]);
      
      const exists = result.rows[0]?.exists;
      
      if (exists) {
        // 获取记录数
        const countResult = await client.query(`SELECT COUNT(*) FROM "${table}"`);
        const count = countResult.rows[0]?.count || 0;
        existingTables.push(table);
        console.log(`   ✅ ${table} - 存在 (${count} 条记录)`);
      } else {
        missingTables.push(table);
        console.log(`   ❌ ${table} - 不存在`);
      }
    }

    console.log('\n📋 验证结果:');
    console.log(`   存在: ${existingTables.length}/${REQUIRED_TABLES.length}`);
    
    if (missingTables.length > 0) {
      console.log(`   缺失: ${missingTables.join(', ')}`);
      return false;
    }
    
    return true;
  } finally {
    await client.end();
  }
}

async function main() {
  try {
    // 执行 Schema
    await executeSchema();
    
    // 验证表
    const success = await verifyTables();
    
    if (success) {
      console.log('\n✅ 所有表已创建成功！');
      console.log('\n下一步: 运行 IBKR 数据同步');
    } else {
      console.log('\n⚠️  部分表创建失败，请检查错误信息');
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ 执行失败:', err);
    process.exit(1);
  }
}

main();
