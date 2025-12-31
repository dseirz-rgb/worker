# Design Document - Echo

## Overview

Echo 是一款多端 AI 个人助手应用，采用 **Tauri v2** 作为跨平台框架，支持 macOS、Windows、iOS 和 Android。核心 AI 能力基于 **memU** 记忆框架，前端使用 **React + TypeScript**。

### 设计原则

1. **记忆优先** - 所有用户活动都被记忆系统捕获和组织
2. **主动智能** - AI 不只是被动响应，而是主动分析和提醒
3. **本地优先** - 数据优先存储在本地，云端备份实现多端同步
4. **多端一致** - 桌面和移动端体验一致，数据实时同步

### 技术栈选择 (2025年12月更新)

| 层级 | 技术 | 理由 | 现代性 |
|------|------|------|--------|
| 跨平台框架 | **Tauri v2.2** | 2025年1月最新稳定版，支持桌面+移动端，比 Electron 小 60-90% | 🔥 最新 |
| 前端框架 | **React 19.x (已修复版)** | 注意：2025年12月披露 CVE-2025-55182，需使用修复版本 | ⚠️ 需更新 |
| 备选前端 | **Lynx (ByteDance)** | 2025年3月开源，TikTok 在用，性能更好，可考虑未来迁移 | 🔥🔥 最新 |
| UI 组件 | **shadcn/ui + Tailwind v4** | 现代、可定制、无运行时 | ✅ 现代 |
| 后端 | **Rust (Tauri)** | 性能好，内存安全，2025年主流 | 🔥 趋势 |
| AI 服务 | **Gemini API (直接调用)** | 无需本地 Python，简化架构 | ✅ 简单 |
| 网页版 | **Vercel + Edge Functions** | 免费额度大，部署简单，你熟悉 | ✅ 成熟 |
| AI 记忆 | **mem0** 或 **memU** | mem0 更成熟(24k stars)，memU 更新(2024年) | 🔥 最新 |
| 备选记忆 | **Letta (原 MemGPT)** | UC Berkeley 出品，2025年很火，"LLM 操作系统"概念 | 🔥🔥 最新 |
| **本地数据库** | **SeekDB** | 2025年11月发布，AI原生搜索数据库，统一向量+全文+关系型 | 🔥🔥 最新 |
| **云端存储** | **Supabase + pgvector** | 你已熟悉，PostgreSQL 生态，实时订阅，向量搜索支持 | ✅ 成熟 |
| AI 模型 | **Gemini 3 Pro Preview + Ollama** | Gemini 3 Pro 2025年11月发布，本地模型用 Ollama | 🔥🔥 最新 |

### 2025年底技术趋势

1. **Local-First AI** - 隐私优先，数据本地存储是主流方向
2. **Agentic AI** - AI 主动行动，不只是被动响应
3. **统一数据层** - SeekDB 这类统一向量+关系型的数据库兴起
4. **Rust 后端** - 性能和安全性驱动，Tauri/Lynx 都用 Rust
5. **跨平台统一** - 一套代码覆盖桌面+移动端

### 安全注意事项

⚠️ **React Server Components 漏洞 (CVE-2025-55182)**
- 2025年12月3日披露，CVSS 10.0 满分
- 影响 React 19.0, 19.1, 19.2
- 必须升级到修复版本
- Echo 作为本地应用影响较小，但仍需关注

### 为什么选择 SeekDB

SeekDB 是蚂蚁 OceanBase 在 2025年11月刚开源的 AI 原生数据库：

1. **统一存储** - 向量、文本、结构化数据、JSON 都在一个引擎，不需要 SQLite + 向量数据库
2. **混合搜索** - 单条 SQL 同时做向量搜索 + 全文搜索 + 关系查询
3. **内置 AI** - embedding、reranking、LLM 推理在数据库内完成
4. **嵌入式模式** - 支持本地嵌入，适合桌面应用
5. **MySQL 兼容** - 学习成本低，生态丰富

