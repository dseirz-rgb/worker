import React from 'react';
import { Route, Switch, Redirect } from "wouter";
import { Shield } from 'lucide-react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MarketProvider } from "@/contexts/MarketContext";
import InvestmentMirror from "./pages/InvestmentMirror";
import UserProfile from "./pages/UserProfile";
import DecisionCenter from "./pages/DecisionCenter";
import Portfolio from "./pages/Portfolio";
import Home from "./pages/Home";
import VoiceCall from "./pages/VoiceCall";
import { PasswordProtection } from "./components/auth/PasswordProtection";
import { RiskControlDashboard } from "./pages/RiskControlDashboard";
import AnnualReview2025 from "./pages/AnnualReview2025";
import RiskCenter from "./pages/RiskCenter";
import RiskSettings from "./pages/RiskSettings";
import AgentDemo from "./pages/AgentDemo";
import IntelligentRisk from "./pages/IntelligentRisk";
import MarketAnalysis from "./pages/MarketAnalysis";
import RiskEngine from "./pages/RiskEngine";

import MainLayout from "@/components/layout/MainLayout";

function App() {
  // 检查环境变量是否配置
  const hasSupabaseKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!hasSupabaseKey) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-lg max-w-md text-center">
          <Shield size={48} className="mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-bold text-red-400 mb-2">配置错误：缺少 Supabase Key</h1>
          <p className="text-sm text-gray-300 mb-4">
            未检测到 VITE_SUPABASE_ANON_KEY 环境变量。
            <br />
            请检查本地 .env 文件是否已正确保存并重启服务器。
          </p>
          <div className="text-xs bg-black/50 p-2 rounded text-left overflow-x-auto">
            <code>VITE_SUPABASE_ANON_KEY=...</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <MarketProvider>
            <Toaster />
            <MainLayout>
              <Switch>
                {/* 首页 - 新设计的落地页 */}
                <Route path="/" component={Home} />
                
                {/* 统一使用 /dashboard 路由 */}
                <Route path="/dashboard">
                  <PasswordProtection>
                    <RiskControlDashboard />
                  </PasswordProtection>
                </Route>
                
                <Route path="/portfolio" component={Portfolio} />
                
                <Route path="/decision" component={DecisionCenter} />

                <Route path="/chat" component={DecisionCenter} />
                
                <Route path="/chat/:id">
                  {(params) => (
                      <InvestmentMirror />
                  )}
                </Route>
                
                {/* 统一使用 /knowledge 路由 */}
                <Route path="/knowledge" component={DecisionCenter} />
                <Route path="/notes" component={DecisionCenter} />
                
                <Route path="/profile" component={UserProfile} />
                
                {/* 年度回顾 */}
                <Route path="/review/2025" component={AnnualReview2025} />
                
                {/* 旧风控中心 - 重定向到风控引擎 */}
                <Route path="/risk-center">
                  <Redirect to="/risk-engine" />
                </Route>
                
                {/* 旧风控设置 - 重定向到风控引擎配置 Tab */}
                <Route path="/risk-settings">
                  <Redirect to="/risk-engine?tab=config" />
                </Route>
                
                {/* 风控引擎 - 新统一页面 */}
                <Route path="/risk-engine">
                  <PasswordProtection>
                    <RiskEngine />
                  </PasswordProtection>
                </Route>
                
                {/* 市场行情 - 重命名路由 */}
                <Route path="/market-view">
                  <PasswordProtection>
                    <MarketAnalysis />
                  </PasswordProtection>
                </Route>
                
                {/* 旧路由重定向 */}
                <Route path="/intelligent-risk">
                  <Redirect to="/risk-engine" />
                </Route>
                
                <Route path="/market-analysis">
                  <Redirect to="/market-view" />
                </Route>
                
                {/* 多 Agent 分析演示 */}
                <Route path="/agent-demo">
                  <PasswordProtection>
                    <AgentDemo />
                  </PasswordProtection>
                </Route>
                
                {/* 语音通话 */}
                <Route path="/voice-call" component={VoiceCall} />
                
                <Route component={Portfolio} />
              </Switch>
            </MainLayout>
          </MarketProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
