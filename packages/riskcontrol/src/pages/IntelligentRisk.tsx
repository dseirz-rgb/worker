/**
 * IntelligentRisk - 智能风控独立页面
 * 
 * 提供完整的智能风控功能：
 * - AI 风险预测和决策
 * - 动态杠杆和止损管理
 * - 风险预警和历史分析
 * - 用户风控配置
 */

import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { 
  Brain, 
  TrendingUp, 
  History, 
  Settings, 
  AlertTriangle,
  ArrowLeft,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RiskDashboard } from '@/components/risk/RiskDashboard';
import { RiskAlertPanel } from '@/components/risk/RiskAlertPanel';
import { RiskForecastChart } from '@/components/risk/RiskForecastChart';
import { RiskHistoryChart } from '@/components/risk/RiskHistoryChart';
import { RiskConfigPanel } from '@/components/risk/RiskConfigPanel';
import { useSupabasePortfolio } from '@/hooks/useSupabasePortfolio';

type TabId = 'dashboard' | 'forecast' | 'history' | 'config';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
}

const TABS: Tab[] = [
  { id: 'dashboard', label: '风控仪表盘', icon: Brain, description: '实时风险状态和决策' },
  { id: 'forecast', label: '风险预测', icon: TrendingUp, description: 'AI 驱动的风险预测' },
  { id: 'history', label: '历史分析', icon: History, description: '风险趋势和决策记录' },
  { id: 'config', label: '风控配置', icon: Settings, description: '个性化风控参数' },
];

export default function IntelligentRisk() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const { stockPositions } = useSupabasePortfolio();
  
  // 获取持仓 tickers
  const tickers = stockPositions?.map((p: { ticker: string }) => p.ticker).slice(0, 10) || ['SPY', 'QQQ'];

  return (
    <div className="min-h-screen bg-[#0a0b0f]">
      {/* 页面头部 */}
      <div className="border-b border-white/[0.06] bg-gradient-to-r from-purple-500/5 via-transparent to-cyan-500/5">
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
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                    <Brain size={20} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                      智能风控引擎
                      <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded-full flex items-center gap-1">
                        <Zap size={10} />
                        AI 驱动
                      </span>
                    </h1>
                    <p className="text-sm text-white/50">基于 Qlib 量化分析的智能风险管理</p>
                  </div>
                </div>
              </div>
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
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RiskDashboard 
                tickers={tickers} 
                market="us"
                showDetails
              />
            </div>
            <div className="lg:col-span-1">
              <RiskAlertPanel maxAlerts={10} />
            </div>
          </div>
        )}

        {activeTab === 'forecast' && (
          <div className="space-y-6">
            <RiskForecastChart 
              tickers={tickers} 
              market="us"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-400" />
                  风险预警说明
                </h3>
                <div className="space-y-3 text-sm text-white/60">
                  <p>• <span className="text-red-400">高风险</span>：回撤概率 &gt;30% 或波动率处于 90 分位以上</p>
                  <p>• <span className="text-amber-400">中等风险</span>：回撤概率 10-30% 或波动率处于 70-90 分位</p>
                  <p>• <span className="text-green-400">低风险</span>：回撤概率 &lt;10% 且波动率处于 70 分位以下</p>
                </div>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Brain size={18} className="text-purple-400" />
                  AI 模型说明
                </h3>
                <div className="space-y-3 text-sm text-white/60">
                  <p>• 波动率预测：基于 GARCH 模型和历史数据</p>
                  <p>• 回撤概率：基于蒙特卡洛模拟</p>
                  <p>• 市场状态：基于隐马尔可夫模型 (HMM)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <RiskHistoryChart days={30} />
          </div>
        )}

        {activeTab === 'config' && (
          <RiskConfigPanel />
        )}
      </div>
    </div>
  );
}
