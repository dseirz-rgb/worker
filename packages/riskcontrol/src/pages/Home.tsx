import React from 'react';
import { useLocation } from 'wouter';
import { 
  Shield, 
  TrendingUp, 
  Brain, 
  LineChart, 
  ArrowRight,
  Sparkles,
  Activity,
  Lock,
  ChevronRight,
  Phone
} from 'lucide-react';
import { useSupabasePortfolio } from '@/hooks/useSupabasePortfolio';
import { useRiskMetrics } from '@/hooks/useRiskMetrics';
import { RiskStatusSummary } from '@/components/dashboard/RiskStatusSummary';
import { cn } from '@/lib/utils';

// 功能卡片组件
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  gradient: string;
  delay?: number;
}

function FeatureCard({ icon, title, description, href, gradient, delay = 0 }: FeatureCardProps) {
  const [, setLocation] = useLocation();
  
  return (
    <button
      onClick={() => setLocation(href)}
      className={cn(
        "group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-500",
        "bg-gradient-to-br from-white/[0.03] to-white/[0.01]",
        "border border-white/[0.06] hover:border-white/[0.12]",
        "hover:shadow-2xl hover:shadow-cyan-500/10",
        "hover:-translate-y-1",
        "animate-in fade-in slide-in-from-bottom-4"
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      {/* 背景光效 */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
        gradient
      )} />
      
      {/* 内容 */}
      <div className="relative z-10">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
          "bg-gradient-to-br from-white/10 to-white/5",
          "group-hover:scale-110 transition-transform duration-300"
        )}>
          {icon}
        </div>
        
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          {title}
          <ChevronRight 
            size={16} 
            className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" 
          />
        </h3>
        
        <p className="text-sm text-white/60 leading-relaxed">
          {description}
        </p>
      </div>
      
      {/* 角落装饰 */}
      <div className="absolute top-0 right-0 w-20 h-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute top-4 right-4 w-1 h-8 bg-gradient-to-b from-cyan-400/50 to-transparent rounded-full" />
        <div className="absolute top-4 right-4 w-8 h-1 bg-gradient-to-r from-cyan-400/50 to-transparent rounded-full" />
      </div>
    </button>
  );
}

