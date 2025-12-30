/**
 * 研究结果组件
 * 显示 Khoj 自动化研究任务的结果，支持保存为笔记
 */

import * as React from 'react';
import {
  FileText,
  Save,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { AutomationResult, AutomationConfig } from '../../services/khoj/automation';

interface ResearchResultProps {
  /** 自动化任务配置 */
  automation: AutomationConfig;
  /** 研究结果 */
  result: AutomationResult;
  /** 保存为笔记回调 */
  onSaveAsNote?: (content: string, title: string) => Promise<void>;
}

export function ResearchResult({ automation, result, onSaveAsNote }: ResearchResultProps) {
  const [isCopied, setIsCopied] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  // 复制内容
  const handleCopy = async () => {
    if (!result.content) return;

    try {
      await navigator.clipboard.writeText(result.content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  // 保存为笔记
  const handleSaveAsNote = async () => {
    if (!result.content || !onSaveAsNote) return;

    setIsSaving(true);
    try {
      await onSaveAsNote(result.content, automation.name);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // 格式化时间
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '未知';
    return new Date(dateStr).toLocaleString();
  };

  // 状态颜色
  const getStatusColor = () => {
    switch (result.status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'running':
        return 'text-blue-600';
      case 'cancelled':
        return 'text-yellow-600';
      default:
        return 'text-muted-foreground';
    }
  };

  // 状态文本
  const getStatusText = () => {
    switch (result.status) {
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      case 'running':
        return '运行中';
      case 'cancelled':
        return '已取消';
      case 'pending':
        return '等待中';
      default:
        return '未知';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {automation.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${getStatusColor()}`}>
              {getStatusText()}
            </span>
            {result.completedAt && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(result.completedAt)}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 错误信息 */}
        {result.error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{result.error}</p>
          </div>
        )}

        {/* 结果内容 */}
        {result.content && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">研究结果</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={handleCopy}
                >
                  {isCopied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      复制
                    </>
                  )}
                </Button>
                {onSaveAsNote && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={handleSaveAsNote}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : saveSuccess ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        已保存
                      </>
                    ) : (
                      <>
                        <Save className="h-3 w-3 mr-1" />
                        保存为笔记
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{result.content}</p>
            </div>
          </div>
        )}

        {/* 来源引用 */}
        {result.sources && result.sources.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">参考来源</span>
            <div className="space-y-2">
              {result.sources.map((source, index) => (
                <div
                  key={index}
                  className="p-2 border rounded-lg text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs">{source.title}</span>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {source.snippet}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 运行中状态 */}
        {result.status === 'running' && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">正在研究中...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 研究结果列表
 */
interface ResearchResultListProps {
  /** 结果列表 */
  results: Array<{
    automation: AutomationConfig;
    result: AutomationResult;
  }>;
  /** 保存为笔记回调 */
  onSaveAsNote?: (content: string, title: string) => Promise<void>;
}

export function ResearchResultList({ results, onSaveAsNote }: ResearchResultListProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">暂无研究结果</p>
        <p className="text-xs mt-1">运行自动化任务后将显示结果</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.map(({ automation, result }) => (
        <ResearchResult
          key={result.taskId}
          automation={automation}
          result={result}
          onSaveAsNote={onSaveAsNote}
        />
      ))}
    </div>
  );
}

export default ResearchResult;
