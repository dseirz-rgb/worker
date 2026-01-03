
import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw, Server, Globe, Mail, Database } from 'lucide-react';
import { Button } from '../ui';
import { getSupabaseClient } from '../../services/supabase';

type ServiceStatus = 'checking' | 'healthy' | 'error' | 'warning';

interface ServiceHealth {
  id: string;
  name: string;
  icon: React.ElementType;
  status: ServiceStatus;
  latency?: number;
  message?: string;
}

export function ApiStatus() {
  const [services, setServices] = useState<ServiceHealth[]>([
    { id: 'supabase', name: 'Supabase 数据库', icon: Database, status: 'checking' },
    { id: 'ai', name: 'AI 智能服务', icon: Server, status: 'checking' },
    { id: 'email', name: '邮件通知服务', icon: Mail, status: 'checking' },
    { id: 'market', name: '实时行情接口', icon: Globe, status: 'checking' },
  ]);

  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    checkAllServices();
  }, []);

  const updateService = (id: string, updates: Partial<ServiceHealth>) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const checkAllServices = async () => {
    setIsChecking(true);
    // 重置状态
    setServices(prev => prev.map(s => ({ ...s, status: 'checking', latency: undefined, message: undefined })));

    const checks = [
      checkSupabase(),
      checkAiService(),
      checkEmailService(),
      checkMarketService()
    ];

    await Promise.all(checks);
    setIsChecking(false);
  };

  // 1. 检查 Supabase
  const checkSupabase = async () => {
    const start = performance.now();
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('未配置 Supabase');
      
      // 使用核心表 dashboard_snapshots 进行健康检查，而不是 user_profiles
      // 这样更可靠，且 dashboard_snapshots 表肯定存在
      const { error } = await supabase.from('dashboard_snapshots').select('count', { count: 'exact', head: true });
      if (error) throw error;

      updateService('supabase', { status: 'healthy', latency: Math.round(performance.now() - start) });
    } catch (e) {
      updateService('supabase', { status: 'error', message: (e as Error).message });
    }
  };

  // 2. 检查 AI 服务 (Gemini Proxy)
  const checkAiService = async () => {
    const start = performance.now();
    try {
      // 发送一个极简的请求
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Ping' }] }],
            generationConfig: { maxOutputTokens: 1 }
        })
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // 只要能通就行，不一定要读流
      await res.body?.cancel();

      updateService('ai', { status: 'healthy', latency: Math.round(performance.now() - start) });
    } catch (e) {
      updateService('ai', { status: 'error', message: '服务不可用' });
    }
  };

  // 3. 检查邮件服务
  const checkEmailService = async () => {
    const start = performance.now();
    try {
      // 仅仅检查 endpoint 是否存在，发一个错误的 method 看看是否返回 405 (说明服务在)
      // 或者发一个空包看是否返回 400
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // 缺少参数
      });
      
      if (res.status === 400) {
         updateService('email', { status: 'healthy', latency: Math.round(performance.now() - start) });
      } else if (res.status === 404) {
         throw new Error('API 未部署');
      } else {
         // 其他状态也算通，比如 500 (配置错误但服务在)
         updateService('email', { status: 'warning', latency: Math.round(performance.now() - start), message: `HTTP ${res.status}` });
      }
    } catch (e) {
      updateService('email', { status: 'error', message: '连接失败' });
    }
  };

  // 4. 检查行情接口
  const checkMarketService = async () => {
    const start = performance.now();
    try {
      // 检查腾讯接口 (通过代理)
      const res = await fetch('/api/tencent/sh000001');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text.includes('v_sh000001')) throw new Error('响应格式错误');

      updateService('market', { status: 'healthy', latency: Math.round(performance.now() - start) });
    } catch (e) {
      updateService('market', { status: 'error', message: '接口异常' });
    }
  };

  return (
    <div className="p-4 bg-bg-tertiary rounded-lg border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
          <Server size={16} />
          API 健康监控
        </h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={checkAllServices} 
          disabled={isChecking}
          className="h-8 w-8 p-0"
        >
          <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {services.map(service => (
          <div 
            key={service.id} 
            className={`
              flex items-center justify-between p-3 rounded-md border transition-all
              ${service.status === 'checking' ? 'bg-bg-secondary border-border' : ''}
              ${service.status === 'healthy' ? 'bg-accent-green/5 border-accent-green/20' : ''}
              ${service.status === 'warning' ? 'bg-accent-yellow/5 border-accent-yellow/20' : ''}
              ${service.status === 'error' ? 'bg-accent-red/5 border-accent-red/20' : ''}
            `}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-full ${
                 service.status === 'healthy' ? 'bg-accent-green/10 text-accent-green' : 
                 service.status === 'error' ? 'bg-accent-red/10 text-accent-red' :
                 'bg-bg-primary text-text-muted'
              }`}>
                <service.icon size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-text-primary">{service.name}</span>
                {service.status === 'checking' && <span className="text-[10px] text-text-muted">检测中...</span>}
                {service.message && <span className="text-[10px] text-accent-red">{service.message}</span>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {service.latency !== undefined && (
                <span className={`text-[10px] font-mono ${service.latency > 1000 ? 'text-accent-yellow' : 'text-text-secondary'}`}>
                  {service.latency}ms
                </span>
              )}
              {service.status === 'checking' && <Loader2 size={14} className="animate-spin text-text-muted" />}
              {service.status === 'healthy' && <CheckCircle size={14} className="text-accent-green" />}
              {service.status === 'warning' && <AlertTriangle size={14} className="text-accent-yellow" />}
              {service.status === 'error' && <XCircle size={14} className="text-accent-red" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
