/**
 * 风控报告卡片组件 - Risk Report Card
 * 显示周报/月报摘要，高亮显示改进或恶化的指标
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  AlertTriangle,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui';
import type { RiskReport } from '@/services/riskReportService';
import {
  getRiskScoreLevel,
  getRiskScoreLevelName,
  getChangeTrend,
  formatChange,
} from '@/services/riskReportService';

// ============ 类型定义 ============

interface RiskReportCardProps {
  weeklyReport?: RiskReport | null;
  monthlyReport?: RiskReport | null;
  className?: string;
}

type ReportPeriod = 'weekly' | 'monthly';

// ============ 辅助组件 ============

interface MetricItemProps {
  label: string;
  value: string | number;
  change?: number;
  changeSuffix?: string;
  icon: React.ReactNode;
  invertChange?: boolean; // 是否反转变化颜色（如回撤，减少是好的）
}

function MetricItem({ label, value, change, changeSuffix = '', icon, invertChange = false }: MetricItemProps) {
  const trend = change !== undefined ? getChangeTrend(change) : 'stable';
  
  // 确定变化颜色
  let changeColor = 'text-muted-foreground';
  if (trend !== 'stable') {
    const isPositiveChange = invertChange ? trend === 'improved' : trend === 'worsened';
    changeColor = isPositiveChange ? 'text-red-500' : 'text-green-500';
  }
  
  // 确定变化图标
  const ChangeIcon = trend === 'improved' 
    ? (invertChange ? ArrowDownRight : ArrowDownRight)
    : trend === 'worsened'
    ? (invertChange ? ArrowUpRight : ArrowUpRight)
    : Minus;

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono font-medium">{value}</span>
        {change !== undefined && Math.abs(change) > 0.01 && (
          <span className={`flex items-center text-xs ${changeColor}`}>
            <ChangeIcon size={12} />
            {formatChange(change, changeSuffix)}
          </span>
        )}
      </div>
    </div>
  );
}

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  const level = getRiskScoreLevel(score);
  const levelName = getRiskScoreLevelName(score);
  
  const colors = {
    safe: 'bg-green-500/20 text-green-500 border-green-500/30',
    caution: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    danger: 'bg-red-500/20 text-red-500 border-red-500/30',
  };
  
  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };
  
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${colors[level]} ${sizes[size]}`}>
      <span className="font-bold">{score.toFixed(0)}</span>
      <span className="opacity-75">/ 100</span>
      <span className="ml-1">{levelName}</span>
    </span>
  );
}

// ============ 主组件 ============

export function RiskReportCard({ weeklyReport, monthlyReport, className = '' }: RiskReportCardProps) {
  const [activePeriod, setActivePeriod] = useState<ReportPeriod>('weekly');
  
  const report = useMemo(() => {
    return activePeriod === 'weekly' ? weeklyReport : monthlyReport;
  }, [activePeriod, weeklyReport, monthlyReport]);
  
  const periodLabel = activePeriod === 'weekly' ? '周报' : '月报';
  const comparisonLabel = activePeriod === 'weekly' ? '较上周' : '较上月';
  
  // 如果没有报告数据
  if (!report) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="text-accent-cyan" size={20} />
          <h3 className="text-lg font-medium">风控报告</h3>
        </div>
        
        {/* 周期切换 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActivePeriod('weekly')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activePeriod === 'weekly'
                ? 'bg-accent-cyan/20 text-accent-cyan'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            }`}
          >
            周报
          </button>
          <button
            onClick={() => setActivePeriod('monthly')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activePeriod === 'monthly'
                ? 'bg-accent-cyan/20 text-accent-cyan'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            }`}
          >
            月报
          </button>
        </div>
        
        <div className="text-center py-8 text-muted-foreground">
          <FileText size={32} className="mx-auto mb-2 opacity-50" />
          <p>暂无{periodLabel}数据</p>
          <p className="text-xs mt-1">需要更多交易数据才能生成报告</p>
        </div>
      </Card>
    );
  }
  
  // 计算评分变化趋势
  const scoreChange = report.comparison?.scoreChange;
  const scoreTrend = scoreChange !== undefined ? getChangeTrend(scoreChange) : 'stable';
  const scoreTrendColor = scoreTrend === 'improved' ? 'text-green-500' : 
                          scoreTrend === 'worsened' ? 'text-red-500' : 'text-muted-foreground';
  
  return (
    <Card className={`p-6 ${className}`}>
      {/* 标题和周期切换 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="text-accent-cyan" size={20} />
          <h3 className="text-lg font-medium">风控报告</h3>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setActivePeriod('weekly')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activePeriod === 'weekly'
                ? 'bg-accent-cyan/20 text-accent-cyan'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            }`}
          >
            周报
          </button>
          <button
            onClick={() => setActivePeriod('monthly')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activePeriod === 'monthly'
                ? 'bg-accent-cyan/20 text-accent-cyan'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            }`}
          >
            月报
          </button>
        </div>
      </div>
      
      {/* 报告日期范围 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Calendar size={14} />
        <span>{report.startDate} 至 {report.endDate}</span>
      </div>
      
      {/* 综合评分 */}
      <div className="bg-muted/30 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground mb-1">综合风险评分</div>
            <ScoreBadge score={report.overallScore} size="lg" />
          </div>
          {scoreChange !== undefined && Math.abs(scoreChange) > 0.01 && (
            <div className={`text-right ${scoreTrendColor}`}>
              <div className="text-xs text-muted-foreground">{comparisonLabel}</div>
              <div className="flex items-center gap-1 text-lg font-medium">
                {scoreTrend === 'improved' ? (
                  <TrendingDown size={18} />
                ) : scoreTrend === 'worsened' ? (
                  <TrendingUp size={18} />
                ) : (
                  <Minus size={18} />
                )}
                {formatChange(scoreChange, '分')}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 摘要 */}
      {report.summary && (
        <div className="text-sm text-muted-foreground mb-4 p-3 bg-muted/20 rounded-lg">
          💡 {report.summary}
        </div>
      )}
      
      {/* 风控指标 */}
      <div className="space-y-1">
        <MetricItem
          label="最高杠杆"
          value={`${report.maxLeverage.toFixed(2)}x`}
          change={report.comparison?.leverageChange}
          changeSuffix="x"
          icon={<Activity size={14} />}
          invertChange={true}
        />
        <MetricItem
          label="最大回撤"
          value={`${report.maxDrawdown.toFixed(2)}%`}
          change={report.comparison?.drawdownChange}
          changeSuffix="%"
          icon={<TrendingDown size={14} />}
          invertChange={true}
        />
        <MetricItem
          label="规则违反"
          value={`${report.ruleViolations} 次`}
          icon={<AlertTriangle size={14} />}
        />
        <MetricItem
          label="最大连败"
          value={`${report.maxLosingStreak} 天`}
          icon={<BarChart3 size={14} />}
        />
      </div>
      
      {/* 交易统计 */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="text-sm text-muted-foreground mb-2">交易统计</div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-medium">{report.tradingDays}</div>
            <div className="text-xs text-muted-foreground">交易日</div>
          </div>
          <div>
            <div className="text-lg font-medium text-green-500">{report.profitableDays}</div>
            <div className="text-xs text-muted-foreground">盈利日</div>
          </div>
          <div>
            <div className="text-lg font-medium text-red-500">{report.losingDays}</div>
            <div className="text-xs text-muted-foreground">亏损日</div>
          </div>
        </div>
        
        {/* 胜率条 */}
        {report.tradingDays > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>胜率</span>
              <span>{((report.profitableDays / report.tradingDays) * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${(report.profitableDays / report.tradingDays) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* 总盈亏 */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {periodLabel}总盈亏
          </span>
          <span className={`text-lg font-bold ${
            report.totalPnL > 0 ? 'text-green-500' : 
            report.totalPnL < 0 ? 'text-red-500' : 'text-muted-foreground'
          }`}>
            {report.totalPnL > 0 ? '+' : ''}
            ¥{report.totalPnL.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">日均盈亏</span>
          <span className={`text-sm ${
            report.avgDailyPnL > 0 ? 'text-green-500' : 
            report.avgDailyPnL < 0 ? 'text-red-500' : 'text-muted-foreground'
          }`}>
            {report.avgDailyPnL > 0 ? '+' : ''}
            ¥{report.avgDailyPnL.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </Card>
  );
}

export default RiskReportCard;
