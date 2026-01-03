import type { StockInfo, Market, Currency, ExchangeRates, MarketDataResponse, StockHistory, StockHistoryItem } from '../types';
import { getCachedStock, cacheStock, getExchangeRates, updateExchangeRates } from './storage';
import { getLiveQuote, getLiveQuotesMap } from './supabaseData';
import { openbbClient, type LiveQuote } from './openbbClient';
import { dataSourceHealthMonitor, withHealthTracking, type DataSource } from './dataSourceHealth';

// CORS 代理列表 - 仅用于腾讯 API (A股/港股)
const CORS_PROXIES = [
  // 本地开发代理 (Vite)
  '/api/tencent/q=',
  // 注意：不再使用公共 CORS 代理，因为它们有严格的请求限制
];

// 自定义 Cloudflare Worker 代理（最优先）
const WORKER_PROXY_URL = 'https://marketdata.dseirz.workers.dev';

// 从 Supabase live 表获取数据（长桥 API 写入）
// 带健康追踪的版本
async function fetchFromSupabaseLive(ticker: string): Promise<StockInfo | null> {
  const { data, success } = await withHealthTracking('longport', async () => {
    const liveQuote = await getLiveQuote(ticker);
    
    if (!liveQuote || !liveQuote.price) {
      throw new Error('No data available');
    }
    
    const market = detectMarket(ticker);
    const previousClose = liveQuote.prev_close || liveQuote.price;
    const changePercent = liveQuote.change_percent ?? 
      (previousClose > 0 ? ((liveQuote.price - previousClose) / previousClose) * 100 : 0);
    
    console.log(`[Supabase Live] Data for ${ticker}:`, liveQuote);
    
    return {
      ticker: ticker.toUpperCase(),
      name: ticker.toUpperCase(),
      market: market,
      currency: getCurrency(market),
      currentPrice: liveQuote.price,
      previousClose,
      changePercent,
      lastUpdated: new Date(liveQuote.updated_at).getTime(),
    } as StockInfo;
  });
  
  return success ? data : null;
}

// 从 OpenBB 服务获取数据（FMP/Polygon/Yahoo）
// 带健康追踪的版本
async function fetchFromOpenBB(ticker: string): Promise<StockInfo | null> {
  const { data, success } = await withHealthTracking('openbb', async () => {
    // 检查 OpenBB 服务是否可用
    const isAvailable = await openbbClient.isAvailable();
    if (!isAvailable) {
      throw new Error('OpenBB service not available');
    }
    
    const quote = await openbbClient.getQuote(ticker);
    
    if (!quote || !quote.price) {
      throw new Error('No quote data');
    }
    
    const market = detectMarket(ticker);
    
    console.log(`[OpenBB] Data for ${ticker}:`, quote);
    
    return {
      ticker: ticker.toUpperCase(),
      name: quote.name || ticker.toUpperCase(),
      market: market,
      currency: quote.currency as Currency || getCurrency(market),
      currentPrice: quote.price,
      previousClose: quote.prevClose || quote.price,
      changePercent: quote.changePercent || 0,
      lastUpdated: quote.timestamp || Date.now(),
    } as StockInfo;
  });
  
  return success ? data : null;
}

