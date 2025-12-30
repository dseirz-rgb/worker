/**
 * 应用使用时长列表
 */

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Monitor } from 'lucide-react';

interface AppUsage {
  app: string;
  duration: number;
}

interface AppUsageListProps {
  apps: AppUsage[];
}

export function AppUsageList({ apps }: AppUsageListProps) {
  // 格式化时间
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // 取前 10 个应用
  const topApps = apps.slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Monitor className="h-4 w-4" />
          应用使用时长
        </CardTitle>
      </CardHeader>
      <CardContent>
        {topApps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            暂无应用数据
          </p>
        ) : (
          <div className="space-y-2">
            {topApps.map((item, index) => (
              <div
                key={item.app}
                className="flex items-center justify-between py-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">
                    {index + 1}
                  </span>
                  <span className="text-sm truncate max-w-[180px]">
                    {item.app}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatTime(item.duration)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
