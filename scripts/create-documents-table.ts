/**
 * 在 Investment DB 中创建 documents 和 conversations 表
 * 用于投资笔记功能
 */
import { Client } from 'pg';

const DATABASE_URL = 'postgresql://postgres:DIDIdache2025@db.lyqspnecudllmnajrrlm.supabase.co:5432/postgres';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ 已连接到 Investment DB');

    // 启用 pgvector 扩展
    console.log('\n🔧 启用 pgvector 扩展...');
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('✅ pgvector 扩展已启用');

    // 创建 documents 表
    console.log('\n📝 创建 documents 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER DEFAULT 1,
        title TEXT,
        content TEXT,
        tags TEXT[] DEFAULT '{}',
        source_type TEXT DEFAULT 'note',
        related_ticker VARCHAR(20),
        portfolio_snapshot JSONB,
        metadata JSONB,
        embedding vector(768),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ documents 表创建成功');

    // 创建 conversations 表
    console.log('\n💬 创建 conversations 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER DEFAULT 1,
        title TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ conversations 表创建成功');

    // 创建索引
    console.log('\n🔍 创建索引...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_source_type ON documents(source_type);
      CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
      CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
    `);
    console.log('✅ 索引创建成功');

    // 验证表结构
    console.log('\n📊 验证表结构...');
    const { rows: docCols } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'documents' 
      ORDER BY ordinal_position;
    `);
    console.log('documents 表字段:', docCols.map(r => r.column_name).join(', '));

    const { rows: convCols } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'conversations' 
      ORDER BY ordinal_position;
    `);
    console.log('conversations 表字段:', convCols.map(r => r.column_name).join(', '));

    console.log('\n✅ 所有表创建完成！');

  } catch (error) {
    console.error('❌ 错误:', error);
    throw error;
  } finally {
    await client.end();
  }
}

main();
