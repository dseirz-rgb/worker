/**
 * 风控建议生成服务
 * 根据不同类型的风控警报生成具体的优化建议
 */

import type { RiskAlert, Position, PortfolioState } from '../types';

export interface RiskAdvice {
  title: string;
  severity: 'critical' | 'warning' | 'info';
  summary: string;
  riskAnalysis: string;
  scenarios: {
    name: string;
    priceChange: string;
    impact: string;
    result: string;
  }[];
  recommendations: {
    priority: number;
    action: string;
    detail: string;
    expectedEffect: string;
  }[];
  stopLoss?: {
    price: string;
    percentage: string;
    action: string;
  };
  timeline?: string;
}

/**
 * 根据风控警报生成优化建议
 */
export function generateRiskAdvice(
  alert: RiskAlert,
  portfolioState: PortfolioState,
  position?: Position
): RiskAdvice {
  switch (alert.type) {
    case 'POSITION_LIMIT':
      return generatePositionLimitAdvice(alert, portfolioState, position);
    case 'MAX_DRAWDOWN':
      return generateDrawdownAdvice(alert, portfolioState);
    case 'STOP_LOSS':
      return generateStopLossAdvice(alert, portfolioState, position);
    default:
      return generateGenericAdvice(alert);
  }
}

/**
 * 持仓集中度过高的建议
 */
function generatePositionLimitAdvice(
  alert: RiskAlert,
  portfolioState: PortfolioState,
  position?: Position
): RiskAdvice {
  const ticker = alert.ticker || '未知';
  const currentRatio = position?.weight || 0;
  const limit = alert.message.includes('特殊上限') ? 80.1 : 15;
  const excessRatio = currentRatio - limit;
  const marketValue = position?.marketValueCNY || 0;
  const quantity = position?.quantity || 0;
  const currentPrice = position?.currentPrice || 0;
  const costPrice = position?.avgCost || 0;
  const pnlPercent = position?.unrealizedPnLPercent || 0;
  const currency = position?.market === 'HK' ? 'HK$' : position?.market === 'US' ? '$' : '¥';
  
  // 计算需要减持的数量
  const targetRatio = limit * 0.95; // 目标降到上限的95%
  const targetValue = portfolioState.totalNetWorthCNY * (targetRatio / 100);
  const reduceValue = marketValue - targetValue;
  const reduceQuantity = Math.ceil(reduceValue / (currentPrice * (position?.market === 'US' ? 7.04 : position?.market === 'HK' ? 0.91 : 1)));
  
  // 情景分析
  const scenarios = [
    {
      name: '乐观情景',
      priceChange: '+10%',
      impact: `+¥${(marketValue * 0.1).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`,
      result: '净值创新高'
    },
    {
      name: '中性情景',
      priceChange: '0%',
      impact: '¥0',
      result: '维持现状'
    },
    {
      name: '悲观情景',
      priceChange: '-10%',
      impact: `-¥${(marketValue * 0.1).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`,
      result: `回撤扩大至 ${(portfolioState.drawdownPercent + (marketValue * 0.1 / portfolioState.highWaterMark * 100)).toFixed(1)}%`
    },
    {
      name: '极端情景',
      priceChange: '-20%',
      impact: `-¥${(marketValue * 0.2).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`,
      result: `回撤扩大至 ${(portfolioState.drawdownPercent + (marketValue * 0.2 / portfolioState.highWaterMark * 100)).toFixed(1)}%`
    }
  ];

  const recommendations = [
    {
      priority: 1,
      action: '分批减仓',
      detail: `建议在 1-2 周内分 3-4 批次减持 ${ticker}，每批减持约 ${Math.ceil(reduceQuantity / 4).toLocaleString()} 股`,
      expectedEffect: `将持仓占比从 ${currentRatio.toFixed(1)}% 降至 ${targetRatio.toFixed(1)}% 以下`
    },
    {
      priority: 2,
      action: '设置止损线',
      detail: `在当前价位 ${currency}${currentPrice.toFixed(2)} 基础上，设置 ${currency}${(currentPrice * 0.9).toFixed(2)}（-10%）为硬止损价位`,
      expectedEffect: '触及止损价时强制执行减仓，控制最大亏损'
    }
  ];

  // 如果是美股，添加期权对冲建议
  if (position?.market === 'US') {
    recommendations.push({
      priority: 3,
      action: '期权对冲',
      detail: `考虑买入 ${ticker} 看跌期权（Put Option）进行下行保护，建议买入行权价 ${currency}${(currentPrice * 0.9).toFixed(0)} 的 Put`,
      expectedEffect: '对冲约 30% 的持仓下行风险'
    });
  }

  return {
    title: `${ticker} 持仓集中度过高`,
    severity: currentRatio > limit * 2 ? 'critical' : 'warning',
    summary: `${ticker} 当前占比 ${currentRatio.toFixed(1)}%，超过上限 ${limit}% 约 ${excessRatio.toFixed(1)} 个百分点。高集中度意味着单一标的风险敞口过大，需要及时调整。`,
    riskAnalysis: `当前 ${ticker} 持仓市值 ¥${marketValue.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}，数量 ${quantity.toLocaleString()} 股，成本价 ${currency}${costPrice.toFixed(2)}，现价 ${currency}${currentPrice.toFixed(2)}，浮动盈亏 ${pnlPercent.toFixed(2)}%。若该标的继续下跌 10%，将造成约 ¥${(marketValue * 0.1).toLocaleString('zh-CN', { maximumFractionDigits: 0 })} 的额外亏损。`,
    scenarios,
    recommendations,
    stopLoss: {
      price: `${currency}${(currentPrice * 0.9).toFixed(2)}`,
      percentage: '-10%',
      action: `触及止损价后，强制减仓至少 ${Math.ceil(reduceQuantity * 0.5).toLocaleString()} 股`
    },
    timeline: '建议在 1-2 周内完成调整'
  };
}

