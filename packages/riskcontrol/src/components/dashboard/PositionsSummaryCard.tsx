import React from 'react';
import { LineChart, TrendingUp, TrendingDown, Copy, Check } from 'lucide-react';
import { Card, Badge } from '../ui';
import type { Position, PortfolioState } from '../../types';

interface PositionsSummaryCardProps {
  positions: Position[];
  portfolioState?: PortfolioState | null;
  hideAbsoluteValues?: boolean;
  showAmounts?: boolean;
  livePrices?: Record<string, { currentPrice: number; changePercent: number; lastUpdated: number }>;
}

export function PositionsSummaryCard({ 
    positions, 
    portfolioState, 
    hideAbsoluteValues = false,
    showAmounts = false,
    livePrices = {}
}: PositionsSummaryCardProps) {
  const [copied, setCopied] = React.useState(false);

  // 一键复制持仓摘要
  const copyPositionsSummary = () => {
    const date = new Date().toLocaleDateString('zh-CN');
    const totalMarketValue = positions.reduce((sum, p) => sum + p.marketValueCNY, 0);
    const totalPnL = positions.reduce((sum, p) => sum + p.unrealizedPnLCNY, 0);
    const totalPnLPercent = totalMarketValue > 0 ? (totalPnL / totalMarketValue) * 100 : 0;
    
    const positionLines = positions
      .sort((a, b) => b.marketValueCNY - a.marketValueCNY)
      .slice(0, 10)
      .map((p, i) => {
        const weight = portfolioState?.totalNetWorthCNY 
          ? (p.marketValueCNY / portfolioState.totalNetWorthCNY * 100).toFixed(1)
          : '?';
        const todayChange = livePrices[p.ticker]?.changePercent;
        const todayStr = todayChange !== undefined ? `今日${todayChange >= 0 ? '+' : ''}${todayChange.toFixed(1)}%` : '';
        return `${i + 1}. ${p.ticker} ${weight}% | 持仓${p.unrealizedPnLPercent >= 0 ? '+' : ''}${p.unrealizedPnLPercent.toFixed(1)}% ${todayStr}`;
      })
      .join('\n');
    
    const summary = `📊 持仓快照 ${date}
总盈亏: ${totalPnLPercent >= 0 ? '+' : ''}${totalPnLPercent.toFixed(2)}%
持仓数: ${positions.length}

${positionLines}`;
    
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  if (positions.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <LineChart size={16} className="text-accent-cyan" />
          <span className="text-xs text-text-secondary uppercase tracking-wider">持仓概览</span>
        </div>
        <div className="text-sm text-text-muted">暂无持仓</div>
      </Card>
    );
  }

  const longPositions = positions.filter(p => p.direction === 'LONG');
  const shortPositions = positions.filter(p => p.direction === 'SHORT');
  const profitablePositions = positions.filter(p => p.unrealizedPnLPercent >= 0);
  const losingPositions = positions.filter(p => p.unrealizedPnLPercent < 0);
  
  const totalMarketValue = positions.reduce((sum, p) => sum + p.marketValueCNY, 0);
  const totalPnL = positions.reduce((sum, p) => sum + p.unrealizedPnLCNY, 0);
  const totalPnLPercent = totalMarketValue > 0 ? (totalPnL / totalMarketValue) * 100 : 0;

  // 按市值排序，取前5
  const topPositions = [...positions]
    .sort((a, b) => b.marketValueCNY - a.marketValueCNY)
    .slice(0, 5);

  return (
    <Card className="relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <LineChart size={16} className="text-accent-cyan" />
          <span className="text-xs text-text-secondary uppercase tracking-wider">持仓概览</span>
          <Badge variant="info">{positions.length}</Badge>
        </div>
        {/* 一键复制按钮 */}
        <button
          onClick={copyPositionsSummary}
          className="p-1.5 text-text-muted hover:text-accent-cyan hover:bg-accent-cyan/10 rounded transition-colors"
          title="复制持仓摘要"
        >
          {copied ? <Check size={14} className="text-accent-green" /> : <Copy size={14} />}
        </button>
      </div>

      {/* 总体统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b border-border">
        <div>
          <div className="text-xs text-text-muted mb-1">总市值</div>
          <div className="text-lg font-bold text-text-primary mono-nums">
            {showAmounts ? (
                hideAbsoluteValues ? (
                <span className="text-text-muted blur-[2px] select-none">¥****</span>
                ) : (
                `¥${totalMarketValue.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
                )
            ) : (
                "100%"
            )}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">总盈亏</div>
          {showAmounts ? (
            hideAbsoluteValues ? (
                <div className="text-lg font-bold text-text-muted blur-[2px] select-none">
                ¥****
                </div>
            ) : (
                <div className={`text-lg font-bold mono-nums ${totalPnL >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                {totalPnL >= 0 ? '+' : ''}¥{totalPnL.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                </div>
            )
          ) : (
             <div className="text-sm text-text-muted mt-1">--</div>
          )}
          <div className={`text-xs ${showAmounts ? '' : 'text-lg font-bold'} ${totalPnLPercent >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">多头/空头</div>
          <div className="text-lg font-bold text-text-primary mono-nums">
            {longPositions.length} / {shortPositions.length}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">盈利/亏损</div>
          <div className="text-lg font-bold text-text-primary mono-nums">
            {profitablePositions.length} / {losingPositions.length}
          </div>
        </div>
      </div>

      {/* 前5大持仓 */}
      <div>
        <div className="text-xs text-text-secondary uppercase tracking-wider mb-2">前5大持仓</div>
        <div className="space-y-2">
          {topPositions.map((pos, idx) => {
            // 计算持仓占比（相对于总净值，允许超过100%）
            const portfolioTotal = portfolioState?.totalNetWorthCNY || totalMarketValue;
            const positionWeight = portfolioTotal > 0 ? (pos.marketValueCNY / portfolioTotal) * 100 : 0;
            
            // 获取今日涨跌（从实时行情）
            const liveData = livePrices[pos.ticker];
            const todayChange = liveData?.changePercent;
            const hasLiveData = todayChange !== undefined;
            
            return (
              <div key={pos.id} className="flex items-center justify-between p-2 rounded bg-bg-secondary/50">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs text-text-muted w-4">{idx + 1}</span>
                  <span className="text-sm font-medium text-text-primary truncate">{pos.ticker}</span>
                  <span className="text-xs text-text-muted truncate hidden sm:inline">{pos.name}</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-right">
                  <div className="hidden sm:block">
                    <div className="text-xs text-text-muted">占比</div>
                    <div className="text-sm font-bold text-text-primary mono-nums">
                      {positionWeight.toFixed(1)}%
                    </div>
                  </div>
                  {/* 今日涨跌 - 新增 */}
                  <div className="min-w-[50px]">
                    <div className="text-xs text-text-muted flex items-center gap-1">
                      今日
                      {hasLiveData && <span className="w-1 h-1 rounded-full bg-accent-green animate-pulse" />}
                    </div>
                    <div className={`text-sm font-bold mono-nums ${
                      hasLiveData 
                        ? (todayChange >= 0 ? 'text-accent-green' : 'text-accent-red')
                        : 'text-text-muted'
                    }`}>
                      {hasLiveData 
                        ? `${todayChange >= 0 ? '+' : ''}${todayChange.toFixed(2)}%`
                        : '--'
                      }
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-xs text-text-muted">{showAmounts ? '市值' : '方向'}</div>
                    <div className="text-sm font-bold text-text-primary mono-nums">
                      {showAmounts ? (
                          hideAbsoluteValues ? (
                            <span className="text-text-muted blur-[2px] select-none">¥****</span>
                          ) : (
                            `¥${pos.marketValueCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
                          )
                      ) : (
                          <span className={pos.direction === 'LONG' ? 'text-accent-green' : 'text-accent-red'}>
                              {pos.direction === 'LONG' ? '多' : '空'}
                          </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted">持仓盈亏</div>
                    <div className={`flex items-center justify-end gap-1 text-sm font-bold mono-nums ${pos.unrealizedPnLPercent >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {pos.unrealizedPnLPercent >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {pos.unrealizedPnLPercent >= 0 ? '+' : ''}{pos.unrealizedPnLPercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

