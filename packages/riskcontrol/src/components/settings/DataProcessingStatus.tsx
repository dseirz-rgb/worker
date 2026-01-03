import React from 'react';
import { 
  CheckCircle, 
  Clock, 
  CloudDownload, 
  Database, 
  FileText, 
  RefreshCw, 
  RotateCw, 
  AlertTriangle,
  Loader2,
  Server
} from 'lucide-react';
import { Button } from '../ui';

interface DataProcessingStatusProps {
  lastUpdate: Date | null;
  status: 'idle' | 'processing' | 'success' | 'error' | 'skipped';
  statusMessage: string;
  progress: number;
  onSync: () => void;
  onForceRefresh: () => void;
  isSyncing: boolean;
}

export function DataProcessingStatus({
  lastUpdate,
  status,
  statusMessage,
  progress,
  onSync,
  onForceRefresh,
  isSyncing
}: DataProcessingStatusProps) {
  
  // Determine active step based on progress
  const getActiveStep = (progress: number) => {
    if (progress <= 0) return 0;
    if (progress < 50) return 1; // Requesting/Waiting
    if (progress < 70) return 2; // Parsing
    if (progress < 100) return 3; // Syncing
    return 4; // Complete
  };

  const activeStep = getActiveStep(progress);

  const steps = [
    { id: 1, label: '获取数据', icon: CloudDownload, description: '从 IBKR 获取最新报表' },
    { id: 2, label: '解析处理', icon: FileText, description: '解析 XML 并计算指标' },
    { id: 3, label: '云端同步', icon: Database, description: '更新 Supabase 数据库' },
    { id: 4, label: '完成更新', icon: CheckCircle, description: '刷新本地缓存' },
  ];

  return (
    <div className="space-y-6">
      {/* 状态概览卡片 */}
      <div className="p-5 bg-bg-tertiary rounded-xl border border-border">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${status === 'processing' ? 'bg-primary/20 text-primary animate-pulse' : 'bg-bg-secondary text-text-secondary'}`}>
              <Server size={24} />
            </div>
            <div>
              <h3 className="text-base font-medium text-text-primary">数据处理中心</h3>
              <p className="text-xs text-text-muted mt-0.5">
                {status === 'processing' ? '正在同步数据...' : '系统数据状态监控'}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xs text-text-muted mb-1">上次更新</div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
              <Clock size={14} className="text-text-secondary" />
              {lastUpdate ? lastUpdate.toLocaleString('zh-CN') : '暂无记录'}
            </div>
          </div>
        </div>

        {/* 进度流程图 */}
        <div className="relative py-4 px-2">
          {/* 连接线 */}
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-bg-secondary -translate-y-1/2 z-0" />
          <div 
            className="absolute top-1/2 left-0 h-0.5 bg-primary transition-all duration-500 -translate-y-1/2 z-0" 
            style={{ width: `${Math.max(0, (progress / 100) * 100)}%` }}
          />

          <div className="relative z-10 flex justify-between">
            {steps.map((step, index) => {
              const isActive = activeStep >= step.id;
              const isCurrent = activeStep === step.id;
              const isPending = activeStep < step.id;

              return (
                <div key={step.id} className="flex flex-col items-center gap-2 group w-20">
                  <div 
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                      ${isActive 
                        ? 'bg-primary border-primary text-primary-foreground shadow-[0_0_10px_rgba(var(--primary),0.3)]' 
                        : 'bg-bg-card border-border text-text-muted'
                      }
                      ${isCurrent && status === 'processing' ? 'animate-bounce' : ''}
                    `}
                  >
                    <step.icon size={18} className={isActive ? 'text-primary-foreground' : 'text-text-muted'} />
                  </div>
                  <div className="text-center w-full">
                    <div className={`text-xs font-medium transition-colors ${isActive ? 'text-primary' : 'text-text-secondary'}`}>
                      {step.label}
                    </div>
                    {/* Tooltip-like description on hover could go here, but keeping it simple for now */}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 详细状态信息 */}
        <div className="mt-6 p-3 bg-bg-secondary/50 rounded-lg border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-secondary">处理详情</span>
            <span className="text-xs font-mono text-primary">{progress}%</span>
          </div>
          
          {/* 进度条 */}
          <div className="w-full h-1.5 bg-bg-secondary rounded-full overflow-hidden mb-2">
            <div 
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="flex items-center gap-2 text-xs">
            {status === 'processing' && <Loader2 size={12} className="animate-spin text-primary" />}
            {status === 'success' && <CheckCircle size={12} className="text-accent-green" />}
            {status === 'error' && <AlertTriangle size={12} className="text-accent-red" />}
            {status === 'skipped' && <AlertTriangle size={12} className="text-accent-yellow" />}
            
            <span className={`
              ${status === 'success' ? 'text-accent-green' : ''}
              ${status === 'error' ? 'text-accent-red' : ''}
              ${status === 'skipped' ? 'text-accent-yellow' : 'text-text-muted'}
            `}>
              {statusMessage || '准备就绪'}
            </span>
          </div>
        </div>
      </div>

      {/* 操作按钮区 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          variant="primary"
          className="w-full h-10 flex items-center justify-center"
          onClick={onSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              正在同步...
            </>
          ) : (
            <>
              <RefreshCw size={16} className="mr-2" />
              立即同步数据
            </>
          )}
        </Button>

        <Button
          variant="danger"
          className="w-full h-10 flex items-center justify-center"
          onClick={onForceRefresh}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              处理中...
            </>
          ) : (
            <>
              <RotateCw size={16} className="mr-2" />
              强制完全刷新
            </>
          )}
        </Button>
      </div>

      <div className="text-xs text-text-muted bg-bg-tertiary p-3 rounded-lg border border-border/50">
        <h4 className="font-medium text-text-secondary mb-1">说明：</h4>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>立即同步：</strong> 智能增量更新，只获取最新的交易和净值变化，速度较快。</li>
          <li><strong>强制完全刷新：</strong> 将清理所有本地和云端的 IBKR 历史记录并重新完整导入，耗时较长，仅在数据出现异常时使用。</li>
        </ul>
      </div>
    </div>
  );
}