```python
# SeekDB 使用示例
import pyseekdb

client = pyseekdb.Client(path="./echo.db", database="echo")

collection = client.create_collection(
    name="notes",
    embedding_function=DefaultEmbeddingFunction()
)

# 添加笔记 - 自动生成向量
collection.add(
    ids=["note1"],
    documents=["今天学习了 SeekDB，很强大"],
    metadatas=[{"domain": "learning", "type": "note"}]
)

# 混合搜索
results = collection.query(
    query_texts="数据库学习",
    n_results=5
)
```

### 架构特点

1. **Local-First + Cloud Backup** - 数据优先存储在本地，同时云端备份实现多端同步
2. **Agentic AI** - AI 主动检索、分析、提醒，不只是被动响应
3. **统一数据层** - SeekDB 一个数据库搞定所有存储需求（向量+全文+关系型）
4. **模块化** - 各服务独立，可以逐步开发和替换
5. **面向 2026** - 技术栈选择考虑未来 1-2 年的演进

### 部署架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Tauri 客户端    │     │    云端服务      │     │   轻量网页版    │
│  (Mac/Win/iOS)  │     │                 │     │   (Vercel)      │
│                 │     │  ┌───────────┐  │     │                 │
│  前端: React    │◄───►│  │ Supabase  │  │◄───►│  React (只读+   │
│  后端: Rust     │     │  │ PostgreSQL│  │     │   简单操作)     │
│  AI: Gemini API │     │  │ pgvector  │  │     │                 │
│  本地: SeekDB   │     │  │ Realtime  │  │     │  AI: Gemini API │
│                 │     │  └───────────┘  │     │  (Edge Function)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        └───────────────────────┴───────────────────────┘
                    实时同步 + 冲突解决
```

**客户端 (Tauri)**：
- 完整功能，离线可用
- 直接调用 Gemini API（不需要本地 Python）
- SeekDB 本地缓存 + Supabase 云同步
- 活动监控、截图翻译等系统级功能

**轻量网页版 (Vercel)**：
- 快速查看笔记、任务
- 简单的 AI 对话
- 通过 Vercel Edge Functions 调用 Gemini API
- 不支持：活动监控、截图翻译、文件管理等系统级功能

### 数据同步策略

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mac 桌面端    │     │    云端存储      │     │   iPhone 端     │
│                 │     │                 │     │                 │
│  SeekDB (本地)  │◄───►│  Supabase /     │◄───►│  SeekDB (本地)  │
│                 │     │  Turso Edge     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        └───────────────────────┴───────────────────────┘
                    实时同步 + 冲突解决
```

**云端存储选项：**

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Supabase** | 你已熟悉，PostgreSQL，实时订阅 | 需要自己处理向量同步 |
| **Turso** | SQLite 兼容，边缘部署，低延迟 | 向量支持有限 |
| **自建服务** | 完全控制 | 开发成本高 |

**推荐方案：Supabase + pgvector**
- 结构化数据用 Supabase PostgreSQL
- 向量数据用 pgvector 扩展
- 本地 SeekDB 作为缓存和离线支持
- 你已经有 Supabase 经验，学习成本低

