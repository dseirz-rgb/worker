/**
 * 在 Investment DB 中创建 Google Drive 同步相关表
 * - sync_state: 存储同步状态（如 change token）
 * - file_sync_records: 追踪已同步的文件
 */
import { Client } from 'pg';

const DATABASE_URL = process.env.INVESTMENT_DATABASE_URL || 
  'postgresql://postgres:DIDIdache2025@db.lyqspnecudllmnajrrlm.supabase.co:5432/postgres';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ 已连接到 Investment DB');

    // 创建 sync_state 表
    console.log('\n📝 创建 sync_state 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_state (
        id BIGSERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ sync_state 表创建成功');

    // 创建 file_sync_records 表
    console.log('\n📁 创建 file_sync_records 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS file_sync_records (
        id BIGSERIAL PRIMARY KEY,
        file_id VARCHAR(255) UNIQUE NOT NULL,
        file_name VARCHAR(500) NOT NULL,
        mime_type VARCHAR(255),
        modified_time TIMESTAMPTZ NOT NULL,
        document_ids INTEGER[] NOT NULL DEFAULT '{}',
        sync_status VARCHAR(50) DEFAULT 'synced',
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ file_sync_records 表创建成功');

    // 创建索引
    console.log('\n🔍 创建索引...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sync_state_key ON sync_state(key);
      CREATE INDEX IF NOT EXISTS idx_file_sync_records_file_id ON file_sync_records(file_id);
      CREATE INDEX IF NOT EXISTS idx_file_sync_records_sync_status ON file_sync_records(sync_status);
    `);
    console.log('✅ 索引创建成功');

    // 检查 documents 表是否需要添加新的 source_type
    console.log('\n🔧 检查 documents 表 source_type...');
    const { rows: existingTypes } = await client.query(`
      SELECT DISTINCT source_type FROM documents WHERE source_type IS NOT NULL;
    `);
    console.log('现有 source_type:', existingTypes.map(r => r.source_type).join(', ') || '(无)');
    
    // source_type 是 TEXT 类型，不需要修改枚举
    // 新增的类型: 'financial_model' 会自动支持
    console.log('✅ documents 表支持新的 source_type: financial_model');

    // 授权
    console.log('\n🔐 授权访问...');
    await client.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON sync_state TO anon;
      GRANT SELECT, INSERT, UPDATE, DELETE ON file_sync_records TO anon;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
    `);
    console.log('✅ 授权完成');

    // 验证表结构
    console.log('\n📊 验证表结构...');
    
    const { rows: syncStateCols } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sync_state' 
      ORDER BY ordinal_position;
    `);
    console.log('sync_state 表字段:', syncStateCols.map(r => r.column_name).join(', '));

    const { rows: fileSyncCols } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'file_sync_records' 
      ORDER BY ordinal_position;
    `);
    console.log('file_sync_records 表字段:', fileSyncCols.map(r => r.column_name).join(', '));

    console.log('\n✅ Google Drive 同步表创建完成！');

  } catch (error) {
    console.error('❌ 错误:', error);
    throw error;
  } finally {
    await client.end();
  }
}

main();
