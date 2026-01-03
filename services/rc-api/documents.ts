/**
 * Documents API - 文档综合接口
 * 
 * GET /api/documents                    - 获取文档列表
 * GET /api/documents?action=search&q=xx - 搜索文档
 * GET /api/documents?action=chunks&id=x - 获取文档 chunks
 * POST /api/documents                   - 创建文档
 * DELETE /api/documents?id=xxx          - 删除文档
 * 
 * @module api/documents
 */

import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientType = any;

// Initialize Supabase client
function getSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(url, key);
}

// LightRAG service URL
const LIGHTRAG_URL = process.env.LIGHTRAG_SERVICE_URL || 'https://provip.zeabur.app';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabaseClient();
    const action = req.query.action as string;
    
    // Handle GET with action parameter
    if (req.method === 'GET') {
      if (action === 'search') {
        return handleSearch(req, res, supabase);
      }
      if (action === 'chunks') {
        return handleChunks(req, res, supabase);
      }
      return handleGet(req, res, supabase);
    }
    
    switch (req.method) {
      case 'POST':
        return handlePost(req, res, supabase);
      case 'DELETE':
        return handleDelete(req, res, supabase);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[Documents API] Error:', error);
    return res.status(500).json({ error: String(error) });
  }
}

/**
 * GET /api/documents
 * 
 * Query params:
 * - page: number (default 1)
 * - limit: number (default 20)
 * - source_type: string (optional filter)
 * 
 * Returns only metadata (id, title, source_type, chunk_count, created_at)
 */
async function handleGet(req: VercelRequest, res: VercelResponse, supabase: SupabaseClientType) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const sourceType = req.query.source_type as string;
  const offset = (page - 1) * limit;
  
  // Build query
  let query = supabase
    .from('documents_meta')
    .select('id, title, source_type, chunk_count, metadata, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  // Apply filter if provided
  if (sourceType) {
    query = query.eq('source_type', sourceType);
  }
  
  const { data, error, count } = await query;
  
  if (error) {
    console.error('[Documents API] GET error:', error);
    return res.status(500).json({ error: error.message });
  }
  
  return res.status(200).json({
    documents: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit)
    }
  });
}

/**
 * POST /api/documents
 * 
 * Body:
 * - title: string (required)
 * - content: string (required)
 * - source_type: string (default 'article')
 * - metadata: object (optional)
 * 
 * Creates document metadata and indexes content in LightRAG
 */
