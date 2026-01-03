import React from 'react';
import { Card } from '../ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { BarChart3 } from 'lucide-react';

// 支持两种命名风格的收益归因数据
type ReturnAttributionData = {
  // camelCase 风格
  tradingPnL?: number;
  positionPnL?: number;
  dividendIncome?: number;
  interestIncome?: number;
  optionPnL?: number;
  fxPnL?: number;
  totalReturn?: number;
  // snake_case 风格 (来自 Supabase)
  trading_pnl?: number;
  position_pnl?: number;
  dividend_income?: number;
  interest_income?: number;
  option_pnl?: number;
  fx_pnl?: number;
  total_return?: number;
  record_count?: number;
};

interface ReturnAttributionChartProps {
  data: ReturnAttributionData | null;
}

export function ReturnAttributionChart({ data }: ReturnAttributionChartProps) {
  // 防御性编程：兼容下划线和驼峰命名
  const safeData = data ? {
    tradingPnL: data.tradingPnL ?? data.trading_pnl ?? 0,
    positionPnL: data.positionPnL ?? data.position_pnl ?? 0,
    dividendIncome: data.dividendIncome ?? data.dividend_income ?? 0,
    interestIncome: data.interestIncome ?? data.interest_income ?? 0,
    optionPnL: data.optionPnL ?? data.option_pnl ?? 0,
    fxPnL: data.fxPnL ?? data.fx_pnl ?? 0,
    totalReturn: data.totalReturn ?? data.total_return ?? 0,
  } : null;

  if (!safeData) {
      return (
          <Card className="h-80 flex items-center justify-center">
              <p className="text-text-muted">暂无收益归因数据</p>
          </Card>
      );
  }

  const chartData = [
    { name: '交易', value: safeData.tradingPnL },
    { name: '持仓', value: safeData.positionPnL },
    { name: '股息', value: safeData.dividendIncome },
    { name: '利息', value: safeData.interestIncome },
    { name: '期权', value: safeData.optionPnL },
    { name: '外汇', value: safeData.fxPnL },
    { name: '总收益', value: safeData.totalReturn, isTotal: true },
  ];

  return (
    <Card className="h-64 sm:h-80">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-accent-cyan" />
          <span className="text-xs text-text-secondary uppercase tracking-wider">收益归因 (YTD)</span>
        </div>
        <div className="text-[10px] sm:text-xs text-text-muted">
          总: ¥{(safeData.totalReturn / 10000).toFixed(1)}万
        </div>
      </div>

      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#666', fontSize: 9 }} axisLine={false} tickLine={false} width={35} tickFormatter={(v) => `${(v/10000).toFixed(0)}万`} />
          <Tooltip 
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', fontSize: '12px' }}
            formatter={(value: number) => [`¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`, '收益']}
          />
          <ReferenceLine y={0} stroke="#666" />
          <Bar dataKey="value">
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.isTotal ? (entry.value >= 0 ? '#4a9eff' : '#ff6b6b') : (entry.value >= 0 ? '#00d4aa' : '#ff6b6b')} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