// 状态指示器
function StatusIndicator({ status, label }: { status: 'safe' | 'warning' | 'danger'; label: string }) {
  const colors = {
    safe: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500'
  };
  
  return (
    <div className="flex items-center gap-2">
      <span className={cn("w-2 h-2 rounded-full animate-pulse", colors[status])} />
      <span className="text-xs text-white/50 uppercase tracking-wider">{label}</span>
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { dashboard, loading } = useSupabasePortfolio();
  const { metrics: riskMetrics, loading: riskLoading } = useRiskMetrics();
  
  // 计算关键指标
  const leverage = dashboard?.leverage_ratio ? Number(dashboard.leverage_ratio) : 1;
  const dailyPnL = dashboard?.daily_pnl_percent ? Number(dashboard.daily_pnl_percent) : 0;
  
  // 风险状态
  const riskStatus = leverage > 2 ? 'danger' : leverage > 1.5 ? 'warning' : 'safe';

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white overflow-hidden">
      {/* 背景效果 */}
      <div className="fixed inset-0 pointer-events-none">
        {/* 网格背景 */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />
        
        {/* 渐变光晕 */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
        
        {/* 扫描线效果 */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute w-full h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent"
            style={{
              animation: 'scan 8s linear infinite',
              top: '0%'
            }}
          />
        </div>
      </div>

      {/* 主内容 */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        
        {/* Hero 区域 */}
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-6 duration-700">
          {/* Logo */}
          <div className="inline-flex items-center justify-center mb-8">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-2xl shadow-cyan-500/30">
                <Shield size={40} className="text-white" />
              </div>
              {/* 光环效果 */}
              <div className="absolute inset-0 rounded-2xl bg-cyan-400/20 blur-xl animate-pulse" />
            </div>
          </div>
          
          {/* 标题 */}
          <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight">
            <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
              RISK
            </span>
            <span className="bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent">
              CONTROL
            </span>
          </h1>
          
          <p className="text-lg text-white/50 max-w-xl mx-auto leading-relaxed">
            智能投资风控系统 · 实时监控 · AI 驱动决策
          </p>
          
          {/* 状态指示 */}
          <div className="flex items-center justify-center gap-6 mt-6">
            <StatusIndicator status={riskStatus} label="风控状态" />
            <StatusIndicator status="safe" label="系统运行" />
          </div>
        </div>

        {/* 核心指标卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {/* 净值卡片 */}
          <div 
            className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: '100ms', animationFillMode: 'both' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp size={20} className="text-emerald-400" />
              </div>
              <span className={cn(
                "text-xs font-medium px-2 py-1 rounded-full",
                dailyPnL >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
              )}>
                {dailyPnL >= 0 ? '+' : ''}{dailyPnL.toFixed(2)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {loading ? (
                <span className="text-white/30">加载中...</span>
              ) : (
                <span className={cn(
                  "tabular-nums",
                  dailyPnL >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {dailyPnL >= 0 ? '+' : ''}{dailyPnL.toFixed(2)}%
                </span>
              )}
            </div>
            <div className="text-sm text-white/40">今日净值</div>
          </div>

          {/* 杠杆卡片 */}
          <div 
            className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: '200ms', animationFillMode: 'both' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                leverage > 2 ? "bg-red-500/20" : leverage > 1.5 ? "bg-amber-500/20" : "bg-cyan-500/20"
              )}>
                <Activity size={20} className={
                  leverage > 2 ? "text-red-400" : leverage > 1.5 ? "text-amber-400" : "text-cyan-400"
                } />
              </div>
              <span className={cn(
                "text-xs font-medium px-2 py-1 rounded-full",
                leverage > 2 ? "bg-red-500/20 text-red-400" : 
                leverage > 1.5 ? "bg-amber-500/20 text-amber-400" : 
                "bg-cyan-500/20 text-cyan-400"
              )}>
                {leverage > 2 ? '高风险' : leverage > 1.5 ? '中风险' : '安全'}
              </span>
            </div>
            <div className="text-2xl font-bold text-white mb-1 tabular-nums">
              {loading ? (
                <span className="text-white/30">--</span>
              ) : (
                <>{leverage.toFixed(2)}<span className="text-sm font-normal text-white/50 ml-1">x</span></>
              )}
            </div>
            <div className="text-sm text-white/40">当前杠杆</div>
          </div>

          {/* AI 状态卡片 */}
          <div 
            className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: '300ms', animationFillMode: 'both' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Sparkles size={20} className="text-purple-400" />
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">
                在线
              </span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              AI 顾问
            </div>
            <div className="text-sm text-white/40">智能分析就绪</div>
          </div>
        </div>

        {/* 风控状态摘要 - Task 11.1 */}
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '350ms', animationFillMode: 'both' }}>
          <RiskStatusSummary metrics={riskMetrics} loading={riskLoading} />
        </div>

        {/* 功能入口 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          <FeatureCard
            icon={<Brain size={24} className="text-purple-400" />}
            title="决策引擎"
            description="AI 驱动的投资分析，研报解读与智能问答"
            href="/decision"
            gradient="bg-gradient-to-br from-purple-500/10 to-transparent"
            delay={400}
          />
          
          <FeatureCard
            icon={<LineChart size={24} className="text-cyan-400" />}
            title="投资组合"
            description="实时持仓监控，业绩分析与交易记录"
            href="/portfolio"
            gradient="bg-gradient-to-br from-cyan-500/10 to-transparent"
            delay={500}
          />
          
          <FeatureCard
            icon={<Shield size={24} className="text-emerald-400" />}
            title="风控中心"
            description="风险指标监控，熔断机制与 AI 风控分析"
            href="/risk-center"
            gradient="bg-gradient-to-br from-emerald-500/10 to-transparent"
            delay={600}
          />
        </div>

        {/* 快速操作 */}
        <div 
          className="flex flex-wrap items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: '700ms', animationFillMode: 'both' }}
        >
          <button
            onClick={() => setLocation('/portfolio')}
            className={cn(
              "group flex items-center gap-3 px-6 py-3 rounded-full",
              "bg-gradient-to-r from-cyan-500 to-cyan-400",
              "text-black font-semibold text-sm",
              "hover:shadow-lg hover:shadow-cyan-500/30",
              "transition-all duration-300 hover:-translate-y-0.5"
            )}
          >
            <span>进入系统</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button
            onClick={() => setLocation('/voice-call')}
            className={cn(
              "group flex items-center gap-3 px-6 py-3 rounded-full",
              "bg-gradient-to-r from-emerald-500 to-emerald-400",
              "text-black font-semibold text-sm",
              "hover:shadow-lg hover:shadow-emerald-500/30",
              "transition-all duration-300 hover:-translate-y-0.5"
            )}
          >
            <Phone size={16} />
            <span>语音通话</span>
          </button>
          
          <button
            onClick={() => setLocation('/risk-center')}
            className={cn(
              "flex items-center gap-3 px-6 py-3 rounded-full",
              "bg-white/5 border border-white/10",
              "text-white/80 font-medium text-sm",
              "hover:bg-white/10 hover:border-white/20",
              "transition-all duration-300"
            )}
          >
            <Lock size={14} />
            <span>风控检查</span>
          </button>
        </div>

        {/* 底部信息 */}
        <div className="mt-16 text-center text-white/30 text-xs">
          <p>RISKCONTROL © 2024-2026 · 智能投资风控系统</p>
        </div>
      </div>

      {/* 扫描线动画样式 */}
      <style>{`
        @keyframes scan {
          0% { top: -10%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 110%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