// 通过 Worker 获取数据
async function fetchFromWorker(ticker: string): Promise<StockInfo | null> {
  // Worker 内部会优先尝试 Yahoo，然后 Polygon
  // 对于港股/A股，我们需要转换 ticker 格式传给 Worker（如果 Worker 内部没做处理）
  // 假设 Worker 直接透传给 Yahoo，我们需要把 ticker 转成 Yahoo 格式
  
  let queryTicker = ticker;
  const market = detectMarket(ticker);
  
  if (market === 'HK') {
    queryTicker = ticker.replace('.HK', '') + '.HK';
  } else if (market === 'CN') {
    if (ticker.startsWith('6')) {
      queryTicker = ticker + '.SS';
    } else {
      queryTicker = ticker + '.SZ';
    }
  } else if (ticker.length > 10 && /\d/.test(ticker)) {
    // 可能是期权代码，尝试去除空格
    queryTicker = ticker.replace(/\s+/g, '');
  }
  
  const url = `${WORKER_PROXY_URL}/quote?symbol=${encodeURIComponent(queryTicker)}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.error) return null;
    
    console.log(`[Worker] Data for ${ticker}:`, data); // 添加调试日志

    // 计算涨跌幅
    const currentPrice = data.price;
    const previousClose = data.prevClose || currentPrice;
    const changePercent = previousClose > 0 
      ? ((currentPrice - previousClose) / previousClose) * 100 
      : 0;
      
    return {
      ticker: ticker.toUpperCase(),
      name: ticker.toUpperCase(), // Worker 暂未返回名称，沿用 ticker
      market: market,
      currency: data.currency || getCurrency(market),
      currentPrice,
      previousClose,
      changePercent,
      lastUpdated: data.timestamp || Date.now(),
    };
  } catch (error) {
    console.warn(`Worker API failed for ${ticker}:`, error);
    return null;
  }
}

// 当前代理索引
let currentProxyIndex = 0;

// 获取下一个代理
function getNextProxy(): string {
  const proxy = CORS_PROXIES[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % CORS_PROXIES.length;
  return proxy;
}

// 判断市场类型
export function detectMarket(ticker: string): Market {
  const upperTicker = ticker.toUpperCase();
  
  // A股：6位数字，以6开头为上海，以0/3开头为深圳
  if (/^\d{6}$/.test(ticker)) {
    return 'CN';
  }
  
  // 港股：4-5位数字或以.HK结尾
  if (/^\d{4,5}$/.test(ticker) || upperTicker.endsWith('.HK')) {
    return 'HK';
  }
  
  // 美股：字母代码
  return 'US';
}

// 获取货币类型
export function getCurrency(market: Market): Currency {
  switch (market) {
    case 'CN': return 'CNY';
    case 'HK': return 'HKD';
    case 'US': return 'USD';
  }
}

// 格式化股票代码（用于腾讯API）
function formatTickerForTencent(ticker: string, market: Market): string {
  const cleanTicker = ticker.replace('.HK', '').replace('.SH', '').replace('.SZ', '');
  
  switch (market) {
    case 'CN':
      // A股：sh/sz + 代码
      if (cleanTicker.startsWith('6')) {
        return `sh${cleanTicker}`;
      }
      return `sz${cleanTicker}`;
    case 'HK':
      // 港股：hk + 代码
      return `hk${cleanTicker.padStart(5, '0')}`;
    default:
      return ticker;
  }
}

// 检查美股市场是否开盘（美东时间 9:30-16:00）
function checkUSMarketOpen(): boolean {
  const now = new Date();
  // 转换为美东时间（UTC-5 或 UTC-4 夏令时）
  const etOffset = -5; // 简化处理，不考虑夏令时
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const etHours = (utcHours + 24 + etOffset) % 24;
  const etTime = etHours * 60 + utcMinutes;
  
  // 美股交易时间：9:30-16:00 ET
  const marketOpen = 9 * 60 + 30; // 9:30
  const marketClose = 16 * 60; // 16:00
  
  // 检查是否为工作日（简化处理，不考虑节假日）
  const dayOfWeek = now.getUTCDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  
  return isWeekday && etTime >= marketOpen && etTime < marketClose;
}

// 计算预期的最新数据日期
export function getExpectedDataDate(): Date {
  const now = new Date();
  
  // 转换为美东时间 (UTC-5, 简化处理)
  const etOffset = -5;
  const utcHours = now.getUTCHours();
  const etHours = (utcHours + 24 + etOffset) % 24;
  
  // 美股收盘时间: 16:00 ET (UTC 21:00)
  // 北京时间 (UTC+8): 次日 05:00
  // IBKR 报表生成时间: 北京时间 10:00 (UTC 02:00)
  
  // 逻辑:
  // 如果现在是北京时间 10:00 之后 (UTC 02:00)，我们应该有“昨天”的数据（如果是工作日）
  // 如果是周二-周六的 10:00 后，应该有前一天的收盘数据
  // 如果是周日/周一，最近的交易日是周五
  
  // 简化算法：
  // 1. 获取当前 UTC 时间
  // 2. 如果 UTC 时间 < 02:00 (北京 10:00)，我们还在等待今天的报告，所以预期日期是“前天”
  // 3. 如果 UTC 时间 >= 02:00，预期日期是“昨天”
  // 4. 然后回退直到找到最近的工作日 (周一到周五)
  
  const reportReadyHourUTC = 2; // 北京时间 10:00
  let targetDate = new Date(now);
  
  // 如果还没到报告生成时间，回退一天
  if (now.getUTCHours() < reportReadyHourUTC) {
    targetDate.setDate(targetDate.getDate() - 1);
  }
  
  // 回退一天，因为报告是关于“昨天”的交易
  targetDate.setDate(targetDate.getDate() - 1);
  
  // 如果目标日期是周末，继续回退到周五
  // getUTCDay: 0=Sun, 6=Sat
  while (targetDate.getUTCDay() === 0 || targetDate.getUTCDay() === 6) {
    targetDate.setDate(targetDate.getDate() - 1);
  }
  
  // 设置时间为 00:00:00 以便比较
  targetDate.setHours(0, 0, 0, 0);
  return targetDate;
}

// GBK 解码
function decodeGBK(buffer: ArrayBuffer): string {
  try {
    const decoder = new TextDecoder('gbk');
    return decoder.decode(buffer);
  } catch {
    // 如果 GBK 解码失败，尝试 UTF-8
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }
}

// 腾讯财经 API（A股/港股）
// 带健康追踪的版本
async function fetchFromTencent(ticker: string, market: Market): Promise<StockInfo | null> {
  const { data, success } = await withHealthTracking('tencent', async () => {
    const formattedTicker = formatTickerForTencent(ticker, market);
    const url = `https://qt.gtimg.cn/q=${formattedTicker}`;
    
    // 优先尝试本地代理（如果是开发环境）
    const isDev = import.meta.env.DEV;
    const proxiesToTry = isDev 
      ? [`/api/tencent/${formattedTicker}`] 
      : [...CORS_PROXIES.map(p => p.startsWith('/') ? p + formattedTicker : p + encodeURIComponent(url))];

    for (const proxyUrl of proxiesToTry) {
      const response = await fetch(proxyUrl, {
        headers: {
          'Accept': '*/*',
        },
      });
      
      if (!response.ok) continue;
      
      const buffer = await response.arrayBuffer();
      const text = decodeGBK(buffer);
      
      // 解析腾讯数据格式
      const match = text.match(/v_[^=]+=["']([^"']+)["']/);
      if (!match) continue;
      
      const parts = match[1].split('~');
      if (parts.length < 35) continue;
      
      const name = parts[1];
      const currentPrice = parseFloat(parts[3]) || 0;
      const previousClose = parseFloat(parts[4]) || currentPrice;
      const changePercent = previousClose > 0 
        ? ((currentPrice - previousClose) / previousClose) * 100 
        : 0;
      
      return {
        ticker: ticker,
        name: name || ticker,
        market,
        currency: getCurrency(market),
        currentPrice,
        previousClose,
        changePercent,
        lastUpdated: Date.now(),
      } as StockInfo;
    }
    
    throw new Error('All Tencent proxies failed');
  });
  
  return success ? data : null;
}