/**
 * 最大回撤警告的建议
 */
function generateDrawdownAdvice(
  alert: RiskAlert,
  portfolioState: PortfolioState
): RiskAdvice {
  const currentDrawdown = portfolioState.drawdownPercent;
  const drawdownAmount = portfolioState.highWaterMark - portfolioState.totalNetWorthCNY;
  const leverage = portfolioState.allocation.longRatio / 100;
  
  // 找出亏损最大的持仓
  const sortedPositions = [...portfolioState.positions].sort((a, b) => a.unrealizedPnLCNY - b.unrealizedPnLCNY);
  const biggestLoser = sortedPositions[0];

  const scenarios = [
    {
      name: '市场反弹 5%',
      priceChange: '+5%',
      impact: `+¥${(portfolioState.totalNetWorthCNY * leverage * 0.05).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`,
      result: `回撤收窄至 ${Math.max(0, currentDrawdown - leverage * 5).toFixed(1)}%`
    },
    {
      name: '市场持平',
      priceChange: '0%',
      impact: '¥0',
      result: `回撤维持 ${currentDrawdown.toFixed(1)}%`
    },
    {
      name: '市场下跌 5%',
      priceChange: '-5%',
      impact: `-¥${(portfolioState.totalNetWorthCNY * leverage * 0.05).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`,
      result: `回撤扩大至 ${(currentDrawdown + leverage * 5).toFixed(1)}%`
    }
  ];

  const recommendations = [
    {
      priority: 1,
      action: '降低杠杆',
      detail: `当前杠杆 ${leverage.toFixed(2)}x，建议通过减仓将杠杆降至 1.5x 以下`,
      expectedEffect: '降低波动放大效应，控制回撤风险'
    },
    {
      priority: 2,
      action: '止损最大亏损仓位',
      detail: biggestLoser ? `${biggestLoser.ticker} 当前浮亏 ￥${Math.abs(biggestLoser.unrealizedPnLCNY).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}，考虑止损减仓` : '检查各持仓盈亏状态',
      expectedEffect: '及时止损，防止亏损进一步扩大'
    },
    {
      priority: 3,
      action: '保留现金缓冲',
      detail: '建议保留至少 10% 的现金储备，用于应对市场波动',
      expectedEffect: '提供流动性缓冲，避免被动平仓'
    }
  ];

  return {
    title: '最大回撤警告',
    severity: currentDrawdown > 15 ? 'critical' : 'warning',
    summary: `当前回撤 ${currentDrawdown.toFixed(2)}%，已超过风控线 5%。回撤金额 ¥${drawdownAmount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}，需要立即采取措施控制风险。`,
    riskAnalysis: `账户当前杠杆 ${leverage.toFixed(2)} 倍，高杠杆放大了市场波动的影响。若市场继续下跌 5%，回撤将扩大至 ${(currentDrawdown + leverage * 5).toFixed(1)}%，可能触发券商强制平仓。`,
    scenarios,
    recommendations,
    timeline: '建议立即执行，最迟 3 个交易日内完成'
  };
}

