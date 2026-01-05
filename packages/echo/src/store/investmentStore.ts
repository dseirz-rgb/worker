/**
 * 投资模块 MobX Store (InvestmentStore)
 * 
 * 管理投资模块的状态，包括持仓、风险指标、价格警报
 * 集成 packages/shared 的服务：
 * - DualDatabaseClient - 双数据库客户端
 * - CircuitBreakerService - 熔断服务
 * - PriceAlertService - 价格警报服务
 * 
 * **Validates: Requirements 2.3, 3.4**
 * 
 * @module @echoai/store/investmentStore
 */

import { makeAutoObservable, runInAction } from 'mobx';
import { Store } from './standard/base';
import { 
  DualDatabaseClient, 
  getDatabaseClient, 
  initDatabaseClient,
  type DatabaseConfig 
} from '@echoai/shared/database';
import { 
  CircuitBreakerService, 
  getCircuitBreaker, 
  initCircuitBreaker,
  type RiskMetrics,
  type CircuitBreakerState,
  type TradingDecision,
} from '@echoai/shared/riskcontrol/circuit-breaker';
import { 
  PriceAlertService, 
  getAlertService, 
  initAlertService,
  type PriceAlertRule,
  type AlertTrigger,
  type PriceData,
} from '@echoai/shared/riskcontrol/price-alert';

// ============================================
// 类型定义
// ============================================

/**
 * 持仓数据类型
 * 从 RiskControl 数据库获取
 */
export interface Position {
  id: string;
  ticker: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  weight: number;
  assetType: 'stock' | 'option' | 'crypto' | 'etf' | 'bond';
  sector?: string;
  lastUpdated: Date;
}

/**
 * 价格警报类型（扩展 PriceAlertRule）
 */
export interface PriceAlert extends PriceAlertRule {
  priority?: 'low' | 'medium' | 'high';
  triggered?: boolean;
}

/**
 * 加载状态
 */
interface LoadingState {
  positions: boolean;
  riskMetrics: boolean;
  alerts: boolean;
}

/**
 * 错误状态
 */
interface ErrorState {
  positions: string | null;
  riskMetrics: string | null;
  alerts: string | null;
}

// ============================================
// InvestmentStore
// ============================================

export class InvestmentStore implements Store {
  sid = 'InvestmentStore';

  // 持仓数据
  positions: Position[] = [];

  // Dashboard 快照（包含净值、盈亏等汇总数据）
  dashboardSnapshot: {
    netWorthCNY: number;
    netWorthUSD: number;
    dailyPnL: number;
    dailyPnLPercent: number;
    drawdownPercent: number;
    cashRatio: number;
    longRatio: number;
  } | null = null;

  // 风险指标
  riskMetrics: RiskMetrics | null = null;

  // 熔断器状态
  circuitBreakerStates: CircuitBreakerState[] = [];

  // 交易决策
  tradingDecision: TradingDecision | null = null;

  // 价格警报
  alerts: PriceAlert[] = [];

  // 最近触发的警报
  recentTriggers: AlertTrigger[] = [];

  // 加载状态
  loading: LoadingState = {
    positions: false,
    riskMetrics: false,
    alerts: false,
  };

  // 错误状态
  errors: ErrorState = {
    positions: null,
    riskMetrics: null,
    alerts: null,
  };

  // 服务实例
  private databaseClient: DualDatabaseClient | null = null;
  private circuitBreaker: CircuitBreakerService | null = null;
  private priceAlertService: PriceAlertService | null = null;

  constructor() {
    makeAutoObservable(this);
    this.initServices();
  }

  // ============================================
  // 服务初始化
  // ============================================

  /**
   * 初始化共享服务
   * 
   * 使用统一的 Supabase 配置（Echo 和 RiskControl 共用一个实例）
   * 环境变量: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
   */
  private initServices(): void {
    // 获取或初始化数据库客户端
    this.databaseClient = getDatabaseClient();
    if (!this.databaseClient) {
      // 从环境变量初始化（使用统一的 Supabase 配置）
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      
      const config: DatabaseConfig = {
        // Echo 和 RiskControl 共用同一个 Supabase 实例
        rcSupabaseUrl: supabaseUrl,
        rcSupabaseAnonKey: supabaseAnonKey,
        echoSupabaseUrl: supabaseUrl,
        echoSupabaseAnonKey: supabaseAnonKey,
      };
      
      if (config.rcSupabaseUrl && config.rcSupabaseAnonKey) {
        this.databaseClient = initDatabaseClient(config);
        console.log('[InvestmentStore] 数据库客户端初始化成功');
      } else {
        console.warn('[InvestmentStore] 缺少 Supabase 环境变量配置');
      }
    }

    // 获取或初始化熔断服务
    this.circuitBreaker = getCircuitBreaker();
    if (!this.circuitBreaker) {
      this.circuitBreaker = initCircuitBreaker();
    }

    // 获取或初始化价格警报服务
    this.priceAlertService = getAlertService();
    if (!this.priceAlertService) {
      this.priceAlertService = initAlertService();
    }
  }

