import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useMarketData } from '../../contexts/MarketContext';

// ============ 类型定义 ============
interface VIXData {
  current: number;
  previousClose: number;
  change: number;
  changePercent: number;
  timestamp: Date;
  source: 'worker' | 'simulated';
}

interface LockdownState {
  isActive: boolean;
  triggeredAt: Date | null;
  daysRemaining: number;
  triggerVIX: number;
  triggerChange: number;
}

// ============ VIX 数据获取 (已移至 MarketContext) ============

// ============ 封控状态管理 ============
const LOCKDOWN_STORAGE_KEY = 'riskcontrol_panic_lockdown';
const LOCKDOWN_DURATION_DAYS = 5;
const VIX_THRESHOLD = 22;
const VIX_CHANGE_THRESHOLD = 5;

function getLockdownState(): LockdownState {
  try {
    const stored = localStorage.getItem(LOCKDOWN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.triggeredAt) {
        const triggeredAt = new Date(parsed.triggeredAt);
        const now = new Date();
        const daysPassed = Math.floor((now.getTime() - triggeredAt.getTime()) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, LOCKDOWN_DURATION_DAYS - daysPassed);
        if (daysRemaining > 0) {
          return {
            isActive: true,
            triggeredAt,
            daysRemaining,
            triggerVIX: parsed.triggerVIX || 0,
            triggerChange: parsed.triggerChange || 0
          };
        } else {
          localStorage.removeItem(LOCKDOWN_STORAGE_KEY);
        }
      }
    }
  } catch {}
  return { isActive: false, triggeredAt: null, daysRemaining: 0, triggerVIX: 0, triggerChange: 0 };
}

function triggerLockdown(vix: number, changePercent: number): void {
  localStorage.setItem(LOCKDOWN_STORAGE_KEY, JSON.stringify({
    triggeredAt: new Date().toISOString(),
    triggerVIX: vix,
    triggerChange: changePercent
  }));
}

function checkLockdownTrigger(vixData: VIXData): boolean {
  return vixData.current >= VIX_THRESHOLD && vixData.changePercent >= VIX_CHANGE_THRESHOLD;
}

