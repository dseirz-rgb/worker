import React from 'react';
import { History, Calendar, TrendingUp } from 'lucide-react';
import { Card } from '../ui';
import type { NetWorthRecord } from '../../types';

interface HistoryDataCardProps {
  history: NetWorthRecord[];
  isPrivacyMode?: boolean;
}

export function HistoryDataCard({ history, isPrivacyMode = false }: HistoryDataCardProps) {
  if (history.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <History size={16} className="text-accent-blue" />
          <span className="text-xs text-text-secondary uppercase tracking-wider">历史数据</span>
        </div>
        <div className="text-sm text-text-muted">暂无历史数据</div>
      </Card>
    );
  }

  const sortedHistory = [...history].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  const startDate = sortedHistory[0]?.date;
  const endDate = sortedHistory[sortedHistory.length - 1]?.date;
  const startValue = sortedHistory[0]?.netWorth ?? 0;
  const endValue = sortedHistory[sortedHistory.length - 1]?.netWorth ?? 0;
  const totalReturn = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
  const days = sortedHistory.length;

  // 计算最大回撤
  let maxDrawdown = 0;
  let peak = startValue;
  for (const point of sortedHistory) {
    if (point.netWorth > peak) {
      peak = point.netWorth;
    }
    const drawdown = peak > 0 ? ((peak - point.netWorth) / peak) * 100 : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return (
    <Card className="relative">
      <div className="flex items-center gap-2 mb-4">
        <History size={16} className="text-accent-blue" />
        <span className="text-xs text-text-secondary uppercase tracking-wider">历史数据</span>
        <span className="text-xs text-text-muted">({days} 天)</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <div className="text-xs text-text-muted mb-1">数据范围</div>
          <div className="text-sm font-bold text-text-primary">{days} 天</div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">起始日期</div>
          <div className="text-sm font-bold text-text-primary">
            {startDate ? new Date(startDate).toLocaleDateString('zh-CN') : '--'}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">最新日期</div>
          <div className="text-sm font-bold text-text-primary">
            {endDate ? new Date(endDate).toLocaleDateString('zh-CN') : '--'}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">期间收益</div>
          <div className={`text-sm font-bold mono-nums ${totalReturn >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
        <div>
          <div className="text-xs text-text-muted mb-1">起始净值</div>
          <div className="text-lg font-bold text-text-primary mono-nums">
            ¥{startValue.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">最新净值</div>
          <div className="text-lg font-bold text-text-primary mono-nums">
            ¥{endValue.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">期间最大回撤</div>
          <div className="text-lg font-bold text-accent-red mono-nums">
            {maxDrawdown.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">净值变化</div>
          <div className={`text-lg font-bold mono-nums ${endValue >= startValue ? 'text-accent-green' : 'text-accent-red'}`}>
            {endValue >= startValue ? '+' : ''}¥{(endValue - startValue).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </Card>
  );
}

