# Design Document - Echo on Blinko

## Introduction

本文档描述在 Blinko 代码库基础上扩展 Echo 功能的技术设计。

### 设计原则

1. **最小侵入** - 尽量扩展而非修改 Blinko 核心代码
2. **参考真实实现** - 每个组件都要研究参考项目的代码
3. **复用 Blinko 基础设施** - 使用 Blinko 已有的 tRPC、Prisma、pg-boss 等

### 项目结构

```
get/blinko-main/                    # 基础项目
├── app/                            # 前端 + Tauri
│   ├── src/                        # React 前端
│   │   ├── pages/                  # 页面
│   │   │   ├── translation.tsx     # [新增] 翻译页面
│   │   │   └── activity.tsx        # [新增] 活动统计页面
│   │   └── components/             # 组件
│   │       └── echo/               # [新增] Echo 扩展组件
│   └── tauri-plugin-blinko/        # Tauri 插件
│       └── src/
│           ├── screenshot.rs       # [新增] 截图功能
│           ├── selection.rs        # [新增] 划词获取
│           └── activity.rs         # [新增] 活动监控
├── server/                         # 后端
│   ├── aiServer/
│   │   └── translation.ts          # [新增] 翻译服务
│   ├── routerTrpc/
│   │   ├── domain.ts               # [新增] 领域管理
│   │   ├── activity.ts             # [新增] 活动记录
│   │   └── translation.ts          # [新增] 翻译 API
│   └── jobs/
│       └── dailyReportJob.ts       # [新增] 日报生成
└── prisma/
    └── schema.prisma               # [扩展] 新增表
```

### 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        Echo on Blinko                           │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React + HeroUI + Tailwind)                           │
│  ├── Blinko 原有页面 (笔记、设置、AI 对话)                        │
│  └── Echo 扩展页面 (翻译、活动统计)                               │
├─────────────────────────────────────────────────────────────────┤
│  tRPC API Layer                                                 │
│  ├── Blinko 原有路由 (notes, tags, ai, config)                  │
│  └── Echo 扩展路由 (translation, activity, domain)              │
├─────────────────────────────────────────────────────────────────┤
│  Backend Services                                               │
│  ├── Blinko 保留: pg-boss, Prisma, AI Multi-Provider, RAG       │
│  └── Echo 扩展:                                                  │
│      ├── Translation Service (翻译 + OCR)                       │
│      ├── Activity Service (活动统计)                             │
│      └── Daily Report Job (日报生成)                             │
├─────────────────────────────────────────────────────────────────┤
│  Tauri Plugin (tauri-plugin-blinko 扩展)                        │
│  ├── Blinko 原有: setcolor, open_app_settings, shortcuts        │
│  └── Echo 扩展:                                                  │
│      ├── screenshot.rs (截图功能)                                │
│      ├── selection.rs (划词获取)                                 │
│      └── activity.rs (活动监控)                                  │
├─────────────────────────────────────────────────────────────────┤
│  Database (PostgreSQL)                                          │
│  ├── Blinko 原有表 (notes, tags, accounts, etc.)                │
│  └── Echo 扩展表 (domains, activityRecords, translations)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Designs

### Component 1: 截图服务

**对应需求**: Requirement 1 (截图翻译功能)

