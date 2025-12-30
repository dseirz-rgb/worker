/**
 * 活动监控页面
 */

import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { ActivityStats } from '../components/activity/ActivityStats';
import { ActivityChart } from '../components/activity/ActivityChart';
import { AppUsageList } from '../components/activity/AppUsageList';
import {
  startActivityMonitoring,
  stopActivityMonitoring,
  getTodayActivityStats,
  isActivityMonitoringActive,
} from '../services/activity';
import { Play, Pause, RefreshCw } from 'lucide-react';
import type { LifeDomain } from '../types/database';

export default function ActivityPage() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    totalTime: number;
    byDomain: Record<LifeDomain, number>;
    byApp: { app: string; duration: number }[];
  } | null>(null);

  // 加载统计数据
  const loadStats = async () => {
    setLoading(true);
    try {
      const result = await getTodayActivityStats();
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('加载活动统计失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始化
  useEffect(() => {
    setIsMonitoring(isActivityMonitoringActive());
    loadStats();
  }, []);

  // 切换监控状态
  const toggleMonitoring = async () => {
    if (isMonitoring) {
      await stopActivityMonitoring();
      setIsMonitoring(false);
    } else {
      await startActivityMonitoring();
      setIsMonitoring(true);
    }
  };

  // 计算生产力时间（工作 + 学习）
  const productiveTime = stats
    ? (stats.byDomain.work || 0) + (stats.byDomain.learning || 0)
    : 0;

  // 找出主要领域
  const topDomain = stats
    ? Object.entries(stats.byDomain).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    : '';

  // 领域名称映射
  const domainNames: Record<string, string> = {
    work: '工作',
    investment: '投资',
    development: '开发',
    learning: '学习',
    family: '家庭',
    health: '健康',
    entertainment: '娱乐',
    general: '通用',
  };

  return (
    <div className="p-4 space-y-4">
      {/* 标题和控制 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">活动监控</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadStats}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant={isMonitoring ? 'destructive' : 'default'}
            size="sm"
            onClick={toggleMonitoring}
          >
            {isMonitoring ? (
              <>
                <Pause className="h-4 w-4 mr-1" />
                停止
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                开始
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <ActivityStats
        totalTime={stats?.totalTime || 0}
        productiveTime={productiveTime}
        focusSessions={0}
        topDomain={domainNames[topDomain] || '-'}
      />

      {/* 时间分布图表 */}
      <ActivityChart
        data={
          stats?.byDomain || {
            work: 0,
            investment: 0,
            development: 0,
            learning: 0,
            family: 0,
            health: 0,
            entertainment: 0,
            general: 0,
          }
        }
        totalTime={stats?.totalTime || 0}
      />

      {/* 应用使用列表 */}
      <AppUsageList apps={stats?.byApp || []} />
    </div>
  );
}