// Finnhub API（美股）- 支持 CORS，免费版每分钟 60 次
async function fetchFromFinnhub(ticker: string): Promise<StockInfo | null> {
  // Finnhub 免费 API key (用户提供)
  const apiKey = 'd52n68hr01qggm5spiugd52n68hr01qggm5spiv0';
  const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (!data.c || data.c === 0) {
      return null;
    }
    
    const currentPrice = data.c || 0; // Current price
    const previousClose = data.pc || currentPrice; // Previous close
    const changePercent = previousClose > 0 
      ? ((currentPrice - previousClose) / previousClose) * 100 
      : 0;
    
    return {
      ticker: ticker.toUpperCase(),
      name: ticker.toUpperCase(), // Finnhub 不返回名称
      market: 'US',
      currency: 'USD',
      currentPrice,
      previousClose,
      changePercent,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.warn('Finnhub API failed:', error);
    return null;
  }
}

// Polygon.io API（美股）- 使用用户提供的 API Key
const POLYGON_API_KEY = 'X50Z9vTkZFKBGM0cVRL0thD90BNVglhp';

async function fetchFromPolygon(ticker: string): Promise<StockInfo | null> {
  // 1. 尝试获取最新一笔交易（Last Trade）- 最实时
  const tradeUrl = `https://api.polygon.io/v2/last/trade/${ticker.toUpperCase()}?apiKey=${POLYGON_API_KEY}`;
  
  try {
    console.log(`[Polygon] Fetching Last Trade for ${ticker}...`);
    const response = await fetch(tradeUrl);
    
    if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.p) {
            console.log(`[Polygon] Last Trade for ${ticker}:`, data.results);
            return {
                ticker: ticker.toUpperCase(),
                name: ticker.toUpperCase(),
                market: 'US',
                currency: 'USD',
                currentPrice: data.results.p,
                previousClose: data.results.p, // 暂无昨收
                changePercent: 0, // 暂无
                lastUpdated: data.results.t || Date.now(),
            };
        }
    } else {
        console.warn(`[Polygon] Last Trade failed: ${response.status}`);
    }

    // 2. 如果 Last Trade 失败（可能是权限问题），尝试 Aggs (上一分钟柱子)
    // 获取当前时间的分钟柱子可能需要计算时间戳，这里简化，获取最近的
    // v2/aggs/ticker/{ticker}/range/1/minute/{today}/{today}
    // 但这需要日期。
    
    // 回退到 Prev Close (前一日收盘) - 这是我们不想用的，但作为最后的兜底
    const prevUrl = `https://api.polygon.io/v2/aggs/ticker/${ticker.toUpperCase()}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`;
    const prevResponse = await fetch(prevUrl);
    if (prevResponse.ok) {
        const prevData = await prevResponse.json();
        if (prevData.results && prevData.results.length > 0) {
            const result = prevData.results[0];
            console.log(`[Polygon] Prev Close for ${ticker}:`, result);
            return {
                ticker: ticker.toUpperCase(),
                name: ticker.toUpperCase(),
                market: 'US',
                currency: 'USD',
                currentPrice: result.c,
                previousClose: result.o,
                changePercent: ((result.c - result.o) / result.o) * 100,
                lastUpdated: Date.now(),
            };
        }
    }
    
    return null;
  } catch (error) {
    console.warn('Polygon API failed:', error);
    return null;
  }
}

