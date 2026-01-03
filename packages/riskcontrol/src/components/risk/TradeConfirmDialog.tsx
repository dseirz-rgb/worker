/**
 * 交易确认对话框 - Trade Confirm Dialog
 * 当连败 >= 3 天时，新交易需要确认
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Shield,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface RiskWarning {
  type: string;
  message: string;
  severity: 'warning' | 'critical';
}

export interface TradeConfirmDialogProps {
  /** 是否显示对话框 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认交易回调 */
  onConfirm: () => void;
  /** 取消交易回调 */
  onCancel: () => void;
  /** 当前连败天数 */
  losingStreak?: number;
  /** 当前杠杆率 */
  currentLeverage?: number;
  /** 风险警告列表 */
  warnings?: RiskWarning[];
  /** 交易信息 */
  tradeInfo?: {
    symbol?: string;
    action?: '买入' | '卖出' | '做多' | '做空';
    amount?: string;
  };
  /** 确认方式: 'checkbox' 或 'text' */
  confirmationType?: 'checkbox' | 'text';
  /** 需要输入的确认文字 */
  confirmationText?: string;
}

export function TradeConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  losingStreak = 0,
  currentLeverage = 1.0,
  warnings = [],
  tradeInfo,
  confirmationType = 'checkbox',
  confirmationText = '我确认继续',
}: TradeConfirmDialogProps) {
  const [checkboxConfirmed, setCheckboxConfirmed] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showError, setShowError] = useState(false);

  // 重置状态当对话框打开时
  useEffect(() => {
    if (isOpen) {
      setCheckboxConfirmed(false);
      setTextInput('');
      setShowError(false);
    }
  }, [isOpen]);

  // 检查是否可以确认
  const canConfirm = confirmationType === 'checkbox' 
    ? checkboxConfirmed 
    : textInput === confirmationText;

  const handleConfirm = useCallback(() => {
    if (!canConfirm) {
      setShowError(true);
      return;
    }
    onConfirm();
  }, [canConfirm, onConfirm]);

  const handleCancel = useCallback(() => {
    onCancel();
    onClose();
  }, [onCancel, onClose]);

  // 判断是否有严重警告
  const hasCriticalWarning = warnings.some(w => w.severity === 'critical');

  // 默认警告（如果没有传入）
  const displayWarnings = warnings.length > 0 ? warnings : [
    {
      type: 'losing_streak',
      message: `您已连续亏损 ${losingStreak} 天，请谨慎操作`,
      severity: 'warning' as const,
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={cn(
          "sm:max-w-md",
          hasCriticalWarning 
            ? "border-red-500/50" 
            : "border-yellow-500/50"
        )}
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full",
              hasCriticalWarning 
                ? "bg-red-500/20" 
                : "bg-yellow-500/20"
            )}>
              <Shield 
                className={hasCriticalWarning ? "text-red-500" : "text-yellow-500"} 
                size={24} 
              />
            </div>
            <div>
              <DialogTitle className={cn(
                "text-lg",
                hasCriticalWarning ? "text-red-500" : "text-yellow-500"
              )}>
                交易风险确认
              </DialogTitle>
              <DialogDescription>
                检测到风险状态，请确认后继续
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 交易信息 */}
          {tradeInfo && (
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm text-muted-foreground mb-1">待执行交易</div>
              <div className="font-medium">
                {tradeInfo.action} {tradeInfo.symbol}
                {tradeInfo.amount && ` - ${tradeInfo.amount}`}
              </div>
            </div>
          )}

          {/* 风险状态 */}
          <div className="grid grid-cols-2 gap-3">
            <div className={cn(
              "rounded-lg p-3 border",
              losingStreak >= 5 
                ? "bg-red-500/10 border-red-500/30" 
                : losingStreak >= 3 
                ? "bg-yellow-500/10 border-yellow-500/30"
                : "bg-muted/50 border-muted"
            )}>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingDown size={14} />
                连败天数
              </div>
              <div className={cn(
                "text-xl font-bold",
                losingStreak >= 5 ? "text-red-500" : 
                losingStreak >= 3 ? "text-yellow-500" : "text-foreground"
              )}>
                {losingStreak} 天
              </div>
            </div>
            
            <div className={cn(
              "rounded-lg p-3 border",
              currentLeverage >= 2.0 
                ? "bg-red-500/10 border-red-500/30" 
                : currentLeverage >= 1.5 
                ? "bg-yellow-500/10 border-yellow-500/30"
                : "bg-muted/50 border-muted"
            )}>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <AlertTriangle size={14} />
                当前杠杆
              </div>
              <div className={cn(
                "text-xl font-bold",
                currentLeverage >= 2.0 ? "text-red-500" : 
                currentLeverage >= 1.5 ? "text-yellow-500" : "text-foreground"
              )}>
                {currentLeverage.toFixed(2)}x
              </div>
            </div>
          </div>

          {/* 警告列表 */}
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-2">
              <Info size={14} />
              风险提示
            </div>
            {displayWarnings.map((warning, index) => (
              <div 
                key={index}
                className={cn(
                  "flex items-start gap-2 p-3 rounded-lg text-sm",
                  warning.severity === 'critical'
                    ? "bg-red-500/10 border border-red-500/30"
                    : "bg-yellow-500/10 border border-yellow-500/30"
                )}
              >
                <XCircle 
                  className={cn(
                    "shrink-0 mt-0.5",
                    warning.severity === 'critical' ? "text-red-500" : "text-yellow-500"
                  )} 
                  size={16} 
                />
                <span className={
                  warning.severity === 'critical' ? "text-red-400" : "text-yellow-400"
                }>
                  {warning.message}
                </span>
              </div>
            ))}
          </div>

          {/* 确认区域 */}
          <div className={cn(
            "rounded-lg p-4 border-2 border-dashed",
            showError && !canConfirm 
              ? "border-red-500 bg-red-500/5" 
              : "border-muted"
          )}>
            {confirmationType === 'checkbox' ? (
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={checkboxConfirmed}
                  onCheckedChange={(checked) => {
                    setCheckboxConfirmed(checked === true);
                    setShowError(false);
                  }}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium">
                    我已了解当前风险状态
                  </span>
                  <p className="text-xs text-muted-foreground">
                    我理解在连续亏损期间交易可能导致更大损失，并愿意承担相应风险
                  </p>
                </div>
              </label>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  请输入 "<span className="text-yellow-500">{confirmationText}</span>" 以确认
                </label>
                <Input
                  value={textInput}
                  onChange={(e) => {
                    setTextInput(e.target.value);
                    setShowError(false);
                  }}
                  placeholder={confirmationText}
                  className={cn(
                    showError && textInput !== confirmationText && "border-red-500"
                  )}
                />
                {textInput && textInput !== confirmationText && (
                  <p className="text-xs text-red-500">
                    输入内容不匹配，请重新输入
                  </p>
                )}
              </div>
            )}
            
            {showError && !canConfirm && (
              <p className="text-xs text-red-500 mt-2">
                {confirmationType === 'checkbox' 
                  ? '请先勾选确认框' 
                  : '请输入正确的确认文字'}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="flex-1"
          >
            取消交易
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(
              "flex-1",
              canConfirm
                ? hasCriticalWarning
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-yellow-600 hover:bg-yellow-700"
                : "bg-muted text-muted-foreground"
            )}
          >
            <CheckCircle2 size={16} className="mr-1" />
            确认交易
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TradeConfirmDialog;
