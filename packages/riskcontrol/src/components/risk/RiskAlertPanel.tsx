/**
 * RiskAlertPanel - 风险预警面板组件
 * Feature: intelligent-risk-engine
 * 
 * 显示最新风险预警和建议操作。
 * 
 * Requirements: 7.5
 */

import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { riskForecaster, RiskAlert, AlertSeverity } from '../../services/riskForecaster';
import { emotionalTradingDetector, EmotionalTradingAlert } from '../../services/emotionalTradingDetector';

// ============ 类型定义 ============

export interface RiskAlertPanelProps {
  maxAlerts?: number;
  showEmotionalAlerts?: boolean;
  onAlertClick?: (alert: RiskAlert | EmotionalTradingAlert) => void;
  className?: string;
}

interface AlertItemProps {
  type: string;
  severity: AlertSeverity | 'warning' | 'critical';
  message: string;
  suggestedAction?: string;
  timestamp?: Date;
  onDismiss?: () => void;
  onAcknowledge?: () => void;
}

// ============ 辅助函数 ============

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'info':
      return 'text-blue-500';
    case 'warning':
      return 'text-yellow-500';
    case 'critical':
      return 'text-red-500';
    default:
      return 'text-muted-foreground';
  }
}

function getSeverityBgColor(severity: string): string {
  switch (severity) {
    case 'info':
      return 'bg-blue-500/10 border-blue-500/20';
    case 'warning':
      return 'bg-yellow-500/10 border-yellow-500/20';
    case 'critical':
      return 'bg-red-500/10 border-red-500/20';
    default:
      return 'bg-muted border-muted';
  }
}

function getSeverityLabel(severity: string): string {
  switch (severity) {
    case 'info':
      return '提示';
    case 'warning':
      return '警告';
    case 'critical':
      return '严重';
    default:
      return '未知';
  }
}

function getAlertTypeLabel(type: string): string {
  switch (type) {
    case 'drawdown_warning':
      return '回撤预警';
    case 'regime_change':
      return '趋势转换';
    case 'volatility_spike':
      return '波动率异常';
    case 'revenge_trading':
      return '报复性交易';
    case 'overtrading':
      return '过度交易';
    case 'panic_selling':
      return '恐慌性卖出';
    case 'fomo_buying':
      return 'FOMO 买入';
    default:
      return '风险预警';
  }
}

// ============ 子组件 ============

function AlertItem({
  type,
  severity,
  message,
  suggestedAction,
  timestamp,
  onDismiss,
  onAcknowledge,
}: AlertItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div 
      className={cn(
        'p-3 rounded-lg border transition-all cursor-pointer',
        getSeverityBgColor(severity),
        isExpanded && 'ring-1 ring-current'
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* 头部 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded font-medium',
            getSeverityColor(severity)
          )}>
            {getSeverityLabel(severity)}
          </span>
          <span className="text-xs text-muted-foreground">
            {getAlertTypeLabel(type)}
          </span>
        </div>
        {timestamp && (
          <span className="text-xs text-muted-foreground">
            {new Date(timestamp).toLocaleTimeString('zh-CN')}
          </span>
        )}
      </div>
      
      {/* 消息 */}
      <p className="text-sm mt-2">{message}</p>
      
      {/* 展开内容 */}
      {isExpanded && suggestedAction && (
        <div className="mt-3 pt-3 border-t border-current/10">
          <div className="text-xs text-muted-foreground mb-1">建议操作</div>
          <p className="text-sm">{suggestedAction}</p>
          
          {/* 操作按钮 */}
          <div className="flex gap-2 mt-3">
            {onAcknowledge && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAcknowledge();
                }}
                className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                已知悉
              </button>
            )}
            {onDismiss && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80"
              >
                忽略
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <div className="text-2xl mb-2">✓</div>
      <p className="text-sm">暂无风险预警</p>
      <p className="text-xs mt-1">系统正在持续监控中</p>
    </div>
  );
}

// ============ 主组件 ============

export function RiskAlertPanel({
  maxAlerts = 5,
  showEmotionalAlerts = true,
  onAlertClick,
  className,
}: RiskAlertPanelProps) {
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [emotionalAlerts, setEmotionalAlerts] = useState<EmotionalTradingAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 加载预警
  useEffect(() => {
    async function loadAlerts() {
      setIsLoading(true);
      try {
        // 获取风险预警
        const forecast = await riskForecaster.generateForecast(['SPY']);
        setRiskAlerts(forecast.alerts);
        
        // 获取情绪化交易预警
        if (showEmotionalAlerts) {
          const emotional = emotionalTradingDetector.detect();
          setEmotionalAlerts(emotional);
        }
      } catch (error) {
        console.error('Failed to load alerts:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadAlerts();
  }, [showEmotionalAlerts]);

  // 订阅新预警
  useEffect(() => {
    const unsubscribe = riskForecaster.onAlerts((alerts) => {
      setRiskAlerts(alerts);
    });
    return unsubscribe;
  }, []);

  // 合并并排序预警
  const allAlerts = [
    ...riskAlerts.map(a => ({ ...a, source: 'risk' as const, timestamp: new Date() })),
    ...emotionalAlerts.map(a => ({ 
      ...a, 
      source: 'emotional' as const, 
      timestamp: a.detectedAt,
      suggestedAction: `建议冷静 ${a.suggestedCooldown} 分钟后再做交易决策`,
    })),
  ]
    .sort((a, b) => {
      // 按严重程度排序
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const aOrder = severityOrder[a.severity as keyof typeof severityOrder] ?? 2;
      const bOrder = severityOrder[b.severity as keyof typeof severityOrder] ?? 2;
      return aOrder - bOrder;
    })
    .slice(0, maxAlerts);

  if (isLoading) {
    return (
      <div className={cn('p-4 rounded-lg border bg-card', className)}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-4 rounded-lg border bg-card', className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">风险预警</h3>
        {allAlerts.length > 0 && (
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full',
            allAlerts.some(a => a.severity === 'critical')
              ? 'bg-red-500/10 text-red-500'
              : 'bg-yellow-500/10 text-yellow-500'
          )}>
            {allAlerts.length} 条预警
          </span>
        )}
      </div>

      {/* 预警列表 */}
      {allAlerts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {allAlerts.map((alert, index) => (
            <AlertItem
              key={`${alert.type}-${index}`}
              type={alert.type}
              severity={alert.severity}
              message={alert.message}
              suggestedAction={alert.suggestedAction}
              timestamp={alert.timestamp}
              onAcknowledge={() => {
                // 处理确认
                if (onAlertClick) {
                  onAlertClick(alert);
                }
              }}
              onDismiss={() => {
                // 处理忽略
                if (alert.source === 'risk') {
                  setRiskAlerts(prev => prev.filter((_, i) => i !== index));
                } else {
                  setEmotionalAlerts(prev => prev.filter((_, i) => i !== index));
                }
              }}
            />
          ))}
        </div>
      )}

      {/* 底部提示 */}
      <div className="text-xs text-muted-foreground mt-4 text-center">
        预警基于 AI 模型预测，仅供参考
      </div>
    </div>
  );
}

export default RiskAlertPanel;
