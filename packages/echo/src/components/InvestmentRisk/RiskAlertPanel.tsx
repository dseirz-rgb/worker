/**
 * RiskAlertPanel - 风险预警面板组件 (HeroUI 版本)
 * 
 * 显示最新风险预警和建议操作。
 * 从 RiskControl 移植并转换为 HeroUI 组件。
 */

import React, { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Button, Chip, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';

// ============ 类型定义 ============

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface RiskAlert {
  type: string;
  severity: AlertSeverity;
  message: string;
  suggestedAction?: string;
  timestamp: Date;
  source: 'risk' | 'emotional';
}

export interface RiskAlertPanelProps {
  maxAlerts?: number;
  showEmotionalAlerts?: boolean;
  onAlertClick?: (alert: RiskAlert) => void;
  className?: string;
}

// ============ 辅助函数 ============

function getSeverityColor(severity: AlertSeverity): 'primary' | 'warning' | 'danger' {
  switch (severity) {
    case 'info': return 'primary';
    case 'warning': return 'warning';
    case 'critical': return 'danger';
    default: return 'primary';
  }
}

function getSeverityLabel(severity: AlertSeverity): string {
  switch (severity) {
    case 'info': return '提示';
    case 'warning': return '警告';
    case 'critical': return '严重';
    default: return '未知';
  }
}

function getAlertTypeLabel(type: string): string {
  switch (type) {
    case 'drawdown_warning': return '回撤预警';
    case 'regime_change': return '趋势转换';
    case 'volatility_spike': return '波动率异常';
    case 'revenge_trading': return '报复性交易';
    case 'overtrading': return '过度交易';
    case 'panic_selling': return '恐慌性卖出';
    case 'fomo_buying': return 'FOMO 买入';
    case 'concentration': return '持仓集中';
    case 'market_volatility': return '市场波动';
    default: return '风险预警';
  }
}

function getAlertIcon(type: string): string {
  switch (type) {
    case 'drawdown_warning': return 'mdi:trending-down';
    case 'regime_change': return 'mdi:swap-horizontal';
    case 'volatility_spike': return 'mdi:chart-line-variant';
    case 'revenge_trading': return 'mdi:emoticon-angry';
    case 'overtrading': return 'mdi:speedometer';
    case 'panic_selling': return 'mdi:emoticon-sad';
    case 'fomo_buying': return 'mdi:emoticon-excited';
    case 'concentration': return 'mdi:chart-pie';
    case 'market_volatility': return 'mdi:pulse';
    default: return 'mdi:alert-circle';
  }
}

// ============ Mock 数据 ============

function generateMockAlerts(): RiskAlert[] {
  return [
    {
      type: 'concentration',
      severity: 'warning',
      message: '持仓集中度偏高，单一标的权重超过 15%',
      suggestedAction: '建议分散投资，降低单一标的权重至 10% 以下',
      timestamp: new Date(),
      source: 'risk',
    },
    {
      type: 'market_volatility',
      severity: 'info',
      message: 'VIX 指数上涨，市场波动率上升',
      suggestedAction: '建议降低杠杆，保持谨慎',
      timestamp: new Date(Date.now() - 3600000),
      source: 'risk',
    },
  ];
}

// ============ 子组件 ============

interface AlertItemProps {
  alert: RiskAlert;
  onDismiss?: () => void;
  onAcknowledge?: () => void;
}

function AlertItem({ alert, onDismiss, onAcknowledge }: AlertItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const color = getSeverityColor(alert.severity);
  
  const bgColorClass = {
    primary: 'bg-primary/10 border-primary/30',
    warning: 'bg-warning/10 border-warning/30',
    danger: 'bg-danger/10 border-danger/30',
  }[color];
  
  return (
    <div 
      className={`p-3 rounded-lg border transition-all cursor-pointer ${bgColorClass} ${isExpanded ? 'ring-1 ring-current' : ''}`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* 头部 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Chip size="sm" color={color} variant="flat">
            {getSeverityLabel(alert.severity)}
          </Chip>
          <span className="text-xs text-foreground/60">
            {getAlertTypeLabel(alert.type)}
          </span>
        </div>
        <span className="text-xs text-foreground/50">
          {alert.timestamp.toLocaleTimeString('zh-CN')}
        </span>
      </div>
      
      {/* 消息 */}
      <div className="flex items-start gap-2 mt-2">
        <Icon icon={getAlertIcon(alert.type)} className={`text-lg text-${color} flex-shrink-0`} />
        <p className="text-sm">{alert.message}</p>
      </div>
      
      {/* 展开内容 */}
      {isExpanded && alert.suggestedAction && (
        <div className="mt-3 pt-3 border-t border-current/10">
          <div className="text-xs text-foreground/60 mb-1">建议操作</div>
          <p className="text-sm">{alert.suggestedAction}</p>
          
          {/* 操作按钮 */}
          <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
            {onAcknowledge && (
              <Button
                size="sm"
                color="primary"
                variant="flat"
                onPress={() => onAcknowledge()}
              >
                已知悉
              </Button>
            )}
            {onDismiss && (
              <Button
                size="sm"
                variant="flat"
                onPress={() => onDismiss()}
              >
                忽略
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8 text-foreground/60">
      <Icon icon="mdi:check-circle" className="text-4xl text-success mb-2 mx-auto" />
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
  className = '',
}: RiskAlertPanelProps) {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAlerts() {
      setIsLoading(true);
      try {
        // 模拟 API 调用
        await new Promise(resolve => setTimeout(resolve, 300));
        setAlerts(generateMockAlerts());
      } catch (error) {
        console.error('Failed to load alerts:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadAlerts();
  }, [showEmotionalAlerts]);

  const displayAlerts = alerts.slice(0, maxAlerts);

  if (isLoading) {
    return (
      <Card className={`bg-content1/50 backdrop-blur-sm ${className}`}>
        <CardBody className="flex items-center justify-center h-32">
          <Spinner size="lg" />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className={`bg-content1/50 backdrop-blur-sm ${className}`}>
      <CardHeader className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:alert-circle" className="text-xl text-danger" />
          <h3 className="font-semibold">风险预警</h3>
        </div>
        {displayAlerts.length > 0 && (
          <Chip 
            size="sm" 
            color={displayAlerts.some(a => a.severity === 'critical') ? 'danger' : 'warning'}
            variant="flat"
          >
            {displayAlerts.length} 条预警
          </Chip>
        )}
      </CardHeader>
      <CardBody>
        {displayAlerts.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {displayAlerts.map((alert, index) => (
              <AlertItem
                key={`${alert.type}-${index}`}
                alert={alert}
                onAcknowledge={() => {
                  if (onAlertClick) {
                    onAlertClick(alert);
                  }
                }}
                onDismiss={() => {
                  setAlerts(prev => prev.filter((_, i) => i !== index));
                }}
              />
            ))}
          </div>
        )}

        {/* 底部提示 */}
        <div className="text-xs text-foreground/50 mt-4 text-center">
          预警基于 AI 模型预测，仅供参考
        </div>
      </CardBody>
    </Card>
  );
}

export default RiskAlertPanel;
