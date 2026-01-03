
import React, { useState, useEffect } from 'react';
import { getClient } from '../../services/supabaseData';
import { useSupabasePortfolio } from '../../hooks/useSupabasePortfolio';
import { Button } from '../ui/button';
import { Card, Badge, NumberDisplay } from '../ui'; // Reuse existing UI components
import { Loader2, Sparkles, TrendingUp, TrendingDown, Clock, BrainCircuit, Shield, AlertTriangle, FileText, CheckCircle, X, Trash2, Mail } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { z } from "zod";
import { getMarketResearchHtml } from '../../utils/emailTemplates';
import { marked } from 'marked';

// 定义强类型的输出结构
const analysisSchema = z.object({
  title: z.string().optional().describe("研报标题"),
  risk_level: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().describe("当前投资组合的整体风险等级"),
  summary: z.string().optional().describe("简短的分析摘要 (100字以内)"),
  content: z.string().optional().describe("详细的深度分析内容，使用 Markdown 格式，分点阐述"),
  recommendation: z.string().optional().describe("BUY, SELL, HOLD, REBALANCE, or WARNING"),
  primary_ticker: z.string().optional().describe("相关代码或 PORTFOLIO")
});

import { aiService, parseJSONStream } from '../../services/aiService';

// ... (existing imports)

