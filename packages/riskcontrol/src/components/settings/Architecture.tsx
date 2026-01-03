import React from 'react';
import { 
  Database, 
  Cloud, 
  Cpu, 
  Globe, 
  Smartphone, 
  Mail,
  Brain,
  Eye,
  Shield,
  BookOpen,
  TrendingUp,
  Layers,
  Server,
  Zap
} from 'lucide-react';

export function Architecture() {
  return (
    <div className="space-y-6 text-sm max-h-[60vh] overflow-y-auto pr-2">
      {/* 系统概述 */}
      <section>
        <h3 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Layers size={18} className="text-accent-cyan" />
          系统概述
        </h3>
        <p className="text-text-secondary leading-relaxed">
          RiskControl 是一套<span className="text-accent-cyan">个人化投资辅助与风险管理平台</span>，
          集成了信息采集、知识内化、情绪监控、决策辅助的闭环系统。
        </p>
        <div className="mt-3 p-3 bg-bg-secondary rounded-lg border border-border">
          <p className="text-text-muted text-xs">
            <span className="text-accent-yellow">核心哲学：</span>
            通过标准化流程（输入 → 清洗 → 内化 → 决策），降低投资中的情绪干扰，提高决策胜率。
          </p>
        </div>
      </section>

      {/* 三大功能模块 */}
      <section>
        <h3 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Zap size={18} className="text-accent-yellow" />
          功能模块
        </h3>
        
        <div className="space-y-3">
          {/* 智能情报局 */}
          <div className="p-3 bg-bg-secondary rounded-lg border border-accent-blue/30">
            <div className="flex items-center gap-2 mb-2">
              <Eye size={16} className="text-accent-blue" />
              <span className="font-medium text-text-primary">智能情报局 (Input Layer)</span>
            </div>
            <ul className="text-text-secondary text-xs space-y-1 ml-6">
              <li>• 微信文章导入 - iOS 快捷指令 + Jina Reader</li>
              <li>• 群聊精华提炼 - Gemini AI 清洗聊天记录</li>
              <li>• 非结构化数据清洗 - 网页转 Markdown</li>
            </ul>
          </div>

          {/* 投资第二大脑 */}
          <div className="p-3 bg-bg-secondary rounded-lg border border-accent-purple/30">
            <div className="flex items-center gap-2 mb-2">
              <Brain size={16} className="text-accent-purple" />
              <span className="font-medium text-text-primary">投资第二大脑 (Knowledge Layer)</span>
            </div>
            <ul className="text-text-secondary text-xs space-y-1 ml-6">
              <li>• RAG 知识库 - 向量化存储 + AI 问答</li>
              <li>• 投资笔记 - 四象限管理 + 专题聚合</li>
              <li>• LightRAG 服务 - 图谱增强检索</li>
            </ul>
          </div>

          {/* 投资镜子 */}
          <div className="p-3 bg-bg-secondary rounded-lg border border-accent-green/30">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={16} className="text-accent-green" />
              <span className="font-medium text-text-primary">投资镜子 (Decision Layer)</span>
            </div>
            <ul className="text-text-secondary text-xs space-y-1 ml-6">
              <li>• AI 每日风控日报 - 自动分析 + 邮件推送</li>
              <li>• 杠杆模拟器 - 实时 What-If 分析</li>
              <li>• 熔断机制 - 季节性风险 + 冷静期</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 技术栈 */}
      <section>
        <h3 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Server size={18} className="text-accent-green" />
          技术架构
        </h3>
        
        <div className="grid grid-cols-2 gap-2">
          <TechCard 
            icon={<Globe size={14} />}
            name="前端"
            tech="React 19 + Vite 7"
            color="cyan"
          />
          <TechCard 
            icon={<Cloud size={14} />}
            name="托管"
            tech="Vercel Edge"
            color="blue"
          />
          <TechCard 
            icon={<Database size={14} />}
            name="数据库"
            tech="Supabase + pgvector"
            color="green"
          />
          <TechCard 
            icon={<Cpu size={14} />}
            name="AI 模型"
            tech="Gemini 3 Pro Preview"
            color="purple"
          />
          <TechCard 
            icon={<Eye size={14} />}
            name="数据清洗"
            tech="Jina Reader API"
            color="yellow"
          />
          <TechCard 
            icon={<Mail size={14} />}
            name="邮件"
            tech="Resend"
            color="red"
          />
          <TechCard 
            icon={<Smartphone size={14} />}
            name="移动端"
            tech="iOS Shortcuts"
            color="cyan"
          />
          <TechCard 
            icon={<TrendingUp size={14} />}
            name="数据源"
            tech="IBKR Flex Query"
            color="green"
          />
        </div>
      </section>

      {/* API 清单 */}
      <section>
        <h3 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Globe size={18} className="text-accent-red" />
          API 清单
        </h3>
        
        <div className="space-y-2">
          <ApiItem 
            name="Google Gemini API"
            endpoint="generativelanguage.googleapis.com"
            usage="AI 对话、日报生成、群聊清洗"
            models={["gemini-3-pro-preview", "gemini-1.5-flash", "text-embedding-004"]}
          />
          <ApiItem 
            name="Supabase"
            endpoint="*.supabase.co"
            usage="PostgreSQL 数据库 + pgvector 向量存储 + Auth"
          />
          <ApiItem 
            name="IBKR Flex Query"
            endpoint="gdcdyn.interactivebrokers.com"
            usage="盈透证券账户数据同步（持仓、交易、净值）"
          />
          <ApiItem 
            name="Jina Reader"
            endpoint="r.jina.ai"
            usage="网页内容清洗，转换为 Markdown"
          />
          <ApiItem 
            name="Resend"
            endpoint="api.resend.com"
            usage="每日风控日报邮件发送"
          />
          <ApiItem 
            name="Cloudflare Workers"
            endpoint="*.workers.dev"
            usage="CORS 代理、边缘计算"
          />
        </div>
      </section>

      {/* 数据流向 */}
      <section>
        <h3 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <BookOpen size={18} className="text-accent-purple" />
          数据流向
        </h3>
        
        <div className="p-3 bg-bg-secondary rounded-lg border border-border">
          <div className="text-xs text-text-secondary space-y-2">
            <FlowStep step="1" text="微信/网页 → iOS 快捷指令 → Vercel Edge API" />
            <FlowStep step="2" text="Jina Reader 清洗网页 → Markdown 文本" />
            <FlowStep step="3" text="存入 Supabase → 向量化 → AI 知识库" />
            <FlowStep step="4" text="IBKR 账户快照 → 每日同步 → 风控分析" />
            <FlowStep step="5" text="Gemini 分析 → Resend 邮件 → 用户邮箱" />
          </div>
        </div>
      </section>

      {/* 目录结构 */}
      <section>
        <h3 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Layers size={18} className="text-accent-blue" />
          项目结构
        </h3>
        
        <div className="p-3 bg-bg-secondary rounded-lg border border-border font-mono text-xs">
          <div className="text-text-secondary space-y-1">
            <div><span className="text-accent-cyan">/client</span> - 前端应用 (React + Tailwind)</div>
            <div><span className="text-accent-cyan">/api</span> - Vercel Serverless Functions</div>
            <div><span className="text-accent-cyan">/workers</span> - Cloudflare Workers</div>
            <div><span className="text-accent-cyan">/lightrag-service</span> - LightRAG Python 服务</div>
            <div><span className="text-accent-cyan">/scripts</span> - 维护脚本 + 数据迁移</div>
            <div><span className="text-accent-cyan">/drizzle</span> - 数据库 Schema + 迁移</div>
            <div><span className="text-accent-cyan">/docs</span> - 项目文档</div>
          </div>
        </div>
      </section>

      {/* 版本信息 */}
      <section className="pt-2 border-t border-border">
        <div className="flex justify-between text-xs text-text-muted">
          <span>RiskControl v1.0</span>
          <span>Last Updated: 2025-12</span>
        </div>
      </section>
    </div>
  );
}

