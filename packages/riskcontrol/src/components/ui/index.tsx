import React from 'react';
import { AlertTriangle, X, CheckCircle, Info, AlertCircle } from 'lucide-react';

// 卡片组件
interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: 'green' | 'red' | 'none';
  onClick?: () => void;
}

export function Card({ children, className = '', glow = 'none', onClick }: CardProps) {
  const glowClass = glow === 'green' 
    ? 'card-glow' 
    : glow === 'red' 
      ? 'card-glow-red' 
      : '';

  return (
    <div 
      className={`bg-bg-secondary border border-border rounded-lg p-4 ${glowClass} ${className} ${onClick ? 'cursor-pointer hover:border-accent-cyan transition-colors' : ''}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// 按钮组件
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className = '',
  ...props 
}: ButtonProps) {
  const baseClass = 'font-medium rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-accent-cyan text-bg-primary hover:opacity-90',
    secondary: 'bg-bg-tertiary text-text-primary border border-border hover:border-accent-cyan',
    danger: 'bg-accent-red text-white hover:opacity-90',
    ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-tertiary',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`${baseClass} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// 输入框组件
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs text-text-secondary uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan transition-colors mono-nums ${error ? 'border-accent-red' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs text-accent-red">{error}</p>
      )}
    </div>
  );
}

// 选择框组件
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className = '', ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs text-text-secondary uppercase tracking-wider">
          {label}
        </label>
      )}
      <select
        className={`w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent-cyan transition-colors ${className}`}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// 进度条组件
interface ProgressBarProps {
  value: number;
  max?: number;
  color?: 'green' | 'red' | 'yellow' | 'cyan' | 'purple';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({ 
  value, 
  max = 100, 
  color = 'cyan', 
  showLabel = false,
  size = 'md' 
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const colorClasses = {
    green: 'bg-accent-green',
    red: 'bg-accent-red',
    yellow: 'bg-accent-yellow',
    cyan: 'bg-accent-cyan',
    purple: 'bg-accent-purple',
  };

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className="w-full">
      <div className={`w-full bg-bg-tertiary rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div 
          className={`${colorClasses[color]} ${sizeClasses[size]} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-text-muted mt-1">{percentage.toFixed(1)}%</span>
      )}
    </div>
  );
}

// 分段进度条（用于资产配置）
interface SegmentedBarProps {
  segments: { value: number; color: string; label: string }[];
}