---

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Echo Application                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Tauri v2 Shell                            │    │
│  │              (macOS / Windows / iOS / Android)               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│  ┌───────────────────────────┴───────────────────────────┐          │
│  │                                                        │          │
│  │  ┌─────────────────┐          ┌─────────────────┐     │          │
│  │  │   Frontend      │          │   Backend       │     │          │
│  │  │   (React)       │◄────────►│   (Rust)        │     │          │
│  │  │                 │  IPC     │                 │     │          │
│  │  │  - UI 组件      │          │  - 系统 API     │     │          │
│  │  │  - 状态管理     │          │  - 文件操作     │     │          │
│  │  │  - 路由        │          │  - 活动监控     │     │          │
│  │  └─────────────────┘          └────────┬────────┘     │          │
│  │                                        │              │          │
│  └────────────────────────────────────────┼──────────────┘          │
│                                           │                          │
│  ┌────────────────────────────────────────┴──────────────────────┐  │
│  │                      AI Service Layer                          │  │
│  │                        (Python)                                │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │  │
│  │  │   memU       │  │  Reminder    │  │  Report      │         │  │
│  │  │  Memory      │  │  Engine      │  │  Generator   │         │  │
│  │  │  System      │  │              │  │              │         │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘         │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │  │
│  │  │  Emotion     │  │  Activity    │  │  External    │         │  │
│  │  │  Analyzer    │  │  Analyzer    │  │  API Client  │         │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘         │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                           │                          │
│  ┌────────────────────────────────────────┴──────────────────────┐  │
│  │                      Data Layer                                │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │  │
│  │  │   SQLite     │  │   Vector DB  │  │   File       │         │  │
│  │  │  (结构化数据) │  │  (语义搜索)  │  │   Storage    │         │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘         │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
            ┌───────▼───────┐ ┌────▼────┐ ┌───────▼───────┐
            │  RiskControl  │ │ GitHub  │ │ Apple Health  │
            │     API       │ │   API   │ │     API       │
            └───────────────┘ └─────────┘ └───────────────┘
```

### 数据流

```
用户输入 (文字/语音/截图/活动)
         │
         ▼
┌─────────────────┐
│  Input Handler  │ ──────────────────────────────────┐
└────────┬────────┘                                   │
         │                                            │
         ▼                                            ▼
┌─────────────────┐                          ┌─────────────────┐
│  memU Memory    │◄─────────────────────────│  Activity       │
│  System         │                          │  Monitor        │
│                 │                          │  (后台运行)      │
│  - 提取记忆     │                          └─────────────────┘
│  - 分类组织     │
│  - 语义索引     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Analysis    │
│                 │
│  - 模式识别     │
│  - 情绪分析     │
│  - 行为预测     │
└────────┬────────┘
         │
         ├──────────────────┬──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Reminder       │ │  Report         │ │  Chat           │
│  Engine         │ │  Generator      │ │  Response       │
│                 │ │                 │ │                 │
│  - 主动提醒     │ │  - 日报/周报    │ │  - 对话回复     │
│  - 情绪反馈     │ │  - 统计分析     │ │  - 决策支持     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Components and Interfaces

### 1. Frontend Components (React)

```typescript
// 页面结构
src/
├── pages/
│   ├── Dashboard.tsx        // 主仪表板
│   ├── Notes.tsx            // 笔记页面
│   ├── Tasks.tsx            // 任务页面
│   ├── Chat.tsx             // AI 对话
│   ├── Reports.tsx          // 报告页面
│   ├── Files.tsx            // 文件管理
│   ├── Settings.tsx         // 设置页面
│   └── Family.tsx           // 家庭页面
├── components/
│   ├── ui/                  // shadcn/ui 基础组件
│   ├── notes/               // 笔记相关组件
│   ├── tasks/               // 任务相关组件
│   ├── chat/                // 对话相关组件
│   ├── reports/             // 报告相关组件
│   └── common/              // 通用组件
├── hooks/
│   ├── useMemory.ts         // 记忆系统 Hook
│   ├── useReminder.ts       // 提醒系统 Hook
│   ├── useActivity.ts       // 活动监控 Hook
│   └── useSync.ts           // 同步 Hook
├── services/
│   ├── memoryService.ts     // 记忆服务
│   ├── taskService.ts       // 任务服务
│   ├── reminderService.ts   // 提醒服务
│   └── externalApiService.ts // 外部 API 服务
└── types/
    ├── note.ts              // 笔记类型
    ├── task.ts              // 任务类型
    ├── memory.ts            // 记忆类型
    └── report.ts            // 报告类型
```

### 2. Core Interfaces

