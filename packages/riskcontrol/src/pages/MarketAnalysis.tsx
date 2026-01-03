/**
 * MarketAnalysis - 市场分析平台
 * 
 * 提供完整的市场分析功能：
 * - 全球市场指数概览
 * - 板块热力图
 * - 市场情绪指标 (VIX, 涨跌比)
 * - 涨跌幅排行榜
 * - 财经日历
 * - 宏观经济数据
 * 
 * 参考: OpenBB Platform 的 Economy/Equity Extension 设计
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { 
  TrendingUp, 
  TrendingDown,
  Activity, 
  ArrowLeft,
  RefreshCw,
  Globe,
  BarChart3,
  Calendar,
  Gauge,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchVIX, fetchStockData, fetchMarketIndex, detectMarket } from '@/services/marketData';
import { openbbClient } from '@/services/openbbClient';
import { EconomicCalendar } from '@/components/market/EconomicCalendar';
import { MacroDataPanel } from '@/components/market/MacroDataPanel';

// ============ Types ============

interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  region: 'US' | 'HK' | 'CN' | 'EU';
}

interface SectorData {
  name: string;
  changePercent: number;
  volume?: number;
}

interface TopMover {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
}

interface MarketSentiment {
  vix: number | null;
  vixChange: number;
  advanceDecline: { advances: number; declines: number; unchanged: number };
  fearGreedIndex?: number;
}

type TabId = 'overview' | 'sectors' | 'movers' | 'calendar' | 'economy';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
}

const TABS: Tab[] = [
  { id: 'overview', label: '市场概览', icon: Globe, description: '全球主要指数' },
  { id: 'sectors', label: '板块热力图', icon: Flame, description: '行业板块涨跌' },
  { id: 'movers', label: '涨跌排行', icon: BarChart3, description: '涨幅榜/跌幅榜' },
  { id: 'calendar', label: '财经日历', icon: Calendar, description: '重要事件' },
  { id: 'economy', label: '宏观数据', icon: Gauge, description: '经济指标' },
];

// 全球主要指数配置
const MARKET_INDICES = [
  // 美股
  { symbol: '^DJI', name: '道琼斯', region: 'US' as const },
  { symbol: '^GSPC', name: '标普500', region: 'US' as const },
  { symbol: '^IXIC', name: '纳斯达克', region: 'US' as const },
  { symbol: '^RUT', name: '罗素2000', region: 'US' as const },
  // 港股
  { symbol: '^HSI', name: '恒生指数', region: 'HK' as const },
  { symbol: '^HSCE', name: '国企指数', region: 'HK' as const },
  // A股
  { symbol: '000001.SS', name: '上证指数', region: 'CN' as const },
  { symbol: '399001.SZ', name: '深证成指', region: 'CN' as const },
  // 欧洲
  { symbol: '^FTSE', name: '富时100', region: 'EU' as const },
  { symbol: '^GDAXI', name: '德国DAX', region: 'EU' as const },
];

// 美股板块 ETF (用于板块热力图)
const SECTOR_ETFS = [
  { symbol: 'XLK', name: '科技' },
  { symbol: 'XLF', name: '金融' },
  { symbol: 'XLV', name: '医疗' },
  { symbol: 'XLE', name: '能源' },
  { symbol: 'XLI', name: '工业' },
  { symbol: 'XLY', name: '消费' },
  { symbol: 'XLP', name: '必需品' },
  { symbol: 'XLU', name: '公用事业' },
  { symbol: 'XLB', name: '材料' },
  { symbol: 'XLRE', name: '房地产' },
  { symbol: 'XLC', name: '通信' },
];

// M7 科技巨头
const M7_STOCKS = [
  { symbol: 'AAPL', name: '苹果', category: 'M7' },
  { symbol: 'MSFT', name: '微软', category: 'M7' },
  { symbol: 'GOOGL', name: '谷歌', category: 'M7' },
  { symbol: 'AMZN', name: '亚马逊', category: 'M7' },
  { symbol: 'NVDA', name: '英伟达', category: 'M7' },
  { symbol: 'META', name: 'Meta', category: 'M7' },
  { symbol: 'TSLA', name: '特斯拉', category: 'M7' },
];

// 中概互联股票
const CHINA_TECH_STOCKS = [
  { symbol: 'BABA', name: '阿里巴巴', category: '中概' },
  { symbol: 'PDD', name: '拼多多', category: '中概' },
  { symbol: 'JD', name: '京东', category: '中概' },
  { symbol: 'BIDU', name: '百度', category: '中概' },
  { symbol: 'NIO', name: '蔚来', category: '中概' },
  { symbol: 'XPEV', name: '小鹏', category: '中概' },
  { symbol: 'LI', name: '理想', category: '中概' },
  { symbol: 'TME', name: '腾讯音乐', category: '中概' },
  { symbol: 'BILI', name: 'B站', category: '中概' },
  { symbol: 'NTES', name: '网易', category: '中概' },
];

// 热门股票数据类型
interface HotStock {
  symbol: string;
  name: string;
  category: string;
  price: number;
  change: number;
  changePercent: number;
}

// ============ Components ============

// 市场指数卡片
function IndexCard({ index, isLoading }: { index: MarketIndex | null; isLoading: boolean }) {
  if (isLoading || !index) {
    return (
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-20 mb-2"></div>
        <div className="h-6 bg-white/10 rounded w-24 mb-1"></div>
        <div className="h-4 bg-white/10 rounded w-16"></div>
      </div>
    );
  }

  const isPositive = index.changePercent >= 0;
  
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white/50">{index.name}</span>
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded',
          index.region === 'US' && 'bg-blue-500/20 text-blue-400',
          index.region === 'HK' && 'bg-red-500/20 text-red-400',
          index.region === 'CN' && 'bg-yellow-500/20 text-yellow-400',
          index.region === 'EU' && 'bg-purple-500/20 text-purple-400',
        )}>
          {index.region}
        </span>
      </div>
      <div className="text-xl font-bold text-white mb-1">
        {index.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className={cn(
        'flex items-center gap-1 text-sm',
        isPositive ? 'text-green-400' : 'text-red-400'
      )}>
        {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        <span>{isPositive ? '+' : ''}{index.changePercent.toFixed(2)}%</span>
        <span className="text-white/30 ml-1">
          ({isPositive ? '+' : ''}{index.change.toFixed(2)})
        </span>
      </div>
    </div>
  );
}

// 市场情绪指标卡片
function SentimentCard({ sentiment, isLoading }: { sentiment: MarketSentiment | null; isLoading: boolean }) {
  if (isLoading || !sentiment) {
    return (
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-24 mb-3"></div>
        <div className="h-8 bg-white/10 rounded w-16"></div>
      </div>
    );
  }

  const vixLevel = sentiment.vix !== null 
    ? sentiment.vix < 15 ? 'low' : sentiment.vix < 25 ? 'normal' : sentiment.vix < 35 ? 'high' : 'extreme'
    : 'unknown';

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className={cn(
          vixLevel === 'low' && 'text-green-400',
          vixLevel === 'normal' && 'text-blue-400',
          vixLevel === 'high' && 'text-yellow-400',
          vixLevel === 'extreme' && 'text-red-400',
        )} />
        <span className="text-sm text-white/50">VIX 恐慌指数</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn(
          'text-2xl font-bold',
          vixLevel === 'low' && 'text-green-400',
          vixLevel === 'normal' && 'text-blue-400',
          vixLevel === 'high' && 'text-yellow-400',
          vixLevel === 'extreme' && 'text-red-400',
        )}>
          {sentiment.vix?.toFixed(2) ?? '--'}
        </span>
        <span className={cn(
          'text-sm',
          sentiment.vixChange >= 0 ? 'text-red-400' : 'text-green-400'
        )}>
          {sentiment.vixChange >= 0 ? '+' : ''}{sentiment.vixChange.toFixed(2)}%
        </span>
      </div>
      <div className="mt-2 text-xs text-white/40">
        {vixLevel === 'low' && '市场平静，投资者乐观'}
        {vixLevel === 'normal' && '市场正常波动'}
        {vixLevel === 'high' && '市场波动加剧，谨慎操作'}
        {vixLevel === 'extreme' && '极度恐慌，高风险'}
      </div>
    </div>
  );
}

// 热门股票卡片
function StockCard({ stock, isLoading }: { stock: HotStock | null; isLoading: boolean }) {
  if (isLoading || !stock) {
    return (
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-16 mb-2"></div>
        <div className="h-5 bg-white/10 rounded w-20 mb-1"></div>
        <div className="h-4 bg-white/10 rounded w-14"></div>
      </div>
    );
  }

  const isPositive = stock.changePercent >= 0;
  
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-white">{stock.symbol}</span>
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded',
          stock.category === 'M7' ? 'bg-purple-500/20 text-purple-400' : 'bg-red-500/20 text-red-400'
        )}>
          {stock.category}
        </span>
      </div>
      <div className="text-xs text-white/40 mb-1 truncate">{stock.name}</div>
      <div className="text-lg font-bold text-white">
        ${stock.price.toFixed(2)}
      </div>
      <div className={cn(
        'flex items-center gap-1 text-sm',
        isPositive ? 'text-green-400' : 'text-red-400'
      )}>
        {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        <span>{isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%</span>
      </div>
    </div>
  );
}

// 板块热力图单元格
function SectorCell({ sector, maxChange }: { sector: SectorData; maxChange: number }) {
  const intensity = Math.min(Math.abs(sector.changePercent) / maxChange, 1);
  const isPositive = sector.changePercent >= 0;
  
  return (
    <div 
      className={cn(
        'rounded-lg p-3 transition-all hover:scale-105 cursor-pointer',
        isPositive 
          ? 'bg-green-500' 
          : 'bg-red-500'
      )}
      style={{ 
        opacity: 0.3 + intensity * 0.7,
      }}
    >
      <div className="text-white font-medium text-sm">{sector.name}</div>
      <div className="text-white/90 text-lg font-bold">
        {isPositive ? '+' : ''}{sector.changePercent.toFixed(2)}%
      </div>
    </div>
  );
}

// 涨跌排行榜项
function MoverItem({ mover, rank }: { mover: TopMover; rank: number }) {
  const isPositive = mover.changePercent >= 0;
  
  return (
    <div className="flex items-center gap-3 py-2 px-3 hover:bg-white/[0.02] rounded-lg transition-colors">
      <span className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
        rank <= 3 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/50'
      )}>
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white truncate">{mover.ticker}</div>
        <div className="text-xs text-white/40 truncate">{mover.name}</div>
      </div>
      <div className="text-right">
        <div className="text-white">${mover.price.toFixed(2)}</div>
        <div className={cn(
          'text-sm flex items-center justify-end gap-0.5',
          isPositive ? 'text-green-400' : 'text-red-400'
        )}>
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {isPositive ? '+' : ''}{mover.changePercent.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

// ============ Main Component ============

export default function MarketAnalysis() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // 市场数据状态
  const [indices, setIndices] = useState<Map<string, MarketIndex>>(new Map());
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [topGainers, setTopGainers] = useState<TopMover[]>([]);
  const [topLosers, setTopLosers] = useState<TopMover[]>([]);
  const [hotStocks, setHotStocks] = useState<Map<string, HotStock>>(new Map());

  // 获取市场指数数据
  const fetchIndices = useCallback(async () => {
    const results = new Map<string, MarketIndex>();
    
    // 并行获取所有指数 (使用 fetchMarketIndex，通过 Yahoo Finance Worker 代理)
    const promises = MARKET_INDICES.map(async (idx) => {
      try {
        const data = await fetchMarketIndex(idx.symbol);
        if (data) {
          results.set(idx.symbol, {
            symbol: idx.symbol,
            name: idx.name,
            price: data.currentPrice,
            change: data.currentPrice - data.previousClose,
            changePercent: data.changePercent,
            region: idx.region,
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch ${idx.symbol}:`, err);
      }
    });
    
    await Promise.all(promises);
    setIndices(results);
  }, []);

  // 获取板块数据
  const fetchSectors = useCallback(async () => {
    const sectorData: SectorData[] = [];
    
    const promises = SECTOR_ETFS.map(async (etf) => {
      try {
        const data = await fetchStockData(etf.symbol);
        if (data.success && data.data) {
          sectorData.push({
            name: etf.name,
            changePercent: data.data.changePercent,
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch sector ${etf.symbol}:`, err);
      }
    });
    
    await Promise.all(promises);
    // 按涨跌幅排序
    sectorData.sort((a, b) => b.changePercent - a.changePercent);
    setSectors(sectorData);
  }, []);

  // 获取市场情绪数据
  const fetchSentiment = useCallback(async () => {
    try {
      const vix = await fetchVIX();
      setSentiment({
        vix,
        vixChange: 0, // TODO: 计算变化
        advanceDecline: { advances: 0, declines: 0, unchanged: 0 },
      });
    } catch (err) {
      console.warn('Failed to fetch VIX:', err);
    }
  }, []);

  // 获取热门股票数据 (M7 + 中概)
  // 优先使用 OpenBB 服务，备用 fetchStockData
  const fetchHotStocks = useCallback(async () => {
    const results = new Map<string, HotStock>();
    const allStocks = [...M7_STOCKS, ...CHINA_TECH_STOCKS];
    
    // 先检查 OpenBB 服务是否可用
    const openbbAvailable = await openbbClient.isAvailable().catch(() => false);
    
    const promises = allStocks.map(async (stock) => {
      try {
        let price = 0;
        let prevClose = 0;
        let changePercent = 0;
        
        if (openbbAvailable) {
          // 优先使用 OpenBB
          const quote = await openbbClient.getQuote(stock.symbol).catch(() => null);
          if (quote) {
            price = quote.price;
            prevClose = quote.prevClose || quote.price;
            changePercent = quote.changePercent || 0;
          }
        }
        
        // 如果 OpenBB 失败，回退到 fetchStockData
        if (!price) {
          const data = await fetchStockData(stock.symbol);
          if (data.success && data.data) {
            price = data.data.currentPrice;
            prevClose = data.data.previousClose;
            changePercent = data.data.changePercent;
          }
        }
        
        if (price > 0) {
          results.set(stock.symbol, {
            symbol: stock.symbol,
            name: stock.name,
            category: stock.category,
            price,
            change: price - prevClose,
            changePercent,
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch ${stock.symbol}:`, err);
      }
    });
    
    await Promise.all(promises);
    setHotStocks(results);
  }, []);

  // 刷新所有数据
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchIndices(),
        fetchSectors(),
        fetchSentiment(),
        fetchHotStocks(),
      ]);
      setLastUpdate(new Date());
    } finally {
      setIsLoading(false);
    }
  }, [fetchIndices, fetchSectors, fetchSentiment, fetchHotStocks]);

  // 初始加载
  useEffect(() => {
    refresh();
    // 每分钟自动刷新
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="min-h-screen bg-[#0a0b0f]">
      {/* 页面头部 */}
      <div className="border-b border-white/[0.06] bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setLocation('/dashboard')}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <Globe size={20} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                      市场分析平台
                      <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full flex items-center gap-1">
                        <Activity size={10} />
                        实时
                      </span>
                    </h1>
                    <p className="text-sm text-white/50">全球市场概览与深度分析</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 刷新按钮和时间 */}
            <div className="flex items-center gap-4">
              {lastUpdate && (
                <div className="flex items-center gap-2 text-sm text-white/40">
                  <Clock size={14} />
                  <span>更新于 {lastUpdate.toLocaleTimeString()}</span>
                </div>
              )}
              <button
                onClick={refresh}
                disabled={isLoading}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  isLoading 
                    ? 'bg-white/5 text-white/30' 
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                )}
              >
                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Tab 导航 */}
          <div className="flex gap-2 mt-6 overflow-x-auto pb-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-white/10 text-white border border-white/10'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                )}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 市场概览 Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 市场情绪指标 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SentimentCard sentiment={sentiment} isLoading={isLoading} />
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={16} className="text-green-400" />
                  <span className="text-sm text-white/50">涨跌比</span>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-green-400 text-xl font-bold">
                      {sentiment?.advanceDecline.advances || '--'}
                    </div>
                    <div className="text-xs text-white/40">上涨</div>
                  </div>
                  <div className="text-white/20">:</div>
                  <div>
                    <div className="text-red-400 text-xl font-bold">
                      {sentiment?.advanceDecline.declines || '--'}
                    </div>
                    <div className="text-xs text-white/40">下跌</div>
                  </div>
                </div>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Gauge size={16} className="text-blue-400" />
                  <span className="text-sm text-white/50">市场状态</span>
                </div>
                <div className="text-xl font-bold text-white">正常交易</div>
                <div className="text-xs text-white/40 mt-1">美股盘中</div>
              </div>
            </div>

            {/* 全球指数 */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Globe size={18} className="text-blue-400" />
                全球主要指数
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {MARKET_INDICES.map((idx) => (
                  <IndexCard 
                    key={idx.symbol} 
                    index={indices.get(idx.symbol) || null} 
                    isLoading={isLoading} 
                  />
                ))}
              </div>
            </div>

            {/* 快速板块概览 */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Flame size={18} className="text-orange-400" />
                板块表现
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {sectors.slice(0, 6).map((sector) => (
                  <SectorCell 
                    key={sector.name} 
                    sector={sector} 
                    maxChange={Math.max(...sectors.map(s => Math.abs(s.changePercent)), 1)}
                  />
                ))}
              </div>
            </div>

            {/* M7 科技巨头 */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-purple-400" />
                M7 科技巨头
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {M7_STOCKS.map((stock) => (
                  <StockCard 
                    key={stock.symbol} 
                    stock={hotStocks.get(stock.symbol) || null} 
                    isLoading={isLoading} 
                  />
                ))}
              </div>
            </div>

            {/* 中概互联 */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Globe size={18} className="text-red-400" />
                中概互联
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {CHINA_TECH_STOCKS.map((stock) => (
                  <StockCard 
                    key={stock.symbol} 
                    stock={hotStocks.get(stock.symbol) || null} 
                    isLoading={isLoading} 
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 板块热力图 Tab */}
        {activeTab === 'sectors' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Flame size={18} className="text-orange-400" />
              美股板块热力图
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {sectors.map((sector) => (
                <SectorCell 
                  key={sector.name} 
                  sector={sector} 
                  maxChange={Math.max(...sectors.map(s => Math.abs(s.changePercent)), 1)}
                />
              ))}
            </div>
            {sectors.length === 0 && !isLoading && (
              <div className="text-center py-12 text-white/40">
                暂无板块数据
              </div>
            )}
          </div>
        )}

        {/* 涨跌排行 Tab */}
        {activeTab === 'movers' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 涨幅榜 */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-green-400" />
                涨幅榜
              </h3>
              <div className="space-y-1">
                {topGainers.length > 0 ? (
                  topGainers.map((mover, idx) => (
                    <MoverItem key={mover.ticker} mover={mover} rank={idx + 1} />
                  ))
                ) : (
                  <div className="text-center py-8 text-white/40">
                    暂无数据，请稍后刷新
                  </div>
                )}
              </div>
            </div>
            
            {/* 跌幅榜 */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingDown size={18} className="text-red-400" />
                跌幅榜
              </h3>
              <div className="space-y-1">
                {topLosers.length > 0 ? (
                  topLosers.map((mover, idx) => (
                    <MoverItem key={mover.ticker} mover={mover} rank={idx + 1} />
                  ))
                ) : (
                  <div className="text-center py-8 text-white/40">
                    暂无数据，请稍后刷新
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 财经日历 Tab */}
        {activeTab === 'calendar' && (
          <EconomicCalendar 
            defaultCountries={['us', 'cn', 'eu', 'jp']}
            defaultImportance="all"
            height={550}
            showFilters={true}
          />
        )}

        {/* 宏观数据 Tab */}
        {activeTab === 'economy' && (
          <MacroDataPanel 
            defaultTab="overview"
            height={500}
          />
        )}
      </div>
    </div>
  );
}
