/**
 * 健康数据页面
 */

import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  getTodayHealthData,
  getSleepData,
  analyzeStress,
  type HealthData,
  type SleepData,
  type StressIndicator,
} from '../services/health';
import {
  RefreshCw,
  Footprints,
  Heart,
  Moon,
  Flame,
  Timer,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

export default function HealthPage() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [sleepData, setSleepData] = useState<SleepData | null>(null);
  const [stress, setStress] = useState<StressIndicator | null>(null);
  const [loading, setLoading] = useState(false);

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const [healthResult, sleepResult, stressResult] = await Promise.all([
        getTodayHealthData(),
        getSleepData(),
        analyzeStress(),
      ]);

      if (healthResult.success && healthResult.data) {
        setHealthData(healthResult.data);
      }
      if (sleepResult.success && sleepResult.data) {
        setSleepData(sleepResult.data);
      }
      if (stressResult.success && stressResult.data) {
        setStress(stressResult.data);
      }
    } catch (error) {
      console.error('加载健康数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 压力等级颜色
  const stressColor = {
    low: 'text-green-500',
    medium: 'text-yellow-500',
    high: 'text-red-500',
  };

  // 睡眠质量颜色
  const sleepQualityColor = {
    good: 'text-green-500',
    fair: 'text-yellow-500',
    poor: 'text-red-500',
  };

  return (
    <div className="p-4 space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">健康</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* 加载中 */}
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 活动数据 */}
      {!loading && healthData && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Footprints className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">步数</span>
              </div>
              <p className="text-lg font-semibold mt-1">
                {healthData.steps.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                <span className="text-xs text-muted-foreground">心率</span>
              </div>
              <p className="text-lg font-semibold mt-1">
                {healthData.heartRate || '-'} <span className="text-xs">bpm</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">消耗</span>
              </div>
              <p className="text-lg font-semibold mt-1">
                {healthData.activeCalories} <span className="text-xs">卡</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">运动</span>
              </div>
              <p className="text-lg font-semibold mt-1">
                {healthData.exerciseMinutes} <span className="text-xs">分钟</span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 睡眠数据 */}
      {!loading && sleepData && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Moon className="h-4 w-4 text-purple-500" />
              睡眠
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {sleepData.totalHours.toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    小时
                  </span>
                </p>
                {sleepData.bedTime && sleepData.wakeTime && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {sleepData.bedTime} - {sleepData.wakeTime}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">睡眠质量</p>
                <p className={`font-medium ${sleepQualityColor[sleepData.quality]}`}>
                  {sleepData.quality === 'good'
                    ? '良好'
                    : sleepData.quality === 'fair'
                    ? '一般'
                    : '较差'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 压力状态 */}
      {!loading && stress && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              压力状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-lg font-semibold ${stressColor[stress.level]}`}>
              {stress.level === 'low'
                ? '低压力'
                : stress.level === 'medium'
                ? '中等压力'
                : '高压力'}
            </p>
            {stress.suggestions.length > 0 && (
              <div className="mt-2 space-y-1">
                {stress.suggestions.map((suggestion, index) => (
                  <p key={index} className="text-xs text-muted-foreground">
                    • {suggestion}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 提示 */}
      <p className="text-xs text-muted-foreground text-center">
        健康数据需要在 iOS 设备上授权 HealthKit 访问
      </p>
    </div>
  );
}
