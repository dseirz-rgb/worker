import React, { useEffect, useState } from 'react';
import { Modal, Button, NumberDisplay } from '../ui';
import { StyledMarkdown } from '../ui/StyledMarkdown';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, BrainCircuit, Loader2, FileText, BarChart2, RefreshCw, Trash2, Shield, Globe, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import type { PortfolioState } from '../../types';
import { aiService } from '../../services/aiService';
import { getClient } from '../../services/supabaseData';
import ReactMarkdown from 'react-markdown';

interface DailyBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioState: PortfolioState | null;
}

type ViewMode = 'BASIC' | 'FULL_REPORT';

// Agent Insight Types
interface AgentInsights {
  summary: string;
  positionInsights?: { summary: string; keyChanges: string[] };
  riskInsights?: { summary: string; riskLevel: string; warnings: string[] };
  marketInsights?: { summary: string; headlines: string[] };
  recommendation?: { summary: string; actions: string[] };
}

// Agent Insight Card Component
function AgentInsightCard({ 
  title, 
  icon, 
  color, 
  summary, 
  details 
}: { 
  title: string; 
  icon: React.ReactNode; 
  color: string; 
  summary: string; 
  details?: string[] 
}) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className={`bg-bg-tertiary/50 rounded-lg border border-border-primary/50 overflow-hidden`}>
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-start gap-3 text-left hover:bg-bg-tertiary/80 transition-colors"
      >
        <div className={`p-1.5 rounded-lg ${color}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-text-secondary mb-1">{title}</div>
          <p className="text-sm text-text-primary line-clamp-2">{summary}</p>
        </div>
        {details && details.length > 0 && (
          <div className="text-text-tertiary">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        )}
      </button>
      
      {expanded && details && details.length > 0 && (
        <div className="px-3 pb-3 pt-0 border-t border-border-primary/30">
          <ul className="space-y-1 mt-2">
            {details.map((item, i) => (
              <li key={i} className="text-xs text-text-secondary flex items-start gap-2">
                <span className="text-accent-cyan mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function DailyBriefingModal({ isOpen, onClose, portfolioState }: DailyBriefingModalProps) {
  const [insight, setInsight] = useState('');
  const [agentInsights, setAgentInsights] = useState<AgentInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('BASIC');
  const [fullReport, setFullReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [useAgentMode, setUseAgentMode] = useState(true); // Toggle for agent insights
  
  // Report Center States
  const [reportList, setReportList] = useState<any[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<number | 'LIVE'>('LIVE');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
        if (portfolioState && !insight) generateInsight();
        fetchReportList();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedReportId === 'LIVE') {
        setViewMode('BASIC');
        setFullReport(null);
    } else {
        setViewMode('FULL_REPORT');
        fetchFullReport(selectedReportId);
    }
  }, [selectedReportId]);

  const fetchReportList = async () => {
      try {
          const supabase = getClient();
          if (!supabase) return;
          // Temporarily remove risk_level from select if migration isn't applied, 
          // or handle error gracefully. 
          // Since we pushed the migration, it should work.
          // However, to be safe against cached schema or delay:
          const { data, error } = await supabase
            .from('ai_analyses')
            .select('id, created_at, title, risk_level')
            .order('created_at', { ascending: false })
            .limit(20);
          
          if (error) {
               // Fallback if risk_level column is missing
               if (error.code === '42703') {
                   console.warn("risk_level column missing, fetching without it");
                   const { data: fallbackData } = await supabase
                    .from('ai_analyses')
                    .select('id, created_at, title')
                    .order('created_at', { ascending: false })
                    .limit(20);
                   setReportList(fallbackData || []);
                   return;
               }
               throw error;
          }
          setReportList(data || []);
      } catch (e) {
          console.error('Failed to fetch report list:', e);
      }
  };

  const handleGenerateReport = async () => {
      setGenerating(true);
      try {
          if (!portfolioState) return;
          
          // Call the new service method to generate a full risk report
          await aiService.generateRiskReport(portfolioState, portfolioState.positions || []);
          
          // Refresh the list to show the new report
          await fetchReportList();
          
          // Auto-select the newest report
          if (reportList.length > 0) {
              // Note: reportList might be stale due to closure? 
              // Actually fetchReportList updates state, but we might not see it immediately here.
              // Let's rely on the user clicking or next render, OR fetch again to be sure.
              // Better: fetchReportList updates state. We can force select the first one in the next effect or just assume ID.
              // For simplicity, let's just refresh. The user will see the new item at the top.
              
              // To be user-friendly, let's switch to the new report immediately if we can get its ID.
              // But generateRiskReport returns the inserted data!
          }
      } catch (e) {
          console.error("Failed to generate report", e);
      } finally {
          setGenerating(false);
      }
  };

  const handleDeleteReport = async (e: React.MouseEvent, id: number) => {
      e.stopPropagation(); // Prevent selecting the report when deleting
      if (!confirm('确定要删除这份研报吗？')) return;
      
      try {
          const supabase = getClient();
          if (!supabase) return;
          
          const { error } = await supabase
            .from('ai_analyses')
            .delete()
            .eq('id', id);
            
          if (error) throw error;
          
          // Remove from local list
          setReportList(prev => prev.filter(r => r.id !== id));
          
          // If deleted report was selected, switch to Live
          if (selectedReportId === id) {
              setSelectedReportId('LIVE');
          }
      } catch (e) {
          console.error("Failed to delete report", e);
      }
  };

  const generateInsight = async () => {
    setLoading(true);
    try {
        const today = new Date().toDateString();
        const cachedKey = `daily_insight_${today}`;
        const cachedAgentKey = `daily_agent_insight_${today}`;
        
        // Check cache first
        const cachedInsight = localStorage.getItem(cachedKey);
        const cachedAgentInsight = localStorage.getItem(cachedAgentKey);

        if (cachedInsight) {
            setInsight(cachedInsight);
            if (cachedAgentInsight) {
                try {
                    setAgentInsights(JSON.parse(cachedAgentInsight));
                } catch (e) {
                    console.warn('Failed to parse cached agent insights');
                }
            }
            setLoading(false);
            return;
        }

        // Try agent-based insights first if enabled
        if (useAgentMode && portfolioState) {
            try {
                const agentResult = await aiService.generateDailyInsightWithAgents(portfolioState);
                setAgentInsights(agentResult);
                setInsight(agentResult.summary);
                localStorage.setItem(cachedKey, agentResult.summary);
                localStorage.setItem(cachedAgentKey, JSON.stringify(agentResult));
                setLoading(false);
                return;
            } catch (e) {
                console.warn('Agent insights failed, falling back to simple insight:', e);
            }
        }

        // Fallback to simple insight
        const text = await aiService.generateDailyInsight();
        setInsight(text);
        localStorage.setItem(cachedKey, text);

    } catch (e) {
        console.error(e);
        setInsight("市场波动是常态，保持冷静，坚守原则。");
    } finally {
        setLoading(false);
    }
  };

  const fetchFullReport = async (id: number) => {
      setReportLoading(true);
      try {
          const supabase = getClient();
          if (!supabase) throw new Error('Supabase client not available');

          const { data, error } = await supabase
            .from('ai_analyses')
            .select('*')
            .eq('id', id)
            .single();
            
          if (error) throw error;
          setFullReport(data);
      } catch (e) {
          console.error('Failed to fetch full report:', e);
      } finally {
          setReportLoading(false);
      }
  };

  if (!portfolioState) return null;

  const { dailyPnL, dailyPnLPercent, totalNetWorthCNY, alerts } = portfolioState;
  
  const criticalAlerts = alerts.filter(a => !a.acknowledged && a.severity === 'CRITICAL');
  const highAlerts = alerts.filter(a => !a.acknowledged && a.severity === 'WARNING');
  const topRisk = criticalAlerts.length > 0 ? criticalAlerts[0] : (highAlerts.length > 0 ? highAlerts[0] : null);

  const isPositive = dailyPnL >= 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="每日晨报 (Daily Briefing)" size="xl">
      <div className="flex flex-col md:flex-row h-[80vh] md:h-[600px] gap-2 md:gap-4">
        {/* Sidebar - 移动端隐藏或折叠 */}
        <div className="hidden md:block md:w-1/4 border-r border-border-primary pr-2 overflow-y-auto space-y-2">
            <button
                onClick={() => setSelectedReportId('LIVE')}
                className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                    selectedReportId === 'LIVE' 
                    ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30' 
                    : 'hover:bg-bg-tertiary text-text-secondary'
                }`}
            >
                <div className="font-bold flex items-center gap-2">
                    <Sparkles size={14} />
                    今日实时 (Live)
                </div>
                <div className="text-xs opacity-70 mt-1">基于当前持仓快照</div>
            </button>
            
            {/* Prominent Generate Button */}
            <button
                onClick={handleGenerateReport}
                disabled={generating}
                className="w-full mt-2 flex items-center justify-center gap-2 p-2 rounded-lg text-sm font-bold transition-all
                    bg-gradient-to-r from-accent-purple/20 to-accent-cyan/20 
                    hover:from-accent-purple/30 hover:to-accent-cyan/30
                    border border-accent-purple/30 text-text-primary shadow-sm group"
            >
                {generating ? (
                    <>
                        <Loader2 size={14} className="animate-spin text-accent-cyan" />
                        <span className="text-xs">生成中...</span>
                    </>
                ) : (
                    <>
                        <BrainCircuit size={14} className="text-accent-purple group-hover:scale-110 transition-transform" />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-accent-purple to-accent-cyan">
                            生成最新研报
                        </span>
                    </>
                )}
            </button>
            
            <div className="flex items-center justify-between mt-4 mb-2 px-2">
                <div className="text-xs text-text-tertiary uppercase tracking-wider font-bold">历史研报</div>
                <button 
                    onClick={fetchReportList} 
                    className="text-text-tertiary hover:text-text-secondary transition-colors p-1 rounded-md"
                    title="刷新列表"
                >
                    <RefreshCw size={12} />
                </button>
            </div>
            
            {reportList.map(report => (
                <div key={report.id} className="group relative flex items-stretch rounded-lg border border-transparent hover:bg-bg-tertiary transition-colors mb-1">
                    <button
                        onClick={() => setSelectedReportId(report.id)}
                        className={`flex-1 text-left p-3 text-sm rounded-l-lg ${
                            selectedReportId === report.id
                            ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30 rounded-r-lg border-r-transparent' // If selected, style the button
                            : 'text-text-secondary'
                        }`}
                    >
                        <div className="font-bold truncate pr-2">{new Date(report.created_at).toLocaleDateString()}</div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                report.risk_level === 'HIGH' || report.risk_level === 'CRITICAL' ? 'bg-accent-red/20 text-accent-red' :
                                report.risk_level === 'LOW' ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-yellow/20 text-accent-yellow'
                            }`}>
                                {report.risk_level || 'N/A'}
                            </span>
                            <span className="text-[10px] text-text-muted truncate flex-1">{report.title}</span>
                        </div>
                    </button>
                    
                    <button 
                        onClick={(e) => handleDeleteReport(e, report.id)}
                        className={`p-2 flex items-center justify-center text-text-tertiary hover:text-accent-red hover:bg-accent-red/10 transition-all rounded-r-lg
                            ${selectedReportId === report.id ? 'bg-accent-purple/20 border-t border-b border-r border-accent-purple/30' : ''}
                        `}
                        title="删除"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            ))}
        </div>

        {/* Main Content - 移动端全宽 */}
        <div className="w-full md:w-3/4 flex flex-col space-y-2 md:space-y-4 overflow-y-auto pr-0 md:pr-2">
        
        {/* 移动端研报选择器 - 紧凑版 */}
        <div className="md:hidden flex items-center gap-1.5 px-2 py-1 bg-bg-secondary/50 rounded border border-border-primary/50">
          <select
            value={selectedReportId === 'LIVE' ? 'LIVE' : String(selectedReportId)}
            onChange={(e) => setSelectedReportId(e.target.value === 'LIVE' ? 'LIVE' : Number(e.target.value))}
            className="flex-1 bg-transparent border-none text-xs text-text-primary py-0.5"
          >
            <option value="LIVE">📊 实时</option>
            {reportList.map(r => (
              <option key={r.id} value={r.id}>
                {new Date(r.created_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="px-2 py-0.5 bg-accent-purple/20 text-accent-purple rounded text-xs"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : '+'}
          </button>
        </div>
        
        {/* Top Header (Only for Live Mode, Archive has its own header) - 移动端精简 */}
        {selectedReportId === 'LIVE' && (
        <div className="hidden sm:flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-accent-cyan/10 to-transparent p-4 rounded-xl border border-accent-cyan/20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-cyan/20 rounded-full">
              <Sparkles className="text-accent-cyan w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-text-primary">早安，投资者！</h3>
              <p className="text-sm text-text-secondary">新的一天，保持清醒，理性决策。</p>
            </div>
          </div>
        </div>
        )}

        {viewMode === 'BASIC' ? (
            // === BASIC MODE (Original) ===
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                <div className="bg-bg-secondary p-3 md:p-4 rounded-xl border border-border-primary">
                    <h4 className="text-xs md:text-sm font-bold text-text-secondary mb-2 md:mb-3 flex items-center gap-2">
                    {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    今日表现
                    </h4>
                    <div className="flex flex-col gap-1">
                    <div className="text-xl md:text-2xl font-bold font-mono flex items-baseline gap-2">
                        <NumberDisplay 
                            value={dailyPnL} 
                            prefix="¥" 
                            colorize 
                            decimals={2}
                        />
                        <span className={`text-xs md:text-sm ${isPositive ? 'text-accent-green' : 'text-accent-red'}`}>
                            ({dailyPnLPercent >= 0 ? '+' : ''}{dailyPnLPercent.toFixed(2)}%)
                        </span>
                    </div>
                    <div className="text-[10px] md:text-xs text-text-muted mt-1">
                        净值: ¥{totalNetWorthCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                    </div>
                    </div>
                </div>

                <div className={`p-3 md:p-4 rounded-xl border ${topRisk ? 'bg-accent-red/5 border-accent-red/20' : 'bg-accent-green/5 border-accent-green/20'}`}>
                    <h4 className="text-xs md:text-sm font-bold text-text-secondary mb-2 md:mb-3 flex items-center gap-2">
                    <AlertTriangle size={14} className={topRisk ? 'text-accent-red' : 'text-accent-green'} />
                    风险监控
                    </h4>
                    {topRisk ? (
                    <div>
                        <div className="text-accent-red font-bold text-xs md:text-sm mb-1">{topRisk.title}</div>
                        <p className="text-[10px] md:text-xs text-text-secondary line-clamp-2">{topRisk.message}</p>
                    </div>
                    ) : (
                    <div className="flex flex-col items-center justify-center h-full py-1 md:py-2">
                        <span className="text-accent-green font-bold text-xs md:text-sm">暂无重大风险</span>
                        <span className="text-[10px] md:text-xs text-text-muted">风控系统正常</span>
                    </div>
                    )}
                </div>
                </div>

                <div className="bg-bg-tertiary p-3 md:p-4 rounded-xl border border-border-primary relative overflow-hidden min-h-[80px] md:min-h-[100px]">
                <BrainCircuit className="absolute top-2 right-2 text-accent-purple/20 w-8 h-8 md:w-12 md:h-12" />
                <h4 className="text-[10px] md:text-xs font-bold text-accent-purple uppercase tracking-wider mb-1 md:mb-2 flex items-center gap-2">
                    <Sparkles size={10} />
                    AI 每日洞察
                </h4>
                
                {loading ? (
                    <div className="flex items-center gap-2 text-text-secondary text-xs md:text-sm py-2">
                        <Loader2 className="animate-spin w-3 h-3 md:w-4 md:h-4" />
                        <span>AI 分析中...</span>
                    </div>
                ) : (
                    <blockquote className="text-xs md:text-sm text-text-primary italic font-serif leading-relaxed pl-2 md:pl-3 border-l-2 border-accent-purple animate-in fade-in">
                        "{insight}"
                    </blockquote>
                )}
                </div>
                
                {/* Agent-specific insights (when available) */}
                {agentInsights && !loading && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] md:text-xs font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
                        <BrainCircuit size={10} />
                        智能体分析详情
                      </h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {agentInsights.positionInsights && (
                        <AgentInsightCard
                          title="持仓分析"
                          icon={<BarChart2 size={14} />}
                          color="bg-cyan-500/20 text-cyan-400"
                          summary={agentInsights.positionInsights.summary}
                          details={agentInsights.positionInsights.keyChanges}
                        />
                      )}
                      
                      {agentInsights.riskInsights && (
                        <AgentInsightCard
                          title="风险评估"
                          icon={<Shield size={14} />}
                          color={
                            agentInsights.riskInsights.riskLevel === 'high' 
                              ? 'bg-red-500/20 text-red-400'
                              : agentInsights.riskInsights.riskLevel === 'low'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-amber-500/20 text-amber-400'
                          }
                          summary={agentInsights.riskInsights.summary}
                          details={agentInsights.riskInsights.warnings}
                        />
                      )}
                      
                      {agentInsights.marketInsights && (
                        <AgentInsightCard
                          title="市场分析"
                          icon={<Globe size={14} />}
                          color="bg-emerald-500/20 text-emerald-400"
                          summary={agentInsights.marketInsights.summary}
                          details={agentInsights.marketInsights.headlines}
                        />
                      )}
                      
                      {agentInsights.recommendation && (
                        <AgentInsightCard
                          title="投资建议"
                          icon={<Lightbulb size={14} />}
                          color="bg-purple-500/20 text-purple-400"
                          summary={agentInsights.recommendation.summary}
                          details={agentInsights.recommendation.actions}
                        />
                      )}
                    </div>
                  </div>
                )}
            </>
        ) : (
            // === FULL REPORT MODE (New) ===
            <div className="bg-bg-secondary border border-border-primary rounded-xl overflow-hidden min-h-[400px] flex flex-col">
                {reportLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-text-secondary py-12">
                        <Loader2 className="animate-spin w-8 h-8 mb-4 text-accent-cyan" />
                        <p>正在加载 AI 深度研报...</p>
                    </div>
                ) : fullReport ? (
                    <div className="flex flex-col h-full">
                        {/* 1. Header Hero - 移动端紧凑版 */}
                        <div className="bg-bg-tertiary/50 p-2 md:p-4 border-b border-border-primary">
                            {/* 移动端：单行紧凑布局 */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] md:text-xs font-bold ${
                                    fullReport.risk_level === 'HIGH' || fullReport.risk_level === 'CRITICAL' 
                                        ? 'bg-accent-red/20 text-accent-red' 
                                        : fullReport.risk_level === 'LOW' 
                                            ? 'bg-accent-green/20 text-accent-green'
                                            : 'bg-accent-yellow/20 text-accent-yellow'
                                }`}>
                                    {fullReport.risk_level}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] md:text-xs font-bold ${
                                    fullReport.recommendation === 'BUY' 
                                        ? 'bg-accent-green/20 text-accent-green' 
                                        : fullReport.recommendation === 'SELL' 
                                            ? 'bg-accent-red/20 text-accent-red'
                                            : 'bg-accent-yellow/20 text-accent-yellow'
                                }`}>
                                    {fullReport.recommendation}
                                </span>
                                <span className="text-[10px] text-text-tertiary ml-auto">
                                    {new Date(fullReport.created_at).toLocaleDateString('zh-CN')}
                                </span>
                                <button 
                                    onClick={(e) => handleDeleteReport(e, fullReport.id)}
                                    className="p-1 text-text-tertiary hover:text-accent-red"
                                    title="删除"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            
                            {/* Action Plan - 移动端更紧凑 */}
                            {fullReport.content.match(/<!--ACTION_PLAN:(.*?)-->/)?.[1] && (
                                <div className="mt-2 p-2 bg-accent-yellow/5 border-l-2 border-accent-yellow rounded text-xs text-accent-yellow">
                                    {fullReport.content.match(/<!--ACTION_PLAN:(.*?)-->/)[1]}
                                </div>
                            )}
                            
                            <h2 className="font-bold text-sm md:text-lg text-text-primary mt-2 line-clamp-2">{fullReport.title}</h2>
                        </div>

                        {/* 2. Content Body */}
                        <div className="p-3 md:p-6 overflow-y-auto flex-1">
                            <div className="bg-accent-cyan/5 p-2 md:p-4 rounded-lg border-l-2 md:border-l-4 border-accent-cyan mb-4 md:mb-8 text-text-secondary italic text-xs md:text-sm">
                                "{fullReport.summary}"
                            </div>
                            <StyledMarkdown 
                                content={fullReport.content.replace(/<!--RISK_LEVEL:.*?-->\n?/, '').replace(/<!--ACTION_PLAN:.*?-->\n?/, '')} 
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-text-muted py-12">
                        <FileText className="w-12 h-12 mb-4 opacity-20" />
                        <p>今日暂无深度研报生成。</p>
                        <p className="text-xs mt-2 opacity-60">通常在每日 10:00 后生成。</p>
                    </div>
                )}
            </div>
        )}

        <div className="flex justify-end pt-2 md:pt-4 border-t border-border-primary">
          <Button onClick={onClose} variant="primary" className="w-full md:w-auto text-sm">
            {viewMode === 'BASIC' ? '开启今日交易' : '关闭研报'}
          </Button>
        </div>
      </div>
      </div>
    </Modal>
  );
}
