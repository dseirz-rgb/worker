/**
 * LiveQuoteCard - 实时行情卡片组件
 * Feature: realtime-market-platform
 * 
 * 显示实时价格、涨跌幅、涨跌金额
 * 实现涨跌颜色区分和价格变动闪烁动画
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import type { LiveQuote } from '../../services/realtimeMarketService';

// ============ 类型定义 ============

export interface LiveQuoteCardProps {
  quote: LiveQuote;
  showVolume?: boolean;
  showHighLow?: boolean;
  compact?: boolean;
  onClick?: () => void;
  className?: string;
}

// ============ 组件实现 ============

export function LiveQuoteCard({
  quote,
  showVolume = false,
  showHighLow = false,
  compact = false,
  onClick,
  className,
}: LiveQuoteCardProps) {
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashDirection, setFlashDirection] = useState<'up' | 'down' | null>(null);
  const prevPriceRef = useRef<number>(quote.price);

  // 价格变动闪烁效果
  useEffect(() => {
    if (quote.price !== prevPriceRef.current) {
      const direction = quote.price > prevPriceRef.current ? 'up' : 'down';
      setFlashDirection(direction);
      setIsFlashing(true);
      
      const timer = setTimeout(() => {
        setIsFlashing(false);
        setFlashDirection(null);
      }, 500);
      
      prevPriceRef.current = quote.price;
      
      return () => clearTimeout(timer);
    }
  }, [quote.price]);

  // 计算涨跌金额
  const priceChange = quote.price - quote.previousClose;
  const isPositive = priceChange >= 0;

  // 格式化价格
  const formatPrice = (price: number) => {
    if (price >= 1000) {
      return price.toFixed(2);
    } else if (price >= 100) {
      return price.toFixed(2);
    } else if (price >= 1) {
      return price.toFixed(2);
    } else {
      return price.toFixed(4);
    }
  };

  // 格式化涨跌幅
  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  // 格式化涨跌金额
  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${formatPrice(change)}`;
  };

  // 格式化成交量
  const formatVolume = (volume: number) => {
    if (volume >= 1e9) {
      return `${(volume / 1e9).toFixed(2)}B`;
    } else if (volume >= 1e6) {
      return `${(volume / 1e6).toFixed(2)}M`;
    } else if (volume >= 1e3) {
      return `${(volume / 1e3).toFixed(2)}K`;
    }
    return volume.toString();
  };

  // 颜色类名
  const colorClass = isPositive ? 'text-green-500' : 'text-red-500';
  const bgColorClass = isPositive ? 'bg-green-500/10' : 'bg-red-500/10';

  // 闪烁类名
  const flashClass = isFlashing
    ? flashDirection === 'up'
      ? 'animate-flash-green'
      : 'animate-flash-red'
    : '';

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors',
          flashClass,
          className
        )}
        onClick={onClick}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{quote.ticker}</span>
          {quote.isStale && (
            <span className="text-xs text-muted-foreground">(延迟)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('font-mono text-sm', flashClass)}>
            {formatPrice(quote.price)}
          </span>
          <span className={cn('text-xs', colorClass)}>
            {formatPercent(quote.changePercent)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'p-4 rounded-lg border bg-card cursor-pointer hover:shadow-md transition-all',
        flashClass,
        className
      )}
      onClick={onClick}
    >
      {/* 头部：股票代码和状态 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">{quote.ticker}</span>
          <span className={cn('text-xs px-1.5 py-0.5 rounded', bgColorClass, colorClass)}>
            {quote.source}
          </span>
        </div>
        {quote.isStale && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            数据延迟
          </span>
        )}
      </div>

      {/* 价格区域 */}
      <div className="flex items-baseline gap-3 mb-2">
        <span className={cn('text-2xl font-bold font-mono', flashClass)}>
          {formatPrice(quote.price)}
        </span>
        <div className={cn('flex flex-col', colorClass)}>
          <span className="text-sm font-medium">
            {formatChange(priceChange)}
          </span>
          <span className="text-sm">
            {formatPercent(quote.changePercent)}
          </span>
        </div>
      </div>

      {/* 额外信息 */}
      {(showVolume || showHighLow) && (
        <div className="flex gap-4 text-xs text-muted-foreground mt-2 pt-2 border-t">
          {showVolume && quote.volume !== undefined && (
            <div>
              <span className="text-muted-foreground/70">成交量: </span>
              <span>{formatVolume(quote.volume)}</span>
            </div>
          )}
          {showHighLow && quote.high !== undefined && quote.low !== undefined && (
            <>
              <div>
                <span className="text-muted-foreground/70">最高: </span>
                <span className="text-green-500">{formatPrice(quote.high)}</span>
              </div>
              <div>
                <span className="text-muted-foreground/70">最低: </span>
                <span className="text-red-500">{formatPrice(quote.low)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* 更新时间 */}
      <div className="text-xs text-muted-foreground mt-2">
        更新于 {new Date(quote.timestamp).toLocaleTimeString('zh-CN')}
      </div>
    </div>
  );
}

// ============ 导出 ============

export default LiveQuoteCard;