**参考实现**: [Pot screenshot.rs](https://github.com/pot-app/pot-desktop/blob/master/src-tauri/src/screenshot.rs)

#### 接口设计

```rust
// app/tauri-plugin-blinko/src/screenshot.rs

use screenshots::Screen;

/// 截图区域
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenRegion {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// 截图结果
#[derive(Debug, Clone, Serialize)]
pub struct ScreenshotResult {
    /// Base64 编码的 PNG 图片
    pub image_base64: String,
    /// 截图区域
    pub region: ScreenRegion,
}

/// Tauri 命令
#[tauri::command]
pub async fn capture_screen_region(region: ScreenRegion) -> Result<ScreenshotResult, String>;

#[tauri::command]
pub async fn get_screen_info() -> Result<Vec<ScreenInfo>, String>;
```

#### TypeScript 绑定

```typescript
// app/src/lib/screenshot.ts
import { invoke } from '@tauri-apps/api/core';

export interface ScreenRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenshotResult {
  image_base64: string;
  region: ScreenRegion;
}

export async function captureScreenRegion(region: ScreenRegion): Promise<ScreenshotResult> {
  return invoke<ScreenshotResult>('capture_screen_region', { region });
}
```

---

### Component 2: 划词获取服务

**对应需求**: Requirement 2 (划词翻译功能)

**参考实现**: [Pot selection.rs](https://github.com/pot-app/pot-desktop/blob/master/src-tauri/src/selection.rs)

#### 接口设计

```rust
// app/tauri-plugin-blinko/src/selection.rs

use arboard::Clipboard;

/// Tauri 命令 - 获取当前选中的文本
#[tauri::command]
pub async fn get_selected_text() -> Result<String, String> {
    // 1. 保存当前剪贴板内容
    // 2. 模拟 Cmd+C / Ctrl+C
    // 3. 读取剪贴板
    // 4. 恢复原剪贴板内容
    // 5. 返回选中文本
}
```

#### 实现流程

```
触发划词 → 保存剪贴板 → 模拟 Cmd+C → 读取剪贴板 → 恢复剪贴板 → 返回文本
```

---

### Component 3: 翻译服务

**对应需求**: Requirement 3 (翻译服务集成)

#### 接口设计

```typescript
// server/aiServer/translation.ts

interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

interface OCRResult {
  text: string;
  confidence: number;
}

export class TranslationService {
  /** 翻译文本 */
  async translate(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<TranslationResult>;
  
  /** OCR 识别图片中的文字 */
  async ocr(imageBase64: string): Promise<OCRResult>;
  
  /** OCR + 翻译 */
  async ocrAndTranslate(
    imageBase64: string,
    targetLanguage: string
  ): Promise<TranslationResult & { ocrResult: OCRResult }>;
}
```

#### 实现策略

使用 Blinko 已配置的 AI 模型：

```typescript
export class TranslationServiceImpl implements TranslationService {
  async translate(text: string, targetLanguage: string) {
    // 使用 Blinko 的 AiModelFactory
    const agent = await AiModelFactory.BaseChatAgent({ withTools: false });
    
    const result = await agent.generate([
      { role: 'system', content: `Translate to ${targetLanguage}. Only output the translation.` },
      { role: 'user', content: text },
    ]);
    
    return { originalText: text, translatedText: result.text, ... };
  }
  
  async ocr(imageBase64: string) {
    // 使用 Blinko 的图片描述功能
    const description = await AiModelFactory.describeImage(imageBase64);
    return { text: description, confidence: 1.0 };
  }
}
```

---

### Component 4: 翻译 tRPC 路由

**对应需求**: Requirement 3, 8

#### 接口设计

```typescript
// server/routerTrpc/translation.ts

export const translationRouter = router({
  // 翻译文本
  translate: protectedProcedure
    .input(z.object({
      text: z.string(),
      targetLanguage: z.string().default('zh-CN'),
      sourceLanguage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const service = new TranslationService();
      return service.translate(input.text, input.targetLanguage, input.sourceLanguage);
    }),
  
  // OCR + 翻译
  ocrAndTranslate: protectedProcedure
    .input(z.object({
      imageBase64: z.string(),
      targetLanguage: z.string().default('zh-CN'),
    }))
    .mutation(async ({ input }) => {
      const service = new TranslationService();
      return service.ocrAndTranslate(input.imageBase64, input.targetLanguage);
    }),
  
  // 获取翻译历史
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      return prisma.translationHistory.findMany({
        where: { accountId: ctx.id },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
    }),
});
```

---

### Component 5: 活动监控服务

**对应需求**: Requirement 5 (活动监控服务)

**参考实现**: [ActivityWatch aw-watcher-window](https://github.com/ActivityWatch/aw-watcher-window)

#### 接口设计

```rust
// app/tauri-plugin-blinko/src/activity.rs

/// 活动记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityRecord {
    pub app_name: String,
    pub window_title: String,
    pub start_time: i64,  // Unix timestamp
    pub duration: u64,    // 秒
}

/// 活动监控服务
pub struct ActivityMonitor {
    current_activity: Option<ActivityRecord>,
    poll_interval: u64,  // 秒
    is_running: bool,
}

impl ActivityMonitor {
    /// 开始监控
    pub fn start(&mut self) -> Result<(), String>;
    
    /// 停止监控
    pub fn stop(&mut self) -> Result<(), String>;
    
    /// 获取当前活动窗口信息 (macOS)
    #[cfg(target_os = "macos")]
    fn get_active_window() -> Result<(String, String), String>;
    
    /// 获取当前活动窗口信息 (Windows)
    #[cfg(target_os = "windows")]
    fn get_active_window() -> Result<(String, String), String>;
}

/// Tauri 命令
#[tauri::command]
pub async fn start_activity_monitoring() -> Result<(), String>;

#[tauri::command]
pub async fn stop_activity_monitoring() -> Result<(), String>;

#[tauri::command]
pub async fn get_current_activity() -> Result<Option<ActivityRecord>, String>;
```

---

### Component 6: 领域管理

**对应需求**: Requirement 6 (领域管理)

#### 数据模型

```prisma
// prisma/schema.prisma 扩展

model domain {
  id          Int      @id @default(autoincrement())
  name        String   @db.VarChar(100)
  icon        String?  @db.VarChar(50)
  color       String?  @db.VarChar(20)
  description String?  @db.Text
  accountId   Int
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @db.Timestamptz(6)
  
  notes       notes[]
  activities  activityRecord[]
  account     accounts @relation(fields: [accountId], references: [id])
}

model activityRecord {
  id          Int      @id @default(autoincrement())
  appName     String   @db.VarChar(255)
  windowTitle String   @db.Text
  domainId    Int?
  startTime   DateTime @db.Timestamptz(6)
  duration    Int      // 秒
  accountId   Int
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  
  domain      domain?  @relation(fields: [domainId], references: [id])
  account     accounts @relation(fields: [accountId], references: [id])
  
  @@index([accountId, startTime])
}

model translationHistory {
  id             Int      @id @default(autoincrement())
  originalText   String   @db.Text
  translatedText String   @db.Text
  sourceLanguage String   @db.VarChar(20)
  targetLanguage String   @db.VarChar(20)
  type           String   @db.VarChar(20)  // 'text' | 'screenshot'
  accountId      Int
  createdAt      DateTime @default(now()) @db.Timestamptz(6)
  
  account        accounts @relation(fields: [accountId], references: [id])
}

// 扩展 notes 表
model notes {
  // ... 原有字段
  domainId    Int?
  domain      domain? @relation(fields: [domainId], references: [id])
}
```

#### tRPC 路由

```typescript
// server/routerTrpc/domain.ts

export const domainRouter = router({
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      icon: z.string().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return prisma.domain.create({
        data: { ...input, accountId: ctx.id },
      });
    }),
  
  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.domain.findMany({
      where: { accountId: ctx.id },
      orderBy: { sortOrder: 'asc' },
    });
  }),
  
  stats: protectedProcedure
    .input(z.object({ domainId: z.number() }))
    .query(async ({ ctx, input }) => {
      const [noteCount, activityTime] = await Promise.all([
        prisma.notes.count({
          where: { domainId: input.domainId, accountId: ctx.id },
        }),
        prisma.activityRecord.aggregate({
          where: { domainId: input.domainId, accountId: ctx.id },
          _sum: { duration: true },
        }),
      ]);
      return { noteCount, totalTime: activityTime._sum.duration || 0 };
    }),
});
```

---

### Component 7: 活动记录服务

**对应需求**: Requirement 7 (活动统计页面)

#### tRPC 路由

```typescript
// server/routerTrpc/activity.ts

export const activityRouter = router({
  // 按日期范围查询
  getByDateRange: protectedProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      return prisma.activityRecord.findMany({
        where: {
          accountId: ctx.id,
          startTime: { gte: input.startDate, lte: input.endDate },
        },
        include: { domain: true },
        orderBy: { startTime: 'asc' },
      });
    }),
  
  // 按应用分组统计
  statsByApp: protectedProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      return prisma.activityRecord.groupBy({
        by: ['appName'],
        where: {
          accountId: ctx.id,
          startTime: { gte: input.startDate, lte: input.endDate },
        },
        _sum: { duration: true },
        orderBy: { _sum: { duration: 'desc' } },
      });
    }),
  
  // 今日时间线
  todayTimeline: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return prisma.activityRecord.findMany({
      where: {
        accountId: ctx.id,
        startTime: { gte: today },
      },
      include: { domain: true },
      orderBy: { startTime: 'asc' },
    });
  }),
});
```

---

### Component 8: 日报生成任务

**对应需求**: Requirement 11 (日报生成)

#### 实现设计

```typescript
// server/jobs/dailyReportJob.ts

import { BaseScheduleJob } from "./baseScheduleJob";

export const DAILY_REPORT_TASK_NAME = "dailyReport";

export class DailyReportJob extends BaseScheduleJob {
  protected static taskName = DAILY_REPORT_TASK_NAME;
  protected static cronSchedule = '0 21 * * *'; // 每天 21:00
  
  protected static async RunTask(): Promise<void> {
    const accounts = await prisma.accounts.findMany();
    
    for (const account of accounts) {
      await this.generateReportForAccount(account.id);
    }
  }
  
  private static async generateReportForAccount(accountId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 获取今日数据
    const [notes, activities] = await Promise.all([
      prisma.notes.findMany({
        where: { accountId, createdAt: { gte: today } },
      }),
      prisma.activityRecord.findMany({
        where: { accountId, startTime: { gte: today } },
        include: { domain: true },
      }),
    ]);
    
    // 使用 AI 生成日报
    const agent = await AiModelFactory.BaseChatAgent({ withTools: false });
    const result = await agent.generate([
      {
        role: 'system',
        content: `生成简洁的日报总结，包含：今日亮点、时间分配、明日建议`,
      },
      {
        role: 'user',
        content: `今日笔记: ${notes.length} 条\n活动统计: ${this.summarizeActivities(activities)}`,
      },
    ]);
    
    // 创建日报笔记
    await prisma.notes.create({
      data: {
        content: `# 📊 ${today.toLocaleDateString('zh-CN')} 日报\n\n${result.text}`,
        type: 1,
        accountId,
        metadata: { isSystemGenerated: true, type: 'dailyReport' },
      },
    });
  }
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: 截图返回有效数据

