/**
 * EchoAI 服务模块
 * 基于 Mastra Agent API，不再依赖 Khoj
 */

/**
 * EchoAI 连接配置
 */
export interface EchoAIConfig {
  enabled: boolean;
}

/**
 * 获取 EchoAI 配置
 */
export function getEchoAIConfig(): EchoAIConfig {
  if (typeof window === 'undefined') {
    return { enabled: true };
  }

  const savedEnabled = localStorage.getItem('echoai_enabled');
  return {
    enabled: savedEnabled === null ? true : savedEnabled === 'true',
  };
}

/**
 * 保存 EchoAI 配置
 */
export function saveEchoAIConfig(config: Partial<EchoAIConfig>): void {
  if (typeof window === 'undefined') return;

  if (config.enabled !== undefined) {
    localStorage.setItem('echoai_enabled', String(config.enabled));
  }
}

/**
 * 检查 EchoAI 服务是否可用
 * 现在通过后端 tRPC API 检查
 */
export async function checkEchoAIHealth(): Promise<boolean> {
  try {
    // 通过后端 API 检查服务状态
    const response = await fetch('/api/trpc/agent.getAgents', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 重置 EchoAI 配置
 */
export function resetEchoAIConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('echoai_enabled');
  // 清理旧的 Khoj 配置
  localStorage.removeItem('khoj_url');
  localStorage.removeItem('khoj_enabled');
  localStorage.removeItem('echoai_url');
}

/**
 * 连接状态类型
 */
export type EchoAIConnectionStatus = 'checking' | 'connected' | 'disconnected';
