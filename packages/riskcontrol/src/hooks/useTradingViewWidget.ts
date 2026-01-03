/**
 * useTradingViewWidget - TradingView Widget 生命周期管理 Hook
 * 
 * 参考: https://github.com/Open-Dev-Society/OpenStock/blob/main/hooks/useTradingViewWidget.tsx
 * 基于 OpenStock 实现重写，适配 Vite + React 项目
 * 
 * 功能:
 * - 动态加载 TradingView 脚本
 * - 防止重复加载
 * - 组件卸载时清理资源
 */

import { useEffect, useRef, useState } from 'react';

interface UseTradingViewWidgetOptions {
  /** TradingView 脚本 URL */
  scriptUrl: string;
  /** Widget 配置对象 */
  config: Record<string, unknown>;
  /** Widget 高度 (px) */
  height?: number;
}

interface UseTradingViewWidgetReturn {
  /** 容器 ref，绑定到 DOM 元素 */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 加载错误 */
  error: Error | null;
}

/**
 * TradingView Widget 生命周期管理 Hook
 * 
 * @example
 * ```tsx
 * const { containerRef, isLoading, error } = useTradingViewWidget({
 *   scriptUrl: 'https://s3.tradingview.com/external-embedding/embed-widget-events.js',
 *   config: { colorTheme: 'dark', locale: 'zh_CN' },
 *   height: 600,
 * });
 * 
 * return <div ref={containerRef} />;
 * ```
 */
export function useTradingViewWidget({
  scriptUrl,
  config,
  height = 600,
}: UseTradingViewWidgetOptions): UseTradingViewWidgetReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 防止重复加载
    if (container.dataset.loaded === 'true') {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 清空容器并创建 widget 容器
      container.innerHTML = `<div class="tradingview-widget-container__widget" style="width: 100%; height: ${height}px;"></div>`;

      // 创建并配置脚本
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.type = 'text/javascript';
      script.innerHTML = JSON.stringify(config);

      // 脚本加载完成回调
      script.onload = () => {
        setIsLoading(false);
      };

      // 脚本加载失败回调
      script.onerror = () => {
        setError(new Error(`Failed to load TradingView widget: ${scriptUrl}`));
        setIsLoading(false);
      };

      // 添加脚本到容器
      container.appendChild(script);
      container.dataset.loaded = 'true';
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setIsLoading(false);
    }

    // 清理函数
    return () => {
      if (container) {
        container.innerHTML = '';
        delete container.dataset.loaded;
      }
    };
  }, [scriptUrl, JSON.stringify(config), height]);

  return { containerRef, isLoading, error };
}

export default useTradingViewWidget;
