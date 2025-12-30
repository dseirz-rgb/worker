/**
 * 同步状态指示器组件
 * 显示当前同步状态，可用于导航栏或状态栏
 */

import { useSync } from '../../hooks/useSync';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface SyncStatusIndicatorProps {
  /** 是否显示文本 */
  showText?: boolean;
  /** 点击时触发同步 */
  onClick?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 同步状态指示器
 */
export function SyncStatusIndicator({
  showText = false,
  onClick,
  className = '',
}: SyncStatusIndicatorProps) {
  const { status, isConfigured, sync, queueLength } = useSync();

  // 如果未配置，不显示
  if (!isConfigured) {
    return null;
  }

  // 处理点击
  const handleClick = async () => {
    if (onClick) {
      onClick();
    } else if (status.status !== 'syncing') {
      await sync();
    }
  };

  // 获取图标
  const getIcon = () => {
    switch (status.status) {
      case 'syncing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'conflict':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'offline':
        return <CloudOff className="h-4 w-4 text-gray-400" />;
      default:
        if (queueLength > 0) {
          return <RefreshCw className="h-4 w-4 text-orange-500" />;
        }
        return <Cloud className="h-4 w-4 text-gray-400" />;
    }
  };

  // 获取状态文本
  const getStatusText = () => {
    switch (status.status) {
      case 'syncing':
        return '同步中...';
      case 'success':
        return '已同步';
      case 'error':
        return '同步失败';
      case 'conflict':
        return `${status.conflicts} 个冲突`;
      case 'offline':
        return '离线';
      default:
        if (queueLength > 0) {
          return `${queueLength} 待同步`;
        }
        return '已同步';
    }
  };

  // 获取提示文本
  const getTooltipText = () => {
    const parts: string[] = [];
    
    parts.push(getStatusText());
    
    if (status.lastSyncAt) {
      const lastSync = new Date(status.lastSyncAt);
      parts.push(`上次同步: ${lastSync.toLocaleString()}`);
    }
    
    if (queueLength > 0) {
      parts.push(`${queueLength} 个待同步项`);
    }
    
    if (status.conflicts > 0) {
      parts.push(`${status.conflicts} 个冲突需要解决`);
    }
    
    if (!status.isOnline) {
      parts.push('当前离线，变更将在重新连接后同步');
    }
    
    return parts.join('\n');
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            disabled={status.status === 'syncing'}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded-md
              hover:bg-muted/50 transition-colors
              disabled:cursor-not-allowed
              ${className}
            `}
          >
            {getIcon()}
            {showText && (
              <span className="text-xs text-muted-foreground">
                {getStatusText()}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="whitespace-pre-line text-xs">{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default SyncStatusIndicator;