  // ============================================
  // 数据获取方法
  // ============================================

  /**
   * 获取持仓数据
   * 从 RiskControl 数据库的 stock_positions 表获取
   * 
   * 注意：实际表名是 stock_positions，字段映射：
   * - weight_percent -> weight
   * - updated_at -> lastUpdated
   * - position_type 用于推断 assetType
   */
  async fetchPositions(): Promise<void> {
    if (!this.databaseClient) {
      runInAction(() => {
        this.errors.positions = '数据库客户端未初始化';
      });
      return;
    }

    runInAction(() => {
      this.loading.positions = true;
      this.errors.positions = null;
    });

    try {
      const client = this.databaseClient.riskcontrol;
      
      // 获取最新日期的持仓快照
      const { data, error } = await client
        .from('stock_positions')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .order('market_value', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      // 只取最新日期的数据
      const latestDate = data?.[0]?.snapshot_date;
      const latestPositions = latestDate 
        ? data.filter(row => row.snapshot_date === latestDate)
        : [];

      runInAction(() => {
        // 转换数据库字段名到驼峰命名
        // 优先使用 CNY 字段，如果没有则用 USD 字段 * 汇率
        const USD_CNY = 7.04;
        this.positions = latestPositions.map(row => ({
          id: String(row.id),
          ticker: row.ticker,
          name: row.name || row.ticker,
          quantity: row.quantity,
          avgCost: Number(row.avg_cost) || 0,
          currentPrice: Number(row.current_price) || 0,
          // 使用 CNY 市值
          marketValue: Number(row.market_value_cny) || Number(row.market_value || 0) * USD_CNY,
          // 使用 CNY 盈亏
          unrealizedPnL: Number(row.unrealized_pnl_cny) || Number(row.unrealized_pnl || 0) * USD_CNY,
          unrealizedPnLPercent: Number(row.unrealized_pnl_percent) || 0,
          weight: Number(row.weight_percent) || 0,
          // 根据 position_type 推断 assetType，默认为 stock
          assetType: this.inferAssetType(row.position_type, row.ticker),
          sector: row.market || undefined, // 使用 market 作为 sector 的替代
          lastUpdated: new Date(row.updated_at || row.snapshot_date),
        }));
        this.loading.positions = false;
      });
    } catch (error) {
      runInAction(() => {
        this.errors.positions = error instanceof Error ? error.message : '获取持仓失败';
        this.loading.positions = false;
      });
    }
  }

  /**
   * 根据 position_type 和 ticker 推断资产类型
   */
  private inferAssetType(positionType: string | null, ticker: string): Position['assetType'] {
    if (positionType === 'SHORT') return 'stock';
    if (positionType === 'LONG') return 'stock';
    
    // 根据 ticker 特征推断
    const upperTicker = ticker.toUpperCase();
    if (upperTicker.includes('ETF') || ['SPY', 'QQQ', 'IWM', 'VTI', 'VOO'].includes(upperTicker)) {
      return 'etf';
    }
    if (upperTicker.includes('BTC') || upperTicker.includes('ETH') || upperTicker.includes('COIN')) {
      return 'crypto';
    }
    
    return 'stock';
  }

  /**
   * 获取风险指标和 Dashboard 数据
   * 从 dashboard_snapshots 表获取最新快照，并构建 RiskMetrics
   * 
   * 注意：dashboard_snapshots 表没有 risk_metrics JSONB 字段，
   * 需要从独立字段构建 RiskMetrics 对象
   */
  async fetchRiskMetrics(): Promise<void> {
    if (!this.databaseClient) {
      runInAction(() => {
        this.errors.riskMetrics = '数据库客户端未初始化';
      });
      return;
    }

    runInAction(() => {
      this.loading.riskMetrics = true;
      this.errors.riskMetrics = null;
    });

    try {
      const client = this.databaseClient.riskcontrol;
      
      // 获取最新的 dashboard 快照
      const { data, error } = await client
        .from('dashboard_snapshots')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw new Error(error.message);
      }

      // 从 dashboard_snapshots 字段构建 RiskMetrics
      const metrics: RiskMetrics = {
        leverage: Number(data?.leverage_ratio) || 1.0,
        monthlyDrawdown: Number(data?.drawdown_percent) || 0,
        dailyDrawdown: Number(data?.daily_pnl_percent) < 0 ? Math.abs(Number(data?.daily_pnl_percent)) : 0,
        consecutiveLosses: 0, // 需要从历史数据计算，暂时设为 0
        maxPositionWeight: Number(data?.long_ratio) || 0,
        portfolioVolatility: 0, // 需要从 risk_metrics 表获取，暂时设为 0
      };

      // 使用熔断服务检查风险
      let decision: TradingDecision | null = null;
      let breakerStates: CircuitBreakerState[] = [];

      if (this.circuitBreaker) {
        decision = this.circuitBreaker.checkRiskMetrics(metrics);
        breakerStates = this.circuitBreaker.getAllBreakerStates();
      }

      runInAction(() => {
        this.riskMetrics = metrics;
        this.tradingDecision = decision;
        this.circuitBreakerStates = breakerStates;
        
        // 保存 Dashboard 快照数据
        this.dashboardSnapshot = {
          netWorthCNY: Number(data?.net_worth_cny) || 0,
          netWorthUSD: Number(data?.net_worth_usd) || 0,
          dailyPnL: Number(data?.daily_pnl) || 0,
          dailyPnLPercent: Number(data?.daily_pnl_percent) || 0,
          drawdownPercent: Number(data?.drawdown_percent) || 0,
          cashRatio: Number(data?.cash_ratio) || 0,
          longRatio: Number(data?.long_ratio) || 0,
        };
        
        this.loading.riskMetrics = false;
      });
    } catch (error) {
      runInAction(() => {
        this.errors.riskMetrics = error instanceof Error ? error.message : '获取风险指标失败';
        this.loading.riskMetrics = false;
      });
    }
  }

