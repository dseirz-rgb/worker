// 同步加载初始数据到 LocalStorage
import { 
  initialTransactions, 
  initialWatchlist, 
  initialNetWorthHistory, 
  initialHighWaterMark,
  initialCashBalance 
} from './initialData';

const STORAGE_KEY = 'riskcontrol_data';
const IBKR_SYNC_KEY = 'riskcontrol_ibkr_synced';

// Supabase 配置
const SUPABASE_URL = 'https://lyqspnecudllmnajrrlm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5cXNwbmVjdWRsbG1uYWpycmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NDg3MzEsImV4cCI6MjA4MTMyNDczMX0.5HQDtQWmdA_NCHtGeXck34WKDZf7jEw8wDRjsZy3dNU';

// 汇率
const USD_CNY = 7.25;

// 已移除初始化逻辑 - 完全使用 Supabase 作为数据源
// 不再需要 localStorage 初始化，所有数据从 Supabase 加载
export function ensureInitialData(): void {
  // 空函数，保留以兼容现有代码
  // 数据现在完全从 Supabase 加载，不再需要 localStorage 初始化
  console.log('[loadInitialData] 已移除 localStorage 初始化逻辑，数据从 Supabase 加载');
  
  // 不再初始化 localStorage 数据
  // 如果需要初始化数据，应该通过 Supabase 迁移脚本或 IBKR 同步来完成
  
  // 检查是否有交易记录
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    
    if (!data.transactions || data.transactions.length === 0) {
      data.transactions = initialTransactions;
      data.watchlist = initialWatchlist;
      data.netWorthHistory = initialNetWorthHistory;
      data.highWaterMark = initialHighWaterMark;
      data.cashBalance = initialCashBalance;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('Loaded sample data into empty storage');
    }
    
    // 检查是否需要同步 IBKR 数据
    const lastSync = localStorage.getItem(IBKR_SYNC_KEY);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    if (!lastSync || (now - parseInt(lastSync)) > oneHour) {
      syncIBKRDataAsync();
    }
  } catch (e) {
    console.error('Failed to parse storage data', e);
  }
}

