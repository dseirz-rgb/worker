/**
 * TradingViewWidget - 通用 TradingView 嵌入式组件
 * 
 * 从 RiskControl 迁移，使用 HeroUI 组件
 * 
 * **Validates: Requirements 4.1**
 */

import React, { memo } from 'react';
import { Card, CardBody, Spinner, Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTradingViewWidget } from '@/hooks/useTradingViewWidget';

interface TradingViewWidgetProps {
  /** Widget 标题 */
  title?: string;
  /** TradingView 脚本 URL */
  scriptUrl: string;
  /** Widget 配置对象 */
  config: Record<string, unknown>;
  /** Widget 高度 (px) */
  height?: number;
  /** 额外 CSS 类名 */
  className?: string;
  /** 标题图标 */
  icon?: React.ReactNode;
}

/**
 * 通用 TradingView Widget 组件
 */
function TradingViewWidgetComponent({
  title,
  scriptUrl,
  config,
  height = 600,
  className,
  icon,
}: TradingViewWidgetProps) {
  const { containerRef, isLoading, error, reload } = useTradingViewWidget({
    scriptUrl,
    config,
    height,
  });

  return (
    <div className={`w-full ${className || ''}`}>
      {/* 标题 */}
      {title && (
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          {icon}
          {title}
        </h3>
      )}

      {/* Widget 容器 */}
      <Card className="bg-content1/50 backdrop-blur-sm">
        <CardBody className="p-0 relative" style={{ minHeight: height }}>
          {/* 加载状态 */}
          {isLoading && (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-background/80 z-10"
              style={{ height }}
            >
              <div className="flex flex-col items-center gap-3">
                <Spinner size="lg" color="primary" />
                <span className="text-sm text-foreground/50">加载中...</span>
              </div>
            </div>
          )}

          {/* 错误状态 */}
          {error && (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-background/80 z-10"
              style={{ height }}
            >
              <div className="flex flex-col items-center gap-4 text-center px-4">
                <Icon icon="mdi:alert-circle" className="text-5xl text-danger" />
                <div>
                  <p className="mb-1">加载失败</p>
                  <p className="text-sm text-foreground/50 mb-4">{error.message}</p>
                </div>
                <Button
                  color="primary"
                  variant="flat"
                  startContent={<Icon icon="mdi:refresh" />}
                  onPress={reload}
                >
                  重试
                </Button>
              </div>
            </div>
          )}

          {/* TradingView Widget 挂载点 */}
          <div
            ref={containerRef}
            className="tradingview-widget-container__widget"
            style={{ height, width: '100%' }}
          />
        </CardBody>
      </Card>
    </div>
  );
}

export const TradingViewWidget = memo(TradingViewWidgetComponent);
export default TradingViewWidget;