*For any* 有效的屏幕区域，截图服务应返回非空的 base64 PNG 数据

**Validates: Requirements 1.2**

### Property 2: 剪贴板恢复

*For any* 划词操作，操作完成后剪贴板内容应与操作前相同

**Validates: Requirements 2.3**

### Property 3: 翻译一致性

*For any* 相同的输入文本和目标语言，翻译服务应返回相同的结果

**Validates: Requirements 3.1**

### Property 4: 活动记录连续性

*For any* 监控期间的窗口切换，活动记录应无遗漏

**Validates: Requirements 5.2, 5.3**

### Property 5: 领域统计准确性

*For any* 领域，其笔记数量统计应等于该领域下实际笔记数量

**Validates: Requirements 6.4**

---

## Error Handling

1. **截图失败**: 返回具体错误信息，不静默失败
2. **划词失败**: 返回空字符串，不抛出异常
3. **翻译失败**: 返回错误信息，保留原文
4. **活动监控失败**: 记录为"未知应用"，继续监控
5. **日报生成失败**: 记录错误日志，不影响其他用户

---

## Testing Strategy

### 单元测试

- 翻译服务：测试各语言翻译
- 领域管理：测试 CRUD 操作
- 活动统计：测试分组统计逻辑

### 属性测试 (fast-check)

- 截图服务：测试各种屏幕区域
- 剪贴板恢复：测试各种剪贴板内容
- 活动记录：测试时间计算准确性

### 集成测试

- 截图 → OCR → 翻译 完整流程
- 活动监控 → 数据库存储 → 统计查询
