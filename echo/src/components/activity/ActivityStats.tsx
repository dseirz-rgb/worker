/**
 * 活动统计卡片
 */

import { Card, CardContent } from '../ui/card';
import { Clock, TrendingUp, Zap, Target } from 'lucide-react';

interface ActivityStatsProps {
  totalTime: number;
  productiveTime: number;
  focusSessions: number;
  topDomain: string;
}

export function ActivityStats({
  totalTime,
  productiveTime,
  focusSessions,
  topDomain,
}: ActivityStatsProps) {
  // 格式化时间
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // 计算生产力百分比
  const productivityRate =
    totalTime > 0 ? Math.round((productiveTime / totalTime) * 100) : 0;

  const stats = [
    {
      label: '总活动时间',
      value: formatTime(totalTime),
      icon: Clock,
      color: 'text-blue-500',
    },
    {
      label: '生产力',
      value: `${productivityRate}%`,
      icon: TrendingUp,
      color: 'text-green-500',
    },
    {
      label: '专注次数',
      value: `${focusSessions}`,
      icon: Zap,
      color: 'text-yellow-500',
    },
    {
      label: '主要领域',
      value: topDomain || '-',
      icon: Target,
      color: 'text-purple-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-lg font-semibold mt-1">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
