/**
 * RiskHistoryChart - 风险历史趋势图表组件
 * Feature: intelligent-risk-engine
 * 
 * 显示风险历史趋势。
 * 
 * Requirements: 7.6
 */

import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { riskDecisionEngine, RiskDecision, RiskLevel } from '../../services/riskDecisionEngine';

// ============ 类型定义 ============

export interface RiskHistoryChartProps {
  days?: number;
  showLeverage?: boolean;
  showStopLoss?: boolean;
  showRiskLevel?: boolean;
  className?: string;
}

interface DataPoint {
  timestamp: Date;
  riskLevel: RiskLevel;
  leverage: number;
  stopLoss: number;
}

// ============ 辅助函数 ============

function getRiskLevelValue(level: RiskLevel): number {
  switch (level) {
    case 'low': return 1;
    case 'medium': return 2;
    case 'high': return 3;
    case 'critical': return 4;
    default: return 0;
  }
}

function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'low': return '#22c55e';
    case 'medium': return '#eab308';
    case 'high': return '#f97316';
    case 'critical': return '#ef4444';
    default: return '#6b7280';
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// ============ 子组件 ============

interface SimpleLineChartProps {
  data: DataPoint[];
  dataKey: 'leverage' | 'stopLoss' | 'riskLevel';
  color: string;
  label: string;
  formatValue: (value: number) => string;
  height?: number;
}

function SimpleLineChart({ 
  data, 
  dataKey, 
  color, 
  label, 
  formatValue,
  height = 120 
}: SimpleLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        暂无数据
      </div>
    );
  }

  // 计算数据范围
  const values = data.map(d => {
    if (dataKey === 'riskLevel') {
      return getRiskLevelValue(d.riskLevel);
    }
    return dataKey === 'stopLoss' ? Math.abs(d[dataKey]) : d[dataKey];
  });
  
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  
  // 生成 SVG 路径
  const width = 100;
  const padding = 5;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
    const value = dataKey === 'riskLevel' 
      ? getRiskLevelValue(d.riskLevel)
      : dataKey === 'stopLoss' ? Math.abs(d[dataKey]) : d[dataKey];
    const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  // 当前值
  const currentValue = data[data.length - 1];
  const displayValue = dataKey === 'riskLevel'
    ? currentValue.riskLevel
    : dataKey === 'stopLoss' 
      ? currentValue.stopLoss 
      : currentValue.leverage;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium" style={{ color }}>
          {formatValue(displayValue as number)}
        </span>
      </div>
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full"
        style={{ height }}
      >
        {/* 网格线 */}
        <line 
          x1={padding} y1={padding} 
          x2={padding} y2={height - padding} 
          stroke="currentColor" 
          strokeOpacity={0.1} 
        />
        <line 
          x1={padding} y1={height - padding} 
          x2={width - padding} y2={height - padding} 
          stroke="currentColor" 
          strokeOpacity={0.1} 
        />
        
        {/* 数据线 */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        
        {/* 数据点 */}
        {data.map((d, i) => {
          const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
          const value = dataKey === 'riskLevel' 
            ? getRiskLevelValue(d.riskLevel)
            : dataKey === 'stopLoss' ? Math.abs(d[dataKey]) : d[dataKey];
          const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
          
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={3}
              fill={dataKey === 'riskLevel' ? getRiskLevelColor(d.riskLevel) : color}
            />
          );
        })}
      </svg>
      
      {/* X 轴标签 */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatDate(data[0].timestamp)}</span>
        <span>{formatDate(data[data.length - 1].timestamp)}</span>
      </div>
    </div>
  );
}

interface RiskLevelTimelineProps {
  data: DataPoint[];
}

