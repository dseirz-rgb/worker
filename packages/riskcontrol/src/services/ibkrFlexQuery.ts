// IBKR Flex Query 服务 - 直接从 IBKR 获取账户数据
import type { Currency, Market, Transaction, NetWorthRecord } from '../types';
import { getSupabaseClient } from './supabase';

// 上次 IBKR 刷新时间存储 key
const IBKR_LAST_REFRESH_KEY = 'ibkr_last_refresh_timestamp';

// 检查今天是否已经刷新过 IBKR 数据
export function hasRefreshedToday(): boolean {
  try {
    const lastRefresh = localStorage.getItem(IBKR_LAST_REFRESH_KEY);
    if (!lastRefresh) return false;
    
    const lastRefreshDate = new Date(parseInt(lastRefresh));
    const today = new Date();
    
    // 比较日期（忽略时间）
    return lastRefreshDate.toDateString() === today.toDateString();
  } catch {
    return false;
  }
}

// 获取上次刷新时间
export function getLastRefreshTime(): Date | null {
  try {
    const lastRefresh = localStorage.getItem(IBKR_LAST_REFRESH_KEY);
    if (!lastRefresh) return null;
    return new Date(parseInt(lastRefresh));
  } catch {
    return null;
  }
}

// 记录刷新时间
function recordRefreshTime(): void {
  localStorage.setItem(IBKR_LAST_REFRESH_KEY, Date.now().toString());
}

// IBKR Flex Query 配置
const IB_TOKEN = "325893526716875274131995";
const IB_QUERY_ID = "1350297";

// CORS 代理（IBKR API 不支持浏览器直接访问）
// 优先使用 Cloudflare Workers 代理，如果未配置则使用备用代理
const CLOUDFLARE_WORKER_URL = import.meta.env.VITE_CORS_PROXY_URL || '';

const FALLBACK_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://thingproxy.freeboard.io/fetch/',
];

function getCorsProxy(index: number = 0): string {
  // 如果配置了 Cloudflare Workers，优先使用
  if (CLOUDFLARE_WORKER_URL && index === 0) {
    return `${CLOUDFLARE_WORKER_URL}?url=`;
  }
  
  // 使用备用代理
  if (index >= FALLBACK_PROXIES.length + (CLOUDFLARE_WORKER_URL ? 1 : 0)) {
    // 如果所有代理都试过了，循环回到第一个（或者抛出错误，这里我们循环）
    return FALLBACK_PROXIES[0];
  }
  
  // 计算实际使用的 fallback 索引
  const fallbackIndex = CLOUDFLARE_WORKER_URL ? index - 1 : index;
  if (fallbackIndex < 0) return FALLBACK_PROXIES[0]; // Should not happen if logic is correct
  
  return FALLBACK_PROXIES[fallbackIndex % FALLBACK_PROXIES.length];
}



// 净值变化数据
export interface IBKRChangeInNAV {
  accountId: string;
  fromDate: string;
  toDate: string;
  startingValue: number;
  endingValue: number;
  twr: number; // Time-Weighted Return
  // 收益来源
  mtm: number; // Mark-to-Market
  realized: number; // 已实现损益
  changeInUnrealized: number; // 未实现损益变化
  // 资金流动
  depositsWithdrawals: number; // 入金/出金
  dividends: number; // 股息
  interest: number; // 利息
  changeInInterestAccruals: number; // 利息应计变化
  // 费用
  commissions: number; // 佣金
  brokerFees: number; // 经纪费
  withholdingTax: number; // 预扣税
  otherFees: number; // 其他费用
  // 其他
  fxTranslation: number; // 外汇折算
  corporateActionProceeds: number; // 公司行为收益
}

// 现金报告数据
export interface IBKRCashReport {
  accountId: string;
  fromDate: string;
  toDate: string;
  currency: string;
  startingCash: number;
  endingCash: number;
  endingSettledCash: number;
  // 交易
  commissions: number;
  netTradesSales: number; // 卖出
  netTradesPurchases: number; // 买入
  // 收入
  dividends: number;
  brokerInterest: number;
  bondInterest: number;
  // 费用
  brokerFees: number;
  advisorFees: number;
  transactionTax: number;
  withholdingTax: number;
  otherFees: number;
  // 资金流动
  depositWithdrawals: number;
  internalTransfers: number;
}

// 账户摘要数据
export interface IBKRAccountSummary {
  accountId: string;
  reportDate: string;
  // 现金
  cash: number;
  cashLong: number;
  cashShort: number;
  // 股票
  stock: number;
  stockLong: number;
  stockShort: number;
  // 期权
  options: number;
  optionsLong: number;
  optionsShort: number;
  // 总净值
  totalEquity: number;
  // 原始货币
  currency: string;
}

// 持仓数据
export interface IBKRPosition {
  symbol: string;
  description: string;
  quantity: number;
  costBasis: number;
  markPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  currency: Currency;
  market: Market;
}

// 解析 XML 中的属性
function parseXMLAttributes(xml: string, tagName: string): Record<string, string>[] {
  const results: Record<string, string>[] = [];
  const regex = new RegExp(`<${tagName}\\s+([^>]+)\\s*\\/?>`, 'g');
  let match;
  
  while ((match = regex.exec(xml)) !== null) {
    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)="([^"]*)"/g;
    let attrMatch;
    
    while ((attrMatch = attrRegex.exec(match[1])) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
    
    results.push(attrs);
  }
  
  return results;
}

