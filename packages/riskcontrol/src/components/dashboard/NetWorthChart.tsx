import React, { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card } from '../ui';
import type { NetWorthRecord } from '../../types';
import { TrendingUp } from 'lucide-react';

interface NetWorthChartProps {
  data: NetWorthRecord[];
  highWaterMark: number;
  showRealtime?: boolean;  // 是否显示实时数据点，默认 false
  currentNetWorth?: number; // 当前实时净值
  currentAllocation?: { longRatio: number; shortRatio: number; cashRatio: number };
  hideAbsoluteValues?: boolean;
}

export function NetWorthChart({ 
  data, 
  highWaterMark, 
  showRealtime = false,
  currentNetWorth,
  currentAllocation,
  hideAbsoluteValues = false
}: NetWorthChartProps) {
  const chartData = useMemo(() => {
    if (data.length === 0) {
      // 生成演示数据
      const demoData: NetWorthRecord[] = [];
      const today = new Date();
      let netWorth = 100000;
      let hwm = 100000;
      
      for (let i = 30; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        // 随机波动
        const change = (Math.random() - 0.45) * 3000;
        netWorth = Math.max(80000, netWorth + change);
        hwm = Math.max(hwm, netWorth);
        
        const cashValue = (30 + Math.random() * 20) / 100 * netWorth;
        const longValue = (40 + Math.random() * 20) / 100 * netWorth;
        const shortValue = (Math.random() * 10) / 100 * netWorth;
        
        demoData.push({
          date: date.toISOString(),
          netWorth,
          cashRatio: 30 + Math.random() * 20,
          longRatio: 40 + Math.random() * 20,
          shortRatio: Math.random() * 10,
          highWaterMark: hwm,
          cashValue,
          longValue,
          shortValue,
        });
      }
      
      const baseNetWorth = demoData[0]?.netWorth || 1;

      return demoData.map(d => ({
        ...d,
        dateLabel: new Date(d.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
        // 计算正负现金值
        cashPositive: Math.max(0, d.cashValue || 0),
        cashNegative: Math.min(0, d.cashValue || 0),
        // 计算收益率
        returnPercent: ((d.netWorth - baseNetWorth) / baseNetWorth) * 100
      }));
    }

    // 确保使用最新的数据，包含最新日期
    // 显示全部数据（最多 365 条），让用户看到完整的年度走势
    const recentData = data.length > 365 ? data.slice(-365) : data;
    const baseNetWorth = recentData[0]?.netWorth || 1;

    const chartData = recentData.map(d => {
      // 如果没有实际金额值，则从百分比计算
      const cashValue = d.cashValue ?? (d.cashRatio / 100 * d.netWorth);
      const longValue = d.longValue ?? (d.longRatio / 100 * d.netWorth);
      const shortValue = d.shortValue ?? (d.shortRatio / 100 * d.netWorth);
      
      return {
        ...d,
        dateLabel: new Date(d.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
        cashValue,
        longValue,
        shortValue,
        // 计算正负现金值
        cashPositive: Math.max(0, cashValue),
        cashNegative: Math.min(0, cashValue),
        // 计算收益率
        returnPercent: ((d.netWorth - baseNetWorth) / baseNetWorth) * 100
      };
    });
    
    // 调试：检查数据值
    if (chartData.length > 0) {
      const first = chartData[0];
      const hasBarData = chartData.some(d => 
        (d.longValue && d.longValue > 0) || 
        (d.shortValue && d.shortValue > 0) || 
        (d.cashPositive && d.cashPositive > 0) ||
        (d.cashNegative && d.cashNegative < 0)
      );
      console.log('[净值图表] 数据检查:', {
        totalRecords: chartData.length,
        hasBarData,
        firstRecord: {
          longValue: first.longValue,
          shortValue: first.shortValue,
          cashValue: first.cashValue,
          cashPositive: first.cashPositive,
          cashNegative: first.cashNegative,
          netWorth: first.netWorth,
          returnPercent: first.returnPercent
        },
        sampleValues: chartData.slice(0, 3).map(d => ({
          date: d.dateLabel,
          longValue: d.longValue,
          shortValue: d.shortValue,
          cashPositive: d.cashPositive,
        })),
      });
    } else {
      console.warn('[净值图表] 没有图表数据');
    }
    
    return chartData;
  }, [data]);

  const minValue = useMemo(() => {
    if (chartData.length === 0) return 0;
    
    if (hideAbsoluteValues) {
      const returnValues = chartData.map(d => d.returnPercent || 0);
      return Math.min(...returnValues, 0) - 2; // 留出缓冲
    }

    // 考虑所有可能的最小值：净值、负现金、以及柱状图的底部
    const netWorthValues = chartData.map(d => d.netWorth);
    const cashNegativeValues = chartData.map(d => (d as any).cashNegative || 0);
    const minNetWorth = Math.min(...netWorthValues);
    const minCash = Math.min(...cashNegativeValues);
    
    // 确保最小值不会太小，至少显示到 0
    const calculatedMin = Math.min(minNetWorth, minCash, 0);
    return calculatedMin * 1.1; // 增加一些边距
  }, [chartData, hideAbsoluteValues]);

  const maxValue = useMemo(() => {
    if (chartData.length === 0) return 100000;
    
    if (hideAbsoluteValues) {
      const returnValues = chartData.map(d => d.returnPercent || 0);
      return Math.max(...returnValues, 0) + 2; // 留出缓冲
    }

    // 考虑净值、HWM 以及柱状图堆叠后的最大值
    const netWorthValues = chartData.map(d => d.netWorth);
    const hwmValues = chartData.map(d => d.highWaterMark);
    
    // 计算每个数据点的柱状图堆叠高度（longValue + shortValue + cashPositive）
    const barStackHeights = chartData.map(d => {
      const longValue = d.longValue || 0;
      const shortValue = d.shortValue || 0;
      const cashPositive = (d as any).cashPositive || 0;
      return longValue + shortValue + cashPositive;
    });
    
    // 最大值应该是：净值、HWM、或柱状图堆叠高度的最大值
    const maxNetWorth = Math.max(...netWorthValues);
    const maxHWM = Math.max(...hwmValues);
    const maxBarStack = Math.max(...barStackHeights, 0);
    
    // 取最大值并增加边距
    const calculatedMax = Math.max(maxNetWorth, maxHWM, maxBarStack);
    return calculatedMax * 1.1;
  }, [chartData, hideAbsoluteValues]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-bg-secondary border border-border rounded-lg p-3 shadow-lg">
        <div className="text-xs text-text-muted mb-2">{label}</div>
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-xs text-text-secondary">{hideAbsoluteValues ? '累计收益率' : '净值'}</span>
            <span className={`text-sm mono-nums ${hideAbsoluteValues ? (data.returnPercent >= 0 ? 'text-accent-green' : 'text-accent-red') : 'text-accent-cyan'}`}>
              {hideAbsoluteValues 
                ? `${data.returnPercent >= 0 ? '+' : ''}${data.returnPercent?.toFixed(2)}%`
                : `¥${data.netWorth.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
              }
            </span>
          </div>
          {!hideAbsoluteValues && (
            <div className="flex justify-between gap-4">
              <span className="text-xs text-text-secondary">HWM</span>
              <span className="text-sm text-accent-yellow mono-nums">
                ¥{data.highWaterMark.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-4 pt-1 border-t border-border">
            <span className="text-xs text-accent-blue">多头 {data.longRatio?.toFixed(0) ?? '0'}%</span>
            <span className="text-xs text-accent-yellow">空头 {data.shortRatio?.toFixed(0) ?? '0'}%</span>
            <span className="text-xs text-accent-green">现金 {data.cashRatio?.toFixed(0) ?? '0'}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="h-64 sm:h-80">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-accent-cyan" />
          <span className="text-xs text-text-secondary uppercase tracking-wider">{hideAbsoluteValues ? '业绩走势' : '净值走势'}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 sm:w-3 h-0.5 bg-accent-cyan" />
            <span className="text-text-muted text-[10px] sm:text-xs">{hideAbsoluteValues ? '收益率' : '净值'}</span>
          </div>
          {!hideAbsoluteValues && (
            <div className="hidden sm:flex items-center gap-1">
              <div className="w-3 h-0.5 bg-accent-yellow border-dashed" style={{ borderTop: '1px dashed' }} />
              <span className="text-text-muted">HWM</span>
            </div>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height="85%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }} barGap={0} barCategoryGap="20%" barSize={30}>
          <defs>
            <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="longGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4a9eff" stopOpacity={1.0} />
              <stop offset="100%" stopColor="#4a9eff" stopOpacity={0.7} />
            </linearGradient>
            <linearGradient id="shortGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffd700" stopOpacity={1.0} />
              <stop offset="100%" stopColor="#ffd700" stopOpacity={0.7} />
            </linearGradient>
            <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00ff88" stopOpacity={1.0} />
              <stop offset="100%" stopColor="#00ff88" stopOpacity={0.7} />
            </linearGradient>
          </defs>

          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="rgba(255,255,255,0.05)" 
            vertical={false}
          />

          <XAxis 
            dataKey="dateLabel" 
            tick={{ fill: '#666', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />

          <YAxis 
            domain={[minValue, maxValue]}
            tick={{ fill: '#666', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
            tickFormatter={(value) => hideAbsoluteValues ? `${value.toFixed(0)}%` : `¥${(value / 1000).toFixed(0)}k`}
            width={50}
          />
          
          {/* 零轴参考线 */}
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />

          <Tooltip content={<CustomTooltip />} />

          {/* 净值/收益率面积图 - 先渲染，作为背景 */}
          <Area
            type="monotone"
            dataKey={hideAbsoluteValues ? "returnPercent" : "netWorth"}
            stroke="#00d4aa"
            strokeWidth={2}
            fill="url(#netWorthGradient)"
          />

          {/* 持仓结构堆叠柱状图（使用实际金额值）- 仅在不隐藏绝对值时显示 */}
          {!hideAbsoluteValues && (
            <>
              {/* 股票（多头）- 堆叠在零轴上方，从 0 开始 */}
              <Bar 
                dataKey="longValue" 
                stackId="positive"
                fill="#4a9eff"
                opacity={0.9}
                stroke="#4a9eff"
                strokeWidth={2}
                radius={[2, 2, 0, 0]}
                isAnimationActive={true}
              />
              {/* 期权（空头）- 堆叠在股票上方 */}
              <Bar 
                dataKey="shortValue" 
                stackId="positive"
                fill="#ffd700"
                opacity={0.9}
                stroke="#ffd700"
                strokeWidth={2}
                radius={[2, 2, 0, 0]}
                isAnimationActive={true}
              />
              {/* 正现金 - 堆叠在期权上方 */}
              <Bar 
                dataKey="cashPositive" 
                stackId="positive"
                fill="#00ff88"
                opacity={0.9}
                stroke="#00ff88"
                strokeWidth={2}
                radius={[2, 2, 0, 0]}
                isAnimationActive={true}
              />
              {/* 负现金 - 显示在零轴下方，向下堆叠 */}
              <Bar 
                dataKey="cashNegative" 
                stackId="negative"
                fill="#ff6b6b"
                opacity={0.9}
                stroke="#ff6b6b"
                strokeWidth={2}
                radius={[0, 0, 2, 2]}
                isAnimationActive={true}
              />
            </>
          )}

          {/* HWM 参考线 - 仅在不隐藏绝对值时显示 */}
          {!hideAbsoluteValues && (
            <Line
              type="stepAfter"
              dataKey="highWaterMark"
              stroke="#ffd700"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
            />
          )}

          {/* 当前 HWM 水平线 - 仅在不隐藏绝对值时显示 */}
          {!hideAbsoluteValues && highWaterMark > 0 && (
            <ReferenceLine 
              y={highWaterMark} 
              stroke="#ffd700" 
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