// 技术卡片组件
function TechCard({ 
  icon, 
  name, 
  tech, 
  color 
}: { 
  icon: React.ReactNode; 
  name: string; 
  tech: string; 
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    cyan: 'border-accent-cyan/30 text-accent-cyan',
    blue: 'border-accent-blue/30 text-accent-blue',
    green: 'border-accent-green/30 text-accent-green',
    purple: 'border-accent-purple/30 text-accent-purple',
    yellow: 'border-accent-yellow/30 text-accent-yellow',
    red: 'border-accent-red/30 text-accent-red',
  };

  return (
    <div className={`p-2 bg-bg-secondary rounded border ${colorClasses[color]?.split(' ')[0] || 'border-border'}`}>
      <div className={`flex items-center gap-1.5 mb-1 ${colorClasses[color]?.split(' ')[1] || 'text-text-primary'}`}>
        {icon}
        <span className="text-xs font-medium">{name}</span>
      </div>
      <div className="text-xs text-text-secondary">{tech}</div>
    </div>
  );
}

// 流程步骤组件
function FlowStep({ step, text }: { step: string; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent-cyan/20 text-accent-cyan text-xs flex items-center justify-center">
        {step}
      </span>
      <span>{text}</span>
    </div>
  );
}

// API 项目组件
function ApiItem({ 
  name, 
  endpoint, 
  usage,
  models
}: { 
  name: string; 
  endpoint: string; 
  usage: string;
  models?: string[];
}) {
  return (
    <div className="p-2 bg-bg-secondary rounded border border-border">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-text-primary">{name}</span>
        <span className="text-xs text-text-muted font-mono">{endpoint}</span>
      </div>
      <p className="text-xs text-text-secondary">{usage}</p>
      {models && (
        <div className="flex flex-wrap gap-1 mt-1">
          {models.map(m => (
            <span key={m} className="text-xs px-1.5 py-0.5 bg-accent-purple/20 text-accent-purple rounded">
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
