/**
 * 全局服务状态提示横幅
 * 当后端服务不可用时显示提示，不阻塞用户操作
 */

import { useState, useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';

interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  message?: string;
  services?: {
    supabase?: { status: 'up' | 'down' };
    lightrag?: { status: 'up' | 'down' | 'degraded' };
  };
}

const STATUS_CHECK_INTERVAL = 60000; // 1 分钟检查一次
const INITIAL_CHECK_DELAY = 3000; // 启动后 3 秒检查

export function ServiceStatusBanner() {
  const [status, setStatus] = useState<ServiceStatus>({ status: 'unknown' });
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      // 尝试调用后端健康检查
      const response = await fetch('/api/v1/health', {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        setStatus({ status: 'unhealthy', message: '服务暂时不可用' });
        setVisible(true);
        return;
      }

      const data = await response.json();
      
      if (data.status === 'healthy') {
        setStatus({ status: 'healthy' });
        setVisible(false);
      } else if (data.status === 'degraded') {
        setStatus({
          status: 'degraded',
          message: '部分服务降级运行',
          services: data.services,
        });
        setVisible(true);
      } else {
        setStatus({
          status: 'unhealthy',
          message: '服务暂时不可用',
          services: data.services,
        });
        setVisible(true);
      }
    } catch (error) {
      // 网络错误或超时 - 可能是后端完全不可用
      console.warn('[ServiceStatus] 健康检查失败:', error);
      setStatus({ status: 'unknown', message: '无法连接服务器' });
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    // 延迟首次检查，避免启动时的瞬时错误
    const initialTimer = setTimeout(checkStatus, INITIAL_CHECK_DELAY);
    
    // 定期检查
    const intervalTimer = setInterval(checkStatus, STATUS_CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [checkStatus]);

  // 用户关闭后，5 分钟内不再显示
  const handleDismiss = () => {
    setDismissed(true);
    setTimeout(() => setDismissed(false), 5 * 60 * 1000);
  };

  // 不显示的情况
  if (!visible || dismissed || status.status === 'healthy') {
    return null;
  }

  const bgColor = status.status === 'degraded' 
    ? 'bg-warning/90' 
    : 'bg-danger/90';
  
  const icon = status.status === 'degraded'
    ? 'mdi:alert-circle-outline'
    : 'mdi:cloud-off-outline';

  return (
    <div className={`${bgColor} text-white px-4 py-2 text-sm flex items-center justify-between gap-2 backdrop-blur-sm`}>
      <div className="flex items-center gap-2">
        <Icon icon={icon} className="text-lg flex-shrink-0" />
        <span>{status.message || '服务状态异常'}</span>
        {status.services?.supabase?.status === 'down' && (
          <span className="text-xs opacity-80">（数据库离线）</span>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="p-1 hover:bg-white/20 rounded transition-colors"
        aria-label="关闭提示"
      >
        <Icon icon="mdi:close" className="text-lg" />
      </button>
    </div>
  );
}

export default ServiceStatusBanner;
