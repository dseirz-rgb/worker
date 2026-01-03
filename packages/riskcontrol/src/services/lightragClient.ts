/**
 * LightRAG Client - TypeScript client for LightRAG Python service
 * 
 * Provides methods for:
 * - Document indexing
 * - Knowledge graph queries (naive, local, global, hybrid modes)
 * - Document deletion
 * - Health checks
 */

import { EXTERNAL_SERVICES } from './apiConfig';

// Types
export interface IndexRequest {
  document_id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface IndexResponse {
  success: boolean;
  document_id: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface QueryRequest {
  query: string;
  mode?: 'naive' | 'local' | 'global' | 'hybrid';
}

export interface QueryResponse {
  success: boolean;
  query: string;
  mode: string;
  result?: string;
  error?: string;
}

export interface DeleteResponse {
  success: boolean;
  document_id: string;
  message: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lightrag_available: boolean;
  working_dir: string;
  indexed_documents_count: number;
  details?: Record<string, unknown>;
}

export interface DocumentInfo {
  document_id: string;
  content_length: number;
  metadata: Record<string, unknown>;
}

export interface ListDocumentsResponse {
  count: number;
  documents: DocumentInfo[];
}

// Configuration
const DEFAULT_TIMEOUT = 3000; // 3 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY = 500; // 500ms

/**
 * Get the LightRAG service URL from apiConfig
 */
function getServiceUrl(): string {
  return EXTERNAL_SERVICES.LIGHTRAG.replace(/\/$/, ''); // Remove trailing slash
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES,
  timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeout);
      return response;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on abort (timeout)
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      // Wait before retry
      if (attempt < retries) {
        await sleep(RETRY_DELAY * (attempt + 1));
      }
    }
  }
  
  throw lastError || new Error('Request failed after retries');
}

/**
 * LightRAG Client class
 */
export class LightRAGClient {
  private baseUrl: string;
  private timeout: number;
  
  constructor(baseUrl?: string, timeout: number = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl || getServiceUrl();
    this.timeout = timeout;
  }
  
  /**
   * Index a document into the knowledge graph
   */
  async indexDocument(
    documentId: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<IndexResponse> {
    const url = `${this.baseUrl}/index`;
    const body: IndexRequest = {
      document_id: documentId,
      content,
      metadata,
    };
    
    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      MAX_RETRIES,
      this.timeout * 10 // Indexing can take longer
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Index failed: ${error}`);
    }
    
    return response.json();
  }
  
  /**
   * Query the knowledge graph
   */
  async query(
    queryText: string,
    mode: 'naive' | 'local' | 'global' | 'hybrid' = 'hybrid'
  ): Promise<QueryResponse> {
    const url = `${this.baseUrl}/query`;
    const body: QueryRequest = {
      query: queryText,
      mode,
    };
    
    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      MAX_RETRIES,
      this.timeout
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Query failed: ${error}`);
    }
    
    return response.json();
  }
  
  /**
   * Delete a document from the knowledge graph
   */
  async deleteDocument(documentId: string): Promise<DeleteResponse> {
    const url = `${this.baseUrl}/document/${encodeURIComponent(documentId)}`;
    
    const response = await fetchWithRetry(
      url,
      { method: 'DELETE' },
      MAX_RETRIES,
      this.timeout
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Delete failed: ${error}`);
    }
    
    return response.json();
  }
  
  /**
   * Check service health
   */
  async health(): Promise<HealthResponse> {
    const url = `${this.baseUrl}/health`;
    
    const response = await fetchWithRetry(
      url,
      { method: 'GET' },
      1, // Only 1 retry for health check
      this.timeout
    );
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    
    return response.json();
  }
  
  /**
   * List all indexed documents
   */
  async listDocuments(): Promise<ListDocumentsResponse> {
    const url = `${this.baseUrl}/documents`;
    
    const response = await fetchWithRetry(
      url,
      { method: 'GET' },
      MAX_RETRIES,
      this.timeout
    );
    
    if (!response.ok) {
      throw new Error(`List documents failed: ${response.status}`);
    }
    
    return response.json();
  }
  
  /**
   * Check if service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.health();
      return health.status === 'healthy';
    } catch {
      return false;
    }
  }
}

// Default singleton instance
export const lightragClient = new LightRAGClient();

// Convenience functions
export async function indexDocument(
  documentId: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<IndexResponse> {
  return lightragClient.indexDocument(documentId, content, metadata);
}

export async function queryKnowledge(
  query: string,
  mode: 'naive' | 'local' | 'global' | 'hybrid' = 'hybrid'
): Promise<QueryResponse> {
  return lightragClient.query(query, mode);
}

export async function deleteDocument(documentId: string): Promise<DeleteResponse> {
  return lightragClient.deleteDocument(documentId);
}

export async function checkHealth(): Promise<HealthResponse> {
  return lightragClient.health();
}

export async function isLightRAGAvailable(): Promise<boolean> {
  return lightragClient.isAvailable();
}