```typescript
// 笔记接口
interface Note {
  id: string;
  content: string;
  type: 'text' | 'voice' | 'image';
  tags: string[];
  domain: LifeDomain;
  createdAt: Date;
  updatedAt: Date;
  memoryId?: string;  // 关联的记忆 ID
}

// 任务接口
interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  deadline?: Date;
  domain: LifeDomain;
  assignee?: TeamMember;  // 团队任务分配
  parentId?: string;      // 子任务支持
  createdAt: Date;
  completedAt?: Date;
}

// 生活领域
type LifeDomain = 
  | 'work'        // 工作
  | 'investment'  // 投资
  | 'development' // 开发
  | 'learning'    // 学习
  | 'family'      // 家庭
  | 'health'      // 健康
  | 'entertainment'; // 娱乐

// 记忆项 (基于 memU)
interface MemoryItem {
  id: string;
  summary: string;
  memoryType: string;
  category: MemoryCategory;
  source: MemorySource;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

// 记忆类别
interface MemoryCategory {
  id: string;
  name: string;
  summary: string;
  itemCount: number;
}

// 提醒
interface Reminder {
  id: string;
  type: ReminderType;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  scheduledAt: Date;
  status: 'pending' | 'sent' | 'dismissed' | 'snoozed';
  context?: Record<string, unknown>;
}

type ReminderType = 
  | 'task_deadline'
  | 'habit_reminder'
  | 'emotional_feedback'
  | 'family_care'
  | 'health_alert'
  | 'learning_prompt'
  | 'investment_warning';

// 情绪状态
interface EmotionalState {
  timestamp: Date;
  mood: 'positive' | 'neutral' | 'negative';
  energy: number;  // 1-10
  stress: number;  // 1-10
  source?: string; // 来源（手动记录/健康数据/行为推断）
  notes?: string;
}

// 团队成员
interface TeamMember {
  id: string;
  name: string;
  role: string;
  preferences?: Record<string, unknown>;
  lastOneOnOne?: Date;
  notes: string[];
}

// 家庭成员
interface FamilyMember {
  id: string;
  name: string;
  relationship: 'spouse' | 'child' | 'parent';
  birthdate?: Date;
  notes: string[];
  milestones?: Milestone[];  // 孩子成长里程碑
  healthNotes?: string[];    // 父母健康记录
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  date: Date;
  type: 'development' | 'language' | 'social' | 'other';
}
```

### 3. Service Interfaces

```typescript
// 记忆服务协议
interface MemoryServiceProtocol {
  // 存储记忆
  memorize(input: MemoryInput): Promise<MemoryResult>;
  
  // 检索记忆
  retrieve(queries: Query[], options?: RetrieveOptions): Promise<MemoryItem[]>;
  
  // 获取类别
  getCategories(): Promise<MemoryCategory[]>;
  
  // 搜索
  search(query: string, filters?: SearchFilters): Promise<SearchResult[]>;
}

// 提醒服务协议
interface ReminderServiceProtocol {
  // 创建提醒
  createReminder(reminder: CreateReminderInput): Promise<Reminder>;
  
  // 获取待发送提醒
  getPendingReminders(): Promise<Reminder[]>;
  
  // 分析并生成提醒
  analyzeAndGenerateReminders(): Promise<Reminder[]>;
  
  // 更新提醒状态
  updateStatus(id: string, status: Reminder['status']): Promise<void>;
}

// 活动监控服务协议
interface ActivityMonitorProtocol {
  // 开始监控
  startMonitoring(): Promise<void>;
  
  // 停止监控
  stopMonitoring(): Promise<void>;
  
  // 获取活动摘要
  getActivitySummary(timeRange: TimeRange): Promise<ActivitySummary>;
  
  // 获取应用使用统计
  getAppUsageStats(timeRange: TimeRange): Promise<AppUsageStats[]>;
}

// 报告生成服务协议
interface ReportServiceProtocol {
  // 生成日报
  generateDailyReport(date: Date): Promise<DailyReport>;
  
  // 生成周报
  generateWeeklyReport(weekStart: Date): Promise<WeeklyReport>;
  
  // 生成工作周报（用于汇报）
  generateWorkWeeklyReport(weekStart: Date): Promise<WorkWeeklyReport>;
}

// 外部 API 服务协议
interface ExternalApiServiceProtocol {
  // 连接 RiskControl
  connectRiskControl(config: ApiConfig): Promise<void>;
  
  // 获取投资组合数据
  getPortfolioData(): Promise<PortfolioData>;
  
  // 连接 GitHub
  connectGitHub(token: string): Promise<void>;
  
  // 获取 GitHub 活动
  getGitHubActivity(repos: string[]): Promise<GitHubActivity[]>;
  
  // 连接 Apple Health
  connectAppleHealth(): Promise<void>;
  
  // 获取健康数据
  getHealthData(timeRange: TimeRange): Promise<HealthData>;
}
```

