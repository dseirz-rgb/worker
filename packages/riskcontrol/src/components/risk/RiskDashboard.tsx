/**
 * RiskDashboard - 风险仪表盘组件
 * Feature: intelligent-risk-engine
 * 
 * 显示当前风险等级、杠杆限制、止损线等核心风控指标。
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { 
  useRiskDecision, 
  useRiskLevelColor, 
  useRiskLevelBgColor,
  getRiskLevelLabel 
} from '../../hooks/useRiskDecision';
import type { RiskDecision, RiskLevel } from '../../services/riskDecisionEngine';

// ============ 类型定义 ============

export interface RiskDashboardProps {
  tickers?: string[];
  market?: string;
  compact?: boolean;
  showDetails?: boolean;
  className?: string;
}

// ============ 子组件 ============

interface RiskGaugeProps {
  level: RiskLevel;
  confidence: number;
}

function RiskGauge({ level, confidence }: RiskGaugeProps) {
  const colorClass = useRiskLevelColor(level);
  const bgColorClass = useRiskLevelBgColor(level);
  
  // 风险等级对应的角度 (0-180度)
  const levelAngles: Record<RiskLevel, number> = {
    low: 30,
    medium: 75,
    high: 120,
    critical: 160,
  };
  const angle = levelAngles[level] || 90;
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        {/* 背景弧 */}
        <div className="absolute inset-0 border-8 border-muted rounded-t-full" />
        {/* 指针 */}
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-14 bg-current origin-bottom transition-transform duration-500"
          style={{ 
            transform: `translateX(-50%) rotate(${angle - 90}deg)`,
          }}
        >
          <div className={cn('w-3 h-3 rounded-full -ml-1 -mt-1', bgColorClass, colorClass)} />
        </div>
        {/* 中心点 */}
        <div className="absolute bottom-0 left-1/2 w-4 h-4 -ml-2 rounded-full bg-background border-2 border-muted" />
      </div>
      <div className={cn('text-lg font-bold mt-2', colorClass)}>
        {getRiskLevelLabel(level)}
      </div>
      <div className="text-xs text-muted-foreground">
        置信度 {(confidence * 100).toFixed(0)}%
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  colorClass?: string;
  icon?: React.ReactNode;
}

function MetricCard({ label, value, subValue, colorClass, icon }: MetricCardProps) {
  return (
    <div className="flex flex-col p-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className={cn('text-xl font-bold', colorClass)}>
        {value}
      </div>
      {subValue && (
        <div className="text-xs text-muted-foreground mt-0.5">
          {subValue}
        </div>
      )}
    </div>
  );
}

// ============ 主组件 ============

export function RiskDashboard({
  tickers = ['SPY'],
  market = 'us',
  compact = false,
  showDetails = true,
  className,
}: RiskDashboardProps) {
  const { decision, isLoading, error, refresh } = useRiskDecision({
    tickers,
    market,
  });

  if (isLoading && !decision) {
    return (
      <div className={cn('p-4 rounded-lg border bg-card animate-pulse', className)}>
        <div className="h-32 bg-muted rounded" />
      </div>
    );
  }

  if (error && !decision) {
    return (
      <div className={cn('p-4 rounded-lg border bg-card', className)}>
        <div className="text-center text-muted-foreground">
          <p>加载风险数据失败</p>
          <button 
            onClick={refresh}
            className="mt-2 text-sm text-primary hover:underline"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!decision) return null;

  const leverageColor = decision.effectiveLeverage <= 1.0 
    ? 'text-green-500' 
    : decision.effectiveLeverage <= 1.3 
      ? 'text-yellow-500' 
      : 'text-orange-500';

  const stopLossColor = decision.effectiveStopLoss >= -0.08
    ? 'text-green-500'
    : decision.effectiveStopLoss >= -0.12
      ? 'text-yellow-500'
      : 'text-orange-500';

  if (compact) {
    return (
      <div className={cn('flex items-center gap-4 p-3 rounded-lg border bg-card', className)}>
        <div className={cn(
          'px-2 py-1 rounded text-sm font-medium',
          useRiskLevelBgColor(decision.overallRiskLevel),
          useRiskLevelColor(decision.overallRiskLevel)
        )}>
          {getRiskLevelLabel(decision.overallRiskLevel)}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className={leverageColor}>
            杠杆 {decision.effectiveLeverage}x
          </span>
          <span className={stopLossColor}>
            止损 {(decision.effectiveStopLoss * 100).toFixed(0)}%
          </span>
          {!decision.tradingAllowed && (
            <span className="text-red-500">交易暂停</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-4 rounded-lg border bg-card', className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">风险仪表盘</h3>
        <div className="flex items-center gap-2">
          {decision.isOverridden && (
            <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500">
              已手动覆盖
            </span>
          )}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {isLoading ? '刷新中...' : '刷新'}
          </button>
        </div>
      </div>

      {/* 风险仪表 */}
      <div className="flex justify-center mb-4">
        <RiskGauge 
          level={decision.overallRiskLevel} 
          confidence={decision.confidence}
        />
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <MetricCard
          label="杠杆限制"
          value={`${decision.effectiveLeverage}x`}
          subValue={decision.leverageLimit.reason}
          colorClass={leverageColor}
        />
        <MetricCard
          label="止损线"
          value={`${(decision.effectiveStopLoss * 100).toFixed(0)}%`}
          subValue={decision.stopLossConfig.reason}
          colorClass={stopLossColor}
        />
        <MetricCard
          label="交易状态"
          value={decision.tradingAllowed ? '允许' : '暂停'}
          subValue={decision.cooldownUntil 
            ? `冷静期至 ${new Date(decision.cooldownUntil).toLocaleTimeString('zh-CN')}`
            : undefined
          }
          colorClass={decision.tradingAllowed ? 'text-green-500' : 'text-red-500'}
        />
      </div>

      {/* 详细信息 */}
      {showDetails && (
        <div className="pt-3 border-t">
          <div className="text-xs text-muted-foreground mb-2">决策依据</div>
          <ul className="text-xs space-y-1">
            {decision.reasoning.slice(0, 5).map((reason, i) => (
              <li key={i} className="text-muted-foreground">
                • {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 更新时间 */}
      <div className="text-xs text-muted-foreground mt-3 text-right">
        更新于 {new Date(decision.timestamp).toLocaleTimeString('zh-CN')}
      </div>
    </div>
  );
}

export default RiskDashboard;
