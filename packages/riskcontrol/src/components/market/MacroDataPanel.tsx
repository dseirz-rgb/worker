/**
 * MacroDataPanel - 宏观经济数据面板
 * 
 * 使用 TradingView Widget 展示宏观经济指标
 * 包括国债收益率、美元指数、外汇汇率等
 */

import React, { useState } from 'react';
import { Gauge, TrendingUp, DollarSign, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
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

const MACRO_TABS = [
  { id: 'overview' as const, label: '市场概览', icon: TrendingUp },
  { id: 'bonds' as const, label: '国债收益率', icon: DollarSign },
  { id: 'forex' as const, label: '外汇汇率', icon: Globe },
];

/**
 * 宏观经济数据面板
 * 
 * @example
 * ```tsx
 * <MacroDataPanel defaultTab="overview" height={500} />
 * ```
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
      <div className="flex gap-2 overflow-x-auto pb-2">
        {MACRO_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-transparent'
            )}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

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
        icon={<Gauge size={18} className="text-cyan-400" />}
      />
    </div>
  );
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
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
      <div className="text-sm font-medium text-white mb-1">{label}</div>
      <div className="text-xs text-white/40 mb-2">{description}</div>
      <div className="text-xs text-blue-400">{trend}</div>
    </div>
  );
}

export default MacroDataPanel;
