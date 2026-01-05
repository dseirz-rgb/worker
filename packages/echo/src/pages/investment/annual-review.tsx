/**
 * 投资模块 - 年度回顾页面
 * 2025 年度投资总结
 * 
 * 从 RiskControl AnnualReview2025.tsx 移植
 * - 使用 Echo 主应用 UI 风格
 * - HeroUI 组件 + @iconify/react 图标
 * - GradientBackground 包装
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { Card, CardBody, CardHeader, Button, Chip, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';

// ============================================
// 类型定义
// ============================================

interface DayData {
  date: string;
  nav: number;
  pnl: number;
  pnlPct: number;
  leverage: number;
  drawdown: number;
}

interface AnalysisSummary {
  period: { start: string; end: string };
  performance: {
    startNav: number;
    endNav: number;
    highWaterMark: number;
    ytdReturn: number;
    maxDrawdown: number;
    maxDrawdownPeriod: { from: string; to: string };
  };
  volatility: {
    dailyAvg: number;
    dailyVol: number;
    annualVol: number;
    positiveDays: number;
    negativeDays: number;
    winRate: number;
  };
  leverage: { avg: number; max: number; min: number };
  streaks: { maxWin: number; maxLose: number };
  bestDays: { date: string; pct: number; amount: number }[];
  worstDays: { date: string; pct: number; amount: number }[];
  drawdownPeriods: { start: string; end: string; depth: number; recovery?: string }[];
  monthlyReturns: { month: string; return: number }[];
  quarterlyReturns: { quarter: string; return: number }[];
}

// ============================================
// 工具函数
// ============================================

const formatCurrency = (value: number) => `¥${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
const formatDate = (date: string) => {
  const d = new Date(date);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

// ============================================
// 统计卡片组件
// ============================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'secondary';
}

const StatCard = ({ title, value, subtitle, icon, color = 'primary' }: StatCardProps) => (
  <Card className="bg-content1/50 backdrop-blur-sm">
    <CardBody className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-foreground/60">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-foreground/50 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-${color}/10`}>
          <Icon icon={icon} className={`text-2xl text-${color}`} />
        </div>
      </div>
    </CardBody>
  </Card>
);

// ============================================
// 主组件
// ============================================

const AnnualReviewPage = observer(() => {
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<DayData[]>([]);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // 从 Supabase 加载数据
  async function loadData() {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.warn('Supabase 配置缺失');
        setLoading(false);
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data: snapshots } = await supabase
        .from('dashboard_snapshots')
        .select('*')
        .gte('date', '2025-01-01')
        .lte('date', '2025-12-31')
        .order('date', { ascending: true });

      if (!snapshots || snapshots.length === 0) {
        setLoading(false);
        return;
      }

      // 处理每日数据
      const daily: DayData[] = snapshots.map(s => {
        const leverage = (() => {
          if (s.leverage_ratio && Number(s.leverage_ratio) > 1) return Number(s.leverage_ratio);
          if (s.long_ratio && s.long_ratio > 100) return s.long_ratio / 100;
          return 1;
        })();
        return {
          date: s.date,
          nav: Number(s.net_worth_cny),
          pnl: Number(s.daily_pnl || 0),
          pnlPct: Number(s.daily_pnl_percent || 0),
          leverage,
          drawdown: Number(s.drawdown_percent || 0)
        };
      });

      setDailyData(daily);
      setSummary(calculateSummary(snapshots, daily));
    } catch (error) {
      console.error('加载年度数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  // 计算汇总数据
  function calculateSummary(snapshots: any[], daily: DayData[]): AnalysisSummary {
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const startNav = Number(first.net_worth_cny);
    const endNav = Number(last.net_worth_cny);
    const hwm = Math.max(...snapshots.map(s => Number(s.net_worth_cny)));

    // 最大回撤计算
    let peak = startNav, peakDate = first.date;
    let maxDrawdown = 0, maxDrawdownFrom = '', maxDrawdownTo = '';
    const drawdownPeriods: { start: string; end: string; depth: number; recovery?: string }[] = [];
    let inDrawdown = false;

    for (const s of snapshots) {
      const nav = Number(s.net_worth_cny);
      if (nav > peak) {
        if (inDrawdown && drawdownPeriods.length > 0) {
          drawdownPeriods[drawdownPeriods.length - 1].recovery = s.date;
        }
        peak = nav; peakDate = s.date; inDrawdown = false;
      } else {
        const dd = (nav - peak) / peak * 100;
        if (!inDrawdown && dd < -10) {
          inDrawdown = true;
          drawdownPeriods.push({ start: peakDate, end: s.date, depth: dd });
        }
        if (inDrawdown && drawdownPeriods.length > 0) {
          const period = drawdownPeriods[drawdownPeriods.length - 1];
          if (dd < period.depth) { period.depth = dd; period.end = s.date; }
        }
        if (dd < maxDrawdown) { maxDrawdown = dd; maxDrawdownFrom = peakDate; maxDrawdownTo = s.date; }
      }
    }

    // 波动率计算
    const returns = daily.map(d => d.pnlPct).filter(r => !isNaN(r));
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const dailyVol = Math.sqrt(variance);
    const positiveDays = returns.filter(r => r > 0).length;
    const negativeDays = returns.filter(r => r < 0).length;

    // 连续涨跌
    let maxWin = 0, maxLose = 0, curWin = 0, curLose = 0;
    for (const r of returns) {
      if (r > 0) { curWin++; curLose = 0; maxWin = Math.max(maxWin, curWin); }
      else if (r < 0) { curLose++; curWin = 0; maxLose = Math.max(maxLose, curLose); }
    }

    // 最好/最差的天
    const sortedDays = [...daily].sort((a, b) => b.pnlPct - a.pnlPct);
    const bestDays = sortedDays.slice(0, 5).map(d => ({ date: d.date, pct: d.pnlPct, amount: d.pnl }));
    const worstDays = sortedDays.slice(-5).reverse().map(d => ({ date: d.date, pct: d.pnlPct, amount: d.pnl }));

    // 月度收益
    const monthlyMap: Record<string, { start: number; end: number }> = {};
    for (const s of snapshots) {
      const month = s.date.substring(0, 7);
      const nav = Number(s.net_worth_cny);
      if (!monthlyMap[month]) monthlyMap[month] = { start: nav, end: nav };
      else monthlyMap[month].end = nav;
    }
    const monthlyReturns = Object.entries(monthlyMap).map(([month, data]) => ({
      month, return: (data.end - data.start) / data.start * 100
    }));

    // 季度收益
    const quarterlyMap: Record<string, { start: number; end: number }> = {};
    for (const s of snapshots) {
      const m = parseInt(s.date.substring(5, 7));
      const q = `Q${Math.ceil(m / 3)}`;
      const nav = Number(s.net_worth_cny);
      if (!quarterlyMap[q]) quarterlyMap[q] = { start: nav, end: nav };
      else quarterlyMap[q].end = nav;
    }
    const quarterlyReturns = Object.entries(quarterlyMap).map(([quarter, data]) => ({
      quarter, return: (data.end - data.start) / data.start * 100
    }));

    // 杠杆统计
    const leverages = daily.map(d => d.leverage).filter(l => l > 0);
    const avgLeverage = leverages.reduce((a, b) => a + b, 0) / leverages.length;

    return {
      period: { start: first.date, end: last.date },
      performance: { startNav, endNav, highWaterMark: hwm, ytdReturn: (endNav - startNav) / startNav * 100, maxDrawdown, maxDrawdownPeriod: { from: maxDrawdownFrom, to: maxDrawdownTo } },
      volatility: { dailyAvg: avgReturn, dailyVol, annualVol: dailyVol * Math.sqrt(252), positiveDays, negativeDays, winRate: positiveDays / (positiveDays + negativeDays) * 100 },
      leverage: { avg: avgLeverage, max: Math.max(...leverages), min: Math.min(...leverages) },
      streaks: { maxWin, maxLose },
      bestDays, worstDays,
      drawdownPeriods: drawdownPeriods.filter(p => p.depth < -10),
      monthlyReturns, quarterlyReturns
    };
  }

  // AI 深度分析
  async function generateAIAnalysis() {
    if (!summary || !dailyData.length) return;
    setAiLoading(true); setAiError(null); setAiAnalysis('');

    try {
      const dataContext = `
## 2025年度投资数据摘要
### 基础业绩
- 年初净值: ¥${summary.performance.startNav.toLocaleString()}
- 年末净值: ¥${summary.performance.endNav.toLocaleString()}
- 年度收益率: ${summary.performance.ytdReturn.toFixed(2)}%
- 最大回撤: ${summary.performance.maxDrawdown.toFixed(2)}%
### 波动率指标
- 胜率: ${summary.volatility.winRate.toFixed(1)}%
- 年化波动率: ${summary.volatility.annualVol.toFixed(2)}%
### 杠杆使用
- 平均杠杆: ${summary.leverage.avg.toFixed(2)}x
- 最高杠杆: ${summary.leverage.max.toFixed(2)}x
### 最佳5天
${summary.bestDays.map((d, i) => `${i + 1}. ${d.date}: ${d.pct.toFixed(2)}%`).join('\n')}
### 最差5天
${summary.worstDays.map((d, i) => `${i + 1}. ${d.date}: ${d.pct.toFixed(2)}%`).join('\n')}
`;

      const prompt = `你是一位资深的投资分析师，请基于以下2025年度投资数据进行深度分析。
${dataContext}
请分析：1. 做对的事情 2. 最贵的教训 3. 关键洞察 4. 2026年改进建议
用中文回答，使用Markdown格式，每个观点都要有数据支撑。`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-gemini-model': 'gemini-3-pro-preview' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.7 }
        })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '', buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        // 简单的 JSON 解析
        const matches = buffer.match(/\{[^{}]*"text"[^{}]*\}/g);
        if (matches) {
          for (const match of matches) {
            try {
              const obj = JSON.parse(match);
              if (obj.text) { fullText += obj.text; setAiAnalysis(fullText); }
            } catch { /* ignore */ }
          }
        }
      }
      if (!fullText) throw new Error('AI 未返回有效内容');
    } catch (error) {
      setAiError(error instanceof Error ? error.message : '生成分析失败');
    } finally {
      setAiLoading(false);
    }
  }

  // 图表数据
  const navChartData = useMemo(() => {
    return dailyData.map(d => ({
      date: d.date.substring(5),
      nav: d.nav / 10000,
    }));
  }, [dailyData]);

  const monthlyChartData = useMemo(() => {
    return summary?.monthlyReturns.map(m => ({
      month: m.month.substring(5),
      return: m.return,
      fill: m.return >= 0 ? '#10b981' : '#ef4444'
    })) || [];
  }, [summary]);

  // 加载状态
  if (loading) {
    return (
      <GradientBackground className="h-full overflow-auto">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Spinner size="lg" color="primary" />
            <p className="text-foreground/60 mt-4">正在加载年度数据...</p>
          </div>
        </div>
      </GradientBackground>
    );
  }

  // 无数据状态
  if (!summary) {
    return (
      <GradientBackground className="h-full overflow-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          <div className="flex items-center gap-3 mb-6">
            <Link to="/investment">
              <Button isIconOnly variant="light" size="sm">
                <Icon icon="mdi:arrow-left" className="text-xl" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">年度回顾</h1>
          </div>
          <Card className="bg-content1/50 backdrop-blur-sm">
            <CardBody className="p-8 text-center">
              <Icon icon="mdi:calendar-blank" className="text-6xl text-foreground/30 mb-4 mx-auto" />
              <p className="text-foreground/60">暂无 2025 年数据</p>
            </CardBody>
          </Card>
        </div>
      </GradientBackground>
    );
  }

  // 主渲染
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
                <Icon icon="mdi:calendar-check" className="text-secondary" />
                2025 年度回顾
              </h1>
              <p className="text-foreground/60 mt-1">
                {summary.period.start} ~ {summary.period.end}
              </p>
            </div>
          </div>
        </div>

        {/* Hero 区域 - 年度收益率 */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardBody className="p-8 text-center">
            <Chip color="secondary" variant="flat" className="mb-4">
              <Icon icon="mdi:calendar" className="mr-1" />
              年度总结
            </Chip>
            <p className={`text-5xl md:text-6xl font-bold ${summary.performance.ytdReturn >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatPercent(summary.performance.ytdReturn)}
            </p>
            <p className="text-foreground/60 text-lg mt-2">年度收益率</p>
          </CardBody>
        </Card>

        {/* 核心指标卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="年初净值" value={formatCurrency(summary.performance.startNav)} icon="mdi:calendar-start" color="primary" />
          <StatCard title="当前净值" value={formatCurrency(summary.performance.endNav)} icon="mdi:cash" color="success" />
          <StatCard title="最高水位" value={formatCurrency(summary.performance.highWaterMark)} icon="mdi:trophy" color="warning" />
          <StatCard title="最大回撤" value={`${summary.performance.maxDrawdown.toFixed(1)}%`} icon="mdi:trending-down" color="danger" />
        </div>

        {/* 净值曲线 */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader className="pb-0">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:chart-line" className="text-xl text-primary" />
              <h2 className="text-lg font-semibold">净值曲线</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={navChartData}>
                  <defs>
                    <linearGradient id="navGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--heroui-primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--heroui-primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--heroui-default-200))" />
                  <XAxis dataKey="date" tick={{ fill: 'hsl(var(--heroui-foreground-500))', fontSize: 10 }} interval={20} />
                  <YAxis tick={{ fill: 'hsl(var(--heroui-foreground-500))', fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}万`} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--heroui-content1))', border: '1px solid hsl(var(--heroui-default-200))', borderRadius: '8px' }} formatter={(value: number) => [`¥${(value * 10000).toLocaleString()}`, '净值']} />
                  <Area type="monotone" dataKey="nav" stroke="hsl(var(--heroui-primary))" fill="url(#navGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {/* 月度收益 */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader className="pb-0">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:chart-bar" className="text-xl text-secondary" />
              <h2 className="text-lg font-semibold">月度收益</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--heroui-default-200))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(var(--heroui-foreground-500))', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(var(--heroui-foreground-500))', fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}%`} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--heroui-content1))', border: '1px solid hsl(var(--heroui-default-200))', borderRadius: '8px' }} formatter={(value: number) => [`${value.toFixed(2)}%`, '收益率']} />
                  <ReferenceLine y={0} stroke="hsl(var(--heroui-default-400))" />
                  <Bar dataKey="return" radius={[4, 4, 0, 0]}>
                    {monthlyChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* 季度汇总 */}
            <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-default-200">
              {summary.quarterlyReturns.map(q => (
                <div key={q.quarter} className="text-center">
                  <p className={`text-xl font-bold ${q.return >= 0 ? 'text-success' : 'text-danger'}`}>{formatPercent(q.return)}</p>
                  <p className="text-sm text-foreground/60">{q.quarter}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* 做对的事 & 最贵的教训 */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* 做对的事 */}
          <Card className="bg-success/5 border border-success/20">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2 text-success">
                <Icon icon="mdi:trophy" className="text-xl" />
                <h2 className="text-lg font-semibold">2025 做对的事</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="p-3 rounded-lg bg-content1/50">
                <div className="flex items-center gap-2 mb-1">
                  <Icon icon="mdi:medal" className="text-warning" />
                  <span className="text-sm text-foreground/60">最佳单日</span>
                </div>
                <p className="text-2xl font-bold text-success">{formatPercent(summary.bestDays[0].pct)}</p>
                <p className="text-xs text-foreground/50">{formatDate(summary.bestDays[0].date)} · 盈利 {formatCurrency(summary.bestDays[0].amount)}</p>
              </div>
              <div className="p-3 rounded-lg bg-content1/50">
                <div className="flex items-center gap-2 mb-1">
                  <Icon icon="mdi:lightning-bolt" className="text-primary" />
                  <span className="text-sm text-foreground/60">最长连涨</span>
                </div>
                <p className="text-2xl font-bold text-primary">{summary.streaks.maxWin} 天</p>
              </div>
              <div className="p-3 rounded-lg bg-content1/50">
                <div className="flex items-center gap-2 mb-1">
                  <Icon icon="mdi:heart" className="text-secondary" />
                  <span className="text-sm text-foreground/60">胜率</span>
                </div>
                <p className="text-2xl font-bold text-secondary">{summary.volatility.winRate.toFixed(1)}%</p>
                <p className="text-xs text-foreground/50">{summary.volatility.positiveDays} 天盈利 / {summary.volatility.positiveDays + summary.volatility.negativeDays} 天</p>
              </div>
            </CardBody>
          </Card>

          {/* 最贵的教训 */}
          <Card className="bg-danger/5 border border-danger/20">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2 text-danger">
                <Icon icon="mdi:skull" className="text-xl" />
                <h2 className="text-lg font-semibold">2025 最贵的教训</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="p-3 rounded-lg bg-content1/50">
                <div className="flex items-center gap-2 mb-1">
                  <Icon icon="mdi:alert" className="text-danger" />
                  <span className="text-sm text-foreground/60">最大单日亏损</span>
                </div>
                <p className="text-2xl font-bold text-danger">{formatPercent(summary.worstDays[0].pct)}</p>
                <p className="text-xs text-foreground/50">{formatDate(summary.worstDays[0].date)} · 亏损 {formatCurrency(Math.abs(summary.worstDays[0].amount))}</p>
              </div>
              <div className="p-3 rounded-lg bg-content1/50">
                <div className="flex items-center gap-2 mb-1">
                  <Icon icon="mdi:trending-down" className="text-danger" />
                  <span className="text-sm text-foreground/60">最大回撤</span>
                </div>
                <p className="text-2xl font-bold text-danger">{summary.performance.maxDrawdown.toFixed(1)}%</p>
                <p className="text-xs text-foreground/50">{formatDate(summary.performance.maxDrawdownPeriod.from)} → {formatDate(summary.performance.maxDrawdownPeriod.to)}</p>
              </div>
              <div className="p-3 rounded-lg bg-content1/50">
                <div className="flex items-center gap-2 mb-1">
                  <Icon icon="mdi:shield-alert" className="text-warning" />
                  <span className="text-sm text-foreground/60">最高杠杆</span>
                </div>
                <p className="text-2xl font-bold text-warning">{summary.leverage.max.toFixed(2)}x</p>
                <p className="text-xs text-foreground/50">平均杠杆 {summary.leverage.avg.toFixed(2)}x</p>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* 波动率分析 */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader className="pb-0">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:chart-areaspline" className="text-xl text-secondary" />
              <h2 className="text-lg font-semibold">波动率分析</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-content2/50">
                <p className="text-2xl font-bold text-primary">{summary.volatility.dailyAvg.toFixed(3)}%</p>
                <p className="text-sm text-foreground/60">日均收益</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-content2/50">
                <p className="text-2xl font-bold text-secondary">{summary.volatility.dailyVol.toFixed(2)}%</p>
                <p className="text-sm text-foreground/60">日波动率</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-content2/50">
                <p className="text-2xl font-bold text-warning">{summary.volatility.annualVol.toFixed(1)}%</p>
                <p className="text-sm text-foreground/60">年化波动率</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-content2/50">
                <p className="text-2xl font-bold text-success">{(summary.performance.ytdReturn / summary.volatility.annualVol).toFixed(2)}</p>
                <p className="text-sm text-foreground/60">夏普比率</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 回撤分析 */}
        {summary.drawdownPeriods.length > 0 && (
          <Card className="bg-content1/50 backdrop-blur-sm">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:alert-circle" className="text-xl text-warning" />
                <h2 className="text-lg font-semibold">主要回撤期</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              {summary.drawdownPeriods.map((period, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-content2/50 border-l-4" style={{ borderLeftColor: period.depth < -30 ? '#ef4444' : period.depth < -20 ? '#f59e0b' : '#eab308' }}>
                  <div>
                    <p className="font-medium">{formatDate(period.start)} → {formatDate(period.end)}</p>
                    <p className="text-sm text-foreground/50">{period.recovery ? `${formatDate(period.recovery)} 恢复` : '尚未恢复'}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold ${period.depth < -30 ? 'text-danger' : 'text-warning'}`}>{period.depth.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {/* 最好/最差的5天 */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-content1/50 backdrop-blur-sm">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2 text-success">
                <Icon icon="mdi:trending-up" className="text-xl" />
                <h2 className="text-lg font-semibold">最好的5天</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-2">
              {summary.bestDays.map((day, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-content2/50">
                  <span className="font-medium">{formatDate(day.date)}</span>
                  <div className="text-right">
                    <p className="font-bold text-success">{formatPercent(day.pct)}</p>
                    <p className="text-xs text-foreground/50">{formatCurrency(day.amount)}</p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
          
          <Card className="bg-content1/50 backdrop-blur-sm">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2 text-danger">
                <Icon icon="mdi:trending-down" className="text-xl" />
                <h2 className="text-lg font-semibold">最差的5天</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-2">
              {summary.worstDays.map((day, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-content2/50">
                  <span className="font-medium">{formatDate(day.date)}</span>
                  <div className="text-right">
                    <p className="font-bold text-danger">{formatPercent(day.pct)}</p>
                    <p className="text-xs text-foreground/50">{formatCurrency(Math.abs(day.amount))}</p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        {/* AI 深度分析 */}
        <Card className="bg-content1/50 backdrop-blur-sm border border-primary/20">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:robot" className="text-xl text-primary" />
                <h2 className="text-lg font-semibold">AI 深度分析</h2>
              </div>
              <Button
                color={aiAnalysis ? 'default' : 'primary'}
                variant={aiAnalysis ? 'flat' : 'solid'}
                size="sm"
                isLoading={aiLoading}
                startContent={!aiLoading && <Icon icon={aiAnalysis ? 'mdi:refresh' : 'mdi:sparkles'} />}
                onPress={generateAIAnalysis}
              >
                {aiAnalysis ? '重新分析' : '生成 AI 分析'}
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            {aiError && (
              <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-danger mb-4">
                {aiError}
              </div>
            )}
            {aiAnalysis ? (
              <div className="prose prose-sm max-w-none text-foreground/80 whitespace-pre-wrap">
                {aiAnalysis}
              </div>
            ) : !aiLoading && (
              <div className="text-center py-12 text-foreground/50">
                <Icon icon="mdi:brain" className="text-5xl mb-4 mx-auto opacity-50" />
                <p>点击上方按钮，让 AI 深度分析你的 2025 年投资表现</p>
                <p className="text-sm mt-2">包括：关键事件分析、教训总结、改进建议</p>
              </div>
            )}
            {aiLoading && !aiAnalysis && (
              <div className="text-center py-12">
                <Spinner size="lg" color="primary" />
                <p className="text-foreground/60 mt-4">AI 正在深度分析你的投资数据...</p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* 年度反思 */}
        <Card className="bg-content1/50 backdrop-blur-sm border border-primary/20">
          <CardHeader className="pb-0">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:brain" className="text-xl text-primary" />
              <h2 className="text-lg font-semibold">年度反思</h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-6">
            {/* 关键洞察 */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Icon icon="mdi:lightbulb" className="text-warning" />
                关键洞察
              </h4>
              <ul className="space-y-2 text-foreground/70">
                <li className="flex items-start gap-2">
                  <span className="text-foreground/40">•</span>
                  <span>全年收益 <span className={`font-bold ${summary.performance.ytdReturn >= 0 ? 'text-success' : 'text-danger'}`}>{formatPercent(summary.performance.ytdReturn)}</span>，但经历了 <span className="font-bold text-danger">{summary.performance.maxDrawdown.toFixed(1)}%</span> 的最大回撤</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-foreground/40">•</span>
                  <span>年化波动率 <span className="font-bold text-warning">{summary.volatility.annualVol.toFixed(1)}%</span>，属于高波动策略</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-foreground/40">•</span>
                  <span>胜率 <span className="font-bold text-secondary">{summary.volatility.winRate.toFixed(1)}%</span>，{summary.volatility.winRate > 50 ? '略高于' : '低于'} 50%</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-foreground/40">•</span>
                  <span>夏普比率 <span className="font-bold text-primary">{(summary.performance.ytdReturn / summary.volatility.annualVol).toFixed(2)}</span>，{summary.performance.ytdReturn / summary.volatility.annualVol > 1 ? '风险调整后收益良好' : '风险调整后收益有待提升'}</span>
                </li>
              </ul>
            </div>

            {/* 需要改进 */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Icon icon="mdi:book-open-variant" className="text-secondary" />
                需要改进
              </h4>
              <ul className="space-y-2 text-foreground/70">
                <li className="flex items-start gap-2">
                  <span className="text-foreground/40">•</span>
                  <span>回撤控制：{summary.drawdownPeriods.length} 次超过 10% 的回撤，需要更严格的止损纪律</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-foreground/40">•</span>
                  <span>杠杆管理：最高杠杆达到 <span className="font-bold text-warning">{summary.leverage.max.toFixed(2)}x</span>，在高波动市场中风险较大</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-foreground/40">•</span>
                  <span>连续亏损：最长连跌 <span className="font-bold text-danger">{summary.streaks.maxLose}</span> 天，需要在连续亏损时降低仓位</span>
                </li>
              </ul>
            </div>

            {/* 2026 目标 */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Icon icon="mdi:target" className="text-success" />
                2026 目标
              </h4>
              <ul className="space-y-2 text-foreground/70">
                <li className="flex items-start gap-2">
                  <span className="text-foreground/40">•</span>
                  <span>将最大回撤控制在 <span className="font-bold text-success">25%</span> 以内</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-foreground/40">•</span>
                  <span>保持杠杆在 <span className="font-bold text-primary">1.5x</span> 以下</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-foreground/40">•</span>
                  <span>提高夏普比率至 <span className="font-bold text-secondary">1.5</span> 以上</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-foreground/40">•</span>
                  <span>建立更系统的风控机制</span>
                </li>
              </ul>
            </div>
          </CardBody>
        </Card>

        {/* Footer */}
        <div className="text-center py-4 text-foreground/50 text-sm">
          <p>数据统计周期：{summary.period.start} ~ {summary.period.end}</p>
          <p className="mt-1">投资有风险，过往业绩不代表未来表现</p>
        </div>
      </div>
    </GradientBackground>
  );
});

export default AnnualReviewPage;
