/**
 * useTradingViewWidget - TradingView Widget 加载 Hook
 * 
 * 从 RiskControl 迁移，适配 Echo 投资模块
 */

import { useRef, useEffect, useState, useCallback } from 'react';

interface UseTradingViewWidgetOptions {
  /** TradingView 脚本 URL */
  scriptUrl: string;
  /** Widget 配置对象 */
  config: Record<string, unknown>;
  /** Widget 高度 */
  height?: number;
}

interface UseTradingViewWidgetReturn {
  /** 容器 ref */
  containerRef: React.RefObject<HTMLDivElement>;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 重新加载 */
  reload: () => void;
}

/**
 * TradingView Widget 加载 Hook
 * 
 * @example
 * ```tsx
 * const { containerRef, isLoading, error } = useTradingViewWidget({
 *   scriptUrl: TRADINGVIEW_SCRIPTS.economicCalendar,
 *   config: ECONOMIC_CALENDAR_CONFIG,
 *   height: 600,
 * });
 * ```
 */
export function useTradingViewWidget({
  scriptUrl,
  config,
  height = 600,
}: UseTradingViewWidgetOptions): UseTradingViewWidgetReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadWidget = useCallback(() => {
    if (!containerRef.current) return;

    // 防止重复加载
    if (containerRef.current.dataset.loaded === 'true') {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 清空容器
      containerRef.current.innerHTML = '';

      // 创建 Widget 容器
      const widgetContainer = document.createElement('div');
      widgetContainer.className = 'tradingview-widget-container__widget';
      widgetContainer.style.height = `${height}px`;
      widgetContainer.style.width = '100%';

      // 创建脚本元素
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.type = 'text/javascript';
      script.innerHTML = JSON.stringify({
        ...config,
        height,
        container_id: widgetContainer.id || undefined,
      });

      // 监听加载完成
      script.onload = () => {
        setIsLoading(false);
        if (containerRef.current) {
          containerRef.current.dataset.loaded = 'true';
        }
      };

      script.onerror = () => {
        setError(new Error('TradingView Widget 加载失败'));
        setIsLoading(false);
      };

      // 添加到容器
      containerRef.current.appendChild(widgetContainer);
      containerRef.current.appendChild(script);

      // 设置超时
      const timeout = setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
        }
      }, 10000);

      return () => clearTimeout(timeout);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载失败'));
      setIsLoading(false);
    }
  }, [scriptUrl, config, height, isLoading]);

  const reload = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      delete containerRef.current.dataset.loaded;
    }
    loadWidget();
  }, [loadWidget]);

  useEffect(() => {
    loadWidget();
  }, [loadWidget]);

  return {
    containerRef,
    isLoading,
    error,
    reload,
  };
}

export default useTradingViewWidget;
