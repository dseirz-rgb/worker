/**
 * RiskForecastChart - 风险预测图表组件 (HeroUI 版本)
 * 
 * 显示未来 1/3/5 天风险预测。
 * 从 RiskControl 移植并转换为 HeroUI 组件。
 */

import React, { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Chip, Progress, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';

// ============ 类型定义 ============

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface DrawdownProbability {
  horizon: number;
  threshold: number;
  probability: number;
}

export interface RiskForecast {
  level: RiskLevel;
  confidence: number;
  drawdownProbabilities: DrawdownProbability[];
  regimeTransition: {
    from: string;
    to: string;
    probability: number;
  } | null;
  generatedAt: string;
  expiresAt: string;
}

export interface RiskForecastChartProps {
  tickers?: string[];
  market?: string;
  showProbabilities?: boolean;
  showRegimeTransition?: boolean;
  className?: string;
}


// ============ 辅助函数 ============

function getRiskLevelColor(level: RiskLevel): 'success' | 'warning' | 'danger' | 'default' {
  switch (level) {
    case 'low': return 'success';
    case 'medium': return 'warning';
    case 'high': return 'danger';
    case 'critical': return 'danger';
    default: return 'default';
  }
}

function getRiskLevelLabel(level: RiskLevel): string {
  switch (level) {
    case 'low': return '低风险';
    case 'medium': return '中风险';
    case 'high': return '高风险';
    case 'critical': return '极高风险';
    default: return '未知';
  }
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

// ============ Mock 数据 ============

function generateMockForecast(): RiskForecast {
  return {
    level: 'medium',
    confidence: 0.82,
    drawdownProbabilities: [
      { horizon: 1, threshold: 0.05, probability: 0.15 },
      { horizon: 1, threshold: 0.10, probability: 0.08 },
      { horizon: 1, threshold: 0.15, probability: 0.03 },
      { horizon: 3, threshold: 0.05, probability: 0.25 },
      { horizon: 3, threshold: 0.10, probability: 0.15 },
      { horizon: 3, threshold: 0.15, probability: 0.08 },
      { horizon: 5, threshold: 0.05, probability: 0.35 },
      { horizon: 5, threshold: 0.10, probability: 0.22 },
      { horizon: 5, threshold: 0.15, probability: 0.12 },
    ],
    regimeTransition: null,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };
}


// ============ 子组件 ============

interface ProbabilityBarProps {
  label: string;
  probability: number;
  isWarning?: boolean;
}

function ProbabilityBar({ label, probability, isWarning }: ProbabilityBarProps) {
  const color = isWarning 
    ? probability > 0.5 ? 'danger' : probability > 0.3 ? 'warning' : 'warning'
    : 'primary';
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-foreground/60">{label}</span>
        <span className={`font-medium ${isWarning && probability > 0.3 ? 'text-warning' : ''}`}>
          {formatPercent(probability)}
        </span>
      </div>
      <Progress 
        value={probability * 100} 
        color={color}
        size="sm"
        className="max-w-full"
      />
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
    <div className="p-3 rounded-lg bg-content2/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">{horizon} 天预测</span>
        <Chip size="sm" color={getRiskLevelColor(riskLevel)} variant="flat">
          {getRiskLevelLabel(riskLevel)}
        </Chip>
      </div>
      
      <div className="space-y-3">
        {horizonProbs.map((prob, i) => (
          <ProbabilityBar
            key={i}
            label={`>${formatPercent(prob.threshold)} 回撤`}
            probability={prob.probability}
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
      <div className="p-3 rounded-lg bg-success/10 border border-success/30">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:check-circle" className="text-success" />
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
    <div className={`p-3 rounded-lg border ${isHighRisk ? 'bg-danger/10 border-danger/30' : 'bg-warning/10 border-warning/30'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">趋势转换预警</span>
        <Chip size="sm" color={isHighRisk ? 'danger' : 'warning'} variant="flat">
          概率 {formatPercent(transition.probability)}
        </Chip>
      </div>
      
      <div className="flex items-center gap-2 text-sm">
        <span className="px-2 py-1 rounded bg-content2">
          {regimeNames[transition.from] || transition.from}
        </span>
        <Icon icon="mdi:arrow-right" className="text-foreground/50" />
        <span className={`px-2 py-1 rounded ${isHighRisk ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'}`}>
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
  className = '',
}: RiskForecastChartProps) {
  const [forecast, setForecast] = useState<RiskForecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadForecast() {
      setIsLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 400));
        setForecast(generateMockForecast());
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
      <Card className={`bg-content1/50 backdrop-blur-sm ${className}`}>
        <CardBody className="flex items-center justify-center h-48">
          <Spinner size="lg" />
        </CardBody>
      </Card>
    );
  }

  if (error || !forecast) {
    return (
      <Card className={`bg-content1/50 backdrop-blur-sm ${className}`}>
        <CardBody className="text-center py-8 text-foreground/60">
          <p>加载风险预测失败</p>
          <p className="text-xs mt-1">{error?.message}</p>
        </CardBody>
      </Card>
    );
  }

  const horizons = [1, 3, 5];

  return (
    <Card className={`bg-content1/50 backdrop-blur-sm ${className}`}>
      <CardHeader className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:chart-timeline-variant" className="text-xl text-secondary" />
          <h3 className="font-semibold">风险预测</h3>
        </div>
        <div className="flex items-center gap-2">
          <Chip size="sm" color={getRiskLevelColor(forecast.level)} variant="flat">
            {getRiskLevelLabel(forecast.level)}
          </Chip>
          <span className="text-xs text-foreground/50">
            置信度 {formatPercent(forecast.confidence)}
          </span>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* 回撤概率预测 */}
        {showProbabilities && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
        <div className="flex items-center justify-between text-xs text-foreground/50 pt-3 border-t border-divider">
          <span>生成于 {new Date(forecast.generatedAt).toLocaleString('zh-CN')}</span>
          <span>有效至 {new Date(forecast.expiresAt).toLocaleString('zh-CN')}</span>
        </div>
      </CardBody>
    </Card>
  );
}

export default RiskForecastChart;
