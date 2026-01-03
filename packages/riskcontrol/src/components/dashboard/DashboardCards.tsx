import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Wallet, 
  PieChart,
  Activity,
  Target,
  Zap,
  Eye,
  EyeOff,
  Sparkles
} from 'lucide-react';
import { Card, NumberDisplay, SegmentedBar, Badge } from '../ui';
import type { PortfolioState, CashBalance, Position } from '../../types';

// 总净值卡片
interface NetWorthCardProps {
  totalNetWorth: number;
  initialNetWorth?: number; // 基准净值本金
  dailyPnL: number;
  dailyPnLPercent: number;
  livePrices?: Record<string, { currentPrice: number; changePercent: number; lastUpdated: number }>;
  positions?: Position[];
  isPrivacyMode?: boolean;
  onToggleShowAmounts?: (show: boolean) => void; // 切换显示模式的回调
  onTogglePrivacy?: () => void; // 切换隐私模式的回调
  showAmounts?: boolean; // 当前是否显示金额
}

export function NetWorthCard({ 
  totalNetWorth, 
  initialNetWorth = 1000000, 
  dailyPnL, 
  dailyPnLPercent, 
  livePrices, 
  positions, 
  isPrivacyMode = false,
  onToggleShowAmounts,
  onTogglePrivacy,
  showAmounts = false
}: NetWorthCardProps) {
  const isPositive = dailyPnL >= 0;

  // 计算净值 (相对于 initialNetWorth)
  // 如果 initialNetWorth 为 0 或未定义，避免除以零
  const netWorthValue = initialNetWorth > 0 ? totalNetWorth / initialNetWorth : 1.0;
  
  // 计算实时净值
  let liveNetWorth = totalNetWorth;
  let hasLiveData = false;

  if (livePrices && positions && positions.length > 0) {
    let totalDiffCNY = 0;
    let livePositionsCount = 0;

    positions.forEach(pos => {
      const liveData = livePrices[pos.ticker];
      if (liveData) {
        // 估算新市值：(新价/旧价) * 旧市值
        const priceRatio = pos.currentPrice > 0 ? liveData.currentPrice / pos.currentPrice : 1;
        
        // 安全检查：如果价格变化超过 50% (0.5 - 1.5)，可能是数据源错误（如货币单位不对：HKD被当成USD）
        // 暂时忽略异常数据，防止净值显示错误
        if (priceRatio < 0.5 || priceRatio > 1.5) {
          console.warn(`[NetWorth] Suspicious price change for ${pos.ticker}: ${pos.currentPrice} -> ${liveData.currentPrice}. Ignoring live data.`);
          return;
        }

        const newMarketValue = pos.marketValueCNY * priceRatio;
        const diff = newMarketValue - pos.marketValueCNY;
        
        totalDiffCNY += diff;
        livePositionsCount++;
      }
    });

    if (livePositionsCount > 0) {
      liveNetWorth = totalNetWorth + totalDiffCNY;
      hasLiveData = true;
    }
  }

  // 实时净值 (单位化)
  const liveNetWorthValue = initialNetWorth > 0 ? liveNetWorth / initialNetWorth : 1.0;

  return (
    <Card glow={isPositive ? 'green' : 'red'} className="relative overflow-hidden group">
      {/* 背景装饰 - 升级为渐变光效 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-[60px] transition-opacity duration-500 ${
          isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'
        }`} />
        <div className="absolute bottom-0 left-0 w-32 h-32 opacity-5">
          {isPositive ? (
            <TrendingUp size={128} className="text-emerald-400" />
          ) : (
            <TrendingDown size={128} className="text-red-400" />
          )}
        </div>
      </div>
      
      {/* 切换按钮 - 移动端始终显示 */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          if (isPrivacyMode) {
            onTogglePrivacy?.();
          } else {
            onToggleShowAmounts?.(!showAmounts);
          }
        }}
        className="absolute top-3 right-3 p-2 rounded-lg bg-white/[0.05] text-white/40 hover:text-white hover:bg-white/[0.1] transition-all sm:opacity-0 sm:group-hover:opacity-100 z-10 backdrop-blur-sm"
        title={isPrivacyMode ? "点击解除隐私模式" : (showAmounts ? "切换至净值视图" : "切换至金额视图")}
      >
        {isPrivacyMode ? <EyeOff size={14} className="text-red-400" /> : (showAmounts ? <EyeOff size={14} /> : <Eye size={14} />)}
      </button>
      
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isPositive ? 'bg-emerald-500/20' : 'bg-red-500/20'
          }`}>
            <Activity size={16} className={isPositive ? 'text-emerald-400' : 'text-red-400'} />
          </div>
          <span className="text-xs text-white/50 uppercase tracking-wider font-medium">
            {showAmounts ? '总资产' : '当前净值'}
          </span>
        </div>
        
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-3">
            {isPrivacyMode ? (
              <span 
                className="text-3xl font-bold font-mono text-white/20 select-none blur-[3px] cursor-pointer hover:text-white/30 transition-colors"
                onClick={() => onTogglePrivacy?.()}
                title="点击解除隐私模式"
              >
                {showAmounts ? '¥****' : '****'}
              </span>
            ) : (
              showAmounts ? (
                <NumberDisplay 
                  value={totalNetWorth} 
                  prefix="¥" 
                  decimals={2} 
                  colorize={false}
                  size="xl"
                />
              ) : (
                <span className="text-3xl font-bold font-mono text-white">
                  {netWorthValue.toFixed(4)}
                </span>
              )
            )}
          </div>
          
          {/* 实时净值显示 */}
          {hasLiveData && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 mt-1">
              <span className="text-xs text-white/40 flex items-center gap-1">
                <Sparkles size={10} className="text-cyan-400" />
                Live
              </span>
              {isPrivacyMode ? (
                <span className="text-sm font-mono text-white/20 blur-[3px] select-none">
                   {showAmounts ? '¥****.**' : '****'}
                </span>
              ) : (
                showAmounts ? (
                    <span className="text-sm font-mono text-white/80">
                    ¥{liveNetWorth.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                ) : (
                    <span className="text-sm font-mono text-white/80">
                    {liveNetWorthValue.toFixed(4)}
                    </span>
                )
              )}
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="实时更新中" />
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/[0.06]">
          {/* 今日盈亏 - 净值模式下只显示百分比，金额模式下显示金额+百分比 */}
          {showAmounts && (
             <div className="flex items-center gap-1.5">
                <span className="text-xs text-white/40">今日盈亏</span>
                <NumberDisplay value={dailyPnL} prefix="¥" decimals={2} size="sm" privacyMode={isPrivacyMode} />
             </div>
          )}
          
          <div className="flex items-center gap-1.5">
            {!showAmounts && <span className="text-xs text-white/40">今日变动</span>}
            <NumberDisplay value={dailyPnLPercent} suffix="%" decimals={2} size="sm" />
          </div>
        </div>
      </div>
    </Card>
  );
}

// 最大回撤卡片
interface DrawdownCardProps {
  drawdownPercent: number;
  drawdownAmount: number;
  highWaterMark: number;
  maxDrawdownLimit: number;
  isPrivacyMode?: boolean;
}

export function DrawdownCard({ 
  drawdownPercent, 
  drawdownAmount, 
  highWaterMark,
  maxDrawdownLimit,
  isPrivacyMode = false
}: DrawdownCardProps) {
  const isWarning = drawdownPercent >= maxDrawdownLimit * 0.8;
  const isCritical = drawdownPercent >= maxDrawdownLimit;

  return (
    <Card glow={isCritical ? 'red' : 'none'} className="relative overflow-hidden">
      {/* 背景光效 */}
      {isCritical && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-[50px] animate-pulse" />
        </div>
      )}
      
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isCritical ? 'bg-red-500/20' : isWarning ? 'bg-amber-500/20' : 'bg-cyan-500/20'
          }`}>
            <Target size={16} className={isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-cyan-400'} />
          </div>
          <span className="text-xs text-white/50 uppercase tracking-wider font-medium">最大回撤</span>
          {isCritical && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400 ring-1 ring-red-500/30 animate-pulse">
              触发风控
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-bold mono-nums ${
            isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-white'
          }`}>
            {drawdownPercent?.toFixed(2) ?? '0.00'}%
          </span>
          <span className="text-sm text-white/40">/ {maxDrawdownLimit}%</span>
        </div>

        <div className="mt-4">
          <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                isCritical ? 'bg-gradient-to-r from-red-500 to-red-400' : 
                isWarning ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 
                'bg-gradient-to-r from-cyan-500 to-cyan-400'
              }`}
              style={{ width: `${Math.min((drawdownPercent / maxDrawdownLimit) * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between mt-4 pt-3 border-t border-white/[0.06] text-xs">
          <div>
            <span className="text-white/40">回撤金额</span>
            <NumberDisplay value={-drawdownAmount} prefix=" ¥" decimals={0} size="sm" privacyMode={isPrivacyMode} />
          </div>
          <div className="text-right">
            <span className="text-white/40">历史最高</span>
            {isPrivacyMode ? (
              <span className="text-white/20 blur-[3px] select-none ml-1">¥****</span>
            ) : (
              <span className="text-white/80 mono-nums ml-1">¥{(highWaterMark ?? 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// 现金储备卡片
interface CashCardProps {
  cashBalance: CashBalance;
  cashRatio: number;
  isPrivacyMode?: boolean;
}

export function CashCard({ cashBalance, cashRatio, isPrivacyMode = false }: CashCardProps) {
  return (
    <Card className="relative">
      <div className="flex items-center gap-2 mb-2">
        <Wallet size={16} className="text-accent-blue" />
        <span className="text-xs text-text-secondary uppercase tracking-wider">现金储备</span>
        <Badge variant="info">{cashRatio?.toFixed(1) ?? '0.0'}%</Badge>
      </div>

      <div className="text-2xl font-bold text-text-primary mono-nums">
        {isPrivacyMode ? (
           <span className="text-text-muted blur-[2px] select-none">¥****</span>
        ) : (
           `¥${(cashBalance?.totalCNY ?? 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
        <div>
          <div className="text-xs text-text-muted">CNY</div>
          <div className="text-sm text-text-primary mono-nums">
            {isPrivacyMode ? (
               <span className="text-text-muted blur-[2px] select-none">¥****</span>
            ) : (
               `¥${(cashBalance?.CNY ?? 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
            )}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted">USD</div>
          <div className="text-sm text-text-primary mono-nums">
            {isPrivacyMode ? (
               <span className="text-text-muted blur-[2px] select-none">$****</span>
            ) : (
               `$${(cashBalance?.USD ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
            )}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted">HKD</div>
          <div className="text-sm text-text-primary mono-nums">
            {isPrivacyMode ? (
               <span className="text-text-muted blur-[2px] select-none">HK$****</span>
            ) : (
               `HK$${(cashBalance?.HKD ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// 持仓结构卡片
interface AllocationCardProps {
  cashRatio: number;
  longRatio: number;
  shortRatio: number;
}

export function AllocationCard({ cashRatio, longRatio, shortRatio }: AllocationCardProps) {
  const segments = [
    { value: longRatio, color: '#00ff88', label: '多头' },
    { value: shortRatio, color: '#ff4444', label: '空头' },
    { value: cashRatio, color: '#4a9eff', label: '现金' },
  ];

  return (
    <Card className="relative">
      <div className="flex items-center gap-2 mb-4">
        <PieChart size={16} className="text-accent-purple" />
        <span className="text-xs text-text-secondary uppercase tracking-wider">持仓结构</span>
      </div>

      <SegmentedBar segments={segments} />
    </Card>
  );
}

// 风控警报卡片
interface AlertsCardProps {
  alerts: PortfolioState['alerts'];
  onAcknowledge?: (id: string) => void;
  onViewAdvice?: (alert: PortfolioState['alerts'][0]) => void;
}

export function AlertsCard({ alerts, onAcknowledge, onViewAdvice }: AlertsCardProps) {
  const activeAlerts = alerts.filter(a => !a.acknowledged);

  if (activeAlerts.length === 0) {
    return (
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-[50px]" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Zap size={16} className="text-emerald-400" />
            </div>
            <span className="text-xs text-white/50 uppercase tracking-wider font-medium">风控状态</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm">系统运行正常，无风控警报</span>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card glow="red" className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-[50px] animate-pulse" />
      </div>
      
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
            <AlertTriangle size={16} className="text-red-400 animate-pulse" />
          </div>
          <span className="text-xs text-white/50 uppercase tracking-wider font-medium">风控警报</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400 ring-1 ring-red-500/30">
            {activeAlerts.length}
          </span>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {activeAlerts.map(alert => (
            <div 
              key={alert.id}
              className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] cursor-pointer hover:bg-red-500/5 hover:border-red-500/20 transition-all duration-200"
              onClick={() => onAcknowledge?.(alert.id)}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${alert.severity === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'}`}>
                  {alert.title}
                </span>
                {alert.ticker && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    alert.severity === 'CRITICAL' 
                      ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30' 
                      : 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30'
                  }`}>
                    {alert.ticker}
                  </span>
                )}
              </div>
              <p className="text-xs text-white/50 mt-1.5 line-clamp-2">{alert.message}</p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewAdvice?.(alert);
                  }}
                  className="text-xs px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-colors ring-1 ring-cyan-500/20"
                >
                  查看建议
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// 杠杆率卡片
interface LeverageCardProps {
  leverageRatio: number;
  marginLoanCNY?: number;
  netWorthCNY?: number; // 净资产，用于反推融资额
  targetLeverage?: number; // 目标杠杆率
  isPrivacyMode?: boolean;
}

export function LeverageCard({ 
  leverageRatio, 
  marginLoanCNY = 0, 
  netWorthCNY = 0,
  targetLeverage = 1.5,
  isPrivacyMode = false 
}: LeverageCardProps) {
  // 杠杆风险等级
  const isLow = leverageRatio <= 1.5;
  const isMedium = leverageRatio > 1.5 && leverageRatio <= 2.0;
  const isHigh = leverageRatio > 2.0 && leverageRatio <= 2.5;
  const isCritical = leverageRatio > 2.5;

  // 计算实际融资额：如果 marginLoanCNY 为 0 但杠杆率 > 1，从杠杆率反推
  // 公式：Debt = NetWorth * (Leverage - 1)
  const actualMarginLoan = marginLoanCNY > 0 
    ? marginLoanCNY 
    : (leverageRatio > 1 && netWorthCNY > 0 ? netWorthCNY * (leverageRatio - 1) : 0);

  const getRiskColor = () => {
    if (isLow) return 'text-emerald-400';
    if (isMedium) return 'text-cyan-400';
    if (isHigh) return 'text-amber-400';
    return 'text-red-400';
  };

  const getRiskBgColor = () => {
    if (isLow) return 'bg-emerald-500/20';
    if (isMedium) return 'bg-cyan-500/20';
    if (isHigh) return 'bg-amber-500/20';
    return 'bg-red-500/20';
  };

  const getRiskLabel = () => {
    if (isLow) return '低风险';
    if (isMedium) return '适中';
    if (isHigh) return '偏高';
    return '高风险';
  };

  const getGlow = (): 'green' | 'red' | 'none' | undefined => {
    if (isCritical) return 'red';
    if (isHigh) return 'red';
    return 'none';
  };

  // 计算距离目标杠杆的差距
  const leverageGap = leverageRatio - targetLeverage;
  const needsDeleverage = leverageGap > 0;

  return (
    <Card glow={getGlow()} className="relative overflow-hidden">
      {/* 背景光效 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-[50px] ${
          isCritical ? 'bg-red-500/10' : isHigh ? 'bg-amber-500/10' : 'bg-cyan-500/5'
        }`} />
      </div>
      
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getRiskBgColor()}`}>
            <Activity size={16} className={getRiskColor()} />
          </div>
          <span className="text-xs text-white/50 uppercase tracking-wider font-medium">杠杆率</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${
            isCritical ? 'bg-red-500/20 text-red-400 ring-red-500/30' : 
            isHigh ? 'bg-amber-500/20 text-amber-400 ring-amber-500/30' : 
            isMedium ? 'bg-cyan-500/20 text-cyan-400 ring-cyan-500/30' :
            'bg-emerald-500/20 text-emerald-400 ring-emerald-500/30'
          }`}>
            {getRiskLabel()}
          </span>
        </div>

        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-2xl sm:text-3xl font-bold mono-nums ${getRiskColor()}`}>
            {leverageRatio.toFixed(2)}x
          </span>
          <span className="text-xs sm:text-sm text-white/40">/ 目标 {targetLeverage.toFixed(1)}x</span>
        </div>

        {/* 杠杆进度条 */}
        <div className="mt-4">
          <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                isCritical ? 'bg-gradient-to-r from-red-500 to-red-400' : 
                isHigh ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 
                isMedium ? 'bg-gradient-to-r from-cyan-500 to-cyan-400' : 
                'bg-gradient-to-r from-emerald-500 to-emerald-400'
              }`}
              style={{ width: `${Math.min((leverageRatio / 3) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] sm:text-xs text-white/30">
            <span>1x</span>
            <span className="hidden sm:inline">1.5x</span>
            <span>2x</span>
            <span className="hidden sm:inline">2.5x</span>
            <span>3x</span>
          </div>
        </div>

        <div className="flex justify-between mt-4 pt-3 border-t border-white/[0.06] text-xs">
          <div className="min-w-0">
            <span className="text-white/40">融资</span>
            {isPrivacyMode ? (
              <span className="text-white/20 blur-[3px] select-none ml-1">¥****</span>
            ) : (
              <span className="text-white/80 mono-nums ml-1 text-[10px] sm:text-xs">
                ¥{(actualMarginLoan / 10000).toFixed(0)}万
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="text-white/40">距目标</span>
            <span className={`mono-nums ml-1 ${needsDeleverage ? 'text-amber-400' : 'text-emerald-400'}`}>
              {needsDeleverage ? '+' : ''}{leverageGap.toFixed(2)}x
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// 快速统计卡片
interface QuickStatsProps {
  positionCount: number;
  watchlistCount: number;
  winRate: number;
  profitFactor: number;
}

export function QuickStatsCard({ positionCount, watchlistCount, winRate, profitFactor }: QuickStatsProps) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-4 gap-2">
        <div className="text-center p-3 rounded-xl bg-white/[0.02] hover:bg-cyan-500/5 transition-colors">
          <div className="text-2xl font-bold text-cyan-400 mono-nums">{positionCount}</div>
          <div className="text-[10px] text-white/40 mt-1">持仓数</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-white/[0.02] hover:bg-purple-500/5 transition-colors">
          <div className="text-2xl font-bold text-purple-400 mono-nums">{watchlistCount}</div>
          <div className="text-[10px] text-white/40 mt-1">观察中</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-white/[0.02] hover:bg-emerald-500/5 transition-colors">
          <div className={`text-2xl font-bold mono-nums ${(winRate ?? 0) >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
            {winRate?.toFixed(0) ?? '0'}%
          </div>
          <div className="text-[10px] text-white/40 mt-1">胜率</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-white/[0.02] hover:bg-emerald-500/5 transition-colors">
          <div className={`text-2xl font-bold mono-nums ${(profitFactor ?? 0) >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
            {profitFactor === Infinity ? '∞' : (profitFactor?.toFixed(2) ?? '0.00')}
          </div>
          <div className="text-[10px] text-white/40 mt-1">盈亏比</div>
        </div>
      </div>
    </Card>
  );
}
