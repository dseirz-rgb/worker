/**
 * 冷静期倒计时横幅 - Cooling Period Banner
 * 当触发冷静期时在页面顶部显示
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Shield,
  Pause,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CoolingPeriodBannerProps {
  /** 是否显示横幅 */
  isActive: boolean;
  /** 冷静期结束时间 (ISO string 或 Date) */
  expiresAt: string | Date;
  /** 触发原因 */
  reason: string;
  /** 严重程度 */
  severity?: 'warning' | 'critical';
  /** 熔断类型 */
  breakerType?: string;
  /** 最小化状态变化回调 */
  onMinimizeChange?: (minimized: boolean) => void;
}

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calculateTimeRemaining(expiresAt: string | Date): TimeRemaining {
  const now = new Date().getTime();
  const expiry = new Date(expiresAt).getTime();
  const total = Math.max(0, expiry - now);

  return {
    hours: Math.floor(total / (1000 * 60 * 60)),
    minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((total % (1000 * 60)) / 1000),
    total,
  };
}

function formatTimeUnit(value: number): string {
  return value.toString().padStart(2, '0');
}

export function CoolingPeriodBanner({
  isActive,
  expiresAt,
  reason,
  severity = 'warning',
  breakerType = '风控熔断',
  onMinimizeChange,
}: CoolingPeriodBannerProps) {
  const [minimized, setMinimized] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() => 
    calculateTimeRemaining(expiresAt)
  );

  // 更新倒计时
  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      const remaining = calculateTimeRemaining(expiresAt);
      setTimeRemaining(remaining);

      // 如果倒计时结束，停止更新
      if (remaining.total <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, expiresAt]);

  const handleToggleMinimize = useCallback(() => {
    setMinimized((prev) => {
      const newValue = !prev;
      onMinimizeChange?.(newValue);
      return newValue;
    });
  }, [onMinimizeChange]);

  if (!isActive) return null;

  const isCritical = severity === 'critical';
  const isExpired = timeRemaining.total <= 0;

  // 颜色配置
  const colors = isCritical
    ? {
        bg: 'bg-gradient-to-r from-red-600 to-red-500',
        bgMinimized: 'bg-red-600',
        border: 'border-red-400',
        text: 'text-white',
        accent: 'text-red-100',
        pulse: 'bg-red-400',
      }
    : {
        bg: 'bg-gradient-to-r from-amber-500 to-orange-500',
        bgMinimized: 'bg-amber-500',
        border: 'border-amber-400',
        text: 'text-white',
        accent: 'text-amber-100',
        pulse: 'bg-amber-300',
      };

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50",
        "animate-in slide-in-from-top duration-500",
        "shadow-lg",
        minimized ? colors.bgMinimized : colors.bg
      )}
    >
      {/* 最小化状态 */}
      {minimized ? (
        <div 
          className={cn(
            "flex items-center justify-between px-4 py-2 cursor-pointer",
            "hover:opacity-90 transition-opacity"
          )}
          onClick={handleToggleMinimize}
        >
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full animate-pulse", colors.pulse)} />
            <Clock size={16} className={colors.text} />
            <span className={cn("font-medium text-sm", colors.text)}>
              冷静期: {formatTimeUnit(timeRemaining.hours)}:{formatTimeUnit(timeRemaining.minutes)}:{formatTimeUnit(timeRemaining.seconds)}
            </span>
          </div>
          <ChevronDown size={18} className={colors.text} />
        </div>
      ) : (
        /* 展开状态 */
        <div className="px-4 py-3">
          {/* 顶部栏 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shield className={cn("animate-pulse", colors.text)} size={20} />
              <span className={cn("font-bold", colors.text)}>
                {breakerType} - 冷静期
              </span>
              {isCritical && (
                <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-medium">
                  严重
                </span>
              )}
            </div>
            <button
              onClick={handleToggleMinimize}
              className={cn(
                "p-1 rounded hover:bg-white/20 transition-colors",
                colors.text
              )}
              title="最小化"
            >
              <ChevronUp size={18} />
            </button>
          </div>

          {/* 主内容区 */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* 原因说明 */}
            <div className="flex items-start gap-2 flex-1">
              <AlertTriangle className={cn("shrink-0 mt-0.5", colors.accent)} size={16} />
              <p className={cn("text-sm", colors.accent)}>
                {reason}
              </p>
            </div>

            {/* 倒计时显示 */}
            <div className="flex items-center gap-3">
              {isExpired ? (
                <div className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-white/20"
                )}>
                  <Pause size={18} className={colors.text} />
                  <span className={cn("font-medium", colors.text)}>
                    冷静期已结束
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Clock size={18} className={colors.text} />
                  <span className={cn("text-sm mr-2", colors.accent)}>剩余时间:</span>
                  
                  {/* 时间数字 */}
                  <div className="flex items-center gap-1">
                    <TimeBlock value={timeRemaining.hours} label="时" colors={colors} />
                    <span className={cn("text-xl font-bold", colors.text)}>:</span>
                    <TimeBlock value={timeRemaining.minutes} label="分" colors={colors} />
                    <span className={cn("text-xl font-bold", colors.text)}>:</span>
                    <TimeBlock value={timeRemaining.seconds} label="秒" colors={colors} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 底部提示 */}
          <div className={cn(
            "mt-2 pt-2 border-t border-white/20",
            "flex items-center justify-between text-xs",
            colors.accent
          )}>
            <span>冷静期内禁止新开仓，仅允许平仓操作</span>
            <span>
              结束时间: {new Date(expiresAt).toLocaleString('zh-CN', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// 时间块组件
interface TimeBlockProps {
  value: number;
  label: string;
  colors: {
    text: string;
    accent: string;
  };
}

function TimeBlock({ value, label, colors }: TimeBlockProps) {
  return (
    <div className="flex flex-col items-center">
      <div className={cn(
        "bg-white/20 rounded px-2 py-1 min-w-[40px] text-center",
        "font-mono text-xl font-bold",
        colors.text
      )}>
        {formatTimeUnit(value)}
      </div>
      <span className={cn("text-xs mt-0.5", colors.accent)}>{label}</span>
    </div>
  );
}

export default CoolingPeriodBanner;
