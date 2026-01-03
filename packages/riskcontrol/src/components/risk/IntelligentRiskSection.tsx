/**
 * IntelligentRiskSection - 智能风控集成区块
 * Feature: intelligent-risk-engine
 * 
 * 将智能风控组件集成到现有页面的便捷组件。
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { RiskDashboard } from './RiskDashboard';
import { RiskAlertPanel } from './RiskAlertPanel';
import { RiskForecastChart } from './RiskForecastChart';
import { RiskHistoryChart } from './RiskHistoryChart';

// ============ 类型定义 ============

export interface IntelligentRiskSectionProps {
  tickers?: string[];
  market?: string;
  compact?: boolean;
  showForecast?: boolean;
  showHistory?: boolean;
  showAlerts?: boolean;
  className?: string;
}

type ViewMode = 'dashboard' | 'forecast' | 'history';

// ============ 主组件 ============

export function IntelligentRiskSection({
  tickers = ['SPY'],
  market = 'us',
  compact = false,
  showForecast = true,
  showHistory = true,
  showAlerts = true,
  className,
}: IntelligentRiskSectionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

  if (compact) {
    // 紧凑模式：只显示仪表盘和预警
    return (
      <div className={cn('space-y-4', className)}>
        <RiskDashboard 
          tickers={tickers} 
          market={market} 
          compact 
          showDetails={false}
        />
        {showAlerts && (
          <RiskAlertPanel maxAlerts={3} />
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* 标题和视图切换 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="text-xl">🤖</span>
          智能风控
        </h2>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setViewMode('dashboard')}
            className={cn(
              'px-3 py-1 text-sm rounded transition-colors',
              viewMode === 'dashboard'
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            仪表盘
          </button>
          {showForecast && (
            <button
              onClick={() => setViewMode('forecast')}
              className={cn(
                'px-3 py-1 text-sm rounded transition-colors',
                viewMode === 'forecast'
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              预测
            </button>
          )}
          {showHistory && (
            <button
              onClick={() => setViewMode('history')}
              className={cn(
                'px-3 py-1 text-sm rounded transition-colors',
                viewMode === 'history'
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              历史
            </button>
          )}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左侧：主视图 */}
        <div className="lg:col-span-2">
          {viewMode === 'dashboard' && (
            <RiskDashboard 
              tickers={tickers} 
              market={market}
              showDetails
            />
          )}
          {viewMode === 'forecast' && (
            <RiskForecastChart 
              tickers={tickers} 
              market={market}
            />
          )}
          {viewMode === 'history' && (
            <RiskHistoryChart days={7} />
          )}
        </div>

        {/* 右侧：预警面板 */}
        {showAlerts && (
          <div className="lg:col-span-1">
            <RiskAlertPanel maxAlerts={5} />
          </div>
        )}
      </div>
    </div>
  );
}

export default IntelligentRiskSection;