// Twelve Data API（美股/外汇）- 免费版有限制
async function fetchFromTwelveData(ticker: string): Promise<StockInfo | null> {
  // 注意：Twelve Data 免费版每分钟8次请求限制
  // 这里使用公开的 demo key，生产环境应使用自己的 key
  const apiKey = 'demo';
  const url = `https://api.twelvedata.com/quote?symbol=${ticker}&apikey=${apiKey}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.status === 'error' || !data.symbol) {
      return null;
    }
    
    const currentPrice = parseFloat(data.close) || 0;
    const previousClose = parseFloat(data.previous_close) || currentPrice;
    const changePercent = parseFloat(data.percent_change) || 0;
    
    return {
      ticker: ticker.toUpperCase(),
      name: data.name || ticker,
      market: 'US',
      currency: 'USD',
      currentPrice,
      previousClose,
      changePercent,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.warn('Twelve Data API failed:', error);
    return null;
  }
}

// 备用数据源：Yahoo Finance（通过 Worker 代理）
async function fetchFromYahoo(ticker: string, market: Market): Promise<StockInfo | null> {
  let yahooTicker = ticker;
  
  // 转换为 Yahoo 格式
  if (market === 'HK') {
    yahooTicker = ticker.replace('.HK', '') + '.HK';
  } else if (market === 'CN') {
    if (ticker.startsWith('6')) {
      yahooTicker = ticker + '.SS';
    } else {
      yahooTicker = ticker + '.SZ';
    }
  }
  
  // 使用 Worker 代理获取 Yahoo 数据
  const workerUrl = `${WORKER_PROXY_URL}/quote?symbol=${encodeURIComponent(yahooTicker)}`;
  
  try {
    const response = await fetch(workerUrl);
    if (!response.ok) {
      console.warn(`Worker proxy failed for Yahoo ${ticker}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.warn(`Yahoo API error for ${ticker}:`, data.error);
      return null;
    }
    
    const currentPrice = data.price || 0;
    const previousClose = data.prevClose || currentPrice;
    const changePercent = previousClose > 0 
      ? ((currentPrice - previousClose) / previousClose) * 100 
      : 0;
    
    // 验证价格有效性
    if (currentPrice <= 0) {
      console.warn(`Yahoo API returned invalid price for ${ticker}: ${currentPrice}`);
      return null;
    }
    
    return {
      ticker,
      name: data.symbol || ticker,
      market,
      currency: getCurrency(market),
      currentPrice,
      previousClose,
      changePercent,
      lastUpdated: data.timestamp || Date.now(),
    };
  } catch (error) {
    console.warn(`Yahoo API failed for ${ticker}:`, error);
    return null;
  }
}

