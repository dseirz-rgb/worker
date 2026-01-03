// 交易动作枚举
export enum Action {
  BUY = 'BUY',
  SELL = 'SELL',
  SHORT = 'SHORT',
  COVER = 'COVER',
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  SYNC_BALANCE = 'SYNC_BALANCE'
}

// 货币类型
export type Currency = 'USD' | 'HKD' | 'CNY';

// 市场类型
export type Market = 'US' | 'HK' | 'CN';

// 持仓方向
export type PositionDirection = 'LONG' | 'SHORT';

// 汇率数据
export interface ExchangeRates {
  USD_CNY: number;
  HKD_CNY: number;
  timestamp: number;
}

// 股票信息
export interface StockInfo {
  ticker: string;
  name: string;
  market: Market;
  currency: Currency;
  currentPrice: number;
  previousClose: number;
  changePercent: number;
  lastUpdated: number;
}

// 持仓
export interface Position {
  id: string;
  ticker: string;
  name: string;
  market: Market;
  currency: Currency;
  direction: PositionDirection;
  quantity: number;
  avgCost: number;           // 加权平均成本
  currentPrice: number;
  marketValue: number;       // 市值（原币种）
  marketValueCNY: number;    // 市值（CNY）
  unrealizedPnL: number;     // 未实现盈亏（原币种）
  unrealizedPnLCNY: number;  // 未实现盈亏（CNY）
  unrealizedPnLPercent: number;
  weight: number;            // 占总资产比例
  firstBuyDate: string;
  lastTradeDate: string;
}

// 交易记录
export interface Transaction {
  id: string;
  date: string;
  ticker: string;
  name: string;
  market: Market;
  currency: Currency;
  action: Action;
  price: number;
  quantity: number;
  amount: number;            // 交易金额（原币种）
  amountCNY: number;         // 交易金额（CNY）
  fee: number;               // 手续费
  strategyNote: string;      // 交易策略/理由
  isPlanned: boolean;        // 是否为计划内交易
  watchlistDays?: number;    // 观察天数（如适用）
  followedAIAdvice?: boolean; // 是否遵循 AI 建议
  aiRecommendation?: string;  // 当时的 AI 建议 (BUY/SELL/HOLD)
  createdAt: string;
}

// 成本分析
export interface CostAnalysis {
  date: string;
  totalCommissions: number;
  totalFees: number;
  totalTaxes: number;
  totalCosts: number;
  costToNavRatio: number;
  stockCommissions: number;
  optionCommissions: number;
}

// 收益归因
export interface ReturnAttribution {
  date: string;
  totalReturn: number;
  tradingPnL: number;
  positionPnL: number;
  dividendIncome: number;
  interestIncome: number;
  fxPnL: number;
  optionPnL: number;
  marketReturn: number;
  alphaReturn: number;
}

// 观察列表项
export interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  market: Market;
  currency: Currency;
  addedDate: string;
  targetPrice?: number;
  notes?: string;
  currentPrice?: number;
  changePercent?: number;
}

// 风控警报
export interface RiskAlert {
  id: string;
  type: 'STOP_LOSS' | 'MAX_DRAWDOWN' | 'POSITION_LIMIT' | 'FOMO_WARNING' | 'UNPLANNED_TRADE' | 'SYSTEM_ERROR';
  severity: 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  ticker?: string;
  value?: number;
  threshold?: number;
  timestamp: string;
  acknowledged: boolean;
}

// 现金余额
export interface CashBalance {
  USD: number;
  HKD: number;
  CNY: number;
  totalCNY: number;
}

// 资产配置
export interface Allocation {
  cashRatio: number;
  longRatio: number;
  shortRatio: number;
  cashValueCNY: number;
  longValueCNY: number;
  shortValueCNY: number;
}

// 核心资产状态
export interface PortfolioState {
  totalNetWorthCNY: number;
  cashBalance: CashBalance;
  highWaterMark: number;
  drawdownPercent: number;
  drawdownAmount: number;
  positions: Position[];
  alerts: RiskAlert[];
  allocation: Allocation;
  dailyPnL: number;
  dailyPnLPercent: number;
  totalPnL: number;
  totalPnLPercent: number;
  lastUpdated: string;
}

