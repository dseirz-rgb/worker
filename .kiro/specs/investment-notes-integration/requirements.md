# 投资笔记整合 - 需求文档

## 1. 概述

### 1.1 背景
Echo 已有成熟的笔记系统（BlinkoStore、BlinkoEditor、BlinkoCard），RiskControl 有独立的投资笔记功能（DynamicNotes）。目标是**复用 Echo 的笔记基础设施**，在 Echo 投资模块中实现投资笔记功能，而非从 RiskControl 迁移代码。

### 1.2 核心原则
- **复用优先**：最大化复用 Echo 现有组件（Editor、Card、Store 模式）
- **数据隔离**：投资笔记存储在 Investment DB，不混入 Echo DB
- **功能对等**：保留 RiskControl DynamicNotes 的核心功能
- **渐进增强**：先实现基础功能，后续迭代增强

## 2. 功能需求

### 2.1 笔记类型
| 类型 | source_type | 说明 |
|------|-------------|------|
| 投资日记 | `note` | 日常投资思考、交易记录 |
| 投资原则 | `principle` | 投资纪律、策略原则 |
| 知识库 | `uploaded_file` | 上传的投资书籍/文档 |
| 微信文章 | `wechat_article` | 收藏的投资文章 |
| 群聊精华 | `wechat_group_chat` | 群聊中的投资讨论 |

### 2.2 核心功能
1. **笔记 CRUD**
   - 创建、编辑、删除投资笔记
   - 支持 Markdown 格式
   - 支持标签分类

2. **关联持仓**
   - 笔记可关联股票代码 (related_ticker)
   - 创建时可选择保存当前资产快照 (portfolio_snapshot)

3. **分类视图**
   - 投资日记 (journal)
   - 投资原则 (principles)
   - 知识库 (knowledge)
   - 历史对话 (history) - 可选

4. **搜索过滤**
   - 按标题/内容搜索
   - 按标签过滤
   - 按关联股票过滤

### 2.3 数据结构
```typescript
interface InvestmentNote {
  id: number;
  title: string;
  content: string;
  tags: string[];
  source_type: 'note' | 'principle' | 'uploaded_file' | 'wechat_article' | 'wechat_group_chat';
  related_ticker?: string;
  portfolio_snapshot?: {
    date: string;
    totalNetWorth: number;
    cashRatio: number;
    relatedPosition?: PositionSnapshot;
    topPositions: PositionSnapshot[];
  };
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}
```

## 3. 技术需求

### 3.1 数据库
- **使用 Investment DB** (`lyqspnecudllmnajrrlm`)
- 表名：`documents`（已存在，RiskControl 使用中）
- 不创建新表，复用现有结构

### 3.2 前端架构
```
packages/echo/src/
├── pages/investment/
│   └── notes.tsx          # 投资笔记页面（重写）
├── store/
│   └── investmentNotesStore.ts  # 投资笔记 Store（新建）
├── components/
│   └── InvestmentNotes/   # 投资笔记组件（新建）
│       ├── NoteEditor.tsx     # 复用 BlinkoEditor 模式
│       ├── NoteCard.tsx       # 复用 BlinkoCard 模式
│       └── NoteList.tsx       # 笔记列表
└── services/
    └── investmentSupabase.ts  # Investment DB 客户端（已存在）
```

### 3.3 复用策略
| Echo 组件 | 复用方式 | 说明 |
|-----------|----------|------|
| BlinkoStore | 参考模式 | 创建 InvestmentNotesStore，复用 PromiseState 模式 |
| BlinkoEditor | 参考模式 | 创建简化版编辑器，复用 Editor 组件 |
| BlinkoCard | 参考模式 | 创建 NoteCard，复用卡片布局 |
| ScrollArea | 直接复用 | 列表滚动 |
| Tabs | 直接复用 | 分类切换 |

### 3.4 API 设计
直接使用 Supabase Client，不经过 tRPC：
```typescript
// 查询笔记
supabase.from('documents').select('*').eq('source_type', 'note')

// 创建笔记
supabase.from('documents').insert({ title, content, source_type, ... })

// 更新笔记
supabase.from('documents').update({ ... }).eq('id', id)

// 删除笔记
supabase.from('documents').delete().eq('id', id)
```

## 4. 非功能需求

### 4.1 性能
- 笔记列表分页加载（每页 20 条）
- 搜索防抖（300ms）

### 4.2 用户体验
- 编辑器自动保存草稿（localStorage）
- 删除前确认
- 操作成功/失败 Toast 提示

### 4.3 兼容性
- 与 RiskControl DynamicNotes 数据兼容
- 同一数据库，两边都能访问

## 5. 高级功能（新增）

### 5.1 向量嵌入 (Embedding)
- 保存笔记时自动生成向量嵌入
- 调用 `/api/embedding` 接口
- 存储到 documents 表的 `embedding` 字段
- 用于后续 RAG 检索

### 5.2 知识库上传
- 支持上传 PDF/TXT/Markdown 文档
- 复用 RiskControl 的 KnowledgeBaseDialog 组件
- 上传后自动切片并生成嵌入

### 5.3 历史对话 (History Tab)
- 新增"历史对话"Tab
- 从 `conversations` 表获取历史对话
- 点击可跳转到对话详情或触发回调

### 5.4 AI 分析（预留）
- 预留 AI 分析入口
- 后续可集成 RAG 问答功能

## 6. 验收标准

1. ✅ 可以创建、编辑、删除投资笔记
2. ✅ 可以按类型（日记/原则/知识库/历史）切换视图
3. ✅ 可以搜索笔记
4. ✅ 可以关联股票代码
5. ✅ 可以保存资产快照
6. ✅ 数据存储在 Investment DB
7. ✅ 与 RiskControl 数据兼容
8. ✅ 保存时自动生成向量嵌入
9. ✅ 支持知识库上传
10. ✅ 支持查看历史对话
