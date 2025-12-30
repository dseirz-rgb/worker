/**
 * 活动时间分布图表
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { LifeDomain } from '../../types/database';

// 领域颜色映射
const DOMAIN_COLORS: Record<LifeDomain, string> = {
  work: '#3b82f6',
  investment: '#10b981',
  development: '#06b6d4',
  learning: '#8b5cf6',
  family: '#f59e0b',
  health: '#ef4444',
  entertainment: '#ec4899',
  general: '#6b7280',
};

// 领域名称映射
const DOMAIN_NAMES: Record<LifeDomain, string> = {
  work: '工作',
  investment: '投资',
  development: '开发',
  learning: '学习',
  family: '家庭',
  health: '健康',
  entertainment: '娱乐',
  general: '通用',
};

interface ActivityChartProps {
  data: Record<LifeDomain, number>;
  totalTime: number;
}

export function ActivityChart({ data, totalTime }: ActivityChartProps) {
  // 计算百分比
  const chartData = useMemo(() => {
    return Object.entries(data)
      .filter(([, value]) => value > 0)
      .map(([domain, value]) => ({
        domain: domain as LifeDomain,
        value,
        percentage: totalTime > 0 ? (value / totalTime) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [data, totalTime]);

  // 格式化时间
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">时间分布</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            暂无活动数据
          </p>
        ) : (
          <div className="space-y-3">
            {chartData.map(({ domain, value, percentage }) => (
              <div key={domain} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{DOMAIN_NAMES[domain]}</span>
                  <span className="text-muted-foreground">
                    {formatTime(value)} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: DOMAIN_COLORS[domain],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
