/**
 * Risk API Client - 风控 API TypeScript SDK
 * Feature: intelligent-risk-engine
 * 
 * 封装风控 API 调用
 * 
 * Requirements: 10.5
 */

// === Types ===

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskStatus {
  overallRiskLevel: RiskLevel;
  effectiveLeverage: number;
  effectiveStopLoss: number;
  tradingAllowed: boolean;
  cooldownUntil: string | null;
  confidence: number;
  alertCount: number;
  lastUpdated: string;
}

export interface RiskDecision {
  id: string;
  timestamp: string;
  overallRiskLevel: RiskLevel;
  effectiveLeverage: number;
  effectiveStopLoss: number;
  tradingAllowed: boolean;
  cooldownUntil: string | null;
  leverageLimit: {
    maxLeverage: number;
    reason: string;
    marketRegime: string;
  };
  stopLossConfig: {
    stopLossPercent: number;
    reason: string;
    volatilityPercentile: number;
  };
  riskForecast: {
    level: RiskLevel;
    horizonDays: number;
    alertCount: number;
    confidence: number;
  };
  reasoning: string[];
  confidence: number;
  isOverridden: boolean;
  overrideReason?: string;
  overrideBy?: string;
  overrideAt?: string;
}

export interface DecisionRecord {
  id: string;
  timestamp: string;
  overallRiskLevel: RiskLevel;
  effectiveLeverage: number;
  effectiveStopLoss: number;
  tradingAllowed: boolean;
  confidence: number;
  isOverridden: boolean;
}

export interface AlertRecord {
  id: string;
  createdAt: string;
  alertType: string;
  severity: string;
  message: string;
  suggestedAction: string | null;
  acknowledged: boolean;
}

export interface RiskHistory {
  decisions?: DecisionRecord[];
  alerts?: AlertRecord[];
  summary?: {
    totalDecisions: number;
    totalAlerts: number;
    avgRiskLevel: string;
    avgLeverage: number;
    avgStopLoss: number;
  };
}

export interface HistoryOptions {
  days?: number;
  limit?: number;
  offset?: number;
  type?: 'decisions' | 'alerts' | 'all';
}

// === API Response Types ===

interface ApiResponse<T> {
  status: 'ok' | 'error';
  timestamp: string;
  data?: T;
  error?: string;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
  };
}

// === Client Class ===

export class RiskApiClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(options?: { baseUrl?: string; apiKey?: string }) {
    this.baseUrl = options?.baseUrl || '/api/risk';
    this.headers = {
      'Content-Type': 'application/json',
    };
    
    if (options?.apiKey) {
      this.headers['Authorization'] = `Bearer ${options.apiKey}`;
    }
  }

  /**
   * 获取当前风控状态
   */
  async getStatus(): Promise<RiskStatus> {
    const response = await fetch(`${this.baseUrl}/status`, {
      method: 'GET',
      headers: this.headers,
    });

    const result: ApiResponse<RiskStatus> = await response.json();

    if (result.status === 'error' || !result.data) {
      throw new Error(result.error || '获取风控状态失败');
    }

    return result.data;
  }

  /**
   * 获取当前风控决策
   */
  async getDecision(id?: string): Promise<RiskDecision> {
    const url = id 
      ? `${this.baseUrl}/decision?id=${encodeURIComponent(id)}`
      : `${this.baseUrl}/decision`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers,
    });

    const result: ApiResponse<RiskDecision> = await response.json();

    if (result.status === 'error' || !result.data) {
      throw new Error(result.error || '获取风控决策失败');
    }

    return result.data;
  }

  /**
   * 获取风控历史
   */
  async getHistory(options?: HistoryOptions): Promise<{
    data: RiskHistory;
    pagination?: { limit: number; offset: number; total: number };
  }> {
    const params = new URLSearchParams();
    
    if (options?.days) params.set('days', options.days.toString());
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());
    if (options?.type) params.set('type', options.type);

    const url = `${this.baseUrl}/history${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers,
    });

    const result: ApiResponse<RiskHistory> = await response.json();

    if (result.status === 'error' || !result.data) {
      throw new Error(result.error || '获取风控历史失败');
    }

    return {
      data: result.data,
      pagination: result.pagination,
    };
  }

  /**
   * 检查是否允许交易
   */
  async canTrade(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.tradingAllowed;
    } catch {
      // 出错时默认不允许交易（保守策略）
      return false;
    }
  }

  /**
   * 获取当前杠杆限制
   */
  async getLeverageLimit(): Promise<number> {
    try {
      const status = await this.getStatus();
      return status.effectiveLeverage;
    } catch {
      // 出错时返回最保守的杠杆
      return 1.0;
    }
  }

  /**
   * 获取当前止损线
   */
  async getStopLoss(): Promise<number> {
    try {
      const status = await this.getStatus();
      return status.effectiveStopLoss;
    } catch {
      // 出错时返回默认止损
      return -0.10;
    }
  }

  /**
   * 获取活跃预警数量
   */
  async getAlertCount(): Promise<number> {
    try {
      const status = await this.getStatus();
      return status.alertCount;
    } catch {
      return 0;
    }
  }

  /**
   * 获取风险等级
   */
  async getRiskLevel(): Promise<RiskLevel> {
    try {
      const status = await this.getStatus();
      return status.overallRiskLevel;
    } catch {
      // 出错时返回中等风险
      return 'medium';
    }
  }
}

// === Singleton Instance ===

export const riskApiClient = new RiskApiClient();

// === Utility Functions ===

/**
 * 获取风险等级标签
 */
export function getRiskLevelLabel(level: RiskLevel): string {
  switch (level) {
    case 'low': return '低风险';
    case 'medium': return '中等风险';
    case 'high': return '高风险';
    case 'critical': return '极高风险';
  }
}

/**
 * 获取风险等级颜色
 */
export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'low': return '#22c55e';
    case 'medium': return '#eab308';
    case 'high': return '#f97316';
    case 'critical': return '#ef4444';
  }
}

/**
 * 格式化止损百分比
 */
export function formatStopLoss(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

/**
 * 格式化杠杆
 */
export function formatLeverage(value: number): string {
  return `${value.toFixed(2)}x`;
}

export default riskApiClient;
