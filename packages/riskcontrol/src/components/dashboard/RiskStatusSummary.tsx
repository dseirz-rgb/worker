/**
 * 风控状态摘要组件 - Dashboard 集成
 * Task 11.1: 显示关键风控指标和快捷入口
 */

import React from 'react';
import { useLocation } from 'wouter';
import { 
  Shield, 
  Activity, 
  TrendingDown, 
  AlertTriangle,
  ChevronRight,
  Flame,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  type RiskMetrics, 
  type OverallRiskStatus,
  DEFAULT_THRESHOLDS 
} from '@/services/riskMetricsService';
import { getBreakerSummary } from '@/services/circuitBreakerService';

interface RiskStatusSummaryProps {
  metrics: RiskMetrics | null;
  loading?: boolean;
  compact?: boolean;
}

// 风险状态颜色映射
const statusColors: Record<OverallRiskStatus, { bg: string; text: string; glow: string }> = {
  safe: { 
    bg: 'bg-emerald-500/20', 
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/20'
  },
  caution: { 
    bg: 'bg-amber-500/20', 
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20'
  },
  danger: { 
    bg: 'bg-red-500/20', 
    text: 'text-red-400',
    glow: 'shadow-red-500/20'
  },
};

// 风险状态标签
const statusLabels: Record<OverallRiskStatus, string> = {
  safe: '安全',
  caution: '注意',
  danger: '危险',
};