/**
 * 止损警告的建议
 */
function generateStopLossAdvice(
  alert: RiskAlert,
  portfolioState: PortfolioState,
  position?: Position
): RiskAdvice {
  const ticker = alert.ticker || '未知';
  const pnlPercent = position?.unrealizedPnLPercent || 0;
  const marketValue = position?.marketValueCNY || 0;
  const quantity = position?.quantity || 0;
  const currentPrice = position?.currentPrice || 0;
  const costPrice = position?.avgCost || 0;
  const currency = position?.market === 'HK' ? 'HK$' : position?.market === 'US' ? '$' : '¥';

  const scenarios = [
    {
      name: '反弹至成本价',
      priceChange: `+${Math.abs(pnlPercent).toFixed(1)}%`,
      impact: `+￥${Math.abs(position?.unrealizedPnLCNY || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`,
      result: '解套，盈亏平衡'
    },
    {
      name: '继续下跌 10%',
      priceChange: '-10%',
      impact: `-¥${(marketValue * 0.1).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`,
      result: `总亏损扩大至 ${(pnlPercent - 10).toFixed(1)}%`
    },
    {
      name: '继续下跌 20%',
      priceChange: '-20%',
      impact: `-¥${(marketValue * 0.2).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`,
      result: `总亏损扩大至 ${(pnlPercent - 20).toFixed(1)}%`
    }
  ];

  const recommendations = [
    {
      priority: 1,
      action: '立即止损',
      detail: `${ticker} 已触发止损红线，建议立即减仓至少 50%（约 ${Math.ceil(quantity * 0.5).toLocaleString()} 股）`,
      expectedEffect: '锁定亏损，防止进一步扩大'
    },
    {
      priority: 2,
      action: '评估基本面',
      detail: '在止损前，快速评估该标的基本面是否发生重大变化',
      expectedEffect: '避免在恐慌中卖出，但不应成为不止损的借口'
    },
    {
      priority: 3,
      action: '记录复盘',
      detail: '记录本次交易的决策过程和亏损原因，用于日后复盘学习',
      expectedEffect: '积累经验，避免重复犯错'
    }
  ];

  return {
    title: `${ticker} 触发止损红线`,
    severity: 'critical',
    summary: `${ticker} 当前亏损 ${pnlPercent.toFixed(2)}%，已超过止损红线 -20%。建议立即执行止损操作，控制亏损。`,
    riskAnalysis: `${ticker} 成本价 ${currency}${costPrice.toFixed(2)}，现价 ${currency}${currentPrice.toFixed(2)}，持仓 ${quantity.toLocaleString()} 股，浮亏 ￥${Math.abs(position?.unrealizedPnLCNY || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}。继续持有可能导致亏损进一步扩大。`,
    scenarios,
    recommendations,
    stopLoss: {
      price: `${currency}${currentPrice.toFixed(2)}（当前价）`,
      percentage: `${pnlPercent.toFixed(1)}%`,
      action: '立即执行止损，减仓至少 50%'
    },
    timeline: '建议立即执行'
  };
}

/**
 * 通用建议
 */
function generateGenericAdvice(alert: RiskAlert): RiskAdvice {
  return {
    title: alert.message,
    severity: 'info',
    summary: alert.message,
    riskAnalysis: '请根据具体情况评估风险。',
    scenarios: [],
    recommendations: [
      {
        priority: 1,
        action: '评估风险',
        detail: '仔细评估当前持仓和市场状况',
        expectedEffect: '做出合理的投资决策'
      }
    ],
    timeline: '根据情况决定'
  };
}
