/**
 * Echo v3.2: 建议列表组件
 * 显示待处理的建议列表，支持批量操作
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Spinner,
  Divider,
  Progress,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { api } from '@/lib/trpc';
import { RootStore } from '@/store';
import { ToastPlugin } from '@/store/module/Toast/Toast';
import { SuggestionResponseCard, Suggestion } from './SuggestionResponseCard';

// ============================================
// 类型定义
// ============================================

interface SuggestionStats {
  total: number;
  accepted: number;
  rejected: number;
  postponed: number;
  pending: number;
  acceptRate: number;
  rejectRate: number;
}

// ============================================
// 组件
// ============================================

export function SuggestionList() {
  const toast = RootStore.Get(ToastPlugin);
  
  // 状态
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [stats, setStats] = useState<SuggestionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [respondingId, setRespondingId] = useState<number | null>(null);

  // 加载建议列表
  const loadSuggestions = useCallback(async () => {
    try {
      const data = await api.suggestion.getPending.query({ limit: 10 });
      setSuggestions(data as Suggestion[]);
    } catch (error) {
      console.error('加载建议失败:', error);
    }
  }, []);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const data = await api.suggestion.getStats.query();
      setStats(data);
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([loadSuggestions(), loadStats()]);
      setIsLoading(false);
    };
    init();
  }, [loadSuggestions, loadStats]);

  // 生成建议
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await api.suggestion.generate.mutate();
      toast.success(`生成了 ${result.count} 条新建议`);
      await loadSuggestions();
      await loadStats();
    } catch (error) {
      toast.error('生成建议失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 响应建议
  const handleRespond = async (
    suggestionId: number,
    action: 'accept' | 'postpone' | 'reject',
    options?: { reason?: string; postponeDuration?: number }
  ) => {
    setRespondingId(suggestionId);
    try {
      await api.suggestion.respond.mutate({
        suggestionId,
        action,
        ...options,
      });
      const actionText = {
        accept: '已接受',
        postpone: '已推迟',
        reject: '已忽略',
      }[action];
      toast.success(actionText);
      await loadSuggestions();
      await loadStats();
    } catch (error) {
      toast.error('操作失败');
    } finally {
      setRespondingId(null);
    }
  };

  // 计算接受率百分比
  const acceptRatePercent = stats ? Math.round(stats.acceptRate * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      {stats && (
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">建议接受率</span>
              <span className="text-sm text-foreground/60">
                {stats.accepted}/{stats.accepted + stats.rejected} 已接受
              </span>
            </div>
            <Progress
              value={acceptRatePercent}
              color={acceptRatePercent >= 70 ? 'success' : acceptRatePercent >= 40 ? 'warning' : 'danger'}
              className="mb-2"
            />
            <div className="flex justify-between text-xs text-foreground/50">
              <span>待处理: {stats.pending}</span>
              <span>已推迟: {stats.postponed}</span>
              <span>已忽略: {stats.rejected}</span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 建议列表卡片 */}
      <Card>
        <CardHeader className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <Icon icon="mdi:lightbulb-on-outline" className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">智能建议</h3>
              <p className="text-xs text-foreground/50">基于你的活动生成的个性化建议</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="flat"
            onPress={handleGenerate}
            isLoading={isGenerating}
            startContent={!isGenerating && <Icon icon="mdi:refresh" className="w-4 h-4" />}
          >
            刷新建议
          </Button>
        </CardHeader>

        <Divider />

        <CardBody className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <SuggestionResponseCard
                key={suggestion.id}
                suggestion={suggestion}
                onRespond={(action, options) =>
                  handleRespond(suggestion.id, action, options)
                }
                isLoading={respondingId === suggestion.id}
              />
            ))
          ) : (
            <div className="text-center py-8 text-foreground/50">
              <Icon icon="mdi:check-circle-outline" className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无待处理的建议</p>
              <p className="text-xs mt-1">点击"刷新建议"生成新的建议</p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default SuggestionList;
