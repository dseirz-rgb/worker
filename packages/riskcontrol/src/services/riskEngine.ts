import type {
  Transaction,
  Position,
  PortfolioState,
  RiskAlert,
  CashBalance,
  Allocation,
  ExchangeRates,
  Action,
  WatchlistItem,
  RoundTrip,
  TradingStats,
  PositionDirection,
  Currency,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { convertToCNY } from './marketData';

// 计算持仓（加权平均法）
export function calculatePositions(
  transactions: Transaction[],
  rates: ExchangeRates
): Position[] {
  const positionMap = new Map<string, {
    ticker: string;
    name: string;
    market: Transaction['market'];
    currency: Currency;
    longQty: number;
    longCost: number;
    shortQty: number;
    shortCost: number;
    currentPrice: number;
    firstBuyDate: string;
    lastTradeDate: string;
  }>();

  // 按时间顺序处理交易
  const sortedTxns = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const txn of sortedTxns) {
    // 跳过资金操作
    if (txn.action === 'DEPOSIT' || txn.action === 'WITHDRAW' || txn.action === 'SYNC_BALANCE') {
      continue;
    }
    // IBKR 同步的交易记录不用于持仓计算，因为它们可能不完整
    // 通过 ID 前缀或 isIBKRSync 属性识别
    if ((txn as any).isIBKRSync || txn.id.startsWith('ibkr-')) {
      continue;
    }

    const key = txn.ticker;
    let pos = positionMap.get(key);

    if (!pos) {
      pos = {
        ticker: txn.ticker,
        name: txn.name,
        market: txn.market,
        currency: txn.currency,
        longQty: 0,
        longCost: 0,
        shortQty: 0,
        shortCost: 0,
        currentPrice: txn.price,
        firstBuyDate: txn.date,
        lastTradeDate: txn.date,
      };
      positionMap.set(key, pos);
    }

    pos.lastTradeDate = txn.date;
    pos.currentPrice = txn.price; // 会被实时价格覆盖

    switch (txn.action) {
      case 'BUY':
        // 加权平均成本
        const newLongCost = (pos.longCost * pos.longQty + txn.price * txn.quantity) / 
                           (pos.longQty + txn.quantity);
        pos.longQty += txn.quantity;
        pos.longCost = pos.longQty > 0 ? newLongCost : 0;
        break;

      case 'SELL':
        pos.longQty = Math.max(0, pos.longQty - txn.quantity);
        if (pos.longQty === 0) pos.longCost = 0;
        break;

      case 'SHORT':
        const newShortCost = (pos.shortCost * pos.shortQty + txn.price * txn.quantity) / 
                            (pos.shortQty + txn.quantity);
        pos.shortQty += txn.quantity;
        pos.shortCost = pos.shortQty > 0 ? newShortCost : 0;
        break;

      case 'COVER':
        pos.shortQty = Math.max(0, pos.shortQty - txn.quantity);
        if (pos.shortQty === 0) pos.shortCost = 0;
        break;
    }
  }

    // 转换持仓 Map 为数组
  const positions: Position[] = [];

  for (const pos of Array.from(positionMap.values())) {
    // 多头持仓
    if (pos.longQty > 0) {
      const marketValue = pos.longQty * pos.currentPrice;
      const marketValueCNY = convertToCNY(marketValue, pos.currency, rates);
      const unrealizedPnL = (pos.currentPrice - pos.longCost) * pos.longQty;
      const unrealizedPnLCNY = convertToCNY(unrealizedPnL, pos.currency, rates);
      const unrealizedPnLPercent = pos.longCost > 0 
        ? ((pos.currentPrice - pos.longCost) / pos.longCost) * 100 
        : 0;

      positions.push({
        id: uuidv4(),
        ticker: pos.ticker,
        name: pos.name,
        market: pos.market,
        currency: pos.currency,
        direction: 'LONG',
        quantity: pos.longQty,
        avgCost: pos.longCost,
        currentPrice: pos.currentPrice,
        marketValue,
        marketValueCNY,
        unrealizedPnL,
        unrealizedPnLCNY,
        unrealizedPnLPercent,
        weight: 0, // 稍后计算
        firstBuyDate: pos.firstBuyDate,
        lastTradeDate: pos.lastTradeDate,
      });
    }

    // 空头持仓
    if (pos.shortQty > 0) {
      const marketValue = pos.shortQty * pos.currentPrice;
      const marketValueCNY = convertToCNY(marketValue, pos.currency, rates);
      // 空头盈亏：卖出价 - 当前价
      const unrealizedPnL = (pos.shortCost - pos.currentPrice) * pos.shortQty;
      const unrealizedPnLCNY = convertToCNY(unrealizedPnL, pos.currency, rates);
      const unrealizedPnLPercent = pos.shortCost > 0 
        ? ((pos.shortCost - pos.currentPrice) / pos.shortCost) * 100 
        : 0;

      positions.push({
        id: uuidv4(),
        ticker: pos.ticker,
        name: pos.name,
        market: pos.market,
        currency: pos.currency,
        direction: 'SHORT',
        quantity: pos.shortQty,
        avgCost: pos.shortCost,
        currentPrice: pos.currentPrice,
        marketValue,
        marketValueCNY,
        unrealizedPnL,
        unrealizedPnLCNY,
        unrealizedPnLPercent,
        weight: 0,
        firstBuyDate: pos.firstBuyDate,
        lastTradeDate: pos.lastTradeDate,
      });
    }
  }

  return positions;
}

