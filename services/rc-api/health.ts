/**
 * Health Check API - 综合健康状态检查
 * 
 * GET /api/health
 * 
 * 检查：
 * 1. Supabase 连接状态
 * 2. LightRAG 服务状态
 * 
 * @module api/health
 */

import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const LIGHTRAG_URL = process.env.LIGHTRAG_SERVICE_URL || 'https://lightrag-service-dpbimyzyja-uc.a.run.app';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    supabase: {
      status: 'up' | 'down';
      latency_ms?: number;
      error?: string;
    };
    lightrag: {
      status: 'up' | 'down' | 'degraded';
      latency_ms?: number;
      rag_available?: boolean;
      error?: string;
    };
  };
}

async function checkSupabase(): Promise<HealthStatus['services']['supabase']> {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    return { status: 'down', error: 'Missing configuration' };
  }
  
  const start = Date.now();
  try {
    const supabase = createClient(url, key);
    const { error } = await supabase.from('documents_meta').select('id').limit(1);
    
    if (error) {
      // 表可能不存在，尝试 documents 表
      const { error: fallbackError } = await supabase.from('documents').select('id').limit(1);
      if (fallbackError) {
        return { status: 'down', latency_ms: Date.now() - start, error: fallbackError.message };
      }
    }
    
    return { status: 'up', latency_ms: Date.now() - start };
  } catch (error) {
    return { status: 'down', latency_ms: Date.now() - start, error: String(error) };
  }
}

async function checkLightRAG(): Promise<HealthStatus['services']['lightrag']> {
  const start = Date.now();
  try {
    const response = await fetch(`${LIGHTRAG_URL}/health`, {
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      return { status: 'down', latency_ms: Date.now() - start, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json() as { status?: string; error?: string };
    const latency = Date.now() - start;
    
    if (data.status === 'healthy') {
      return { status: 'up', latency_ms: latency, rag_available: true };
    } else if (data.status === 'degraded') {
      return { status: 'degraded', latency_ms: latency, rag_available: false, error: 'RAG not initialized' };
    } else {
      return { status: 'down', latency_ms: latency, error: data.error };
    }
  } catch (error) {
    return { status: 'down', latency_ms: Date.now() - start, error: String(error) };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 并行检查所有服务
  const [supabaseStatus, lightragStatus] = await Promise.all([
    checkSupabase(),
    checkLightRAG()
  ]);
  
  // 确定整体状态
  let overallStatus: HealthStatus['status'] = 'healthy';
  
  if (supabaseStatus.status === 'down') {
    overallStatus = 'unhealthy';
  } else if (lightragStatus.status === 'down') {
    overallStatus = 'degraded'; // LightRAG 不可用时降级运行
  } else if (lightragStatus.status === 'degraded') {
    overallStatus = 'degraded';
  }
  
  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: {
      supabase: supabaseStatus,
      lightrag: lightragStatus
    }
  };
  
  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;
  return res.status(httpStatus).json(healthStatus);
}