export function SegmentedBar({ segments }: SegmentedBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="w-full">
      <div className="w-full h-3 bg-bg-tertiary rounded-full overflow-hidden flex">
        {segments.map((segment, index) => {
          const width = total > 0 ? (segment.value / total) * 100 : 0;
          return (
            <div
              key={index}
              className={`h-full transition-all duration-500`}
              style={{ 
                width: `${width}%`,
                backgroundColor: segment.color,
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-xs">
        {segments.map((segment, index) => (
          <div key={index} className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-text-secondary">{segment.label}</span>
            <span className="text-text-primary mono-nums">{segment.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 模态框组件
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  // 阻止背景滚动
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // 键盘事件处理
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
  };

  const modalContent = (
    <div 
      className="fixed top-0 left-0 right-0 bottom-0 flex items-end sm:items-center justify-center"
      style={{ zIndex: 99999 }}
    >
      {/* 背景遮罩 */}
      <div 
        className="absolute top-0 left-0 right-0 bottom-0 bg-black/85"
        onClick={onClose}
      />
      
      {/* 弹窗内容 - 移动端从底部滑入，桌面端居中 */}
      <div 
        className={`relative bg-[#0a0f1a] border border-cyan-500/30 w-full mx-0 sm:mx-4 ${sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.md} max-h-[90vh] sm:max-h-[80vh] flex flex-col rounded-t-xl sm:rounded-xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:fade-in duration-200`}
        style={{ 
          boxShadow: '0 0 50px rgba(0, 255, 255, 0.2), 0 25px 50px -12px rgba(0, 0, 0, 0.9)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 移动端拖拽指示条 */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </div>
        
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-700 bg-[#111827] rounded-t-xl flex-shrink-0">
          <h2 className="text-sm sm:text-base font-semibold text-white">{title}</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors -mr-1"
            aria-label="关闭"
            title="关闭"
          >
            <X size={20} />
          </button>
        </div>
        {/* 内容区域 - 移动端增加底部安全区 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 min-h-0 pb-safe">
          {children}
        </div>
      </div>
    </div>
  );

  // 使用 Portal 渲染到 body
  return createPortal(modalContent, document.body);
}

// 警报组件
interface AlertProps {
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  onClose?: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function Alert({ 
  type, 
  title, 
  message, 
  onClose, 
  onConfirm,
  confirmText = '确认',
  cancelText = '取消'
}: AlertProps) {
  const icons = {
    success: <CheckCircle className="text-accent-green" size={24} />,
    warning: <AlertTriangle className="text-accent-yellow" size={24} />,
    error: <AlertCircle className="text-accent-red" size={24} />,
    info: <Info className="text-accent-blue" size={24} />,
  };

  const borderColors = {
    success: 'border-l-accent-green',
    warning: 'border-l-accent-yellow',
    error: 'border-l-accent-red',
    info: 'border-l-accent-blue',
  };

  return (
    <div className={`bg-bg-secondary border border-border border-l-4 ${borderColors[type]} rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        {icons[type]}
        <div className="flex-1">
          <h3 className="font-semibold text-text-primary">{title}</h3>
          <p className="text-sm text-text-secondary mt-1">{message}</p>
          {(onClose || onConfirm) && (
            <div className="flex gap-2 mt-4">
              {onConfirm && (
                <Button variant="primary" size="sm" onClick={onConfirm}>
                  {confirmText}
                </Button>
              )}
              {onClose && (
                <Button variant="ghost" size="sm" onClick={onClose}>
                  {cancelText}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 风控警报弹窗
interface RiskAlertModalProps {
  isOpen: boolean;
  type: 'STOP_LOSS' | 'MAX_DRAWDOWN' | 'POSITION_LIMIT' | 'FOMO_WARNING' | 'UNPLANNED_TRADE' | 'SYSTEM_ERROR';
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RiskAlertModal({ 
  isOpen, 
  type, 
  title, 
  message, 
  onConfirm, 
  onCancel 
}: RiskAlertModalProps) {
  if (!isOpen) return null;

  const isCritical = type === 'STOP_LOSS' || type === 'MAX_DRAWDOWN';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className={`relative bg-bg-secondary border-2 ${isCritical ? 'border-accent-red card-glow-red' : 'border-accent-yellow'} rounded-lg w-full max-w-md overflow-hidden`}>
        {/* 扫描线动画 */}
        {isCritical && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute w-full h-px bg-accent-red/50 animate-pulse" style={{ top: '50%' }} />
          </div>
        )}
        
        <div className={`p-6 ${isCritical ? 'bg-accent-red/10' : 'bg-accent-yellow/10'}`}>
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle 
              className={`${isCritical ? 'text-accent-red animate-pulse-red' : 'text-accent-yellow'}`} 
              size={32} 
            />
            <h2 className={`text-xl font-bold ${isCritical ? 'text-accent-red' : 'text-accent-yellow'}`}>
              {title}
            </h2>
          </div>
          
          <p className="text-text-primary mb-6 leading-relaxed">{message}</p>
          
          <div className="flex gap-3">
            <Button 
              variant="danger" 
              className="flex-1"
              onClick={onConfirm}
            >
              我已了解风险，继续执行
            </Button>
            <Button 
              variant="secondary" 
              className="flex-1"
              onClick={onCancel}
            >
              取消交易
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 数字显示组件（带颜色）
interface NumberDisplayProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  colorize?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  privacyMode?: boolean;
}

export function NumberDisplay({ 
  value, 
  prefix = '', 
  suffix = '', 
  decimals = 2,
  colorize = true,
  size = 'md',
  className = '',
  privacyMode = false
}: NumberDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-3xl font-bold',
  };

  if (privacyMode) {
    return (
      <span className={`font-mono text-text-muted ${sizeClasses[size]} ${className} select-none blur-[2px]`}>
        ****
      </span>
    );
  }

  const color = colorize 
    ? value > 0 
      ? 'text-accent-green' 
      : value < 0 
        ? 'text-accent-red' 
        : 'text-text-primary'
    : 'text-text-primary';

  const formattedValue = Math.abs(value).toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const sign = value > 0 ? '+' : value < 0 ? '-' : '';

  return (
    <span className={`mono-nums ${color} ${sizeClasses[size]} ${className}`}>
      {prefix}{colorize ? sign : ''}{formattedValue}{suffix}
    </span>
  );
}

// 加载动画
export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div 
      className="border-2 border-border border-t-accent-cyan rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  );
}

// 空状态
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-text-muted mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-text-primary mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary mb-4 max-w-sm">{description}</p>
      )}
      {action}
    </div>
  );
}

// 标签组件
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variantClasses = {
    default: 'bg-bg-tertiary text-text-secondary',
    success: 'bg-accent-green/20 text-accent-green',
    warning: 'bg-accent-yellow/20 text-accent-yellow',
    danger: 'bg-accent-red/20 text-accent-red',
    info: 'bg-accent-blue/20 text-accent-blue',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}

// Tooltip 组件
interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <div className="relative group">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-bg-tertiary border border-border rounded text-xs text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-bg-tertiary" />
      </div>
    </div>
  );
}

export { Textarea } from './textarea';

