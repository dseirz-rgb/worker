/**
 * 季节性风险提醒卡片组件
 * 显示当前月份的季节性风险等级和历史同期表现
 */

import React, { useMemo } from 'react';
import { 
  Calendar, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Target,
  Info
} from 'lucide-react';
import { Card } from '@/components/ui';
import {
  analyzeSeasonalPerformance,
  getSeasonalRiskWarning,
  getSeasonalRiskColor,
  getSeasonalRiskBgColor,
  getSeasonalRiskLevelName,
  type MonthlyStats,
  type SeasonalRiskWarning,
  type SeasonalRiskLevel,
} from '@/services/seasonalRiskService';
import type { DashboardSnapshot } from '@/services/supabaseData';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

// ============ 类型定义 ============

interface SeasonalRiskCardProps {
  history: DashboardSnapshot[];
  className?: string;
}

interface MonthlyChartData {
  month: string;
  avgReturn: number;
  fill: string;
  isCurrentMonth: boolean;
  isWeakMonth: boolean;
}

// ============ 辅助函数 ============

const MONTH_SHORT_NAMES = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月'
];

function getRiskBadgeStyle(level: SeasonalRiskLevel): string {
  switch (level) {
    case 'low':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'high':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

function getBarColor(avgReturn: number, isWeakMonth: boolean, isCurrentMonth: boolean): string {
  if (isCurrentMonth) {
    return isWeakMonth ? '#ef4444' : '#06b6d4'; // red or cyan
  }
  if (isWeakMonth) {
    return '#f87171'; // lighter red
  }
  return avgReturn >= 0 ? '#10b981' : '#f59e0b'; // green or yellow
}

// ============ 子组件 ============

/**
 * 风险等级徽章
 */
function RiskBadge({ level }: { level: SeasonalRiskLevel }) {
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getRiskBadgeStyle(level)}`}>
      {getSeasonalRiskLevelName(level)}
    </span>
  );
}

/**
 * 统计指标项
 */
function StatItem({ 
  label, 
  value, 
  suffix = '', 
  colorize = false 
}: { 
  label: string; 
  value: number; 
  suffix?: string;
  colorize?: boolean;
}) {
  const displayValue = value.toFixed(2);
  const colorClass = colorize 
    ? (value >= 0 ? 'text-green-400' : 'text-red-400')
    : 'text-text-primary';

  return (
    <div className="text-center">
      <div className={`text-lg font-bold mono-nums ${colorClass}`}>
        {colorize && value > 0 ? '+' : ''}{displayValue}{suffix}
      </div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  );
}

/**
 * 月度收益柱状图
 */
function MonthlyReturnChart({ 
  data, 
  currentMonth 
}: { 
  data: MonthlyChartData[];
  currentMonth: number;
}) {
  return (
    <div className="h-40 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis 
            dataKey="month" 
            tick={{ fill: '#666', fontSize: 10 }} 
            axisLine={{ stroke: '#333' }}
          />
          <YAxis 
            tick={{ fill: '#666', fontSize: 10 }} 
            tickFormatter={(v) => `${v.toFixed(1)}%`}
            axisLine={{ stroke: '#333' }}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: '#1a1a2e', 
              border: '1px solid #333', 
              borderRadius: '8px',
              fontSize: '12px'
            }}
            formatter={(value: number) => [`${value.toFixed(3)}%`, '日均收益']}
            labelFormatter={(label) => `${label}`}
          />
          <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
          <Bar dataKey="avgReturn" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.fill}
                stroke={entry.isCurrentMonth ? '#fff' : 'transparent'}
                strokeWidth={entry.isCurrentMonth ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 建议列表
 */
function SuggestionsList({ suggestions }: { suggestions: string[] }) {
  if (suggestions.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2 mb-2">
        <Info size={14} className="text-accent-cyan" />
        <span className="text-xs text-text-secondary font-medium">操作建议</span>
      </div>
      <ul className="space-y-1">
        {suggestions.map((suggestion, index) => (
          <li key={index} className="text-xs text-text-muted flex items-start gap-2">
            <span className="text-accent-cyan mt-0.5">•</span>
            <span>{suggestion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============ 主组件 ============

export function SeasonalRiskCard({ history, className = '' }: SeasonalRiskCardProps) {
  const currentMonth = new Date().getMonth() + 1; // 1-12

  // 分析季节性表现
  const seasonalPerformance = useMemo(() => {
    return analyzeSeasonalPerformance(history);
  }, [history]);

  // 获取当前月份风险警告
  const warning = useMemo(() => {
    return getSeasonalRiskWarning(currentMonth, history);
  }, [currentMonth, history]);

  // 准备图表数据
  const chartData: MonthlyChartData[] = useMemo(() => {
    return seasonalPerformance.monthlyStats.map((stats) => ({
      month: MONTH_SHORT_NAMES[stats.month - 1],
      avgReturn: stats.avgReturn,
      fill: getBarColor(stats.avgReturn, stats.isWeakMonth, stats.month === currentMonth),
      isCurrentMonth: stats.month === currentMonth,
      isWeakMonth: stats.isWeakMonth,
    }));
  }, [seasonalPerformance, currentMonth]);

  // 当前月份统计
  const currentMonthStats = seasonalPerformance.monthlyStats.find(
    (s) => s.month === currentMonth
  );

  // 数据不足时的提示
  if (seasonalPerformance.totalTradingDays < 30) {
    return (
      <Card className={`relative ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={18} className="text-accent-purple" />
          <span className="text-sm font-medium text-text-primary">季节性风险分析</span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Activity size={32} className="text-text-muted mb-3" />
          <p className="text-sm text-text-secondary">历史数据不足</p>
          <p className="text-xs text-text-muted mt-1">
            需要至少30天的交易数据才能进行季节性分析
          </p>
          <p className="text-xs text-text-muted">
            当前数据: {seasonalPerformance.totalTradingDays} 天
          </p>
        </div>
      </Card>
    );
  }

  const hasWarning = warning.hasWarning;
  const glowColor = warning.riskLevel === 'high' ? 'red' : undefined;

  return (
    <Card glow={glowColor} className={`relative ${className}`}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-accent-purple" />
          <span className="text-sm font-medium text-text-primary">季节性风险分析</span>
        </div>
        <RiskBadge level={warning.riskLevel} />
      </div>

      {/* 当前月份状态 */}
      <div className={`p-3 rounded-lg ${getSeasonalRiskBgColor(warning.riskLevel)} mb-4`}>
        <div className="flex items-center gap-2 mb-2">
          {hasWarning ? (
            <AlertTriangle size={16} className={getSeasonalRiskColor(warning.riskLevel)} />
          ) : (
            <TrendingUp size={16} className="text-green-400" />
          )}
          <span className={`text-sm font-medium ${getSeasonalRiskColor(warning.riskLevel)}`}>
            {warning.currentMonthName}
          </span>
        </div>
        <p className="text-xs text-text-secondary">{warning.message}</p>
      </div>

      {/* 历史同期统计 */}
      {currentMonthStats && currentMonthStats.tradingDays > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatItem 
            label="日均收益" 
            value={warning.historicalAvgReturn} 
            suffix="%" 
            colorize 
          />
          <StatItem 
            label="最大回撤" 
            value={-warning.historicalMaxDrawdown} 
            suffix="%" 
            colorize 
          />
          <StatItem 
            label="胜率" 
            value={warning.historicalWinRate} 
            suffix="%" 
          />
        </div>
      )}

      {/* 月度收益图表 */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-muted">各月日均收益率</span>
          <div className="flex items-center gap-3 text-[10px] text-text-muted">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-red-400"></span>
              弱势月
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-green-400"></span>
              正收益
            </span>
          </div>
        </div>
        <MonthlyReturnChart data={chartData} currentMonth={currentMonth} />
      </div>

      {/* 弱势月份提示 */}
      {seasonalPerformance.weakMonths.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} className="text-red-400" />
            <span className="text-xs text-text-secondary font-medium">历史弱势月份</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {seasonalPerformance.weakMonths.map((month) => {
              const stats = seasonalPerformance.monthlyStats.find((s) => s.month === month);
              const isCurrentMonth = month === currentMonth;
              return (
                <span
                  key={month}
                  className={`px-2 py-1 text-xs rounded ${
                    isCurrentMonth
                      ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {MONTH_SHORT_NAMES[month - 1]}
                  {stats && (
                    <span className="ml-1 opacity-70">
                      ({stats.avgReturn >= 0 ? '+' : ''}{stats.avgReturn.toFixed(2)}%)
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 操作建议 */}
      <SuggestionsList suggestions={warning.suggestions} />

      {/* 数据范围说明 */}
      <div className="mt-4 pt-3 border-t border-border">
        <p className="text-[10px] text-text-muted text-center">
          分析数据范围: {seasonalPerformance.analysisStartDate} ~ {seasonalPerformance.analysisEndDate}
          {' '}({seasonalPerformance.totalTradingDays} 个交易日)
        </p>
      </div>
    </Card>
  );
}

export default SeasonalRiskCard;