---

## Data Models

### 数据库 Schema (SQLite)

```sql
-- 笔记表
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  domain TEXT NOT NULL,
  tags TEXT,  -- JSON array
  memory_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 任务表
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  deadline DATETIME,
  domain TEXT NOT NULL,
  assignee_id TEXT,
  parent_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (assignee_id) REFERENCES team_members(id),
  FOREIGN KEY (parent_id) REFERENCES tasks(id)
);

-- 提醒表
CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  scheduled_at DATETIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  context TEXT,  -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 情绪记录表
CREATE TABLE emotional_states (
  id TEXT PRIMARY KEY,
  mood TEXT NOT NULL,
  energy INTEGER NOT NULL,
  stress INTEGER NOT NULL,
  source TEXT,
  notes TEXT,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 团队成员表
CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  preferences TEXT,  -- JSON
  last_one_on_one DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 家庭成员表
CREATE TABLE family_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  birthdate DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 里程碑表
CREATE TABLE milestones (
  id TEXT PRIMARY KEY,
  family_member_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  milestone_date DATE NOT NULL,
  type TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_member_id) REFERENCES family_members(id)
);

-- 活动记录表
CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  app_name TEXT NOT NULL,
  window_title TEXT,
  domain TEXT,
  project TEXT,
  duration_seconds INTEGER NOT NULL,
  started_at DATETIME NOT NULL,
  ended_at DATETIME NOT NULL
);

-- 同步状态表
CREATE TABLE sync_status (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'create', 'update', 'delete'
  synced BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### memU 记忆存储

memU 使用自己的存储格式，包含三层：

```
Resource Layer (原始资源)
    ↓
Memory Item Layer (记忆项)
    ↓
Memory Category Layer (记忆类别)
```

配置示例：
```python
from memu.app import MemoryService

service = MemoryService(
    llm_profiles={
        "default": {
            "api_key": "gemini-api-key",
            "model": "gemini-pro"
        }
    },
    retrieve_config={
        "method": "rag"  # 或 "llm" 用于深度理解
    }
)
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*



### Property 1: Note Save and Memory Creation
*For any* valid note content (non-empty, non-whitespace), saving the note SHALL result in:
1. The note being persisted in the database
2. A corresponding memory item being created in the Memory_System
3. The input field being cleared

**Validates: Requirements 1.2, 1.4**

### Property 2: Empty Note Rejection
*For any* string composed entirely of whitespace characters, attempting to save it as a note SHALL be rejected, and no note or memory item SHALL be created.

**Validates: Requirements 1.3**

### Property 3: Task Default Priority
*For any* newly created task without an explicit priority, the task SHALL have priority "medium".

**Validates: Requirements 2.1**

### Property 4: Task Completion Timestamp
*For any* task that is marked as complete, the completion timestamp SHALL be recorded and SHALL be greater than or equal to the creation timestamp.

**Validates: Requirements 2.4**

### Property 5: Data Export/Import Round-Trip
*For any* valid dataset (notes, tasks, settings), exporting to JSON and then importing SHALL produce an equivalent dataset.

**Validates: Requirements 8.4, 8.5**

### Property 6: File Indexing Completeness
*For any* folder added to watch, all supported files in that folder SHALL be indexed within the configured timeout.

