/**
 * Paperless 文件管理 React Hooks
 * 
 * 提供文档、标签、文档类型、通讯者的 CRUD 操作
 * 使用 useState + useEffect + useCallback 模式，与项目架构保持一致
 * 
 * @module hooks/usePaperless
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/trpc';

// ============================================
// 类型定义
// ============================================

/** 文档过滤器 */
export interface DocumentFilters {
  tagIds?: number[];
  documentTypeId?: number;
  correspondentId?: number;
  dateFrom?: string;
  dateTo?: string;
  type?: string;
}

/** Paperless 文档 */
export interface PaperlessDocument {
  id: number;
  title: string;
  original_file_name: string;
  created: string;
  modified: string;
  added: string;
  archive_serial_number: number | null;
  correspondent: number | null;
  document_type: number | null;
  storage_path: string;
  tags: number[];
  content: string;
  notes: unknown[];
  score?: number;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** 标签 */
export interface PaperlessTag {
  id: number;
  name: string;
  color: string;
  slug: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
  document_count: number;
}

/** 文档类型 */
export interface PaperlessDocumentType {
  id: number;
  name: string;
  slug: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
  document_count: number;
}

/** 通讯者 */
export interface PaperlessCorrespondent {
  id: number;
  name: string;
  slug: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
  document_count: number;
}

/** Paperless 配置 */
export interface PaperlessConfig {
  baseUrl: string;
  apiToken: string;
  enabled: boolean;
}

// ============================================
// 文档查询 Hooks
// ============================================

/**
 * 获取文档列表 (支持无限滚动)
 * 
 * @param params - 查询参数
 * @returns 文档列表、加载状态、分页方法
 */
export function useDocuments(params: {
  searchQuery?: string;
  filters?: DocumentFilters;
  pageSize?: number;
  enabled?: boolean;
}) {
  const [pages, setPages] = useState<PaginatedResponse<PaperlessDocument>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const currentPageRef = useRef(1);

  // 获取第一页数据
  const fetchFirstPage = useCallback(async () => {
    if (params.enabled === false) return;
    
    setIsLoading(true);
    setError(null);
    currentPageRef.current = 1;
    
    try {
      const result = await api.paperless.listDocuments.query({
        page: 1,
        pageSize: params.pageSize || 20,
        tagIds: params.filters?.tagIds,
        documentTypeId: params.filters?.documentTypeId,
        correspondentId: params.filters?.correspondentId,
        dateFrom: params.filters?.dateFrom,
        dateTo: params.filters?.dateTo,
        type: params.filters?.type,
      });
      
      setPages([result]);
      setHasNextPage(!!result.next);
    } catch (err) {
      console.error('[useDocuments] 获取文档列表失败:', err);
      setError(err as Error);
      setPages([]);
    } finally {
      setIsLoading(false);
    }
  }, [params.enabled, params.pageSize, params.filters, params.searchQuery]);

  // 获取下一页数据
  const fetchNextPage = useCallback(async () => {
    if (!hasNextPage || isFetchingNextPage) return;
    
    setIsFetchingNextPage(true);
    const nextPage = currentPageRef.current + 1;
    
    try {
      const result = await api.paperless.listDocuments.query({
        page: nextPage,
        pageSize: params.pageSize || 20,
        tagIds: params.filters?.tagIds,
        documentTypeId: params.filters?.documentTypeId,
        correspondentId: params.filters?.correspondentId,
        dateFrom: params.filters?.dateFrom,
        dateTo: params.filters?.dateTo,
        type: params.filters?.type,
      });
      
      setPages(prev => [...prev, result]);
      setHasNextPage(!!result.next);
      currentPageRef.current = nextPage;
    } catch (err) {
      console.error('[useDocuments] 获取下一页失败:', err);
      setError(err as Error);
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [hasNextPage, isFetchingNextPage, params.pageSize, params.filters]);

  // 搜索文档
  const searchDocuments = useCallback(async (query: string) => {
    if (!query.trim()) {
      await fetchFirstPage();
      return;
    }
    
    setIsLoading(true);
    setError(null);
    currentPageRef.current = 1;
    
    try {
      const result = await api.paperless.searchDocuments.query({
        query,
        page: 1,
        pageSize: params.pageSize || 20,
      });
      
      setPages([result]);
      setHasNextPage(!!result.next);
    } catch (err) {
      console.error('[useDocuments] 搜索文档失败:', err);
      setError(err as Error);
      setPages([]);
    } finally {
      setIsLoading(false);
    }
  }, [params.pageSize, fetchFirstPage]);

  // 刷新数据
  const refetch = useCallback(() => {
    if (params.searchQuery) {
      searchDocuments(params.searchQuery);
    } else {
      fetchFirstPage();
    }
  }, [params.searchQuery, searchDocuments, fetchFirstPage]);

  // 初始化加载
  useEffect(() => {
    refetch();
  }, [params.searchQuery, params.filters, params.enabled]);

  // 合并所有页面的文档
  const documents = pages.flatMap(page => page.results);
  const totalCount = pages[0]?.count || 0;

  return {
    data: { pages, documents, totalCount },
    isLoading,
    isFetchingNextPage,
    error,
    hasNextPage,
    fetchNextPage,
    refetch,
  };
}


/**
 * 获取单个文档详情
 * 
 * @param id - 文档 ID
 * @returns 文档详情、加载状态
 */
export function useDocument(id: number | null) {
  const [data, setData] = useState<PaperlessDocument | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setData(null);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.paperless.getDocument.query({ id });
      setData(result);
    } catch (err) {
      console.error('[useDocument] 获取文档详情失败:', err);
      setError(err as Error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [id]);

  return { data, isLoading, error, refetch };
}

/**
 * 获取文档预览 URL
 * 
 * @param id - 文档 ID
 * @returns 预览 URL (base64 data URI)
 */
export function useDocumentPreview(id: number | null) {
  const [data, setData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setData(null);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.paperless.getPreview.query({ id });
      // 转换为 data URI
      setData(`data:${result.contentType};base64,${result.data}`);
    } catch (err) {
      console.error('[useDocumentPreview] 获取预览失败:', err);
      setError(err as Error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [id]);

  return { data, isLoading, error, refetch };
}


/**
 * 获取文档缩略图 URL
 * 
 * @param id - 文档 ID
 * @returns 缩略图 URL (base64 data URI)
 */
export function useDocumentThumbnail(id: number) {
  const [data, setData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setData(null);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.paperless.getThumbnail.query({ id });
      // 转换为 data URI
      setData(`data:${result.contentType};base64,${result.data}`);
    } catch (err) {
      console.error('[useDocumentThumbnail] 获取缩略图失败:', err);
      setError(err as Error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [id]);

  return { data, isLoading, error, refetch };
}

// ============================================
// 文档变更 Hooks
// ============================================

/**
 * 上传文档
 * 
 * @returns mutate 方法和状态
 */
export function useUploadDocument() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<{ task_id: string } | null>(null);

  const mutate = useCallback(async (input: {
    fileBase64: string;
    filename: string;
    title?: string;
    tagIds?: number[];
    documentTypeId?: number;
  }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.paperless.uploadDocument.mutate(input);
      setData(result);
      return result;
    } catch (err) {
      console.error('[useUploadDocument] 上传失败:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { mutate, isLoading, error, data, reset };
}


/**
 * 更新文档
 * 
 * @returns mutate 方法和状态
 */
export function useUpdateDocument() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: {
    id: number;
    title?: string;
    tagIds?: number[];
    documentTypeId?: number | null;
    correspondentId?: number | null;
  }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.paperless.updateDocument.mutate(input);
      return result;
    } catch (err) {
      console.error('[useUpdateDocument] 更新失败:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}

/**
 * 删除文档
 * 
 * @returns mutate 方法和状态
 */
export function useDeleteDocument() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: { id: number }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.paperless.deleteDocument.mutate(input);
      return result;
    } catch (err) {
      console.error('[useDeleteDocument] 删除失败:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}

// ============================================
// 标签 Hooks
// ============================================

/**
 * 获取标签列表
 * 
 * @returns 标签列表、加载状态
 */
export function useTags() {
  const [data, setData] = useState<PaperlessTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.paperless.listTags.query();
      setData(result.results || []);
    } catch (err) {
      console.error('[useTags] 获取标签列表失败:', err);
      setError(err as Error);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, []);

  return { data, isLoading, error, refetch };
}


/**
 * 创建标签
 * 
 * @returns mutate 方法和状态
 */
export function useCreateTag() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: { name: string; color?: string }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.paperless.createTag.mutate(input);
      return result;
    } catch (err) {
      console.error('[useCreateTag] 创建标签失败:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}

/**
 * 更新标签
 * 
 * @returns mutate 方法和状态
 */
export function useUpdateTag() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (_input: { 
    id: number; 
    name?: string; 
    color?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 注意：当前 tRPC 路由没有 updateTag，使用 deleteTag + createTag 模拟
      // 如果后端添加了 updateTag 路由，可以直接调用
      console.warn('[useUpdateTag] 当前后端不支持更新标签，请先删除再创建');
      throw new Error('当前后端不支持更新标签');
    } catch (err) {
      console.error('[useUpdateTag] 更新标签失败:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}

/**
 * 删除标签
 * 
 * @returns mutate 方法和状态
 */
export function useDeleteTag() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: { id: number }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.paperless.deleteTag.mutate(input);
      return result;
    } catch (err) {
      console.error('[useDeleteTag] 删除标签失败:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}


// ============================================
// 文档类型 Hooks
// ============================================

/**
 * 获取文档类型列表
 * 
 * @returns 文档类型列表、加载状态
 */
export function useDocumentTypes() {
  const [data, setData] = useState<PaperlessDocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.paperless.listDocumentTypes.query();
      setData(result.results || []);
    } catch (err) {
      console.error('[useDocumentTypes] 获取文档类型列表失败:', err);
      setError(err as Error);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, []);

  return { data, isLoading, error, refetch };
}

/**
 * 创建文档类型
 * 
 * @returns mutate 方法和状态
 */
export function useCreateDocumentType() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: { name: string }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.paperless.createDocumentType.mutate(input);
      return result;
    } catch (err) {
      console.error('[useCreateDocumentType] 创建文档类型失败:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}

/**
 * 删除文档类型
 * 
 * @returns mutate 方法和状态
 */
export function useDeleteDocumentType() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (_input: { id: number }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 注意：当前 tRPC 路由没有 deleteDocumentType
      // 文档类型是从 attachments.type 聚合的，不需要单独删除
      console.warn('[useDeleteDocumentType] 文档类型是自动聚合的，无法删除');
      throw new Error('文档类型是自动聚合的，无法删除');
    } catch (err) {
      console.error('[useDeleteDocumentType] 删除文档类型失败:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}


// ============================================
// 通讯者 Hooks
// ============================================

/**
 * 获取通讯者列表
 * 
 * @returns 通讯者列表、加载状态
 */
export function useCorrespondents() {
  const [data, setData] = useState<PaperlessCorrespondent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.paperless.listCorrespondents.query();
      setData(result.results || []);
    } catch (err) {
      console.error('[useCorrespondents] 获取通讯者列表失败:', err);
      setError(err as Error);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, []);

  return { data, isLoading, error, refetch };
}

/**
 * 创建通讯者
 * 
 * @returns mutate 方法和状态
 */
export function useCreateCorrespondent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (_input: { name: string }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 注意：当前后端暂不支持通讯者功能
      console.warn('[useCreateCorrespondent] 当前后端暂不支持通讯者功能');
      throw new Error('当前后端暂不支持通讯者功能');
    } catch (err) {
      console.error('[useCreateCorrespondent] 创建通讯者失败:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}

/**
 * 删除通讯者
 * 
 * @returns mutate 方法和状态
 */
export function useDeleteCorrespondent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (_input: { id: number }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 注意：当前后端暂不支持通讯者功能
      console.warn('[useDeleteCorrespondent] 当前后端暂不支持通讯者功能');
      throw new Error('当前后端暂不支持通讯者功能');
    } catch (err) {
      console.error('[useDeleteCorrespondent] 删除通讯者失败:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}


// ============================================
// 配置 Hooks
// ============================================

/**
 * 获取 Paperless 配置
 * 
 * @returns 配置信息、加载状态
 */
export function usePaperlessConfig() {
  const [data, setData] = useState<PaperlessConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.paperless.getConfig.query();
      setData(result);
    } catch (err) {
      console.error('[usePaperlessConfig] 获取配置失败:', err);
      setError(err as Error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, []);

  return { data, isLoading, error, refetch };
}

/**
 * 保存 Paperless 配置
 * 
 * @returns mutate 方法和状态
 */
export function useSavePaperlessConfig() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: { 
    baseUrl?: string; 
    apiToken?: string;
    enabled?: boolean;
  }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.paperless.saveConfig.mutate(input);
      return result;
    } catch (err) {
      console.error('[useSavePaperlessConfig] 保存配置失败:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}

/**
 * 测试 Paperless 连接
 * 
 * @returns mutate 方法和状态
 */
export function useTestPaperlessConnection() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<{
    success: boolean;
    error: string | null;
    postgresOk: boolean;
  } | null>(null);

  const mutate = useCallback(async (input: { 
    baseUrl?: string; 
    apiToken?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.paperless.testConnection.mutate(input);
      setData(result);
      return result;
    } catch (err) {
      console.error('[useTestPaperlessConnection] 测试连接失败:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { mutate, isLoading, error, data, reset };
}


// ============================================
// 统计信息 Hooks
// ============================================

/**
 * 获取文件统计信息
 * 
 * @param accountId - 可选的账户 ID
 * @returns 统计信息、加载状态
 */
export function usePaperlessStats(accountId?: number) {
  const [data, setData] = useState<{
    totalCount: number;
    indexedCount: number;
    totalSize: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.paperless.getStats.query({ accountId });
      setData(result);
    } catch (err) {
      console.error('[usePaperlessStats] 获取统计信息失败:', err);
      setError(err as Error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    refetch();
  }, [accountId]);

  return { data, isLoading, error, refetch };
}

// ============================================
// 工具函数
// ============================================

/**
 * 将文件转换为 Base64
 * 
 * @param file - 文件对象
 * @returns Base64 字符串
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // 移除 data:xxx;base64, 前缀
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * 下载文档
 * 
 * @param id - 文档 ID
 * @param filename - 文件名
 */
export async function downloadDocument(id: number, filename?: string) {
  try {
    const result = await api.paperless.downloadDocument.query({ id });
    
    // 创建 Blob 并下载
    const byteCharacters = atob(result.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray]);
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || result.filename || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[downloadDocument] 下载失败:', err);
    throw err;
  }
}

// ============================================
// 导出所有 Hooks
// ============================================

export default {
  // 文档查询
  useDocuments,
  useDocument,
  useDocumentPreview,
  useDocumentThumbnail,
  
  // 文档变更
  useUploadDocument,
  useUpdateDocument,
  useDeleteDocument,
  
  // 标签
  useTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  
  // 文档类型
  useDocumentTypes,
  useCreateDocumentType,
  useDeleteDocumentType,
  
  // 通讯者
  useCorrespondents,
  useCreateCorrespondent,
  useDeleteCorrespondent,
  
  // 配置
  usePaperlessConfig,
  useSavePaperlessConfig,
  useTestPaperlessConnection,
  
  // 统计
  usePaperlessStats,
  
  // 工具函数
  fileToBase64,
  downloadDocument,
};