// 异步同步 IBKR 数据
async function syncIBKRDataAsync(): Promise<void> {
  try {
    console.log('Syncing IBKR data from Supabase...');
    
    // 并行获取净值历史和交易记录
    const [snapshotsResponse, transactionsResponse] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/asset_snapshots?select=*&order=date.asc`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
          },
        }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/transactions?select=*&order=created_at.desc`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
          },
        }
      ),
    ]);
    
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    
    const data = JSON.parse(raw);
    
    // 处理净值历史
    if (snapshotsResponse.ok) {
      const snapshots = await snapshotsResponse.json();
      
      if (snapshots.length > 0) {
        let highWaterMark = 0;
        const netWorthHistory = snapshots.map((s: any) => {
          const netWorthCNY = s.net_worth * USD_CNY;
          if (netWorthCNY > highWaterMark) {
            highWaterMark = netWorthCNY;
          }
          return {
            date: s.date,
            netWorth: netWorthCNY,
            cashRatio: s.cash_ratio,
            longRatio: s.long_ratio,
            shortRatio: s.short_ratio,
            highWaterMark,
          };
        });
        
        data.netWorthHistory = netWorthHistory;
        if (highWaterMark > data.highWaterMark) {
          data.highWaterMark = highWaterMark;
        }
        
        console.log(`IBKR snapshots synced: ${netWorthHistory.length} records, HWM: ${highWaterMark.toFixed(0)} CNY`);
      }
    }
    
    // 注意：IBKR 的交易记录可能不完整，不用于计算持仓
    // 持仓数据应该直接来自 IBKR 的 OpenPosition
    // 这里只同步交易记录用于显示和统计，不影响持仓计算
    if (transactionsResponse.ok) {
      const ibkrTransactions = await transactionsResponse.json();
      
      if (ibkrTransactions.length > 0) {
        // 转换 IBKR 交易记录为应用格式（仅用于显示，不影响持仓计算）
        const convertedTransactions = ibkrTransactions.map((tx: any) => {
          const currency = tx.currency || 'USD';
          const market = currency === 'HKD' ? 'HK' : currency === 'CNY' ? 'CN' : 'US';
          const amount = tx.price * tx.quantity;
          const amountCNY = currency === 'CNY' 
            ? amount 
            : currency === 'USD' 
              ? amount * USD_CNY 
              : amount * 0.93;
          
          // 重要：使用 tx.date（实际交易日期），而不是 tx.created_at（导入时间）
          let dateStr = tx.date;
          if (!dateStr && tx.created_at) {
            dateStr = tx.created_at.split('T')[0];
          } else if (!dateStr) {
            dateStr = new Date().toISOString().split('T')[0];
          }
          
          return {
            id: `ibkr-${tx.id}`,
            date: dateStr, // 使用实际交易日期，不是导入时间
            ticker: tx.ticker,
            name: tx.name,
            action: tx.action,
            price: tx.price,
            quantity: tx.quantity,
            amount,
            amountCNY,
            fee: 0,
            currency,
            market,
            strategyNote: tx.strategy_note || '',
            isPlanned: true,
            createdAt: tx.created_at,
            // 标记为 IBKR 同步的记录，不用于持仓计算
            isIBKRSync: true,
          };
        });
        
        // 保留原有的 SYNC_BALANCE 和初始建仓记录（tx-9992-001, tx-pdd-001）
        // 这些记录用于计算持仓
        const keepRecords = data.transactions.filter(
          (t: any) => t.action === 'SYNC_BALANCE' || t.id.startsWith('tx-')
        );
        
        // IBKR 交易记录仅用于显示和统计，不影响持仓计算
        // 过滤掉 2024 年的记录（这些是初始建仓，已在 initialData 中）
        const filteredIBKRTransactions = convertedTransactions.filter((t: any) => {
          const txDate = new Date(t.date);
          return txDate.getFullYear() >= 2025;
        });
        
        // 合并记录：初始建仓 + IBKR 交易（仅显示）
        data.transactions = [...keepRecords, ...filteredIBKRTransactions];
        
        console.log(`IBKR transactions synced: ${filteredIBKRTransactions.length} records (display only, not for position calculation)`);
      }
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(IBKR_SYNC_KEY, Date.now().toString());
    
    console.log('IBKR data sync complete');
  } catch (error) {
    console.error('Failed to sync IBKR data:', error);
  }
}

// 强制重置为示例数据
export function forceResetToSampleData(): void {
  const data = {
    transactions: initialTransactions,
    watchlist: initialWatchlist,
    netWorthHistory: initialNetWorthHistory,
    highWaterMark: initialHighWaterMark,
    cashBalance: initialCashBalance,
    settings: {
      supabase: { url: SUPABASE_URL, anonKey: SUPABASE_KEY, enabled: true },
      defaultCurrency: 'CNY',
      riskLimits: {
        stopLossPercent: -20,
        maxDrawdownPercent: 5,
        positionLimitPercent: 15,
        watchlistCooldownDays: 7,
        positionLimitExceptions: [
          { ticker: 'PDD', name: '拼多多 (PDD Holdings)', limitPercent: 80.1 },
        ],
      },
    },
    stockCache: {},
    exchangeRates: { USD_CNY: 7.25, HKD_CNY: 0.93, timestamp: Date.now() },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  localStorage.removeItem(IBKR_SYNC_KEY);
  console.log('Force reset to sample data');
  
  // 触发 IBKR 数据同步
  syncIBKRDataAsync();
}

// 手动触发 IBKR 同步
export function triggerIBKRSync(): void {
  localStorage.removeItem(IBKR_SYNC_KEY);
  syncIBKRDataAsync();
}
