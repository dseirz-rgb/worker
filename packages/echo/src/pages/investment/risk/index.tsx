/**
 * 投资模块 - 风险中心页面
 * 集中展示所有风控指标、熔断状态和风控日志
 * 
 * **Validates: Requirements 4.1**
 */

import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Progress,
  Button,
  Skeleton,
  Divider,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';
import { RootStore } from '@/store';
import { InvestmentStore } from '@/store/investmentStore';

// 风险状态颜色映射
const statusColors = {
  safe: { bg: 'bg-success/10', border: 'border-success/30', text: 'text-success', icon: 'mdi:check-circle' },
  caution: { bg: 'bg-warning/10', border: 'border-warning/30', text: 'text-warning', icon: 'mdi:alert' },
  warning: { bg: 'bg-warning/10', border: 'border-warning/30', text: 'text-warning', icon: 'mdi:alert' },
  danger: { bg: 'bg-danger/10', border: 'border-danger/30', text: 'text-danger', icon: 'mdi:alert-circle' },
  critical: { bg: 'bg-danger/10', border: 'border-danger/30', text: 'text-danger', icon: 'mdi:alert-octagon' },
  normal: { bg: 'bg-success/10', border: 'border-success/30', text: 'text-success', icon: 'mdi:check-circle' },
};

// 风险指标卡片组件
interface RiskMetricCardProps {
  title: string;
  value: string | number;
  status: keyof typeof statusColors;
  subtitle?: string;
  icon: string;
  description?: string;
}

