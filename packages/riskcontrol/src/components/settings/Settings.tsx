import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Shield, 
  Server, 
  CheckCircle, 
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { Button, Input, Modal, Badge } from '../ui';
import type { AppSettings } from '../../types';
import { clearAllData } from '../../services/storage';
import { initSupabase } from '../../services/supabase';
import { syncIBKRToSupabase, getLastRefreshTime } from '../../services/ibkrFlexQuery';
import { getSupabaseClient } from '../../services/supabase';
import { DataProcessingStatus } from './DataProcessingStatus';
import { ApiStatus } from './ApiStatus';
import { Changelog } from './Changelog';
import { Architecture } from './Architecture';
import { History, Layers } from 'lucide-react';

interface SettingsProps {
  settings: AppSettings;
  onUpdate: (settings: Partial<AppSettings>) => void;
}

export function Settings({ settings, onUpdate }: SettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'risk' | 'system' | 'changelog' | 'architecture'>('risk');
  
  // 风控设置
  const [stopLoss, setStopLoss] = useState(settings.riskLimits.stopLossPercent.toString());
  const [maxDrawdown, setMaxDrawdown] = useState(settings.riskLimits.maxDrawdownPercent.toString());
  const [positionLimit, setPositionLimit] = useState(settings.riskLimits.positionLimitPercent.toString());
  const [cooldownDays, setCooldownDays] = useState(settings.riskLimits.watchlistCooldownDays.toString());
  
  // 数据年份
  const [dataYear, setDataYear] = useState(settings.dataYear || 2025);

  // Supabase 设置
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabase.url);
  const [supabaseKey, setSupabaseKey] = useState(settings.supabase.anonKey);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // IBKR 同步
  const [isSyncingIBKR, setIsSyncingIBKR] = useState(false);
  const [ibkrSyncStatus, setIbkrSyncStatus] = useState<'idle' | 'processing' | 'success' | 'error' | 'skipped'>('idle');
  const [ibkrSyncMessage, setIbkrSyncMessage] = useState<string>('');
  const [syncProgress, setSyncProgress] = useState(0);

  // 保存风控设置
  const handleSaveRiskSettings = () => {
    // 保存年份到 localStorage
    localStorage.setItem('rc_data_year', dataYear.toString());
    
    onUpdate({
      riskLimits: {
        stopLossPercent: parseFloat(stopLoss) || -20,
        maxDrawdownPercent: parseFloat(maxDrawdown) || 5,
        positionLimitPercent: parseFloat(positionLimit) || 15,
        watchlistCooldownDays: parseInt(cooldownDays) || 7,
      },
      dataYear,
    });
    
    // 刷新页面以应用新的年份过滤
    if (dataYear !== settings.dataYear) {
      setTimeout(() => window.location.reload(), 500);
    }
  };

  // 保存 Supabase 设置
  const handleSaveSupabase = () => {
    const enabled = !!(supabaseUrl && supabaseKey);
    
    // 保存到 LocalStorage 以便持久化和在 useSupabasePortfolio 中读取
    if (enabled) {
      localStorage.setItem('rc_supabase_config', JSON.stringify({ url: supabaseUrl, anonKey: supabaseKey, enabled }));
    } else {
      localStorage.removeItem('rc_supabase_config');
    }
    
    if (enabled) {
      const initialized = initSupabase({ url: supabaseUrl, anonKey: supabaseKey, enabled: true });
      if (!initialized) {
        setSyncStatus('error');
        return;
      }
    }

    onUpdate({
      supabase: {
        url: supabaseUrl,
        anonKey: supabaseKey,
        enabled,
      },
    });

    setSyncStatus('success');
    setTimeout(() => setSyncStatus('idle'), 3000);
  };

  // 同步 IBKR 数据（增量加载）
  const handleSyncIBKR = async () => {
    if (!settings.supabase.enabled) {
      setIbkrSyncStatus('error');
      setIbkrSyncMessage('请先启用 Supabase');
      setTimeout(() => setIbkrSyncStatus('idle'), 3000);
      return;
    }

    setIsSyncingIBKR(true);
    setIbkrSyncStatus('processing');
    setIbkrSyncMessage('正在初始化同步...');
    setSyncProgress(0);

    try {
      // 检查是否已有数据（用于增量加载）
      const supabase = getSupabaseClient();
      let hasExistingData = false;
      if (supabase) {
        try {
          const { count } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .limit(1);
          hasExistingData = (count || 0) > 0;
        } catch (err) {
          console.warn('[Settings] 检查已有数据失败:', err);
        }
      }

      // 执行同步（forceRefresh: false 表示如果今天已刷新过则跳过）
      const result = await syncIBKRToSupabase(false, (stage, progress) => {
        setIbkrSyncMessage(stage);
        setSyncProgress(progress);
      });

      if (result.success) {
        setSyncProgress(100);
        if (result.skipped) {
          setIbkrSyncStatus('skipped');
          setIbkrSyncMessage(result.message);
        } else {
          setIbkrSyncStatus('success');
          setIbkrSyncMessage(hasExistingData 
            ? `增量同步成功！${result.message}` 
            : `数据加载成功！${result.message}`);
          // 刷新页面以显示新数据
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } else {
        setIbkrSyncStatus('error');
        setIbkrSyncMessage(result.message || '同步失败');
      }
    } catch (error) {
      console.error('[Settings] IBKR 同步失败:', error);
      setIbkrSyncStatus('error');
      setIbkrSyncMessage(error instanceof Error ? error.message : '同步失败，请检查网络连接');
    } finally {
      setIsSyncingIBKR(false);
      // Don't auto-reset status if success, so user can see the result
      if (ibkrSyncStatus !== 'success') {
        setTimeout(() => {
          // setIbkrSyncStatus('idle'); // Keep status visible for a bit or until next action
        }, 5000);
      }
    }
  };

  // 强制刷新 IBKR 数据（清理并重新导入）
  const handleForceRefreshIBKR = async () => {
    if (!settings.supabase.enabled) {
      setIbkrSyncStatus('error');
      setIbkrSyncMessage('请先启用 Supabase');
      setTimeout(() => setIbkrSyncStatus('idle'), 3000);
      return;
    }

    if (!confirm('确定要强制刷新吗？这将清理所有 IBKR 交易记录并重新导入。')) {
      return;
    }
    
    setIsSyncingIBKR(true);
    setIbkrSyncStatus('processing');
    setIbkrSyncMessage('正在准备强制刷新...');
    setSyncProgress(0);
    
    try {
      // 执行强制同步（forceRefresh: true 会清理所有 IBKR 交易记录）
      const result = await syncIBKRToSupabase(true, (stage, progress) => {
        setIbkrSyncMessage(stage);
        setSyncProgress(progress);
      });

      if (result.success) {
        setSyncProgress(100);
        setIbkrSyncStatus('success');
        setIbkrSyncMessage(`强制刷新成功！${result.message}`);
        // 刷新页面以显示新数据
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setIbkrSyncStatus('error');
        setIbkrSyncMessage(result.message || '强制刷新失败');
      }
    } catch (error) {
      console.error('[Settings] IBKR 强制刷新失败:', error);
      setIbkrSyncStatus('error');
      setIbkrSyncMessage(error instanceof Error ? error.message : '强制刷新失败，请检查网络连接');
    } finally {
      setIsSyncingIBKR(false);
    }
  };

  const tabs = [
    { id: 'risk', label: '风控参数', icon: Shield },
    { id: 'system', label: '系统设置', icon: Server },
    { id: 'changelog', label: '更新日志', icon: History },
    { id: 'architecture', label: '架构说明', icon: Layers },
  ] as const;

  return (
    <>
      <Button variant="ghost" onClick={() => setIsOpen(true)} aria-label="系统设置">
        <SettingsIcon size={18} />
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="系统设置"
        size="md"
      >
        {/* 标签页 */}
        <div className="flex border-b border-border mb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-accent-cyan border-accent-cyan'
                  : 'text-text-muted border-transparent hover:text-text-primary'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 风控参数 */}
        {activeTab === 'risk' && (
          <div className="space-y-4">
            {/* 数据年份选择 */}
            <div className="p-4 bg-bg-tertiary rounded-lg border border-accent-cyan/30">
              <h3 className="text-sm font-medium text-text-primary mb-4">📅 数据范围</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">查看年份:</span>
                <div className="flex gap-2">
                  {[2025, 2026].map(year => (
                    <button
                      key={year}
                      onClick={() => setDataYear(year)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        dataYear === year
                          ? 'bg-accent-cyan text-bg-primary'
                          : 'bg-bg-secondary text-text-secondary hover:bg-bg-primary'
                      }`}
                    >
                      {year}年
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-text-muted mt-2">
                切换后将只显示该年度的数据（从1月1日开始）
              </p>
            </div>

            <div className="p-4 bg-bg-tertiary rounded-lg">
              <h3 className="text-sm font-medium text-text-primary mb-4">三大风控铁律</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="flex items-center justify-between text-sm mb-2">
                    <span className="text-text-secondary">止损红线</span>
                    <span className="text-accent-red mono-nums">{stopLoss}%</span>
                  </label>
                  <input
                    type="range"
                    min="-50"
                    max="-5"
                    step="1"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className="w-full"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    单笔持仓亏损超过此比例触发警报
                  </p>
                </div>

                <div>
                  <label className="flex items-center justify-between text-sm mb-2">
                    <span className="text-text-secondary">最大回撤</span>
                    <span className="text-accent-yellow mono-nums">{maxDrawdown}%</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={maxDrawdown}
                    onChange={(e) => setMaxDrawdown(e.target.value)}
                    className="w-full"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    总资产较历史最高回撤超过此比例触发警报
                  </p>
                </div>

                <div>
                  <label className="flex items-center justify-between text-sm mb-2">
                    <span className="text-text-secondary">持仓上限</span>
                    <span className="text-accent-blue mono-nums">{positionLimit}%</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="1"
                    value={positionLimit}
                    onChange={(e) => setPositionLimit(e.target.value)}
                    className="w-full"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    单只个股持仓市值占总资产比例上限
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-bg-tertiary rounded-lg">
              <h3 className="text-sm font-medium text-text-primary mb-4">防 FOMO 机制</h3>
              
              <div>
                <label className="flex items-center justify-between text-sm mb-2">
                  <span className="text-text-secondary">观察期冷静期</span>
                  <span className="text-accent-purple mono-nums">{cooldownDays} 天</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  value={cooldownDays}
                  onChange={(e) => setCooldownDays(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-text-muted mt-1">
                  加入观察列表后需等待此天数才能交易
                </p>
              </div>
            </div>

            <Button variant="primary" className="w-full" onClick={handleSaveRiskSettings}>
              保存风控设置
            </Button>
          </div>
        )}

        {/* 系统设置 (原 Cloud + Data) */}
        {activeTab === 'system' && (
          <div className="space-y-4">
            {/* 1. 数据处理状态 */}
            <DataProcessingStatus 
              lastUpdate={getLastRefreshTime()}
              status={ibkrSyncStatus as any}
              statusMessage={ibkrSyncMessage}
              progress={syncProgress}
              onSync={handleSyncIBKR}
              onForceRefresh={handleForceRefreshIBKR}
              isSyncing={isSyncingIBKR}
            />

            {/* 2. API 健康监控 */}
            <ApiStatus />

            {/* 3. 云端连接配置 */}
            <div className="p-4 bg-bg-tertiary rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-text-primary">云端连接</h3>
                {settings.supabase.enabled && (
                  <Badge variant="success">已连接</Badge>
                )}
              </div>

              <div className="space-y-3">
                <Input
                  label="Supabase URL"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xxx.supabase.co"
                />
                <Input
                  label="Anon Key"
                  type="password"
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                />
              </div>

              <div className="flex gap-2 mt-4">
                <Button variant="secondary" className="w-full" onClick={handleSaveSupabase}>
                  保存配置
                </Button>
              </div>

              {syncStatus === 'success' && (
                <div className="flex items-center gap-2 mt-3 text-accent-green text-sm">
                  <CheckCircle size={16} />
                  配置保存成功
                </div>
              )}
              {syncStatus === 'error' && (
                <div className="flex items-center gap-2 mt-3 text-accent-red text-sm">
                  <AlertTriangle size={16} />
                  保存失败，请检查配置
                </div>
              )}
            </div>

            {/* 3. 系统维护 */}
            <div className="p-4 bg-bg-tertiary rounded-lg border border-border">
              <h3 className="text-sm font-medium text-text-primary mb-2">系统维护</h3>
              <p className="text-xs text-text-secondary mb-4">
                如果遇到显示异常或数据不更新，可以尝试清除本地缓存。此操作不会删除云端数据。
              </p>
              
              <Button
                variant="secondary"
                size="sm"
                className="w-full flex items-center justify-center"
                onClick={() => {
                  const keys = Object.keys(localStorage);
                  const cacheKeys = keys.filter(k => k.startsWith('rc_v2_cache_'));
                  cacheKeys.forEach(k => localStorage.removeItem(k));
                  alert(`已清除 ${cacheKeys.length} 个缓存项，页面将自动刷新`);
                  window.location.reload();
                }}
              >
                <Trash2 size={16} className="mr-2" />
                清除本地缓存
              </Button>
            </div>
          </div>
        )}

        {/* 更新日志 */}
        {activeTab === 'changelog' && (
          <Changelog />
        )}

        {/* 架构说明 */}
        {activeTab === 'architecture' && (
          <Architecture />
        )}
      </Modal>
    </>
  );
}
