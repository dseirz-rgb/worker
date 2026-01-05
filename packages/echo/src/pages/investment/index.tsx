/**
 * 投资模块 - Dashboard 首页
 * 投资管理系统的主入口，展示资产概览、风险指标、最近警报
 * 
 * **Validates: Requirements 4.1, 4.2**
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardBody, CardHeader, Chip, Progress, Skeleton, Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';
import { RootStore } from '@/store';
import { InvestmentStore } from '@/store/investmentStore';

// 风险等级颜色映射
const riskLevelColors = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
} as const;

// 风险等级文本映射
const riskLevelText = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  critical: '极高风险',
} as const;

// 快捷入口配置
const quickLinks = [
  { title: '持仓管理', href: '/investment/portfolio', icon: 'mdi:wallet', color: 'primary' },
  { title: '风险中心', href: '/investment/risk', icon: 'mdi:shield-alert', color: 'warning' },
  { title: '市场分析', href: '/investment/market', icon: 'mdi:chart-line', color: 'success' },
  { title: '决策中心', href: '/investment/decision', icon: 'mdi:brain', color: 'secondary' },
];

// 统计卡片组件
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'secondary';
  loading?: boolean;
  trend?: 'up' | 'down' | 'stable';
}

const StatCard = ({ title, value, subtitle, icon, color = 'primary', loading, trend }: StatCardProps) => {
  const trendIcon = trend === 'up' ? 'mdi:trending-up' : trend === 'down' ? 'mdi:trending-down' : null;
  const trendColor = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : '';

  return (
    <Card className="bg-content1/50 backdrop-blur-sm">
      <CardBody className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-foreground/60">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-24 mt-1" />
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-bold">{value}</p>
                {trendIcon && (
                  <Icon icon={trendIcon} className={`text-lg ${trendColor}`} />
                )}
              </div>
            )}
            {subtitle && (
              <p className="text-xs text-foreground/50 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-2 rounded-lg bg-${color}/10`}>
            <Icon icon={icon} className={`text-2xl text-${color}`} />
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

// 警报列表组件
const AlertsList = ({ alerts, loading }: { alerts: any[]; loading: boolean }) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-foreground/50">
        <Icon icon="mdi:bell-off" className="text-4xl mb-2 mx-auto" />
        <p>暂无活跃警报</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.slice(0, 5).map(alert => (
        <div
          key={alert.id}
          className="flex items-center gap-3 p-3 rounded-lg bg-content2/50 hover:bg-content2 transition-colors"
        >
          <Icon
            icon={alert.type.includes('price') ? 'mdi:currency-usd' : 'mdi:alert'}
            className={`text-xl ${alert.priority === 'high' ? 'text-danger' : 'text-warning'}`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{alert.ticker}</p>
            <p className="text-xs text-foreground/50">{alert.type}</p>
          </div>
          <Chip size="sm" color={alert.enabled ? 'success' : 'default'}>
            {alert.enabled ? '启用' : '禁用'}
          </Chip>
        </div>
      ))}
    </div>
  );
};

// 熔断器状态组件
const CircuitBreakerStatus = ({ states, loading }: { states: any[]; loading: boolean }) => {
  if (loading) {
    return <Skeleton className="h-20 w-full rounded-lg" />;
  }

  const hasTriggered = states.some(s => s.status === 'open');

  return (
    <div className={`p-4 rounded-lg ${hasTriggered ? 'bg-danger/10 border border-danger/30' : 'bg-success/10 border border-success/30'}`}>
      <div className="flex items-center gap-3">
        <Icon
          icon={hasTriggered ? 'mdi:alert-circle' : 'mdi:check-circle'}
          className={`text-3xl ${hasTriggered ? 'text-danger' : 'text-success'}`}
        />
        <div>
          <p className={`font-semibold ${hasTriggered ? 'text-danger' : 'text-success'}`}>
            {hasTriggered ? '熔断器已触发' : '所有熔断器正常'}
          </p>
          <p className="text-sm text-foreground/60">
            {hasTriggered
              ? `${states.filter(s => s.status === 'open').length} 个熔断器处于触发状态`
              : '当前没有触发任何风控熔断'}
          </p>
        </div>
      </div>
    </div>
  );
};

// 主页面组件
const InvestmentDashboard = () => {
  const store = RootStore.Get(InvestmentStore);

  // 初始化加载数据
  useEffect(() => {
    store.refreshAll();
  }, [store]);

  const isLoading = store.loading.positions || store.loading.riskMetrics || store.loading.alerts;

  return (
    <GradientBackground className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Icon icon="mdi:view-dashboard" className="text-primary" />
              投资管理
            </h1>
            <p className="text-foreground/60 mt-1">
              智能投资管理与风险控制系统
            </p>
          </div>
          <Button
            color="primary"
            variant="flat"
            startContent={<Icon icon="mdi:refresh" />}
            isLoading={isLoading}
            onPress={() => store.refreshAll()}
          >
            刷新
          </Button>
        </div>

        {/* 快捷入口 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickLinks.map(link => (
            <Link key={link.href} to={link.href}>
              <Card
                isPressable
                className="bg-content1/50 backdrop-blur-sm hover:bg-content1 transition-all"
              >
                <CardBody className="p-4 flex flex-row items-center gap-3">
                  <div className={`p-2 rounded-lg bg-${link.color}/10`}>
                    <Icon icon={link.icon} className={`text-2xl text-${link.color}`} />
                  </div>
                  <span className="font-medium">{link.title}</span>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="账户净值"
            value={store.accountNetWorth > 0 ? `¥${(store.accountNetWorth / 10000).toFixed(2)}万` : '--'}
            subtitle={store.dashboardSnapshot?.netWorthUSD ? `$${(store.dashboardSnapshot.netWorthUSD / 10000).toFixed(2)}万` : undefined}
            icon="mdi:cash-multiple"
            color="primary"
            loading={store.loading.riskMetrics}
          />
          <StatCard
            title="持仓市值"
            value={store.totalMarketValue > 0 ? `¥${(store.totalMarketValue / 10000).toFixed(2)}万` : '--'}
            icon="mdi:wallet"
            color="secondary"
            loading={store.loading.positions}
          />
          <StatCard
            title="未实现盈亏"
            value={store.totalUnrealizedPnL !== 0 ? `${store.totalUnrealizedPnL > 0 ? '+' : ''}¥${store.totalUnrealizedPnL.toFixed(0)}` : '--'}
            subtitle={store.totalUnrealizedPnLPercent !== 0 ? `${store.totalUnrealizedPnLPercent > 0 ? '+' : ''}${store.totalUnrealizedPnLPercent.toFixed(2)}%` : undefined}
            icon="mdi:chart-areaspline"
            color={store.totalUnrealizedPnL >= 0 ? 'success' : 'danger'}
            loading={store.loading.positions}
            trend={store.totalUnrealizedPnL > 0 ? 'up' : store.totalUnrealizedPnL < 0 ? 'down' : 'stable'}
          />
          <StatCard
            title="活跃警报"
            value={store.activeAlertCount}
            subtitle="个警报规则"
            icon="mdi:bell-ring"
            color={store.hasHighPriorityAlert ? 'danger' : 'warning'}
            loading={store.loading.alerts}
          />
        </div>

        {/* 主内容区 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 风险概览 */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-content1/50 backdrop-blur-sm">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-2">
                  <Icon icon="mdi:shield-check" className="text-xl text-primary" />
                  <h2 className="text-lg font-semibold">风险概览</h2>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                {/* 风险等级 */}
                <div className="flex items-center justify-between">
                  <span className="text-foreground/60">当前风险等级</span>
                  <Chip color={riskLevelColors[store.riskLevel]} variant="flat">
                    {riskLevelText[store.riskLevel]}
                  </Chip>
                </div>

                {/* 熔断器状态 */}
                <CircuitBreakerStatus
                  states={store.circuitBreakerStates}
                  loading={store.loading.riskMetrics}
                />

                {/* 风险指标 */}
                {store.riskMetrics && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>杠杆率</span>
                        <span>{store.riskMetrics.leverage.toFixed(2)}x</span>
                      </div>
                      <Progress
                        value={Math.min(store.riskMetrics.leverage * 50, 100)}
                        color={store.riskMetrics.leverage > 1.5 ? 'danger' : store.riskMetrics.leverage > 1 ? 'warning' : 'success'}
                        size="sm"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>月度回撤</span>
                        <span>{store.riskMetrics.monthlyDrawdown.toFixed(2)}%</span>
                      </div>
                      <Progress
                        value={Math.min(Math.abs(store.riskMetrics.monthlyDrawdown) * 10, 100)}
                        color={store.riskMetrics.monthlyDrawdown > 10 ? 'danger' : store.riskMetrics.monthlyDrawdown > 5 ? 'warning' : 'success'}
                        size="sm"
                      />
                    </div>
                  </div>
                )}

                {/* 查看详情按钮 */}
                <Link to="/investment/risk">
                  <Button color="primary" variant="flat" fullWidth>
                    查看风控详情
                  </Button>
                </Link>
              </CardBody>
            </Card>
          </div>

          {/* 警报列表 */}
          <div>
            <Card className="bg-content1/50 backdrop-blur-sm">
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Icon icon="mdi:bell" className="text-xl text-warning" />
                    <h2 className="text-lg font-semibold">价格警报</h2>
                  </div>
                  {store.activeAlertCount > 0 && (
                    <Chip size="sm" color="warning">{store.activeAlertCount}</Chip>
                  )}
                </div>
              </CardHeader>
              <CardBody>
                <AlertsList alerts={store.alerts} loading={store.loading.alerts} />
              </CardBody>
            </Card>
          </div>
        </div>

        {/* 错误提示 */}
        {(store.errors.positions || store.errors.riskMetrics || store.errors.alerts) && (
          <Card className="bg-danger/10 border border-danger/30">
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <Icon icon="mdi:alert-circle" className="text-2xl text-danger" />
                <div>
                  <p className="font-semibold text-danger">数据加载错误</p>
                  <p className="text-sm text-foreground/60">
                    {store.errors.positions || store.errors.riskMetrics || store.errors.alerts}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </GradientBackground>
  );
};

export default InvestmentDashboard;