async function handlePost(req: VercelRequest, res: VercelResponse, supabase: SupabaseClientType) {
  const { title, content, source_type = 'article', metadata = {} } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required' });
  }
  
  // 1. Create metadata record
  const { data: metaRecord, error: metaError } = await supabase
    .from('documents_meta')
    .insert({
      title,
      source_type,
      chunk_count: 1, // Will be updated if chunking is implemented
      metadata: {
        ...metadata,
        content_length: content.length
      }
    })
    .select()
    .single();
  
  if (metaError) {
    console.error('[Documents API] POST meta error:', metaError);
    return res.status(500).json({ error: metaError.message });
  }
  
  // 2. Index in LightRAG
  let lightragSuccess = false;
  let lightragError = null;
  
  try {
    const indexResponse = await fetch(`${LIGHTRAG_URL}/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: metaRecord.id,
        content,
        metadata: {
          title,
          source_type,
          ...metadata
        }
      })
    });
    
    if (indexResponse.ok) {
      lightragSuccess = true;
    } else {
      lightragError = await indexResponse.text();
      console.warn('[Documents API] LightRAG index failed:', lightragError);
    }
  } catch (error) {
    lightragError = String(error);
    console.warn('[Documents API] LightRAG index error:', error);
  }
  
  // 3. Also store in documents table for vector search fallback
  try {
    await supabase
      .from('documents')
      .insert({
        content,
        metadata: {
          title,
          source_type,
          meta_id: metaRecord.id,
          ...metadata
        }
      });
  } catch (error) {
    console.warn('[Documents API] Fallback documents insert error:', error);
  }
  
  return res.status(201).json({
    success: true,
    document: metaRecord,
    lightrag_indexed: lightragSuccess,
    lightrag_error: lightragError
  });
}

/**
 * DELETE /api/documents?id=xxx
 * 
 * Cascade deletes:
 * 1. documents_meta record
 * 2. LightRAG document
 * 3. documents table record (fallback)
 */
async function handleDelete(req: VercelRequest, res: VercelResponse, supabase: SupabaseClientType) {
  const id = req.query.id as string;
  
  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }
  
  // 1. Delete from documents_meta
  const { error: metaError } = await supabase
    .from('documents_meta')
    .delete()
    .eq('id', id);
  
  if (metaError) {
    console.error('[Documents API] DELETE meta error:', metaError);
    return res.status(500).json({ error: metaError.message });
  }
  
  // 2. Delete from LightRAG (best effort)
  let lightragDeleted = false;
  try {
    const deleteResponse = await fetch(`${LIGHTRAG_URL}/document/${id}`, {
      method: 'DELETE'
    });
    lightragDeleted = deleteResponse.ok;
  } catch (error) {
    console.warn('[Documents API] LightRAG delete error:', error);
  }
  
  // 3. Delete from documents table (fallback, best effort)
  try {
    await supabase
      .from('documents')
      .delete()
      .eq('metadata->>meta_id', id);
  } catch (error) {
    console.warn('[Documents API] Fallback documents delete error:', error);
  }
  
  return res.status(200).json({
    success: true,
    id,
    lightrag_deleted: lightragDeleted
  });
}


// === Search Handler ===

interface SearchResult {
  id: string;
  content_preview: string;
  score: number;
  metadata: Record<string, unknown>;
  source_type: string;
  parent_title?: string;
}

function getSourceTypeLabel(sourceType: string): string {
  const labels: Record<string, string> = {
    'uploaded_file': '上传文件',
    'article': '文章',
    'note': '笔记',
    'book': '书籍',
    'web': '网页'
  };
  return labels[sourceType] || sourceType;
}

function groupSearchResults(results: SearchResult[], query: string) {
  const groupMap = new Map<string, {
    title: string;
    source_type: string;
    results: SearchResult[];
    total_score: number;
  }>();
  
  for (const result of results) {
    const groupKey = result.parent_title || result.source_type || 'other';
    const groupTitle = result.parent_title || getSourceTypeLabel(result.source_type);
    
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, { title: groupTitle, source_type: result.source_type, results: [], total_score: 0 });
    }
    
    const group = groupMap.get(groupKey)!;
    group.results.push(result);
    group.total_score += result.score;
  }
  
  const groups = Array.from(groupMap.values()).sort((a, b) => b.total_score - a.total_score);
  for (const group of groups) {
    group.results.sort((a, b) => b.score - a.score);
  }
  
  return { query, total: results.length, groups };
}

/**
 * GET /api/documents?action=search&q=xxx
 */
async function handleSearch(req: VercelRequest, res: VercelResponse, supabase: SupabaseClientType) {
  const query = req.query.q as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const mode = (req.query.mode as string) || 'hybrid';
  
  if (!query) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }
  
  const results: SearchResult[] = [];
  
  // 1. LightRAG search
  if (mode === 'hybrid' || mode === 'lightrag') {
    try {
      const lightragResponse = await fetch(`${LIGHTRAG_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, mode: 'hybrid' }),
        signal: AbortSignal.timeout(5000)
      });
      
      if (lightragResponse.ok) {
        const lightragData = await lightragResponse.json() as { context?: string; entities?: unknown[]; relations?: unknown[] };
        if (lightragData.context) {
          results.push({
            id: 'lightrag-context',
            content_preview: lightragData.context.substring(0, 300),
            score: 1.0,
            metadata: { entities: lightragData.entities, relations: lightragData.relations },
            source_type: 'knowledge_graph',
            parent_title: '知识图谱'
          });
        }
      }
    } catch {
      // LightRAG search failed, continue with other methods
    }
  }
  
  // 2. Vector search
  if (mode === 'hybrid' || mode === 'vector') {
    try {
      const { data: vectorResults, error: vectorError } = await supabase
        .rpc('match_documents', { query_text: query, match_count: limit });
      
      if (!vectorError && vectorResults) {
        for (const doc of vectorResults) {
          results.push({
            id: String(doc.id),
            content_preview: doc.content?.substring(0, 200) || '',
            score: doc.similarity || 0.5,
            metadata: doc.metadata || {},
            source_type: doc.metadata?.source_type || doc.source_type || 'article',
            parent_title: doc.metadata?.title || doc.metadata?.parent_title
          });
        }
      }
    } catch {
      // Vector search failed
    }
  }
  
  // 3. Keyword search fallback
  if (results.length < limit && (mode === 'hybrid' || mode === 'keyword')) {
    const { data: keywordResults, error: keywordError } = await supabase
      .from('documents')
      .select('id, content, metadata, source_type')
      .textSearch('content', query, { type: 'websearch' })
      .limit(limit - results.length);
    
    if (!keywordError && keywordResults) {
      for (const doc of keywordResults) {
        if (!results.find(r => r.id === String(doc.id))) {
          results.push({
            id: String(doc.id),
            content_preview: doc.content?.substring(0, 200) || '',
            score: 0.3,
            metadata: doc.metadata || {},
            source_type: doc.metadata?.source_type || doc.source_type || 'article',
            parent_title: doc.metadata?.title || doc.metadata?.parent_title
          });
        }
      }
    }
  }
  
  return res.status(200).json(groupSearchResults(results, query));
}

// === Chunks Handler ===

/**
 * GET /api/documents?action=chunks&id=xxx
 */
async function handleChunks(req: VercelRequest, res: VercelResponse, supabase: SupabaseClientType) {
  const id = req.query.id as string;
  
  if (!id) {
    return res.status(400).json({ error: 'Document ID is required' });
  }
  
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = (page - 1) * limit;
  
  const { data, error, count } = await supabase
    .from('documents')
    .select('id, content, metadata, created_at', { count: 'exact' })
    .or(`metadata->>meta_id.eq.${id},metadata->>parent_id.eq.${id}`)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);
  
  if (error) {
    console.error('[Chunks API] Error:', error);
    return res.status(500).json({ error: error.message });
  }
  
  const chunks = (data || []).map((doc: { id: string; content?: string; metadata?: Record<string, unknown>; created_at?: string }, index: number) => ({
    id: doc.id,
    chunk_index: offset + index + 1,
    content_preview: doc.content?.substring(0, 200) + (doc.content && doc.content.length > 200 ? '...' : ''),
    content_length: doc.content?.length || 0,
    metadata: doc.metadata,
    created_at: doc.created_at
  }));
  
  return res.status(200).json({
    document_id: id,
    chunks,
    pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
  });
}
