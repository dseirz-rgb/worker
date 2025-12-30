/**
 * 周报卡片组件
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Target, TrendingUp, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeeklyReport } from "@/services/report";

// 领域标签
const DOMAIN_LABELS: Record<string, string> = {
  work: "工作",
  investment: "投资",
  development: "开发",
  learning: "学习",
  family: "家庭",
  health: "健康",
  entertainment: "娱乐",
  general: "通用",
};

interface WeeklyReportCardProps {
  report: WeeklyReport;
  onExport?: () => void;
  className?: string;
}

export function WeeklyReportCard({ report, onExport, className }: WeeklyReportCardProps) {
  const completionPercent = Math.round(report.taskStats.completionRate * 100);

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {formatDateRange(report.startDate, report.endDate)}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">周报</Badge>
            {onExport && (
              <Button size="sm" variant="ghost" onClick={onExport}>
                <Copy className="h-4 w-4 mr-1" />
                导出
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 总结 */}
        <div>
          <p className="text-muted-foreground">{report.summary}</p>
        </div>

        {/* 任务统计 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">任务完成</span>
            </div>
            <div className="text-3xl font-bold">
              {report.taskStats.completed}/{report.taskStats.total}
            </div>
            <div className="text-sm text-muted-foreground">
              完成率 {completionPercent}%
            </div>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">领域分布</span>
            </div>
            <div className="space-y-1">
              {report.domainBreakdown.slice(0, 3).map((d) => (
                <div key={d.domain} className="flex justify-between text-sm">
                  <span>{DOMAIN_LABELS[d.domain]}</span>
                  <span className="text-muted-foreground">
                    {Math.round(d.percentage * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 成就 */}
        {report.achievements.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <Trophy className="h-4 w-4 text-yellow-500" />
              本周成就
            </h4>
            <div className="space-y-2">
              {report.achievements.map((achievement, i) => (
                <div key={i} className="p-3 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg">
                  <div className="font-medium text-sm">{achievement.title}</div>
                  <div className="text-xs text-muted-foreground">{achievement.description}</div>
                  {achievement.metric && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {achievement.metric}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 洞察 */}
        {report.insights.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">洞察</h4>
            <ul className="space-y-1">
              {report.insights.map((insight, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 下周目标 */}
        {report.nextWeekGoals.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">下周目标</h4>
            <ul className="space-y-1">
              {report.nextWeekGoals.map((goal, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-green-500">→</span>
                  {goal}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startMonth = startDate.getMonth() + 1;
  const endMonth = endDate.getMonth() + 1;

  if (startMonth === endMonth) {
    return `${startMonth}月${startDate.getDate()}日 - ${endDate.getDate()}日`;
  }
  return `${startMonth}月${startDate.getDate()}日 - ${endMonth}月${endDate.getDate()}日`;
}
