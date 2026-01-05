# Design Document: Investment Module Migration

## Overview

将 RiskControl 独立应用 (`packages/riskcontrol`) 中的完整投资功能移植到 Echo 前端 (`packages/echo`) 的投资模块中。移植需要进行组件库转换（shadcn/ui → HeroUI）和状态管理转换（Zustand → MobX）。

## 经验教训（来自 investment-notes-integration）

### 🔴 数据库权限问题（最常见）

investment-notes-integration 实施过程中，最大的问题是 **Supabase RLS (Row Level Security) 权限**：

1. **问题表现**：前端调用 Supabase 时返回空数组或权限错误
2. **根本原因**：
   - Supabase 默认启用 RLS，需要配置策略
   - `anon` 和 `authenticated` 角色缺少表权限
   - 序列（SEQUENCE）权限未授予
3. **解决方案**：
   - 开发环境：直接禁用 RLS (`ALTER TABLE xxx DISABLE ROW LEVEL SECURITY`)
   - 生产环境：配置允许所有操作的策略
   - 授予角色权限：`GRANT ALL ON xxx TO anon, authenticated`
   - 授予序列权限：`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated`

**相关修复脚本**：
- `scripts/fix-schema-permissions.ts` - 修复 schema 权限
- `scripts/fix-documents-rls.ts` - 配置 RLS 策略
- `scripts/disable-documents-rls.ts` - 禁用 RLS（开发环境）
- `scripts/create-documents-table.ts` - 创建表结构

### 🟡 数据库客户端初始化

1. **问题**：Store 中直接使用 `createClient` 导致多次初始化
2. **解决方案**：使用 `packages/shared/database` 的单例模式
   ```typescript
   import { getDatabaseClient, initDatabaseClient } from '@echoai/shared/database';
   
   // 初始化（只需一次）
   initDatabaseClient({ rcSupabaseUrl, rcSupabaseAnonKey });
   
   // 获取客户端
   const client = getDatabaseClient()?.riskcontrol;
   ```

### 🟡 环境变量配置

1. **问题**：前端环境变量必须以 `VITE_` 前缀
2. **必需变量**：
   ```
   VITE_SUPABASE_URL=https://lyqspnecudllmnajrrlm.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### 🟡 MobX Store 模式

1. **问题**：直接在 Store 中使用 `useEffect` 会报错
2. **解决方案**：
   - Store 提供 `use()` 方法供组件调用
   - 组件中使用 `useEffect` 调用 `store.use()`
   - 使用 `runInAction` 包装异步状态更新

### 🟢 组件库转换注意事项

| shadcn/ui | HeroUI | 注意事项 |
|-----------|--------|----------|
| `Card` | `Card, CardBody, CardHeader` | HeroUI 需要分开使用 |
| `Dialog` | `Modal, ModalContent, ...` | 结构完全不同 |
| `Badge` | `Chip` | 名称不同 |
| `ScrollArea` | `ScrollShadow` | 功能类似但 API 不同 |

### 🟢 测试验证流程

每个功能移植后必须验证：
1. **数据库连接**：运行 `scripts/test-supabase-connection.ts`
2. **权限检查**：确认 RLS 状态和角色权限
3. **前端功能**：启动 dev server 手动测试 CRUD
4. **错误处理**：验证网络错误、空数据等边界情况

## Architecture

### 源码与目标映射

| RiskControl 源文件 | Echo 目标文件 | 当前状态 | 优先级 |
|-------------------|--------------|----------|--------|
| `pages/InvestmentMirror.tsx` | `pages/investment/mirror.tsx` | 占位符 | P0 |
| `pages/VoiceCall.tsx` | `pages/investment/voice.tsx` | 占位符 | P1 |
| `pages/RiskEngine.tsx` | `pages/investment/risk/engine.tsx` | 基本 UI | P1 |
| `pages/AnnualReview2025.tsx` | `pages/investment/annual-review.tsx` | 大部分完成 | P2 |
| `pages/MarketAnalysis.tsx` | `pages/investment/market.tsx` | 模拟数据 | P2 |
| `pages/DecisionCenter.tsx` | `pages/investment/decision.tsx` | 模拟数据 | P2 |
| `pages/IntelligentRisk.tsx` | `pages/investment/risk/intelligent.tsx` | 基本 UI | P2 |
| `pages/DynamicNotes.tsx` | `pages/investment/notes.tsx` | ✅ 已完成 | - |

### 组件库映射

| shadcn/ui | HeroUI | 备注 |
|-----------|--------|------|
| `Card` | `Card, CardBody, CardHeader` | 结构略有不同 |
| `Button` | `Button` | 直接对应 |
| `Input` | `Input` | 直接对应 |
| `Select` | `Select, SelectItem` | 需要 SelectItem |
| `Tabs` | `Tabs, Tab` | 需要 Tab |
| `Dialog` | `Modal, ModalContent, ModalHeader, ModalBody, ModalFooter` | 结构不同 |
| `Badge` | `Chip` | 名称不同 |
| `Progress` | `Progress` | 直接对应 |
| `Skeleton` | `Skeleton` | 直接对应 |
| `Tooltip` | `Tooltip` | 直接对应 |
| `ScrollArea` | `ScrollShadow` | 功能类似 |

### 状态管理转换

```typescript
// RiskControl (Zustand)
const { data, loading } = useDashboardStore();

