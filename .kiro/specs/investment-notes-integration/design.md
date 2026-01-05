# 投资笔记整合 - 设计文档

## 1. 架构设计

### 1.1 整体架构
```
┌─────────────────────────────────────────────────────────┐
│                    Echo 投资模块                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              InvestmentNotesPage                 │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │   │
│  │  │ Sidebar │  │ Editor  │  │    NoteList     │  │   │
│  │  │ (Tabs)  │  │         │  │   (NoteCard)    │  │   │
│  │  └─────────┘  └─────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │           InvestmentNotesStore (MobX)            │   │
│  │  - notes[], currentNote, filters                 │   │
│  │  - fetchNotes(), upsertNote(), deleteNote()      │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
└─────────────────────────│───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Investment Supabase Client                  │
│              (lyqspnecudllmnajrrlm)                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │                 documents 表                      │   │
│  │  id, title, content, source_type, tags,          │   │
│  │  related_ticker, portfolio_snapshot, ...         │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 1.2 组件层次
```
InvestmentNotesPage
├── Header (标题 + 新建按钮)
├── TabBar (日记 | 原则 | 知识库)
├── SearchBar
├── NoteList
│   └── NoteCard (复用 BlinkoCard 模式)
│       ├── CardHeader (标题 + 时间 + 标签)
│       ├── CardContent (Markdown 预览)
│       └── CardFooter (关联股票 + 操作)
└── NoteEditor (Modal/Drawer)
    ├── TitleInput
    ├── MarkdownEditor (复用 Editor 组件)
    ├── MetaInputs (标签 + 关联股票 + 快照开关)
    └── ActionButtons (保存 + 取消)
```

## 2. 数据模型

### 2.1 documents 表结构（已存在）
```sql
-- Investment DB: lyqspnecudllmnajrrlm
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER DEFAULT 1,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],
  source_type TEXT NOT NULL,  -- 'note', 'principle', 'uploaded_file', etc.
  related_ticker TEXT,
  portfolio_snapshot JSONB,
  metadata JSONB,
  embedding VECTOR(768),      -- 用于 RAG，本次不使用
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 TypeScript 类型
```typescript
// packages/echo/src/types/investmentNotes.ts

export type NoteSourceType = 
  | 'note' 
  | 'principle' 
  | 'uploaded_file' 
  | 'wechat_article' 
  | 'wechat_group_chat';

export interface PositionSnapshot {
  ticker: string;
  weight: number;
  pnl: number;
  quantity?: number;
  avgCost?: number;
  currentPrice?: number;
  unrealizedPnLPercent?: number;
}

export interface PortfolioSnapshot {
  date: string;
  totalNetWorth: number;
  cashRatio: number;
  relatedPosition?: PositionSnapshot;
  topPositions: PositionSnapshot[];
}

export interface InvestmentNote {
  id: number;
  user_id: number;
  title: string;
  content: string;
  tags: string[];
  source_type: NoteSourceType;
  related_ticker?: string;
  portfolio_snapshot?: PortfolioSnapshot;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface NoteFilter {
  source_type?: NoteSourceType;
  search?: string;
  ticker?: string;
  tags?: string[];
}
```

## 3. Store 设计