export function RiskStatusSummary({ metrics, loading, compact }: RiskStatusSummaryProps) {
  const [, setLocation] = useLocation();
  
  if (loading) {
    return (
      <div className="rounded-2xl p-6 bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/[0.06] animate-pulse">
        <div className="h-8 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-12 bg-white/10 rounded w-1/2" />
      </div>
    );
  }
  
  if (!metrics) {
    return null;
  }
  
  const status = metrics.overallStatus;
  const colors = statusColors[status];
  const breakerSummary = getBreakerSummary(metrics, DEFAULT_THRESHOLDS);
  
  // 紧凑模式 - 用于小卡片
  if (compact) {
    return (
      <button
        onClick={() => setLocation('/risk-center')}
        className={cn(
          "group relative overflow-hidden rounded-xl p-4 text-left w-full",
          "bg-gradient-to-br from-white/[0.03] to-white/[0.01]",
          "border border-white/[0.06] hover:border-white/[0.12]",
          "transition-all duration-300 hover:-translate-y-0.5",
          status === 'danger' && "border-red-500/30 hover:border-red-500/50"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", colors.bg)}>
              <Shield size={20} className={colors.text} />
            </div>
            <div>
              <div className="text-sm text-white/50">风控状态</div>
              <div className={cn("text-lg font-bold", colors.text)}>
                {statusLabels[status]}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-2xl font-bold tabular-nums",
              colors.text
            )}>
              {metrics.overallRiskScore.toFixed(0)}
            </span>
            <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
          </div>
        </div>
      </button>
    );
  }
  
  // 完整模式
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-6",
      "bg-gradient-to-br from-white/[0.03] to-white/[0.01]",
      "border border-white/[0.06]",
      status === 'danger' && "border-red-500/30"
    )}>
      {/* 背景光效 */}
      <div className={cn(
        "absolute top-0 right-0 w-40 h-40 rounded-full blur-[60px] opacity-30",
        status === 'safe' && "bg-emerald-500",
        status === 'caution' && "bg-amber-500",
        status === 'danger' && "bg-red-500 animate-pulse"
      )} />
      
      <div className="relative">
        {/* 标题行 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colors.bg)}>
              <Shield size={20} className={colors.text} />
            </div>
            <div>
              <h3 className="text-sm text-white/50 uppercase tracking-wider">风控状态</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn("text-lg font-bold", colors.text)}>
                  {statusLabels[status]}
                </span>
                {breakerSummary.criticalCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400 ring-1 ring-red-500/30 animate-pulse">
                    {breakerSummary.criticalCount} 熔断
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* 综合评分 */}
          <div className="text-right">
            <div className="text-xs text-white/40 mb-1">风险评分</div>
            <div className={cn("text-3xl font-bold tabular-nums", colors.text)}>
              {metrics.overallRiskScore.toFixed(0)}
              <span className="text-sm font-normal text-white/30">/100</span>
            </div>
          </div>
        </div>
        
        {/* 关键指标 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* 杠杆率 */}
          <div className="p-3 rounded-xl bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={14} className={cn(
                metrics.leverageStatus === 'critical' ? 'text-red-400' :
                metrics.leverageStatus === 'warning' ? 'text-amber-400' : 'text-cyan-400'
              )} />
              <span className="text-xs text-white/40">杠杆率</span>
            </div>
            <div className={cn(
              "text-xl font-bold tabular-nums",
              metrics.leverageStatus === 'critical' ? 'text-red-400' :
              metrics.leverageStatus === 'warning' ? 'text-amber-400' : 'text-white'
            )}>
              {metrics.currentLeverage.toFixed(2)}x
            </div>
            <div className="text-[10px] text-white/30 mt-1">
              限制 {metrics.leverageLimit.toFixed(1)}x
            </div>
          </div>
          
          {/* 月度回撤 */}
          <div className="p-3 rounded-xl bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={14} className={cn(
                metrics.monthlyDrawdownStatus === 'critical' ? 'text-red-400' :
                metrics.monthlyDrawdownStatus === 'warning' ? 'text-amber-400' : 'text-cyan-400'
              )} />
              <span className="text-xs text-white/40">月度回撤</span>
            </div>
            <div className={cn(
              "text-xl font-bold tabular-nums",
              metrics.monthlyDrawdownStatus === 'critical' ? 'text-red-400' :
              metrics.monthlyDrawdownStatus === 'warning' ? 'text-amber-400' : 'text-white'
            )}>
              {metrics.monthlyDrawdown.toFixed(1)}%
            </div>
            <div className="text-[10px] text-white/30 mt-1">
              距止损 {metrics.distanceToMonthlyStopLoss.toFixed(1)}%
            </div>
          </div>
          
          {/* 连败天数 */}
          <div className="p-3 rounded-xl bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-2">
              <Flame size={14} className={cn(
                metrics.losingStreakStatus === 'critical' ? 'text-red-400' :
                metrics.losingStreakStatus === 'warning' ? 'text-amber-400' : 'text-cyan-400'
              )} />
              <span className="text-xs text-white/40">连败</span>
            </div>
            <div className={cn(
              "text-xl font-bold tabular-nums",
              metrics.losingStreakStatus === 'critical' ? 'text-red-400' :
              metrics.losingStreakStatus === 'warning' ? 'text-amber-400' : 'text-white'
            )}>
              {metrics.currentLosingStreak}天
            </div>
            <div className="text-[10px] text-white/30 mt-1">
              历史最大 {metrics.maxHistoricalLosingStreak}天
            </div>
          </div>
        </div>
        
        {/* 警告信息 */}
        {breakerSummary.activeBreakers.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-red-400" />
              <span className="text-xs font-medium text-red-400">
                {breakerSummary.activeBreakers.length} 个风控规则触发
              </span>
            </div>
            <div className="space-y-1">
              {breakerSummary.activeBreakers.slice(0, 2).map(({ type, result }) => (
                <div key={type} className="text-xs text-white/60 truncate">
                  • {result.reason}
                </div>
              ))}
              {breakerSummary.activeBreakers.length > 2 && (
                <div className="text-xs text-white/40">
                  还有 {breakerSummary.activeBreakers.length - 2} 个...
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* 快捷入口 */}
        <button
          onClick={() => setLocation('/risk-center')}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 rounded-xl",
            "bg-white/[0.03] hover:bg-white/[0.06]",
            "border border-white/[0.06] hover:border-white/[0.12]",
            "text-sm text-white/70 hover:text-white",
            "transition-all duration-200"
          )}
        >
          <Shield size={16} />
          <span>进入风控中心</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default RiskStatusSummary;