  /**
   * 获取价格警报
   * 优先从 PriceAlertService 获取（内存中的规则）
   * 
   * 注意：数据库中没有 price_alerts 表，警报功能完全由 PriceAlertService 管理
   * 如果需要持久化，应该在 user_settings 表的 risk_limits JSONB 中存储
   */
  async fetchAlerts(): Promise<void> {
    runInAction(() => {
      this.loading.alerts = true;
      this.errors.alerts = null;
    });

    try {
      // 从本地服务获取警报规则（PriceAlertService 是内存存储）
      if (this.priceAlertService) {
        const rules = this.priceAlertService.getAllRules();
        
        runInAction(() => {
          this.alerts = rules.map(rule => ({
            ...rule,
            priority: this.calculateAlertPriority(rule),
            triggered: rule.lastTriggeredAt !== null,
          }));
          this.loading.alerts = false;
        });
      } else {
        // 服务未初始化，返回空列表
        runInAction(() => {
          this.alerts = [];
          this.loading.alerts = false;
        });
      }
    } catch (error) {
      runInAction(() => {
        this.errors.alerts = error instanceof Error ? error.message : '获取警报失败';
        this.loading.alerts = false;
      });
    }
  }

  // ============================================
  // 计算属性
  // ============================================

  /**
   * 活跃警报数量（用于侧边栏徽章）
   * 
   * **Property 2: 侧边栏警报徽章准确性**
   * **Validates: Requirements 3.4**
   */
  get activeAlertCount(): number {
    return this.alerts.filter(a => a.enabled && !a.triggered).length;
  }

  /**
   * 是否有高优先级警报
   */
  get hasHighPriorityAlert(): boolean {
    return this.alerts.some(a => a.priority === 'high' && a.enabled && !a.triggered);
  }

  /**
   * 账户净值（CNY）
   * 优先使用 dashboard_snapshots 的 net_worth_cny
   * 这是账户的真实净值，包含现金和持仓
   */
  get accountNetWorth(): number {
    return this.dashboardSnapshot?.netWorthCNY || 0;
  }

  /**
   * 总持仓市值（CNY）
   * 从 positions 累加，仅代表持仓市值，不包含现金
   */
  get totalMarketValue(): number {
    return this.positions.reduce((sum, p) => sum + p.marketValue, 0);
  }

  /**
   * 日盈亏
   */
  get dailyPnL(): number {
    return this.dashboardSnapshot?.dailyPnL || 0;
  }

  /**
   * 日盈亏百分比
   */
  get dailyPnLPercent(): number {
    return this.dashboardSnapshot?.dailyPnLPercent || 0;
  }

  /**
   * 总未实现盈亏（CNY）
   */
  get totalUnrealizedPnL(): number {
    return this.positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  }

  /**
   * 总未实现盈亏百分比
   */
  get totalUnrealizedPnLPercent(): number {
    const totalCost = this.positions.reduce((sum, p) => sum + (p.avgCost * p.quantity), 0);
    if (totalCost === 0) return 0;
    return (this.totalUnrealizedPnL / totalCost) * 100;
  }

  /**
   * 是否有触发的熔断器
   */
  get hasTriggeredBreaker(): boolean {
    return this.circuitBreakerStates.some(s => s.status === 'open');
  }

