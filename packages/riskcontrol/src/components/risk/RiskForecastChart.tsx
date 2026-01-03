/**
 * RiskForecastChart - 风险预测图表组件
 * Feature: intelligent-risk-engine
 * 
 * 显示未来 1/3/5 天风险预测。
 * 
 * Requirements: 7.4
 */

import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { 
  riskForecaster, 
  RiskForecast, 
  DrawdownProbability,
  RiskLevel 
} from '../../services/riskForecaster';

// ============ 类型定义 ============

export interface RiskForecastChartProps {
  tickers?: string[];
  market?: string;
  showProbabilities?: boolean;
  showRegimeTransition?: boolean;
  className?: string;
}

// ============ 辅助函数 ============

function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return '#22c55e'; // green-500
    case 'medium':
      return '#eab308'; // yellow-500
    case 'high':
      return '#f97316'; // orange-500
    case 'critical':
      return '#ef4444'; // red-500
    default:
      return '#6b7280'; // gray-500
  }
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

// ============ 子组件 ============

interface ProbabilityBarProps {
  label: string;
  probability: number;
  threshold: number;
  isWarning?: boolean;
}

function ProbabilityBar({ label, probability, threshold, isWarning }: ProbabilityBarProps) {
  const width = Math.min(probability * 100, 100);
  const color = isWarning 
    ? probability > 0.5 ? '#ef4444' : probability > 0.3 ? '#f97316' : '#eab308'
    : '#3b82f6';
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn(
          'font-medium',
          isWarning && probability > 0.3 ? 'text-orange-500' : ''
        )}>
          {formatPercent(probability)}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{ 
            width: `${width}%`,
            backgroundColor: color,
          }}
        />
      </div>
      {isWarning && (
        <div className="text-xs text-muted-foreground">
          回撤阈值: {formatPercent(threshold)}
        </div>
      )}
    </div>
  );
}

interface HorizonCardProps {
  horizon: number;
  probabilities: DrawdownProbability[];
}

function HorizonCard({ horizon, probabilities }: HorizonCardProps) {
  const horizonProbs = probabilities.filter(p => p.horizon === horizon);
  
  // 计算该时间段的风险等级
  const prob15 = horizonProbs.find(p => p.threshold === 0.15);
  const prob10 = horizonProbs.find(p => p.threshold === 0.10);
  
  let riskLevel: RiskLevel = 'low';
  if (prob15 && prob15.probability > 0.3) {
    riskLevel = 'critical';
  } else if (prob10 && prob10.probability > 0.5) {
    riskLevel = 'high';
  } else if (prob10 && prob10.probability > 0.3) {
    riskLevel = 'medium';
  }
  
  return (
    <div className="p-3 rounded-lg bg-muted/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">{horizon} 天预测</span>
        <span 
          className="text-xs px-2 py-0.5 rounded"
          style={{ 
            backgroundColor: `${getRiskLevelColor(riskLevel)}20`,
            color: getRiskLevelColor(riskLevel),
          }}
        >
          {riskLevel === 'low' ? '低风险' : 
           riskLevel === 'medium' ? '中风险' :
           riskLevel === 'high' ? '高风险' : '极高风险'}
        </span>
      </div>
      
      <div className="space-y-3">
        {horizonProbs.map((prob, i) => (
          <ProbabilityBar
            key={i}
            label={`>${formatPercent(prob.threshold)} 回撤`}
            probability={prob.probability}
            threshold={prob.threshold}
            isWarning={prob.threshold >= 0.10}
          />
        ))}
      </div>
    </div>
  );
}

interface RegimeTransitionCardProps {
  transition: {
    from: string;
    to: string;
    probability: number;
  } | null;
}

function RegimeTransitionCard({ transition }: RegimeTransitionCardProps) {
  if (!transition) {
    return (
      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
        <div className="flex items-center gap-2">
          <span className="text-green-500">✓</span>
          <span className="text-sm">市场状态稳定，无明显转换信号</span>
        </div>
      </div>
    );
  }
  
  const regimeNames: Record<string, string> = {
    bull: '牛市',
    bear: '熊市',
    sideways: '震荡市',
    high_volatility: '高波动',
  };
  
  const isHighRisk = transition.to === 'bear' || transition.to === 'high_volatility';
  
  return (
    <div className={cn(
      'p-3 rounded-lg border',
      isHighRisk 
        ? 'bg-red-500/10 border-red-500/20' 
        : 'bg-yellow-500/10 border-yellow-500/20'
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">趋势转换预警</span>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded',
          isHighRisk ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'
        )}>
          概率 {formatPercent(transition.probability)}
        </span>
      </div>
      
      <div className="flex items-center gap-2 text-sm">
        <span className="px-2 py-1 rounded bg-muted">
          {regimeNames[transition.from] || transition.from}
        </span>
        <span className="text-muted-foreground">→</span>
        <span className={cn(
          'px-2 py-1 rounded',
          isHighRisk ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'
        )}>
          {regimeNames[transition.to] || transition.to}
        </span>
      </div>
    </div>
  );
}

// ============ 主组件 ============

export function RiskForecastChart({
  tickers = ['SPY'],
  market = 'us',
  showProbabilities = true,
  showRegimeTransition = true,
  className,
}: RiskForecastChartProps) {
  const [forecast, setForecast] = useState<RiskForecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadForecast() {
      setIsLoading(true);
      try {
        const result = await riskForecaster.generateForecast(tickers, market);
        setForecast(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('加载预测失败'));
      } finally {
        setIsLoading(false);
      }
    }
    
    loadForecast();
  }, [tickers, market]);

  if (isLoading) {
    return (
      <div className={cn('p-4 rounded-lg border bg-card', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-32 bg-muted rounded" />
            <div className="h-32 bg-muted rounded" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !forecast) {
    return (
      <div className={cn('p-4 rounded-lg border bg-card', className)}>
        <div className="text-center text-muted-foreground py-8">
          <p>加载风险预测失败</p>
          <p className="text-xs mt-1">{error?.message}</p>
        </div>
      </div>
    );
  }

  // 获取不同时间段的概率
  const horizons = [1, 3, 5];

  return (
    <div className={cn('p-4 rounded-lg border bg-card', className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">风险预测</h3>
        <div className="flex items-center gap-2">
          <span 
            className="text-xs px-2 py-0.5 rounded"
            style={{ 
              backgroundColor: `${getRiskLevelColor(forecast.level)}20`,
              color: getRiskLevelColor(forecast.level),
            }}
          >
            {forecast.level === 'low' ? '低风险' : 
             forecast.level === 'medium' ? '中风险' :
             forecast.level === 'high' ? '高风险' : '极高风险'}
          </span>
          <span className="text-xs text-muted-foreground">
            置信度 {formatPercent(forecast.confidence)}
          </span>
        </div>
      </div>

      {/* 回撤概率预测 */}
      {showProbabilities && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {horizons.map(horizon => (
            <HorizonCard
              key={horizon}
              horizon={horizon}
              probabilities={forecast.drawdownProbabilities}
            />
          ))}
        </div>
      )}

      {/* 趋势转换预警 */}
      {showRegimeTransition && (
        <RegimeTransitionCard transition={forecast.regimeTransition} />
      )}

      {/* 底部信息 */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mt-4 pt-3 border-t">
        <span>
          生成于 {new Date(forecast.generatedAt).toLocaleString('zh-CN')}
        </span>
        <span>
          有效至 {new Date(forecast.expiresAt).toLocaleString('zh-CN')}
        </span>
      </div>
    </div>
  );
}

export default RiskForecastChart;
