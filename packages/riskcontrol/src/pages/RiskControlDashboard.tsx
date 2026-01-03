import React, { useState, useEffect } from 'react';
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
  BookOpen,
  Calculator,
  Trophy
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  NetWorthCard, 
  DrawdownCard, 
  CashCard, 
  AllocationCard,
  AlertsCard,
  QuickStatsCard,
  LeverageCard
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
import { RiskAdviceModal } from '@/components/dashboard/RiskAdviceModal';
import { DailyBriefingModal } from '@/components/dashboard/DailyBriefingModal';
import { generateRiskAdvice, type RiskAdvice } from '@/services/riskAdvice';
import { useSupabasePortfolio } from "@/hooks/useSupabasePortfolio";
import { adaptDashboardToPortfolio, adaptDashboardHistory, adaptRiskMetricsToTradingStats } from "@/adapters/supabaseToPortfolio";
import { calculateRoundTrips, calculateTradingStats, checkFOMO } from "@/services/riskEngine";
import type { Transaction, TimeCapsule, RiskAlert, Action, ExchangeRates, AppSettings } from "@/types";
import { fetchExchangeRates, fetchStockData, detectMarket, getCurrency, getExpectedDataDate } from "@/services/marketData";
import { v4 as uuidv4 } from 'uuid';
import { syncIBKRToSupabase, getLastRefreshTime } from "@/services/ibkrFlexQuery";
import { RiskMetricsCard } from "@/components/dashboard/RiskMetricsCard";
import { PositionsSummaryCard } from "@/components/dashboard/PositionsSummaryCard";
import { HistoryDataCard } from "@/components/dashboard/HistoryDataCard";
import { CostAnalysisChart } from "@/components/dashboard/CostAnalysisChart";
import { ReturnAttributionChart } from "@/components/dashboard/ReturnAttributionChart";
import { DeleverageSimulator } from '@/components/dashboard/DeleverageSimulator';
import { checkRiskAlerts } from '@/services/riskAlertService';
import { MarketStatusIndicator } from '@/components/market/MarketStatusIndicator';
import { IntelligentRiskSection } from '@/components/risk/IntelligentRiskSection';

// 不再需要初始化示例数据，完全从 Supabase 加载
type TabId = 'dashboard' | 'positions' | 'history' | 'watchlist';