// Echo (MobX)
import { observer } from 'mobx-react-lite';
import { RootStore } from '@/store';
import { InvestmentStore } from '@/store/investmentStore';

const store = RootStore.Get(InvestmentStore);
// 组件需要用 observer() 包装
```

### 数据库架构

```
┌─────────────────────────────────────────────────────────┐
│                    Investment DB                         │
│              (lyqspnecudllmnajrrlm)                      │
├─────────────────────────────────────────────────────────┤
│  stock_positions    - 股票持仓                          │
│  transactions       - 交易记录                          │
│  dashboard_snapshots - 仪表盘快照（年度回顾数据源）      │
│  documents          - 投资笔记（已由 notes 功能使用）    │
│  conversations      - AI 对话记录                       │
│  watchlist          - 观察列表                          │
│  alerts             - 预警配置                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                      Echo DB                             │
│              (jwiocrwhqeomoybbwqcp)                      │
├─────────────────────────────────────────────────────────┤
│  notes              - Echo 笔记                         │
│  tags               - 标签                              │
│  users              - 用户                              │
│  ai_conversations   - Echo AI 对话                      │
└─────────────────────────────────────────────────────────┘
```

**禁止跨库 JOIN，需要聚合数据时通过 API 层处理。**

## Components and Interfaces

### 需要移植的核心组件

#### 1. 投资镜像组件 (P0)
```
packages/echo/src/components/InvestmentChat/
├── ChatSidebar.tsx      # 对话列表侧边栏
├── ChatWindow.tsx       # 聊天窗口主体
├── ChatMessage.tsx      # 消息气泡
├── ChatInput.tsx        # 输入框
└── index.ts
```

源文件参考：
- `packages/riskcontrol/src/components/chat/ChatSidebar.tsx`
- `packages/riskcontrol/src/components/chat/ChatWindow.tsx`

#### 2. 语音通话组件 (P1)
```
packages/echo/src/components/InvestmentVoice/
├── VoiceOrb.tsx         # Siri 风格动画球
├── VoiceControls.tsx    # 通话控制按钮
├── VoiceTranscript.tsx  # 实时转录显示
└── index.ts
```

源文件参考：
- `packages/riskcontrol/src/components/voice/EnhancedVoiceAssistant.tsx`

#### 3. 风险引擎组件 (P1)
```
packages/echo/src/components/InvestmentRisk/
├── RiskDashboard.tsx    # 风控仪表盘
├── RiskAlertPanel.tsx   # 风险预警面板
├── RiskForecastChart.tsx # 风险预测图表
├── RiskHistoryChart.tsx  # 历史分析图表
├── RiskConfigPanel.tsx   # 参数配置面板
└── index.ts
```

源文件参考：
- `packages/riskcontrol/src/components/risk/RiskDashboard.tsx`
- `packages/riskcontrol/src/components/risk/RiskAlertPanel.tsx`
- `packages/riskcontrol/src/components/risk/RiskForecastChart.tsx`
- `packages/riskcontrol/src/components/risk/RiskHistoryChart.tsx`
- `packages/riskcontrol/src/components/risk/RiskConfigPanel.tsx`

### InvestmentStore 扩展

```typescript
// packages/echo/src/store/investmentStore.ts 需要添加：

// 对话相关
conversations: Conversation[];
currentConversationId: number | null;
loadingConversations: boolean;

// 语音通话相关
voiceCallActive: boolean;
voiceTranscript: string[];
voiceConnectionState: 'disconnected' | 'connecting' | 'connected';

