import type { Transaction, TradingStats, PortfolioState, NetWorthRecord } from '../types';

// 风险点类型
export interface RiskPoint {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'win_rate' | 'profit_factor' | 'concentration' | 'drawdown' | 'frequency' | 'timing' | 'position_sizing';
  title: string;
  description: string;
  dataPoint: string;
  benchmark: string;
  impact: string;
}

// 改进建议类型
export interface Suggestion {
  id: string;
  priority: 'urgent' | 'important' | 'recommended';
  category: string;
  title: string;
  description: string;
  actionItems: string[];
  expectedOutcome: string;
}

// 策略分析结果
export interface StrategyAnalysis {
  timestamp: string;
  summary: {
    overallScore: number; // 0-100
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    mainIssue: string;
  };
  riskPoints: RiskPoint[];
  suggestions: Suggestion[];
  metrics: {
    winRate: number;
    profitFactor: number;
    avgHoldingDays: number;
    tradeFrequency: number;
    maxDrawdown: number;
    concentrationRisk: number;
  };
}

// 分析交易策略
export function analyzeStrategy(
  transactions: Transaction[],
  tradingStats: TradingStats,
  portfolioState: PortfolioState,
  netWorthHistory: NetWorthRecord[]
): StrategyAnalysis {
  const riskPoints: RiskPoint[] = [];
  const suggestions: Suggestion[] = [];
  
  // 计算指标
  const metrics = calculateMetrics(transactions, tradingStats, portfolioState, netWorthHistory);
  
  // 1. 分析胜率
  analyzeWinRate(tradingStats, riskPoints, suggestions);
  
  // 2. 分析盈亏比
  analyzeProfitFactor(tradingStats, riskPoints, suggestions);
  
  // 3. 分析持仓集中度
  analyzeConcentration(portfolioState, riskPoints, suggestions);
  
  // 4. 分析回撤
  analyzeDrawdown(portfolioState, netWorthHistory, riskPoints, suggestions);
  
  // 5. 分析交易频率
  analyzeTradeFrequency(transactions, riskPoints, suggestions);
  
  // 6. 分析交易时机
  analyzeTradeTimings(transactions, riskPoints, suggestions);
  
  // 7. 分析仓位管理
  analyzePositionSizing(transactions, tradingStats, riskPoints, suggestions);
  
  // 计算综合评分
  const overallScore = calculateOverallScore(riskPoints, metrics);
  const riskLevel = getRiskLevel(overallScore);
  const mainIssue = getMainIssue(riskPoints);
  
  return {
    timestamp: new Date().toISOString(),
    summary: {
      overallScore,
      riskLevel,
      mainIssue,
    },
    riskPoints: riskPoints.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    suggestions: suggestions.sort((a, b) => {
      const priorityOrder = { urgent: 0, important: 1, recommended: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    metrics,
  };
}

// 计算指标
function calculateMetrics(
  transactions: Transaction[],
  tradingStats: TradingStats,
  portfolioState: PortfolioState,
  netWorthHistory: NetWorthRecord[]
) {
  // 交易频率（每月交易次数）
  // 严谨处理：只统计有真实交易日期的记录
  const tradeTxns = transactions.filter(t => 
    ['BUY', 'SELL', 'SHORT', 'COVER'].includes(t.action) && 
    t.date && t.date !== null && t.date !== undefined
  );
  const dateRange = tradeTxns.length > 1 
    ? (new Date(tradeTxns[0].date).getTime() - new Date(tradeTxns[tradeTxns.length - 1].date).getTime()) / (1000 * 60 * 60 * 24 * 30)
    : 1;
  const tradeFrequency = tradeTxns.length / Math.max(dateRange, 1);
  
  // 最大回撤
  const maxDrawdown = portfolioState.drawdownPercent;
  
  // 持仓集中度风险
  const maxPositionWeight = Math.max(...portfolioState.positions.map(p => p.weight), 0);
  const concentrationRisk = maxPositionWeight;
  
  return {
    winRate: tradingStats.winRate,
    profitFactor: tradingStats.profitFactor === Infinity ? 0 : tradingStats.profitFactor,
    avgHoldingDays: 0, // TODO: 计算平均持仓天数
    tradeFrequency,
    maxDrawdown,
    concentrationRisk,
  };
}

// 分析胜率
function analyzeWinRate(stats: TradingStats, riskPoints: RiskPoint[], suggestions: Suggestion[]) {
  if (stats.totalTrades < 10) return; // 交易次数太少，不分析
  
  if (stats.winRate < 40) {
    riskPoints.push({
      id: 'low_win_rate',
      severity: stats.winRate < 30 ? 'critical' : 'high',
      category: 'win_rate',
      title: '胜率过低',
      description: '您的交易胜率显著低于健康水平，说明大部分交易都在亏损。这可能是因为入场时机不佳、止损设置不合理或追涨杀跌。',
      dataPoint: `当前胜率 ${stats.winRate.toFixed(1)}%`,
      benchmark: '健康胜率 > 45%',
      impact: '长期来看，低胜率会导致账户持续亏损，除非盈亏比足够高来弥补。',
    });
    
    suggestions.push({
      id: 'improve_win_rate',
      priority: 'urgent',
      category: '入场策略',
      title: '提高交易胜率',
      description: '通过优化入场时机和交易纪律来提高胜率。',
      actionItems: [
        '严格遵守观察期制度，不要冲动交易',
        '只在明确的技术支撑位或基本面催化剂出现时入场',
        '减少追涨行为，等待回调再入场',
        '设置合理的止损位，避免被洗出',
      ],
      expectedOutcome: '胜率提升至 45% 以上',
    });
  }
}

// 分析盈亏比
function analyzeProfitFactor(stats: TradingStats, riskPoints: RiskPoint[], suggestions: Suggestion[]) {
  if (stats.totalTrades < 10) return;
  
  const pf = stats.profitFactor === Infinity ? 0 : stats.profitFactor;
  
  if (pf < 1) {
    riskPoints.push({
      id: 'negative_profit_factor',
      severity: pf < 0.5 ? 'critical' : 'high',
      category: 'profit_factor',
      title: '盈亏比失衡',
      description: '您的平均亏损远大于平均盈利，这是最危险的交易模式之一。即使胜率较高，也难以实现盈利。',
      dataPoint: `盈亏比 ${pf.toFixed(2)}，平均盈利 ¥${stats.avgWin.toFixed(0)}，平均亏损 ¥${stats.avgLoss.toFixed(0)}`,
      benchmark: '健康盈亏比 > 1.5',
      impact: '当前模式下，需要 70%+ 的胜率才能保本，这几乎不可能持续。',
    });
    
    suggestions.push({
      id: 'improve_profit_factor',
      priority: 'urgent',
      category: '风险管理',
      title: '改善盈亏比',
      description: '通过严格止损和让利润奔跑来改善盈亏比。',
      actionItems: [
        '设置固定止损比例（如 -8%），严格执行',
        '不要过早止盈，让盈利的仓位继续持有',
        '使用移动止损锁定利润',
        '减少频繁交易，避免手续费侵蚀利润',
      ],
      expectedOutcome: '盈亏比提升至 1.5 以上',
    });
  }
  
  // 检查是否"截断利润，放大亏损"
  if (stats.avgLoss > stats.avgWin * 2) {
    riskPoints.push({
      id: 'cut_profit_let_loss_run',
      severity: 'high',
      category: 'profit_factor',
      title: '截断利润，放大亏损',
      description: '典型的散户心理陷阱：盈利时急于落袋为安，亏损时却抱有侥幸心理不愿止损。',
      dataPoint: `平均亏损 ¥${stats.avgLoss.toFixed(0)} 是平均盈利 ¥${stats.avgWin.toFixed(0)} 的 ${(stats.avgLoss / stats.avgWin).toFixed(1)} 倍`,
      benchmark: '平均亏损应小于或等于平均盈利',
      impact: '这种模式会导致几次大亏损抹平多次小盈利。',
    });
  }
}

// 分析持仓集中度
function analyzeConcentration(state: PortfolioState, riskPoints: RiskPoint[], suggestions: Suggestion[]) {
  const positions = state.positions;
  
  // 检查单一持仓占比
  for (const pos of positions) {
    if (pos.weight > 100) {
      riskPoints.push({
        id: `extreme_concentration_${pos.ticker}`,
        severity: 'critical',
        category: 'concentration',
        title: `${pos.ticker} 持仓过度集中`,
        description: `单一股票占比超过 100%（使用杠杆），这意味着该股票下跌 50% 会导致账户归零。`,
        dataPoint: `${pos.ticker} 占比 ${pos.weight.toFixed(1)}%`,
        benchmark: '单一持仓建议 < 30%',
        impact: '极端集中度 + 杠杆 = 爆仓风险',
      });
    } else if (pos.weight > 50) {
      riskPoints.push({
        id: `high_concentration_${pos.ticker}`,
        severity: 'high',
        category: 'concentration',
        title: `${pos.ticker} 持仓集中度过高`,
        description: `单一股票占比超过 50%，缺乏分散化，风险过于集中。`,
        dataPoint: `${pos.ticker} 占比 ${pos.weight.toFixed(1)}%`,
        benchmark: '单一持仓建议 < 30%',
        impact: '该股票大幅波动会显著影响整体账户。',
      });
    }
  }
  
  // 检查杠杆使用
  if (state.allocation.longRatio > 100) {
    riskPoints.push({
      id: 'leverage_risk',
      severity: 'critical',
      category: 'concentration',
      title: '使用高杠杆',
      description: `当前多头仓位 ${state.allocation.longRatio.toFixed(1)}%，使用了融资杠杆。杠杆放大收益的同时也放大亏损。`,
      dataPoint: `杠杆倍数约 ${(state.allocation.longRatio / 100).toFixed(1)}x`,
      benchmark: '建议杠杆 < 1.2x',
      impact: '市场下跌 30% 可能导致账户亏损 60% 以上。',
    });
    
    suggestions.push({
      id: 'reduce_leverage',
      priority: 'urgent',
      category: '仓位管理',
      title: '降低杠杆水平',
      description: '在当前市场环境下，高杠杆是最大的风险来源。',
      actionItems: [
        '逐步减仓，将杠杆降至 1.2x 以下',
        '优先减持亏损仓位',
        '保留现金缓冲应对波动',
        '设置强制平仓线，避免被券商强平',
      ],
      expectedOutcome: '杠杆降至 1.2x 以下，风险可控',
    });
  }
}

// 分析回撤
function analyzeDrawdown(
  state: PortfolioState, 
  history: NetWorthRecord[], 
  riskPoints: RiskPoint[], 
  suggestions: Suggestion[]
) {
  const drawdown = state.drawdownPercent;
  
  if (drawdown > 20) {
    riskPoints.push({
      id: 'severe_drawdown',
      severity: drawdown > 30 ? 'critical' : 'high',
      category: 'drawdown',
      title: '严重回撤',
      description: `账户从高点回撤 ${drawdown.toFixed(1)}%，这是一个危险信号。回撤越大，恢复所需的涨幅越高。`,
      dataPoint: `当前回撤 ${drawdown.toFixed(1)}%`,
      benchmark: '健康回撤 < 10%',
      impact: `需要上涨 ${((1 / (1 - drawdown / 100) - 1) * 100).toFixed(1)}% 才能回本。`,
    });
    
    suggestions.push({
      id: 'recover_from_drawdown',
      priority: 'urgent',
      category: '风险控制',
      title: '控制回撤，保护本金',
      description: '当前首要任务是止血，而不是追求收益。',
      actionItems: [
        '暂停新开仓，专注于现有持仓管理',
        '对亏损仓位设置止损线',
        '考虑部分减仓降低风险敞口',
        '复盘导致回撤的交易决策',
      ],
      expectedOutcome: '控制回撤不再扩大，逐步恢复',
    });
  }
}

// 分析交易频率
function analyzeTradeFrequency(transactions: Transaction[], riskPoints: RiskPoint[], suggestions: Suggestion[]) {
  // 严谨处理：只统计有真实交易日期的记录
  const tradeTxns = transactions.filter(t => 
    ['BUY', 'SELL'].includes(t.action) && 
    t.date && t.date !== null && t.date !== undefined
  );
  if (tradeTxns.length < 5) return;
  
  // 计算最近30天的交易次数
  // 使用当前真实时间，确保每天自动更新
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  
  // 第一步：过滤出在最近30天内的交易
  // 严谨处理：只使用日期范围判断，不限制年份（因为XML可能包含未来日期的历史数据）
  let recentTrades = tradeTxns.filter(t => {
    if (!t.date || t.date === null || t.date === undefined) return false;
    
    // 解析日期 - 支持多种格式
    let tradeDate: Date;
    if (typeof t.date === 'string') {
      // 尝试解析日期字符串
      tradeDate = new Date(t.date);
    } else {
      return false;
    }
    
    const tradeTime = tradeDate.getTime();
    
    // 检查日期是否有效
    if (isNaN(tradeTime)) {
      console.warn('[strategyAnalysis] 无效的交易日期:', t.date, t);
      return false;
    }
    
    // 排除未来日期（超过当前时间的交易）
    if (tradeTime > now) {
      return false;
    }
    
    // 只检查是否在最近30天内（基于当前真实时间）
    const isInLast30Days = tradeTime >= thirtyDaysAgo && tradeTime <= now;
    
    return isInLast30Days;
  });
  
  // 不再检测批量导入，直接使用所有在最近30天内的交易
  // 因为我们已经从 XML 导入了真实交易日期，所有数据都是准确的
  
  // 调试信息 - 详细检查（仅在开发环境）
  if (import.meta.env.DEV) {
    const sampleDates = tradeTxns.slice(0, 5).map(t => ({
      date: t.date,
      parsed: new Date(t.date).getTime(),
      isRecent: (() => {
        const tradeTime = new Date(t.date).getTime();
        return !isNaN(tradeTime) && tradeTime >= thirtyDaysAgo && tradeTime <= now;
      })(),
    }));
    
    // 统计各年份的交易数量
    const tradesByYear = new Map<number, number>();
    tradeTxns.forEach(t => {
      if (t.date) {
        const year = new Date(t.date).getFullYear();
        tradesByYear.set(year, (tradesByYear.get(year) || 0) + 1);
      }
    });
    
    console.log('[strategyAnalysis] 交易频率分析:', {
      totalTrades: tradeTxns.length,
      recent30Days: recentTrades.length,
      thirtyDaysAgo: new Date(thirtyDaysAgo).toISOString(),
      now: new Date(now).toISOString(),
      currentDate: new Date().toISOString(),
      tradesByYear: Object.fromEntries(tradesByYear),
      sampleDates,
      allRecentDates: recentTrades.slice(0, 10).map(t => ({
        date: t.date,
        year: new Date(t.date).getFullYear(),
        month: new Date(t.date).getMonth(),
        timestamp: new Date(t.date).getTime(),
      })),
      oldest交易: tradeTxns[tradeTxns.length - 1]?.date,
      newest交易: tradeTxns[0]?.date,
    });
  }
  
  // 如果统计的交易数异常多，说明日期过滤有问题
  if (recentTrades.length > 100) {
    console.warn('[strategyAnalysis] ⚠️ 检测到异常：最近30天交易次数过多，可能是日期解析错误');
    console.warn('样本交易日期:', recentTrades.slice(0, 5).map(t => ({
      date: t.date,
      timestamp: new Date(t.date).getTime(),
      isValid: !isNaN(new Date(t.date).getTime()),
    })));
  }
  
  // 只有当交易次数明显过多时才提示（避免误报）
  if (recentTrades.length > 50) {
    riskPoints.push({
      id: 'overtrading',
      severity: 'high',
      category: 'frequency',
      title: '过度交易',
      description: `最近30天交易 ${recentTrades.length} 次，平均每天超过1次。频繁交易会增加手续费成本，并导致情绪化决策。`,
      dataPoint: `30天内 ${recentTrades.length} 次交易`,
      benchmark: '建议每月交易 < 10 次',
      impact: '手续费侵蚀利润，且容易追涨杀跌。',
    });
    
    suggestions.push({
      id: 'reduce_trading_frequency',
      priority: 'important',
      category: '交易纪律',
      title: '减少交易频率',
      description: '少即是多，专注于高质量的交易机会。',
      actionItems: [
        '每次交易前写下交易理由',
        '设置每周最多交易 2-3 次的限制',
        '使用观察列表，等待最佳入场时机',
        '避免盯盘，减少冲动交易',
      ],
      expectedOutcome: '交易频率降至每月 10 次以内',
    });
  }
}

// 分析交易时机
function analyzeTradeTimings(transactions: Transaction[], riskPoints: RiskPoint[], suggestions: Suggestion[]) {
  // 严谨处理：只统计有真实交易日期的记录
  const tradeTxns = transactions.filter(t => 
    ['BUY', 'SELL'].includes(t.action) && 
    t.date && t.date !== null && t.date !== undefined
  );
  if (tradeTxns.length < 10) return;
  
  // 分析是否追涨杀跌（连续买入后卖出亏损）
  // 简化分析：检查买入后短期内卖出的比例
  const buyTxns = tradeTxns.filter(t => t.action === 'BUY');
  const sellTxns = tradeTxns.filter(t => t.action === 'SELL');
  
  // 检查同一股票的买卖模式
  const tickerTrades = new Map<string, Transaction[]>();
  for (const t of tradeTxns) {
    if (!tickerTrades.has(t.ticker)) {
      tickerTrades.set(t.ticker, []);
    }
    tickerTrades.get(t.ticker)!.push(t);
  }
  
  let shortTermTrades = 0;
  for (const [ticker, trades] of Array.from(tickerTrades.entries())) {
    const sorted = trades.filter(t => t.date).sort((a: Transaction, b: Transaction) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].action === 'BUY' && sorted[i + 1].action === 'SELL') {
        if (!sorted[i].date || !sorted[i + 1].date) continue;
        const days = (new Date(sorted[i + 1].date).getTime() - new Date(sorted[i].date).getTime()) / (1000 * 60 * 60 * 24);
        if (days < 7) {
          shortTermTrades++;
        }
      }
    }
  }
  
  if (shortTermTrades > 5) {
    riskPoints.push({
      id: 'short_term_trading',
      severity: 'medium',
      category: 'timing',
      title: '短线交易过多',
      description: `有 ${shortTermTrades} 次在买入后一周内卖出，这通常意味着入场时机不佳或缺乏持仓耐心。`,
      dataPoint: `${shortTermTrades} 次短期交易`,
      benchmark: '短期交易应 < 20% 的总交易',
      impact: '频繁短线交易难以捕捉大行情。',
    });
  }
}

// 分析仓位管理
function analyzePositionSizing(
  transactions: Transaction[], 
  stats: TradingStats, 
  riskPoints: RiskPoint[], 
  suggestions: Suggestion[]
) {
  // 严谨处理：只统计有真实交易日期的记录
  const tradeTxns = transactions.filter(t => 
    ['BUY', 'SELL'].includes(t.action) && 
    t.date && t.date !== null && t.date !== undefined
  );
  if (tradeTxns.length < 5) return;
  
  // 检查单笔交易金额的波动
  const amounts = tradeTxns.map(t => t.amountCNY);
  const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const maxAmount = Math.max(...amounts);
  
  if (maxAmount > avgAmount * 5) {
    riskPoints.push({
      id: 'inconsistent_position_sizing',
      severity: 'medium',
      category: 'position_sizing',
      title: '仓位管理不一致',
      description: `单笔交易金额差异过大，最大交易是平均交易的 ${(maxAmount / avgAmount).toFixed(1)} 倍。这可能导致大额交易的亏损抹平多次小额盈利。`,
      dataPoint: `最大单笔 ¥${maxAmount.toLocaleString()}，平均 ¥${avgAmount.toLocaleString()}`,
      benchmark: '单笔交易应在平均值的 0.5-2 倍之间',
      impact: '仓位不一致会放大运气成分的影响。',
    });
    
    suggestions.push({
      id: 'standardize_position_sizing',
      priority: 'important',
      category: '仓位管理',
      title: '标准化仓位大小',
      description: '使用固定比例的仓位管理方法。',
      actionItems: [
        '每笔交易使用固定的账户比例（如 5-10%）',
        '根据止损距离调整仓位大小',
        '避免在亏损后加大仓位试图回本',
        '保持交易的一致性',
      ],
      expectedOutcome: '仓位管理更加系统化',
    });
  }
}

// 计算综合评分
function calculateOverallScore(riskPoints: RiskPoint[], metrics: StrategyAnalysis['metrics']): number {
  let score = 100;
  
  // 根据风险点扣分
  for (const rp of riskPoints) {
    switch (rp.severity) {
      case 'critical': score -= 25; break;
      case 'high': score -= 15; break;
      case 'medium': score -= 8; break;
      case 'low': score -= 3; break;
    }
  }
  
  // 根据指标调整
  if (metrics.winRate >= 50) score += 5;
  if (metrics.profitFactor >= 1.5) score += 10;
  if (metrics.maxDrawdown < 10) score += 5;
  
  return Math.max(0, Math.min(100, score));
}

// 获取风险等级
function getRiskLevel(score: number): StrategyAnalysis['summary']['riskLevel'] {
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}

// 获取主要问题
function getMainIssue(riskPoints: RiskPoint[]): string {
  if (riskPoints.length === 0) return '策略表现良好，继续保持';
  
  const critical = riskPoints.find(r => r.severity === 'critical');
  if (critical) return critical.title;
  
  const high = riskPoints.find(r => r.severity === 'high');
  if (high) return high.title;
  
  return riskPoints[0].title;
}
