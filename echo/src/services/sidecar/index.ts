/**
 * Sidecar 管理服务
 * 管理 Python SeekDB Sidecar 进程的启动、停止和健康检查
 */

import { seekdbService } from '../database/seekdbService';

// ============== 配置 ==============

const SIDECAR_CONFIG = {
  port: 8765,
  host: 'localhost',
  startupTimeout: 10000,  // 10 秒启动超时
  healthCheckInterval: 30000,  // 30 秒健康检查间隔
  maxRestartAttempts: 3,
};

// ============== 状态 ==============

interface SidecarState {
  isRunning: boolean;
  lastHealthCheck: Date | null;
  restartAttempts: number;
  healthCheckTimer: ReturnType<typeof setInterval> | null;
}

const state: SidecarState = {
  isRunning: false,
  lastHealthCheck: null,
  restartAttempts: 0,
  healthCheckTimer: null,
};

// ============== 健康检查 ==============

/**
 * 检查 Sidecar 是否运行
 */
export async function checkSidecarHealth(): Promise<boolean> {
  try {
    const isHealthy = await seekdbService.healthCheck();
    state.isRunning = isHealthy;
    state.lastHealthCheck = new Date();
    
    if (isHealthy) {
      state.restartAttempts = 0;
    }
    
    return isHealthy;
  } catch {
    state.isRunning = false;
    return false;
  }
}

/**
 * 获取 Sidecar 状态
 */
export function getSidecarStatus(): {
  isRunning: boolean;
  lastHealthCheck: Date | null;
  restartAttempts: number;
} {
  return {
    isRunning: state.isRunning,
    lastHealthCheck: state.lastHealthCheck,
    restartAttempts: state.restartAttempts,
  };
}

// ============== 启动和停止 ==============

/**
 * 等待 Sidecar 启动
 */
export async function waitForSidecar(timeout = SIDECAR_CONFIG.startupTimeout): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const isHealthy = await checkSidecarHealth();
    if (isHealthy) {
      console.log('[Sidecar] 服务已就绪');
      return true;
    }
    
    // 等待 500ms 后重试
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.warn('[Sidecar] 启动超时');
  return false;
}

/**
 * 启动健康检查定时器
 */
export function startHealthCheckTimer(): void {
  if (state.healthCheckTimer) {
    return;
  }
  
  state.healthCheckTimer = setInterval(async () => {
    const isHealthy = await checkSidecarHealth();
    
    if (!isHealthy) {
      console.warn('[Sidecar] 健康检查失败，服务可能已停止');
      
      // 尝试重启（如果在 Tauri 环境中）
      if (state.restartAttempts < SIDECAR_CONFIG.maxRestartAttempts) {
        state.restartAttempts++;
        console.log(`[Sidecar] 尝试重启 (${state.restartAttempts}/${SIDECAR_CONFIG.maxRestartAttempts})`);
        // 重启逻辑由 Tauri 后端处理
      }
    }
  }, SIDECAR_CONFIG.healthCheckInterval);
  
  console.log('[Sidecar] 健康检查定时器已启动');
}

/**
 * 停止健康检查定时器
 */
export function stopHealthCheckTimer(): void {
  if (state.healthCheckTimer) {
    clearInterval(state.healthCheckTimer);
    state.healthCheckTimer = null;
    console.log('[Sidecar] 健康检查定时器已停止');
  }
}

// ============== 初始化 ==============

/**
 * 初始化 Sidecar 服务
 */
export async function initSidecar(): Promise<boolean> {
  console.log('[Sidecar] 正在初始化...');
  
  // 检查服务是否已运行
  const isRunning = await checkSidecarHealth();
  
  if (isRunning) {
    console.log('[Sidecar] 服务已在运行');
    startHealthCheckTimer();
    return true;
  }
  
  // 等待服务启动（由 Tauri 后端启动）
  console.log('[Sidecar] 等待服务启动...');
  const started = await waitForSidecar();
  
  if (started) {
    startHealthCheckTimer();
    return true;
  }
  
  console.warn('[Sidecar] 服务未能启动，语义搜索功能将不可用');
  return false;
}

/**
 * 清理 Sidecar 服务
 */
export function cleanupSidecar(): void {
  stopHealthCheckTimer();
  state.isRunning = false;
  console.log('[Sidecar] 已清理');
}

// ============== 导出 ==============

export const sidecarService = {
  init: initSidecar,
  cleanup: cleanupSidecar,
  checkHealth: checkSidecarHealth,
  getStatus: getSidecarStatus,
  waitForReady: waitForSidecar,
  startHealthCheck: startHealthCheckTimer,
  stopHealthCheck: stopHealthCheckTimer,
};
