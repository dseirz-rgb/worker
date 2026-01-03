import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle,
  Calendar,
  Target,
  Zap,
  Shield,
  BarChart3,
  PieChart,
  Activity,
  Clock,
  DollarSign,
  Percent,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  BookOpen,
  Trophy,
  Skull,
  Heart,
  Brain,
  Sparkles,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { getClient } from '@/services/supabaseData';
import {
  LineChart,
  Line,
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
  PieChart as RechartsPie,
  Pie
} from 'recharts';

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

export default function AnnualReview2025() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<DayData[]>([]);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const supabase = getClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!supabase) return;

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
      // 杠杆率计算：leverage_ratio > 1 才是有效值，否则用 long_ratio 计算
      const leverage = (() => {
        if (s.leverage_ratio && Number(s.leverage_ratio) > 1) {
          return Number(s.leverage_ratio);
        }
        if (s.long_ratio && s.long_ratio > 100) {
          return s.long_ratio / 100;
        }
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

    // 计算汇总数据
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const startNav = Number(first.net_worth_cny);
    const endNav = Number(last.net_worth_cny);
    const hwm = Math.max(...snapshots.map(s => Number(s.net_worth_cny)));

    // 最大回撤计算
    let peak = startNav;
    let peakDate = first.date;
    let maxDrawdown = 0;
    let maxDrawdownFrom = '';
    let maxDrawdownTo = '';
    const drawdownPeriods: { start: string; end: string; depth: number; recovery?: string }[] = [];
    let inDrawdown = false;
    let currentDDStart = '';

    for (const s of snapshots) {
      const nav = Number(s.net_worth_cny);
      if (nav > peak) {
        if (inDrawdown && drawdownPeriods.length > 0) {
          drawdownPeriods[drawdownPeriods.length - 1].recovery = s.date;
        }
        peak = nav;
        peakDate = s.date;
        inDrawdown = false;
      } else {
        const dd = (nav - peak) / peak * 100;
        if (!inDrawdown && dd < -10) {
          inDrawdown = true;
          currentDDStart = peakDate;
          drawdownPeriods.push({ start: peakDate, end: s.date, depth: dd });
        }
        if (inDrawdown && drawdownPeriods.length > 0) {
          const period = drawdownPeriods[drawdownPeriods.length - 1];
          if (dd < period.depth) {
            period.depth = dd;
            period.end = s.date;
          }
        }
        if (dd < maxDrawdown) {
          maxDrawdown = dd;
          maxDrawdownFrom = peakDate;
          maxDrawdownTo = s.date;
        }
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
      month,
      return: (data.end - data.start) / data.start * 100
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
      quarter,
      return: (data.end - data.start) / data.start * 100
    }));

    // 杠杆统计
    const leverages = daily.map(d => d.leverage).filter(l => l > 0);
    const avgLeverage = leverages.reduce((a, b) => a + b, 0) / leverages.length;

    setSummary({
      period: { start: first.date, end: last.date },
      performance: {
        startNav,
        endNav,
        highWaterMark: hwm,
        ytdReturn: (endNav - startNav) / startNav * 100,
        maxDrawdown,
        maxDrawdownPeriod: { from: maxDrawdownFrom, to: maxDrawdownTo }
      },
      volatility: {
        dailyAvg: avgReturn,
        dailyVol,
        annualVol: dailyVol * Math.sqrt(252),
        positiveDays,
        negativeDays,
        winRate: positiveDays / (positiveDays + negativeDays) * 100
      },
      leverage: {
        avg: avgLeverage,
        max: Math.max(...leverages),
        min: Math.min(...leverages)
      },
      streaks: { maxWin, maxLose },
      bestDays,
      worstDays,
      drawdownPeriods: drawdownPeriods.filter(p => p.depth < -10),
      monthlyReturns,
      quarterlyReturns
    });

    setLoading(false);
  }

  // AI 深度分析函数
  async function generateAIAnalysis() {
    if (!summary || !dailyData.length) return;
    
    setAiLoading(true);
    setAiError(null);
    setAiAnalysis('');

    try {
      // 构建详细的数据上下文
      const dataContext = `
## 2025年度投资数据摘要

### 基础业绩
- 年初净值: ¥${summary.performance.startNav.toLocaleString()}
- 年末净值: ¥${summary.performance.endNav.toLocaleString()}
- 最高水位: ¥${summary.performance.highWaterMark.toLocaleString()}
- 年度收益率: ${summary.performance.ytdReturn.toFixed(2)}%
- 最大回撤: ${summary.performance.maxDrawdown.toFixed(2)}%
- 回撤期间: ${summary.performance.maxDrawdownPeriod.from} 至 ${summary.performance.maxDrawdownPeriod.to}

### 波动率指标
- 日均收益: ${summary.volatility.dailyAvg.toFixed(4)}%
- 日波动率: ${summary.volatility.dailyVol.toFixed(2)}%
- 年化波动率: ${summary.volatility.annualVol.toFixed(2)}%
- 胜率: ${summary.volatility.winRate.toFixed(1)}% (${summary.volatility.positiveDays}天盈利/${summary.volatility.positiveDays + summary.volatility.negativeDays}天)

### 杠杆使用
- 平均杠杆: ${summary.leverage.avg.toFixed(2)}x
- 最高杠杆: ${summary.leverage.max.toFixed(2)}x
- 最低杠杆: ${summary.leverage.min.toFixed(2)}x

### 连续表现
- 最长连涨: ${summary.streaks.maxWin}天
- 最长连跌: ${summary.streaks.maxLose}天

### 最佳5天 (需要深度分析背后原因)
${summary.bestDays.map((d, i) => `${i + 1}. ${d.date}: ${d.pct.toFixed(2)}% (盈利 ¥${d.amount.toLocaleString()})`).join('\n')}

### 最差5天 (需要深度分析背后原因)
${summary.worstDays.map((d, i) => `${i + 1}. ${d.date}: ${d.pct.toFixed(2)}% (亏损 ¥${Math.abs(d.amount).toLocaleString()})`).join('\n')}

### 月度收益
${summary.monthlyReturns.map(m => `- ${m.month}: ${m.return.toFixed(2)}%`).join('\n')}

### 季度收益
${summary.quarterlyReturns.map(q => `- ${q.quarter}: ${q.return.toFixed(2)}%`).join('\n')}

### 主要回撤期 (>10%)
${summary.drawdownPeriods.map((p, i) => `${i + 1}. ${p.start} → ${p.end}: ${p.depth.toFixed(1)}% ${p.recovery ? `(${p.recovery}恢复)` : '(未恢复)'}`).join('\n')}
`;

      const prompt = `你是一位资深的投资分析师，请基于以下2025年度投资数据，进行深度分析。

${dataContext}

## 分析要求

请进行以下深度分析，每个部分都要有具体的事件分析和逻辑推演：

### 1. 🏆 2025年做对的事情 (至少3点)
- 分析最佳单日(${summary.bestDays[0].date})背后可能发生了什么市场事件
- 分析Q1/Q3表现优异的可能原因
- 从数据中推断出哪些交易决策是正确的
- 结合2025年的市场环境(如AI热潮、美联储政策等)分析

### 2. 💀 2025年最贵的教训 (至少3点)
- 深度分析最差单日(${summary.worstDays[0].date})背后可能发生了什么
- 分析${summary.performance.maxDrawdown.toFixed(1)}%最大回撤期间(${summary.performance.maxDrawdownPeriod.from}至${summary.performance.maxDrawdownPeriod.to})的市场背景
- 从杠杆数据(最高${summary.leverage.max.toFixed(2)}x)分析风险管理问题
- 分析连续亏损${summary.streaks.maxLose}天期间可能的心理和操作问题

### 3. 🔍 关键洞察
- 从月度/季度数据中发现的规律
- 波动率与收益的关系分析
- 胜率${summary.volatility.winRate.toFixed(1)}%说明了什么

### 4. 📋 2026年改进建议
- 基于数据的具体、可执行的建议
- 风控规则建议(止损、仓位管理)
- 心理建设建议

请用中文回答，使用Markdown格式，每个观点都要有数据支撑和逻辑推演，不要空洞的建议。`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-model': 'gemini-3-pro-preview'
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.7
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // 使用健壮的 JSON 流解析
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      // 健壮的 JSON 流解析函数
      const parseJSONStream = (buf: string): { objects: any[], remaining: string } => {
        const objects: any[] = [];
        let depth = 0;
        let inString = false;
        let start = -1;
        let escape = false;
        let processedUpTo = 0;

        for (let i = 0; i < buf.length; i++) {
          const char = buf[i];
          if (escape) { escape = false; continue; }
          if (char === '\\') { escape = true; continue; }
          if (char === '"') { inString = !inString; continue; }
          if (!inString) {
            if (char === '{') { if (depth === 0) start = i; depth++; }
            else if (char === '}') {
              depth--;
              if (depth === 0 && start !== -1) {
                try {
                  const jsonStr = buf.substring(start, i + 1);
                  objects.push(JSON.parse(jsonStr));
                  processedUpTo = i + 1;
                } catch { /* ignore */ }
                start = -1;
              }
            }
          }
        }
        return { objects, remaining: buf.slice(processedUpTo) };
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { objects, remaining } = parseJSONStream(buffer);
        buffer = remaining;

        for (const data of objects) {
          if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const text = data.candidates[0].content.parts[0].text;
            fullText += text;
            setAiAnalysis(fullText);
          }
        }

        // 防止缓冲区无限增长
        if (buffer.length > 500000) {
          buffer = buffer.slice(-50000);
        }
      }

      if (!fullText) {
        throw new Error('AI 未返回有效内容，请检查网络或稍后重试');
      }

    } catch (error) {
      console.error('AI Analysis Error:', error);
      setAiError(error instanceof Error ? error.message : '生成分析失败');
    } finally {
      setAiLoading(false);
    }
  }

  const formatCurrency = (value: number) => `¥${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  const formatDate = (date: string) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  // 净值曲线数据
  const navChartData = useMemo(() => {
    return dailyData.map(d => ({
      date: d.date.substring(5),
      nav: d.nav / 10000,
      hwm: summary?.performance.highWaterMark ? summary.performance.highWaterMark / 10000 : 0
    }));
  }, [dailyData, summary]);

  // 月度收益柱状图数据
  const monthlyChartData = useMemo(() => {
    return summary?.monthlyReturns.map(m => ({
      month: m.month.substring(5),
      return: m.return,
      fill: m.return >= 0 ? '#10b981' : '#ef4444'
    })) || [];
  }, [summary]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">正在加载年度数据...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-secondary">暂无2025年数据</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-bg-primary via-bg-secondary to-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-bg-primary/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => setLocation('/dashboard')}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={20} />
            <span>返回</span>
          </button>
          <h1 className="text-xl font-bold bg-gradient-to-r from-accent-cyan to-accent-purple bg-clip-text text-transparent">
            2025 年度投资回顾
          </h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <section className="text-center py-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent-cyan/10 rounded-full text-accent-cyan text-sm mb-6">
            <Calendar size={16} />
            <span>{summary.period.start} ~ {summary.period.end}</span>
          </div>
          
          <h2 className="text-4xl md:text-6xl font-bold mb-4">
            <span className={summary.performance.ytdReturn >= 0 ? 'text-accent-green' : 'text-accent-red'}>
              {formatPercent(summary.performance.ytdReturn)}
            </span>
          </h2>
          <p className="text-text-secondary text-lg mb-8">年度收益率</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="bg-bg-secondary/50 rounded-xl p-4 border border-border">
              <div className="text-2xl font-bold text-text-primary">{formatCurrency(summary.performance.startNav)}</div>
              <div className="text-sm text-text-muted">年初净值</div>
            </div>
            <div className="bg-bg-secondary/50 rounded-xl p-4 border border-border">
              <div className="text-2xl font-bold text-accent-cyan">{formatCurrency(summary.performance.endNav)}</div>
              <div className="text-sm text-text-muted">当前净值</div>
            </div>
            <div className="bg-bg-secondary/50 rounded-xl p-4 border border-border">
              <div className="text-2xl font-bold text-accent-yellow">{formatCurrency(summary.performance.highWaterMark)}</div>
              <div className="text-sm text-text-muted">最高水位</div>
            </div>
            <div className="bg-bg-secondary/50 rounded-xl p-4 border border-border">
              <div className="text-2xl font-bold text-accent-red">{summary.performance.maxDrawdown.toFixed(1)}%</div>
              <div className="text-sm text-text-muted">最大回撤</div>
            </div>
          </div>
        </section>

        {/* 净值曲线 */}
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Activity size={20} className="text-accent-cyan" />
            净值曲线
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={navChartData}>
                <defs>
                  <linearGradient id="navGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} interval={20} />
                <YAxis tick={{ fill: '#666', fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}万`} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                  formatter={(value: number) => [`¥${(value * 10000).toLocaleString()}`, '净值']}
                />
                <Area type="monotone" dataKey="nav" stroke="#06b6d4" fill="url(#navGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 月度收益 */}
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <BarChart3 size={20} className="text-accent-purple" />
            月度收益
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 12 }} />
                <YAxis tick={{ fill: '#666', fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, '收益率']}
                />
                <ReferenceLine y={0} stroke="#666" />
                <Bar dataKey="return" radius={[4, 4, 0, 0]}>
                  {monthlyChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* 季度汇总 */}
          <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
            {summary.quarterlyReturns.map(q => (
              <div key={q.quarter} className="text-center">
                <div className={`text-xl font-bold ${q.return >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                  {formatPercent(q.return)}
                </div>
                <div className="text-sm text-text-muted">{q.quarter}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* 最对的事 & 最贵的教训 */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* 最对的事 */}
          <Card className="p-6 border-accent-green/30 bg-accent-green/5">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-accent-green">
              <Trophy size={20} />
              2025 做对的事
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Award size={16} className="text-accent-yellow" />
                  <span className="font-medium">最佳单日</span>
                </div>
                <div className="text-2xl font-bold text-accent-green mb-1">
                  {formatPercent(summary.bestDays[0].pct)}
                </div>
                <div className="text-sm text-text-muted">
                  {formatDate(summary.bestDays[0].date)} · 盈利 {formatCurrency(summary.bestDays[0].amount)}
                </div>
              </div>
              
              <div className="p-4 bg-bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={16} className="text-accent-cyan" />
                  <span className="font-medium">最长连涨</span>
                </div>
                <div className="text-2xl font-bold text-accent-cyan">
                  {summary.streaks.maxWin} 天
                </div>
              </div>
              
              <div className="p-4 bg-bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-accent-green" />
                  <span className="font-medium">最佳季度</span>
                </div>
                <div className="text-2xl font-bold text-accent-green">
                  {formatPercent(Math.max(...summary.quarterlyReturns.map(q => q.return)))}
                </div>
                <div className="text-sm text-text-muted">
                  {summary.quarterlyReturns.find(q => q.return === Math.max(...summary.quarterlyReturns.map(q => q.return)))?.quarter}
                </div>
              </div>
              
              <div className="p-4 bg-bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Heart size={16} className="text-accent-purple" />
                  <span className="font-medium">胜率</span>
                </div>
                <div className="text-2xl font-bold text-accent-purple">
                  {summary.volatility.winRate.toFixed(1)}%
                </div>
                <div className="text-sm text-text-muted">
                  {summary.volatility.positiveDays} 天盈利 / {summary.volatility.positiveDays + summary.volatility.negativeDays} 天
                </div>
              </div>
            </div>
          </Card>

          {/* 最贵的教训 */}
          <Card className="p-6 border-accent-red/30 bg-accent-red/5">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-accent-red">
              <Skull size={20} />
              2025 最贵的教训
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-accent-red" />
                  <span className="font-medium">最大单日亏损</span>
                </div>
                <div className="text-2xl font-bold text-accent-red mb-1">
                  {formatPercent(summary.worstDays[0].pct)}
                </div>
                <div className="text-sm text-text-muted">
                  {formatDate(summary.worstDays[0].date)} · 亏损 {formatCurrency(Math.abs(summary.worstDays[0].amount))}
                </div>
              </div>
              
              <div className="p-4 bg-bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown size={16} className="text-accent-red" />
                  <span className="font-medium">最大回撤</span>
                </div>
                <div className="text-2xl font-bold text-accent-red">
                  {summary.performance.maxDrawdown.toFixed(1)}%
                </div>
                <div className="text-sm text-text-muted">
                  {formatDate(summary.performance.maxDrawdownPeriod.from)} → {formatDate(summary.performance.maxDrawdownPeriod.to)}
                </div>
              </div>
              
              <div className="p-4 bg-bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-accent-yellow" />
                  <span className="font-medium">最长连跌</span>
                </div>
                <div className="text-2xl font-bold text-accent-yellow">
                  {summary.streaks.maxLose} 天
                </div>
              </div>
              
              <div className="p-4 bg-bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={16} className="text-accent-orange" />
                  <span className="font-medium">最高杠杆</span>
                </div>
                <div className="text-2xl font-bold text-accent-orange">
                  {summary.leverage.max.toFixed(2)}x
                </div>
                <div className="text-sm text-text-muted">
                  平均杠杆 {summary.leverage.avg.toFixed(2)}x
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* 回撤分析 */}
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-accent-yellow" />
            主要回撤期
          </h3>
          
          <div className="space-y-3">
            {summary.drawdownPeriods.map((period, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-bg-secondary/50 rounded-lg border-l-4"
                style={{ borderLeftColor: period.depth < -30 ? '#ef4444' : period.depth < -20 ? '#f59e0b' : '#eab308' }}
              >
                <div>
                  <div className="font-medium">
                    {formatDate(period.start)} → {formatDate(period.end)}
                  </div>
                  <div className="text-sm text-text-muted">
                    {period.recovery ? `${formatDate(period.recovery)} 恢复` : '尚未恢复'}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold ${period.depth < -30 ? 'text-accent-red' : 'text-accent-yellow'}`}>
                    {period.depth.toFixed(1)}%
                  </div>
                  <div className="text-xs text-text-muted">
                    {period.recovery 
                      ? `${Math.ceil((new Date(period.recovery).getTime() - new Date(period.end).getTime()) / (1000 * 60 * 60 * 24))} 天恢复`
                      : '进行中'
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 波动率分析 */}
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Activity size={20} className="text-accent-purple" />
            波动率分析
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-bg-secondary/50 rounded-lg">
              <div className="text-2xl font-bold text-accent-cyan">{summary.volatility.dailyAvg.toFixed(3)}%</div>
              <div className="text-sm text-text-muted">日均收益</div>
            </div>
            <div className="text-center p-4 bg-bg-secondary/50 rounded-lg">
              <div className="text-2xl font-bold text-accent-purple">{summary.volatility.dailyVol.toFixed(2)}%</div>
              <div className="text-sm text-text-muted">日波动率</div>
            </div>
            <div className="text-center p-4 bg-bg-secondary/50 rounded-lg">
              <div className="text-2xl font-bold text-accent-yellow">{summary.volatility.annualVol.toFixed(1)}%</div>
              <div className="text-sm text-text-muted">年化波动率</div>
            </div>
            <div className="text-center p-4 bg-bg-secondary/50 rounded-lg">
              <div className="text-2xl font-bold text-accent-green">
                {(summary.performance.ytdReturn / summary.volatility.annualVol).toFixed(2)}
              </div>
              <div className="text-sm text-text-muted">夏普比率</div>
            </div>
          </div>
        </Card>

        {/* 最好/最差的5天 */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-accent-green">
              <TrendingUp size={20} />
              最好的5天
            </h3>
            <div className="space-y-2">
              {summary.bestDays.map((day, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-bg-secondary/50 rounded-lg">
                  <div>
                    <span className="font-medium">{formatDate(day.date)}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-accent-green">{formatPercent(day.pct)}</div>
                    <div className="text-xs text-text-muted">{formatCurrency(day.amount)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-accent-red">
              <TrendingDown size={20} />
              最差的5天
            </h3>
            <div className="space-y-2">
              {summary.worstDays.map((day, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-bg-secondary/50 rounded-lg">
                  <div>
                    <span className="font-medium">{formatDate(day.date)}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-accent-red">{formatPercent(day.pct)}</div>
                    <div className="text-xs text-text-muted">{formatCurrency(Math.abs(day.amount))}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* AI 深度分析 */}
        <Card className="p-6 border-accent-cyan/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Sparkles size={20} className="text-accent-cyan" />
              AI 深度分析
            </h3>
            <Button
              onClick={generateAIAnalysis}
              disabled={aiLoading}
              className="flex items-center gap-2"
              variant={aiAnalysis ? "outline" : "default"}
            >
              {aiLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  分析中...
                </>
              ) : aiAnalysis ? (
                <>
                  <RefreshCw size={16} />
                  重新分析
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  生成 AI 深度分析
                </>
              )}
            </Button>
          </div>

          {aiError && (
            <div className="p-4 bg-accent-red/10 border border-accent-red/30 rounded-lg text-accent-red mb-4">
              {aiError}
            </div>
          )}

          {aiAnalysis ? (
            <div className="prose prose-invert max-w-none">
              <div 
                className="text-text-secondary leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ 
                  __html: aiAnalysis
                    .replace(/### /g, '<h3 class="text-lg font-bold text-text-primary mt-6 mb-3">')
                    .replace(/## /g, '<h2 class="text-xl font-bold text-accent-cyan mt-8 mb-4">')
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-text-primary">$1</strong>')
                    .replace(/\n/g, '<br/>')
                }}
              />
            </div>
          ) : !aiLoading && (
            <div className="text-center py-12 text-text-muted">
              <Brain size={48} className="mx-auto mb-4 opacity-50" />
              <p>点击上方按钮，让 AI 深度分析你的2025年投资表现</p>
              <p className="text-sm mt-2">包括：关键事件分析、教训总结、改进建议</p>
            </div>
          )}

          {aiLoading && !aiAnalysis && (
            <div className="text-center py-12">
              <Loader2 size={48} className="mx-auto mb-4 animate-spin text-accent-cyan" />
              <p className="text-text-secondary">AI 正在深度分析你的投资数据...</p>
              <p className="text-sm text-text-muted mt-2">这可能需要 30-60 秒</p>
            </div>
          )}
        </Card>

        {/* 年度反思 */}
        <Card className="p-6 border-accent-cyan/30">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Brain size={20} className="text-accent-cyan" />
            年度反思
          </h3>
          
          <div className="space-y-6 text-text-secondary">
            <div>
              <h4 className="font-medium text-text-primary mb-2 flex items-center gap-2">
                <Lightbulb size={16} className="text-accent-yellow" />
                关键洞察
              </h4>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>全年收益 <span className="text-accent-green font-bold">{formatPercent(summary.performance.ytdReturn)}</span>，但经历了 <span className="text-accent-red font-bold">{summary.performance.maxDrawdown.toFixed(1)}%</span> 的最大回撤</li>
                <li>Q1 和 Q3 表现优异，Q2 和 Q4 出现较大回撤</li>
                <li>年化波动率 <span className="text-accent-yellow font-bold">{summary.volatility.annualVol.toFixed(1)}%</span>，属于高波动策略</li>
                <li>胜率 <span className="text-accent-purple font-bold">{summary.volatility.winRate.toFixed(1)}%</span>，略高于50%</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-text-primary mb-2 flex items-center gap-2">
                <BookOpen size={16} className="text-accent-purple" />
                需要改进
              </h4>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>回撤控制：{summary.drawdownPeriods.length} 次超过10%的回撤，需要更严格的止损纪律</li>
                <li>杠杆管理：最高杠杆达到 {summary.leverage.max.toFixed(2)}x，在高波动市场中风险较大</li>
                <li>连续亏损：最长连跌 {summary.streaks.maxLose} 天，需要在连续亏损时降低仓位</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-text-primary mb-2 flex items-center gap-2">
                <Target size={16} className="text-accent-green" />
                2026 目标
              </h4>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>将最大回撤控制在 25% 以内</li>
                <li>保持杠杆在 1.5x 以下</li>
                <li>提高夏普比率至 1.5 以上</li>
                <li>建立更系统的风控机制</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center py-8 text-text-muted text-sm">
          <p>数据统计周期：{summary.period.start} ~ {summary.period.end}</p>
          <p className="mt-2">投资有风险，过往业绩不代表未来表现</p>
        </div>
      </main>
    </div>
  );
}
