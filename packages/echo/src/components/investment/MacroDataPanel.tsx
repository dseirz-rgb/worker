/**
 * MacroDataPanel - 宏观经济数据面板
 * 
 * 使用 TradingView Widget 展示宏观经济指标
 * 从 RiskControl 迁移，使用 HeroUI 组件
 * 
 * **Validates: Requirements 4.1**
 */

import React, { useState } from 'react';
import { Card, CardBody, Tabs, Tab } from '@heroui/react';
import { Icon } from '@iconify/react';
import { TradingViewWidget } from './TradingViewWidget';
import {
  TRADINGVIEW_SCRIPTS,
  MARKET_OVERVIEW_CONFIG,
  MACRO_MARKET_QUOTES_CONFIG,
  FOREX_CROSS_RATES_CONFIG,
} from '@/lib/tradingViewConfigs';

type MacroTab = 'overview' | 'bonds' | 'forex';

interface MacroDataPanelProps {
  /** 默认显示的 Tab */
  defaultTab?: MacroTab;
  /** 组件高度 */
  height?: number;
}

// 宏观指标卡片组件
function MacroIndicatorCard({
  label,
  description,
  trend,
}: {
  label: string;
  description: string;
  trend: string;
}) {
  return (
    <Card className="bg-content1/50 backdrop-blur-sm">
      <CardBody className="p-3">
        <div className="text-sm font-medium mb-1">{label}</div>
        <div className="text-xs text-foreground/40 mb-2">{description}</div>
        <div className="text-xs text-primary">{trend}</div>
      </CardBody>
    </Card>
  );
}

/**
 * 宏观经济数据面板
 */
export function MacroDataPanel({
  defaultTab = 'overview',
  height = 500,
}: MacroDataPanelProps) {
  const [activeTab, setActiveTab] = useState<MacroTab>(defaultTab);

  // 根据 Tab 获取对应的 Widget 配置
  const getWidgetConfig = () => {
    switch (activeTab) {
      case 'overview':
        return {
          scriptUrl: TRADINGVIEW_SCRIPTS.marketOverview,
          config: { ...MARKET_OVERVIEW_CONFIG, height },
        };
      case 'bonds':
        return {
          scriptUrl: TRADINGVIEW_SCRIPTS.marketQuotes,
          config: { ...MACRO_MARKET_QUOTES_CONFIG, height },
        };
      case 'forex':
        return {
          scriptUrl: TRADINGVIEW_SCRIPTS.forexCrossRates,
          config: { ...FOREX_CROSS_RATES_CONFIG, height },
        };
      default:
        return {
          scriptUrl: TRADINGVIEW_SCRIPTS.marketOverview,
          config: { ...MARKET_OVERVIEW_CONFIG, height },
        };
    }
  };

  const { scriptUrl, config } = getWidgetConfig();

  return (
    <div className="space-y-4">
      {/* Tab 切换 */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as MacroTab)}
        variant="underlined"
        classNames={{
          tabList: 'gap-4',
          cursor: 'bg-primary',
          tab: 'px-0 h-10',
        }}
      >
        <Tab
          key="overview"
          title={
            <div className="flex items-center gap-2">
              <Icon icon="mdi:trending-up" />
              <span>市场概览</span>
            </div>
          }
        />
        <Tab
          key="bonds"
          title={
            <div className="flex items-center gap-2">
              <Icon icon="mdi:currency-usd" />
              <span>国债收益率</span>
            </div>
          }
        />
        <Tab
          key="forex"
          title={
            <div className="flex items-center gap-2">
              <Icon icon="mdi:earth" />
              <span>外汇汇率</span>
            </div>
          }
        />
      </Tabs>

      {/* 宏观指标说明卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MacroIndicatorCard
          label="美国10年期国债"
          description="全球无风险利率基准"
          trend="关注"
        />
        <MacroIndicatorCard
          label="美元指数 (DXY)"
          description="美元相对一篮子货币强弱"
          trend="关注"
        />
        <MacroIndicatorCard
          label="VIX 恐慌指数"
          description="市场波动率预期"
          trend="关注"
        />
        <MacroIndicatorCard
          label="黄金价格"
          description="避险资产风向标"
          trend="关注"
        />
      </div>

      {/* TradingView Widget */}
      <TradingViewWidget
        scriptUrl={scriptUrl}
        config={config}
        height={height}
        icon={<Icon icon="mdi:gauge" className="text-xl text-primary" />}
      />
    </div>
  );
}

export default MacroDataPanel;
