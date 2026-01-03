/**
 * 杠杆熔断弹窗 - Leverage Block Modal
 * 当杠杆 > 2.0x 时显示全屏阻断弹窗
 */

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  TrendingDown,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface LeverageBlockModalProps {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 当前杠杆率 */
  currentLeverage: number;
  /** 危险阈值 */
  criticalThreshold?: number;
  /** 建议目标杠杆 */
  targetLeverage?: number;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认了解风险后的回调 */
  onAcknowledge?: () => void;
}

export function LeverageBlockModal({
  isOpen,
  currentLeverage,
  criticalThreshold = 2.0,
  targetLeverage = 1.5,
  onClose,
  onAcknowledge,
}: LeverageBlockModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [canClose, setCanClose] = useState(false);

  // 重置状态当弹窗打开时
  useEffect(() => {
    if (isOpen) {
      setAcknowledged(false);
      setCountdown(5);
      setCanClose(false);
    }
  }, [isOpen]);

  // 倒计时逻辑
  useEffect(() => {
    if (!isOpen || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanClose(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, countdown]);

  const handleAcknowledge = () => {
    setAcknowledged(true);
    onAcknowledge?.();
  };

  const handleClose = () => {
    if (acknowledged && canClose) {
      onClose();
    }
  };

  // 计算需要减仓的比例
  const reductionNeeded = currentLeverage > 0 
    ? ((currentLeverage - targetLeverage) / currentLeverage * 100).toFixed(1)
    : '0';

  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center",
        "bg-black/80 backdrop-blur-sm",
        "animate-in fade-in duration-300"
      )}
    >
      {/* 背景动画效果 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* 主弹窗内容 */}
      <div 
        className={cn(
          "relative w-full max-w-lg mx-4",
          "bg-gradient-to-b from-red-950/95 to-background/95",
          "border-2 border-red-500/50 rounded-2xl",
          "shadow-2xl shadow-red-500/20",
          "animate-in zoom-in-95 slide-in-from-bottom-4 duration-500"
        )}
      >
        {/* 顶部警告条 */}
        <div className="bg-red-500 text-white px-4 py-2 rounded-t-xl flex items-center justify-center gap-2">
          <ShieldAlert className="animate-pulse" size={20} />
          <span className="font-bold tracking-wide">风控熔断警告</span>
          <ShieldAlert className="animate-pulse" size={20} />
        </div>

        {/* 内容区域 */}
        <div className="p-6 space-y-6">
          {/* 警告图标和标题 */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/50 mb-4">
              <AlertTriangle className="text-red-500 animate-bounce" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-red-500">
              杠杆率严重超标！
            </h2>
            <p className="text-muted-foreground mt-2">
              当前杠杆已超过安全阈值，交易功能已被暂停
            </p>
          </div>

          {/* 杠杆率显示 */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground">当前杠杆率</span>
              <span className="text-3xl font-bold text-red-500">
                {currentLeverage.toFixed(2)}x
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">危险阈值</span>
              <span className="text-red-400">{criticalThreshold.toFixed(1)}x</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-muted-foreground">建议目标</span>
              <span className="text-green-400">{targetLeverage.toFixed(1)}x</span>
            </div>
            
            {/* 进度条 */}
            <div className="mt-4">
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500"
                  style={{ width: `${Math.min(currentLeverage / 3 * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1.0x</span>
                <span className="text-yellow-500">1.5x</span>
                <span className="text-red-500">2.0x</span>
                <span>3.0x</span>
              </div>
            </div>
          </div>

          {/* 降杠杆建议 */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <h3 className="font-medium text-yellow-500 flex items-center gap-2 mb-3">
              <TrendingDown size={18} />
              降杠杆建议
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <XCircle className="text-red-400 mt-0.5 shrink-0" size={16} />
                <span>
                  需要减仓约 <strong className="text-yellow-400">{reductionNeeded}%</strong> 才能降至安全水平
                </span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="text-red-400 mt-0.5 shrink-0" size={16} />
                <span>禁止任何新的买入或做空操作</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="text-red-400 mt-0.5 shrink-0" size={16} />
                <span>优先平掉亏损仓位，保留盈利仓位</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="text-green-400 mt-0.5 shrink-0" size={16} />
                <span>允许卖出/平仓操作以降低杠杆</span>
              </li>
            </ul>
          </div>

          {/* 确认按钮 */}
          <div className="space-y-3">
            {!acknowledged ? (
              <Button
                onClick={handleAcknowledge}
                className={cn(
                  "w-full h-12 text-lg font-bold",
                  "bg-red-600 hover:bg-red-700 text-white",
                  "border-2 border-red-500",
                  "transition-all duration-300"
                )}
              >
                我已了解风险
              </Button>
            ) : (
              <Button
                onClick={handleClose}
                disabled={!canClose}
                className={cn(
                  "w-full h-12 text-lg font-bold",
                  canClose 
                    ? "bg-muted hover:bg-muted/80 text-foreground"
                    : "bg-muted/50 text-muted-foreground cursor-not-allowed",
                  "transition-all duration-300"
                )}
              >
                {canClose ? (
                  "关闭并开始减仓"
                ) : (
                  `请等待 ${countdown} 秒...`
                )}
              </Button>
            )}
            
            <p className="text-xs text-center text-muted-foreground">
              此警告将被记录到风控日志中
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeverageBlockModal;