// 检测市场（导出供其他模块使用）
export function detectMarket(symbol: string): Market {
  // 港股：数字代码
  if (/^\d{4,5}$/.test(symbol)) {
    return 'HK';
  }
  // A股：6位数字
  if (/^\d{6}$/.test(symbol)) {
    return 'CN';
  }
  // 默认美股
  return 'US';
}

// 获取货币
function getCurrency(market: Market): Currency {
  switch (market) {
    case 'HK': return 'HKD';
    case 'CN': return 'CNY';
    default: return 'USD';
  }
}

// IBKR 交易记录接口
export interface IBKRTrade {
  accountId: string;
  symbol: string;
  description: string;
  dateTime: string; // YYYYMMDD;HHMMSS
  buySell: string; // BUY, SELL
  quantity: number;
  price: number;
  proceeds: number;
  commission: number;
  currency: string;
  fxRateToBase?: number;
}

// 从 IBKR Flex Query 获取数据
export async function fetchIBKRFlexQuery(
  onProgress?: (stage: string, progress: number) => void
): Promise<{
  summary: IBKRAccountSummary | null;
  positions: IBKRPosition[];
  navChanges: IBKRChangeInNAV[];
  cashReports: IBKRCashReport[];
  trades: IBKRTrade[];
  rawXML: string;
  cashByCurrency: Record<string, number>; // 多币种现金数据 {USD: xxx, HKD: xxx, CNY: xxx}
}> {
  let lastError: Error | null = null;
  // 尝试最多 4 个不同的代理
  const maxRetries = 4;

  for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
    try {
      const corsProxy = getCorsProxy(retryCount);
      console.log(`[IBKR] Attempt ${retryCount + 1}/${maxRetries} using proxy:`, corsProxy);
      
      // Step 1: 请求生成报表
      if (retryCount === 0) {
        onProgress?.('正在请求生成报表...', 10);
      } else {
        onProgress?.(`正在请求生成报表 (尝试 ${retryCount + 1})...`, 10);
      }
      
      const ibkrRequestUrl = `https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest?t=${IB_TOKEN}&q=${IB_QUERY_ID}&v=3`;
      const requestUrl = `${corsProxy}${encodeURIComponent(ibkrRequestUrl)}`;
      
      console.log('[IBKR] Requesting report generation...');
      
      const requestResponse = await fetch(requestUrl);
      if (!requestResponse.ok) {
        const errorText = await requestResponse.text();
        console.error(`[IBKR] Request failed with proxy ${retryCount}:`, requestResponse.status, errorText);
        throw new Error(`HTTP ${requestResponse.status}`);
      }
      
      const requestText = await requestResponse.text();
      // 验证响应是否看起来像 XML
      if (!requestText.trim().startsWith('<')) {
        console.error(`[IBKR] Invalid response format with proxy ${retryCount}:`, requestText.substring(0, 100));
        throw new Error('Invalid XML response');
      }
      
      console.log('[IBKR] Request response:', requestText.substring(0, 200));
      
      // 解析 ReferenceCode
      const codeMatch = requestText.match(/<ReferenceCode>(\d+)<\/ReferenceCode>/);
      if (!codeMatch) {
        // 如果是错误消息
        if (requestText.includes('<ErrorMessage>')) {
           const errorMsgMatch = requestText.match(/<ErrorMessage>(.*?)<\/ErrorMessage>/);
           const errorMsg = errorMsgMatch ? errorMsgMatch[1] : 'Unknown IBKR Error';
           throw new Error(`IBKR Error: ${errorMsg}`);
        }
        
        console.error('[IBKR] Failed to get ReferenceCode:', requestText);
        // 如果无法解析 code，可能是代理问题，尝试下一个
        throw new Error('Failed to parse ReferenceCode');
      }
      
      const referenceCode = codeMatch[1];
      console.log('[IBKR] ReferenceCode:', referenceCode);
      
      // Step 2: 等待报表生成（最多重试 20 次，延长等待时间）
      let reportText = '';
      onProgress?.('等待报表生成...', 20);
      
      for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 等待 3 秒
        
        const ibkrGetUrl = `https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement?t=${IB_TOKEN}&q=${referenceCode}&v=3`;
        const getUrl = `${corsProxy}${encodeURIComponent(ibkrGetUrl)}`;
        
        console.log(`[IBKR] Fetching report (attempt ${i + 1})...`);
        onProgress?.(`等待报表生成 (尝试 ${i + 1}/20)...`, 20 + (i * 2));
        
        try {
          const getResponse = await fetch(getUrl);
          reportText = await getResponse.text();
          
          // 检查是否还在生成中
          if (reportText.includes('<Status>Success</Status>') || reportText.includes('<FlexStatements')) {
            break;
          }
          
          // 如果出现错误
          if (reportText.includes('<ErrorMessage>') || reportText.includes('<ErrorCode>')) {
             console.log('[IBKR] Report generation in progress or error:', reportText.substring(0, 200));
             // 继续轮询
          }
        } catch (pollError) {
          console.warn(`[IBKR] Network error during polling (attempt ${i + 1}):`, pollError);
          // 网络错误，等待一会继续重试，不要立即放弃
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        console.log('[IBKR] Report not ready, retrying...');
      }
      
      // 验证最终报表
      if (!reportText.includes('<FlexStatements') && !reportText.includes('<EquitySummaryByReportDateInBase')) {
         console.error('[IBKR] Invalid report content:', reportText.substring(0, 200));
         throw new Error('Invalid report content');
      }
      
      console.log('[IBKR] Report received, length:', reportText.length);
      console.log('[IBKR] Report preview:', reportText.substring(0, 500));
      
      // Step 3: 解析数据
      onProgress?.('正在解析报表数据...', 50);
      
      // 解析账户摘要
      const summaryAttrs = parseXMLAttributes(reportText, 'EquitySummaryByReportDateInBase');
      console.log('[IBKR] Found summary records:', summaryAttrs.length);
      
      if (summaryAttrs.length === 0) {
        console.error('[IBKR] No summary data found in XML. Response preview:', reportText.substring(0, 500));
        // 检查是否是 JSON (代理可能返回 JSON)
        if (reportText.trim().startsWith('{')) {
          console.warn('[IBKR] Response looks like JSON, maybe proxy wrapper?');
        }
        throw new Error('No summary data found');
      }
      
      console.log('[IBKR] First summary:', summaryAttrs[0]);
      
      let summary: IBKRAccountSummary | null = null;
      
      if (summaryAttrs.length > 0) {
        // 获取最新日期的摘要
        const latestSummary = summaryAttrs.reduce((latest, current) => {
          if (!latest || current.reportDate > latest.reportDate) {
            return current;
          }
          return latest;
        }, summaryAttrs[0]);
        
        summary = {
          accountId: latestSummary.accountId || '',
          reportDate: latestSummary.reportDate || '',
          cash: parseFloat(latestSummary.cash) || 0,
          cashLong: parseFloat(latestSummary.cashLong) || 0,
          cashShort: parseFloat(latestSummary.cashShort) || 0,
          stock: parseFloat(latestSummary.stock) || 0,
          stockLong: parseFloat(latestSummary.stockLong) || 0,
          stockShort: parseFloat(latestSummary.stockShort) || 0,
          options: parseFloat(latestSummary.options) || 0,
          optionsLong: parseFloat(latestSummary.optionsLong) || 0,
          optionsShort: parseFloat(latestSummary.optionsShort) || 0,
          totalEquity: (parseFloat(latestSummary.cash) || 0) + 
                       (parseFloat(latestSummary.stock) || 0) + 
                       (parseFloat(latestSummary.options) || 0),
          currency: latestSummary.currency || 'USD',
        };
        console.log('[IBKR] Summary created:', summary);
      }
      
      // 解析持仓
      const positionAttrs = parseXMLAttributes(reportText, 'OpenPosition');
      console.log('[IBKR] Found position records:', positionAttrs.length);
      const positions: IBKRPosition[] = positionAttrs.map(pos => {
        const symbol = pos.symbol || '';
        const market = detectMarket(symbol);
        
        return {
          symbol,
          description: pos.description || '',
          quantity: parseFloat(pos.position) || 0,
          costBasis: parseFloat(pos.costBasisMoney) || 0,
          markPrice: parseFloat(pos.markPrice) || 0,
          marketValue: parseFloat(pos.positionValue) || 0,
          unrealizedPnL: parseFloat(pos.fifoPnlUnrealized) || 0,
          currency: (pos.currency as Currency) || getCurrency(market),
          market,
        };
      });
      
      // 解析净值变化
      const navChangeAttrs = parseXMLAttributes(reportText, 'ChangeInNAV');
      console.log('[IBKR] Found NAV change records:', navChangeAttrs.length);
      const navChanges: IBKRChangeInNAV[] = navChangeAttrs.map(nav => ({
        accountId: nav.accountId || '',
        fromDate: nav.fromDate || '',
        toDate: nav.toDate || '',
        startingValue: parseFloat(nav.startingValue) || 0,
        endingValue: parseFloat(nav.endingValue) || 0,
        twr: parseFloat(nav.twr) || 0,
        mtm: parseFloat(nav.mtm) || 0,
        realized: parseFloat(nav.realized) || 0,
        changeInUnrealized: parseFloat(nav.changeInUnrealized) || 0,
        depositsWithdrawals: parseFloat(nav.depositsWithdrawals) || 0,
        dividends: parseFloat(nav.dividends) || 0,
        interest: parseFloat(nav.interest) || 0,
        changeInInterestAccruals: parseFloat(nav.changeInInterestAccruals) || 0,
        commissions: parseFloat(nav.commissions) || 0,
        brokerFees: parseFloat(nav.brokerFees) || 0,
        withholdingTax: parseFloat(nav.withholdingTax) || 0,
        otherFees: parseFloat(nav.otherFees) || 0,
        fxTranslation: parseFloat(nav.fxTranslation) || 0,
        corporateActionProceeds: parseFloat(nav.corporateActionProceeds) || 0,
      }));
      
      // 解析现金报告（获取所有币种，用于计算多币种现金）
      const allCashReportAttrs = parseXMLAttributes(reportText, 'CashReportCurrency');
      console.log('[IBKR] Found all cash report records:', allCashReportAttrs.length);
      
      // 按日期分组，获取各币种现金
      const cashByDateAndCurrency = new Map<string, Map<string, number>>();
      allCashReportAttrs.forEach((cash: any) => {
        const toDate = cash.toDate || '';
        const currency = cash.currency || '';
        const endingCash = parseFloat(cash.endingCash) || 0;
        
        if (!cashByDateAndCurrency.has(toDate)) {
          cashByDateAndCurrency.set(toDate, new Map());
        }
        cashByDateAndCurrency.get(toDate)!.set(currency, endingCash);
      });
      
      // 只保留 BASE_SUMMARY 用于 cashReports 返回
      const cashReportAttrs = allCashReportAttrs.filter(
        (r: any) => r.currency === 'BASE_SUMMARY'
      );
      console.log('[IBKR] Found BASE_SUMMARY cash report records:', cashReportAttrs.length);
      const cashReports: IBKRCashReport[] = cashReportAttrs.map(cash => ({
        accountId: cash.accountId || '',
        fromDate: cash.fromDate || '',
        toDate: cash.toDate || '',
        currency: cash.currency || 'USD',
        startingCash: parseFloat(cash.startingCash) || 0,
        endingCash: parseFloat(cash.endingCash) || 0,
        endingSettledCash: parseFloat(cash.endingSettledCash) || 0,
        commissions: parseFloat(cash.commissions) || 0,
        netTradesSales: parseFloat(cash.netTradesSales) || 0,
        netTradesPurchases: parseFloat(cash.netTradesPurchases) || 0,
        dividends: parseFloat(cash.dividends) || 0,
        brokerInterest: parseFloat(cash.brokerInterest) || 0,
        bondInterest: parseFloat(cash.bondInterest) || 0,
        brokerFees: parseFloat(cash.brokerFees) || 0,
        advisorFees: parseFloat(cash.advisorFees) || 0,
        transactionTax: parseFloat(cash.transactionTax) || 0,
        withholdingTax: parseFloat(cash.withholdingTax) || 0,
        otherFees: parseFloat(cash.otherFees) || 0,
        depositWithdrawals: parseFloat(cash.depositWithdrawals) || 0,
        internalTransfers: parseFloat(cash.internalTransfers) || 0,
      }));
      
      // 获取最新日期的多币种现金数据
      let latestCashByCurrency: Record<string, number> = {};
      if (summary && summary.reportDate) {
        const latestCashByDate = cashByDateAndCurrency.get(summary.reportDate);
        if (latestCashByDate) {
          latestCashByCurrency = Object.fromEntries(latestCashByDate);
          console.log('[IBKR] 最新日期多币种现金:', latestCashByCurrency);
        }
      }
      
      // 解析交易记录（Trade 标签）
      const tradeAttrs = parseXMLAttributes(reportText, 'Trade');
      console.log('[IBKR] Found trade records:', tradeAttrs.length);
      const trades: IBKRTrade[] = tradeAttrs.map(trade => {
        const dateTime = trade.dateTime || trade.date || trade.tradeDate || trade.settleDate || '';
        
        if (tradeAttrs.indexOf(trade) < 3) {
          console.log('[IBKR] 交易记录原始属性:', {
            allKeys: Object.keys(trade),
            dateTime: trade.dateTime,
            date: trade.date,
            tradeDate: trade.tradeDate,
            settleDate: trade.settleDate,
            symbol: trade.symbol,
          });
        }
        
        return {
          accountId: trade.accountId || '',
          symbol: trade.symbol || '',
          description: trade.description || '',
          dateTime: dateTime,
          buySell: trade.buySell || trade.side || '',
          quantity: parseFloat(trade.quantity) || 0,
          price: parseFloat(trade.price) || 0,
          proceeds: parseFloat(trade.proceeds) || 0,
          commission: parseFloat(trade.commission) || 0,
          currency: trade.currency || 'USD',
          fxRateToBase: trade.fxRateToBase ? parseFloat(trade.fxRateToBase) : undefined,
        };
      });
      
      // 记录刷新时间
      recordRefreshTime();
      
      return { summary, positions, navChanges, cashReports, trades, rawXML: reportText, cashByCurrency: latestCashByCurrency };
      
    } catch (e) {
      console.error(`[IBKR] Proxy ${retryCount} failed:`, e);
      lastError = e instanceof Error ? e : new Error(String(e));
      // Continue to next retry
    }
  }
  
  throw lastError || new Error('All proxies failed');
}

