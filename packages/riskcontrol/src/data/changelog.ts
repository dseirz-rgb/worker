
export interface ChangelogItem {
  date: string;
  version: string;
  title: string;
  changes: string[];
}

export const changelogData: ChangelogItem[] = [
  {
    date: '2025-12-24',
    version: 'v1.4.1',
    title: '移动端体验优化与智能问答升级',
    changes: [
      '📱 移动端：AI研报页面布局重构，header 更紧凑',
      '📱 移动端：每日研报弹窗可读区域增加',
      '🔍 观察列表：新增模糊搜索，支持代码/名称匹配',
      '💰 观察列表：选股后显示昨收价，快捷设置 -5%/-7%/-10% 目标价',
      '🧠 智能问答：预设问题基于实时数据动态生成（杠杆率、回撤等）',
      '🔄 智能问答：新增刷新按钮，一键换一批问题',
      '📋 持仓概览：新增一键复制持仓摘要功能',
      '🔧 修复：融资额显示为0的问题（从杠杆率反推）',
    ]
  },
  {
    date: '2025-12-23',
    version: 'v1.4.0',
    title: '上帝模式：去杠杆推演器 (God Mode)',
    changes: [
      '🎮 策略推演：新增 "God Mode" 去杠杆模拟器，支持自定义股价与保留股数',
      '🛡️ 风险可视化：实时计算杠杆率安全区 (Green/Yellow/Red)',
      '📊 债务清偿：基于 Covered Call 策略自动计算债务归零时间线',
      '✨ 体验优化：晨报弹窗 (Daily Briefing) 样式升级，支持高亮与 Markdown 渲染',
    ]
  },
  {
    date: '2025-12-23',
    version: 'v1.3.2',
    title: '数据同步优化与隐私增强 (Current)',
    changes: [
      '⚡️ 同步优化：调整自动更新时间至 10:00 (BJ Time)，确保 IBKR 报表就绪',
      '✨ 体验优化：新增数据滞后智能提醒，自动检测报表更新状态',
      '🔒 隐私增强：全局隐私模式开关，优化解锁交互体验',
      '🔧 基础设施：GitHub Actions 脚本支持 Base64 凭证，增强安全性',
    ]
  },
  {
    date: '2025-12-22',
    version: 'v1.3.1',
    title: '复盘模块重构与稳定性修复',
    changes: [
      '✨ 复盘升级：将 "时光机" 升级为 "AI 智能周复盘"，移除冗余列表',
      '🐛 修复：解决 Textarea 组件导出缺失导致的构建错误',
      '✨ AI 增强：新增 "思维链" 透明度面板，展示 AI 思考与检索过程',
      '✨ 数据同步：IBKR 交易记录全自动导入 (Auto-Sync)',
    ]
  },
  {
    date: '2025-12-22',
    version: 'v1.3.0',
    title: '智能风控与全自动同步',
    changes: [
      '✨ AI 增强：新增 "思维链" 透明度面板，展示 AI 思考与检索过程',
      '✨ AI 增强：实现 "智能周复盘"，基于最近交易记录提供策略分析',
      '✨ 数据同步：IBKR 交易记录全自动导入 (Auto-Sync)',
      '✨ 数据同步：Google Drive / Sheets 策略文档自动同步',
      '📱 体验：PWA 移动端适配优化，修复状态栏与侧边栏问题',
      '🔧 架构：每日邮件报告 (Daily Report) 流程重构与容错增强',
    ]
  },
  {
    date: '2025-12-21',
    version: 'v1.2.0',
    title: '系统架构与边缘计算优化',
    changes: [
      '🚀 架构：发布系统架构白皮书 (Architecture Whitepaper)',
      '⚡️ 性能：文章导入功能迁移至 Vercel Edge Runtime，避免超时',
      '🌐 网络：集成 Jina Crawler 与 Cloudflare Workers 进行内容清洗',
      '🔧 运维：生产环境域名更新至 provip.vercel.app',
      '🐛 修复：异步任务 (waitUntil) 处理逻辑优化',
    ]
  },
  {
    date: '2025-12-20',
    version: 'v1.1.0',
    title: 'Supabase 数据层迁移',
    changes: [
      '💾 存储：完成从 LocalStorage 到 Supabase 云数据库的完整迁移',
      '🔒 安全：配置 RLS (Row Level Security) 数据访问策略',
      '📊 报表：IBKR 净值数据自动同步工作流上线',
    ]
  },
  {
    date: '2025-12-15',
    version: 'v1.0.0',
    title: 'RiskControl 项目初始化',
    changes: [
      '🎉 发布：核心仪表盘 (Dashboard) 上线',
      '📈 功能：基础持仓管理与 PnL 盈亏分析',
      '🤖 功能：初步集成 Gemini AI 投资助手',
    ]
  }
];
