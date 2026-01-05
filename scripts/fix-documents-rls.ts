/**
 * 修复 Investment DB 中 documents 和 conversations 表的 RLS 权限
 * 添加允许 anon key 读写的策略
 */
import { Client } from 'pg';

const DATABASE_URL = 'postgresql://postgres:DIDIdache2025@db.lyqspnecudllmnajrrlm.supabase.co:5432/postgres';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ 已连接到 Investment DB');

    // 为 documents 表配置 RLS
    console.log('\n🔧 配置 documents 表 RLS...');
    
    // 先禁用 RLS（如果已启用）
    await client.query(`ALTER TABLE documents DISABLE ROW LEVEL SECURITY;`);
    
    // 启用 RLS
    await client.query(`ALTER TABLE documents ENABLE ROW LEVEL SECURITY;`);
    
    // 删除旧策略（如果存在）
    await client.query(`DROP POLICY IF EXISTS "Allow all for documents" ON documents;`);
    await client.query(`DROP POLICY IF EXISTS "documents_select_policy" ON documents;`);
    await client.query(`DROP POLICY IF EXISTS "documents_insert_policy" ON documents;`);
    await client.query(`DROP POLICY IF EXISTS "documents_update_policy" ON documents;`);
    await client.query(`DROP POLICY IF EXISTS "documents_delete_policy" ON documents;`);
    
    // 创建允许所有操作的策略（开发环境）
    await client.query(`
      CREATE POLICY "Allow all for documents" ON documents
      FOR ALL
      USING (true)
      WITH CHECK (true);
    `);
    console.log('✅ documents 表 RLS 策略已配置');

    // 为 conversations 表配置 RLS
    console.log('\n🔧 配置 conversations 表 RLS...');
    
    await client.query(`ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;`);
    
    await client.query(`DROP POLICY IF EXISTS "Allow all for conversations" ON conversations;`);
    await client.query(`DROP POLICY IF EXISTS "conversations_select_policy" ON conversations;`);
    await client.query(`DROP POLICY IF EXISTS "conversations_insert_policy" ON conversations;`);
    await client.query(`DROP POLICY IF EXISTS "conversations_update_policy" ON conversations;`);
    await client.query(`DROP POLICY IF EXISTS "conversations_delete_policy" ON conversations;`);
    
    await client.query(`
      CREATE POLICY "Allow all for conversations" ON conversations
      FOR ALL
      USING (true)
      WITH CHECK (true);
    `);
    console.log('✅ conversations 表 RLS 策略已配置');

    // 授予 anon 和 authenticated 角色权限
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

    // 验证策略
    const { rows: policies } = await client.query(`
      SELECT tablename, policyname 
      FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename IN ('documents', 'conversations');
    `);
    console.log('\n📋 已配置的策略:');
    policies.forEach(p => {
      console.log(`  ${p.tablename}: ${p.policyname}`);
    });

    console.log('\n✅ RLS 配置完成！');

  } catch (error) {
    console.error('❌ 错误:', error);
    throw error;
  } finally {
    await client.end();
  }
}

main();