export default function AIAnalysisDashboard() {
  const supabase = getClient();
  const { dashboard, riskMetrics, stockPositions, refresh, history, watchlist } = useSupabasePortfolio();
  const [isGenerating, setIsGenerating] = useState(false);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialNetWorth, setInitialNetWorth] = useState(1000000);
  const [selectedModel, setSelectedModel] = useState<'flash' | 'pro'>('flash');
  const [streamingContent, setStreamingContent] = useState<string>('');

  async function fetchAnalyses() {
    if (!supabase) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ai_analyses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      setAnalyses(data || []);
    } catch (e) {
      console.error('Fetch analyses error:', e);
      toast.error('加载历史研报失败');
    } finally {
      setLoading(false);
    }
  }

  async function deleteAnalysis(id: number) {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('ai_analyses').delete().eq('id', id);
      if (error) throw error;
      setAnalyses(prev => prev.filter(a => a.id !== id));
      toast.success('研报已删除');
    } catch (e) {
      toast.error('删除失败');
    }
  }

  useEffect(() => {
    fetchAnalyses();
  }, [supabase]);

  async function generateAnalysis() {
    // 1. 基础校验
    if (!supabase || isGenerating) return;
    
    // 2. 强制刷新数据 (确保获取到最新的 dashboard 和 positions)
    if (!dashboard || !stockPositions) {
        toast.info('正在同步最新资产数据，请稍后...');
        await refresh(); 
        return; 
    }

    setIsGenerating(true);
    setStreamingContent(''); // Reset streaming content

    try {
        // Use the shared service method, now with watchlist for research-decision integration
        await aiService.generateRiskReport(
            dashboard, 
            stockPositions, 
            (chunk) => {
                // Since generateRiskReport might return raw JSON chunks or partial text depending on implementation,
                // and we want to show the 'content' field primarily.
                // The shared service accumulates raw text. 
                // We can parse it here similarly or just let the service handle it.
                // However, the service currently just passes raw chunk.
                // We need to accumulate locally to parse 'content' for the preview.
                
                // For simplicity in this refactor, we will just set the raw chunk to streaming content
                // OR we can reimplement the "extract content" logic here if we want the "Matrix" effect.
                // Given the service passes raw chunks of the full JSON, we should probably append and try to extract.
                setStreamingContent(prev => {
                    const newVal = prev + chunk;
                    // Try to extract content field
                    // Simple regex for "content": "..."
                    // This is a bit hacky for streaming JSON but visually better than raw JSON
                    const contentMatch = newVal.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)/);
                    if (contentMatch) {
                        return contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                    }
                    return newVal; // Fallback to raw if not found yet
                });
            },
            watchlist // Pass watchlist for research-decision integration
        );

        toast.success('研报生成成功');
        fetchAnalyses();

    } catch (e) {
        console.error('API Call Failed:', e);
        toast.error('生成失败: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
        setIsGenerating(false);
        setStreamingContent('');
    }
  }


  // 发送每日简报邮件
  async function sendDailyBriefing() {
    if (analyses.length === 0) {
        toast.error('暂无研报可发送，请先生成一份');
        return;
    }
    
    // 获取当前用户邮箱，如果获取失败则使用默认邮箱
    let targetEmail = 'dseirz@gmail.com'; // 默认邮箱
    try {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          targetEmail = user.email;
        }
      }
    } catch (error) {
      console.warn('[Email] Failed to get user email, using default:', error);
    }

    // 取最新的一份
    const latestAnalysis = analyses[0];
    const isSendingToast = toast.loading(`正在发送每日简报至 ${targetEmail}...`);

    try {
        const rawContent = latestAnalysis.content;
        const cleanContent = rawContent.replace(/<!--RISK_LEVEL:.*?-->\n?/, '');
        const htmlAnalysis = marked.parse(cleanContent) as string;
        const riskLevel = rawContent.match(/<!--RISK_LEVEL:(.*?)-->/)?.[1] || 'MEDIUM';

        // Prepare Top Positions data if available in snapshot
        let topPositions = [];
        if (latestAnalysis.portfolio_snapshot?.positions) {
            topPositions = latestAnalysis.portfolio_snapshot.positions.slice(0, 5).map((p: any) => ({
                ticker: p.ticker || p.代码 || 'UNKNOWN',
                weight: (p.weight_percent || p.weight || 0) / 100, // Assuming stored as 15.5 for 15.5%
                pnl: (p.unrealized_pnl_percent || p.盈亏 || 0) / 100
            }));
        }

        // 从分析内容中提取 action_plan
        const actionPlanMatch = latestAnalysis.content?.match(/行动计划[：:]\s*([^\n]+)/);
        const actionPlan = actionPlanMatch ? actionPlanMatch[1] : latestAnalysis.action_plan || '';

        const htmlContent = getMarketResearchHtml({
            date: new Date(latestAnalysis.created_at).toLocaleDateString(),
            analysisTitle: latestAnalysis.title,
            analysisSummary: latestAnalysis.summary || '无摘要',
            analysisContent: htmlAnalysis,
            riskLevel: riskLevel,
            recommendation: latestAnalysis.recommendation,
            actionPlan: actionPlan
        });

        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: targetEmail,
                subject: `[RiskControl] 深度市场研报 - ${new Date().toLocaleDateString()}`,
                content: htmlContent
            })
        });

        if (response.ok) {
            toast.success(`每日简报已发送至 ${targetEmail}`);
        } else {
            throw new Error('发送失败');
        }
    } catch (e) {
        toast.error('发送失败，请检查网络或服务器日志');
        console.error(e);
    } finally {
        toast.dismiss(isSendingToast);
    }
  }

    return (
        <div className="flex flex-col h-full bg-bg-primary overflow-hidden">
            {/* Header Area - 移动端优化 */}
            <div className="flex-none p-3 md:p-6 border-b border-border bg-bg-secondary">
                {/* 标题行 */}
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base md:text-xl font-bold flex items-center gap-2 text-text-primary">
                        <Sparkles className="text-accent-cyan w-4 h-4 md:w-5 md:h-5" />
                        <span className="hidden sm:inline">智能研报生成</span>
                        <span className="sm:hidden">AI研报</span>
                    </h2>
                    {/* 移动端：删除按钮移到这里 */}
                    <div className="flex items-center gap-2 md:hidden">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={sendDailyBriefing}
                            className="px-2 border-accent-cyan/20 text-accent-cyan"
                        >
                            <Mail size={14} />
                        </Button>
                        <Button 
                            size="sm"
                            onClick={generateAnalysis} 
                            disabled={isGenerating}
                            className="bg-accent-cyan text-bg-primary px-3"
                        >
                            {isGenerating ? <Loader2 className="animate-spin w-4 h-4" /> : <BrainCircuit className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
                
                {/* 移动端：模型选择器单独一行，更紧凑 */}
                <div className="flex items-center justify-between gap-2 md:hidden">
                    <div className="flex items-center gap-1 px-2 py-1 bg-bg-primary/50 border border-border-primary rounded text-[10px]">
                        <button
                            onClick={() => setSelectedModel('flash')}
                            className={`px-2 py-0.5 rounded transition-colors ${
                                selectedModel === 'flash' 
                                    ? 'bg-accent-cyan text-bg-primary font-semibold' 
                                    : 'text-text-secondary'
                            }`}
                        >
                            ⚡ Flash
                        </button>
                        <button
                            onClick={() => setSelectedModel('pro')}
                            className={`px-2 py-0.5 rounded transition-colors ${
                                selectedModel === 'pro' 
                                    ? 'bg-accent-purple text-bg-primary font-semibold' 
                                    : 'text-text-secondary'
                            }`}
                        >
                            🧠 Pro
                        </button>
                    </div>
                    <p className="text-[10px] text-text-muted truncate">
                        Gemini 3.0 AI分析
                    </p>
                </div>

                {/* 桌面端：原有布局 */}
                <div className="hidden md:flex md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-text-secondary">
                        基于 Gemini 3.0 的AI分析，为您提供专业的投资组合诊断。
                    </p>
                    <div className="flex items-center gap-3">
                        {/* Model Selection Toggle */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-primary/50 border border-border-primary rounded-lg">
                            <span className="text-xs text-text-tertiary">模型:</span>
                            <button
                                onClick={() => setSelectedModel('flash')}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                    selectedModel === 'flash' 
                                        ? 'bg-accent-cyan text-bg-primary font-semibold' 
                                        : 'text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                ⚡ Flash (快速)
                            </button>
                            <button
                                onClick={() => setSelectedModel('pro')}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                    selectedModel === 'pro' 
                                        ? 'bg-accent-purple text-bg-primary font-semibold' 
                                        : 'text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                🧠 Pro (深度)
                            </button>
                        </div>
                        <Button
                            variant="outline"
                            onClick={sendDailyBriefing}
                            className="gap-2 border-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/10"
                        >
                            <Mail size={16} />
                            发送每日简报
                        </Button>
                        <Button 
                            onClick={generateAnalysis} 
                            disabled={isGenerating}
                            className="bg-accent-cyan text-bg-primary hover:bg-accent-cyan/90 font-bold shadow-lg shadow-accent-cyan/20 transition-all hover:scale-105"
                        >
                            {isGenerating ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <BrainCircuit className="mr-2 w-4 h-4" />}
                            {isGenerating ? '正在深度思考...' : '生成今日研报'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6 scrollbar-hide">
                {/* Streaming Preview */}
                {isGenerating && streamingContent && (
                    <div className="bg-bg-secondary border border-accent-cyan/30 rounded-xl overflow-hidden shadow-2xl animate-pulse-soft">
                        <div className="bg-accent-cyan/10 p-4 border-b border-accent-cyan/30 flex items-center gap-2">
                            <Loader2 className="animate-spin text-accent-cyan" size={16} />
                            <span className="text-sm font-semibold text-accent-cyan">正在生成中...</span>
                        </div>
                        <div className="p-6">
                            <article className="prose prose-invert prose-sm max-w-none 
                                text-gray-200 leading-relaxed
                                [&>h1]:text-accent-cyan [&>h1]:font-bold [&>h1]:mb-6 [&>h1]:mt-8 [&>h1]:pb-2 [&>h1]:border-b [&>h1]:border-border
                                [&>h2]:text-accent-cyan/90 [&>h2]:font-bold [&>h2]:mb-4 [&>h2]:mt-8
                                [&>h3]:text-accent-cyan/80 [&>h3]:font-semibold [&>h3]:mb-3 [&>h3]:mt-6
                                [&>p>strong]:text-accent-yellow [&>p>strong]:font-bold
                                [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-2
                                [&>p]:mb-4 [&>p]:text-[15px]
                            ">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {streamingContent}
                                </ReactMarkdown>
                            </article>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="animate-spin text-accent-cyan" /></div>
                ) : analyses.length === 0 && !isGenerating ? (
                    <div className="text-center py-12 bg-bg-secondary rounded-xl border border-border-primary">
                        <p className="text-text-tertiary">暂无研报，点击上方按钮开始第一次分析</p>
                    </div>
                ) : (
                    analyses.map(analysis => {
                        // 解析存储在 content 中的 Risk Level 和 Summary
                        const riskMatch = analysis.content.match(/<!--RISK_LEVEL:(.*?)-->/);
                        const riskLevel = riskMatch ? riskMatch[1] : 'MEDIUM'; // 默认
                        const cleanContent = analysis.content.replace(/<!--RISK_LEVEL:.*?-->\n/, '');
                        
                        return (
                        <div key={analysis.id} className="relative">
                            {/* Report Card */}
                            <div className="bg-bg-secondary border border-border-primary rounded-xl overflow-hidden shadow-2xl">
                                {/* 1. Header Section */}
                                <div className="bg-bg-tertiary/50 p-4 md:p-6 border-b border-border-primary flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Shield className="text-accent-cyan" size={18} />
                                            <span className="font-bold text-base md:text-lg tracking-wide text-text-primary">RISKCONTROL</span>
                                            <span className="text-xs text-text-tertiary border-l border-text-tertiary pl-2 ml-2">AI 深度诊断</span>
                                        </div>
                                        <div className="text-[10px] md:text-xs text-text-muted flex items-center gap-2">
                                            <Clock size={12} />
                                            生成: {new Date(analysis.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                                        <Badge variant="default" className="font-mono text-xs bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20">{analysis.primary_ticker}</Badge>
                                        <button 
                                            onClick={() => deleteAnalysis(analysis.id)}
                                            className="p-1.5 text-text-tertiary hover:text-accent-red hover:bg-accent-red/10 rounded-md transition-colors"
                                            title="删除研报"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* 2. Risk Level Banner - 移动端更紧凑 */}
                                <div className="p-3 md:p-6 pb-0">
                                    <div className={`rounded-lg border p-3 md:p-6 text-center transition-colors ${
                                        riskLevel === 'HIGH' || riskLevel === 'CRITICAL' ? 'bg-accent-red/10 border-accent-red/30' :
                                        riskLevel === 'LOW' ? 'bg-accent-green/10 border-accent-green/30' :
                                        'bg-accent-yellow/10 border-accent-yellow/30'
                                    }`}>
                                        <div className="flex items-center justify-center gap-2 md:flex-col md:gap-1">
                                            <div className="text-[10px] md:text-xs text-text-secondary uppercase tracking-wider md:mb-2">风险等级</div>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2.5 h-2.5 md:w-4 md:h-4 rounded-full ${
                                                    riskLevel === 'HIGH' || riskLevel === 'CRITICAL' ? 'bg-accent-red animate-pulse' :
                                                    riskLevel === 'LOW' ? 'bg-accent-green' :
                                                    'bg-accent-yellow'
                                                }`} />
                                                <span className={`text-lg md:text-3xl font-bold ${
                                                    riskLevel === 'HIGH' || riskLevel === 'CRITICAL' ? 'text-accent-red' :
                                                    riskLevel === 'LOW' ? 'text-accent-green' :
                                                    'text-accent-yellow'
                                                }`}>
                                                    {riskLevel === 'CRITICAL' ? '极高' :
                                                     riskLevel === 'HIGH' ? '高风险' :
                                                     riskLevel === 'LOW' ? '低风险' : '中等'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
                                    {/* 3. Core Metrics (Left Column on Desktop, Top on Mobile) */}
                                    <div className="lg:col-span-1 space-y-3 md:space-y-4">
                                        <h4 className="flex items-center gap-2 font-bold text-text-primary text-xs md:text-base">
                                            <FileText size={14} className="text-accent-purple md:w-4 md:h-4" />
                                            核心指标快照
                                        </h4>
                                        <SnapshotCard 
                                            snapshot={analysis.portfolio_snapshot} 
                                            recommendation={analysis.recommendation}
                                            initialNetWorth={initialNetWorth}
                                        />
                                    </div>

                                    {/* 4. Analysis Content (Right Column on Desktop, Bottom on Mobile) */}
                                    <div className="lg:col-span-2">
                                        <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-2">
                                            <h4 className="flex items-center gap-2 font-bold text-text-primary text-sm md:text-base">
                                                <BrainCircuit size={16} className="text-accent-cyan" />
                                                深度分析报告
                                            </h4>
                                            {/* Review Status Badge */}
                                            <div className="flex flex-row md:flex-col gap-2 flex-wrap">
                                                <ReviewBadge label="7D" status={analysis.review_status_7d} returnVal={analysis.review_return_7d} />
                                                <ReviewBadge label="30D" status={analysis.review_status_30d} returnVal={analysis.review_return_30d} />
                                                <ReviewBadge label="90D" status={analysis.review_status_90d} returnVal={analysis.review_return_90d} />
                                            </div>
                                        </div>
                                        <article className="prose prose-invert prose-sm max-w-none 
                                            text-gray-200 leading-relaxed
                                            [&>h1]:text-accent-cyan [&>h1]:font-bold [&>h1]:mb-6 [&>h1]:mt-8 [&>h1]:pb-2 [&>h1]:border-b [&>h1]:border-border
                                            [&>h2]:text-accent-cyan/90 [&>h2]:font-bold [&>h2]:mb-4 [&>h2]:mt-8 [&>h2]:flex [&>h2]:items-center [&>h2]:gap-2 [&>h2]:before:content-['#'] [&>h2]:before:text-accent-cyan/50
                                            [&>h3]:text-accent-cyan/80 [&>h3]:font-semibold [&>h3]:mb-3 [&>h3]:mt-6
                                            [&>p>strong]:text-accent-yellow [&>p>strong]:font-bold
                                            [&>li>strong]:text-accent-yellow [&>li>strong]:font-bold
                                            [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-2 [&>ul]:my-4 [&>ul]:text-text-secondary
                                            [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:space-y-2 [&>ol]:my-4 [&>ol]:text-text-secondary
                                            [&>li]:leading-relaxed
                                            [&>blockquote]:border-l-4 [&>blockquote]:border-accent-cyan/50 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-text-muted [&>blockquote]:bg-bg-tertiary/30 [&>blockquote]:py-2 [&>blockquote]:pr-4 [&>blockquote]:rounded-r [&>blockquote]:my-6
                                            [&>pre]:bg-[#1e1e1e] [&>pre]:p-4 [&>pre]:rounded-lg [&>pre]:border [&>pre]:border-border [&>pre]:my-6 [&>pre]:overflow-x-auto [&>pre]:text-sm
                                            [&>code]:text-accent-yellow [&>code]:bg-white/10 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:font-mono [&>code]:text-xs
                                            [&>p]:mb-6 last:[&>p]:mb-0 [&>p]:text-[15px] [&>p]:tracking-wide [&>p]:text-text-primary/90
                                            [&>img]:rounded-xl [&>img]:border [&>img]:border-border [&>img]:my-8 [&>img]:shadow-lg
                                            [&>a]:text-accent-blue [&>a]:hover:underline [&>a]:decoration-accent-blue/50 [&>a]:underline-offset-4
                                        ">
                                            <ReactMarkdown 
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    // Only overriding components that need special logic not covered by prose
                                                    // For now, let prose handle most styling for consistency
                                                }}
                                            >
                                                {cleanContent}
                                            </ReactMarkdown>
                                        </article>
                                    </div>
                                </div>
                            </div>
                        </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function SnapshotCard({ snapshot, recommendation, initialNetWorth = 1000000 }: { snapshot: any, recommendation: string, initialNetWorth?: number }) {
    // 1. 安全解析数据
    let data: any = {};
    try {
        data = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
    } catch (e) {
        console.error("Snapshot parse failed", e);
    }

    // 2. 智能获取净值 (遍历所有可能的字段名)
    // 优先级：net_worth_cny > totalNetWorth > netWorth > 总净值
    const netWorthAmount = 
        data.net_worth_cny ?? 
        data.totalNetWorth ?? 
        data.netWorth ?? 
        data.总净值 ?? 
        0;

    // 计算归一化净值
    const netWorthValue = initialNetWorth > 0 ? Number(netWorthAmount) / initialNetWorth : 1.0;

    // 3. 智能获取风险指标
    const riskMetrics = data.riskMetrics || data.风险指标 || {};
    const volatility = riskMetrics.annualized_volatility ?? riskMetrics.volatility ?? 0;

    // 4. 智能获取持仓列表
    const positions = data.positions || data.持仓 || [];

    // 5. 辅助函数：智能格式化百分比
    const formatPercent = (val: any) => {
        if (val === undefined || val === null) return '0.0%';
        if (typeof val === 'string') return val.includes('%') ? val : `${parseFloat(val).toFixed(1)}%`;
        
        const num = Number(val);
        if (isNaN(num)) return '0.0%';
        
        // 关键逻辑：如果绝对值大于 1.5 (假设没有单只股票占比超过 150%)，
        // 且不是极小值，则认为已经是百分数，不再乘以 100
        // 例如：15.5 -> 15.5%
        // 例如：0.155 -> 15.5%
        if (Math.abs(num) > 1.5) {
            return `${num.toFixed(1)}%`;
        } else {
            return `${(num * 100).toFixed(1)}%`;
        }
    };

    return (
        <Card className="bg-bg-primary/50 space-y-4">
            <div>
                <div className="text-xs text-text-muted mb-1">当时净值</div>
                <div className="text-xl font-bold text-text-primary mono-nums">
                    {netWorthValue.toFixed(4)}
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="text-xs text-text-muted mb-1">建议操作</div>
                    <div className={`text-lg font-bold ${
                        recommendation === 'BUY' ? 'text-accent-green' :
                        recommendation === 'SELL' ? 'text-accent-red' :
                        'text-accent-yellow'
                    }`}>
                        {recommendation}
                    </div>
                </div>
                <div>
                    <div className="text-xs text-text-muted mb-1">当时波动率</div>
                    <div className="text-lg font-bold text-text-secondary mono-nums">
                        {volatility ? formatPercent(volatility) : '-'}
                    </div>
                </div>
            </div>

            {/* 持仓快照表格 */}
            {positions.length > 0 && (
                <div className="pt-4 border-t border-border-primary/50">
                    <div className="text-xs text-text-muted mb-2">前三大持仓快照</div>
                    <div className="space-y-2">
                        {positions.slice(0, 3).map((pos: any, idx: number) => {
                            const ticker = pos.ticker || pos.代码 || pos.code || 'UNKNOWN';
                            
                            // 尝试获取权重
                            const weight = pos.weight_percent ?? pos.weight ?? pos.权重 ?? 0;
                            
                            // 尝试获取盈亏 (注意：unrealized_pnl_percent 可能是 0，所以不能用 ||)
                            const pnl = pos.unrealized_pnl_percent ?? pos.unrealizedPnLPercent ?? pos.盈亏 ?? 0;
                            
                            const pnlNum = parseFloat(String(pnl).replace('%', ''));
                            const isPositive = pnlNum >= 0;

                            return (
                                <div key={idx} className="flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="default" className="h-5 px-1 font-mono text-[10px] border border-border-primary/50">{ticker}</Badge>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-text-secondary mono-nums">
                                            {formatPercent(weight)}
                                        </span>
                                        <span className={`mono-nums font-medium ${
                                            isPositive ? 'text-accent-green' : 'text-accent-red'
                                        }`}>
                                            {formatPercent(pnl)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                        {positions.length > 3 && (
                            <div className="text-[10px] text-text-tertiary text-center mt-1">
                                + 其他 {positions.length - 3} 个持仓
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
}

function ReviewBadge({ label, status, returnVal }: { label: string, status: string, returnVal?: number }) {
    if (status === 'SUCCESS') {
        return (
            <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-mono border bg-accent-green/10 text-accent-green border-accent-green/30`}>
                <CheckCircle size={12} />
                {label}: 准确 {(returnVal || 0) > 0 ? '+' : ''}{(returnVal || 0).toFixed(2)}%
            </div>
        );
    }
    if (status === 'FAIL') {
        return (
            <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-mono border bg-accent-red/10 text-accent-red border-accent-red/30`}>
                <X size={12} />
                {label}: 误判 {(returnVal || 0) > 0 ? '+' : ''}{(returnVal || 0).toFixed(2)}%
            </div>
        );
    }
    
    return (
        <div className="flex items-center gap-1 text-[10px] text-text-tertiary bg-bg-tertiary px-2 py-1 rounded-md opacity-50 border border-border-primary">
            <Clock size={12} /> {label} 待验证
        </div>
    );
}
