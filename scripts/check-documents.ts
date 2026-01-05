/**
 * 检查 documents 表数据
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lyqspnecudllmnajrrlm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5cXNwbmVjdWRsbG1uYWpycmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE0NDU4NSwiZXhwIjoyMDgxNTA0NTg1fQ.-ekqAI1NyEw7s-1pQKLa7m3Eq6ZF9F3E6XCJN9vjwko';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  console.log('=== 检查 documents 表 ===\n');

  const { data, error } = await supabase
    .from('documents')
    .select('id, title, source_type, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.log('错误:', error.message);
  } else {
    console.log('记录数:', data?.length);
    data?.forEach(d => {
      console.log(`  - [${d.source_type}] ${d.title?.slice(0, 40) || '无标题'}`);
    });
  }
}

check().catch(console.error);
