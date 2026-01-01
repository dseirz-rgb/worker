// 设置 Supabase 数据库 - 启用 pgvector 扩展
import pg from 'pg';

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://postgres:DIDIdache2025%40@db.jwiocrwhqeomoybbwqcp.supabase.co:5432/postgres';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    console.log('连接 Supabase...');
    await client.connect();
    
    console.log('启用 pgvector 扩展...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    
    console.log('验证扩展...');
    const result = await client.query("SELECT * FROM pg_extension WHERE extname = 'vector';");
    
    if (result.rows.length > 0) {
      console.log('✅ pgvector 扩展已启用');
      console.log(result.rows[0]);
    } else {
      console.log('❌ pgvector 扩展启用失败');
    }
    
  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await client.end();
  }
}

main();
