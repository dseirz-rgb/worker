/**
 * 测试 Supabase 连接
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lyqspnecudllmnajrrlm.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5cXNwbmVjdWRsbG1uYWpycmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE0NDU4NSwiZXhwIjoyMDgxNTA0NTg1fQ.-ekqAI1NyEw7s-1pQKLa7m3Eq6ZF9F3E6XCJN9vjwko';

async function main() {
  console.log('🔧 测试 Supabase 连接...');
  console.log('URL:', SUPABASE_URL);
  
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // 测试查询 documents 表
  console.log('\n📊 查询 documents 表...');
  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .select('*')
    .limit(5);

  if (docsError) {
    console.error('❌ 查询 documents 失败:', docsError);
  } else {
    console.log('✅ documents 查询成功，记录数:', docs?.length || 0);
  }

  // 测试插入
  console.log('\n📝 测试插入 documents...');
  const { data: insertData, error: insertError } = await supabase
    .from('documents')
    .insert({
      title: '测试笔记',
      content: '这是一条测试笔记',
      source_type: 'note',
      user_id: 1,
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ 插入失败:', insertError);
  } else {
    console.log('✅ 插入成功:', insertData);
    
    // 删除测试数据
    if (insertData?.id) {
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', insertData.id);
      
      if (deleteError) {
        console.error('❌ 删除测试数据失败:', deleteError);
      } else {
        console.log('✅ 测试数据已清理');
      }
    }
  }

  // 测试 conversations 表
  console.log('\n📊 查询 conversations 表...');
  const { data: convs, error: convsError } = await supabase
    .from('conversations')
    .select('*')
    .limit(5);

  if (convsError) {
    console.error('❌ 查询 conversations 失败:', convsError);
  } else {
    console.log('✅ conversations 查询成功，记录数:', convs?.length || 0);
  }

  console.log('\n✅ 测试完成！');
}

main().catch(console.error);
