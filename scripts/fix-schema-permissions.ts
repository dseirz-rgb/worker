/**
 * 修复 Investment DB 的 schema 权限
 * 授予 service_role 和 anon 角色对 public schema 的完整权限
 */
import { Client } from 'pg';

const DATABASE_URL = 'postgresql://postgres:DIDIdache2025@db.lyqspnecudllmnajrrlm.supabase.co:5432/postgres';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ 已连接到 Investment DB');

    // 授予 schema 权限
    console.log('\n🔧 授予 public schema 权限...');
    await client.query(`GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;`);
    await client.query(`GRANT ALL ON SCHEMA public TO anon, authenticated, service_role;`);
    console.log('✅ schema 权限已授予');

    // 授予所有表的权限
    console.log('\n🔧 授予所有表的权限...');
    await client.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;`);
    console.log('✅ 表权限已授予');

    // 授予序列权限
    console.log('\n🔧 授予序列权限...');
    await client.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;`);
    console.log('✅ 序列权限已授予');

    // 授予函数权限
    console.log('\n🔧 授予函数权限...');
    await client.query(`GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;`);
    console.log('✅ 函数权限已授予');

    // 设置默认权限（新创建的对象自动授权）
    console.log('\n🔧 设置默认权限...');
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;`);
    console.log('✅ 默认权限已设置');

    // 确保 documents 和 conversations 表的 RLS 已禁用
    console.log('\n🔧 确保 RLS 已禁用...');
    await client.query(`ALTER TABLE documents DISABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;`);
    console.log('✅ RLS 已禁用');

    // 验证权限
    console.log('\n📊 验证权限...');
    const { rows } = await client.query(`
      SELECT grantee, privilege_type 
      FROM information_schema.role_table_grants 
      WHERE table_name = 'documents' 
      AND grantee IN ('anon', 'authenticated', 'service_role')
      ORDER BY grantee, privilege_type;
    `);
    console.log('documents 表权限:');
    rows.forEach(r => console.log(`  ${r.grantee}: ${r.privilege_type}`));

    // 测试查询
    console.log('\n📊 测试查询...');
    const { rows: docs } = await client.query(`SELECT COUNT(*) as count FROM documents;`);
    console.log(`  documents 表记录数: ${docs[0].count}`);

    console.log('\n✅ 权限修复完成！');

  } catch (error) {
    console.error('❌ 错误:', error);
    throw error;
  } finally {
    await client.end();
  }
}

main();