// 判断是否为期权代码 (IBKR 格式)
function isOptionSymbol(ticker: string): boolean {
  // 简单的启发式规则：
  // 1. 包含空格 (如 "PDD   251219C...")
  // 2. 长度超过 10 且包含数字 (通常股票代码较短)
  // 3. 包含明显的期权特征 (日期 + C/P)
  if (ticker.includes(' ')) return true;
  if (ticker.length > 9 && /\d{6}[CP]\d+/.test(ticker)) return true;
  // IBKR 格式通常包含大量数字
  if (ticker.length > 12 && /\d/.test(ticker)) return true;
  return false;
}

// 主要获取函数：智能路由 + 自动故障转移
// Property 2: 数据源故障转移
export async function fetchStockData(ticker: string): Promise<MarketDataResponse> {
  // 0. 过滤不支持的证券类型（如期权）
  if (isOptionSymbol(ticker)) {
    console.debug(`[MarketData] Skipping live data for option: ${ticker}`);
    return { 
      success: false, 
      error: 'Real-time data for options is not supported', 
      source: 'skipped' 
    };
  }

  // 1. 先检查缓存
  const cached = getCachedStock(ticker);
  if (cached) {
    // 增加缓存数据的安全性检查：如果缓存价格极其异常（比如之前的 6800 问题），则废弃缓存
    if (cached.currentPrice > 5000 && ['9992', 'PDD', 'BABA', 'TCEHY'].includes(cached.ticker)) {
       // 这是一个简单的黑名单/启发式检查，防止之前的脏数据污染
       console.warn(`[MarketData] Purging suspicious cache for ${ticker}: ${cached.currentPrice}`);
       // 不返回缓存，继续请求
    } else {
       return { success: true, data: cached, source: 'cache' };
    }
  }
  
  const market = detectMarket(ticker);
  let stockInfo: StockInfo | null = null;
  
  // 2. 根据市场类型和数据源健康状态选择数据源
  if (market === 'CN' || market === 'HK') {
    // A股/港股：优先腾讯，备用长桥
    const healthySources = dataSourceHealthMonitor.getHealthySources(market);
    
    for (const source of healthySources) {
      if (source === 'tencent') {
        stockInfo = await fetchFromTencent(ticker, market);
        if (stockInfo) {
          cacheStock(stockInfo);
          return { success: true, data: stockInfo, source: 'tencent' };
        }
      } else if (source === 'longport') {
        stockInfo = await fetchFromSupabaseLive(ticker);
        if (stockInfo) {
          cacheStock(stockInfo);
          return { success: true, data: stockInfo, source: 'longport' };
        }
      }
    }
    
    // 所有健康数据源都失败了，尝试不健康的数据源作为最后手段
    console.warn(`[MarketData] All healthy sources failed for ${ticker}, trying unhealthy sources`);
    stockInfo = await fetchFromTencent(ticker, market);
    if (!stockInfo) {
      stockInfo = await fetchFromSupabaseLive(ticker);
    }
  } else {
    // 美股策略：根据健康状态自动故障转移
    // 优先级：longport > openbb > finnhub > polygon > yahoo
    
    // 检查 longport 是否健康
    if (dataSourceHealthMonitor.isHealthy('longport')) {
      stockInfo = await fetchFromSupabaseLive(ticker);
      if (stockInfo) {
        cacheStock(stockInfo);
        return { success: true, data: stockInfo, source: 'longport' };
      }
    } else {
      console.log(`[MarketData] Skipping unhealthy longport for ${ticker}`);
    }
    
    // 检查 openbb 是否健康
    if (dataSourceHealthMonitor.isHealthy('openbb')) {
      stockInfo = await fetchFromOpenBB(ticker);
      if (stockInfo) {
        cacheStock(stockInfo);
        return { success: true, data: stockInfo, source: 'openbb' };
      }
    } else {
      console.log(`[MarketData] Skipping unhealthy openbb for ${ticker}`);
    }
    
    // 备用数据源（不受健康监控）
    stockInfo = await fetchFromFinnhub(ticker);
    if (stockInfo) {
      cacheStock(stockInfo);
      return { success: true, data: stockInfo, source: 'finnhub' };
    }
    
    stockInfo = await fetchFromPolygon(ticker);
    if (stockInfo) {
      cacheStock(stockInfo);
      return { success: true, data: stockInfo, source: 'polygon' };
    }
    
    // 最后的备用方案
    const isUSMarketOpen = checkUSMarketOpen();
    if (isUSMarketOpen) {
      stockInfo = await fetchFromYahoo(ticker, 'US');
      if (stockInfo) {
        cacheStock(stockInfo);
        return { success: true, data: stockInfo, source: 'yahoo' };
      }
    }
  }
  
  // 4. 缓存并返回
  if (stockInfo) {
    cacheStock(stockInfo);
    return { 
      success: true, 
      data: stockInfo, 
      source: market === 'US' ? 'openbb' : 'tencent' 
    };
  }
  
  return { 
    success: false, 
    error: '无法获取股票数据，请检查代码是否正确',
    source: 'cache'
  };
}

