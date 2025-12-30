/**
 * 投资组合卡片
 */

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import type { PortfolioSummary } from '../../services/riskcontrol';

interface PortfolioCardProps {
  summary: PortfolioSummary;
}

export function PortfolioCard({ summary }: PortfolioCardProps) {
  // 格式化金额
  const formatMoney = (n: number) =>
    n.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' });

  // 格式化百分比
  const formatPercent = (n: number) =>
    `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  const isPositive = summary.dailyPnL >= 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          投资组合
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* 总市值 */}
          <div>
            <p className="text-xs text-muted-foreground">总市值</p>
            <p className="text-2xl font-bold">{formatMoney(summary.totalValue)}</p>
          </div>

          {/* 今日盈亏 */}
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground">今日盈亏</p>
              <div className={`flex items-center gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span className="font-medium">{formatMoney(summary.dailyPnL)}</span>
                <span className="text-sm">({formatPercent(summary.dailyPnLPercent)})</span>
              </div>
            </div>
          </div>

          {/* 总盈亏 */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">总盈亏</span>
            <span className={summary.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}>
              {formatMoney(summary.totalPnL)} ({formatPercent(summary.totalPnLPercent)})
            </span>
          </div>

          {/* 持仓数 */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">持仓数</span>
            <span>{summary.positions}</span>
          </div>

          {/* 更新时间 */}
          <p className="text-xs text-muted-foreground text-right">
            更新于 {new Date(summary.lastUpdated).toLocaleString('zh-CN')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