// ============ 封控警报横幅组件 ============
export function LockdownAlertBanner() {
  const [lockdownState, setLockdownState] = useState<LockdownState>(getLockdownState);
  
  useEffect(() => {
    const interval = setInterval(() => setLockdownState(getLockdownState()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  if (!lockdownState.isActive) return null;
  
  const riskExposureWarning = "⚠️ 封控期间：必须空仓或风险暴露 ≤ 20%，不得新增任何风险敞口";
  
  return (
    <div className="bg-gradient-to-r from-red-900/90 via-red-800/90 to-red-900/90 border-2 border-red-500 rounded-lg p-4 shadow-2xl shadow-red-500/30 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-4xl animate-bounce">🚨</div>
          <div>
            <div className="text-red-100 font-bold text-xl tracking-wide">
              恐慌封控状态已激活
            </div>
            <div className="text-red-200 text-sm mt-1">
              {riskExposureWarning}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {/* 触发信息 */}
          <div className="text-right border-r border-red-500/50 pr-6">
            <div className="text-red-300 text-xs">触发 VIX</div>
            <div className="text-red-100 font-bold text-lg">{lockdownState.triggerVIX?.toFixed(2) ?? '--'}</div>
            <div className="text-red-300 text-xs">+{lockdownState.triggerChange?.toFixed(2) ?? '--'}%</div>
          </div>
          
          {/* 倒计时 */}
          <div className="bg-red-950/80 rounded-lg px-6 py-3 border border-red-500">
            <div className="text-red-300 text-xs text-center mb-1">清仓倒计时</div>
            <div className="text-red-100 font-black text-4xl text-center">
              {lockdownState.daysRemaining}
            </div>
            <div className="text-red-300 text-xs text-center">交易日</div>
          </div>
        </div>
      </div>
      
      {/* 底部提醒条 */}
      <div className="mt-3 pt-3 border-t border-red-500/30 flex items-center justify-between text-sm">
        <div className="text-red-200">
          <span className="font-medium">触发时间:</span> {lockdownState.triggeredAt?.toLocaleDateString('zh-CN')} {lockdownState.triggeredAt?.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="text-red-100 font-medium animate-pulse">
          🔒 封控期间禁止新增风险敞口 · 不做任何主观判断 · 不提前解除
        </div>
      </div>
    </div>
  );
}

// ============ 主卡片组件 ============
interface PanicLockdownCardProps {
  longRatio: number;
  shortRatio: number;
}

export function PanicLockdownCard({ longRatio, shortRatio }: PanicLockdownCardProps) {
  const { vixHistory, loading, refresh, isSimulated } = useMarketData();
  const [lockdownState, setLockdownState] = useState<LockdownState>(getLockdownState);
  const [expanded, setExpanded] = useState(false);
  
  const riskExposure = longRatio + shortRatio;
  const isCompliant = riskExposure <= 20;
  
  const vixData = useMemo<VIXData | null>(() => {
    if (!vixHistory || vixHistory.data.length < 2) return null;
    const current = vixHistory.data[0];
    const previous = vixHistory.data[1];
    return {
      current: current.close,
      previousClose: previous.close,
      change: current.close - previous.close,
      changePercent: ((current.close - previous.close) / previous.close) * 100,
      timestamp: new Date(current.date),
      source: isSimulated ? 'simulated' : 'worker'
    };
  }, [vixHistory, isSimulated]);
  
  useEffect(() => {
    if (vixData) {
      const currentLockdown = getLockdownState();
      if (!currentLockdown.isActive && checkLockdownTrigger(vixData)) {
        triggerLockdown(vixData.current, vixData.changePercent);
        setLockdownState(getLockdownState());
      }
    }
  }, [vixData]);
  
  useEffect(() => {
    const checkInterval = setInterval(() => setLockdownState(getLockdownState()), 60 * 1000);
    return () => clearInterval(checkInterval);
  }, []);
  
  const getVIXStatusColor = () => {
    if (!vixData) return 'text-text-muted';
    if (vixData.current >= VIX_THRESHOLD) return 'text-accent-red';
    if (vixData.current >= 18) return 'text-accent-yellow';
    return 'text-accent-green';
  };
  
  const getChangeColor = () => {
    if (!vixData) return 'text-text-muted';
    if (vixData.changePercent >= VIX_CHANGE_THRESHOLD) return 'text-accent-red';
    if (vixData.changePercent > 0) return 'text-accent-yellow';
    return 'text-accent-green';
  };

  return (
    <div className={`bg-bg-secondary border rounded-lg p-4 transition-all duration-300 ${
      lockdownState.isActive 
        ? 'border-accent-red shadow-lg shadow-accent-red/20' 
        : 'border-accent-cyan'
    }`}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`text-xl ${lockdownState.isActive ? 'animate-pulse' : ''}`}>
            {lockdownState.isActive ? '🚨' : '🛡️'}
          </span>
          <span className="text-xs text-text-secondary uppercase tracking-wider font-medium">
            恐慌封控规则
          </span>
          {lockdownState.isActive && (
            <span className="px-2 py-0.5 bg-accent-red/20 text-accent-red text-xs rounded-full animate-pulse font-bold">
              封控中 · 剩余 {lockdownState.daysRemaining} 天
            </span>
          )}
        </div>
        <button 
          onClick={() => setExpanded(!expanded)}
          className="text-text-muted hover:text-text-primary transition-colors text-sm"
        >
          {expanded ? '收起' : '详情'}
        </button>
      </div>
      
      {/* 封控状态警告 - 更醒目 */}
      {lockdownState.isActive && (
        <div className="mb-4 p-4 bg-gradient-to-r from-red-900/30 to-red-800/30 border-2 border-red-500 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl animate-bounce">⚠️</span>
              <span className="text-red-400 font-bold text-lg">封控状态激活</span>
            </div>
            <div className="bg-red-900/50 px-4 py-2 rounded-lg border border-red-500">
              <div className="text-red-300 text-xs text-center">清仓倒计时</div>
              <div className="text-red-100 font-black text-2xl text-center">{lockdownState.daysRemaining} 天</div>
            </div>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-text-secondary">
              <span>触发时间:</span>
              <span className="text-text-primary">{lockdownState.triggeredAt?.toLocaleDateString('zh-CN')}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>触发 VIX:</span>
              <span className="text-red-400 font-medium">{lockdownState.triggerVIX?.toFixed(2) ?? '--'} (+{lockdownState.triggerChange?.toFixed(2) ?? '--'}%)</span>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-red-500/30">
            <div className="text-red-300 font-medium text-sm mb-2">📋 封控期间执行要求:</div>
            <ul className="text-red-200 text-xs space-y-1">
              <li>• 空仓或最大风险暴露 ≤ 20%</li>
              <li>• 不新增任何风险敞口</li>
              <li>• 不做任何主观判断</li>
              <li>• 不提前解除封控</li>
            </ul>
          </div>
          
          <div className={`mt-3 p-2 rounded text-center font-bold ${isCompliant ? 'bg-green-900/30 text-green-400' : 'bg-red-900/50 text-red-400 animate-pulse'}`}>
            当前风险暴露: {riskExposure?.toFixed(1) ?? '0.0'}% {isCompliant ? '✓ 合规' : '✗ 超标！请立即减仓'}
          </div>
        </div>
      )}
      
      {/* VIX 指标 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-bg-primary/50 rounded-lg p-3">
          <div className="text-xs text-text-muted mb-1">VIX 恐慌指数</div>
          {loading ? (
            <div className="text-lg text-text-muted animate-pulse">加载中...</div>
          ) : (
            <div className={`text-2xl font-bold ${getVIXStatusColor()}`}>
              {vixData?.current?.toFixed(2) ?? '--'}
            </div>
          )}
          <div className="text-xs text-text-muted mt-1">阈值: ≥ {VIX_THRESHOLD}</div>
        </div>
        
        <div className="bg-bg-primary/50 rounded-lg p-3">
          <div className="text-xs text-text-muted mb-1">今日变化</div>
          {loading ? (
            <div className="text-lg text-text-muted animate-pulse">加载中...</div>
          ) : (
            <div className={`text-2xl font-bold ${getChangeColor()}`}>
              {vixData?.changePercent !== undefined 
                ? `${vixData.changePercent >= 0 ? '+' : ''}${vixData.changePercent.toFixed(2)}%` 
                : '--'}
            </div>
          )}
          <div className="text-xs text-text-muted mt-1">阈值: ≥ +{VIX_CHANGE_THRESHOLD}%</div>
        </div>
      </div>
      
      {/* 触发条件状态 */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1">
          <span className={vixData && vixData.current >= VIX_THRESHOLD ? 'text-accent-red' : 'text-accent-green'}>
            {vixData && vixData.current >= VIX_THRESHOLD ? '●' : '○'}
          </span>
          <span className="text-text-secondary">VIX ≥ 22</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={vixData && vixData.changePercent >= VIX_CHANGE_THRESHOLD ? 'text-accent-red' : 'text-accent-green'}>
            {vixData && vixData.changePercent >= VIX_CHANGE_THRESHOLD ? '●' : '○'}
          </span>
          <span className="text-text-secondary">日涨 ≥ +5%</span>
        </div>
        <div className="flex-1 text-right text-xs text-text-muted">
          {vixData?.source === 'simulated' && '(模拟数据)'}
          {vixData?.source === 'worker' && '(Worker Proxy)'}
        </div>
      </div>
      
      {/* 展开详情 */}
      {expanded && (
        <div className="border-t border-border pt-4 mt-4 space-y-4 text-sm">
          <div>
            <div className="text-text-secondary font-medium mb-2">🎯 规则目标</div>
            <p className="text-text-muted">
              在市场进入非线性失序阶段时，强制账户暂时不在场，以避免灾难性回撤。
            </p>
          </div>
          
          <div>
            <div className="text-text-secondary font-medium mb-2">🚨 触发条件（必须同时满足）</div>
            <ul className="text-text-muted space-y-1 list-disc list-inside">
              <li>VIX ≥ 22</li>
              <li>VIX 单日上涨 ≥ +5%（仅统计上涨）</li>
            </ul>
          </div>
          
          <div>
            <div className="text-text-secondary font-medium mb-2">🔐 执行方式</div>
            <ul className="text-text-muted space-y-1 list-disc list-inside">
              <li>从下一个交易日开始，连续 5 个交易日进入封控状态</li>
              <li>空仓或最大风险暴露 ≤ 20%</li>
              <li>不新增风险敞口，不做任何主观判断，不提前解除</li>
            </ul>
          </div>
          
          <div>
            <div className="text-text-secondary font-medium mb-2">🔓 退出机制</div>
            <p className="text-text-muted">
              封控满 5 个交易日后无条件恢复正常交易，不依赖 VIX 回落。
            </p>
          </div>
          
          <div className="bg-bg-primary/50 rounded-lg p-3">
            <div className="text-accent-cyan font-medium mb-1">🧠 方法论声明</div>
            <p className="text-text-muted text-xs">
              本系统不试图预测市场，只在恐慌加速这一特定结构出现时选择不在场。
            </p>
          </div>
          
          <div className="text-center text-text-muted italic text-xs pt-2 border-t border-border">
            "我们不管理日常波动，只在市场开始失控时，强制断电。"
          </div>
        </div>
      )}
      
      {/* 底部 */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="text-xs text-text-muted">
          当前风险暴露: <span className={(riskExposure ?? 0) > 20 ? 'text-accent-yellow' : 'text-text-primary'}>{riskExposure?.toFixed(1) ?? '0.0'}%</span>
        </div>
        <button 
          onClick={refresh}
          disabled={loading}
          className="text-xs text-accent-cyan hover:text-accent-cyan/80 disabled:opacity-50 transition-colors"
        >
          {loading ? '刷新中...' : '刷新 VIX'}
        </button>
      </div>
    </div>
  );
}
