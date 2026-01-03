// 从 Activity Statement 2025-12-12 提取的真实数据
import { Action } from '../types';
import type { Currency, Market, Transaction, WatchlistItem, CashBalance, NetWorthRecord } from '../types';

// 汇率 (基于 Activity Statement)
export const USD_CNY = 7.25;
export const HKD_CNY = 0.93;

// 初始现金余额（融资状态）- 直接从 Activity Statement 获取
export const initialCashBalance: CashBalance = {
  USD: -628987,  // 融资状态 (调整后，扣除股票购买成本)
  HKD: -1960160, // 港股购买占用
  CNY: 0,
  totalCNY: -628987 * USD_CNY + (-1960160) * HKD_CNY, // 约 -6,383,103 CNY
};

// 初始交易记录（从报表中提取的历史交易）
// 注意：这里的交易记录用于计算成本价，实际持仓市值由实时价格决定
export const initialTransactions: Transaction[] = [
  // SYNC_BALANCE 用于同步账户余额状态
  {
    id: 'tx-sync-001',
    date: '2025-12-12T00:00:00.000Z',
    ticker: 'USD',
    name: '账户余额同步',
    action: Action.SYNC_BALANCE,
    price: 1,
    quantity: -628987,
    amount: -628987,
    amountCNY: -628987 * USD_CNY,
    fee: 0,
    currency: 'USD' as Currency,
    market: 'US' as Market,
    strategyNote: '从 Activity Statement 同步 - 融资状态',
    isPlanned: true,
    createdAt: '2025-12-12T00:00:00.000Z',
  },
  {
    id: 'tx-sync-002',
    date: '2025-12-12T00:00:00.000Z',
    ticker: 'HKD',
    name: '港币余额同步',
    action: Action.SYNC_BALANCE,
    price: 1,
    quantity: -1960160,
    amount: -1960160,
    amountCNY: -1960160 * HKD_CNY,
    fee: 0,
    currency: 'HKD' as Currency,
    market: 'HK' as Market,
    strategyNote: '从 Activity Statement 同步 - 港股购买占用',
    isPlanned: true,
    createdAt: '2025-12-12T00:00:00.000Z',
  },
  // 9992 买入记录 (港股 POP MART) - 成本价 217.79 HKD
  {
    id: 'tx-9992-001',
    date: '2024-01-15T10:00:00.000Z',
    ticker: '9992',
    name: 'POP MART INTERNATIONAL GROUP',
    action: Action.BUY,
    price: 217.79, // 成本价
    quantity: 9000,
    amount: 217.79 * 9000,
    amountCNY: 217.79 * 9000 * HKD_CNY,
    fee: 50,
    currency: 'HKD' as Currency,
    market: 'HK' as Market,
    strategyNote: '泡泡玛特，看好潮玩IP出海，Labubu爆火',
    isPlanned: true,
    createdAt: '2024-01-15T10:00:00.000Z',
  },
  // PDD 买入记录 - 加权平均成本价 122.50 USD (根据 Activity Statement)
  // 总持仓 11,595 股，成本 $1,420,428.18
  {
    id: 'tx-pdd-001',
    date: '2024-06-01T10:00:00.000Z',
    ticker: 'PDD',
    name: 'PDD HOLDINGS INC',
    action: Action.BUY,
    price: 122.50, // 加权平均成本价
    quantity: 11595,
    amount: 122.50 * 11595,
    amountCNY: 122.50 * 11595 * USD_CNY,
    fee: 10,
    currency: 'USD' as Currency,
    market: 'US' as Market,
    strategyNote: '拼多多，Temu海外扩张势头强劲，分批建仓',
    isPlanned: true,
    createdAt: '2024-06-01T10:00:00.000Z',
  },
];

// 观察列表
export const initialWatchlist: WatchlistItem[] = [
  {
    id: 'watch-nvda',
    ticker: 'NVDA',
    name: 'NVIDIA CORP',
    market: 'US' as Market,
    currency: 'USD' as Currency,
    addedDate: '2025-11-01T00:00:00.000Z',
    targetPrice: 150,
    currentPrice: 134.25,
    notes: 'AI芯片龙头，关注数据中心业务增长和Blackwell架构',
    changePercent: 2.5,
  },
  {
    id: 'watch-tsla',
    ticker: 'TSLA',
    name: 'TESLA INC',
    market: 'US' as Market,
    currency: 'USD' as Currency,
    addedDate: '2025-12-01T00:00:00.000Z',
    targetPrice: 400,
    currentPrice: 458.96,
    notes: '电动车龙头，关注FSD进展和Cybertruck销量',
    changePercent: 1.2,
  },
  {
    id: 'watch-meta',
    ticker: 'META',
    name: 'META PLATFORMS INC',
    market: 'US' as Market,
    currency: 'USD' as Currency,
    addedDate: '2025-12-05T00:00:00.000Z',
    targetPrice: 550,
    currentPrice: 612.77,
    notes: 'AI广告+元宇宙，关注Reality Labs亏损收窄',
    changePercent: 0.8,
  },
  {
    id: 'watch-700',
    ticker: '700',
    name: 'TENCENT HOLDINGS LTD',
    market: 'HK' as Market,
    currency: 'HKD' as Currency,
    addedDate: '2025-12-10T00:00:00.000Z',
    targetPrice: 380,
    currentPrice: 412.60,
    notes: '腾讯，游戏+微信生态，视频号商业化',
    changePercent: -0.5,
  },
];

// 历史净值记录（用于绘制净值曲线）- 基于 Activity Statement 数据
// 注意：这里使用 USD 净值 × 汇率转换为 CNY
export const initialNetWorthHistory: NetWorthRecord[] = [
  { date: '2025-11-01', netWorth: 740000 * USD_CNY, cashRatio: -0.80, longRatio: 1.80, shortRatio: 0, highWaterMark: 740000 * USD_CNY },
  { date: '2025-11-08', netWorth: 760000 * USD_CNY, cashRatio: -0.85, longRatio: 1.85, shortRatio: 0, highWaterMark: 760000 * USD_CNY },
  { date: '2025-11-15', netWorth: 720000 * USD_CNY, cashRatio: -0.90, longRatio: 1.90, shortRatio: 0, highWaterMark: 760000 * USD_CNY },
  { date: '2025-11-22', netWorth: 700000 * USD_CNY, cashRatio: -0.92, longRatio: 1.92, shortRatio: 0, highWaterMark: 760000 * USD_CNY },
  { date: '2025-11-29', netWorth: 710000 * USD_CNY, cashRatio: -0.95, longRatio: 1.95, shortRatio: 0, highWaterMark: 760000 * USD_CNY },
  { date: '2025-12-06', netWorth: 783124.03 * USD_CNY, cashRatio: -1.30, longRatio: 2.30, shortRatio: 0, highWaterMark: 783124.03 * USD_CNY },
  { date: '2025-12-12', netWorth: 782415.70 * USD_CNY, cashRatio: -1.31, longRatio: 2.31, shortRatio: 0, highWaterMark: 783124.03 * USD_CNY },
];

// 高水位线 (HWM) - 使用历史最高值 $1,101,700.83 (2025-11-12) 来自 IBKR Activity Statement
export const initialHighWaterMark = 1101700.83 * USD_CNY; // 约 798万 CNY