  /**
   * 风险等级
   */
  get riskLevel(): 'low' | 'medium' | 'high' | 'critical' {
    if (!this.tradingDecision) return 'low';
    
    const blockedCount = this.tradingDecision.blockedBy.length;
    const warningCount = this.tradingDecision.warnings.length;

    if (blockedCount >= 2) return 'critical';
    if (blockedCount >= 1) return 'high';
    if (warningCount >= 2) return 'medium';
    return 'low';
  }

  // ============================================
  // 操作方法
  // ============================================

  /**
   * 添加价格警报
   */
  addAlert(rule: Omit<PriceAlertRule, 'id' | 'createdAt' | 'lastTriggeredAt' | 'triggerCount'>): PriceAlert | null {
    if (!this.priceAlertService) return null;

    try {
      const newRule = this.priceAlertService.addRule(rule);
      const alert: PriceAlert = {
        ...newRule,
        priority: this.calculateAlertPriority(newRule),
        triggered: false,
      };

      runInAction(() => {
        this.alerts.push(alert);
      });

      return alert;
    } catch (error) {
      console.error('添加警报失败:', error);
      return null;
    }
  }

  /**
   * 删除价格警报
   */
  removeAlert(ruleId: string): boolean {
    if (!this.priceAlertService) return false;

    const success = this.priceAlertService.removeRule(ruleId);
    if (success) {
      runInAction(() => {
        this.alerts = this.alerts.filter(a => a.id !== ruleId);
      });
    }
    return success;
  }

  /**
   * 切换警报启用状态
   */
  toggleAlert(ruleId: string): boolean {
    if (!this.priceAlertService) return false;

    const alert = this.alerts.find(a => a.id === ruleId);
    if (!alert) return false;

    const success = this.priceAlertService.setRuleEnabled(ruleId, !alert.enabled);
    if (success) {
      runInAction(() => {
        const idx = this.alerts.findIndex(a => a.id === ruleId);
        if (idx !== -1) {
          this.alerts[idx] = { ...this.alerts[idx], enabled: !alert.enabled };
        }
      });
    }
    return success;
  }

  /**
   * 检查价格数据并触发警报
   */
  checkPriceData(data: PriceData): AlertTrigger[] {
    if (!this.priceAlertService) return [];

    const triggers = this.priceAlertService.checkPriceData(data);
    
    if (triggers.length > 0) {
      runInAction(() => {
        this.recentTriggers = [...triggers, ...this.recentTriggers].slice(0, 50);
        
        // 更新警报状态
        for (const trigger of triggers) {
          const idx = this.alerts.findIndex(a => a.id === trigger.ruleId);
          if (idx !== -1) {
            this.alerts[idx] = { 
              ...this.alerts[idx], 
              triggered: true,
              lastTriggeredAt: trigger.triggeredAt,
              triggerCount: this.alerts[idx].triggerCount + 1,
            };
          }
        }
      });
    }

    return triggers;
  }

  /**
   * 重置熔断器
   */
  resetCircuitBreaker(type: string): boolean {
    if (!this.circuitBreaker) return false;

    const success = this.circuitBreaker.resetBreaker(type as any);
    if (success) {
      runInAction(() => {
        this.circuitBreakerStates = this.circuitBreaker!.getAllBreakerStates();
        this.tradingDecision = this.riskMetrics 
          ? this.circuitBreaker!.checkRiskMetrics(this.riskMetrics)
          : null;
      });
    }
    return success;
  }

  /**
   * 刷新所有数据
   */
  async refreshAll(): Promise<void> {
    await Promise.all([
      this.fetchPositions(),
      this.fetchRiskMetrics(),
      this.fetchAlerts(),
    ]);
  }

  /**
   * 清除所有数据
   */
  clear(): void {
    runInAction(() => {
      this.positions = [];
      this.riskMetrics = null;
      this.circuitBreakerStates = [];
      this.tradingDecision = null;
      this.alerts = [];
      this.recentTriggers = [];
      this.loading = { positions: false, riskMetrics: false, alerts: false };
      this.errors = { positions: null, riskMetrics: null, alerts: null };
    });
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 计算警报优先级
   */
  private calculateAlertPriority(rule: PriceAlertRule): 'low' | 'medium' | 'high' {
    // 根据警报类型和阈值计算优先级
    if (rule.type === 'rsi_overbought' || rule.type === 'rsi_oversold') {
      return 'high';
    }
    if (rule.type === 'percent_change' && rule.threshold > 0.1) {
      return 'high';
    }
    if (rule.type === 'volume_spike') {
      return 'medium';
    }
    return 'low';
  }

  // ============================================
  // React Hook
  // ============================================

  /**
   * 初始化方法
   * 在组件中调用以加载数据
   */
  use(): void {
    // 直接调用，不使用 useEffect
    // useEffect 应该在组件中使用，而不是在 store 中
    this.refreshAll();
  }
}

// ============================================
// 导出
// ============================================

export default InvestmentStore;
