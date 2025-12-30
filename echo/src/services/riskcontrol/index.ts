/**
 * RiskControl 投资组合集成服务
 * 连接外部投资管理系统
 */

import type { DbResult } from '../../types/database';

// RiskControl 配置
interface RiskControlConfig {
  apiUrl: string;
  apiKey: string;
}

// 投资组合摘要
export interface PortfolioSummary {
  totalValue: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  totalPnL: number;
  totalPnLPercent: number;
  positions: number;
  lastUpdated: string;
}

// 持仓信息
export interface Position {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
  weight: number;
}

// 风险指标
export interface RiskMetrics {
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  beta: number;
  var95: number;
}

// 存储配置
let config: RiskControlConfig | null = null;

/**
 * 设置 RiskControl 配置
 */
export function setRiskControlConfig(newConfig: RiskControlConfig): void {
  config = newConfig;
  localStorage.setItem('riskcontrol_config', JSON.stringify(newConfig));
}

/**
 * 获取 RiskControl 配置
 */
export function getRiskControlConfig(): RiskControlConfig | null {
  if (config) return config;
  const stored = localStorage.getItem('riskcontrol_config');
  if (stored) {
    config = JSON.parse(stored);
    return config;
  }
  return null;
}

/**
 * 清除 RiskControl 配置
 */
export function clearRiskControlConfig(): void {
  config = null;
  localStorage.removeItem('riskcontrol_config');
}

/**
 * RiskControl API 请求
 */
async function riskControlFetch<T>(endpoint: string): Promise<DbResult<T>> {
  const cfg = getRiskControlConfig();
  if (!cfg?.apiUrl || !cfg?.apiKey) {
    return { success: false, error: '未配置 RiskControl API' };
  }

  try {
    const response = await fetch(`${cfg.apiUrl}${endpoint}`, {
      headers: {
        'X-API-Key': cfg.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return { success: false, error: `API 错误: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('RiskControl API 请求失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'API 请求失败',
    };
  }
}

/**
 * 获取投资组合摘要
 */
export async function getPortfolioSummary(): Promise<DbResult<PortfolioSummary>> {
  return riskControlFetch<PortfolioSummary>('/api/portfolio/summary');
}

/**
 * 获取持仓列表
 */
export async function getPositions(): Promise<DbResult<Position[]>> {
  return riskControlFetch<Position[]>('/api/portfolio/positions');
}

/**
 * 获取风险指标
 */
export async function getRiskMetrics(): Promise<DbResult<RiskMetrics>> {
  return riskControlFetch<RiskMetrics>('/api/portfolio/risk');
}

/**
 * 生成投资摘要文本（用于 AI 对话和日报）
 */
export async function generateInvestmentSummary(): Promise<DbResult<string>> {
  const [summaryResult, positionsResult] = await Promise.all([
    getPortfolioSummary(),
    getPositions(),
  ]);

  if (!summaryResult.success || !summaryResult.data) {
    return { success: false, error: summaryResult.error || '获取投资数据失败' };
  }

  const summary = summaryResult.data;
  const positions = positionsResult.data || [];

  // 格式化金额
  const formatMoney = (n: number) => 
    n.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' });
  
  // 格式化百分比
  const formatPercent = (n: number) => 
    `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  // 生成摘要文本
  let text = `📊 投资组合摘要\n`;
  text += `总市值: ${formatMoney(summary.totalValue)}\n`;
  text += `今日盈亏: ${formatMoney(summary.dailyPnL)} (${formatPercent(summary.dailyPnLPercent)})\n`;
  text += `总盈亏: ${formatMoney(summary.totalPnL)} (${formatPercent(summary.totalPnLPercent)})\n`;
  text += `持仓数: ${summary.positions}\n\n`;

  if (positions.length > 0) {
    text += `📈 主要持仓:\n`;
    positions
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .forEach((p) => {
        text += `- ${p.name} (${p.symbol}): ${formatMoney(p.marketValue)} ${formatPercent(p.pnlPercent)}\n`;
      });
  }

  return { success: true, data: text };
}
