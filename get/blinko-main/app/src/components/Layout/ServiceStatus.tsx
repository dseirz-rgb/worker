/**
 * 服务状态指示器
 * 通过统一 API 网关显示所有服务的运行状态
 */

import React from 'react';
import { Tooltip, Spinner } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { useTranslation } from 'react-i18next';
import { useAllServiceStatuses, useRefreshServiceStatus } from '@/hooks/useServiceStatus';
import type { ServiceStatus as ServiceStatusType } from '@/lib/gateway';

// 状态映射：将 gateway 状态映射到 UI 状态
type UIStatus = 'online' | 'offline' | 'checking';

const mapStatus = (status: ServiceStatusType['status']): UIStatus => {
  switch (status) {
    case 'healthy': return 'online';
    case 'unhealthy': return 'offline';
    default: return 'checking';
  }
};

export const ServiceStatus: React.FC = () => {
  const { t } = useTranslation();
  const { data: services, isLoading, isRefetching } = useAllServiceStatuses();
  const refreshMutation = useRefreshServiceStatus();

  // 计算整体状态（services 现在是数组）
  const anyChecking = isLoading || isRefetching;
  const allOnline = services.length > 0 && services.every(s => s.status === 'healthy');
  const allOffline = services.length > 0 && services.every(s => s.status === 'unhealthy');

  // 状态颜色
  const getStatusColor = (status: UIStatus) => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'offline': return 'text-red-500';
      default: return 'text-yellow-500';
    }
  };

  // 状态背景色
  const getStatusBgColor = (status: UIStatus) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  // 状态文本
  const getStatusText = (status: UIStatus, latency?: number) => {
    switch (status) {
      case 'online': return latency ? `${t('running')} (${latency}ms)` : t('running');
      case 'offline': return t('offline');
      default: return t('checking');
    }
  };

  // 状态图标
  const getStatusIcon = () => {
    if (anyChecking) return <Spinner size="sm" className="w-3 h-3" />;
    if (allOnline) return <Icon icon="mdi:check-circle" className="text-green-500" width={16} height={16} />;
    if (allOffline) return <Icon icon="mdi:close-circle" className="text-red-500" width={16} height={16} />;
    return <Icon icon="mdi:alert-circle" className="text-yellow-500" width={16} height={16} />;
  };

  // 服务图标
  const getServiceIcon = (name: string) => {
    switch (name) {
      case 'seekdb': return 'mdi:database-search';
      case 'janitor': return 'mdi:broom';
      case 'khoj': return 'mdi:robot-outline';
      case 'paperless': return 'mdi:file-document-outline';
      default: return 'mdi:server';
    }
  };

  // 处理刷新
  const handleRefresh = () => {
    refreshMutation.mutate(undefined);
  };

  // Tooltip 内容
  const tooltipContent = (
    <div className="p-2 space-y-1">
      <div className="text-xs font-semibold mb-2">{t('service-status')}</div>
      {services.map(service => {
        const uiStatus = mapStatus(service.status);
        return (
          <div key={service.name} className="flex items-center gap-2 text-xs">
            <Icon icon={getServiceIcon(service.name)} className="text-default-500" width={14} height={14} />
            <span className={`w-2 h-2 rounded-full ${getStatusBgColor(uiStatus)}`} />
            <span className="flex-1">{service.displayName}</span>
            <span className={getStatusColor(uiStatus)}>
              {getStatusText(uiStatus, service.latency)}
            </span>
          </div>
        );
      })}
      {services.some(s => s.error) && (
        <div className="text-xs text-red-400 mt-2 pt-2 border-t border-default-200">
          {services.filter(s => s.error).map(s => (
            <div key={s.name}>{s.displayName}: {s.error}</div>
          ))}
        </div>
      )}
      <div className="text-xs text-default-400 mt-2 pt-2 border-t border-default-200">
        {t('refresh')}
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} placement="bottom">
      <div 
        className="flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer hover:bg-hover transition-colors"
        onClick={handleRefresh}
      >
        {getStatusIcon()}
        <span className="text-xs text-default-500 hidden md:inline">
          {anyChecking ? t('services-checking') : 
           allOnline ? t('services-online') : 
           allOffline ? t('services-offline') : 
           t('services-partial')}
        </span>
      </div>
    </Tooltip>
  );
};
