import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { 
  LineChart,
  Brain, 
  Menu, 
  X,
  Shield,
  ChevronDown,
  Gauge,
  ShieldCheck,
  Settings as SettingsIcon,
  Home,
  Sparkles,
  TrendingUp,
  Activity,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Settings } from '@/components/settings/Settings';
import { useSupabasePortfolio } from '@/hooks/useSupabasePortfolio';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children?: { label: string; path: string; icon: React.ComponentType<{ size?: number; className?: string }>; description?: string }[];
}

const NAV_ITEMS: NavItem[] = [
  { label: '首页', path: '/', icon: Home },
  { label: '决策引擎', path: '/decision', icon: Brain },
  { label: '投资组合', path: '/portfolio', icon: LineChart },
  { 
    label: '风控中心', 
    path: '/dashboard', 
    icon: Shield,
    children: [
      { label: '仪表板', path: '/dashboard', icon: Gauge, description: '持仓概览与日常操作' },
      { label: '风控引擎', path: '/risk-engine', icon: ShieldCheck, description: 'AI 风险预测与熔断管理' },
      { label: '市场行情', path: '/market-view', icon: TrendingUp, description: '实时行情与市场数据' },
    ]
  },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { settings, updateSettings } = useSupabasePortfolio();

  // 判断当前页面是否需要全屏无滚动模式（App Mode）
  const isAppMode = location.startsWith('/chat') || location.startsWith('/decision') || location.startsWith('/knowledge');
  
  // 判断是否是首页（首页有自己的布局）
  const isHomePage = location === '/';

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 检查是否是风控相关页面
  const isRiskPage = (path: string) => {
    return path === '/dashboard' || path === '/risk-engine' || path === '/market-view' || 
           // 旧路由兼容
           path === '/risk-center' || path === '/risk-settings' || path === '/intelligent-risk' || path === '/market-analysis';
  };

  // 首页使用独立布局
  if (isHomePage) {
    return <>{children}</>;
  }

  return (
    <div className="h-screen w-full bg-[#0a0b0f] flex flex-col overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="flex-none sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#0a0b0f]/95 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0a0b0f]/80 pt-safe transition-[padding] duration-200">
        <div className="container flex h-14 items-center px-4 max-w-7xl mx-auto">
          {/* Logo */}
          <div 
            className="flex items-center gap-3 mr-8 cursor-pointer group"
            onClick={() => setLocation('/')}
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-shadow">
                <Shield size={18} className="text-white" />
              </div>
              {/* 光环效果 */}
              <div className="absolute inset-0 rounded-xl bg-cyan-400/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="font-bold text-base tracking-wide hidden md:inline-block">
              <span className="text-white">RISK</span>
              <span className="text-cyan-400">CONTROL</span>
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1" ref={dropdownRef}>
            {NAV_ITEMS.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const isActive = hasChildren 
                ? isRiskPage(location)
                : (location === item.path || location.startsWith(item.path + '/'));
              const isDropdownOpen = openDropdown === item.label;

              if (hasChildren) {
                return (
                  <div key={item.path} className="relative">
                    <button
                      onClick={() => setOpenDropdown(isDropdownOpen ? null : item.label)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                        isActive 
                          ? "bg-cyan-500/10 text-cyan-400" 
                          : "text-white/60 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <item.icon size={16} />
                      <span>{item.label}</span>
                      <ChevronDown 
                        size={14} 
                        className={cn(
                          "transition-transform duration-200",
                          isDropdownOpen && "rotate-180"
                        )} 
                      />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                      <div className="absolute top-full left-0 mt-2 w-60 bg-[#12141a] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                        {/* 顶部装饰线 */}
                        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                        
                        {item.children!.map((child) => {
                          const isChildActive = location === child.path;
                          return (
                            <button
                              key={child.path}
                              onClick={() => {
                                setLocation(child.path);
                                setOpenDropdown(null);
                              }}
                              className={cn(
                                "w-full flex items-start gap-3 px-4 py-3 text-left transition-all duration-200",
                                isChildActive 
                                  ? "bg-cyan-500/10 text-cyan-400" 
                                  : "text-white/60 hover:bg-white/5 hover:text-white"
                              )}
                            >
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                                isChildActive ? "bg-cyan-500/20" : "bg-white/5"
                              )}>
                                <child.icon size={16} />
                              </div>
                              <div>
                                <div className="text-sm font-medium">{child.label}</div>
                                {child.description && (
                                  <div className="text-xs text-white/40 mt-0.5">{child.description}</div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive 
                      ? "bg-cyan-500/10 text-cyan-400" 
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                >
                  <item.icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="ml-auto flex items-center gap-3">
            {/* AI 状态指示 */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
              <Sparkles size={14} className="text-purple-400" />
              <span className="text-xs text-purple-400 font-medium">AI 在线</span>
            </div>
            
            {settings && <Settings settings={settings} onUpdate={updateSettings} />}
            
            {/* Mobile Menu Toggle */}
            <button 
              className="md:hidden p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.06] bg-[#0a0b0f] p-4 space-y-2 animate-in slide-in-from-top-2">
            {NAV_ITEMS.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const isActive = hasChildren 
                ? isRiskPage(location)
                : (location === item.path || location.startsWith(item.path + '/'));

              if (hasChildren) {
                return (
                  <div key={item.path} className="space-y-1">
                    <div
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium",
                        isActive 
                          ? "bg-cyan-500/10 text-cyan-400" 
                          : "text-white/60"
                      )}
                    >
                      <item.icon size={18} />
                      <span>{item.label}</span>
                    </div>
                    <div className="ml-6 space-y-1 border-l border-white/[0.08] pl-4">
                      {item.children!.map((child) => {
                        const isChildActive = location === child.path;
                        return (
                          <button
                            key={child.path}
                            onClick={() => {
                              setLocation(child.path);
                              setIsMobileMenuOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors",
                              isChildActive 
                                ? "bg-cyan-500/10 text-cyan-400 font-medium" 
                                : "text-white/50 hover:bg-white/5 hover:text-white"
                            )}
                          >
                            <child.icon size={16} />
                            <span>{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={item.path}
                  onClick={() => {
                    setLocation(item.path);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-cyan-500/10 text-cyan-400" 
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className={cn(
        "flex-1 min-h-0 w-full max-w-7xl mx-auto px-4 py-6 animate-in fade-in duration-500 flex flex-col relative",
        isAppMode ? "p-0 max-w-none px-0 py-0" : ""
      )}>
        <div className={cn(
          "flex-1 h-full min-h-0",
          isAppMode ? "overflow-hidden" : "overflow-y-auto pr-1"
        )}>
            {children}
        </div>
      </main>
    </div>
  );
}
