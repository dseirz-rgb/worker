/**
 * useDocumentsMeta Hook
 * 
 * 从 documents_meta 表获取文档元数据，支持分页和过滤。
 * 用于知识库页面的书籍聚合显示。
 */

import { useState, useEffect, useCallback } from 'react';
import { getClient } from '../services/supabaseData';

export interface DocumentMeta {
  id: string;
  title: string;
  source_type: string;
  chunk_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBook {
  title: string;
  count: number;
  ids: string[];
  last_updated: string;
  source_type: string;
}

export interface UseDocumentsMetaResult {
  documents: DocumentMeta[];
  books: KnowledgeBook[];
  others: DocumentMeta[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  refetch: () => Promise<void>;
  setPage: (page: number) => void;
  setSourceTypeFilter: (type: string | null) => void;
}

/**
 * 聚合书籍逻辑
 * 
 * 将 "(Part N)" 模式的文档聚合为单本书籍
 */
function aggregateBooks(documents: DocumentMeta[]): {
  books: KnowledgeBook[];
  others: DocumentMeta[];
} {
  const bookMap: Record<string, KnowledgeBook> = {};
  const others: DocumentMeta[] = [];

  for (const doc of documents) {
    // 检查是否是书籍的一部分 (Part N) 模式
    if (doc.source_type === 'uploaded_file' && /\(Part \d+\)$/.test(doc.title)) {
      const baseTitle = doc.title.replace(/\s*\(Part \d+\)$/, '');
      
      if (!bookMap[baseTitle]) {
        bookMap[baseTitle] = {
          title: baseTitle,
          count: 0,
          ids: [],
          last_updated: doc.created_at,
          source_type: 'book'
        };
      }
      
      bookMap[baseTitle].count += doc.chunk_count || 1;
      bookMap[baseTitle].ids.push(doc.id);
      
      // 更新最后更新时间
      if (new Date(doc.created_at) > new Date(bookMap[baseTitle].last_updated)) {
        bookMap[baseTitle].last_updated = doc.created_at;
      }
    } else {
      others.push(doc);
    }
  }

  // 按最后更新时间排序
  const books = Object.values(bookMap).sort(
    (a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
  );

  return { books, others };
}

export function useDocumentsMeta(initialLimit = 20): UseDocumentsMetaResult {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(initialLimit);
  const [total, setTotal] = useState(0);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    const supabase = getClient();
    if (!supabase) {
      setError('数据库连接失败');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 首先尝试从 documents_meta 表获取
      let query = supabase
        .from('documents_meta')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (sourceTypeFilter) {
        query = query.eq('source_type', sourceTypeFilter);
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        // 如果 documents_meta 表不存在，降级到 documents 表
        console.warn('[useDocumentsMeta] documents_meta not available, falling back to documents');
        
        let fallbackQuery = supabase
          .from('documents')
          .select('id, title, source_type, content, metadata, created_at', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (sourceTypeFilter) {
          fallbackQuery = fallbackQuery.eq('source_type', sourceTypeFilter);
        }

        const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery;

        if (fallbackError) {
          throw fallbackError;
        }

        // 转换为 DocumentMeta 格式
        const convertedData: DocumentMeta[] = (fallbackData || []).map((doc: any) => ({
          id: String(doc.id),
          title: doc.title || doc.metadata?.title || '未命名文档',
          source_type: doc.source_type || 'article',
          chunk_count: 1,
          metadata: doc.metadata || {},
          created_at: doc.created_at,
          updated_at: doc.created_at
        }));

        setDocuments(convertedData);
        setTotal(fallbackCount || 0);
      } else {
        setDocuments(data || []);
        setTotal(count || 0);
      }
    } catch (e) {
      console.error('[useDocumentsMeta] Error:', e);
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, sourceTypeFilter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // 聚合书籍
  const { books, others } = aggregateBooks(documents);

  return {
    documents,
    books,
    others,
    isLoading,
    error,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    refetch: fetchDocuments,
    setPage,
    setSourceTypeFilter
  };
}