// 获取最新净值（直接从 IBKR）
export async function fetchIBKRNetWorth(): Promise<{
  netWorth: number;
  cash: number;
  stock: number;
  options: number;
  reportDate: string;
} | null> {
  const { summary } = await fetchIBKRFlexQuery();
  
  if (!summary) {
    return null;
  }
  
  return {
    netWorth: summary.totalEquity,
    cash: summary.cash,
    stock: summary.stock,
    options: summary.options,
    reportDate: summary.reportDate,
  };
}

// 同步 IBKR 数据到 Supabase
// 注意：已移除频率限制，可以随时刷新（用于调试）
export async function syncIBKRToSupabase(
  forceRefresh: boolean = false,
  onProgress?: (stage: string, progress: number) => void
): Promise<{
  success: boolean;
  message: string;
  skipped?: boolean;
  data?: {
    reportDate: string;
    netWorthUSD: number;
    netWorthCNY: number;
    positions: IBKRPosition[];
  };
}> {
  // 已移除频率限制检查，可以随时刷新
  
  const supabase = getSupabaseClient();
  
  if (!supabase) {
    return { success: false, message: 'Supabase 未连接' };
  }
  
  try {
    console.log('[IBKR->Supabase] 开始同步...');
    onProgress?.('开始同步...', 0);
    
    // 1. 获取 IBKR 数据
    let summary, positions, navChanges, cashReports, trades, cashByCurrency;
    try {
      // 传递 onProgress，fetchIBKRFlexQuery 负责 0-60% 的进度
      const result = await fetchIBKRFlexQuery(onProgress);
      summary = result.summary;
      positions = result.positions;
      navChanges = result.navChanges;
      cashReports = result.cashReports;
      trades = result.trades;
      cashByCurrency = result.cashByCurrency;
    } catch (error) {
      console.error('[IBKR->Supabase] 获取IBKR数据失败:', error);
      return { success: false, message: `获取IBKR数据失败: ${error instanceof Error ? error.message : String(error)}` };
    }
    
    if (!summary) {
      console.error('[IBKR->Supabase] IBKR返回的summary为空');
      return { success: false, message: 'IBKR返回的数据为空，请检查Token和Query ID' };
    }
    
    onProgress?.('正在计算数据...', 60);
    
    const USD_CNY = 7.04; // 汇率
    const HKD_CNY = 0.93; // 汇率
    const netWorthCNY = summary.totalEquity * USD_CNY;
    
    // 获取多币种现金数据
    const cashUSD = cashByCurrency?.['USD'] || 0;
    const cashHKD = cashByCurrency?.['HKD'] || 0;
    const cashCNY = cashByCurrency?.['CNY'] || 0;
    
    // 计算 Margin Loan (债务) - 从多币种现金中计算
    // 负现金表示借款，需要累加所有币种的负现金（转换为 USD）
    let marginLoanUSD = 0;
    
    // 如果有多币种现金数据，使用它来计算
    if (cashByCurrency && Object.keys(cashByCurrency).length > 0) {
      // 累加所有负现金（借款）
      if (cashUSD < 0) marginLoanUSD += Math.abs(cashUSD);
      if (cashHKD < 0) marginLoanUSD += Math.abs(cashHKD) * (HKD_CNY / USD_CNY); // HKD -> USD
      if (cashCNY < 0) marginLoanUSD += Math.abs(cashCNY) / USD_CNY; // CNY -> USD
      
      console.log('[IBKR->Supabase] 多币种现金:', {
        USD: cashUSD,
        HKD: cashHKD,
        CNY: cashCNY,
        marginLoanUSD_calculated: marginLoanUSD,
      });
    } else {
      // 回退到 summary.cash（BASE_SUMMARY）
      marginLoanUSD = summary.cash < 0 ? Math.abs(summary.cash) : 0;
    }
    
    const marginLoanCNY = marginLoanUSD * USD_CNY;
    
    // 计算杠杆率
    // Leverage = Total Assets / Net Equity
    // Total Assets = Net Equity + Debt
    // 或者：Leverage = (Stock + Options + max(0, Cash)) / Net Equity
    const totalAssets = Math.abs(summary.stock) + Math.abs(summary.options) + Math.max(0, summary.cash);
    const leverageRatio = summary.totalEquity > 0 ? totalAssets / summary.totalEquity : 1.0;
    
    console.log('[IBKR->Supabase] 杠杆计算:', {
      cash: summary.cash,
      stock: summary.stock,
      options: summary.options,
      totalEquity: summary.totalEquity,
      marginLoanUSD,
      marginLoanCNY,
      totalAssets,
      leverageRatio: leverageRatio.toFixed(2) + 'x',
    });
    
    // 2. 格式化日期
    const reportDateStr = summary.reportDate; // 格式: 20251215
    const formattedDate = `${reportDateStr.slice(0, 4)}-${reportDateStr.slice(4, 6)}-${reportDateStr.slice(6, 8)}`;
    
    // 3. 检查是否已存在该日期的记录
    const { data: existingRecord } = await supabase
      .from('asset_snapshots')
      .select('id')
      .eq('date', formattedDate)
      .single();
    
    // 4. 计算持仓比例
    const stockValue = summary.stock + summary.options;
    const totalValue = Math.abs(summary.cash) + Math.abs(stockValue);
    const cashRatio = totalValue > 0 ? (summary.cash / summary.totalEquity) * 100 : 0;
    const longRatio = totalValue > 0 ? (Math.max(0, stockValue) / summary.totalEquity) * 100 : 0;
    const shortRatio = totalValue > 0 ? (Math.abs(Math.min(0, stockValue)) / summary.totalEquity) * 100 : 0;
    
    // 5. 增量更新模式：只更新最近的数据（通常是最近30天）
    // 历史数据应该已经通过 import-historical-data.ts 脚本导入过了
    console.log('[IBKR->Supabase] 增量更新模式：更新最近数据...');
    onProgress?.('正在同步净值历史...', 70);
    
    if (navChanges && navChanges.length > 0) {
      console.log(`[IBKR->Supabase] 从 ${navChanges.length} 条 navChanges 记录中提取净值数据...`);
      
      // 只更新最近的数据（增量更新）
      const snapshotsToInsert = navChanges.map(nav => {
        const toDate = `${nav.toDate.slice(0, 4)}-${nav.toDate.slice(4, 6)}-${nav.toDate.slice(6, 8)}`;
        
        return {
          date: toDate,
          net_worth: nav.endingValue,
          cash_ratio: null, // navChanges 中没有详细的现金/股票分解
          long_ratio: null,
          short_ratio: null,
        };
      });
      
      // 使用 upsert 更新或插入
      const { error: batchError } = await supabase
        .from('asset_snapshots')
        .upsert(snapshotsToInsert, {
          onConflict: 'date',
          ignoreDuplicates: false // 更新已存在的记录
        });
      
      if (batchError) {
        console.error('[IBKR->Supabase] 更新 asset_snapshots 失败:', batchError);
        return { success: false, message: `更新失败: ${batchError.message}` };
      }
      
      console.log(`[IBKR->Supabase] 成功更新 ${snapshotsToInsert.length} 条净值记录`);
    }
    
    // 6. 更新当天的详细数据（包含持仓比例和杠杆数据）
    console.log('[IBKR->Supabase] 更新当天详细数据...');
    
    // 计算总现金（CNY）
    const totalCashCNY = cashUSD * USD_CNY + cashHKD * HKD_CNY + cashCNY;
    
    // 获取历史高水位来计算回撤
    const { data: prevSnapshot } = await supabase
      .from('dashboard_snapshots')
      .select('high_water_mark, net_worth_cny')
      .order('date', { ascending: false })
      .limit(1)
      .single();
    
    const prevHighWaterMark = Number(prevSnapshot?.high_water_mark) || 0;
    const prevNetWorthCNY = Number(prevSnapshot?.net_worth_cny) || 0;
    
    // 计算高水位和回撤 - 确保是有效数字
    const safeNetWorthCNY = Number(netWorthCNY) || 0;
    
    // 确保 highWaterMark 永远不会是 NaN 或 undefined
    let highWaterMark = Math.max(safeNetWorthCNY, prevHighWaterMark);
    if (!Number.isFinite(highWaterMark) || highWaterMark <= 0) {
      highWaterMark = safeNetWorthCNY > 0 ? safeNetWorthCNY : 1; // 至少为 1，避免 null
    }
    
    const drawdownAmount = safeNetWorthCNY - highWaterMark;
    const drawdownPercent = highWaterMark > 0 ? (drawdownAmount / highWaterMark) * 100 : 0;
    
    // 计算日收益
    const dailyPnl = prevNetWorthCNY > 0 ? safeNetWorthCNY - prevNetWorthCNY : 0;
    const dailyPnlPercent = prevNetWorthCNY > 0 ? (dailyPnl / prevNetWorthCNY) * 100 : 0;
    
    console.log('[IBKR->Supabase] 高水位计算:', {
      netWorthCNY: safeNetWorthCNY,
      prevHighWaterMark,
      highWaterMark,
      drawdownAmount,
      drawdownPercent,
      dailyPnl,
      dailyPnlPercent,
    });
    
    const { error: todayError } = await supabase
      .from('dashboard_snapshots')
      .upsert({
        date: formattedDate,
        net_worth_usd: Number(summary.totalEquity) || 0,
        net_worth_cny: safeNetWorthCNY,
        high_water_mark: highWaterMark,
        drawdown_amount: drawdownAmount,
        drawdown_percent: drawdownPercent,
        max_drawdown_percent: drawdownPercent, // 当天的最大回撤就是当前回撤
        daily_pnl: dailyPnl,
        daily_pnl_percent: dailyPnlPercent,
        // 多币种现金数据
        cash_usd: Number(cashUSD) || 0,
        cash_hkd: Number(cashHKD) || 0,
        cash_cny: Number(cashCNY) || 0,
        cash_total_cny: Number(totalCashCNY) || 0,
        cash_ratio: Number(cashRatio) || 0,
        long_ratio: Number(longRatio) || 0,
        short_ratio: Number(shortRatio) || 0,
        long_value_cny: Math.max(0, stockValue) * USD_CNY,
        short_value_cny: Math.abs(Math.min(0, stockValue)) * USD_CNY,
        margin_loan_usd: Number(marginLoanUSD) || 0,
        margin_loan_cny: Number(marginLoanCNY) || 0,
        leverage_ratio: Number(leverageRatio) || 1.0,
        total_positions: positions.length,
        stock_positions: positions.length,
        usd_cny_rate: USD_CNY,
        hkd_cny_rate: HKD_CNY,
        data_source: 'IBKR',
      }, {
        onConflict: 'date'
      });
    
    if (todayError) {
      console.error('[IBKR->Supabase] 更新当天数据失败:', todayError);
      return { success: false, message: `更新当天数据失败: ${todayError.message}` };
    }
    
    console.log('[IBKR->Supabase] 当天数据更新成功:', formattedDate);
    
    // 7. 插入或更新 nav_changes
    onProgress?.('正在同步详细记录...', 80);
    if (navChanges && navChanges.length > 0) {
      console.log(`[IBKR->Supabase] 开始同步 ${navChanges.length} 条净值变化记录...`);
      for (const nav of navChanges) {
        const toDate = `${nav.toDate.slice(0, 4)}-${nav.toDate.slice(4, 6)}-${nav.toDate.slice(6, 8)}`;
        const fromDate = `${nav.fromDate.slice(0, 4)}-${nav.fromDate.slice(4, 6)}-${nav.fromDate.slice(6, 8)}`;
        
        const { error } = await supabase
          .from('nav_changes')
          .upsert({
            account_id: nav.accountId,
            from_date: fromDate,
            to_date: toDate,
            starting_value: nav.startingValue,
            ending_value: nav.endingValue,
            twr: nav.twr,
            mtm: nav.mtm,
            realized: nav.realized,
            change_in_unrealized: nav.changeInUnrealized,
            deposits_withdrawals: nav.depositsWithdrawals,
            dividends: nav.dividends,
            interest: nav.interest,
            change_in_interest_accruals: nav.changeInInterestAccruals,
            commissions: nav.commissions,
            broker_fees: nav.brokerFees,
            withholding_tax: nav.withholdingTax,
            other_fees: nav.otherFees,
            fx_translation: nav.fxTranslation,
            corporate_action_proceeds: nav.corporateActionProceeds,
          }, {
            onConflict: 'account_id,to_date'
          });
        
        if (error) {
          console.error(`[IBKR->Supabase] 插入nav_changes失败 (${toDate}):`, error);
        }
      }
      console.log('[IBKR->Supabase] nav_changes 同步完成');
    }
    
    // 7. 插入或更新 cash_reports
    if (cashReports && cashReports.length > 0) {
      console.log(`[IBKR->Supabase] 开始同步 ${cashReports.length} 条现金报告记录...`);
      for (const cash of cashReports) {
        const toDate = `${cash.toDate.slice(0, 4)}-${cash.toDate.slice(4, 6)}-${cash.toDate.slice(6, 8)}`;
        const fromDate = `${cash.fromDate.slice(0, 4)}-${cash.fromDate.slice(4, 6)}-${cash.fromDate.slice(6, 8)}`;
        
        const { error } = await supabase
          .from('cash_reports')
          .upsert({
            account_id: cash.accountId,
            from_date: fromDate,
            to_date: toDate,
            currency: cash.currency,
            starting_cash: cash.startingCash,
            ending_cash: cash.endingCash,
            ending_settled_cash: cash.endingSettledCash,
            commissions: cash.commissions,
            net_trades_sales: cash.netTradesSales,
            net_trades_purchases: cash.netTradesPurchases,
            dividends: cash.dividends,
            broker_interest: cash.brokerInterest,
            bond_interest: cash.bondInterest,
            broker_fees: cash.brokerFees,
            advisor_fees: cash.advisorFees,
            transaction_tax: cash.transactionTax,
            withholding_tax: cash.withholdingTax,
            other_fees: cash.otherFees,
            deposit_withdrawals: cash.depositWithdrawals,
            internal_transfers: cash.internalTransfers,
          }, {
            onConflict: 'account_id,to_date,currency'
          });
        
        if (error) {
          console.error(`[IBKR->Supabase] 插入cash_reports失败 (${toDate}):`, error);
        }
      }
      console.log('[IBKR->Supabase] cash_reports 同步完成');
    }
    
    // 8. 同步交易记录到 transactions 表
    onProgress?.('正在同步交易记录...', 90);
    if (trades && trades.length > 0) {
      console.log(`[IBKR->Supabase] 开始同步 ${trades.length} 条交易记录...`);
      
      // 如果强制刷新，先清理所有 IBKR 导入的交易记录（id 以 'ibkr-' 开头）
      // 这样可以避免重复和错误的日期数据
      if (forceRefresh) {
        console.log('[IBKR->Supabase] 强制刷新模式：清理现有 IBKR 交易记录...');
        // 先查询所有 IBKR 交易记录的 ID
        const { data: ibkrTransactions, error: queryError } = await supabase
          .from('transactions')
          .select('id')
          .ilike('id', 'ibkr-%');
        
        if (queryError) {
          console.warn('[IBKR->Supabase] 查询 IBKR 交易记录失败:', queryError);
        } else if (ibkrTransactions && ibkrTransactions.length > 0) {
          // 批量删除
          const idsToDelete = ibkrTransactions.map(t => t.id);
          const { error: deleteError } = await supabase
            .from('transactions')
            .delete()
            .in('id', idsToDelete);
          
          if (deleteError) {
            console.warn('[IBKR->Supabase] 清理现有交易记录失败:', deleteError);
          } else {
            console.log(`[IBKR->Supabase] 已清理 ${idsToDelete.length} 条现有 IBKR 交易记录`);
          }
        } else {
          console.log('[IBKR->Supabase] 没有需要清理的 IBKR 交易记录');
        }
      }
      
      // 先过滤掉日期无效的交易，避免使用今天的日期作为默认值
      const validTrades = trades.filter(trade => {
        const dateTimeStr = trade.dateTime || '';
        if (!dateTimeStr) {
          console.warn('[IBKR->Supabase] 交易记录缺少日期，跳过:', trade);
          return false;
        }
        
        let dateStr = '';
        if (dateTimeStr.includes(';')) {
          dateStr = dateTimeStr.split(';')[0];
        } else {
          dateStr = dateTimeStr;
        }
        
        // 检查日期格式是否正确（必须是8位数字 YYYYMMDD）
        if (dateStr.length !== 8 || !/^\d{8}$/.test(dateStr)) {
          console.warn('[IBKR->Supabase] 交易记录日期格式无效，跳过:', {
            dateTimeStr,
            dateStr,
            symbol: trade.symbol,
            buySell: trade.buySell,
            quantity: trade.quantity,
          });
          return false;
        }
        
        // 检查日期是否合理（不能是未来日期，也不能太早）
        const year = parseInt(dateStr.slice(0, 4));
        const month = parseInt(dateStr.slice(4, 6));
        const day = parseInt(dateStr.slice(6, 8));
        const tradeDate = new Date(year, month - 1, day);
        
        // 验证日期是否有效
        if (isNaN(tradeDate.getTime()) || 
            tradeDate.getFullYear() !== year || 
            tradeDate.getMonth() !== month - 1 || 
            tradeDate.getDate() !== day) {
          console.warn('[IBKR->Supabase] 交易记录日期无效，跳过:', {
            dateTimeStr,
            dateStr,
            parsed: tradeDate.toISOString(),
            symbol: trade.symbol,
          });
          return false;
        }
        
        // 检查日期是否在未来（超过今天）
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (tradeDate > today) {
          console.warn('[IBKR->Supabase] 交易记录日期在未来，跳过:', {
            dateTimeStr,
            dateStr,
            symbol: trade.symbol,
          });
          return false;
        }
        
        return true;
      });
      
      console.log(`[IBKR->Supabase] 有效交易记录: ${validTrades.length}/${trades.length}`);
      
      const transactionsToInsert = validTrades.map(trade => {
        // 解析日期时间：YYYYMMDD;HHMMSS 或 YYYYMMDD
        const dateTimeStr = trade.dateTime || '';
        let dateStr = '';
        if (dateTimeStr.includes(';')) {
          dateStr = dateTimeStr.split(';')[0];
        } else {
          dateStr = dateTimeStr;
        }
        
        // 此时 dateStr 已经验证过是有效的 8 位数字
        const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        
        // 检测市场
        const market = detectMarket(trade.symbol);
        const currency = trade.currency || (market === 'HK' ? 'HKD' : market === 'CN' ? 'CNY' : 'USD');
        
        // 计算金额（CNY）
        const amount = trade.proceeds || (trade.price * trade.quantity);
        const amountCNY = currency === 'CNY' 
          ? amount 
          : currency === 'USD' 
            ? amount * USD_CNY 
            : amount * HKD_CNY;
        
        // 生成唯一 ID（使用 accountId + symbol + dateTime）
        const tradeId = `ibkr-${trade.accountId}-${trade.symbol}-${dateTimeStr}`;
        
        return {
          id: tradeId,
          date: formattedDate,
          ticker: trade.symbol,
          name: trade.description || trade.symbol,
          market: market,
          currency: currency,
          action: trade.buySell === 'BUY' ? 'BUY' : 'SELL',
          price: trade.price || 0,
          quantity: Math.abs(trade.quantity),
          // amount: amount, // Schema doesn't have amount column
          // amount_cny: amountCNY, // Schema doesn't have amount_cny column
          fee: trade.commission || 0,
          strategy_note: null,
          is_planned: false,
          watchlist_days: null,
          created_at: new Date().toISOString(),
        };
      });
      
      // 批量插入（每次 100 条）
      const batchSize = 100;
      let insertedCount = 0;
      
      for (let i = 0; i < transactionsToInsert.length; i += batchSize) {
        const batch = transactionsToInsert.slice(i, i + batchSize);
        const { error } = await supabase
          .from('transactions')
          .upsert(batch, { onConflict: 'id' });
        
        if (error) {
          console.error(`[IBKR->Supabase] 插入交易记录失败 (批次 ${i / batchSize + 1}):`, error);
        } else {
          insertedCount += batch.length;
          console.log(`[IBKR->Supabase] 已插入 ${insertedCount}/${transactionsToInsert.length} 条交易记录`);
          // 细粒度进度更新
          const progress = 90 + Math.floor((insertedCount / transactionsToInsert.length) * 9);
          onProgress?.(`正在同步交易记录 (${insertedCount}/${transactionsToInsert.length})...`, progress);
        }
      }
      
      console.log('[IBKR->Supabase] 交易记录同步完成');
    } else {
      console.log('[IBKR->Supabase] 没有交易记录需要同步');
    }
    
    // 记录刷新时间
    recordRefreshTime();
    
    onProgress?.('同步完成！', 100);
    return {
      success: true,
      message: `同步成功 (${formattedDate})`,
      data: {
        reportDate: formattedDate,
        netWorthUSD: summary.totalEquity,
        netWorthCNY,
        positions,
      },
    };
  } catch (error) {
    console.error('[IBKR->Supabase] 同步错误:', error);
    return { success: false, message: `同步错误: ${error}` };
  }
}