**Validates: Requirements 7.1**

### Property 7: Search Result Relevance
*For any* search query that matches known document content, the search results SHALL include that document.

**Validates: Requirements 7.4**

### Property 8: OCR and Translation Pipeline
*For any* image containing readable text, the OCR + translation pipeline SHALL produce non-empty translated text.

**Validates: Requirements 4.2, 4.3**

### Property 9: Activity Capture Completeness
*For any* user activity (app switch, text input, clipboard change), the Activity_Monitor SHALL capture and store the activity within 1 second.

**Validates: Requirements 15.1, 15.7, 15.8**

### Property 10: Family Record Chronological Order
*For any* set of family member records (milestones, moments), retrieving them SHALL return them in chronological order.

**Validates: Requirements 26.1**

### Property 11: Reminder Scheduling Consistency
*For any* task with a deadline, a reminder SHALL be scheduled before the deadline according to user preferences.

**Validates: Requirements 2.5**

### Property 12: Sync Consistency
*For any* data modification on device A, after sync completes, device B SHALL have the same data state.

**Validates: Requirements 8.1**

---

## Error Handling

### 错误处理策略

遵循用户偏好的"优雅降级"模式：

```typescript
// 单个操作失败不影响整体
async function processMultipleItems<T>(
  items: T[],
  processor: (item: T) => Promise<Result>
): Promise<Result[]> {
  const results: Result[] = [];
  
  for (const item of items) {
    try {
      const result = await processor(item);
      results.push(result);
    } catch (error) {
      console.warn('Item processing failed, continuing:', error);
      results.push(createFallbackResult(item, error));
      // 继续处理下一个
    }
  }
  
  return results;
}
```

### 错误类型

```typescript
// 错误状态枚举
type OperationStatus = 'success' | 'partial' | 'failed' | 'skipped';

interface OperationResult<T> {
  status: OperationStatus;
  data?: T;
  message: string;
  error?: string;
}

// 具体错误类型
class MemoryExtractionError extends Error {
  constructor(message: string, public readonly source: string) {
    super(message);
    this.name = 'MemoryExtractionError';
  }
}

class SyncConflictError extends Error {
  constructor(
    message: string,
    public readonly localVersion: unknown,
    public readonly remoteVersion: unknown
  ) {
    super(message);
    this.name = 'SyncConflictError';
  }
}

class ExternalApiError extends Error {
  constructor(
    message: string,
    public readonly apiName: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'ExternalApiError';
  }
}
```

### 重试策略

```typescript
// 指数退避重试
async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  }
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const delay = Math.min(
        options.baseDelay * Math.pow(2, attempt),
        options.maxDelay
      );
      await sleep(delay);
    }
  }
  
  throw lastError!;
}
```

---

## Testing Strategy

### 测试框架

| 类型 | 框架 | 用途 |
|------|------|------|
| 单元测试 | Vitest | 组件和服务测试 |
| 属性测试 | fast-check | 正确性属性验证 |
| E2E 测试 | Playwright | 端到端流程测试 |
| 组件测试 | Testing Library | React 组件测试 |

### 属性测试配置

```typescript
import fc from 'fast-check';

// 配置：每个属性测试至少 100 次迭代
const FC_CONFIG = { numRuns: 100 };

// 生成器示例
const arbitraryNote = (): fc.Arbitrary<Note> =>
  fc.record({
    id: fc.uuid(),
    content: fc.string({ minLength: 1 }),
    type: fc.constantFrom('text', 'voice', 'image'),
    tags: fc.array(fc.string()),
    domain: fc.constantFrom('work', 'investment', 'development', 'learning', 'family', 'health', 'entertainment'),
    createdAt: fc.date(),
    updatedAt: fc.date(),
  });

const arbitraryTask = (): fc.Arbitrary<Task> =>
  fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 1 }),
    description: fc.option(fc.string()),
    priority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
    status: fc.constantFrom('pending', 'in_progress', 'completed', 'cancelled'),
    deadline: fc.option(fc.date()),
    domain: fc.constantFrom('work', 'investment', 'development', 'learning', 'family', 'health', 'entertainment'),
    createdAt: fc.date(),
  });
```

