import { createClient } from '@supabase/supabase-js'; 

export const config = {
  runtime: 'edge',
};

const supabase = createClient( 
  process.env.VITE_SUPABASE_URL!, 
  process.env.SUPABASE_SERVICE_KEY! 
); 

// LightRAG 服务 URL
const LIGHTRAG_URL = process.env.VITE_LIGHTRAG_SERVICE_URL || 'https://provip.zeabur.app';

/**
 * 异步索引文档到 LightRAG (不阻塞主流程)
 */
async function indexToLightRAG(documentId: string, title: string, content: string) {
  try {
    const response = await fetch(`${LIGHTRAG_URL}/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: documentId,
        content: `# ${title}\n\n${content}`,
        metadata: { title, source: 'import-article' }
      })
    });
    
    if (!response.ok) {
      console.error('[LightRAG] Index failed:', await response.text());
    } else {
      console.log('[LightRAG] Document indexed:', documentId);
    }
  } catch (error) {
    console.error('[LightRAG] Index error:', error);
    // 不抛出错误，让主流程继续
  }
}

export default async function handler(req: Request) { 
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try { 
    // 接收客户端传来的完整数据
    const body = await req.json() as { url?: string; title?: string; content?: string; comment?: string };
    const { url, title, content, comment } = body; 
    
    // 基本校验
    if (!url) throw new Error('Missing URL');
    // 如果客户端没传 content (旧版快捷指令)，则报错提示更新
    if (!content) throw new Error('Missing content. Please update your shortcut to fetch content via Jina first.');

    const docTitle = title || '未命名文章';
    
    // 存入数据库 
    const { data, error } = await supabase.from('documents').insert({ 
      title: docTitle,
      content: content, 
      source_type: 'wechat_article', 
      metadata: { 
        url, 
        imported_at: new Date().toISOString(),
        comment: comment || null // 用户点评
      } 
    }).select('id').single(); 
    
    if (error) throw new Error(`Supabase Error: ${error.message}`); 
    
    // 异步索引到 LightRAG (不等待完成)
    if (data?.id) {
      // 使用 waitUntil 或直接调用 (Edge Runtime 会在响应后继续执行)
      indexToLightRAG(`doc_${data.id}`, docTitle, content);
    }
    
    return new Response(JSON.stringify({ success: true, message: 'Imported successfully', id: data?.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e: any) { 
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } 
} 
// 删除所有后台处理逻辑，保持 API 极简
