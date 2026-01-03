import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  ArrowUpRight,
  RefreshCw
} from 'lucide-react';
import { Card, Badge, NumberDisplay, ProgressBar } from '../ui';
import type { Position } from '../../types';

interface PositionsListProps {
  positions: Position[];
  positionLimitPercent: number;
  livePrices?: Record<string, { currentPrice: number; changePercent: number; lastUpdated: number }>;
  onSell?: (position: Position) => void;
}

export function PositionsList({ 
    positions, 
    positionLimitPercent, 
    livePrices, 
    onSell, 
    isPrivacyMode = false,
    showAmounts = false // 新增：是否显示金额
}: PositionsListProps & { isPrivacyMode?: boolean; showAmounts?: boolean }) {
  const [sortBy, setSortBy] = useState<'weight' | 'pnl' | 'pnlPercent'>('weight');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debug log
  useEffect(() => {
    if (livePrices && Object.keys(livePrices).length > 0) {
        console.log('[PositionsList] Received livePrices Keys:', Object.keys(livePrices).map(k => `"${k}"(${k.length})`));
        console.log('[PositionsList] Position Tickers:', positions.map(p => `"${p.ticker}"(${p.ticker.length})`));
    }
  }, [livePrices, positions]);

  // 合并实时价格
  const mergedPositions = positions.map(pos => {
    // 尝试多种方式匹配
    let liveData = livePrices?.[pos.ticker];
    
    if (!liveData && livePrices) {
        // 尝试去除空格匹配
        const cleanTicker = pos.ticker.trim();
        liveData = livePrices[cleanTicker];
        
        // 尝试遍历查找
        if (!liveData) {
             const foundKey = Object.keys(livePrices).find(k => k.trim() === cleanTicker);
             if (foundKey) liveData = livePrices[foundKey];
        }
    }

    if (!liveData) return pos;

    console.log(`[PositionsList] Merging live data for ${pos.ticker}:`, liveData);

    // 如果有实时价格，不直接覆盖，而是保留作为参考
    const newPrice = Number(liveData.currentPrice) || 0; // 确保是数字
    
    // 使用比例法估算新的人民币市值和盈亏
    const priceRatio = pos.currentPrice > 0 ? newPrice / pos.currentPrice : 1;
    const newMarketValueCNY = pos.marketValueCNY * priceRatio;
    
    // 重新计算未实现盈亏
    const costValueCNY = pos.marketValueCNY - pos.unrealizedPnLCNY;
    const newUnrealizedPnLCNY = newMarketValueCNY - costValueCNY;
    
    const newUnrealizedPnLPercent = pos.avgCost > 0 
      ? ((newPrice - pos.avgCost) / pos.avgCost) * 100
      : 0;

    return {
      ...pos,
      // 不覆盖原数据，而是添加 live 字段
      livePrice: newPrice,
      liveMarketValueCNY: newMarketValueCNY,
      liveUnrealizedPnLCNY: newUnrealizedPnLCNY,
      liveUnrealizedPnLPercent: newUnrealizedPnLPercent,
      isLive: true,
      liveChangePercent: liveData.changePercent,
    };
  });

  const sortedPositions = [...mergedPositions].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'weight':
        comparison = a.weight - b.weight;
        break;
      case 'pnl':
        comparison = a.unrealizedPnLCNY - b.unrealizedPnLCNY;
        break;
      case 'pnlPercent':
        comparison = a.unrealizedPnLPercent - b.unrealizedPnLPercent;
        break;
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: typeof sortBy }) => {
    if (sortBy !== field) return null;
    return sortOrder === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />;
  };

  if (positions.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-accent-cyan" />
          <span className="text-xs text-text-secondary uppercase tracking-wider">持仓列表</span>
        </div>
        <div className="text-center py-8 text-text-muted">
          <TrendingUp size={48} className="mx-auto mb-3 opacity-30" />
          <p>暂无持仓</p>
          <p className="text-xs mt-1">添加交易记录后将在此显示持仓</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-accent-cyan" />
          <span className="text-xs text-text-secondary uppercase tracking-wider">持仓列表</span>
          <Badge variant="info">{positions.length}</Badge>
        </div>
      </div>

      {/* 表头 */}
      <div className="grid grid-cols-12 gap-2 text-xs text-text-muted uppercase tracking-wider pb-2 border-b border-border">
        <div className="col-span-3">标的</div>
        <div className="col-span-2 text-right">
            {showAmounts ? '市值' : '权重'}
        </div>
        <div 
          className="col-span-2 text-right cursor-pointer hover:text-text-primary flex items-center justify-end gap-1"
          onClick={() => handleSort('weight')}
        >
          {showAmounts ? '占比' : '仓位'} <SortIcon field="weight" />
        </div>
        <div className="col-span-2 text-right">
            {showAmounts ? '成本/现价' : '现价'}
        </div>
        <div 
          className="col-span-2 text-right cursor-pointer hover:text-text-primary flex items-center justify-end gap-1"
          onClick={() => handleSort('pnlPercent')}
        >
          {showAmounts ? '盈亏' : '回报'} <SortIcon field="pnlPercent" />
        </div>
        <div className="col-span-1"></div>
      </div>

      {/* 持仓列表 */}
      <div className="divide-y divide-border">
        {sortedPositions.map(position => {
          const isExpanded = expandedId === position.id;
          const isOverLimit = position.weight > positionLimitPercent;
          const isStopLoss = position.unrealizedPnLPercent <= -20;
          const isProfit = position.unrealizedPnLPercent > 0;

          return (
            <div key={position.id} className="py-3">
              <div 
                className="grid grid-cols-12 gap-2 items-center cursor-pointer hover:bg-bg-tertiary/50 -mx-2 px-2 py-1 rounded transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : position.id)}
              >
                {/* 标的信息 */}
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-1 h-8 rounded-full ${position.direction === 'LONG' ? 'bg-accent-green' : 'bg-accent-red'}`} />
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-text-primary">{position.ticker}</span>
                        {isOverLimit && (
                          <AlertTriangle size={12} className="text-accent-yellow" />
                        )}
                        {isStopLoss && (
                          <AlertTriangle size={12} className="text-accent-red animate-pulse-red" />
                        )}
                      </div>
                      <div className="text-xs text-text-muted truncate max-w-[120px]">
                        {position.name}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 市值 / 权重 */}
                <div className="col-span-2 text-right">
                  {showAmounts ? (
                    <>
                        <div className="text-sm text-text-primary mono-nums">
                            ¥{position.marketValueCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                        </div>
                        {/* 实时市值 */}
                        {(position as any).isLive && (
                            <div className="text-[10px] text-text-muted mono-nums flex items-center justify-end gap-1">
                            <span className="w-1 h-1 rounded-full bg-accent-green animate-pulse" />
                            ¥{(position as any).liveMarketValueCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                            </div>
                        )}
                        {!((position as any).isLive) && (
                            <div className="text-xs text-text-muted mono-nums">
                            {position.quantity.toLocaleString()} 股
                            </div>
                        )}
                    </>
                  ) : (
                    <div className="text-sm font-medium text-text-primary mono-nums">
                        {position.weight.toFixed(1)}%
                    </div>
                  )}
                </div>

                {/* 占比 / 进度条 */}
                <div className="col-span-2 text-right">
                  {showAmounts ? (
                      <div className={`text-sm mono-nums ${isOverLimit ? 'text-accent-yellow' : 'text-text-primary'}`}>
                        {position.weight.toFixed(2)}%
                      </div>
                  ) : (
                      <div className="text-xs text-text-muted mono-nums">
                          {position.quantity.toLocaleString()} 股
                      </div>
                  )}
                  <div className="mt-1">
                    <ProgressBar 
                      value={position.weight} 
                      max={positionLimitPercent * 1.5}
                      color={isOverLimit ? 'yellow' : 'cyan'}
                      size="sm"
                    />
                  </div>
                </div>

                {/* 成本/现价 */}
                <div className="col-span-2 text-right">
                  {showAmounts && (
                      <div className="text-xs text-text-muted mono-nums">
                        {position.avgCost.toFixed(2)}
                      </div>
                  )}
                  <div className="flex flex-col items-end">
                    <div className="text-sm text-text-primary mono-nums">
                      {position.currentPrice.toFixed(2)}
                    </div>
                    {/* 实时价格 */}
                    {(position as any).isLive && (
                      <div className="flex items-center gap-1 bg-accent-cyan/10 px-1.5 py-0.5 rounded mt-0.5">
                        <span className="text-[11px] text-text-primary font-bold mono-nums">
                          Live: {(position as any).livePrice.toFixed(2)}
                        </span>
                        {(position as any).liveChangePercent !== undefined && (
                          <span className={`text-[10px] mono-nums ${(position as any).liveChangePercent >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                            {(position as any).liveChangePercent > 0 ? '+' : ''}{(position as any).liveChangePercent.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 盈亏 */}
                <div className="col-span-2 text-right">
                  {showAmounts && (
                    <>
                        <NumberDisplay 
                            value={position.unrealizedPnLCNY} 
                            prefix="¥" 
                            decimals={0}
                            size="sm"
                            privacyMode={isPrivacyMode}
                        />
                        {/* 实时盈亏 */}
                        {(position as any).isLive && !isPrivacyMode && (
                            <div className="text-[10px] mono-nums mt-0.5 flex justify-end gap-1">
                            <span className={(position as any).liveUnrealizedPnLCNY >= 0 ? 'text-accent-green' : 'text-accent-red'}>
                                ¥{(position as any).liveUnrealizedPnLCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                            </span>
                            </div>
                        )}
                    </>
                  )}
                  <NumberDisplay 
                    value={position.unrealizedPnLPercent} 
                    suffix="%" 
                    decimals={2}
                    size="sm"
                    className={`block mt-0.5 ${showAmounts ? 'opacity-70' : 'font-medium'}`}
                  />
                </div>

                {/* 操作 */}
                <div className="col-span-1 text-right">
                  <button className="p-1 text-text-muted hover:text-text-primary transition-colors">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* 展开详情 */}
              {isExpanded && (
                <div className="mt-3 ml-5 p-3 bg-bg-tertiary rounded-lg">
                  <div className="grid grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-text-muted">方向</span>
                      <div className={`font-medium ${position.direction === 'LONG' ? 'text-accent-green' : 'text-accent-red'}`}>
                        {position.direction === 'LONG' ? '做多' : '做空'}
                      </div>
                    </div>
                    <div>
                      <span className="text-text-muted">市场</span>
                      <div className="text-text-primary">
                        {position.market === 'CN' ? 'A股' : position.market === 'HK' ? '港股' : '美股'}
                      </div>
                    </div>
                    <div>
                      <span className="text-text-muted">首次买入</span>
                      <div className="text-text-primary">
                        {new Date(position.firstBuyDate).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    <div>
                      <span className="text-text-muted">最后交易</span>
                      <div className="text-text-primary">
                        {new Date(position.lastTradeDate).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                  </div>

                  {/* 风控状态 */}
                  {(isOverLimit || isStopLoss) && (
                    <div className="mt-3 pt-3 border-t border-border">
                      {isStopLoss && (
                        <div className="flex items-center gap-2 text-accent-red text-xs">
                          <AlertTriangle size={14} />
                          <span>已触发止损红线（-20%），建议立即止损</span>
                        </div>
                      )}
                      {isOverLimit && (
                        <div className="flex items-center gap-2 text-accent-yellow text-xs mt-1">
                          <AlertTriangle size={14} />
                          <span>持仓占比超过 {positionLimitPercent}% 上限，建议减仓</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="mt-3 pt-3 border-t border-border flex gap-2">
                    <button 
                      className="px-3 py-1.5 text-xs bg-accent-red/20 text-accent-red rounded hover:bg-accent-red/30 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSell?.(position);
                      }}
                    >
                      {position.direction === 'LONG' ? '卖出' : '平仓'}
                    </button>
                    <button className="px-3 py-1.5 text-xs bg-accent-green/20 text-accent-green rounded hover:bg-accent-green/30 transition-colors">
                      {position.direction === 'LONG' ? '加仓' : '加空'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