// 计算现金余额
export function calculateCashBalance(
  transactions: Transaction[],
  rates: ExchangeRates
): CashBalance {
  const balance: CashBalance = {
    USD: 0,
    HKD: 0,
    CNY: 0,
    totalCNY: 0,
  };

  // 检查是否有 SYNC_BALANCE 交易（直接同步账户余额）
  const syncTransactions = transactions.filter(t => t.action === 'SYNC_BALANCE');
  const hasSyncBalance = syncTransactions.length > 0;

  if (hasSyncBalance) {
    // 如果有 SYNC_BALANCE，直接使用同步的余额
    for (const txn of syncTransactions) {
      balance[txn.currency] = txn.amount;
    }
  } else {
    // 否则通过交易记录计算
    for (const txn of transactions) {
      const currency = txn.currency;
      const amount = txn.amount;

      switch (txn.action) {
        case 'DEPOSIT':
          balance[currency] += amount;
          break;

        case 'WITHDRAW':
          balance[currency] -= amount;
          break;

        case 'BUY':
        case 'SHORT':
          balance[currency] -= amount + txn.fee;
          break;

        case 'SELL':
        case 'COVER':
          balance[currency] += amount - txn.fee;
          break;
      }
    }
  }

  // 计算总 CNY
  balance.totalCNY = 
    balance.CNY + 
    convertToCNY(balance.USD, 'USD', rates) + 
    convertToCNY(balance.HKD, 'HKD', rates);

  return balance;
}

// 计算资产配置
export function calculateAllocation(
  positions: Position[],
  cashBalance: CashBalance,
  totalNetWorth: number
): Allocation {
  const longValueCNY = positions
    .filter(p => p.direction === 'LONG')
    .reduce((sum, p) => sum + p.marketValueCNY, 0);

  const shortValueCNY = positions
    .filter(p => p.direction === 'SHORT')
    .reduce((sum, p) => sum + p.marketValueCNY, 0);

  const cashValueCNY = cashBalance.totalCNY;

  return {
    cashRatio: totalNetWorth > 0 ? (cashValueCNY / totalNetWorth) * 100 : 100,
    longRatio: totalNetWorth > 0 ? (longValueCNY / totalNetWorth) * 100 : 0,
    shortRatio: totalNetWorth > 0 ? (shortValueCNY / totalNetWorth) * 100 : 0,
    cashValueCNY,
    longValueCNY,
    shortValueCNY,
  };
}

