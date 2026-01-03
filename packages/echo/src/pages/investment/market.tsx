/**
 * 投资模块 - 市场分析页面
 * 展示市场数据、图表分析
 * 
 * **Validates: Requirements 4.1**
 */

import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Button,
  Tabs,
  Tab,
  Input,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';

// 市场指数数据（模拟）
const marketIndices = [
  { name: '上证指数', code: 'SH000001', value: 3089.26, change: 0.45, changePercent: 0.015 },
  { name: '深证成指', code: 'SZ399001', value: 9876.54, change: -23.45, changePercent: -0.24 },
  { name: '创业板指', code: 'SZ399006', value: 1923.45, change: 12.34, changePercent: 0.65 },
  { name: '恒生指数', code: 'HK.HSI', value: 17234.56, change: -156.78, changePercent: -0.90 },
  { name: '纳斯达克', code: 'US.IXIC', value: 15678.90, change: 234.56, changePercent: 1.52 },
  { name: '标普500', code: 'US.SPX', value: 4567.89, change: 45.67, changePercent: 1.01 },
];

// 热门股票（模拟）
const hotStocks = [
  { ticker: 'NVDA', name: '英伟达', price: 456.78, change: 12.34, changePercent: 2.78 },
  { ticker: 'AAPL', name: '苹果', price: 178.90, change: -2.34, changePercent: -1.29 },
  { ticker: 'TSLA', name: '特斯拉', price: 234.56, change: 8.90, changePercent: 3.94 },
  { ticker: '600519', name: '贵州茅台', price: 1678.90, change: -23.45, changePercent: -1.38 },
  { ticker: '000858', name: '五粮液', price: 145.67, change: 3.45, changePercent: 2.43 },
];

// 市场指数卡片
const IndexCard = observer(({ index }: { index: typeof marketIndices[0] }) => {
  const isPositive = index.change >= 0;
  const color = isPositive ? 'success' : 'danger';

  return (
    <Card className="bg-content1/50 backdrop-blur-sm">
      <CardBody className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-foreground/60">{index.name}</p>
            <p className="text-2xl font-bold mt-1">{index.value.toLocaleString()}</p>
          </div>
          <Chip color={color} variant="flat" size="sm">
            {isPositive ? '+' : ''}{index.changePercent.toFixed(2)}%
          </Chip>
        </div>
        <div className={`text-sm mt-2 ${isPositive ? 'text-success' : 'text-danger'}`}>
          {isPositive ? '+' : ''}{index.change.toFixed(2)}
        </div>
      </CardBody>
    </Card>
  );
});

// 股票行组件
const StockRow = observer(({ stock }: { stock: typeof hotStocks[0] }) => {
  const isPositive = stock.change >= 0;
  const color = isPositive ? 'text-success' : 'text-danger';
  const bgColor = isPositive ? 'bg-success/10' : 'bg-danger/10';

  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-content2/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">{stock.ticker.slice(0, 2)}</span>
        </div>
        <div>
          <p className="font-semibold">{stock.ticker}</p>
          <p className="text-xs text-foreground/50">{stock.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono font-semibold">${stock.price.toFixed(2)}</p>
        <div className={`text-xs ${color} ${bgColor} px-2 py-0.5 rounded inline-block`}>
          {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
        </div>
      </div>
    </div>
  );
});

// 主页面组件
const MarketAnalysisPage = observer(() => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');

  return (
    <GradientBackground className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
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
              </h1>
              <p className="text-foreground/60 mt-1">
                实时市场数据与技术分析
              </p>
            </div>
          </div>
          <Button
            color="primary"
            variant="flat"
            startContent={<Icon icon="mdi:refresh" />}
          >
            刷新
          </Button>
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
          onSelectionChange={(key) => setSelectedTab(key as string)}
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
            key="indices"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:chart-bar" />
                <span>指数行情</span>
              </div>
            }
          />
          <Tab
            key="stocks"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:fire" />
                <span>热门股票</span>
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

        {/* 市场概览 */}
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            {/* 主要指数 */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon icon="mdi:chart-box" className="text-primary" />
                主要指数
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {marketIndices.map(index => (
                  <IndexCard key={index.code} index={index} />
                ))}
              </div>
            </div>

            {/* 热门股票 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-content1/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon icon="mdi:trending-up" className="text-success" />
                    <h3 className="font-semibold">涨幅榜</h3>
                  </div>
                </CardHeader>
                <CardBody className="pt-0">
                  <div className="space-y-1">
                    {hotStocks.filter(s => s.change > 0).map(stock => (
                      <StockRow key={stock.ticker} stock={stock} />
                    ))}
                  </div>
                </CardBody>
              </Card>

              <Card className="bg-content1/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon icon="mdi:trending-down" className="text-danger" />
                    <h3 className="font-semibold">跌幅榜</h3>
                  </div>
                </CardHeader>
                <CardBody className="pt-0">
                  <div className="space-y-1">
                    {hotStocks.filter(s => s.change < 0).map(stock => (
                      <StockRow key={stock.ticker} stock={stock} />
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        )}

        {/* 指数行情 */}
        {selectedTab === 'indices' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketIndices.map(index => (
              <Card key={index.code} className="bg-content1/50 backdrop-blur-sm">
                <CardBody className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-lg font-semibold">{index.name}</p>
                      <p className="text-xs text-foreground/50">{index.code}</p>
                    </div>
                    <Chip
                      color={index.change >= 0 ? 'success' : 'danger'}
                      variant="flat"
                    >
                      {index.change >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%
                    </Chip>
                  </div>
                  <p className="text-3xl font-bold">{index.value.toLocaleString()}</p>
                  <p className={`text-sm mt-2 ${index.change >= 0 ? 'text-success' : 'text-danger'}`}>
                    {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        {/* 热门股票 */}
        {selectedTab === 'stocks' && (
          <Card className="bg-content1/50 backdrop-blur-sm">
            <CardHeader>
              <h3 className="font-semibold">热门股票</h3>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="space-y-2">
                {hotStocks.map(stock => (
                  <StockRow key={stock.ticker} stock={stock} />
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {/* 技术分析 */}
        {selectedTab === 'analysis' && (
          <Card className="bg-content1/50 backdrop-blur-sm">
            <CardBody className="p-8 text-center">
              <Icon icon="mdi:chart-timeline-variant" className="text-6xl text-primary/50 mb-4 mx-auto" />
              <h3 className="text-xl font-semibold mb-2">技术分析工具</h3>
              <p className="text-foreground/60 mb-4">
                高级图表分析功能正在开发中...
              </p>
              <Button color="primary" variant="flat">
                敬请期待
              </Button>
            </CardBody>
          </Card>
        )}
      </div>
    </GradientBackground>
  );
});

export default MarketAnalysisPage;
