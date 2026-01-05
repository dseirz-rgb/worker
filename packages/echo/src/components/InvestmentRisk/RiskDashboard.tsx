/**
 * RiskDashboard - 风险仪表盘组件 (HeroUI 版本)
 * 
 * 显示当前风险等级、杠杆限制、止损线等核心风控指标。
 * 从 RiskControl 移植并转换为 HeroUI 组件。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, CardHeader, Button, Chip, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';

// ============ 类型定义 ============

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskDecision {
  overallRiskLevel: RiskLevel;
  confidence: number;
  effectiveLeverage: number;
  effectiveStopLoss: number;
  tradingAllowed: boolean;
  cooldownUntil?: string;
  isOverridden: boolean;
  leverageLimit: { reason: string };
  stopLossConfig: { reason: string };
  reasoning: string[];
  timestamp: string;
}

export interface RiskDashboardProps {
  tickers?: string[];
  market?: string;
  compact?: boolean;
  showDetails?: boolean;
  className?: string;
}

// ============ 辅助函数 ============

function getRiskLevelLabel(level: RiskLevel): string {
  switch (level) {
    case 'low': return '低风险';
    case 'medium': return '中风险';
    case 'high': return '高风险';
    case 'critical': return '极高风险';
    default: return '未知';
  }
}

function getRiskLevelColor(level: RiskLevel): 'success' | 'warning' | 'danger' | 'default' {
  switch (level) {
    case 'low': return 'success';
    case 'medium': return 'warning';
    case 'high': return 'danger';
    case 'critical': return 'danger';
    default: return 'default';
  }
}

function getRiskLevelIcon(level: RiskLevel): string {
  switch (level) {
    case 'low': return 'mdi:shield-check';
    case 'medium': return 'mdi:shield-alert';
    case 'high': return 'mdi:shield-alert-outline';
    case 'critical': return 'mdi:shield-off';
    default: return 'mdi:shield';
  }
}

// ============ Mock 数据生成 ============

function generateMockDecision(): RiskDecision {
  const levels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
  const level = levels[Math.floor(Math.random() * 3)]; // 偏向低风险
  
  return {
    overallRiskLevel: level,
    confidence: 0.75 + Math.random() * 0.2,
    effectiveLeverage: level === 'low' ? 1.5 : level === 'medium' ? 1.2 : 1.0,
    effectiveStopLoss: level === 'low' ? -0.08 : level === 'medium' ? -0.06 : -0.04,
    tradingAllowed: level !== 'critical',
    isOverridden: false,
    leverageLimit: { reason: '基于当前市场波动率' },
    stopLossConfig: { reason: '基于历史回撤分析' },
    reasoning: [
      '市场波动率处于正常范围',
      '持仓集中度符合要求',
      '近期无重大风险事件',
    ],
    timestamp: new Date().toISOString(),
  };
}

// ============ 子组件 ============

interface RiskGaugeProps {
  level: RiskLevel;
  confidence: number;
}

function RiskGauge({ level, confidence }: RiskGaugeProps) {
  // 风险等级对应的角度 (0-180度)
  const levelAngles: Record<RiskLevel, number> = {
    low: 30,
    medium: 75,
    high: 120,
    critical: 160,
  };
  const angle = levelAngles[level] || 90;
  
  const colorMap: Record<RiskLevel, string> = {
    low: '#22c55e',
    medium: '#eab308',
    high: '#f97316',
    critical: '#ef4444',
  };
  const color = colorMap[level];
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        {/* 背景弧 */}
        <div className="absolute inset-0 border-8 border-default-200 rounded-t-full" />
        {/* 指针 */}
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-14 origin-bottom transition-transform duration-500"
          style={{ 
            transform: `translateX(-50%) rotate(${angle - 90}deg)`,
            backgroundColor: color,
          }}
        >
          <div 
            className="w-3 h-3 rounded-full -ml-1 -mt-1"
            style={{ backgroundColor: color }}
          />
        </div>
        {/* 中心点 */}
        <div className="absolute bottom-0 left-1/2 w-4 h-4 -ml-2 rounded-full bg-background border-2 border-default-200" />
      </div>
      <Chip 
        color={getRiskLevelColor(level)} 
        variant="flat" 
        className="mt-2"
        startContent={<Icon icon={getRiskLevelIcon(level)} />}
      >
        {getRiskLevelLabel(level)}
      </Chip>
      <div className="text-xs text-foreground/60 mt-1">
        置信度 {(confidence * 100).toFixed(0)}%
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  color?: 'success' | 'warning' | 'danger' | 'primary';
  icon?: string;
}