function RiskLevelTimeline({ data }: RiskLevelTimelineProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-16 text-muted-foreground text-sm">
        暂无数据
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">风险等级变化</div>
      <div className="flex gap-1 h-8">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-colors"
            style={{ backgroundColor: getRiskLevelColor(d.riskLevel) }}
            title={`${formatTime(d.timestamp)}: ${d.riskLevel}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatDate(data[0].timestamp)}</span>
        <span>{formatDate(data[data.length - 1].timestamp)}</span>
      </div>
    </div>
  );
}

// ============ 主组件 ============

export function RiskHistoryChart({
  days = 7,
  showLeverage = true,
  showStopLoss = true,
  showRiskLevel = true,
  className,
}: RiskHistoryChartProps) {
  const [history, setHistory] = useState<RiskDecision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadHistory() {
      setIsLoading(true);
      try {
        const data = await riskDecisionEngine.getDecisionHistory(days);
        setHistory(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('加载历史数据失败'));
      } finally {
        setIsLoading(false);
      }
    }
    
    loadHistory();
  }, [days]);

  // 转换为图表数据点
  const dataPoints: DataPoint[] = useMemo(() => {
    return history
      .map(d => ({
        timestamp: new Date(d.timestamp),
        riskLevel: d.overallRiskLevel,
        leverage: d.effectiveLeverage,
        stopLoss: d.effectiveStopLoss,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [history]);

  // 计算统计数据
  const stats = useMemo(() => {
    if (dataPoints.length === 0) return null;
    
    const riskLevelCounts: Record<RiskLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    
    let totalLeverage = 0;
    let totalStopLoss = 0;
    
    for (const d of dataPoints) {
      riskLevelCounts[d.riskLevel]++;
      totalLeverage += d.leverage;
      totalStopLoss += d.stopLoss;
    }
    
    return {
      avgLeverage: totalLeverage / dataPoints.length,
      avgStopLoss: totalStopLoss / dataPoints.length,
      riskLevelCounts,
      mostCommonRisk: Object.entries(riskLevelCounts)
        .sort((a, b) => b[1] - a[1])[0][0] as RiskLevel,
    };
  }, [dataPoints]);

  if (isLoading) {
    return (
      <div className={cn('p-4 rounded-lg border bg-card', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 rounded-lg border bg-card', className)}>
        <div className="text-center text-muted-foreground py-8">
          <p>加载历史数据失败</p>
          <p className="text-xs mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-4 rounded-lg border bg-card', className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">风险历史趋势</h3>
        <span className="text-xs text-muted-foreground">
          过去 {days} 天
        </span>
      </div>

      {dataPoints.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <p>暂无历史数据</p>
          <p className="text-xs mt-1">系统将在生成决策后记录历史</p>
        </div>
      ) : (
        <>
          {/* 统计摘要 */}
          {stats && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-2 rounded bg-muted/50 text-center">
                <div className="text-xs text-muted-foreground">平均杠杆</div>
                <div className="text-lg font-bold">{stats.avgLeverage.toFixed(2)}x</div>
              </div>
              <div className="p-2 rounded bg-muted/50 text-center">
                <div className="text-xs text-muted-foreground">平均止损</div>
                <div className="text-lg font-bold">{(stats.avgStopLoss * 100).toFixed(0)}%</div>
              </div>
              <div className="p-2 rounded bg-muted/50 text-center">
                <div className="text-xs text-muted-foreground">主要风险</div>
                <div 
                  className="text-lg font-bold"
                  style={{ color: getRiskLevelColor(stats.mostCommonRisk) }}
                >
                  {stats.mostCommonRisk === 'low' ? '低' :
                   stats.mostCommonRisk === 'medium' ? '中' :
                   stats.mostCommonRisk === 'high' ? '高' : '极高'}
                </div>
              </div>
            </div>
          )}

          {/* 风险等级时间线 */}
          {showRiskLevel && (
            <div className="mb-4">
              <RiskLevelTimeline data={dataPoints} />
            </div>
          )}

          {/* 杠杆趋势 */}
          {showLeverage && (
            <div className="mb-4">
              <SimpleLineChart
                data={dataPoints}
                dataKey="leverage"
                color="#3b82f6"
                label="杠杆限制"
                formatValue={(v) => `${v.toFixed(2)}x`}
              />
            </div>
          )}

          {/* 止损趋势 */}
          {showStopLoss && (
            <div>
              <SimpleLineChart
                data={dataPoints}
                dataKey="stopLoss"
                color="#f97316"
                label="止损线"
                formatValue={(v) => `${(v * 100).toFixed(0)}%`}
              />
            </div>
          )}
        </>
      )}

      {/* 底部信息 */}
      <div className="text-xs text-muted-foreground mt-4 pt-3 border-t text-center">
        共 {dataPoints.length} 条决策记录
      </div>
    </div>
  );
}

export default RiskHistoryChart;