// 历史净值记录
export interface NetWorthRecord {
  date: string;
  netWorth: number;
  cashRatio: number;
  longRatio: number;
  shortRatio: number;
  highWaterMark: number;
  // 实际金额值（用于堆叠柱状图）
  cashValue?: number;
  longValue?: number;
  shortValue?: number;
}

// 完整交易（Round-trip）
export interface RoundTrip {
  id: string;
  ticker: string;
  name: string;
  direction: PositionDirection;
  entries: Transaction[];
  exits: Transaction[];
  totalQuantity: number;
  avgEntryPrice: number;
  avgExitPrice: number;
  realizedPnL: number;
  realizedPnLPercent: number;
  holdingDays: number;
  closedDate: string;
}

// 交易统计
export interface TradingStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;      // 盈亏比
  maxWin: RoundTrip | null;
  maxLoss: RoundTrip | null;
  totalRealizedPnL: number;
}

// 时光机记录
export interface TimeCapsule {
  transaction: Transaction;
  daysAgo: number;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  needsReview: boolean;
}

// Supabase 配置
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
}

// 个股持仓上限例外
export interface PositionLimitException {
  ticker: string;
  name: string;
  limitPercent: number;  // 该股票的特殊持仓上限
}

// 应用设置
export interface AppSettings {
  supabase: SupabaseConfig;
  defaultCurrency: Currency;
  riskLimits: {
    stopLossPercent: number;      // 止损红线 (默认 -20%)
    maxDrawdownPercent: number;   // 最大回撤 (默认 5%)
    positionLimitPercent: number; // 持仓上限 (默认 15%)
    watchlistCooldownDays: number; // 观察期 (默认 7天)
    positionLimitExceptions?: PositionLimitException[]; // 个股持仓上限例外
  };
  dataYear?: number; // 数据年份过滤 (2025, 2026 等)
  lastSyncTime?: string;
}

// LocalStorage 数据结构
export interface LocalStorageData {
  transactions: Transaction[];
  watchlist: WatchlistItem[];
  cashBalance: CashBalance;
  highWaterMark: number;
  netWorthHistory: NetWorthRecord[];
  settings: AppSettings;
  stockCache: Record<string, StockInfo>;
  exchangeRates: ExchangeRates;
}

// API 响应类型
export interface MarketDataResponse {
  success: boolean;
  data?: StockInfo;
  error?: string;
  source: 'longport' | 'openbb' | 'tencent' | 'finnhub' | 'polygon' | 'yahoo' | 'twelvedata' | 'cache' | 'skipped';
}

// 股票历史数据
export interface StockHistoryItem {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockHistory {
  ticker: string;
  data: StockHistoryItem[];
}

// === 投资镜子 (Investment Mirror) 新增类型 ===

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Citation {
  source: string;
  title: string;
  url?: string;
  content_snippet?: string;
}

export interface Message {
  id: number;
  conversationId: number;
  role: MessageRole;
  content: string;
  citations?: Citation[]; // JSON 解析后
  createdAt: string;
}

export interface Conversation {
  id: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: number;
  userId: number;
  profileContent: string;
  investmentPhilosophy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DynamicNote {
  id: number;
  userId?: number;
  title: string;
  content: string;
  tags?: string[] | string; // Support both array (frontend) and string (db)
  source_type: 'note' | 'principle' | 'uploaded_file' | 'wechat_article' | 'wechat_group_chat';
  metadata?: any;
  related_ticker?: string;
  portfolio_snapshot?: any;
  createdAt: string;
  updatedAt?: string;
}

// 辅助函数：获取知识库来源的显示名称
export function getSourceLabel(type: string): string {
  switch (type) {
    case 'note': return '投资日记';
    case 'principle': return '投资原则';
    case 'uploaded_file': return '上传文件';
    case 'wechat_article': return '微信文章';
    case 'wechat_group_chat': return '群聊精华';
    default: return '未知来源';
  }
}

export interface ApiKey {
  id: number;
  userId: number;
  keyHash: string;
  keyPrefix: string;
  name: string;
  lastUsedAt?: string;
  createdAt: string;
}

// 交易复盘记录
export interface TradeReview {
  id: string;
  transaction_id: string;
  ai_analysis: string;
  user_review: string;
  review_questions?: string[];
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}
