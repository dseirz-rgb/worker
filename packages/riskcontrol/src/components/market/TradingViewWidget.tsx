/**
 * TradingViewWidget - 通用 TradingView 嵌入式组件
 * 
 * 参考: https://github.com/Open-Dev-Society/OpenStock/blob/main/components/TradingViewWidget.tsx
 * 基于 OpenStock 实现重写，适配本项目 UI 风格
 * 
 * 功能:
 * - 嵌入 TradingView Widget
 * - 显示加载状态
 * - 显示错误状态和重试按钮
 * - 支持深色主题
 */

import React, { memo } from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
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
 * 
 * @example
 * ```tsx
 * <TradingViewWidget
 *   title="财经日历"
 *   scriptUrl={TRADINGVIEW_SCRIPTS.economicCalendar}
 *   config={ECONOMIC_CALENDAR_CONFIG}
 *   height={600}
 * />
 * ```
 */
function TradingViewWidgetComponent({
  title,
  scriptUrl,
  config,
  height = 600,
  className,
  icon,
}: TradingViewWidgetProps) {
  const { containerRef, isLoading, error } = useTradingViewWidget({
    scriptUrl,
    config,
    height,
  });

  // 重试加载
  const handleRetry = () => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      delete containerRef.current.dataset.loaded;
      // 触发重新渲染
      window.location.reload();
    }
  };

  return (
    <div className="w-full">
      {/* 标题 */}
      {title && (
        <h3 className="font-semibold text-lg text-white mb-4 flex items-center gap-2">
          {icon}
          {title}
        </h3>
      )}

      {/* Widget 容器 */}
      <div
        className={cn(
          'tradingview-widget-container relative rounded-xl overflow-hidden',
          'bg-white/[0.02] border border-white/[0.06]',
          className
        )}
        style={{ minHeight: height }}
      >
        {/* 加载状态 */}
        {isLoading && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-[#0a0b0f]/80 z-10"
            style={{ height }}
          >
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <span className="text-sm text-white/50">加载中...</span>
            </div>
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-[#0a0b0f]/80 z-10"
            style={{ height }}
          >
            <div className="flex flex-col items-center gap-4 text-center px-4">
              <AlertTriangle className="w-12 h-12 text-red-400" />
              <div>
                <p className="text-white mb-1">加载失败</p>
                <p className="text-sm text-white/50 mb-4">{error.message}</p>
              </div>
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
              >
                <RefreshCw size={16} />
                重试
              </button>
            </div>
          </div>
        )}

        {/* TradingView Widget 挂载点 */}
        <div
          ref={containerRef}
          className="tradingview-widget-container__widget"
          style={{ height, width: '100%' }}
        />
      </div>
    </div>
  );
}

export const TradingViewWidget = memo(TradingViewWidgetComponent);
export default TradingViewWidget;
