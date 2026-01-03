/**
 * 风控中心页面 - Risk Center (2026)
 * 集中展示所有风控指标、熔断状态和风控日志
 * 
 * Design: High-end fintech dashboard with dark theme
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  Shield,
  AlertTriangle,
  TrendingDown,
  Activity,
  Settings,
  History,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSupabasePortfolio } from '@/hooks/useSupabasePortfolio';
import {
  calculateRiskMetrics,
  type RiskMetrics,
  type DailyPnL,
} from '@/services/riskMetricsService';
import {
  getBreakerSummary,
  type BreakerType,
} from '@/services/circuitBreakerService';
import {
  getRiskThresholds,
  getRiskLogs,
  getActiveCircuitBreakers,
  logRiskAlert,
  type RiskThresholds,
  type RiskLog,
  type CircuitBreakerEvent,
} from '@/services/riskDataService';
import { UnifiedAIAnalysisPanel } from '@/components/agents';

// ============ 风控状态卡片组件 ============

interface RiskStatusCardProps {
  title: string;
  value: string | number;
  status: 'normal' | 'warning' | 'critical' | 'safe' | 'caution' | 'danger';
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
}

function RiskStatusCard({ title, value, status, subtitle, icon }: RiskStatusCardProps) {
  const statusConfig = {
    normal: { border: 'border-emerald-500/30', bg: 'from-emerald-500/10 to-emerald-500/5', text: 'text-emerald-400', glow: 'bg-emerald-500/20' },
    safe: { border: 'border-emerald-500/30', bg: 'from-emerald-500/10 to-emerald-500/5', text: 'text-emerald-400', glow: 'bg-emerald-500/20' },
    warning: { border: 'border-amber-500/30', bg: 'from-amber-500/10 to-amber-500/5', text: 'text-amber-400', glow: 'bg-amber-500/20' },
    caution: { border: 'border-amber-500/30', bg: 'from-amber-500/10 to-amber-500/5', text: 'text-amber-400', glow: 'bg-amber-500/20' },
    critical: { border: 'border-red-500/30', bg: 'from-red-500/10 to-red-500/5', text: 'text-red-400', glow: 'bg-red-500/20' },
    danger: { border: 'border-red-500/30', bg: 'from-red-500/10 to-red-500/5', text: 'text-red-400', glow: 'bg-red-500/20' },
  };

  const config = statusConfig[status];

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-5 transition-all duration-300",
      "bg-gradient-to-br from-white/[0.04] to-white/[0.01]",
      "border hover:border-white/[0.12]",
      config.border
    )}>
      {/* 背景光效 */}
      <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-full blur-[40px] opacity-50", config.glow)} />
      
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-white/50">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", config.glow)}>
              {icon}
            </div>
            <span className="text-sm font-medium">{title}</span>
          </div>
          <span className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-medium ring-1",
            status === 'normal' || status === 'safe' 
              ? 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/30' 
              : status === 'warning' || status === 'caution'
              ? 'bg-amber-500/20 text-amber-400 ring-amber-500/30'
              : 'bg-red-500/20 text-red-400 ring-red-500/30'
          )}>
            {status === 'normal' || status === 'safe' ? '正常' : 
             status === 'warning' || status === 'caution' ? '警告' : '危险'}
          </span>
        </div>
        <div className={cn("text-3xl font-bold mt-3 tabular-nums", config.text)}>
          {value}
        </div>
        {subtitle && (
          <div className="text-xs text-white/40 mt-2">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

// ============ 熔断状态面板 ============

interface BreakerPanelProps {
  breakers: Array<{ type: BreakerType; result: { triggered: boolean; severity: string; reason: string; recommendation: string } }>;
}

function BreakerPanel({ breakers }: BreakerPanelProps) {
  const activeBreakers = breakers.filter(b => b.result.triggered);
  
  if (activeBreakers.length === 0) {
    return (
      <div className={cn(
        "relative overflow-hidden rounded-2xl p-5",
        "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5",
        "border border-emerald-500/30"
      )}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/20 rounded-full blur-[40px]" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle className="text-emerald-400" size={20} />
          </div>
          <div>
            <span className="text-emerald-400 font-semibold">所有熔断器正常</span>
            <p className="text-sm text-white/50 mt-0.5">
              当前没有触发任何风控熔断，交易正常进行
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeBreakers.map((breaker, index) => (
        <div 
          key={index} 
          className={cn(
            "relative overflow-hidden rounded-2xl p-5 transition-all duration-300",
            "bg-gradient-to-br from-white/[0.04] to-white/[0.01]",
            breaker.result.severity === 'critical' 
              ? 'border border-red-500/30' 
              : 'border border-amber-500/30'
          )}
        >
          {/* 背景光效 */}
          <div className={cn(
            "absolute top-0 right-0 w-24 h-24 rounded-full blur-[40px]",
            breaker.result.severity === 'critical' ? 'bg-red-500/20' : 'bg-amber-500/20'
          )} />
          
          <div className="relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  breaker.result.severity === 'critical' ? 'bg-red-500/20' : 'bg-amber-500/20'
                )}>
                  <XCircle 
                    className={breaker.result.severity === 'critical' ? 'text-red-400' : 'text-amber-400'} 
                    size={20} 
                  />
                </div>
                <span className={cn(
                  "font-semibold",
                  breaker.result.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                )}>
                  {getBreakerTypeName(breaker.type)}
                </span>
              </div>
              <span className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-medium ring-1",
                breaker.result.severity === 'critical' 
                  ? 'bg-red-500/20 text-red-400 ring-red-500/30' 
                  : 'bg-amber-500/20 text-amber-400 ring-amber-500/30'
              )}>
                {breaker.result.severity === 'critical' ? '危险' : '警告'}
              </span>
            </div>
            <p className="text-sm text-white/60 mt-3">{breaker.result.reason}</p>
            <p className="text-sm text-cyan-400 mt-2 flex items-center gap-1.5">
              <Sparkles size={14} />
              {breaker.result.recommendation}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function getBreakerTypeName(type: BreakerType): string {
  const names: Record<BreakerType, string> = {
    leverage: '杠杆熔断',
    drawdown: '回撤熔断',
    trailing_stop: '止盈熔断',
    losing_streak: '连败熔断',
  };
  return names[type] || type;
}

// ============ 风控日志列表 ============

interface RiskLogListProps {
  logs: RiskLog[];
  onAcknowledge?: (id: number) => void;
}

function RiskLogList({ logs, onAcknowledge }: RiskLogListProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-white/40">
        <History size={32} className="mx-auto mb-2 opacity-50" />
        <p>暂无风控日志</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
      {logs.map((log) => (
        <div 
          key={log.id} 
          className={cn(
            "p-3 rounded-xl transition-all duration-200",
            "bg-gradient-to-br from-white/[0.03] to-white/[0.01]",
            "border hover:border-white/[0.12]",
            log.severity === 'critical' 
              ? 'border-red-500/30 hover:bg-red-500/5' 
              : log.severity === 'warning'
              ? 'border-amber-500/30 hover:bg-amber-500/5'
              : 'border-cyan-500/30 hover:bg-cyan-500/5'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className={cn(
                "text-sm font-medium",
                log.severity === 'critical' ? 'text-red-400' : 
                log.severity === 'warning' ? 'text-amber-400' : 'text-cyan-400'
              )}>
                {log.title}
              </span>
              <p className="text-xs text-white/50 mt-1 line-clamp-2">{log.message}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-white/30">
                {new Date(log.created_at || '').toLocaleString('zh-CN', { 
                  month: 'numeric', 
                  day: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
              {!log.acknowledged && onAcknowledge && (
                <button
                  onClick={() => onAcknowledge(log.id!)}
                  className="text-[10px] px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                >
                  确认
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ 主页面组件 ============

export default function RiskCenter() {
  const [, setLocation] = useLocation();
  const { dashboard, history, loading } = useSupabasePortfolio();
  
  const [thresholds, setThresholds] = useState<RiskThresholds | null>(null);
  const [logs, setLogs] = useState<RiskLog[]>([]);
  const [activeBreakers, setActiveBreakers] = useState<CircuitBreakerEvent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 加载风控配置和日志
  useEffect(() => {
    loadRiskData();
  }, []);

  const loadRiskData = async () => {
    setIsRefreshing(true);
    try {
      const [thresholdsData, logsData, breakersData] = await Promise.all([
        getRiskThresholds(1),
        getRiskLogs(1, { limit: 50 }),
        getActiveCircuitBreakers(1),
      ]);
      
      setThresholds(thresholdsData);
      setLogs(logsData);
      setActiveBreakers(breakersData);
    } catch (error) {
      console.error('Failed to load risk data:', error);
      toast.error('加载风控数据失败');
    } finally {
      setIsRefreshing(false);
    }
  };

  // 计算风控指标
  const riskMetrics = useMemo<RiskMetrics | null>(() => {
    if (!dashboard || !thresholds) return null;

    const currentNAV = Number(dashboard.net_worth_cny) || 0;
    
    // 杠杆率计算：优先使用 leverage_ratio，如果为 1.0 则使用 long_ratio 计算
    let currentLeverage = Number(dashboard.leverage_ratio) || 1.0;
    if (currentLeverage <= 1.0 && dashboard.long_ratio && Number(dashboard.long_ratio) > 100) {
      // long_ratio 是百分比，如 194.55% 表示 1.9455x 杠杆
      currentLeverage = Number(dashboard.long_ratio) / 100;
    }
    
    // 获取月初净值（简化：使用当前月第一天的历史数据）
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthStartRecord = history?.find(h => h.date >= monthStart);
    const monthStartNAV = monthStartRecord ? Number(monthStartRecord.net_worth_cny) : currentNAV;
    
    // 获取高水位
    const hwm = history?.reduce((max, h) => {
      const nav = Number(h.net_worth_cny) || 0;
      return nav > max ? nav : max;
    }, 0) || currentNAV;

    // 构建每日盈亏历史（最近30天）
    const dailyPnLHistory: DailyPnL[] = (history || [])
      .slice(-30)
      .map((h, i, arr) => {
        const prevNav = i > 0 ? Number(arr[i - 1].net_worth_cny) : Number(h.net_worth_cny);
        const currNav = Number(h.net_worth_cny);
        const pnl = currNav - prevNav;
        const pnlPercent = prevNav > 0 ? (pnl / prevNav) * 100 : 0;
        return {
          date: h.date,
          pnl,
          pnlPercent,
        };
      });

    return calculateRiskMetrics(
      currentNAV,
      currentLeverage,
      monthStartNAV,
      hwm,
      dailyPnLHistory,
      {
        leverageWarning: thresholds.leverage_warning,
        leverageCritical: thresholds.leverage_critical,
        leverageInDrawdown: thresholds.leverage_in_drawdown,
        monthlyDrawdownWarning: thresholds.monthly_drawdown_warning,
        monthlyDrawdownCritical: thresholds.monthly_drawdown_critical,
        trailingStopPercent: thresholds.trailing_stop_percent,
        losingStreakWarning: thresholds.losing_streak_warning,
        losingStreakCritical: thresholds.losing_streak_critical,
      }
    );
  }, [dashboard, history, thresholds]);

  // 获取熔断摘要
  const breakerSummary = useMemo(() => {
    if (!riskMetrics || !thresholds) return null;
    
    return getBreakerSummary(riskMetrics, {
      leverageWarning: thresholds.leverage_warning,
      leverageCritical: thresholds.leverage_critical,
      leverageInDrawdown: thresholds.leverage_in_drawdown,
      monthlyDrawdownWarning: thresholds.monthly_drawdown_warning,
      monthlyDrawdownCritical: thresholds.monthly_drawdown_critical,
      trailingStopPercent: thresholds.trailing_stop_percent,
      losingStreakWarning: thresholds.losing_streak_warning,
      losingStreakCritical: thresholds.losing_streak_critical,
    });
  }, [riskMetrics, thresholds]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4 text-cyan-400" size={32} />
          <p className="text-white/50">加载风控中心...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-6 animate-in fade-in duration-500">
      {/* 背景装饰 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-20 left-1/4 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px]" />
      </div>

      {/* 页面标题 */}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation('/dashboard')}
            className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-white/60" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3 text-white">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Shield className="text-emerald-400" size={20} />
              </div>
              风控中心
            </h1>
            <p className="text-sm text-white/50 mt-1">2026 风控系统升级版</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadRiskData}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            刷新
          </button>
          <button
            onClick={() => setLocation('/risk-settings')}
            className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-white/70 rounded-xl transition-colors"
          >
            <Settings size={16} />
            设置
          </button>
        </div>
      </div>

      {/* 综合风险评分 */}
      {riskMetrics && (
        <div className={cn(
          "relative overflow-hidden rounded-2xl p-6 transition-all duration-300",
          "bg-gradient-to-br from-white/[0.04] to-white/[0.01]",
          riskMetrics.overallStatus === 'safe' ? 'border-2 border-emerald-500/30' :
          riskMetrics.overallStatus === 'caution' ? 'border-2 border-amber-500/30' :
          'border-2 border-red-500/30'
        )}>
          {/* 背景光效 */}
          <div className={cn(
            "absolute top-0 right-0 w-40 h-40 rounded-full blur-[60px]",
            riskMetrics.overallStatus === 'safe' ? 'bg-emerald-500/20' :
            riskMetrics.overallStatus === 'caution' ? 'bg-amber-500/20' :
            'bg-red-500/20'
          )} />
          
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-white/50">综合风险评分</h2>
              <div className={cn(
                "text-5xl font-bold mt-2 tabular-nums",
                riskMetrics.overallStatus === 'safe' ? 'text-emerald-400' :
                riskMetrics.overallStatus === 'caution' ? 'text-amber-400' :
                'text-red-400'
              )}>
                {riskMetrics.overallRiskScore.toFixed(0)}
                <span className="text-lg text-white/40 ml-2">/ 100</span>
              </div>
            </div>
            <div className={cn(
              "text-right",
              riskMetrics.overallStatus === 'safe' ? 'text-emerald-400' :
              riskMetrics.overallStatus === 'caution' ? 'text-amber-400' :
              'text-red-400'
            )}>
              <div className="text-2xl font-bold">
                {riskMetrics.overallStatus === 'safe' ? '安全' :
                 riskMetrics.overallStatus === 'caution' ? '谨慎' : '危险'}
              </div>
              <div className="text-sm text-white/50">
                {breakerSummary?.tradingAllowed ? '允许交易' : '建议停止交易'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 风控指标卡片 */}
      {riskMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <RiskStatusCard
            title="杠杆率"
            value={`${riskMetrics.currentLeverage.toFixed(2)}x`}
            status={riskMetrics.leverageStatus}
            subtitle={`限制: ${riskMetrics.leverageLimit.toFixed(1)}x`}
            icon={<Activity size={16} />}
          />
          <RiskStatusCard
            title="月度回撤"
            value={`${riskMetrics.monthlyDrawdown.toFixed(2)}%`}
            status={riskMetrics.monthlyDrawdownStatus}
            subtitle={`距止损: ${riskMetrics.distanceToMonthlyStopLoss.toFixed(1)}%`}
            icon={<TrendingDown size={16} />}
          />
          <RiskStatusCard
            title="距HWM回撤"
            value={`${riskMetrics.highWaterMark > 0 ? (((riskMetrics.highWaterMark - (riskMetrics.trailingStopLevel + riskMetrics.distanceToTrailingStop)) / riskMetrics.highWaterMark) * 100).toFixed(2) : '0.00'}%`}
            status={riskMetrics.trailingStopStatus === 'triggered' ? 'critical' : 
                   riskMetrics.trailingStopStatus === 'warning' ? 'warning' : 'normal'}
            subtitle={`HWM: ¥${riskMetrics.highWaterMark.toFixed(0)} | 止盈线: ¥${riskMetrics.trailingStopLevel.toFixed(0)}`}
            icon={<AlertTriangle size={16} />}
          />
          <RiskStatusCard
            title="连败天数"
            value={`${riskMetrics.currentLosingStreak} 天`}
            status={riskMetrics.losingStreakStatus}
            subtitle={`历史最大: ${riskMetrics.maxHistoricalLosingStreak} 天`}
            icon={<Clock size={16} />}
          />
        </div>
      )}

      {/* 熔断状态面板 */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-3 text-white">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Shield size={16} className="text-cyan-400" />
            </div>
            熔断器状态
          </h3>
          {breakerSummary && (
            <BreakerPanel breakers={breakerSummary.activeBreakers} />
          )}
        </div>

        {/* 风控日志 */}
        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-3 text-white">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <History size={16} className="text-purple-400" />
            </div>
            风控日志
          </h3>
          <div className={cn(
            "relative overflow-hidden rounded-2xl p-4",
            "bg-gradient-to-br from-white/[0.04] to-white/[0.01]",
            "border border-white/[0.08]"
          )}>
            <RiskLogList logs={logs} />
          </div>
        </div>
      </div>

      {/* 风控规则说明 */}
      {thresholds && (
        <div className={cn(
          "relative overflow-hidden rounded-2xl p-5",
          "bg-gradient-to-br from-white/[0.04] to-white/[0.01]",
          "border border-white/[0.08]"
        )}>
          <h3 className="text-lg font-medium mb-4 text-white">当前风控规则</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 rounded-xl bg-white/[0.03]">
              <span className="text-white/50">杠杆警告</span>
              <div className="font-mono text-cyan-400 mt-1">{thresholds.leverage_warning}x</div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03]">
              <span className="text-white/50">杠杆危险</span>
              <div className="font-mono text-red-400 mt-1">{thresholds.leverage_critical}x</div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03]">
              <span className="text-white/50">回撤期杠杆</span>
              <div className="font-mono text-amber-400 mt-1">{thresholds.leverage_in_drawdown}x</div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03]">
              <span className="text-white/50">月度回撤警告</span>
              <div className="font-mono text-cyan-400 mt-1">{thresholds.monthly_drawdown_warning}%</div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03]">
              <span className="text-white/50">月度回撤危险</span>
              <div className="font-mono text-red-400 mt-1">{thresholds.monthly_drawdown_critical}%</div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03]">
              <span className="text-white/50">移动止盈</span>
              <div className="font-mono text-purple-400 mt-1">{thresholds.trailing_stop_percent}%</div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03]">
              <span className="text-white/50">连败警告</span>
              <div className="font-mono text-cyan-400 mt-1">{thresholds.losing_streak_warning} 天</div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03]">
              <span className="text-white/50">连败危险</span>
              <div className="font-mono text-red-400 mt-1">{thresholds.losing_streak_critical} 天</div>
            </div>
          </div>
        </div>
      )}

      {/* 计算原理说明 */}
      <div className={cn(
        "relative overflow-hidden rounded-2xl p-5",
        "bg-gradient-to-br from-cyan-500/10 to-cyan-500/5",
        "border border-cyan-500/20"
      )}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-[60px]" />
        <div className="relative">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-3 text-white">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <AlertTriangle size={16} className="text-cyan-400" />
            </div>
            计算原理说明
          </h3>
          <div className="space-y-4 text-sm">
            {/* 回撤期判定 */}
            <div className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.05]">
              <h4 className="font-medium text-cyan-400 mb-2">📉 回撤期判定</h4>
              <div className="text-white/60 space-y-1">
                <p><strong className="text-white/80">定义：</strong>当前净值 &lt; 历史高水位 (HWM) 时，即处于回撤期</p>
                <p><strong className="text-white/80">公式：</strong><code className="bg-white/[0.08] px-2 py-0.5 rounded text-cyan-300">isInDrawdown = currentNAV &lt; highWaterMark</code></p>
                <p><strong className="text-white/80">影响：</strong>回撤期间杠杆限制从 {thresholds?.leverage_critical || 2.0}x 降低到 {thresholds?.leverage_in_drawdown || 1.2}x</p>
              </div>
            </div>

            {/* 杠杆率计算 */}
            <div className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.05]">
              <h4 className="font-medium text-emerald-400 mb-2">📊 杠杆率计算</h4>
              <div className="text-white/60 space-y-1">
                <p><strong className="text-white/80">公式：</strong><code className="bg-white/[0.08] px-2 py-0.5 rounded text-emerald-300">杠杆率 = 总资产 / 净资产 = (净资产 + 融资) / 净资产</code></p>
                <p><strong className="text-white/80">备选：</strong>当 leverage_ratio 无效时，使用 <code className="bg-white/[0.08] px-2 py-0.5 rounded text-emerald-300">long_ratio / 100</code></p>
                <p><strong className="text-white/80">示例：</strong>净资产 100万，融资 50万 → 杠杆率 = 150万/100万 = 1.5x</p>
              </div>
            </div>

            {/* 月度回撤 */}
            <div className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.05]">
              <h4 className="font-medium text-amber-400 mb-2">📅 月度回撤</h4>
              <div className="text-white/60 space-y-1">
                <p><strong className="text-white/80">公式：</strong><code className="bg-white/[0.08] px-2 py-0.5 rounded text-amber-300">月度回撤 = (月初净值 - 当前净值) / 月初净值 × 100%</code></p>
                <p><strong className="text-white/80">止损线：</strong>月度回撤达到 {thresholds?.monthly_drawdown_critical || 15}% 时触发熔断</p>
              </div>
            </div>

            {/* 距HWM回撤 */}
            <div className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.05]">
              <h4 className="font-medium text-purple-400 mb-2">🏔️ 距HWM回撤</h4>
              <div className="text-white/60 space-y-1">
                <p><strong className="text-white/80">HWM (High Water Mark)：</strong>历史最高净值</p>
                <p><strong className="text-white/80">公式：</strong><code className="bg-white/[0.08] px-2 py-0.5 rounded text-purple-300">距HWM回撤 = (HWM - 当前净值) / HWM × 100%</code></p>
                <p><strong className="text-white/80">移动止盈：</strong>从HWM回撤超过 {thresholds?.trailing_stop_percent || 5}% 时触发警告</p>
              </div>
            </div>

            {/* 连败天数 */}
            <div className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.05]">
              <h4 className="font-medium text-red-400 mb-2">🔥 连败天数</h4>
              <div className="text-white/60 space-y-1">
                <p><strong className="text-white/80">定义：</strong>连续亏损的交易日数量</p>
                <p><strong className="text-white/80">计算：</strong>从最近一个盈利日开始，统计连续亏损天数</p>
                <p><strong className="text-white/80">阈值：</strong>连败 {thresholds?.losing_streak_warning || 3} 天警告，{thresholds?.losing_streak_critical || 5} 天危险</p>
              </div>
            </div>

            {/* 综合风险评分 */}
            <div className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.05]">
              <h4 className="font-medium text-cyan-400 mb-2">🎯 综合风险评分</h4>
              <div className="text-white/60 space-y-1">
                <p><strong className="text-white/80">范围：</strong>0-100 分，分数越高越安全</p>
                <p><strong className="text-white/80">权重：</strong>杠杆状态 30% + 月度回撤 25% + 移动止盈 25% + 连败天数 20%</p>
                <p><strong className="text-white/80">等级：</strong>≥70 安全 | 40-70 谨慎 | &lt;40 危险</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI 风控分析 */}
      <UnifiedAIAnalysisPanel 
        riskMetrics={riskMetrics}
        thresholds={thresholds ? {
          leverage_warning: thresholds.leverage_warning,
          leverage_critical: thresholds.leverage_critical,
          leverage_in_drawdown: thresholds.leverage_in_drawdown,
          monthly_drawdown_warning: thresholds.monthly_drawdown_warning,
          monthly_drawdown_critical: thresholds.monthly_drawdown_critical,
          trailing_stop_percent: thresholds.trailing_stop_percent,
          losing_streak_warning: thresholds.losing_streak_warning,
          losing_streak_critical: thresholds.losing_streak_critical,
        } : null}
        breakerSummary={breakerSummary}
        dashboard={dashboard}
        history={history || []}
        onAlert={async (alert) => {
          // Add alert to risk log
          try {
            await logRiskAlert({
              user_id: 1,
              alert_type: alert.alertType,
              severity: alert.severity,
              title: alert.title,
              message: alert.message,
              recommendation: alert.recommendation,
              metrics: alert.data,
              acknowledged: false,
            });
            // Refresh logs
            const logsData = await getRiskLogs(1, { limit: 50 });
            setLogs(logsData);
          } catch (error) {
            console.error('Failed to add risk log:', error);
          }
        }}
      />
    </div>
  );
}