### 测试文件组织

```
src/
├── services/
│   ├── memoryService.ts
│   ├── memoryService.test.ts      # 单元测试
│   └── memoryService.property.test.ts  # 属性测试
├── hooks/
│   ├── useMemory.ts
│   └── useMemory.test.ts
└── components/
    ├── notes/
    │   ├── NoteInput.tsx
    │   └── NoteInput.test.tsx
```

### 属性测试示例

```typescript
// **Feature: ai-personal-assistant, Property 1: Note Save and Memory Creation**
describe('Property 1: Note Save and Memory Creation', () => {
  it('should persist note and create memory for any valid content', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async (content) => {
          const note = await noteService.save({ content });
          
          // 笔记应该被持久化
          const savedNote = await noteService.getById(note.id);
          expect(savedNote).toBeDefined();
          expect(savedNote.content).toBe(content);
          
          // 记忆项应该被创建
          const memory = await memoryService.getByNoteId(note.id);
          expect(memory).toBeDefined();
        }
      ),
      FC_CONFIG
    );
  });
});

// **Feature: ai-personal-assistant, Property 5: Data Export/Import Round-Trip**
describe('Property 5: Data Export/Import Round-Trip', () => {
  it('should preserve data after export and import', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryNote()),
        fc.array(arbitraryTask()),
        async (notes, tasks) => {
          // 设置初始数据
          await dataService.setNotes(notes);
          await dataService.setTasks(tasks);
          
          // 导出
          const exported = await dataService.export();
          
          // 清空并导入
          await dataService.clear();
          await dataService.import(exported);
          
          // 验证数据一致
          const importedNotes = await dataService.getNotes();
          const importedTasks = await dataService.getTasks();
          
          expect(importedNotes).toEqual(notes);
          expect(importedTasks).toEqual(tasks);
        }
      ),
      FC_CONFIG
    );
  });
});
```

---

## 参考项目集成

### memU 集成

```python
# ai_service/memory_service.py
from memu.app import MemoryService

class EchoMemoryService:
    def __init__(self, api_key: str):
        self.service = MemoryService(
            llm_profiles={"default": {"api_key": api_key}},
            retrieve_config={"method": "rag"}
        )
    
    async def memorize_note(self, note: dict) -> dict:
        """将笔记存入记忆系统"""
        return await self.service.memorize(
            resource_url=None,
            modality="text",
            content=note["content"],
            metadata={"note_id": note["id"], "domain": note["domain"]}
        )
    
    async def retrieve(self, query: str, domain: str = None) -> list:
        """检索相关记忆"""
        queries = [{"role": "user", "content": {"text": query}}]
        where = {"domain": domain} if domain else None
        return await self.service.retrieve(queries=queries, where=where)
```

### Tauri 后端集成

```rust
// src-tauri/src/main.rs
use tauri::Manager;

#[tauri::command]
async fn capture_activity(app_name: String, window_title: String) -> Result<(), String> {
    // 记录活动到数据库
    Ok(())
}

#[tauri::command]
async fn get_clipboard_content() -> Result<String, String> {
    // 获取剪贴板内容
    Ok(String::new())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            capture_activity,
            get_clipboard_content,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Python AI 服务通信

```typescript
// services/aiService.ts
import { invoke } from '@tauri-apps/api/tauri';

export class AiService {
  // 通过 Tauri 调用 Python 服务
  async memorize(content: string, domain: string): Promise<MemoryResult> {
    return await invoke('memorize', { content, domain });
  }
  
  async retrieve(query: string, domain?: string): Promise<MemoryItem[]> {
    return await invoke('retrieve', { query, domain });
  }
  
  async generateReport(type: 'daily' | 'weekly', date: string): Promise<Report> {
    return await invoke('generate_report', { type, date });
  }
}
```
