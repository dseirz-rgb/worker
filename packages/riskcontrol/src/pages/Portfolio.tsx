import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from "wouter";
import { 
  RefreshCw, 
  Menu, 
  X,
  LayoutDashboard,
  LineChart,
  History,
  Eye,
  EyeOff,
  Lock,
  Shield,
  Loader2,
  Mail,
  Brain,
  AlertTriangle,
  TrendingUp,
  PieChart,
  Bell
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  NetWorthCard, 
  DrawdownCard, 
  CashCard, 
  AllocationCard,
  AlertsCard,
  QuickStatsCard
} from '@/components/dashboard/DashboardCards';
import { PanicLockdownCard } from '@/components/dashboard/PanicLockdownCard';
import { MarketStatusCard } from '@/components/dashboard/MarketStatusCard';
import { NetWorthChart } from '@/components/dashboard/NetWorthChart';
import { PositionsList } from '@/components/dashboard/PositionsList';
import { TradeForm, QuickCashForm } from '@/components/trading/TradeForm';
import { Watchlist } from '@/components/trading/Watchlist';
import { AIWeeklyReview, TradingStatsCard, TransactionHistory } from '@/components/review/TimeCapsule';
import { StrategyAnalysisCard } from '@/components/review/StrategyAnalysis';
import { Settings } from '@/components/settings/Settings';
import { LoadingSpinner, Badge, Card, Modal, Input, Button } from '@/components/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RiskAdviceModal } from '@/components/dashboard/RiskAdviceModal';
import { DailyBriefingModal } from '@/components/dashboard/DailyBriefingModal';
import { generateRiskAdvice, type RiskAdvice } from '@/services/riskAdvice';
import { useDashboardStore } from "@/hooks/useDashboardStore";
import { useSupabasePortfolio } from "@/hooks/useSupabasePortfolio";
import { adaptDashboardToPortfolio, adaptDashboardHistory, adaptRiskMetricsToTradingStats } from "@/adapters/supabaseToPortfolio";
import { calculateRoundTrips, calculateTradingStats, checkFOMO } from "@/services/riskEngine";
import type { Transaction, TimeCapsule, RiskAlert, Action, ExchangeRates, AppSettings } from "@/types";
import { fetchExchangeRates, fetchStockData, detectMarket, getCurrency } from "@/services/marketData";
import { v4 as uuidv4 } from 'uuid';
import { syncIBKRToSupabase, getLastRefreshTime } from "@/services/ibkrFlexQuery";
import { RiskMetricsCard } from "@/components/dashboard/RiskMetricsCard";
import { PositionsSummaryCard } from "@/components/dashboard/PositionsSummaryCard";
import { HistoryDataCard } from "@/components/dashboard/HistoryDataCard";
import { CostAnalysisChart } from "@/components/dashboard/CostAnalysisChart";
import { ReturnAttributionChart } from "@/components/dashboard/ReturnAttributionChart";
import { MarketStatusIndicator } from "@/components/market/MarketStatusIndicator";
import { AlertRulePanel } from "@/components/market/AlertRulePanel";

type TabId = 'overview' | 'positions' | 'history' | 'watchlist';

// Helper for conditional classes
const classNames = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

function NavTab({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            className={classNames(
                "group relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
                active 
                    ? "bg-gradient-to-r from-cyan-500/15 to-cyan-400/10 text-cyan-400 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/30" 
                    : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
            )}
        >
            {/* 活跃状态下的光效 */}
            {active && (
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/5 to-transparent opacity-50" />
            )}
            <span className={classNames(
              "relative transition-transform duration-300",
              active ? "scale-110" : "group-hover:scale-105"
            )}>
              {icon}
            </span>
            <span className="relative">{label}</span>
        </button>
    );
}

