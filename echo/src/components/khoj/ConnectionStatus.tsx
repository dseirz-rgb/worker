/**
 * Khoj 连接状态指示器
 * 显示 Khoj 服务的连接状态
 */

import * as React from 'react';
import { Wifi, WifiOff, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { useKhojConnection } from '../../hooks/useKhojConnection';

interface ConnectionStatusProps {
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 是否显示刷新按钮 */
  showRefresh?: boolean;
  /** 紧凑模式 */
  compact?: boolean;
}

export function ConnectionStatus({
  showDetails = false,
  showRefresh = false,
  compact = false,
}: ConnectionStatusProps) {
  const { connected, checking, error, serverUrl, lastCheckAt, checkConnection, settings } =
    useKhojConnection();

  // 如果 Khoj 未启用，不显示
  if (!settings?.connection.enabled) {
    return null;
  }

  // 紧凑模式
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {checking ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : connected ? (
          <Wifi className="h-3 w-3 text-green-500" />
        ) : (
          <WifiOff className="h-3 w-3 text-red-500" />
        )}
        {showRefresh && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => checkConnection()}
            disabled={checking}
          >
            <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* 状态图标 */}
      <div className="flex items-center gap-1.5">
        {checking ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">检查中...</span>
          </>
        ) : connected ? (
          <>
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="text-xs text-green-600">Khoj 已连接</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-red-500" />
            <span className="text-xs text-red-600">Khoj 未连接</span>
          </>
        )}
      </div>

      {/* 详细信息 */}
      {showDetails && (
        <div className="text-xs text-muted-foreground">
          {serverUrl && <span className="mr-2">{serverUrl}</span>}
          {lastCheckAt && (
            <span>
              上次检查: {new Date(lastCheckAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* 错误信息 */}
      {error && !checking && (
        <div className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      )}

      {/* 刷新按钮 */}
      {showRefresh && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => checkConnection()}
          disabled={checking}
        >
          <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </div>
  );
}

/**
 * 连接状态徽章
 * 用于在导航栏等位置显示简洁的连接状态
 */
export function ConnectionBadge() {
  const { connected, checking, settings } = useKhojConnection();

  // 如果 Khoj 未启用，不显示
  if (!settings?.connection.enabled) {
    return null;
  }

  return (
    <div
      className={`h-2 w-2 rounded-full ${
        checking
          ? 'bg-yellow-500 animate-pulse'
          : connected
          ? 'bg-green-500'
          : 'bg-red-500'
      }`}
      title={
        checking
          ? '正在检查连接...'
          : connected
          ? 'Khoj 已连接'
          : 'Khoj 未连接'
      }
    />
  );
}

export default ConnectionStatus;
