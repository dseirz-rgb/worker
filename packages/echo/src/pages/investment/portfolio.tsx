/**
 * 投资模块 - 持仓管理页面
 * 展示持仓列表、筛选、排序功能
 * 
 * **Validates: Requirements 4.1**
 */

import { observer } from 'mobx-react-lite';
import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Select,
  SelectItem,
  Button,
  Skeleton,
  Progress,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';
import { RootStore } from '@/store';
import { InvestmentStore, type Position } from '@/store/investmentStore';

// 资产类型映射
const assetTypeLabels: Record<string, string> = {
  stock: '股票',
  option: '期权',
  crypto: '加密货币',
  etf: 'ETF',
  bond: '债券',
};

// 排序选项
const sortOptions = [
  { key: 'marketValue', label: '市值' },
  { key: 'unrealizedPnL', label: '盈亏' },
  { key: 'unrealizedPnLPercent', label: '盈亏%' },
  { key: 'weight', label: '权重' },
  { key: 'ticker', label: '代码' },
];

// 筛选选项
const filterOptions = [
  { key: 'all', label: '全部' },
  { key: 'stock', label: '股票' },
  { key: 'option', label: '期权' },
  { key: 'etf', label: 'ETF' },
  { key: 'crypto', label: '加密货币' },
  { key: 'bond', label: '债券' },
];

// 持仓行组件（桌面端表格）
const PositionRow = observer(({ position }: { position: Position }) => {
  const pnlColor = position.unrealizedPnL >= 0 ? 'text-success' : 'text-danger';
  const pnlBgColor = position.unrealizedPnL >= 0 ? 'bg-success/10' : 'bg-danger/10';

  return (
    <TableRow key={position.id}>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-semibold">{position.ticker}</span>
          <span className="text-xs text-foreground/50">{position.name}</span>
        </div>
      </TableCell>
      <TableCell>
        <Chip size="sm" variant="flat">
          {assetTypeLabels[position.assetType] || position.assetType}
        </Chip>
      </TableCell>
      <TableCell className="text-right">
        <span className="font-mono">{position.quantity.toLocaleString()}</span>
      </TableCell>
      <TableCell className="text-right">
        <span className="font-mono">¥{position.avgCost.toFixed(2)}</span>
      </TableCell>
      <TableCell className="text-right">
        <span className="font-mono">¥{position.currentPrice.toFixed(2)}</span>
      </TableCell>
      <TableCell className="text-right">
        <span className="font-mono font-semibold">
          ¥{(position.marketValue / 10000).toFixed(2)}万
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className={`inline-flex flex-col items-end px-2 py-1 rounded ${pnlBgColor}`}>
          <span className={`font-mono font-semibold ${pnlColor}`}>
            {position.unrealizedPnL >= 0 ? '+' : ''}¥{position.unrealizedPnL.toFixed(0)}
          </span>
          <span className={`text-xs ${pnlColor}`}>
            {position.unrealizedPnLPercent >= 0 ? '+' : ''}{position.unrealizedPnLPercent.toFixed(2)}%
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center gap-2 justify-end">
          <Progress
            value={position.weight}
            size="sm"
            color={position.weight > 15 ? 'danger' : position.weight > 10 ? 'warning' : 'primary'}
            className="w-16"
          />
          <span className="font-mono text-sm w-12">{position.weight.toFixed(1)}%</span>
        </div>
      </TableCell>
    </TableRow>
  );
});