const RiskMetricCard = observer(({ title, value, status, subtitle, icon, description }: RiskMetricCardProps) => {
  const colors = statusColors[status] || statusColors.normal;

  return (
    <Card className={`${colors.bg} border ${colors.border}`}>
      <CardBody className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${colors.bg}`}>
              <Icon icon={icon} className={`text-xl ${colors.text}`} />
            </div>
            <span className="text-sm text-foreground/70">{title}</span>
          </div>
          <Chip
            size="sm"
            color={status === 'safe' || status === 'normal' ? 'success' : status === 'warning' || status === 'caution' ? 'warning' : 'danger'}
            variant="flat"
          >
            {status === 'safe' || status === 'normal' ? '正常' : status === 'warning' || status === 'caution' ? '警告' : '危险'}
          </Chip>
        </div>
        <div className={`text-3xl font-bold mt-3 ${colors.text}`}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-foreground/50 mt-1">{subtitle}</p>
        )}
        {description && (
          <p className="text-xs text-foreground/60 mt-2">{description}</p>
        )}
      </CardBody>
    </Card>
  );
});

// 熔断器状态组件
const CircuitBreakerPanel = observer(({ states, loading }: { states: any[]; loading: boolean }) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const activeBreakers = states.filter(s => s.status === 'open');

  if (activeBreakers.length === 0) {
    return (
      <Card className="bg-success/10 border border-success/30">
        <CardBody className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/20">
              <Icon icon="mdi:check-circle" className="text-2xl text-success" />
            </div>
            <div>
              <p className="font-semibold text-success">所有熔断器正常</p>
              <p className="text-sm text-foreground/60">
                当前没有触发任何风控熔断，交易正常进行
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {activeBreakers.map((breaker, index) => (
        <Card key={index} className="bg-danger/10 border border-danger/30">
          <CardBody className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-danger/20">
                  <Icon icon="mdi:alert-circle" className="text-xl text-danger" />
                </div>
                <div>
                  <p className="font-semibold text-danger">{breaker.type} 熔断器</p>
                  <p className="text-sm text-foreground/60">{breaker.reason || '已触发'}</p>
                </div>
              </div>
              <Chip size="sm" color="danger" variant="flat">
                已触发
              </Chip>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
});

// 风控规则说明组件
const RiskRulesExplanation = observer(() => (
  <Card className="bg-primary/5 border border-primary/20">
    <CardHeader>
      <div className="flex items-center gap-2">
        <Icon icon="mdi:information" className="text-xl text-primary" />
        <h3 className="font-semibold">风控规则说明</h3>
      </div>
    </CardHeader>
    <CardBody className="pt-0">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="p-3 rounded-lg bg-content2/50">
          <h4 className="font-medium text-primary mb-2">📊 杠杆率</h4>
          <p className="text-foreground/60">
            杠杆率 = 总资产 / 净资产。超过 1.5x 警告，超过 2.0x 危险。
          </p>
        </div>
        <div className="p-3 rounded-lg bg-content2/50">
          <h4 className="font-medium text-warning mb-2">📉 月度回撤</h4>
          <p className="text-foreground/60">
            月度回撤 = (月初净值 - 当前净值) / 月初净值。超过 10% 警告，超过 15% 危险。
          </p>
        </div>
        <div className="p-3 rounded-lg bg-content2/50">
          <h4 className="font-medium text-secondary mb-2">🏔️ 高水位回撤</h4>
          <p className="text-foreground/60">
            从历史最高净值回撤超过 5% 时触发移动止盈警告。
          </p>
        </div>
        <div className="p-3 rounded-lg bg-content2/50">
          <h4 className="font-medium text-danger mb-2">🔥 连败天数</h4>
          <p className="text-foreground/60">
            连续亏损天数。超过 3 天警告，超过 5 天危险。
          </p>
        </div>
      </div>
    </CardBody>
  </Card>
));

// 快捷入口
const quickLinks = [
  { title: '智能风控', href: '/investment/risk/intelligent', icon: 'mdi:brain', description: 'AI 驱动的风险分析' },
  { title: '风险引擎', href: '/investment/risk/engine', icon: 'mdi:cog', description: '风险计算与规则配置' },
  { title: '风险设置', href: '/investment/risk/settings', icon: 'mdi:tune', description: '阈值配置与通知设置' },
];

// 主页面组件
const RiskCenterPage = observer(() => {
  const store = RootStore.Get(InvestmentStore);

  // 初始化加载数据
  useEffect(() => {
    store.fetchRiskMetrics();
  }, [store]);

  const isLoading = store.loading.riskMetrics;
  const metrics = store.riskMetrics;

  // 计算风险状态
  const getLeverageStatus = (leverage: number): keyof typeof statusColors => {
    if (leverage > 2) return 'danger';
    if (leverage > 1.5) return 'warning';
    return 'safe';
  };

  const getDrawdownStatus = (drawdown: number): keyof typeof statusColors => {
    if (drawdown > 15) return 'danger';
    if (drawdown > 10) return 'warning';
    return 'safe';
  };

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
                <Icon icon="mdi:shield-check" className="text-success" />
                风险中心
              </h1>
              <p className="text-foreground/60 mt-1">
                实时监控风险指标与熔断状态
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              color="primary"
              variant="flat"
              startContent={<Icon icon="mdi:refresh" />}
              isLoading={isLoading}
              onPress={() => store.fetchRiskMetrics()}
            >
              刷新
            </Button>
            <Link to="/investment/risk/settings">
              <Button variant="flat" startContent={<Icon icon="mdi:cog" />}>
                设置
              </Button>
            </Link>
          </div>
        </div>

        {/* 综合风险评分 */}
        <Card className={`${statusColors[store.riskLevel].bg} border-2 ${statusColors[store.riskLevel].border}`}>
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-foreground/60">综合风险等级</p>
                <div className={`text-4xl font-bold mt-2 ${statusColors[store.riskLevel].text}`}>
                  {store.riskLevel === 'low' ? '低风险' :
                   store.riskLevel === 'medium' ? '中风险' :
                   store.riskLevel === 'high' ? '高风险' : '极高风险'}
                </div>
              </div>
              <div className="text-right">
                <Icon
                  icon={statusColors[store.riskLevel].icon}
                  className={`text-6xl ${statusColors[store.riskLevel].text}`}
                />
                <p className="text-sm text-foreground/60 mt-2">
                  {store.tradingDecision?.allowed ? '允许交易' : '建议停止交易'}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 风险指标卡片 */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <RiskMetricCard
              title="杠杆率"
              value={`${metrics.leverage.toFixed(2)}x`}
              status={getLeverageStatus(metrics.leverage)}
              subtitle="限制: 2.0x"
              icon="mdi:scale-balance"
              description="总资产 / 净资产"
            />
            <RiskMetricCard
              title="月度回撤"
              value={`${metrics.monthlyDrawdown.toFixed(2)}%`}
              status={getDrawdownStatus(metrics.monthlyDrawdown)}
              subtitle="限制: 15%"
              icon="mdi:trending-down"
              description="本月最大回撤"
            />
            <RiskMetricCard
              title="日内回撤"
              value={`${metrics.dailyDrawdown.toFixed(2)}%`}
              status={getDrawdownStatus(metrics.dailyDrawdown * 3)}
              subtitle="限制: 5%"
              icon="mdi:chart-line-variant"
              description="今日最大回撤"
            />
            <RiskMetricCard
              title="连败天数"
              value={`${metrics.consecutiveLosses} 天`}
              status={metrics.consecutiveLosses > 5 ? 'danger' : metrics.consecutiveLosses > 3 ? 'warning' : 'safe'}
              subtitle="限制: 5 天"
              icon="mdi:calendar-alert"
              description="连续亏损天数"
            />
          </div>
        ) : (
          <Card className="bg-warning/10 border border-warning/30">
            <CardBody className="p-4 text-center">
              <Icon icon="mdi:database-off" className="text-4xl text-warning mb-2 mx-auto" />
              <p className="text-warning">暂无风险指标数据</p>
            </CardBody>
          </Card>
        )}

        {/* 熔断器状态 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon icon="mdi:shield-alert" className="text-warning" />
              熔断器状态
            </h2>
            <CircuitBreakerPanel states={store.circuitBreakerStates} loading={isLoading} />
          </div>

          {/* 快捷入口 */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon icon="mdi:apps" className="text-primary" />
              风控工具
            </h2>
            <div className="space-y-3">
              {quickLinks.map(link => (
                <Link key={link.href} to={link.href}>
                  <Card isPressable className="bg-content1/50 hover:bg-content1 transition-all">
                    <CardBody className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon icon={link.icon} className="text-2xl text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{link.title}</p>
                          <p className="text-sm text-foreground/60">{link.description}</p>
                        </div>
                        <Icon icon="mdi:chevron-right" className="text-xl text-foreground/30 ml-auto" />
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* 风控规则说明 */}
        <RiskRulesExplanation />

        {/* 错误提示 */}
        {store.errors.riskMetrics && (
          <Card className="bg-danger/10 border border-danger/30">
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <Icon icon="mdi:alert-circle" className="text-2xl text-danger" />
                <div>
                  <p className="font-semibold text-danger">加载失败</p>
                  <p className="text-sm text-foreground/60">{store.errors.riskMetrics}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </GradientBackground>
  );
});

export default RiskCenterPage;