### 3.1 InvestmentNotesStore
```typescript
// packages/echo/src/store/investmentNotesStore.ts

import { makeAutoObservable } from 'mobx';
import { PromisePageState, PromiseState } from './standard/PromiseState';
import { getInvestmentClient } from '@/services/investmentSupabase';
import type { InvestmentNote, NoteFilter, NoteSourceType } from '@/types/investmentNotes';

export class InvestmentNotesStore {
  sid = 'InvestmentNotesStore';
  
  // 状态
  currentNote: Partial<InvestmentNote> | null = null;
  isEditing = false;
  activeTab: 'journal' | 'principles' | 'knowledge' = 'journal';
  searchQuery = '';
  
  // 笔记列表（分页）
  noteList = new PromisePageState<InvestmentNote>({
    function: async ({ page, size }) => {
      const supabase = getInvestmentClient();
      const sourceTypes = this.getSourceTypesForTab();
      
      let query = supabase
        .from('documents')
        .select('*')
        .in('source_type', sourceTypes)
        .order('created_at', { ascending: false })
        .range((page - 1) * size, page * size - 1);
      
      if (this.searchQuery) {
        query = query.or(`title.ilike.%${this.searchQuery}%,content.ilike.%${this.searchQuery}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });
  
  // CRUD 操作
  upsertNote = new PromiseState<InvestmentNote>({
    function: async (note: Partial<InvestmentNote>) => {
      const supabase = getInvestmentClient();
      
      if (note.id) {
        // 更新
        const { data, error } = await supabase
          .from('documents')
          .update({
            title: note.title,
            content: note.content,
            tags: note.tags,
            related_ticker: note.related_ticker,
            portfolio_snapshot: note.portfolio_snapshot,
            metadata: note.metadata,
            updated_at: new Date().toISOString()
          })
          .eq('id', note.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // 创建
        const { data, error } = await supabase
          .from('documents')
          .insert({
            title: note.title,
            content: note.content,
            tags: note.tags || [],
            source_type: note.source_type || 'note',
            related_ticker: note.related_ticker,
            portfolio_snapshot: note.portfolio_snapshot,
            metadata: note.metadata
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    }
  });
  
  deleteNote = new PromiseState<void>({
    function: async (id: number) => {
      const supabase = getInvestmentClient();
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    }
  });
  
  // 辅助方法
  private getSourceTypesForTab(): NoteSourceType[] {
    switch (this.activeTab) {
      case 'journal': return ['note'];
      case 'principles': return ['principle'];
      case 'knowledge': return ['uploaded_file', 'wechat_article', 'wechat_group_chat'];
    }
  }
  
  setActiveTab(tab: 'journal' | 'principles' | 'knowledge') {
    this.activeTab = tab;
    this.noteList.resetAndCall({});
  }
  
  setSearchQuery(query: string) {
    this.searchQuery = query;
    this.noteList.resetAndCall({});
  }
  
  openEditor(note?: InvestmentNote) {
    this.currentNote = note || { source_type: this.activeTab === 'principles' ? 'principle' : 'note' };
    this.isEditing = true;
  }
  
  closeEditor() {
    this.currentNote = null;
    this.isEditing = false;
  }
  
  constructor() {
    makeAutoObservable(this);
  }
}
```

## 4. 组件设计

### 4.1 NoteCard 组件
```typescript
// packages/echo/src/components/InvestmentNotes/NoteCard.tsx

interface NoteCardProps {
  note: InvestmentNote;
  onClick: () => void;
  onDelete: () => void;
}

// 复用 BlinkoCard 的布局模式：
// - Card 容器 + hover 效果
// - Header: 标题 + 时间
// - Content: Markdown 预览（截断）
// - Footer: 标签 + 关联股票
// - 右键菜单: 编辑/删除
```

### 4.2 NoteEditor 组件
```typescript
// packages/echo/src/components/InvestmentNotes/NoteEditor.tsx

interface NoteEditorProps {
  note: Partial<InvestmentNote>;
  onSave: (note: Partial<InvestmentNote>) => void;
  onCancel: () => void;
  portfolioState?: PortfolioState; // 用于快照
}

// 复用 BlinkoEditor 的模式：
// - 标题输入
// - Markdown 编辑器（复用 Editor 组件）
// - 元数据输入（标签、关联股票）
// - 快照开关（仅日记模式）
// - 保存/取消按钮
```

## 5. 页面设计

### 5.1 布局
```
┌────────────────────────────────────────────────────────┐
│  ← 返回    投资笔记                           [+ 新建] │
├────────────────────────────────────────────────────────┤
│  [日记]  [原则]  [知识库]                              │
├────────────────────────────────────────────────────────┤
│  🔍 搜索笔记...                                        │
├────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐ │
│  │ 📝 关于 NVDA 的思考                    2026-01-04 │ │
│  │ #AI #半导体                                       │ │
│  │ 今天 NVDA 回调了 5%，我认为这是...               │ │
│  │ 📊 NVDA                                          │ │
│  └──────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 📝 2026 年投资计划                     2026-01-01 │ │
│  │ #计划 #年度                                       │ │
│  │ 新的一年，我的投资目标是...                       │ │
│  └──────────────────────────────────────────────────┘ │
│  ...                                                   │
└────────────────────────────────────────────────────────┘
```

### 5.2 编辑器 Modal
```
┌────────────────────────────────────────────────────────┐
│  编辑笔记                                    [×]       │
├────────────────────────────────────────────────────────┤
│  标题: [关于 NVDA 的思考                           ]  │
├────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐ │
│  │ # 关于 NVDA 的思考                               │ │
│  │                                                   │ │
│  │ 今天 NVDA 回调了 5%，我认为这是一个...           │ │
│  │                                                   │ │
│  │ ## 技术面分析                                    │ │
│  │ - RSI 超卖                                       │ │
│  │ - 支撑位 $120                                    │ │
│  └──────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────┤
│  标签: [AI, 半导体                                 ]  │
│  关联: [NVDA ▼]                                       │
│  ☑ 保存当前资产快照 (净值: ¥1,234,567)               │
├────────────────────────────────────────────────────────┤
│                              [取消]  [保存]           │
└────────────────────────────────────────────────────────┘
```

## 6. 复用清单

### 6.1 直接复用
| 组件 | 来源 | 用途 |
|------|------|------|
| `ScrollArea` | `@/components/Common/ScrollArea` | 列表滚动 |
| `Tabs, Tab` | `@heroui/react` | 分类切换 |
| `Card` | `@heroui/react` | 卡片容器 |
| `Button` | `@heroui/react` | 按钮 |
| `Input` | `@heroui/react` | 输入框 |
| `Modal` | `@heroui/react` | 编辑器弹窗 |
| `Icon` | `@/components/Common/Iconify` | 图标 |
| `toast` | `sonner` | 提示 |

### 6.2 参考复用
| 模式 | 来源 | 改造点 |
|------|------|--------|
| Store 模式 | `BlinkoStore` | 改用 Investment DB |
| 卡片布局 | `BlinkoCard` | 简化，去掉不需要的功能 |
| 编辑器 | `BlinkoEditor` | 简化，去掉附件上传 |
| 列表分页 | `PromisePageState` | 直接复用 |

## 7. 实现顺序

1. **Phase 1: 基础设施** ✅
   - 创建类型定义
   - 创建 InvestmentNotesStore
   - 验证 Investment DB 连接

2. **Phase 2: 列表展示** ✅
   - 创建 NoteCard 组件
   - 创建 NoteList 组件
   - 实现分类切换

3. **Phase 3: 编辑功能** ✅
   - 创建 NoteEditor 组件
   - 实现创建/编辑/删除
   - 实现资产快照

4. **Phase 4: 搜索过滤** ✅
   - 实现搜索功能
   - 实现标签过滤
   - 实现股票过滤

5. **Phase 5: 优化**
   - 草稿自动保存
   - 加载状态优化
   - 错误处理

6. **Phase 7: 高级功能** ✅
   - 向量嵌入（保存时自动生成）
   - 历史对话 Tab
   - 知识库上传
   - 知识库分组显示
