/**
 * RiskHistoryChart - 风险历史趋势图表组件 (HeroUI 版本)
 * 
 * 显示风险历史趋势。
 * 从 RiskControl 移植并转换为 HeroUI 组件。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardBody, CardHeader, Chip, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';

// ============ 类型定义 ============

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface DataPoint {
  timestamp: Date;
  riskLevel: RiskLevel;
  leverage: number;
  stopLoss: number;
}

export interface RiskHistoryChartProps {
  days?: number;
  showLeverage?: boolean;
  showStopLoss?: boolean;
  showRiskLevel?: boolean;
  className?: string;
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

// ============ Mock 数据 ============

function generateMockHistory(days: number): DataPoint[] {
  const data: DataPoint[] = [];
  const now = Date.now();
  const levels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
  
  for (let i = days; i >= 0; i--) {
    data.push({
      timestamp: new Date(now - i * 24 * 60 * 60 * 1000),
      riskLevel: levels[Math.floor(Math.random() * 3)],
      leverage: 1.0 + Math.random() * 0.5,
      stopLoss: -0.05 - Math.random() * 0.05,
    });
  }
  
  return data;
}


// ============ 子组件 ============

interface SimpleLineChartProps {
  data: DataPoint[];
  dataKey: 'leverage' | 'stopLoss';
  color: string;
  label: string;
  formatValue: (value: number) => string;
  height?: number;
}

function SimpleLineChart({ data, dataKey, color, label, formatValue, height = 120 }: SimpleLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-foreground/60 text-sm">
        暂无数据
      </div>
    );
  }

  const values = data.map(d => dataKey === 'stopLoss' ? Math.abs(d[dataKey]) : d[dataKey]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  
  const width = 100;
  const padding = 5;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
    const value = dataKey === 'stopLoss' ? Math.abs(d[dataKey]) : d[dataKey];
    const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  const currentValue = data[data.length - 1];
  const displayValue = dataKey === 'stopLoss' ? currentValue.stopLoss : currentValue.leverage;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground/60">{label}</span>
        <span className="text-sm font-medium" style={{ color }}>{formatValue(displayValue)}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="currentColor" strokeOpacity={0.1} />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" strokeOpacity={0.1} />
        <polyline fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" points={points} />
        {data.map((d, i) => {
          const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
          const value = dataKey === 'stopLoss' ? Math.abs(d[dataKey]) : d[dataKey];
          const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
          return <circle key={i} cx={x} cy={y} r={3} fill={color} />;
        })}
      </svg>
      <div className="flex justify-between text-xs text-foreground/50">
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
    return <div className="flex items-center justify-center h-16 text-foreground/60 text-sm">暂无数据</div>;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-foreground/60">风险等级变化</div>
      <div className="flex gap-1 h-8">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-colors"
            style={{ backgroundColor: getRiskLevelColor(d.riskLevel) }}
            title={`${formatDate(d.timestamp)}: ${d.riskLevel}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-foreground/50">
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
  className = '',
}: RiskHistoryChartProps) {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadHistory() {
      setIsLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        setDataPoints(generateMockHistory(days));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('加载历史数据失败'));
      } finally {
        setIsLoading(false);
      }
    }
    
    loadHistory();
  }, [days]);

  // 计算统计数据
  const stats = useMemo(() => {
    if (dataPoints.length === 0) return null;
    
    const riskLevelCounts: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
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
      mostCommonRisk: Object.entries(riskLevelCounts).sort((a, b) => b[1] - a[1])[0][0] as RiskLevel,
    };
  }, [dataPoints]);

  if (isLoading) {
    return (
      <Card className={`bg-content1/50 backdrop-blur-sm ${className}`}>
        <CardBody className="flex items-center justify-center h-48">
          <Spinner size="lg" />
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`bg-content1/50 backdrop-blur-sm ${className}`}>
        <CardBody className="text-center py-8 text-foreground/60">
          <p>加载历史数据失败</p>
          <p className="text-xs mt-1">{error.message}</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className={`bg-content1/50 backdrop-blur-sm ${className}`}>
      <CardHeader className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:chart-line" className="text-xl text-primary" />
          <h3 className="font-semibold">风险历史趋势</h3>
        </div>
        <span className="text-xs text-foreground/50">过去 {days} 天</span>
      </CardHeader>
      <CardBody className="space-y-4">
        {dataPoints.length === 0 ? (
          <div className="text-center text-foreground/60 py-8">
            <p>暂无历史数据</p>
            <p className="text-xs mt-1">系统将在生成决策后记录历史</p>
          </div>
        ) : (
          <>
            {/* 统计摘要 */}
            {stats && (
              <div className="grid grid-cols-3 gap-3">
                <div className="p-2 rounded bg-content2/50 text-center">
                  <div className="text-xs text-foreground/60">平均杠杆</div>
                  <div className="text-lg font-bold">{stats.avgLeverage.toFixed(2)}x</div>
                </div>
                <div className="p-2 rounded bg-content2/50 text-center">
                  <div className="text-xs text-foreground/60">平均止损</div>
                  <div className="text-lg font-bold">{(stats.avgStopLoss * 100).toFixed(0)}%</div>
                </div>
                <div className="p-2 rounded bg-content2/50 text-center">
                  <div className="text-xs text-foreground/60">主要风险</div>
                  <div className="text-lg font-bold" style={{ color: getRiskLevelColor(stats.mostCommonRisk) }}>
                    {stats.mostCommonRisk === 'low' ? '低' : stats.mostCommonRisk === 'medium' ? '中' : stats.mostCommonRisk === 'high' ? '高' : '极高'}
                  </div>
                </div>
              </div>
            )}

            {showRiskLevel && <RiskLevelTimeline data={dataPoints} />}
            {showLeverage && <SimpleLineChart data={dataPoints} dataKey="leverage" color="#3b82f6" label="杠杆限制" formatValue={(v) => `${v.toFixed(2)}x`} />}
            {showStopLoss && <SimpleLineChart data={dataPoints} dataKey="stopLoss" color="#f97316" label="止损线" formatValue={(v) => `${(v * 100).toFixed(0)}%`} />}
          </>
        )}

        <div className="text-xs text-foreground/50 pt-3 border-t border-divider text-center">
          共 {dataPoints.length} 条决策记录
        </div>
      </CardBody>
    </Card>
  );
}

export default RiskHistoryChart;
