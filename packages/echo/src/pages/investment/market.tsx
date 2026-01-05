/**
 * 投资模块 - 市场分析页面
 * 展示市场数据、图表分析
 * 
 * 从 RiskControl MarketAnalysis.tsx 迁移，使用 HeroUI 组件
 * 
 * **Validates: Requirements 4.1**
 */

import { observer } from 'mobx-react-lite';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardBody,
  Chip,
  Button,
  Tabs,
  Tab,
  Input,
  Spinner,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';
import { EconomicCalendar } from '@/components/investment/EconomicCalendar';
import { MacroDataPanel } from '@/components/investment/MacroDataPanel';
import { TradingViewWidget } from '@/components/investment/TradingViewWidget';
import { TRADINGVIEW_SCRIPTS, STOCK_HEATMAP_CONFIG } from '@/lib/tradingViewConfigs';

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
}

interface HotStock {
  symbol: string;
  name: string;
  category: string;
  price: number;
  change: number;
  changePercent: number;
}

type TabId = 'overview' | 'sectors' | 'calendar' | 'economy' | 'analysis';

// ============ Constants ============

// 全球主要指数配置
const MARKET_INDICES = [
  { symbol: '^DJI', name: '道琼斯', region: 'US' as const },
  { symbol: '^GSPC', name: '标普500', region: 'US' as const },
  { symbol: '^IXIC', name: '纳斯达克', region: 'US' as const },
  { symbol: '^HSI', name: '恒生指数', region: 'HK' as const },
  { symbol: '000001.SS', name: '上证指数', region: 'CN' as const },
  { symbol: '^FTSE', name: '富时100', region: 'EU' as const },
];

// 美股板块 ETF
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
];

// Worker 代理 URL
const WORKER_PROXY_URL = 'https://marketdata.dseirz.workers.dev';

// ============ Data Fetching ============

async function fetchFromWorker(ticker: string): Promise<{ price: number; prevClose: number; changePercent: number } | null> {
  try {
    const url = `${WORKER_PROXY_URL}/quote?symbol=${encodeURIComponent(ticker)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.error) return null;
    
    const price = data.price || 0;
    const prevClose = data.prevClose || price;
    const changePercent = prevClose > 0 
      ? ((price - prevClose) / prevClose) * 100 
      : 0;
    
    return { price, prevClose, changePercent };
  } catch (error) {
    console.warn(`Worker API failed for ${ticker}:`, error);
    return null;
  }
}

// ============ Components ============

// 市场指数卡片
const IndexCard = observer(({ index, isLoading }: { index: MarketIndex | null; isLoading: boolean }) => {
  if (isLoading || !index) {
    return (
      <Card className="bg-content1/50 backdrop-blur-sm animate-pulse">
        <CardBody className="p-4">
          <div className="h-4 bg-foreground/10 rounded w-20 mb-2"></div>
          <div className="h-6 bg-foreground/10 rounded w-24 mb-1"></div>
          <div className="h-4 bg-foreground/10 rounded w-16"></div>
        </CardBody>
      </Card>
    );
  }

  const isPositive = index.changePercent >= 0;
  const regionColors: Record<string, string> = {
    US: 'primary',
    HK: 'danger',
    CN: 'warning',
    EU: 'secondary',
  };

  return (
    <Card className="bg-content1/50 backdrop-blur-sm hover:bg-content1/70 transition-colors">
      <CardBody className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-foreground/60">{index.name}</span>
          <Chip size="sm" color={regionColors[index.region] as any} variant="flat">
            {index.region}
          </Chip>
        </div>
        <div className="text-xl font-bold mb-1">
          {index.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-success' : 'text-danger'}`}>
          <Icon icon={isPositive ? 'mdi:arrow-up' : 'mdi:arrow-down'} />
          <span>{isPositive ? '+' : ''}{index.changePercent.toFixed(2)}%</span>
          <span className="text-foreground/30 ml-1">
            ({isPositive ? '+' : ''}{index.change.toFixed(2)})
          </span>
        </div>
      </CardBody>
    </Card>
  );
});