export function RiskControlDashboard() {
  const [, setLocation] = useLocation();
  // 使用简化的 Supabase 数据源（优化加载策略）
  const supabaseData = useSupabasePortfolio();
  
  // 从 Supabase 获取的数据
  const {
    dashboard,
    riskMetrics,
    stockPositions,
    optionPositions,
    history,
    transactions,
    watchlist,
    settings,
    loading: supabaseLoading,
    error: supabaseError,
    refresh: refreshSupabaseData,
    livePrices, // 解构 livePrices
    refreshMarketData: refreshLivePrices, // 解构 refreshMarketData 并重命名以避免冲突
    addTransaction: addSupabaseTransaction,
    deleteTransaction: deleteSupabaseTransaction,
    addToWatchlist: addSupabaseWatchlist,
    removeFromWatchlist: removeSupabaseWatchlist,
    updateSettings: updateSupabaseSettings,
  } = supabaseData;

  // 检查数据新鲜度
  const [dataStaleWarning, setDataStaleWarning] = React.useState<string | null>(null);

  useEffect(() => {
    if (!dashboard?.date) return;
    
    const expectedDate = getExpectedDataDate();
    const actualDate = new Date(dashboard.date);
    const expectedDateStr = expectedDate.toISOString().split('T')[0];
    const actualDateStr = actualDate.toISOString().split('T')[0];
    
    if (actualDateStr < expectedDateStr) {
      // 检查当前时间是否超过 10:00 北京时间 (UTC+8)
      // 简单判断：获取当前 UTC 小时，北京时间 = UTC + 8
      const now = new Date();
      const utcHour = now.getUTCHours();
      const beijingHour = (utcHour + 8) % 24;
      const hasScriptRun = beijingHour >= 10 || (now.getUTCDate() > expectedDate.getUTCDate()); // 如果跨天了肯定跑过了
      
      if (hasScriptRun) {
        // 计算下次检查时间 (12:00, 14:00, 16:00, 明日 10:00)
        let nextCheck = '10:00';
        if (beijingHour < 12) nextCheck = '12:00';
        else if (beijingHour < 14) nextCheck = '14:00';
        else if (beijingHour < 16) nextCheck = '16:00';
        else nextCheck = '明日 10:00';
        
        setDataStaleWarning(`数据滞后 (${actualDateStr}) · 自动更新已执行 · 暂无新报表 (下次检查: ${nextCheck})`);
      } else {
        setDataStaleWarning(`数据滞后 (${actualDateStr}) · 等待 10:00 自动更新`);
      }
    } else {
      setDataStaleWarning(null);
    }
  }, [dashboard?.date]);
  
  // 汇率（保留在 localStorage 作为缓存，或从 API 获取）
  const [exchangeRates, setExchangeRates] = React.useState<ExchangeRates | null>(null);
  
  // 加载汇率
  React.useEffect(() => {
    fetchExchangeRates().then(setExchangeRates).catch(err => {
      console.error('[App] 获取汇率失败:', err);
      // 使用默认汇率
      setExchangeRates({ USD_CNY: 7.25, HKD_CNY: 0.93, timestamp: Date.now() });
    });
  }, []);
  
  // 风控警报状态
  const [pendingAlert, setPendingAlert] = React.useState<RiskAlert | null>(null);
  
  const acknowledgeAlert = React.useCallback(() => {
    setPendingAlert(null);
  }, []);
  
  // IBKR 同步状态
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [refreshMessage, setRefreshMessage] = React.useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = React.useState<Date | null>(null);
  
  // 同步 IBKR 数据
  const refreshMarketData = React.useCallback(async (forceRefresh: boolean = false) => {
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
        // 刷新 Supabase 数据
        await refreshSupabaseData();
      } else {
        setRefreshMessage(syncResult.message || '同步失败');
      }
    } catch (error) {
      console.error('[App] IBKR 同步失败:', error);
      setRefreshMessage('同步失败，请稍后重试');
    } finally {
      setIsRefreshing(false);
    }
  }, [exchangeRates, settings, refreshSupabaseData]);
  
  // 初始化上次刷新时间
  React.useEffect(() => {
    const lastTime = getLastRefreshTime();
    if (lastTime) {
      setLastRefresh(lastTime);
    }
  }, []);
  
  // 每日自动刷新机制：每天凌晨1点自动刷新数据
  React.useEffect(() => {
    const checkAndRefresh = async () => {
      const now = new Date();
      const lastRefresh = getLastRefreshTime();
      
      // 如果今天还没刷新过，或者上次刷新是昨天，自动刷新
      if (!lastRefresh || lastRefresh.toDateString() !== now.toDateString()) {
        console.log('[App] 检测到需要自动刷新数据（每日刷新）');
        // 延迟5秒执行，避免影响初始加载
        setTimeout(() => {
          refreshMarketData(false).catch(err => {
            console.error('[App] 自动刷新失败:', err);
          });
        }, 5000);
      }
    };
    
    // 立即检查一次
    checkAndRefresh();
    
    // 每小时检查一次（确保不会错过）
    const interval = setInterval(checkAndRefresh, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [refreshMarketData]);

  // 判断是否使用 Supabase 数据：必须有数据且不在加载中
  const useSupabase = dashboard !== null && !supabaseLoading;
  
  // 如果 Supabase 有错误，记录
  useEffect(() => {
    if (supabaseError) {
      console.warn('[App] Supabase 数据加载失败:', supabaseError);
    }
  }, [supabaseError]);
  
  // 转换 Supabase 数据到应用格式
  const portfolioState = React.useMemo(() => {
    if (useSupabase) {
      console.log(`[App] Converting data. Dashboard: ${!!dashboard}, StockPositions: ${stockPositions?.length}`);
      try {
        // 即使 dashboard 为 null，adaptDashboardToPortfolio 也会返回默认的空状态
        return adaptDashboardToPortfolio(
          dashboard,
          stockPositions || [],
          optionPositions || [],
          settings?.riskLimits
        );
      } catch (error) {
        console.error('[App] Supabase 数据转换失败:', error);
        // 返回默认的空状态而不是 null
        return adaptDashboardToPortfolio(null, [], [], settings?.riskLimits);
      }
    }
    // 如果未使用 Supabase，也返回默认的空状态
    return adaptDashboardToPortfolio(null, [], [], settings?.riskLimits);
  }, [useSupabase, dashboard, stockPositions, optionPositions, settings]);
  
  const netWorthHistory = React.useMemo(() => {
    if (useSupabase && history && history.length > 0) {
      const adapted = adaptDashboardHistory(history);
      // 确保数据按日期排序
      return adapted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return [];
  }, [useSupabase, history]);
  
  // 计算交易统计：从交易记录计算
  const tradingStats = React.useMemo(() => {
    if (transactions.length > 0) {
      try {
        const roundTrips = calculateRoundTrips(transactions);
        const stats = calculateTradingStats(roundTrips);
        console.log('[App] 从交易记录计算交易统计:', stats);
        return stats;
      } catch (error) {
        console.error('[App] 计算交易统计失败:', error);
      }
    }
    
    // 如果没有交易记录，尝试使用风险指标
    if (riskMetrics) {
      const stats = adaptRiskMetricsToTradingStats(riskMetrics);
      console.log('[App] 使用风险指标中的交易统计');
      return stats;
    }
    
    // 返回空统计对象
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
  
  // 添加交易记录（带 FOMO 检查）
  const addTransaction = React.useCallback(async (
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

    // FOMO 检查（仅对买入和做空）
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

    // 获取股票信息
    const market = detectMarket(ticker);
    const currency = getCurrency(market);
    let name = ticker;

    try {
      const stockResponse = await fetchStockData(ticker);
      if (stockResponse.success && stockResponse.data) {
        name = stockResponse.data.name;
      }
    } catch {
      // 使用默认名称
    }

    const amount = price * quantity;
    const amountCNY = currency === 'CNY' 
      ? amount 
      : currency === 'USD' 
        ? amount * exchangeRates.USD_CNY 
        : amount * exchangeRates.HKD_CNY;

    // 检查是否为计划内交易
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
      console.error('[App] 添加交易记录失败:', error);
      return { success: false };
    }
  }, [exchangeRates, settings, watchlist, portfolioState, addSupabaseTransaction]);
  
  // 删除交易记录
  const deleteTransaction = React.useCallback(async (id: string) => {
    try {
      await deleteSupabaseTransaction(id);
    } catch (error) {
      console.error('[App] 删除交易记录失败:', error);
      throw error;
    }
  }, [deleteSupabaseTransaction]);
  
  // 添加观察列表项
  const addToWatchlist = React.useCallback(async (
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
      // 使用默认名称
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
  
  // 删除观察列表项
  const removeFromWatchlist = React.useCallback(async (id: string) => {
    await removeSupabaseWatchlist(id);
  }, [removeSupabaseWatchlist]);
  
  // 更新设置
  const updateSettings = React.useCallback(async (newSettings: Partial<AppSettings>) => {
    await updateSupabaseSettings(newSettings);
  }, [updateSupabaseSettings]);

  // 实时风险监控
  React.useEffect(() => {
    if (!dashboard || !portfolioState) return;
    
    const leverage = (() => {
      // 杠杆率计算：leverage_ratio > 1 才是有效值，否则用 long_ratio 计算
      if (dashboard?.leverage_ratio && Number(dashboard.leverage_ratio) > 1) {
        return Number(dashboard.leverage_ratio);
      }
      if (dashboard?.long_ratio && dashboard.long_ratio > 100) {
        return dashboard.long_ratio / 100;
      }
      return 1.0;
    })();
    
    const drawdownPercent = portfolioState.drawdownPercent;
    const dailyPnLPercent = portfolioState.dailyPnLPercent;
    
    // 检查风险并触发警报
    checkRiskAlerts(leverage, drawdownPercent, dailyPnLPercent, {
      leverageWarning: 2.0,
      leverageCritical: 2.5,
      drawdownWarning: settings?.riskLimits?.maxDrawdownPercent ? settings.riskLimits.maxDrawdownPercent * 0.6 : 3,
      drawdownCritical: settings?.riskLimits?.maxDrawdownPercent || 5,
    });
  }, [dashboard, portfolioState, settings]);

  // 加载状态
  const isLoading = supabaseLoading;
  
  // 添加全局调试函数
  React.useEffect(() => {
    // 确保函数立即挂载到 window 对象
    (window as any).debugTradingStats = () => {
      console.log('=== 交易统计调试信息 ===');
      console.log('📊 Supabase 交易记录数量:', transactions.length);
      
      if (transactions.length > 0) {
        console.log('📋 前5条交易记录:', transactions.slice(0, 5).map(t => ({
          id: t.id,
          date: t.date,
          ticker: t.ticker,
          action: t.action,
          quantity: t.quantity,
          price: t.price,
        })));
        
        // 检查计算逻辑
        const roundTrips = calculateRoundTrips(transactions);
        console.log('🔄 交易回合数量:', roundTrips.length);
        
        if (roundTrips.length > 0) {
          console.log('📈 前3个交易回合:', roundTrips.slice(0, 3).map(rt => ({
            ticker: rt.ticker,
            direction: rt.direction,
            realizedPnL: rt.realizedPnL,
            closedDate: rt.closedDate,
          })));
        }
        
        const stats = calculateTradingStats(roundTrips);
        console.log('📊 计算得到的交易统计:', stats);
      } else {
        console.warn('⚠️ 没有交易记录，请检查：');
        console.warn('  1. IBKR 同步是否成功');
        console.warn('  2. Supabase transactions 表中是否有数据');
        console.warn('  3. 控制台是否有同步错误信息');
      }
      
      console.log('=== 调试信息结束 ===');
    };
    
    // 立即输出提示信息
    console.log('[App] 调试函数已挂载，可在控制台执行: window.debugTradingStats()');
    
    return () => {
      delete (window as any).debugTradingStats;
    };
  }, [transactions]); // 依赖 transactions，当数据更新时函数也会更新

  // 调试日志
  useEffect(() => {
    console.log('[App] 加载状态:', {
      supabaseLoading,
      supabaseError,
      useSupabase,
      hasPortfolioState: !!portfolioState,
      hasSettings: !!settings,
      transactionCount: transactions.length,
      watchlistCount: watchlist.length,
    });
  }, [supabaseLoading, supabaseError, useSupabase, portfolioState, settings, transactions.length, watchlist.length]);

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<RiskAlert | null>(null);
  const [riskAdvice, setRiskAdvice] = useState<RiskAdvice | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isDailyBriefingOpen, setIsDailyBriefingOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false); // Add state for simulator

  // 每日简报检查
  useEffect(() => {
    if (!portfolioState) return;
    
    const today = new Date().toDateString();
    const lastBriefingDate = localStorage.getItem('last_briefing_date');
    
    if (lastBriefingDate !== today) {
      // 延迟一点显示，让用户先看到界面
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
  
  // 浏览器通知权限请求
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // 监听 pendingAlert (交易时触发的 FOMO 等)
  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    if (pendingAlert && pendingAlert.severity === 'CRITICAL') {
        new Notification(`⚠️ 风控警报: ${pendingAlert.ticker}`, {
          body: `${pendingAlert.message}\n请立即处理！`,
          icon: '/favicon.ico', 
          tag: 'risk-alert-pending'
        });
    }
  }, [pendingAlert]);

  // 监听 portfolioState 中的严重警报
  useEffect(() => {
    if (!portfolioState || !('Notification' in window) || Notification.permission !== 'granted') return;

    // 检查 portfolioState 中的所有未确认 Critical 警报 (如回撤 > 5%)
    const criticalAlerts = portfolioState.alerts.filter(a => !a.acknowledged && a.severity === 'CRITICAL');
    
    criticalAlerts.forEach(alert => {
        // 防止重复通知：使用 tag 或检查 localStorage (简化起见，这里依赖 tag 防止堆叠)
        new Notification(`🚨 严重风险: ${alert.title}`, {
            body: `${alert.message}\n当前值: ${alert.value?.toFixed(2)}% (阈值: ${alert.threshold}%)`,
            icon: '/favicon.ico',
            tag: `risk-alert-${alert.id}` // 使用 alert.id 作为 tag，防止同一警报重复弹出
        });
    });
  }, [portfolioState?.alerts]);

  // 隐私模式状态（从 LocalStorage 读取，默认开启）
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => {
    const saved = localStorage.getItem('rc_privacy_mode');
    return saved !== null ? saved === 'true' : true;
  });
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // 切换隐私模式
  const handleTogglePrivacy = () => {
    if (isPrivacyMode) {
      // 如果当前是隐私模式，需要输入密码才能解除
      setIsPasswordModalOpen(true);
      // 重置密码输入状态
      setPasswordInput('');
      setPasswordError('');
    } else {
      // 如果当前是可见模式，直接切换回隐私模式
      setIsPrivacyMode(true);
      localStorage.setItem('rc_privacy_mode', 'true');
      toast.success('隐私模式已开启');
    }
  };

  // 处理密码提交
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

  // 发送风控警报邮件（带密码保护的 HTML 格式）
  const handleSendRiskEmail = async () => {
    if (isSendingEmail) return;
    setIsSendingEmail(true);
    
    try {
      // 准备详细报告数据
      const alerts = portfolioState?.alerts.filter(a => !a.acknowledged) || [];
      
      // 临时替代：直接提示用户查看仪表板
      toast.success('风控报告已生成，请在仪表板查看');
    } catch (error) {
      toast.error('报告生成失败');
      console.error('Send email error:', error);
    } finally {
      setIsSendingEmail(false);
    }
  };

  // 处理查看风控建议
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

  // 显示刷新消息提示
  useEffect(() => {
    if (refreshMessage) {
      toast.info(refreshMessage);
    }
  }, [refreshMessage]);

  // 只等待 Supabase 加载完成，不等待 localStorage
  // 如果 Supabase 还在加载，显示加载状态
  // 添加超时保护：如果加载超过5秒，允许进入应用
  const [loadTimeout, setLoadTimeout] = React.useState(false);
  
  React.useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        console.warn('[App] 加载超时，允许进入应用');
        setLoadTimeout(true);
      }, 5000); // 5秒超时
      return () => clearTimeout(timer);
    } else {
      setLoadTimeout(false);
    }
  }, [isLoading]);
  
  // 计算基准净值本金 (从最早的历史记录获取，如果无记录则用当前净值作为 1.0)
  // 修正：2026-01-01 之前的逻辑
  const initialNetWorth = React.useMemo(() => {
    if (netWorthHistory && netWorthHistory.length > 0) {
        // 取第一条记录的净值作为基准 (1.0)
        return netWorthHistory[0].netWorth;
    }
    // 如果没有历史记录，当前净值就是基准
    return portfolioState?.totalNetWorthCNY || 1;
  }, [netWorthHistory, portfolioState?.totalNetWorthCNY]);

  // 新增：金额显示模式开关 (默认 false = 显示净值, true = 显示金额)
  // 这个开关独立于 privacyMode (打码)，仅控制是否显示"绝对金额"
  const [showAmounts, setShowAmounts] = useState(false);

  // 如果正在加载且未超时，显示加载界面
  if (isLoading && !loadTimeout) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size={48} />
          <p className="text-muted-foreground mt-4">正在加载系统...</p>
          {supabaseError && (
            <p className="text-destructive text-sm mt-2">加载错误: {supabaseError}</p>
          )}
        </div>
      </div>
    );
  }
  // 超时或加载失败时，允许进入应用（显示错误信息）
  if (loadTimeout || (supabaseError && !isLoading)) {
    console.warn('[App] 加载超时或失败，允许进入应用');
  }

  const hasAlerts = portfolioState?.alerts?.filter(a => !a.acknowledged).length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 操作栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        {/* 移动端：使用更紧凑的按钮组 */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <TradeForm 
            onSubmit={addTransaction}
            pendingAlert={pendingAlert}
            onAcknowledgeAlert={acknowledgeAlert}
          />
          <QuickCashForm onSubmit={addTransaction} />
          {/* 发送风控邮件按钮 */}
          <button
            onClick={handleSendRiskEmail}
            disabled={isSendingEmail}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-chart-2/20 hover:bg-chart-2/30 text-chart-2 rounded-lg border border-chart-2/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="立即发送风控报告到邮箱"
          >
            {isSendingEmail ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Mail size={16} />
            )}
            <span className="hidden sm:inline text-sm">发送报告</span>
          </button>
          
          {/* 打开每日简报按钮 */}
          <button
            onClick={() => setIsDailyBriefingOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-accent-purple/20 hover:bg-accent-purple/30 text-accent-purple rounded-lg border border-accent-purple/30 transition-all duration-200"
            title="打开每日风控简报"
          >
            <BookOpen size={16} />
            <span className="hidden sm:inline text-sm">每日简报</span>
          </button>

          {/* 策略推演按钮 */}
          <button
            onClick={() => setIsSimulatorOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-accent-cyan/20 hover:bg-accent-cyan/30 text-accent-cyan rounded-lg border border-accent-cyan/30 transition-all duration-200"
            title="打开去杠杆策略推演"
          >
            <Calculator size={16} />
            <span className="hidden sm:inline text-sm">策略推演</span>
          </button>

          {/* 年度回顾按钮 */}
          <button
            onClick={() => setLocation('/review/2025')}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-accent-purple/20 hover:bg-accent-purple/30 text-accent-purple rounded-lg border border-accent-purple/30 transition-all duration-200"
            title="查看2025年度回顾"
          >
            <Trophy size={16} />
            <span className="hidden sm:inline text-sm">年度回顾</span>
          </button>
        </div>

        {/* 状态信息 - 移动端简化显示 */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground font-mono">
          {dataStaleWarning && (
            <span className="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-1.5 sm:px-2 py-0.5 rounded border border-amber-500/20 text-[10px] sm:text-xs">
              <AlertTriangle size={10} className="sm:w-3 sm:h-3" />
              <span className="hidden sm:inline">{dataStaleWarning}</span>
              <span className="sm:hidden">数据滞后</span>
            </span>
          )}
          {lastRefresh && !dataStaleWarning && (
            <span className="hidden sm:inline">
              更新于 {lastRefresh.toLocaleTimeString('zh-CN')}
            </span>
          )}
          {exchangeRates && (
            <div className="hidden sm:flex items-center gap-2">
              <Badge variant="default" className="bg-card/50 border-border text-muted-foreground">USD/CNY {exchangeRates.USD_CNY?.toFixed(2) ?? '--'}</Badge>
              <Badge variant="default" className="bg-card/50 border-border text-muted-foreground">HKD/CNY {exchangeRates.HKD_CNY?.toFixed(2) ?? '--'}</Badge>
            </div>
          )}
          
          <button
            onClick={handleTogglePrivacy}
            className="p-1.5 hover:bg-muted rounded-full transition-colors"
            title={isPrivacyMode ? "解除隐私模式" : "开启隐私模式"}
          >
             {isPrivacyMode ? <Lock size={14} className="text-accent-red" /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {/* 核心指标卡片 - 移动端优化布局 */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="col-span-2 sm:col-span-1">
          <NetWorthCard
            totalNetWorth={portfolioState.totalNetWorthCNY}
            initialNetWorth={initialNetWorth}
            dailyPnL={portfolioState.dailyPnL}
            dailyPnLPercent={portfolioState.dailyPnLPercent}
            livePrices={livePrices}
            positions={portfolioState.positions}
            isPrivacyMode={isPrivacyMode}
            onToggleShowAmounts={setShowAmounts}
            onTogglePrivacy={handleTogglePrivacy}
            showAmounts={showAmounts}
          />
        </div>
        <LeverageCard
          leverageRatio={(() => {
            // 杠杆率计算：leverage_ratio > 1 才是有效值，否则用 long_ratio 计算
            if (dashboard?.leverage_ratio && Number(dashboard.leverage_ratio) > 1) {
              return Number(dashboard.leverage_ratio);
            }
            if (dashboard?.long_ratio && dashboard.long_ratio > 100) {
              return dashboard.long_ratio / 100;
            }
            return 1.0;
          })()}
          marginLoanCNY={dashboard?.margin_loan_cny ? Number(dashboard.margin_loan_cny) : 0}
          netWorthCNY={dashboard?.net_worth_cny ? Number(dashboard.net_worth_cny) : 0}
          targetLeverage={1.5}
          isPrivacyMode={isPrivacyMode}
        />
        <DrawdownCard
          drawdownPercent={portfolioState.drawdownPercent}
          drawdownAmount={portfolioState.drawdownAmount}
          highWaterMark={portfolioState.highWaterMark}
          maxDrawdownLimit={settings?.riskLimits?.maxDrawdownPercent || 5}
          isPrivacyMode={isPrivacyMode}
        />
        <CashCard
          cashBalance={portfolioState.cashBalance}
          cashRatio={portfolioState.allocation.cashRatio}
          isPrivacyMode={isPrivacyMode}
        />
        <div className="col-span-2 sm:col-span-1">
          <AllocationCard
            cashRatio={portfolioState.allocation.cashRatio}
            longRatio={portfolioState.allocation.longRatio}
            shortRatio={portfolioState.allocation.shortRatio}
          />
        </div>
      </div>

      {/* 交易时段状态指示器 */}
      <div className="mb-4">
        <MarketStatusIndicator showAll showCountdown className="bg-card/50 p-4 rounded-lg border border-border" />
      </div>

      {/* 市场状态监视器 */}
      <MarketStatusCard />

      {/* 恐慌封控规则卡片 */}
      <PanicLockdownCard
        longRatio={portfolioState.allocation.longRatio}
        shortRatio={portfolioState.allocation.shortRatio}
      />

      {/* 智能风控区块 - AI 驱动的风险预测和决策 */}
      <IntelligentRiskSection 
        tickers={portfolioState.positions.map(p => p.ticker).slice(0, 5)}
        market="us"
        showForecast
        showHistory
        showAlerts
      />

      {/* 风控警报 - 始终显示，即使没有警报也显示"系统正常"状态 */}
      <AlertsCard 
        alerts={portfolioState?.alerts || []} 
        onViewAdvice={handleViewAdvice}
        onAcknowledge={acknowledgeAlert}
      />

      {/* 快速统计 */}
      <QuickStatsCard
        positionCount={portfolioState.positions.length}
        watchlistCount={watchlist.length}
        winRate={tradingStats.winRate}
        profitFactor={tradingStats.profitFactor}
      />

      {/* 风险指标卡片 */}
      <RiskMetricsCard riskMetrics={supabaseData.riskMetrics} />

      {/* 持仓概览卡片 */}
      <PositionsSummaryCard 
        positions={portfolioState.positions} 
        portfolioState={portfolioState} 
        hideAbsoluteValues={isPrivacyMode}
        showAmounts={showAmounts}
        livePrices={livePrices}
      />

      {/* 历史数据卡片 */}
      <HistoryDataCard history={netWorthHistory} isPrivacyMode={isPrivacyMode} />

      {/* 净值走势图 - 只显示历史数据，不显示实时数据 */}
      {netWorthHistory && netWorthHistory.length > 0 ? (
        <NetWorthChart 
          data={netWorthHistory} 
          highWaterMark={portfolioState.highWaterMark}
          showRealtime={false}
          hideAbsoluteValues={isPrivacyMode}
        />
      ) : (
        <Card>
          <div className="text-center py-8">
            <p className="text-text-muted">暂无历史数据</p>
          </div>
        </Card>
      )}

      {/* 高级分析图表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ReturnAttributionChart data={supabaseData.returnAttribution} />
          <CostAnalysisChart data={supabaseData.costAnalysis} />
      </div>

      {/* 时光机 (已升级为 AI 智能周复盘) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AIWeeklyReview 
            transactions={transactions}
            positions={portfolioState.positions}
        />
        <TradingStatsCard stats={tradingStats} />
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

      {/* 策略推演弹窗 */}
      <Modal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        title="" // Custom title in component
        size="2xl"
      >
        {portfolioState && (
          <DeleverageSimulator
             positions={portfolioState.positions}
             currentNetEquity={Number(portfolioState.totalNetWorthCNY)}
             currentLeverage={(() => {
               // 杠杆率计算：leverage_ratio > 1 才是有效值，否则用 long_ratio 计算
               if (dashboard?.leverage_ratio && Number(dashboard.leverage_ratio) > 1) {
                 return Number(dashboard.leverage_ratio);
               }
               if (dashboard?.long_ratio && dashboard.long_ratio > 100) {
                 return dashboard.long_ratio / 100;
               }
               return 2.0;
             })()}
             defaultTicker="PDD"
             onClose={() => setIsSimulatorOpen(false)}
          />
        )}
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
