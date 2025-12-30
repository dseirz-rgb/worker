/**
 * 持仓列表组件
 */

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Briefcase } from 'lucide-react';
import type { Position } from '../../services/riskcontrol';

interface PositionListProps {
  positions: Position[];
}

export function PositionList({ positions }: PositionListProps) {
  // 格式化金额
  const formatMoney = (n: number) =>
    n.toLocaleString('zh-CN', { minimumFractionDigits: 2 });

  // 格式化百分比
  const formatPercent = (n: number) =>
    `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  // 按权重排序
  const sortedPositions = [...positions].sort((a, b) => b.weight - a.weight);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          持仓明细
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedPositions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            暂无持仓
          </p>
        ) : (
          <div className="space-y-3">
            {sortedPositions.map((position) => (
              <div
                key={position.symbol}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div>
                  <p className="font-medium text-sm">{position.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {position.symbol} · {position.quantity}股 · 占比{position.weight.toFixed(1)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">¥{formatMoney(position.marketValue)}</p>
                  <p
                    className={`text-xs ${
                      position.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {formatPercent(position.pnlPercent)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
