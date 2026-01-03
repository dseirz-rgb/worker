/**
 * MarketStatusIndicator - 市场状态指示器组件
 * Feature: realtime-market-platform
 * 
 * 显示美股/港股/A股交易状态和倒计时
 * 
 * Requirements: 8.1, 8.2, 8.3
 */

import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import {
  getMarketStatus,
  getAllMarketStatus,
  formatCountdown,
  getMarketName,
  getStatusColor,
  type MarketType,
  type MarketStatusInfo,
} from '../../services/marketStatusService';

// ============ 类型定义 ============

export interface MarketStatusIndicatorProps {
  market?: MarketType;
  showAll?: boolean;
  showCountdown?: boolean;
  compact?: boolean;
  className?: string;
}

// ============ 组件实现 ============

export function MarketStatusIndicator({
  market,
  showAll = false,
  showCountdown = true,
  compact = false,
  className,
}: MarketStatusIndicatorProps) {
  const [statuses, setStatuses] = useState<MarketStatusInfo[]>([]);
  const [countdown, setCountdown] = useState<Record<MarketType, number>>({
    US: 0,
    HK: 0,
    CN: 0,
  });

  // 更新市场状态
  useEffect(() => {
    const updateStatus = () => {
      if (showAll) {
        setStatuses(getAllMarketStatus());
      } else if (market) {
        setStatuses([getMarketStatus(market)]);
      }
    };

    updateStatus();
    
    // 每分钟更新一次状态
    const statusInterval = setInterval(updateStatus, 60000);
    
    return () => clearInterval(statusInterval);
  }, [market, showAll]);

  // 更新倒计时
  useEffect(() => {
    if (!showCountdown) return;

    const updateCountdown = () => {
      const newCountdown: Record<MarketType, number> = { US: 0, HK: 0, CN: 0 };
      
      statuses.forEach(status => {
        // 每秒减少倒计时
        newCountdown[status.market] = Math.max(0, status.countdown - 1);
      });
      
      setCountdown(newCountdown);
    };

    // 初始化倒计时
    statuses.forEach(status => {
      setCountdown(prev => ({
        ...prev,
        [status.market]: status.countdown,
      }));
    });

    const countdownInterval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(countdownInterval);
  }, [statuses, showCountdown]);

  // 获取状态图标
  const getStatusIcon = (status: MarketStatusInfo) => {
    if (status.isTrading) {
      return (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      );
    }
    return <span className="h-2 w-2 rounded-full bg-gray-400"></span>;
  };

  // 渲染单个市场状态
  const renderMarketStatus = (status: MarketStatusInfo) => {
    const colorClass = getStatusColor(status.status);
    const currentCountdown = countdown[status.market] || status.countdown;

    if (compact) {
      return (
        <div
          key={status.market}
          className="flex items-center gap-2 px-2 py-1 rounded bg-muted/50"
        >
          {getStatusIcon(status)}
          <span className="text-xs font-medium">{getMarketName(status.market)}</span>
          <span className={cn('text-xs', colorClass)}>{status.statusText}</span>
        </div>
      );
    }

    return (
      <div
        key={status.market}
        className="flex items-center justify-between p-3 rounded-lg border bg-card"
      >
        <div className="flex items-center gap-3">
          {getStatusIcon(status)}
          <div>
            <div className="font-medium">{getMarketName(status.market)}</div>
            <div className={cn('text-sm', colorClass)}>{status.statusText}</div>
          </div>
        </div>
        
        {showCountdown && status.nextSession && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground">
              {status.nextSession.description}
            </div>
            <div className="font-mono text-sm">
              {formatCountdown(currentCountdown)}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (statuses.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 flex-wrap', className)}>
        {statuses.map(renderMarketStatus)}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {statuses.map(renderMarketStatus)}
    </div>
  );
}

// ============ 简化版组件 ============

export function MarketStatusBadge({ market }: { market: MarketType }) {
  const [status, setStatus] = useState<MarketStatusInfo | null>(null);

  useEffect(() => {
    const updateStatus = () => {
      setStatus(getMarketStatus(market));
    };

    updateStatus();
    const interval = setInterval(updateStatus, 60000);
    
    return () => clearInterval(interval);
  }, [market]);

  if (!status) return null;

  const colorClass = status.isTrading ? 'bg-green-500' : 'bg-gray-400';

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cn('h-1.5 w-1.5 rounded-full', colorClass)}></span>
      <span className={status.isTrading ? 'text-green-600' : 'text-muted-foreground'}>
        {status.statusText}
      </span>
    </span>
  );
}

// ============ 导出 ============

export default MarketStatusIndicator;
