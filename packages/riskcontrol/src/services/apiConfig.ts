/**
 * API Configuration for Vercel + Cloud Run Hybrid Architecture
 * 
 * 统一管理 API 端点配置，支持本地开发和生产环境
 * 
 * 架构说明：
 * - 前端 + API: Vercel (client/ + api/)
 * - LightRAG 服务: Cloud Run (lightrag-service)
 * - Voice 服务: Cloud Run (voice-service)
 * 
 * 本地开发：使用 vercel dev 或 Vite 代理
 * 生产环境：Vercel 托管，外部服务通过环境变量配置
 */

// 检测是否为生产环境
const isProduction = import.meta.env.PROD;

/**
 * 获取 API 基础 URL
 * 
 * Vercel 部署：始终使用相对路径（前端和 API 在同一服务）
 */
export function getApiBaseUrl(): string {
  return '';
}

/**
 * 构建完整的 API URL
 * 
 * @param path - API 路径，如 '/api/chat'
 * @returns 完整的 API URL
 */
export function buildApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * 外部服务 URL 配置（Cloud Run 服务）
 * 
 * 这些服务运行在 Cloud Run 上，需要通过环境变量配置完整 URL
 */
export const EXTERNAL_SERVICES = {
  /**
   * LightRAG 服务 URL
   * - 本地开发: http://localhost:9621
   * - 生产环境: GCP Cloud Run
   */
  LIGHTRAG: import.meta.env.VITE_LIGHTRAG_SERVICE_URL || 
    (import.meta.env.PROD ? 'https://lightrag-service-dpbimyzyja-uc.a.run.app' : 'http://localhost:9621'),
  
  /**
   * Voice 服务 URL
   * - 本地开发: http://localhost:8080
   * - 生产环境: https://voice-service-dpbimyzyja-uc.a.run.app
   */
  VOICE: import.meta.env.VITE_VOICE_SERVICE_URL || 
    (import.meta.env.PROD ? 'https://voice-service-dpbimyzyja-uc.a.run.app' : 'http://localhost:8080'),
  
  /**
   * Quant 服务 URL (数据+分析)
   * - 本地开发: http://localhost:6900
   * - 生产环境: GCP Cloud Run
   */
  QUANT: import.meta.env.VITE_QUANT_SERVICE_URL || 
    (import.meta.env.PROD ? 'https://quant-service-dpbimyzyja-uc.a.run.app' : 'http://localhost:6900'),
} as const;

// 预定义的 API 端点（Vercel Serverless Functions）
export const API_ENDPOINTS = {
  CHAT: buildApiUrl('/api/chat'),
  EMBEDDING: buildApiUrl('/api/embedding'),
  SEND_EMAIL: buildApiUrl('/api/send-email'),
  IMPORT_ARTICLE: buildApiUrl('/api/import-article'),
  UNIFIED_INTELLIGENCE_QUERY: buildApiUrl('/api/unified-intelligence/query'),
  UNIFIED_INTELLIGENCE_DEEP_ANALYZE: buildApiUrl('/api/unified-intelligence/deep-analyze'),
  UNIFIED_INTELLIGENCE_VOICE_CONTEXT: buildApiUrl('/api/unified-intelligence/voice-context'),
  HEALTH: buildApiUrl('/api/health'),
  DOCUMENTS: buildApiUrl('/api/documents'),
  DOCUMENTS_SEARCH: buildApiUrl('/api/documents/search'),
} as const;

// 导出配置信息（用于调试）
export const API_CONFIG = {
  isProduction,
  baseUrl: getApiBaseUrl(),
  externalServices: EXTERNAL_SERVICES,
};

// 开发环境下打印配置
if (!isProduction) {
  console.log('[API Config] Development mode');
  console.log('[API Config] LightRAG:', EXTERNAL_SERVICES.LIGHTRAG);
  console.log('[API Config] Voice:', EXTERNAL_SERVICES.VOICE);
  console.log('[API Config] Quant:', EXTERNAL_SERVICES.QUANT);
} else {
  console.log('[API Config] Production mode - Vercel deployment');
}