// 批量获取股票数据
export async function fetchMultipleStocks(tickers: string[]): Promise<Map<string, StockInfo>> {
  const results = new Map<string, StockInfo>();
  
  // 过滤掉期权代码
  const validTickers = tickers.filter(t => !isOptionSymbol(t));
  
  // 1. 优先从 Supabase live 表批量获取
  try {
    const liveQuotesMap = await getLiveQuotesMap(validTickers);
    
    // 使用 Array.from 来迭代 Map，避免 downlevelIteration 问题
    Array.from(liveQuotesMap.entries()).forEach(([ticker, quote]) => {
      if (quote && quote.price) {
        const market = detectMarket(ticker);
        const previousClose = quote.prev_close || quote.price;
        const changePercent = quote.change_percent ?? 
          (previousClose > 0 ? ((quote.price - previousClose) / previousClose) * 100 : 0);
        
        const stockInfo: StockInfo = {
          ticker: ticker.toUpperCase(),
          name: ticker.toUpperCase(),
          market: market,
          currency: getCurrency(market),
          currentPrice: quote.price,
          previousClose,
          changePercent,
          lastUpdated: new Date(quote.updated_at).getTime(),
        };
        
        results.set(ticker, stockInfo);
        cacheStock(stockInfo);
      }
    });
    
    console.log(`[MarketData] Got ${results.size}/${validTickers.length} from Supabase live`);
  } catch (error) {
    console.warn('[MarketData] Supabase live batch fetch failed:', error);
  }
  
  // 2. 对于没有从 live 表获取到的，使用备用数据源
  const missingTickers = validTickers.filter(t => !results.has(t));
  
  if (missingTickers.length > 0) {
    // 并行请求，但限制并发数
    const batchSize = 5;
    for (let i = 0; i < missingTickers.length; i += batchSize) {
      const batch = missingTickers.slice(i, i + batchSize);
      const promises = batch.map(ticker => fetchStockData(ticker));
      const responses = await Promise.all(promises);
      
      responses.forEach((response, index) => {
        if (response.success && response.data) {
          results.set(batch[index], response.data);
        }
      });
      
      // 批次间延迟，避免请求过快
      if (i + batchSize < missingTickers.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }
  
  return results;
}

// 获取汇率
export async function fetchExchangeRates(): Promise<ExchangeRates> {
  const cached = getExchangeRates();
  const cacheAge = Date.now() - cached.timestamp;
  
  // 汇率缓存1小时
  if (cacheAge < 60 * 60 * 1000) {
    return cached;
  }
  
  try {
    // 使用免费汇率 API
    const response = await fetch(
      'https://api.exchangerate-api.com/v4/latest/CNY'
    );
    
    if (!response.ok) throw new Error('Exchange rate API failed');
    
    const data = await response.json();
    
    const rates: ExchangeRates = {
      USD_CNY: 1 / (data.rates.USD || 0.138),
      HKD_CNY: 1 / (data.rates.HKD || 1.075),
      timestamp: Date.now(),
    };
    
    updateExchangeRates(rates);
    return rates;
  } catch (error) {
    console.warn('Failed to fetch exchange rates, using cached:', error);
    return cached;
  }
}

// 货币转换
export function convertToCNY(amount: number, currency: Currency, rates: ExchangeRates): number {
  switch (currency) {
    case 'CNY': return amount;
    case 'USD': return amount * rates.USD_CNY;
    case 'HKD': return amount * rates.HKD_CNY;
  }
}

// 搜索股票（简化版，基于代码匹配）
export function searchStock(query: string): { ticker: string; market: Market }[] {
  const results: { ticker: string; market: Market }[] = [];
  const upperQuery = query.toUpperCase().trim();
  
  // 如果是纯数字，可能是 A股或港股
  if (/^\d+$/.test(upperQuery)) {
    if (upperQuery.length === 6) {
      results.push({ ticker: upperQuery, market: 'CN' });
    } else if (upperQuery.length <= 5) {
      results.push({ ticker: upperQuery.padStart(5, '0'), market: 'HK' });
    }
  } else {
    // 字母代码，视为美股
    results.push({ ticker: upperQuery, market: 'US' });
  }
  
  return results;
}

// 获取 VIX 指数
export const fetchVIX = async (): Promise<number | null> => {
  try {
    // 使用 Worker 获取 VIX
    const vixInfo = await fetchFromWorker('^VIX');
    if (vixInfo) {
      return vixInfo.currentPrice;
    }
    return null;
  } catch (error) {
    console.warn('Failed to fetch VIX:', error);
    return null;
  }
};

// 获取市场指数数据（通过 Yahoo Finance Worker 代理）
export async function fetchMarketIndex(symbol: string): Promise<StockInfo | null> {
  try {
    // 指数符号直接使用 Worker 代理（Yahoo Finance）
    const data = await fetchFromWorker(symbol);
    return data;
  } catch (error) {
    console.warn(`Failed to fetch index ${symbol}:`, error);
    return null;
  }
}

// 获取股票历史数据 (通过 Worker 代理访问 Yahoo Finance)
export async function fetchStockHistory(ticker: string, range: '1mo' | '3mo' = '1mo'): Promise<StockHistory | null> {
  // 转换 ticker 格式
  let queryTicker = ticker;
  const market = detectMarket(ticker);
  
  if (market === 'HK') {
    queryTicker = ticker.replace('.HK', '') + '.HK';
  } else if (market === 'CN') {
    if (ticker.startsWith('6')) {
      queryTicker = ticker + '.SS';
    } else {
      queryTicker = ticker + '.SZ';
    }
  }

  // 优先使用 Cloudflare Worker 代理（支持 Yahoo Finance 历史数据）
  const workerUrl = `${WORKER_PROXY_URL}/quote?symbol=${encodeURIComponent(queryTicker)}&history=true&range=${range}`;
  
  try {
    const response = await fetch(workerUrl);
    if (!response.ok) {
      console.warn(`Worker proxy failed for ${ticker}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    
    if (!result) {
      console.warn(`No chart data for ${ticker}`);
      return null;
    }
    
    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];
    
    if (!quote) {
      console.warn(`No quote data for ${ticker}`);
      return null;
    }
    
    const historyItems: StockHistoryItem[] = [];
    
    for (let i = 0; i < timestamps.length; i++) {
      // 过滤掉无效数据
      if (quote.close[i] === null || quote.high[i] === null || quote.low[i] === null) continue;
      
      historyItems.push({
        date: new Date(timestamps[i] * 1000).toISOString(),
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
        volume: quote.volume[i] || 0
      });
    }
    
    // 按日期降序排序 (最新的在前面)
    historyItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return {
      ticker,
      data: historyItems
    };
    
  } catch (error) {
    console.warn(`Failed to fetch history for ${ticker}:`, error);
    return null;
  }
}

// 导出数据源健康监控相关功能
export { dataSourceHealthMonitor } from './dataSourceHealth';
export type { DataSource, DataSourceHealth } from './dataSourceHealth';

// 获取所有数据源健康状态
export function getDataSourcesHealth() {
  return dataSourceHealthMonitor.getAllHealth();
}