function MetricCard({ label, value, subValue, color = 'primary', icon }: MetricCardProps) {
  const colorClasses = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    primary: 'text-primary',
  };
  
  return (
    <div className="flex flex-col p-3 rounded-lg bg-content2/50">
      <div className="flex items-center gap-2 text-xs text-foreground/60 mb-1">
        {icon && <Icon icon={icon} className="text-sm" />}
        {label}
      </div>
      <div className={`text-xl font-bold ${colorClasses[color]}`}>
        {value}
      </div>
      {subValue && (
        <div className="text-xs text-foreground/50 mt-0.5">
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
  className = '',
}: RiskDashboardProps) {
  const [decision, setDecision] = useState<RiskDecision | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 500));
      setDecision(generateMockDecision());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载失败'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (isLoading && !decision) {
    return (
      <Card className={`bg-content1/50 backdrop-blur-sm ${className}`}>
        <CardBody className="flex items-center justify-center h-32">
          <Spinner size="lg" />
        </CardBody>
      </Card>
    );
  }

  if (error && !decision) {
    return (
      <Card className={`bg-content1/50 backdrop-blur-sm ${className}`}>
        <CardBody className="text-center">
          <p className="text-foreground/60">加载风险数据失败</p>
          <Button 
            size="sm" 
            variant="light" 
            color="primary"
            onPress={refresh}
            className="mt-2"
          >
            重试
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (!decision) return null;

  const leverageColor = decision.effectiveLeverage <= 1.0 
    ? 'success' 
    : decision.effectiveLeverage <= 1.3 
      ? 'warning' 
      : 'danger';

  const stopLossColor = decision.effectiveStopLoss >= -0.08
    ? 'success'
    : decision.effectiveStopLoss >= -0.12
      ? 'warning'
      : 'danger';

  if (compact) {
    return (
      <Card className={`bg-content1/50 backdrop-blur-sm ${className}`}>
        <CardBody className="flex flex-row items-center gap-4 py-3">
          <Chip 
            color={getRiskLevelColor(decision.overallRiskLevel)} 
            variant="flat"
            size="sm"
          >
            {getRiskLevelLabel(decision.overallRiskLevel)}
          </Chip>
          <div className="flex items-center gap-3 text-sm">
            <span className={`text-${leverageColor}`}>
              杠杆 {decision.effectiveLeverage}x
            </span>
            <span className={`text-${stopLossColor}`}>
              止损 {(decision.effectiveStopLoss * 100).toFixed(0)}%
            </span>
            {!decision.tradingAllowed && (
              <Chip color="danger" size="sm" variant="flat">交易暂停</Chip>
            )}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className={`bg-content1/50 backdrop-blur-sm ${className}`}>
      <CardHeader className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:gauge" className="text-xl text-primary" />
          <h3 className="font-semibold">风险仪表盘</h3>
        </div>
        <div className="flex items-center gap-2">
          {decision.isOverridden && (
            <Chip size="sm" color="warning" variant="flat">已手动覆盖</Chip>
          )}
          <Button
            size="sm"
            variant="light"
            isLoading={isLoading}
            onPress={refresh}
          >
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* 风险仪表 */}
        <div className="flex justify-center">
          <RiskGauge 
            level={decision.overallRiskLevel} 
            confidence={decision.confidence}
          />
        </div>

        {/* 核心指标 */}
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            label="杠杆限制"
            value={`${decision.effectiveLeverage}x`}
            subValue={decision.leverageLimit.reason}
            color={leverageColor}
            icon="mdi:scale-balance"
          />
          <MetricCard
            label="止损线"
            value={`${(decision.effectiveStopLoss * 100).toFixed(0)}%`}
            subValue={decision.stopLossConfig.reason}
            color={stopLossColor}
            icon="mdi:shield-alert"
          />
          <MetricCard
            label="交易状态"
            value={decision.tradingAllowed ? '允许' : '暂停'}
            subValue={decision.cooldownUntil 
              ? `冷静期至 ${new Date(decision.cooldownUntil).toLocaleTimeString('zh-CN')}`
              : undefined
            }
            color={decision.tradingAllowed ? 'success' : 'danger'}
            icon="mdi:swap-horizontal"
          />
        </div>

        {/* 详细信息 */}
        {showDetails && (
          <div className="pt-3 border-t border-divider">
            <div className="text-xs text-foreground/60 mb-2">决策依据</div>
            <ul className="text-xs space-y-1">
              {decision.reasoning.slice(0, 5).map((reason, i) => (
                <li key={i} className="text-foreground/60 flex items-start gap-1">
                  <Icon icon="mdi:circle-small" className="text-sm flex-shrink-0" />
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 更新时间 */}
        <div className="text-xs text-foreground/50 text-right">
          更新于 {new Date(decision.timestamp).toLocaleTimeString('zh-CN')}
        </div>
      </CardBody>
    </Card>
  );
}

export default RiskDashboard;