// 风险引擎相关
riskConfig: RiskConfig;
riskAlerts: RiskAlert[];
riskForecast: RiskForecast | null;

// 方法
fetchConversations(): Promise<void>;
createConversation(): Promise<number>;
sendMessage(conversationId: number, message: string): Promise<void>;
connectVoice(): Promise<void>;
disconnectVoice(): void;
updateRiskConfig(config: Partial<RiskConfig>): Promise<void>;
```

## Data Models

### Conversation 类型
```typescript
interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}
```

### RiskConfig 类型
```typescript
interface RiskConfig {
  maxDrawdown: number;        // 最大回撤阈值 (%)
  maxLeverage: number;        // 最大杠杆
  maxPositionSize: number;    // 单一持仓上限 (%)
  stopLossPercent: number;    // 止损百分比
  circuitBreakerEnabled: boolean;
}

interface RiskAlert {
  id: number;
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  created_at: string;
  acknowledged: boolean;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

由于这是 UI 移植工作，主要关注功能完整性。以下属性聚焦于数据持久化和核心业务逻辑。

### Property 1: 对话 CRUD 一致性
*For any* conversation created in the investment mirror, the following operations SHALL maintain data consistency:
- Creating a conversation SHALL add it to the database and return a valid ID
- Selecting a conversation SHALL load all its messages in chronological order
- Sending a message SHALL persist it to the database and appear in the conversation
- Reloading the page SHALL display the same conversations and messages
**Validates: Requirements 1.2, 1.3, 1.4, 1.5**

### Property 2: 风险配置持久化
*For any* risk configuration saved by the user, the following SHALL hold:
- Saving configuration SHALL persist all threshold values to the database
- Reloading the risk engine page SHALL display the same configuration values
- Invalid configuration values SHALL be rejected with validation errors
**Validates: Requirements 3.5, 3.6**

### Property 3: 年度回顾数据计算
*For any* set of dashboard_snapshots data, the annual review calculations SHALL be consistent:
- YTD return = (endNav - startNav) / startNav * 100
- Max drawdown SHALL be calculated correctly from peak to trough
- Monthly returns SHALL sum to approximately the YTD return
- Best/worst days SHALL be correctly sorted by daily P&L percentage
**Validates: Requirements 4.2, 4.4**

### Property 4: 市场数据显示和搜索
*For any* market data fetched from the data source:
- All indices SHALL display price, change, and change percentage
- Hot stocks SHALL be correctly sorted by change percentage (gainers/losers)
- Search results SHALL contain only stocks matching the search query
- Empty search query SHALL return all stocks
**Validates: Requirements 5.2, 5.3, 5.4, 5.5**

### Property 5: AI 决策建议格式
*For any* AI-generated investment suggestion:
- The suggestion SHALL include a confidence level (0-100%)
- The suggestion SHALL include a risk assessment (low/medium/high)
- The suggestion SHALL include a recommendation type (buy/hold/sell)
**Validates: Requirements 6.4, 6.5**

### Property 6: 风险分析数据格式
*For any* AI-generated risk analysis:
- The analysis SHALL include risk factors with descriptions
- The analysis SHALL include recommendations
- The analysis SHALL include confidence levels for each assessment
**Validates: Requirements 7.2, 7.3**

### Property 7: TypeScript 类型安全
*For any* migrated component, the TypeScript compiler SHALL report no type errors.
**Validates: Requirements 9.5**

## Error Handling

1. **网络错误**：显示错误提示和重试按钮
2. **API 调用失败**：优雅降级，显示缓存数据或占位符
3. **组件渲染错误**：使用 ErrorBoundary 捕获，显示友好错误页面
4. **LiveKit 连接失败**：显示连接状态，提供重连选项
5. **数据库查询失败**：记录日志，显示用户友好的错误消息

## Testing Strategy

### 手动验证
- 启动 Echo dev server 验证页面功能
- 对比 RiskControl 和 Echo 的页面效果
- 验证数据加载、交互、导航等功能

### 功能测试清单
- [ ] 投资镜像：创建对话、发送消息、切换对话
- [ ] 语音通话：连接、断开、转录显示
- [ ] 风险引擎：Tab 切换、配置保存、图表渲染
- [ ] 年度回顾：数据加载、图表显示、AI 分析
- [ ] 市场分析：数据刷新、搜索、Tab 切换
- [ ] 决策中心：AI 问答、建议显示

### 响应式测试
- 桌面端 (1920x1080)
- 平板端 (768x1024)
- 移动端 (375x812)

