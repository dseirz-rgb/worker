import React from 'react';
import { Card } from '../ui';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { BadgeDollarSign } from 'lucide-react';
import type { CostAnalysis } from '../../types';

interface CostAnalysisChartProps {
  data: CostAnalysis | null;
}

export function CostAnalysisChart({ data }: CostAnalysisChartProps) {
  // 使用 YTD 累计数据，而不是单日数据
  const safeData = data ? {
    // 优先使用累计数据 (cumulative_*)，回退到单日数据
    totalCosts: ((data as any).cumulative_commissions + (data as any).cumulative_fees + (data as any).cumulative_taxes) 
      || (data as any).totalCosts || (data as any).total_costs || 0,
    stockCommissions: (data as any).cumulative_commissions ?? (data as any).stockCommissions ?? (data as any).stock_commissions ?? 0,
    optionCommissions: (data as any).optionCommissions ?? (data as any).option_commissions ?? 0,
    totalFees: (data as any).cumulative_fees ?? (data as any).totalFees ?? (data as any).total_fees ?? 0,
    totalTaxes: (data as any).cumulative_taxes ?? (data as any).totalTaxes ?? (data as any).total_taxes ?? 0,
  } : null;

  if (!safeData) {
    return (
        <Card className="h-80 flex items-center justify-center">
            <p className="text-text-muted">暂无成本分析数据</p>
        </Card>
    );
  }

  const chartData = [
    { name: '股票佣金', value: safeData.stockCommissions, color: '#4a9eff' },
    { name: '期权佣金', value: safeData.optionCommissions, color: '#ffd700' },
    { name: '平台费用', value: safeData.totalFees, color: '#ff6b6b' },
    { name: '税费', value: safeData.totalTaxes, color: '#a0a0a0' },
  ].filter(d => d.value > 0);

  return (
    <Card className="h-64 sm:h-80">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <BadgeDollarSign size={16} className="text-accent-cyan" />
          <span className="text-xs text-text-secondary uppercase tracking-wider">成本分析 (YTD)</span>
        </div>
        <div className="text-[10px] sm:text-xs text-text-muted">
            总: ¥{safeData.totalCosts.toFixed(0)}
        </div>
      </div>

      <ResponsiveContainer width="100%" height="85%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="45%"
            innerRadius={40}
            outerRadius={60}
            paddingAngle={5}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip 
             formatter={(value: number) => `¥${value.toFixed(2)}`}
             contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', fontSize: '12px' }}
          />
          <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
