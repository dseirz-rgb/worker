/**
 * 投资模块 - 风险引擎页面
 * 
 * 整合 4 个 Tab：仪表盘、预测、历史、配置
 * 从 RiskControl 移植组件并转换为 HeroUI。
 */

import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { Button, Tabs, Tab } from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';
import { 
  RiskDashboard, 
  RiskForecastChart, 
  RiskHistoryChart, 
  RiskConfigPanel,
  RiskAlertPanel 
} from '@/components/InvestmentRisk';

type TabKey = 'dashboard' | 'forecast' | 'history' | 'config';

const RiskEnginePage = observer(() => {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

  return (
    <GradientBackground className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/investment/risk">
              <Button isIconOnly variant="light" size="sm">
                <Icon icon="mdi:arrow-left" className="text-xl" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Icon icon="mdi:cog" className="text-primary" />
                风险引擎
              </h1>
              <p className="text-foreground/60 mt-1">风险计算、预测与配置</p>
            </div>
          </div>
        </div>

        {/* Tab 导航 */}
        <Tabs 
          selectedKey={activeTab} 
          onSelectionChange={(key) => setActiveTab(key as TabKey)}
          color="primary"
          variant="underlined"
          classNames={{
            tabList: "gap-6",
            cursor: "w-full bg-primary",
            tab: "max-w-fit px-0 h-12",
          }}
        >
          <Tab 
            key="dashboard" 
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:gauge" />
                <span>仪表盘</span>
              </div>
            }
          />
          <Tab 
            key="forecast" 
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:chart-timeline-variant" />
                <span>风险预测</span>
              </div>
            }
          />
          <Tab 
            key="history" 
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:chart-line" />
                <span>历史趋势</span>
              </div>
            }
          />
          <Tab 
            key="config" 
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:cog" />
                <span>配置</span>
              </div>
            }
          />
        </Tabs>


        {/* Tab 内容 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 主内容区 */}
          <div className="lg:col-span-2">
            {activeTab === 'dashboard' && (
              <RiskDashboard 
                tickers={['SPY', 'QQQ']} 
                market="us"
                showDetails
              />
            )}
            {activeTab === 'forecast' && (
              <RiskForecastChart 
                tickers={['SPY', 'QQQ']} 
                market="us"
                showProbabilities
                showRegimeTransition
              />
            )}
            {activeTab === 'history' && (
              <RiskHistoryChart 
                days={14}
                showLeverage
                showStopLoss
                showRiskLevel
              />
            )}
            {activeTab === 'config' && (
              <RiskConfigPanel 
                userId={1}
                onSave={(config) => {
                  console.log('Config saved:', config);
                }}
              />
            )}
          </div>

          {/* 右侧预警面板 - 仅在非配置页显示 */}
          {activeTab !== 'config' && (
            <div className="lg:col-span-1">
              <RiskAlertPanel 
                maxAlerts={5}
                showEmotionalAlerts
              />
            </div>
          )}
        </div>
      </div>
    </GradientBackground>
  );
});

export default RiskEnginePage;