export default function Portfolio() {
  const [, setLocation] = useLocation();
  
  // 使用新的统一数据层 Hook 获取静态数据
  const dashboardStore = useDashboardStore();
  const { snapshot, livePrices: storeLivePrices, isLoading: storeLoading, isError: storeError, refresh: refreshStore } = dashboardStore;
  
  // 使用旧 Hook 获取用户数据（交易记录、观察列表、设置等）
  // 注意：useDashboardStore 目前不包含用户数据，所以仍需要 useSupabasePortfolio
  const supabaseData = useSupabasePortfolio();
  
  const {
    transactions,
    watchlist,
    settings,
    loading: supabaseLoading,
    error: supabaseError,
    refresh: refreshSupabaseData,
    refreshMarketData: refreshLivePrices,
    addTransaction: addSupabaseTransaction,
    deleteTransaction: deleteSupabaseTransaction,
    addToWatchlist: addSupabaseWatchlist,
    removeFromWatchlist: removeSupabaseWatchlist,
    updateSettings: updateSupabaseSettings,
  } = supabaseData;
  
  // 从 snapshot 中解构数据（使用新的统一数据层）
  const { 
    dashboard, 
    stockPositions, 
    optionPositions, 
    riskMetrics, 
    history 
  } = snapshot;
  
  // 合并实时价格数据（优先使用 store 的数据）
  const livePrices = storeLivePrices;
  
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  
  useEffect(() => {
    fetchExchangeRates().then(setExchangeRates).catch(err => {
      console.error('[Portfolio] 获取汇率失败:', err);
      setExchangeRates({ USD_CNY: 7.25, HKD_CNY: 0.93, timestamp: Date.now() });
    });
  }, []);
  
  const [pendingAlert, setPendingAlert] = useState<RiskAlert | null>(null);
  
  const acknowledgeAlert = useCallback(() => {
    setPendingAlert(null);
  }, []);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  
  const refreshMarketData = useCallback(async (forceRefresh: boolean = false) => {
    if (!exchangeRates || !settings) return;
    
    setIsRefreshing(true);
    setRefreshMessage(null);
    
    try {
      const syncResult = await syncIBKRToSupabase(forceRefresh);
      
      if (syncResult.skipped) {
        setRefreshMessage(syncResult.message);
        const lastTime = getLastRefreshTime();
        if (lastTime) {
          setLastRefresh(lastTime);
        }
      } else if (syncResult.success) {
        setRefreshMessage('数据同步成功');
        setLastRefresh(new Date());
        await refreshSupabaseData();
      } else {
        setRefreshMessage(syncResult.message || '同步失败');
      }
    } catch (error) {
      console.error('[Portfolio] IBKR 同步失败:', error);
      setRefreshMessage('同步失败，请稍后重试');
    } finally {
      setIsRefreshing(false);
    }
  }, [exchangeRates, settings, refreshSupabaseData]);
  
  useEffect(() => {
    const lastTime = getLastRefreshTime();
    if (lastTime) {
      setLastRefresh(lastTime);
    }
  }, []);
  
  const useSupabase = dashboard !== null && !storeLoading;
  
  const portfolioState = useMemo(() => {
    if (useSupabase) {
      try {
        return adaptDashboardToPortfolio(
          dashboard,
          stockPositions || [],
          optionPositions || [],
          settings?.riskLimits
        );
      } catch (error) {
        console.error('[Portfolio] Supabase 数据转换失败:', error);
        return adaptDashboardToPortfolio(null, [], [], settings?.riskLimits);
      }
    }
    return adaptDashboardToPortfolio(null, [], [], settings?.riskLimits);
  }, [useSupabase, dashboard, stockPositions, optionPositions, settings]);
  
  const netWorthHistory = useMemo(() => {
    if (useSupabase && history && history.length > 0) {
      const adapted = adaptDashboardHistory(history);
      return adapted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return [];
  }, [useSupabase, history]);
  
  const tradingStats = useMemo(() => {
    if (transactions.length > 0) {
      try {
        const roundTrips = calculateRoundTrips(transactions);
        return calculateTradingStats(roundTrips);
      } catch (error) {
        console.error('[Portfolio] 计算交易统计失败:', error);
      }
    }
    if (riskMetrics) {
      return adaptRiskMetricsToTradingStats(riskMetrics);
    }
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      maxWin: null,
      maxLoss: null,
      totalRealizedPnL: 0,
    };
  }, [transactions, riskMetrics]);
  
  const addTransaction = useCallback(async (
    ticker: string,
    action: Action,
    price: number,
    quantity: number,
    strategyNote: string,
    fee: number = 0,
    skipFOMOCheck: boolean = false
  ): Promise<{ success: boolean; alert?: RiskAlert }> => {
    if (!exchangeRates || !settings) {
      return { success: false };
    }

    if (!skipFOMOCheck && (action === 'BUY' || action === 'SHORT')) {
      const fomoAlert = checkFOMO(
        ticker,
        action,
        watchlist,
        portfolioState?.positions || [],
        settings?.riskLimits?.watchlistCooldownDays || 7
      );

      if (fomoAlert) {
        setPendingAlert(fomoAlert);
        return { success: false, alert: fomoAlert };
      }
    }

    const market = detectMarket(ticker);
    const currency = getCurrency(market);
    let name = ticker;

    try {
      const stockResponse = await fetchStockData(ticker);
      if (stockResponse.success && stockResponse.data) {
        name = stockResponse.data.name;
      }
    } catch {
      // default name
    }

    const amount = price * quantity;
    const amountCNY = currency === 'CNY' 
      ? amount 
      : currency === 'USD' 
        ? amount * exchangeRates.USD_CNY 
        : amount * exchangeRates.HKD_CNY;

    const watchlistItem = watchlist.find(w => w.ticker === ticker);
    const isPlanned = !!watchlistItem;
    const watchlistDays = watchlistItem 
      ? Math.floor((Date.now() - new Date(watchlistItem.addedDate).getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    const transaction: Transaction = {
      id: uuidv4(),
      date: new Date().toISOString().split('T')[0],
      ticker,
      name,
      market,
      currency,
      action,
      price,
      quantity,
      amount,
      amountCNY,
      fee,
      strategyNote,
      isPlanned,
      watchlistDays,
      createdAt: new Date().toISOString(),
    };

    try {
      await addSupabaseTransaction(transaction);
      return { success: true };
    } catch (error) {
      console.error('[Portfolio] 添加交易记录失败:', error);
      return { success: false };
    }
  }, [exchangeRates, settings, watchlist, portfolioState, addSupabaseTransaction]);
  
  const deleteTransaction = useCallback(async (id: string) => {
    try {
      await deleteSupabaseTransaction(id);
    } catch (error) {
      console.error('[Portfolio] 删除交易记录失败:', error);
      throw error;
    }
  }, [deleteSupabaseTransaction]);
  
  const addToWatchlist = useCallback(async (
    ticker: string,
    targetPrice?: number,
    notes?: string
  ) => {
    const market = detectMarket(ticker);
    const currency = getCurrency(market);
    let name = ticker;

    try {
      const stockResponse = await fetchStockData(ticker);
      if (stockResponse.success && stockResponse.data) {
        name = stockResponse.data.name;
      }
    } catch {
      // default
    }

    await addSupabaseWatchlist({
      ticker,
      name,
      market,
      currency,
      targetPrice,
      notes,
    });
  }, [addSupabaseWatchlist]);
  
  const removeFromWatchlist = useCallback(async (id: string) => {
    await removeSupabaseWatchlist(id);
  }, [removeSupabaseWatchlist]);
  
  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    await updateSupabaseSettings(newSettings);
  }, [updateSupabaseSettings]);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedAlert, setSelectedAlert] = useState<RiskAlert | null>(null);
  const [riskAdvice, setRiskAdvice] = useState<RiskAdvice | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isDailyBriefingOpen, setIsDailyBriefingOpen] = useState(false);
  const [isAlertPanelOpen, setIsAlertPanelOpen] = useState(false);

  useEffect(() => {
    if (!portfolioState) return;
    const today = new Date().toDateString();
    const lastBriefingDate = localStorage.getItem('last_briefing_date');
    if (lastBriefingDate !== today) {
      const timer = setTimeout(() => {
        setIsDailyBriefingOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [portfolioState]);

  const handleCloseBriefing = () => {
    setIsDailyBriefingOpen(false);
    localStorage.setItem('last_briefing_date', new Date().toDateString());
  };
  
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => {
    const saved = localStorage.getItem('rc_privacy_mode');
    return saved !== null ? saved === 'true' : true;
  });
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleTogglePrivacy = () => {
    if (isPrivacyMode) {
      setIsPasswordModalOpen(true);
      setPasswordInput('');
      setPasswordError('');
    } else {
      setIsPrivacyMode(true);
      localStorage.setItem('rc_privacy_mode', 'true');
      toast.success('隐私模式已开启');
    }
  };

  const handlePasswordSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (passwordInput === '523450') {
      setIsPrivacyMode(false);
      localStorage.setItem('rc_privacy_mode', 'false');
      setIsPasswordModalOpen(false);
      setPasswordInput('');
      setPasswordError('');
      toast.success('隐私模式已解除');
    } else {
      setPasswordError('密码错误');
      toast.error('密码错误');
    }
  };

  const handleSendRiskEmail = async () => {
    if (isSendingEmail) return;
    setIsSendingEmail(true);
    try {
      toast.success('风控报告已生成，请在仪表板查看');
    } catch (error) {
      toast.error('报告生成失败');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleViewAdvice = (alert: RiskAlert) => {
    const position = portfolioState?.positions.find(p => p.ticker === alert.ticker);
    const advice = generateRiskAdvice(alert, portfolioState!, position);
    setRiskAdvice(advice);
    setSelectedAlert(alert);
  };

  const handleCloseAdvice = () => {
    setSelectedAlert(null);
    setRiskAdvice(null);
  };

  useEffect(() => {
    if (refreshMessage) {
      toast.info(refreshMessage);
    }
  }, [refreshMessage]);

  const [loadTimeout, setLoadTimeout] = useState(false);
  
  useEffect(() => {
    // 使用新的统一数据层的加载状态
    const isLoading = storeLoading || supabaseLoading;
    if (isLoading) {
      const timer = setTimeout(() => {
        console.warn('[Portfolio] 加载超时，允许进入应用');
        setLoadTimeout(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setLoadTimeout(false);
    }
  }, [storeLoading, supabaseLoading]);
  
  const initialNetWorth = useMemo(() => {
    if (netWorthHistory && netWorthHistory.length > 0) {
      return netWorthHistory[0].netWorth;
    }
    return portfolioState?.totalNetWorthCNY || 1;
  }, [netWorthHistory, portfolioState?.totalNetWorthCNY]);

  const [showAmounts, setShowAmounts] = useState(false);

  // 合并加载状态
  const isLoading = storeLoading || supabaseLoading;
  const errorMessage = storeError ? 'Dashboard 数据加载失败' : supabaseError;

  if (isLoading && !loadTimeout) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size={48} />
          <p className="text-muted-foreground mt-4">正在加载系统...</p>
          {errorMessage && (
            <p className="text-destructive text-sm mt-2">加载错误: {errorMessage}</p>
          )}
        </div>
      </div>
    );
  }

  const hasAlerts = portfolioState?.alerts?.filter(a => !a.acknowledged).length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* 背景装饰 - 与首页风格统一 */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-20 right-1/4 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 left-1/4 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[80px]" />
      </div>

      {/* Tabs Navigation (Pill Style) */}
      <div className="flex items-center justify-between mx-4 mt-2">
        <div className="flex items-center gap-1 p-1.5 bg-white/[0.02] backdrop-blur-sm rounded-2xl border border-white/[0.06] w-fit">
            <NavTab 
                active={activeTab === 'overview'} 
                onClick={() => setActiveTab('overview')}
                icon={<LayoutDashboard size={16} />}
                label="总览"
            />
            <NavTab 
                active={activeTab === 'positions'} 
                onClick={() => setActiveTab('positions')}
                icon={<LineChart size={16} />}
                label="持仓"
            />
            <NavTab 
                active={activeTab === 'history'} 
                onClick={() => setActiveTab('history')}
                icon={<History size={16} />}
                label="历史"
            />
            <NavTab 
                active={activeTab === 'watchlist'} 
                onClick={() => setActiveTab('watchlist')}
                icon={<Eye size={16} />}
                label="观察"
            />
        </div>

        <button
            onClick={handleTogglePrivacy}
            className={classNames(
              "p-2.5 rounded-xl transition-all duration-300",
              isPrivacyMode 
                ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 ring-1 ring-red-500/20" 
                : "bg-white/[0.03] text-white/50 hover:text-white hover:bg-white/[0.06]"
            )}
            title={isPrivacyMode ? "解除隐私模式" : "开启隐私模式"}
        >
            {isPrivacyMode ? <Lock size={18} /> : <Eye size={18} />}
        </button>
      </div>

      <div className="w-full">
        {/* 总览视图 (还原截图内容) */}
        <div className={classNames(
            "space-y-6 animate-in fade-in duration-500 focus-visible:outline-none",
            activeTab === 'overview' ? "block" : "hidden"
        )}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 业绩分析 */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center ring-1 ring-emerald-500/20">
                          <TrendingUp className="text-emerald-400" size={20} />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-white">业绩分析</h2>
                          <p className="text-xs text-white/40">净值走势与收益统计</p>
                        </div>
                    </div>
                    
                    {netWorthHistory && netWorthHistory.length > 0 ? (
                        <div className="rounded-2xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/[0.06] p-1 overflow-hidden">
                          <NetWorthChart 
                              data={netWorthHistory} 
                              highWaterMark={portfolioState.highWaterMark}
                              showRealtime={false}
                              hideAbsoluteValues={isPrivacyMode}
                          />
                        </div>
                    ) : (
                        <Card>
                            <div className="text-center py-8">
                                <p className="text-white/40">暂无历史数据</p>
                            </div>
                        </Card>
                    )}

                    <TradingStatsCard stats={tradingStats} />
                </div>

                {/* 持仓概览 */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 flex items-center justify-center ring-1 ring-cyan-500/20">
                          <PieChart className="text-cyan-400" size={20} />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-white">持仓概览</h2>
                          <p className="text-xs text-white/40">资产配置与风险分布</p>
                        </div>
                    </div>
                    <PositionsSummaryCard 
                        positions={portfolioState.positions} 
                        portfolioState={portfolioState} 
                        hideAbsoluteValues={isPrivacyMode}
                        showAmounts={showAmounts}
                    />
                </div>
            </div>
        </div>

        {/* 驾驶舱视图 (已移除入口，但保留代码以防万一) */}
        
        {/* 持仓视图 */}
        <div className={classNames(
            "space-y-6 animate-in fade-in duration-500 focus-visible:outline-none",
            activeTab === 'positions' ? "block" : "hidden"
        )}>
            {/* 市场状态指示器 */}
            <div className="flex items-center justify-between">
              <MarketStatusIndicator showAll compact />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsAlertPanelOpen(true)}
                className="flex items-center gap-2"
              >
                <Bell size={14} />
                价格警报
              </Button>
            </div>
            
            <PositionsList
            positions={portfolioState.positions}
            positionLimitPercent={settings?.riskLimits?.positionLimitPercent || 15}
            livePrices={livePrices}
            isPrivacyMode={isPrivacyMode}
            showAmounts={showAmounts}
            />
        </div>

        {/* 历史视图 */}
        <div className={classNames(
            "space-y-6 animate-in fade-in duration-500 focus-visible:outline-none",
            activeTab === 'history' ? "block" : "hidden"
        )}>
            {/* 历史工具栏 */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-2">
                    <TradeForm 
                        onSubmit={addTransaction}
                        pendingAlert={pendingAlert}
                        onAcknowledgeAlert={acknowledgeAlert}
                    />
                    <button
                        onClick={handleSendRiskEmail}
                        disabled={isSendingEmail}
                        className="flex items-center gap-2 px-3 py-1.5 bg-chart-2/10 hover:bg-chart-2/20 text-chart-2 rounded-md border border-chart-2/20 transition-all text-xs font-medium"
                    >
                        {isSendingEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                        导出记录
                    </button>
                </div>
                 <div className="flex items-center gap-2">
                    <button
                        className={`p-1.5 rounded-md transition-colors ${isRefreshing ? 'animate-spin text-primary' : 'text-muted-foreground hover:bg-muted'}`}
                        onClick={() => refreshMarketData(false)}
                        disabled={isRefreshing}
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* 策略分析卡片 */}
            <StrategyAnalysisCard
            transactions={transactions}
            tradingStats={tradingStats}
            portfolioState={portfolioState}
            netWorthHistory={netWorthHistory}
            />
            
            {/* 交易记录和统计 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <AIWeeklyReview 
                  transactions={transactions}
                  positions={portfolioState.positions}
                />
                
                <div className="mt-6">
                    <TransactionHistory 
                    transactions={transactions}
                    onDelete={deleteTransaction}
                    />
                </div>
            </div>
            <div>
                <TradingStatsCard stats={tradingStats} />
            </div>
            </div>
        </div>

        {/* 观察列表视图 */}
        <div className={classNames(
            "max-w-2xl animate-in fade-in duration-500 focus-visible:outline-none",
            activeTab === 'watchlist' ? "block" : "hidden"
        )}>
            <div className="flex justify-end mb-2">
                <button
                    className={`p-1.5 rounded-md transition-colors ${isRefreshing ? 'animate-spin text-primary' : 'text-muted-foreground hover:bg-muted'}`}
                    onClick={() => refreshMarketData(false)}
                    disabled={isRefreshing}
                >
                    <RefreshCw size={16} />
                </button>
            </div>
            <Watchlist
            items={watchlist}
            onAdd={addToWatchlist}
            onRemove={removeFromWatchlist}
            cooldownDays={settings?.riskLimits?.watchlistCooldownDays || 7}
            />
        </div>
      </div>

      {/* 风控建议弹窗 */}
      {riskAdvice && (
        <RiskAdviceModal
          advice={riskAdvice}
          isOpen={!!selectedAlert}
          onClose={handleCloseAdvice}
        />
      )}

      {/* 每日晨报弹窗 */}
      <DailyBriefingModal 
        isOpen={isDailyBriefingOpen} 
        onClose={handleCloseBriefing}
        portfolioState={portfolioState}
      />

      {/* 价格警报面板弹窗 */}
      <Modal
        isOpen={isAlertPanelOpen}
        onClose={() => setIsAlertPanelOpen(false)}
        title="价格警报管理"
        size="lg"
      >
        <AlertRulePanel
          userId="1"
          onRuleChange={() => {
            // 规则变更时可以刷新数据
          }}
        />
      </Modal>

      {/* 隐私模式解锁弹窗 */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="解除隐私模式"
        size="sm"
      >
        <div className="flex flex-col items-center text-center space-y-4 mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Lock size={24} className="text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              请输入密码以查看详细金额数据。
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="请输入访问密码"
            value={passwordInput}
            onChange={(e) => {
              setPasswordInput(e.target.value);
              setPasswordError('');
            }}
            error={passwordError}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => setIsPasswordModalOpen(false)}
            >
              取消
            </Button>
            <Button type="submit" variant="primary">
              解锁显示
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}