// 持仓卡片组件（移动端）
const PositionCard = observer(({ position }: { position: Position }) => {
  const pnlColor = position.unrealizedPnL >= 0 ? 'text-success' : 'text-danger';
  const pnlBgColor = position.unrealizedPnL >= 0 ? 'bg-success/10' : 'bg-danger/10';

  return (
    <Card className="bg-content2/50">
      <CardBody className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg">{position.ticker}</span>
              <Chip size="sm" variant="flat">
                {assetTypeLabels[position.assetType] || position.assetType}
              </Chip>
            </div>
            <span className="text-sm text-foreground/50">{position.name}</span>
          </div>
          <div className={`px-3 py-1 rounded-lg ${pnlBgColor}`}>
            <span className={`font-mono font-semibold ${pnlColor}`}>
              {position.unrealizedPnLPercent >= 0 ? '+' : ''}{position.unrealizedPnLPercent.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-foreground/50">数量</p>
            <p className="font-mono">{position.quantity.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-foreground/50">市值</p>
            <p className="font-mono font-semibold">¥{(position.marketValue / 10000).toFixed(2)}万</p>
          </div>
          <div>
            <p className="text-foreground/50">成本/现价</p>
            <p className="font-mono">¥{position.avgCost.toFixed(2)} / ¥{position.currentPrice.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-foreground/50">盈亏</p>
            <p className={`font-mono ${pnlColor}`}>
              {position.unrealizedPnL >= 0 ? '+' : ''}¥{position.unrealizedPnL.toFixed(0)}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-foreground/50">权重</span>
          <Progress
            value={position.weight}
            size="sm"
            color={position.weight > 15 ? 'danger' : position.weight > 10 ? 'warning' : 'primary'}
            className="flex-1"
          />
          <span className="font-mono text-xs">{position.weight.toFixed(1)}%</span>
        </div>
      </CardBody>
    </Card>
  );
});

// 汇总卡片组件
const SummaryCard = observer(({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color = 'primary' 
}: { 
  title: string; 
  value: string; 
  subtitle?: string; 
  icon: string; 
  color?: string;
}) => (
  <Card className="bg-content1/50 backdrop-blur-sm">
    <CardBody className="p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-${color}/10`}>
          <Icon icon={icon} className={`text-2xl text-${color}`} />
        </div>
        <div>
          <p className="text-sm text-foreground/60">{title}</p>
          <p className="text-xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-foreground/50">{subtitle}</p>}
        </div>
      </div>
    </CardBody>
  </Card>
));

// 主页面组件
const PortfolioPage = observer(() => {
  const store = RootStore.Get(InvestmentStore);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('marketValue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = useState('all');

  // 初始化加载数据
  useEffect(() => {
    if (store.positions.length === 0) {
      store.fetchPositions();
    }
  }, [store]);

  // 筛选和排序后的持仓列表
  const filteredPositions = useMemo(() => {
    let result = [...store.positions];

    // 搜索筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        p => p.ticker.toLowerCase().includes(query) || p.name.toLowerCase().includes(query)
      );
    }

    // 类型筛选
    if (filterType !== 'all') {
      result = result.filter(p => p.assetType === filterType);
    }

    // 排序
    result.sort((a, b) => {
      const aVal = a[sortBy as keyof Position];
      const bVal = b[sortBy as keyof Position];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
      return 0;
    });

    return result;
  }, [store.positions, searchQuery, sortBy, sortOrder, filterType]);

  // 按资产类型分组统计
  const assetTypeStats = useMemo(() => {
    const stats: Record<string, { count: number; value: number }> = {};
    store.positions.forEach(p => {
      if (!stats[p.assetType]) {
        stats[p.assetType] = { count: 0, value: 0 };
      }
      stats[p.assetType].count++;
      stats[p.assetType].value += p.marketValue;
    });
    return stats;
  }, [store.positions]);

  const isLoading = store.loading.positions;

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
                <Icon icon="mdi:wallet" className="text-primary" />
                持仓管理
              </h1>
              <p className="text-foreground/60 mt-1">
                查看和管理您的投资组合
              </p>
            </div>
          </div>
          <Button
            color="primary"
            variant="flat"
            startContent={<Icon icon="mdi:refresh" />}
            isLoading={isLoading}
            onPress={() => store.fetchPositions()}
          >
            刷新
          </Button>
        </div>

        {/* 汇总统计 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            title="总市值"
            value={`¥${(store.totalMarketValue / 10000).toFixed(2)}万`}
            icon="mdi:cash-multiple"
            color="primary"
          />
          <SummaryCard
            title="未实现盈亏"
            value={`${store.totalUnrealizedPnL >= 0 ? '+' : ''}¥${store.totalUnrealizedPnL.toFixed(0)}`}
            subtitle={`${store.totalUnrealizedPnLPercent >= 0 ? '+' : ''}${store.totalUnrealizedPnLPercent.toFixed(2)}%`}
            icon="mdi:chart-line"
            color={store.totalUnrealizedPnL >= 0 ? 'success' : 'danger'}
          />
          <SummaryCard
            title="持仓数量"
            value={`${store.positions.length}`}
            subtitle="个标的"
            icon="mdi:briefcase"
            color="secondary"
          />
          <SummaryCard
            title="资产类型"
            value={`${Object.keys(assetTypeStats).length}`}
            subtitle="种类型"
            icon="mdi:shape"
            color="warning"
          />
        </div>

        {/* 筛选和搜索 */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardBody className="p-4">
            <div className="flex flex-wrap gap-4">
              <Input
                placeholder="搜索代码或名称..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                startContent={<Icon icon="mdi:magnify" className="text-foreground/50" />}
                className="w-full md:w-64"
                size="sm"
              />
              <Select
                label="资产类型"
                selectedKeys={[filterType]}
                onSelectionChange={(keys) => setFilterType(Array.from(keys)[0] as string)}
                className="w-full md:w-40"
                size="sm"
              >
                {filterOptions.map(opt => (
                  <SelectItem key={opt.key}>{opt.label}</SelectItem>
                ))}
              </Select>
              <Select
                label="排序方式"
                selectedKeys={[sortBy]}
                onSelectionChange={(keys) => setSortBy(Array.from(keys)[0] as string)}
                className="w-full md:w-40"
                size="sm"
              >
                {sortOptions.map(opt => (
                  <SelectItem key={opt.key}>{opt.label}</SelectItem>
                ))}
              </Select>
              <Button
                isIconOnly
                variant="flat"
                onPress={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              >
                <Icon icon={sortOrder === 'desc' ? 'mdi:sort-descending' : 'mdi:sort-ascending'} />
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* 持仓列表 */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <h2 className="text-lg font-semibold">持仓列表</h2>
              <Chip size="sm" variant="flat">
                {filteredPositions.length} / {store.positions.length}
              </Chip>
            </div>
          </CardHeader>
          <CardBody className="p-0 md:p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredPositions.length === 0 ? (
              <div className="text-center py-12 text-foreground/50">
                <Icon icon="mdi:folder-open" className="text-5xl mb-3 mx-auto" />
                <p>暂无持仓数据</p>
                {searchQuery && (
                  <p className="text-sm mt-1">尝试调整搜索条件</p>
                )}
              </div>
            ) : (
              <>
                {/* 移动端卡片视图 */}
                <div className="md:hidden p-4 space-y-3">
                  {filteredPositions.map(position => (
                    <PositionCard key={position.id} position={position} />
                  ))}
                </div>
                {/* 桌面端表格视图 */}
                <div className="hidden md:block">
                  <Table
                    aria-label="持仓列表"
                    removeWrapper
                    classNames={{
                      th: 'bg-content2/50 text-foreground/70',
                    }}
                  >
                    <TableHeader>
                      <TableColumn>代码/名称</TableColumn>
                      <TableColumn>类型</TableColumn>
                      <TableColumn className="text-right">数量</TableColumn>
                      <TableColumn className="text-right">成本</TableColumn>
                      <TableColumn className="text-right">现价</TableColumn>
                      <TableColumn className="text-right">市值</TableColumn>
                      <TableColumn className="text-right">盈亏</TableColumn>
                      <TableColumn className="text-right">权重</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {filteredPositions.map(position => (
                        <PositionRow key={position.id} position={position} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        {/* 错误提示 */}
        {store.errors.positions && (
          <Card className="bg-danger/10 border border-danger/30">
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <Icon icon="mdi:alert-circle" className="text-2xl text-danger" />
                <div>
                  <p className="font-semibold text-danger">加载失败</p>
                  <p className="text-sm text-foreground/60">{store.errors.positions}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </GradientBackground>
  );
});

export default PortfolioPage;
