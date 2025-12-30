# Echo 云同步服务

## 概述

Echo 云同步服务实现了本地 SeekDB 数据与 Supabase 云端的双向同步功能。

## 功能特性

- ✅ **双向同步**: 支持本地到云端、云端到本地的数据同步
- ✅ **增量同步**: 只同步变更的数据，减少网络传输
- ✅ **离线队列**: 离线时将变更存入队列，重连后自动同步
- ✅ **冲突检测**: 自动检测数据冲突，支持多种解决策略
- ✅ **自动同步**: 支持定时自动同步
- ✅ **状态监控**: 实时显示同步状态

## 使用方法

### 1. 配置 Supabase

在 Settings 页面配置 Supabase：

1. 输入 Supabase 项目 URL
2. 输入 Supabase Anon Key
3. 点击"测试连接"验证配置
4. 点击"保存配置"启用同步

### 2. 创建数据库表

在 Supabase 控制台执行 `echo/supabase/schema.sql` 中的 SQL 语句创建所需的表。

### 3. 在代码中使用

```typescript
import { useSync } from '../hooks/useSync';

function MyComponent() {
  const {
    status,           // 同步状态
    isConfigured,     // 是否已配置
    sync,             // 手动同步
    queueLength,      // 待同步项数量
  } = useSync();

  return (
    <div>
      <p>状态: {status.status}</p>
      <p>待同步: {queueLength}</p>
      <button onClick={sync}>同步</button>
    </div>
  );
}
```

### 4. 添加数据到同步队列

```typescript
import { queueNoteSync, queueTaskSync } from '../services/sync';

// 创建笔记后添加到同步队列
const note = await createNote({ content: '...' });
queueNoteSync(note.id, 'create', note);

// 更新任务后添加到同步队列
const task = await updateTask(taskId, { status: 'completed' });
queueTaskSync(task.id, 'update', task);
```

## 同步状态

| 状态 | 说明 |
|------|------|
| `idle` | 空闲，等待同步 |
| `syncing` | 正在同步 |
| `success` | 同步成功 |
| `error` | 同步失败 |
| `offline` | 离线状态 |
| `conflict` | 存在冲突 |

## 冲突解决策略

| 策略 | 说明 |
|------|------|
| `local` | 始终使用本地数据 |
| `remote` | 始终使用远程数据 |
| `newest` | 使用最新修改的数据（默认） |

## 文件结构

```
echo/src/services/sync/
├── index.ts              # 模块导出
├── supabaseClient.ts     # Supabase 客户端
├── syncService.ts        # 同步服务核心逻辑
└── README.md             # 本文档

echo/src/types/
└── sync.ts               # 同步相关类型定义

echo/src/hooks/
└── useSync.ts            # React Hook

echo/src/components/sync/
├── index.ts              # 组件导出
└── SyncStatusIndicator.tsx # 状态指示器组件

echo/supabase/
└── schema.sql            # 数据库表结构
```

## 注意事项

1. **离线模式**: 未配置 Supabase 时，应用完全在本地运行，不影响任何功能
2. **数据安全**: 使用 Supabase RLS（行级安全）确保用户只能访问自己的数据
3. **网络处理**: 自动处理网络断开和重连，无需手动干预
4. **版本控制**: 每条记录都有版本号，用于冲突检测
