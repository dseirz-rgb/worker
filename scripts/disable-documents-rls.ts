/**
 * 直接禁用 Investment DB 中 documents 和 conversations 表的 RLS
 * 开发环境使用
 */
import { Client } from 'pg';

const DATABASE_URL = 'postgresql://postgres:DIDIdache2025@db.lyqspnecudllmnajrrlm.supabase.co:5432/postgres';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ 已连接到 Investment DB');

    // 直接禁用 RLS
    console.log('\n🔧 禁用 documents 表 RLS...');
    await client.query(`ALTER TABLE documents DISABLE ROW LEVEL SECURITY;`);
    console.log('✅ documents 表 RLS 已禁用');

    console.log('\n🔧 禁用 conversations 表 RLS...');
    await client.query(`ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;`);
    console.log('✅ conversations 表 RLS 已禁用');

    // 授予权限
    console.log('\n🔧 授予角色权限...');
    await client.query(`GRANT ALL ON documents TO anon, authenticated;`);
    await client.query(`GRANT ALL ON conversations TO anon, authenticated;`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;`);
    console.log('✅ 角色权限已授予');

    // 验证 RLS 状态
    console.log('\n📊 验证 RLS 状态...');
    const { rows } = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('documents', 'conversations');
    `);
    rows.forEach(r => {
      console.log(`  ${r.tablename}: RLS ${r.rowsecurity ? '已启用' : '已禁用'}`);
    });

    // 测试查询
    console.log('\n📊 测试查询...');
    const { rows: docs } = await client.query(`SELECT COUNT(*) as count FROM documents;`);
    console.log(`  documents 表记录数: ${docs[0].count}`);
    
    const { rows: convs } = await client.query(`SELECT COUNT(*) as count FROM conversations;`);
    console.log(`  conversations 表记录数: ${convs[0].count}`);

    console.log('\n✅ RLS 已禁用！');

  } catch (error) {
    console.error('❌ 错误:', error);
    throw error;
  } finally {
    await client.end();
  }
}

main();