// 生成风控警报
export function generateRiskAlerts(
  positions: Position[],
  totalNetWorth: number,
  highWaterMark: number,
  riskLimits: {
    stopLossPercent: number;
    maxDrawdownPercent: number;
    positionLimitPercent: number;
    positionLimitExceptions?: { ticker: string; name: string; limitPercent: number }[];
  }
): RiskAlert[] {
  const alerts: RiskAlert[] = [];

  // 0. 数据完整性检查
  if (totalNetWorth <= 0 && positions.length > 0) {
      alerts.push({
        id: uuidv4(),
        type: 'SYSTEM_ERROR',
        severity: 'CRITICAL',
        title: '数据异常',
        message: '检测到账户净值为 0，无法准确计算持仓占比等风控指标。请检查数据源连接。',
        ticker: 'PORTFOLIO',
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
  }

  // 1. 止损红线检查
  for (const pos of positions) {
    // 忽略极小市值的持仓 (噪音过滤)
    if (pos.marketValueCNY < 100 && pos.unrealizedPnLPercent > -50) continue;

    if (pos.unrealizedPnLPercent <= riskLimits.stopLossPercent) {
      alerts.push({
        id: uuidv4(),
        type: 'STOP_LOSS',
        severity: 'CRITICAL',
        title: '止损红线触发',
        message: `${pos.name}(${pos.ticker}) 亏损已达 ${pos.unrealizedPnLPercent.toFixed(2)}%，超过止损线 ${riskLimits.stopLossPercent}%`,
        ticker: pos.ticker,
        value: pos.unrealizedPnLPercent,
        threshold: riskLimits.stopLossPercent,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }
  }

  // 2. 最大回撤检查
  if (highWaterMark > 0) {
    const drawdownPercent = totalNetWorth > 0 
        ? ((highWaterMark - totalNetWorth) / highWaterMark) * 100
        : 0;
        
    if (drawdownPercent >= riskLimits.maxDrawdownPercent) {
      alerts.push({
        id: uuidv4(),
        type: 'MAX_DRAWDOWN',
        severity: 'CRITICAL',
        title: '最大回撤警告',
        message: `当前回撤 ${drawdownPercent.toFixed(2)}%，已超过风控线 ${riskLimits.maxDrawdownPercent}%`,
        value: drawdownPercent,
        threshold: riskLimits.maxDrawdownPercent,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }
  }

  // 3. 持仓上限检查（支持个股例外）
  console.warn(`[RiskCheck] START: Checking ${positions.length} positions. NetWorth: ${totalNetWorth}`);
  for (const pos of positions) {
    // 宽松的方向检查
    const isLong = pos.direction?.toUpperCase() === 'LONG';
    
    if (isLong) {
      // 优先使用计算出的权重，如果净值异常则使用持仓自带的权重字段
      let weight = 0;
      if (totalNetWorth > 0) {
          weight = (pos.marketValueCNY / totalNetWorth) * 100;
      } else {
          weight = pos.weight || 0;
      }
      
      // 检查是否有个股例外
      const exception = riskLimits.positionLimitExceptions?.find(
        e => e.ticker.toUpperCase() === pos.ticker.toUpperCase()
      );
      const effectiveLimit = exception ? exception.limitPercent : riskLimits.positionLimitPercent;
      
      console.warn(`[RiskCheck] ${pos.ticker} (${pos.direction}) Val:${pos.marketValueCNY} NW:${totalNetWorth} W:${weight.toFixed(2)}% Limit:${effectiveLimit}%`);

      if (weight > effectiveLimit) {
        const limitNote = exception ? `（特殊上限 ${effectiveLimit}%）` : '';
        alerts.push({
          id: uuidv4(),
          type: 'POSITION_LIMIT',
          severity: 'WARNING',
          title: '持仓集中度过高',
          message: `${pos.name}(${pos.ticker}) 占比 ${weight.toFixed(2)}%，超过上限 ${effectiveLimit}%${limitNote}`,
          ticker: pos.ticker,
          value: weight,
          threshold: effectiveLimit,
          timestamp: new Date().toISOString(),
          acknowledged: false,
        });
      }
    } else {
      console.warn(`[RiskCheck] Skipping ${pos.ticker} because direction is "${pos.direction}" (isLong=${isLong})`);
    }
  }

  return alerts;
}

// 检查 FOMO 交易
export function checkFOMO(
  ticker: string,
  action: Action,
  watchlist: WatchlistItem[],
  positions: Position[],
  cooldownDays: number
): RiskAlert | null {
  // 只检查买入和做空
  if (action !== 'BUY' && action !== 'SHORT') {
    return null;
  }

  // 检查是否在持仓中
  const inPosition = positions.some(p => p.ticker === ticker);
  if (inPosition) {
    return null; // 加仓不触发 FOMO 检查
  }

  // 检查是否在观察列表中
  const watchlistItem = watchlist.find(w => w.ticker === ticker);

  if (!watchlistItem) {
    // 不在观察列表中 - 突发性交易
    return {
      id: uuidv4(),
      type: 'UNPLANNED_TRADE',
      severity: 'WARNING',
      title: '非计划交易警告',
      message: `${ticker} 不在观察列表中，这可能是一笔冲动交易。建议先加入观察列表进行研究。`,
      ticker,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
  }

  // 检查观察期
  const addedDate = new Date(watchlistItem.addedDate);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - addedDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff < cooldownDays) {
    return {
      id: uuidv4(),
      type: 'FOMO_WARNING',
      severity: 'WARNING',
      title: '观察期未满',
      message: `${ticker} 加入观察列表仅 ${daysDiff} 天，未满 ${cooldownDays} 天冷静期。是否为冲动交易？`,
      ticker,
      value: daysDiff,
      threshold: cooldownDays,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
  }

  return null;
}

// 计算完整投资组合状态
export function calculatePortfolioState(
  transactions: Transaction[],
  watchlist: WatchlistItem[],
  currentHWM: number,
  rates: ExchangeRates,
  riskLimits: {
    stopLossPercent: number;
    maxDrawdownPercent: number;
    positionLimitPercent: number;
  },
  stockPrices?: Map<string, number>
): PortfolioState {
  // 计算持仓
  let positions = calculatePositions(transactions, rates);

  // 更新实时价格
  if (stockPrices) {
    positions = positions.map(pos => {
      const currentPrice = stockPrices.get(pos.ticker) || pos.currentPrice;
      const marketValue = pos.quantity * currentPrice;
      const marketValueCNY = convertToCNY(marketValue, pos.currency, rates);
      
      let unrealizedPnL: number;
      let unrealizedPnLPercent: number;
      
      if (pos.direction === 'LONG') {
        unrealizedPnL = (currentPrice - pos.avgCost) * pos.quantity;
        unrealizedPnLPercent = pos.avgCost > 0 
          ? ((currentPrice - pos.avgCost) / pos.avgCost) * 100 
          : 0;
      } else {
        unrealizedPnL = (pos.avgCost - currentPrice) * pos.quantity;
        unrealizedPnLPercent = pos.avgCost > 0 
          ? ((pos.avgCost - currentPrice) / pos.avgCost) * 100 
          : 0;
      }
      
      const unrealizedPnLCNY = convertToCNY(unrealizedPnL, pos.currency, rates);

      return {
        ...pos,
        currentPrice,
        marketValue,
        marketValueCNY,
        unrealizedPnL,
        unrealizedPnLCNY,
        unrealizedPnLPercent,
      };
    });
  }

  // 计算现金余额
  const cashBalance = calculateCashBalance(transactions, rates);

  // 计算总净值
  const positionsValueCNY = positions.reduce((sum, p) => sum + p.marketValueCNY, 0);
  const totalNetWorthCNY = cashBalance.totalCNY + positionsValueCNY;

  // 更新持仓权重
  positions = positions.map(pos => ({
    ...pos,
    weight: totalNetWorthCNY > 0 ? (pos.marketValueCNY / totalNetWorthCNY) * 100 : 0,
  }));

  // 使用历史高水位线，不在实时计算时更新
  // HWM 应该只基于 IBKR Activity Statement 的官方收盘净值
  const highWaterMark = currentHWM;

  // 计算回撤
  const drawdownAmount = highWaterMark - totalNetWorthCNY;
  const drawdownPercent = highWaterMark > 0 
    ? (drawdownAmount / highWaterMark) * 100 
    : 0;

  // 计算资产配置
  const allocation = calculateAllocation(positions, cashBalance, totalNetWorthCNY);

  // 生成风控警报
  const alerts = generateRiskAlerts(positions, totalNetWorthCNY, highWaterMark, riskLimits);

  // 计算当日盈亏（简化：使用未实现盈亏）
  const dailyPnL = positions.reduce((sum, p) => sum + p.unrealizedPnLCNY, 0);
  const dailyPnLPercent = totalNetWorthCNY > 0 
    ? (dailyPnL / (totalNetWorthCNY - dailyPnL)) * 100 
    : 0;

  return {
    totalNetWorthCNY,
    cashBalance,
    highWaterMark,
    drawdownPercent,
    drawdownAmount,
    positions,
    alerts,
    allocation,
    dailyPnL,
    dailyPnLPercent,
    totalPnL: dailyPnL,
    totalPnLPercent: dailyPnLPercent,
    lastUpdated: new Date().toISOString(),
  };
}

// LIFO 算法计算已完成交易（Round-trips）
export function calculateRoundTrips(transactions: Transaction[]): RoundTrip[] {
  const roundTrips: RoundTrip[] = [];
  const openPositions = new Map<string, {
    direction: PositionDirection;
    entries: { txn: Transaction; remainingQty: number }[];
  }>();

  const sortedTxns = [...transactions]
    .filter(t => ['BUY', 'SELL', 'SHORT', 'COVER'].includes(t.action))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const txn of sortedTxns) {
    const key = txn.ticker;
    const isEntry = txn.action === 'BUY' || txn.action === 'SHORT';
    const direction: PositionDirection = txn.action === 'BUY' || txn.action === 'SELL' ? 'LONG' : 'SHORT';

    if (isEntry) {
      // 开仓
      let pos = openPositions.get(key);
      if (!pos || pos.direction !== direction) {
        pos = { direction, entries: [] };
        openPositions.set(key, pos);
      }
      pos.entries.push({ txn, remainingQty: txn.quantity });
    } else {
      // 平仓 - LIFO
      const pos = openPositions.get(key);
      if (!pos || pos.entries.length === 0) continue;

      let remainingToClose = txn.quantity;
      const matchedEntries: Transaction[] = [];
      const exitTxn = txn;

      // 从后往前匹配（LIFO）
      while (remainingToClose > 0 && pos.entries.length > 0) {
        const lastEntry = pos.entries[pos.entries.length - 1];
        const matchQty = Math.min(remainingToClose, lastEntry.remainingQty);

        if (matchQty > 0) {
          matchedEntries.push(lastEntry.txn);
          lastEntry.remainingQty -= matchQty;
          remainingToClose -= matchQty;

          if (lastEntry.remainingQty <= 0) {
            pos.entries.pop();
          }
        }
      }

      if (matchedEntries.length > 0) {
        // 计算这一轮交易的盈亏
        const totalEntryQty = txn.quantity;
        const avgEntryPrice = matchedEntries.reduce((sum, e) => sum + e.price, 0) / matchedEntries.length;
        const avgExitPrice = exitTxn.price;

        let realizedPnL: number;
        if (direction === 'LONG') {
          realizedPnL = (avgExitPrice - avgEntryPrice) * totalEntryQty;
        } else {
          realizedPnL = (avgEntryPrice - avgExitPrice) * totalEntryQty;
        }

        const realizedPnLPercent = avgEntryPrice > 0 
          ? (realizedPnL / (avgEntryPrice * totalEntryQty)) * 100 
          : 0;

        const firstEntryDate = new Date(matchedEntries[0].date);
        const exitDate = new Date(exitTxn.date);
        const holdingDays = Math.ceil((exitDate.getTime() - firstEntryDate.getTime()) / (1000 * 60 * 60 * 24));

        roundTrips.push({
          id: uuidv4(),
          ticker: txn.ticker,
          name: txn.name,
          direction,
          entries: matchedEntries,
          exits: [exitTxn],
          totalQuantity: totalEntryQty,
          avgEntryPrice,
          avgExitPrice,
          realizedPnL,
          realizedPnLPercent,
          holdingDays,
          closedDate: exitTxn.date,
        });
      }
    }
  }

  return roundTrips.sort((a, b) => new Date(b.closedDate).getTime() - new Date(a.closedDate).getTime());
}

// 计算交易统计
export function calculateTradingStats(roundTrips: RoundTrip[]): TradingStats {
  if (roundTrips.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      maxWin: null,
      maxLoss: null,
      totalRealizedPnL: 0,
    };
  }

  const winners = roundTrips.filter(rt => rt.realizedPnL > 0);
  const losers = roundTrips.filter(rt => rt.realizedPnL < 0);

  const totalWins = winners.reduce((sum, rt) => sum + rt.realizedPnL, 0);
  const totalLosses = Math.abs(losers.reduce((sum, rt) => sum + rt.realizedPnL, 0));

  const maxWin = winners.length > 0 
    ? winners.reduce((max, rt) => rt.realizedPnL > max.realizedPnL ? rt : max)
    : null;

  const maxLoss = losers.length > 0 
    ? losers.reduce((min, rt) => rt.realizedPnL < min.realizedPnL ? rt : min)
    : null;

  return {
    totalTrades: roundTrips.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    winRate: (winners.length / roundTrips.length) * 100,
    avgWin: winners.length > 0 ? totalWins / winners.length : 0,
    avgLoss: losers.length > 0 ? totalLosses / losers.length : 0,
    profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
    maxWin,
    maxLoss,
    totalRealizedPnL: roundTrips.reduce((sum, rt) => sum + rt.realizedPnL, 0),
  };
}