// 热门股票卡片
const StockCard = observer(({ stock, isLoading }: { stock: HotStock | null; isLoading: boolean }) => {
  if (isLoading || !stock) {
    return (
      <Card className="bg-content1/50 backdrop-blur-sm animate-pulse">
        <CardBody className="p-3">
          <div className="h-4 bg-foreground/10 rounded w-16 mb-2"></div>
          <div className="h-5 bg-foreground/10 rounded w-20 mb-1"></div>
          <div className="h-4 bg-foreground/10 rounded w-14"></div>
        </CardBody>
      </Card>
    );
  }

  const isPositive = stock.changePercent >= 0;
  
  return (
    <Card className="bg-content1/50 backdrop-blur-sm hover:bg-content1/70 transition-colors">
      <CardBody className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">{stock.symbol}</span>
          <Chip 
            size="sm" 
            color={stock.category === 'M7' ? 'secondary' : 'danger'} 
            variant="flat"
          >
            {stock.category}
          </Chip>
        </div>
        <div className="text-xs text-foreground/40 mb-1 truncate">{stock.name}</div>
        <div className="text-lg font-bold">
          ${stock.price.toFixed(2)}
        </div>
        <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-success' : 'text-danger'}`}>
          <Icon icon={isPositive ? 'mdi:arrow-up' : 'mdi:arrow-down'} className="text-xs" />
          <span>{isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%</span>
        </div>
      </CardBody>
    </Card>
  );
});

// 板块热力图单元格
const SectorCell = ({ sector, maxChange }: { sector: SectorData; maxChange: number }) => {
  const intensity = Math.min(Math.abs(sector.changePercent) / maxChange, 1);
  const isPositive = sector.changePercent >= 0;
  
  return (
    <div 
      className={`rounded-lg p-3 transition-all hover:scale-105 cursor-pointer ${
        isPositive ? 'bg-success' : 'bg-danger'
      }`}
      style={{ opacity: 0.3 + intensity * 0.7 }}
    >
      <div className="text-white font-medium text-sm">{sector.name}</div>
      <div className="text-white/90 text-lg font-bold">
        {isPositive ? '+' : ''}{sector.changePercent.toFixed(2)}%
      </div>
    </div>
  );
};

// VIX 情绪卡片
const SentimentCard = ({ vix, isLoading }: { vix: number | null; isLoading: boolean }) => {
  if (isLoading || vix === null) {
    return (
      <Card className="bg-content1/50 backdrop-blur-sm animate-pulse">
        <CardBody className="p-4">
          <div className="h-4 bg-foreground/10 rounded w-24 mb-3"></div>
          <div className="h-8 bg-foreground/10 rounded w-16"></div>
        </CardBody>
      </Card>
    );
  }

  const vixLevel = vix < 15 ? 'low' : vix < 25 ? 'normal' : vix < 35 ? 'high' : 'extreme';
  const levelColors = {
    low: 'success',
    normal: 'primary',
    high: 'warning',
    extreme: 'danger',
  };
  const levelTexts = {
    low: '市场平静，投资者乐观',
    normal: '市场正常波动',
    high: '市场波动加剧，谨慎操作',
    extreme: '极度恐慌，高风险',
  };

  return (
    <Card className="bg-content1/50 backdrop-blur-sm">
      <CardBody className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon icon="mdi:alert-circle" className={`text-${levelColors[vixLevel]}`} />
          <span className="text-sm text-foreground/50">VIX 恐慌指数</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold text-${levelColors[vixLevel]}`}>
            {vix.toFixed(2)}
          </span>
        </div>
        <div className="mt-2 text-xs text-foreground/40">
          {levelTexts[vixLevel]}
        </div>
      </CardBody>
    </Card>
  );
};

// ============ Main Component ============

const MarketAnalysisPage = observer(() => {
  const [selectedTab, setSelectedTab] = useState<TabId>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // 市场数据状态
  const [indices, setIndices] = useState<Map<string, MarketIndex>>(new Map());
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [vix, setVix] = useState<number | null>(null);
  const [hotStocks, setHotStocks] = useState<Map<string, HotStock>>(new Map());

  // 获取市场指数数据
  const fetchIndices = useCallback(async () => {
    const results = new Map<string, MarketIndex>();
    
    const promises = MARKET_INDICES.map(async (idx) => {
      try {
        const data = await fetchFromWorker(idx.symbol);
        if (data) {
          results.set(idx.symbol, {
            symbol: idx.symbol,
            name: idx.name,
            price: data.price,
            change: data.price - data.prevClose,
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
        const data = await fetchFromWorker(etf.symbol);
        if (data) {
          sectorData.push({
            name: etf.name,
            changePercent: data.changePercent,
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch sector ${etf.symbol}:`, err);
      }
    });
    
    await Promise.all(promises);
    sectorData.sort((a, b) => b.changePercent - a.changePercent);
    setSectors(sectorData);
  }, []);

  // 获取 VIX
  const fetchVIX = useCallback(async () => {
    try {
      const data = await fetchFromWorker('^VIX');
      if (data) {
        setVix(data.price);
      }
    } catch (err) {
      console.warn('Failed to fetch VIX:', err);
    }
  }, []);

  // 获取热门股票数据
  const fetchHotStocks = useCallback(async () => {
    const results = new Map<string, HotStock>();
    const allStocks = [...M7_STOCKS, ...CHINA_TECH_STOCKS];
    
    const promises = allStocks.map(async (stock) => {
      try {
        const data = await fetchFromWorker(stock.symbol);
        if (data && data.price > 0) {
          results.set(stock.symbol, {
            symbol: stock.symbol,
            name: stock.name,
            category: stock.category,
            price: data.price,
            change: data.price - data.prevClose,
            changePercent: data.changePercent,
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
        fetchVIX(),
        fetchHotStocks(),
      ]);
      setLastUpdate(new Date());
    } finally {
      setIsLoading(false);
    }
  }, [fetchIndices, fetchSectors, fetchVIX, fetchHotStocks]);

  // 初始加载
  useEffect(() => {
    refresh();
    // 每分钟自动刷新
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <GradientBackground className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Link to="/investment">
              <Button isIconOnly variant="light" size="sm">
                <Icon icon="mdi:arrow-left" className="text-xl" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Icon icon="mdi:chart-line" className="text-success" />
                市场分析
                <Chip size="sm" color="primary" variant="flat" className="ml-2">
                  <Icon icon="mdi:pulse" className="mr-1" />
                  实时
                </Chip>
              </h1>
              <p className="text-foreground/60 mt-1">
                全球市场概览与深度分析
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <div className="flex items-center gap-2 text-sm text-foreground/40">
                <Icon icon="mdi:clock-outline" />
                <span>更新于 {lastUpdate.toLocaleTimeString()}</span>
              </div>
            )}
            <Button
              color="primary"
              variant="flat"
              startContent={isLoading ? <Spinner size="sm" /> : <Icon icon="mdi:refresh" />}
              onPress={refresh}
              isDisabled={isLoading}
            >
              刷新
            </Button>
          </div>
        </div>

        {/* 搜索栏 */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardBody className="p-4">
            <Input
              placeholder="搜索股票代码或名称..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              startContent={<Icon icon="mdi:magnify" className="text-foreground/50" />}
              size="lg"
            />
          </CardBody>
        </Card>

        {/* 标签页 */}
        <Tabs
          selectedKey={selectedTab}
          onSelectionChange={(key) => setSelectedTab(key as TabId)}
          variant="underlined"
          classNames={{
            tabList: 'gap-6',
            cursor: 'bg-primary',
            tab: 'px-0 h-12',
          }}
        >
          <Tab
            key="overview"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:view-dashboard" />
                <span>市场概览</span>
              </div>
            }
          />
          <Tab
            key="sectors"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:fire" />
                <span>板块热力图</span>
              </div>
            }
          />
          <Tab
            key="calendar"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:calendar" />
                <span>财经日历</span>
              </div>
            }
          />
          <Tab
            key="economy"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:gauge" />
                <span>宏观数据</span>
              </div>
            }
          />
          <Tab
            key="analysis"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:chart-timeline-variant" />
                <span>技术分析</span>
              </div>
            }
          />
        </Tabs>

        {/* 市场概览 Tab */}
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            {/* 市场情绪指标 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SentimentCard vix={vix} isLoading={isLoading} />
              <Card className="bg-content1/50 backdrop-blur-sm">
                <CardBody className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon icon="mdi:trending-up" className="text-success" />
                    <span className="text-sm text-foreground/50">市场状态</span>
                  </div>
                  <div className="text-xl font-bold">正常交易</div>
                  <div className="text-xs text-foreground/40 mt-1">美股盘中</div>
                </CardBody>
              </Card>
              <Card className="bg-content1/50 backdrop-blur-sm">
                <CardBody className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon icon="mdi:gauge" className="text-primary" />
                    <span className="text-sm text-foreground/50">数据源</span>
                  </div>
                  <div className="text-xl font-bold">Yahoo Finance</div>
                  <div className="text-xs text-foreground/40 mt-1">通过 Worker 代理</div>
                </CardBody>
              </Card>
            </div>

            {/* 全球指数 */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon icon="mdi:earth" className="text-primary" />
                全球主要指数
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon icon="mdi:fire" className="text-warning" />
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
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon icon="mdi:trending-up" className="text-secondary" />
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
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon icon="mdi:earth" className="text-danger" />
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
        {selectedTab === 'sectors' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Icon icon="mdi:fire" className="text-warning" />
              美股板块热力图
            </h2>
            
            {/* 自定义热力图 */}
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {sectors.map((sector) => (
                <SectorCell 
                  key={sector.name} 
                  sector={sector} 
                  maxChange={Math.max(...sectors.map(s => Math.abs(s.changePercent)), 1)}
                />
              ))}
            </div>
            
            {/* TradingView 热力图 */}
            <TradingViewWidget
              title="S&P 500 热力图"
              scriptUrl={TRADINGVIEW_SCRIPTS.stockHeatmap}
              config={STOCK_HEATMAP_CONFIG}
              height={500}
              icon={<Icon icon="mdi:view-grid" className="text-xl text-warning" />}
            />
          </div>
        )}

        {/* 财经日历 Tab */}
        {selectedTab === 'calendar' && (
          <EconomicCalendar 
            defaultCountries={['us', 'cn', 'eu', 'jp']}
            defaultImportance="all"
            height={550}
            showFilters={true}
          />
        )}

        {/* 宏观数据 Tab */}
        {selectedTab === 'economy' && (
          <MacroDataPanel 
            defaultTab="overview"
            height={500}
          />
        )}

        {/* 技术分析 Tab */}
        {selectedTab === 'analysis' && (
          <div className="space-y-6">
            <Card className="bg-content1/50 backdrop-blur-sm">
              <CardBody className="p-4">
                <Input
                  placeholder="输入股票代码进行技术分析，如 AAPL, NVDA..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  startContent={<Icon icon="mdi:magnify" className="text-foreground/50" />}
                  size="lg"
                />
              </CardBody>
            </Card>
            
            {searchQuery ? (
              <TradingViewWidget
                title={`${searchQuery.toUpperCase()} 技术分析`}
                scriptUrl={TRADINGVIEW_SCRIPTS.technicalAnalysis}
                config={{
                  symbol: searchQuery.toUpperCase(),
                  interval: '1D',
                  width: '100%',
                  height: 500,
                  isTransparent: true,
                  colorTheme: 'dark',
                  locale: 'zh_CN',
                }}
                height={500}
                icon={<Icon icon="mdi:chart-timeline-variant" className="text-xl text-primary" />}
              />
            ) : (
              <Card className="bg-content1/50 backdrop-blur-sm">
                <CardBody className="p-8 text-center">
                  <Icon icon="mdi:chart-timeline-variant" className="text-6xl text-primary/50 mb-4 mx-auto" />
                  <h3 className="text-xl font-semibold mb-2">技术分析工具</h3>
                  <p className="text-foreground/60 mb-4">
                    输入股票代码开始技术分析
                  </p>
                </CardBody>
              </Card>
            )}
          </div>
        )}
      </div>
    </GradientBackground>
  );
});

export default MarketAnalysisPage;
