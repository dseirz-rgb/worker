/**
 * 日报卡片组件
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Lightbulb, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyReport, Suggestion } from "@/services/report";

interface DailyReportCardProps {
  report: DailyReport;
  onAcceptSuggestion?: (suggestion: Suggestion) => void;
  onDismissSuggestion?: (suggestion: Suggestion) => void;
  className?: string;
}

export function DailyReportCard({
  report,
  onAcceptSuggestion,
  onDismissSuggestion,
  className,
}: DailyReportCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {new Date(report.date).toLocaleDateString("zh-CN", {
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </CardTitle>
          <Badge variant="outline">日报</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 总结 */}
        <div>
          <p className="text-muted-foreground">{report.summary}</p>
        </div>

        {/* 统计 */}
        <div className="grid grid-cols-3 gap-4">
          <StatItem
            icon={<CheckCircle className="h-4 w-4 text-green-500" />}
            label="完成任务"
            value={report.stats.tasksCompleted}
          />
          <StatItem
            icon={<Clock className="h-4 w-4 text-blue-500" />}
            label="新建任务"
            value={report.stats.tasksCreated}
          />
          <StatItem
            icon={<TrendingUp className="h-4 w-4 text-purple-500" />}
            label="记录笔记"
            value={report.stats.notesCreated}
          />
        </div>

        {/* 亮点 */}
        {report.highlights.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">今日亮点</h4>
            <ul className="space-y-1">
              {report.highlights.map((highlight, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {highlight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 建议 */}
        {report.suggestions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              AI 建议
            </h4>
            <div className="space-y-2">
              {report.suggestions.map((suggestion) => (
                <SuggestionItem
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAccept={() => onAcceptSuggestion?.(suggestion)}
                  onDismiss={() => onDismissSuggestion?.(suggestion)}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="text-center p-3 bg-muted/50 rounded-lg">
      <div className="flex justify-center mb-1">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function SuggestionItem({
  suggestion,
  onAccept,
  onDismiss,
}: {
  suggestion: Suggestion;
  onAccept?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
      <p className="text-sm flex-1">{suggestion.content}</p>
      <div className="flex gap-1 ml-2">
        {onAccept && (
          <Button size="sm" variant="ghost" onClick={onAccept}>
            采纳
          </Button>
        )}
        {onDismiss && (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            忽略
          </Button>
        )}
      </div>
    </div>
  );
}
