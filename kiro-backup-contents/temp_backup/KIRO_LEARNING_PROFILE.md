# Kiro 学习档案 - 用户开发风格与偏好

> 这份文档记录了从 RiskControl 项目中学习到的用户开发风格、技术偏好和工作习惯。
> Kiro 在后续协作中应参考这些信息，提供更贴合用户习惯的建议和代码。

---

## 📋 目录

1. [代码架构偏好](#1-代码架构偏好)
2. [TypeScript 风格](#2-typescript-风格)
3. [测试策略](#3-测试策略)
4. [文档与注释风格](#4-文档与注释风格)
5. [技术栈偏好](#5-技术栈偏好)
6. [错误处理模式](#6-错误处理模式)
7. [命名规范](#7-命名规范)
8. [项目结构](#8-项目结构)
9. [工作流程偏好](#9-工作流程偏好)
10. [AI 集成模式](#10-ai-集成模式)

---

## 1. 代码架构偏好

### 分层架构
```
Pages (页面) 
  ↓
Components (组件)
  ↓
Hooks (状态逻辑)
  ↓
Services (业务逻辑)
  ↓
Types (类型定义)
```

### 设计原则
- **协议优先**: 先定义 Interface/Protocol，再实现具体类
- **单一职责**: 每个 Service 专注一个领域
- **依赖注入**: 通过参数传入依赖，便于测试
- **纯函数优先**: 尽量使用无副作用的纯函数

### 示例模式
```typescript
// 1. 先定义接口
interface OptimizerServiceProtocol {
  runAllTasks(): Promise<TaskResult[]>;
  runTask(task: OptimizationTask): Promise<TaskResult>;
}

// 2. 再实现具体类
class OptimizerService implements OptimizerServiceProtocol {
  // 实现...
}
```

---

## 2. TypeScript 风格

### 类型定义偏好
- 使用 `interface` 定义对象结构
- 使用 `type` 定义联合类型和别名
- 导出所有公共类型
- 类型文件集中在 `types/` 或 `*/types.ts`

### 示例
```typescript
// 联合类型用 type
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type OrchestrationMode = 'sequential' | 'selector' | 'handoff';

// 对象结构用 interface
export interface AgentResult {
  agentId: string;
  status: AgentResultStatus;
  data: Record<string, unknown>;
  summary: string;
  metadata: AgentResultMetadata;
}

// 带默认值的配置
export const DEFAULT_CONFIG: Config = {
  enabled: true,
  timeout: 60000,
};
```

### 严格模式
- 启用 `strict: true`
- 避免 `any`，使用 `unknown` 或泛型
- 所有函数参数和返回值都有类型

---

## 3. 测试策略

### 属性测试 (Property-Based Testing)
- **框架**: `fast-check` (TypeScript) 或 `SwiftCheck` (Swift)
- **迭代次数**: 每个属性测试至少 100 次
- **注释格式**: `**Validates: Requirements X.Y**`

### 测试文件组织
```
src/
  services/
    riskEngine.ts
    riskEngine.test.ts      # 同目录放置
  hooks/
    useDocumentsMeta.ts
    useDocumentsMeta.test.ts
```

### 属性测试模式
```typescript
import fc from 'fast-check';

describe('Property 1: Settings Round-Trip', () => {
  it('should preserve settings after serialize/deserialize', () => {
    fc.assert(
      fc.property(
        arbitrarySettings(),
        (settings) => {
          const serialized = JSON.stringify(settings);
          const deserialized = JSON.parse(serialized);
          expect(deserialized).toEqual(settings);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 生成器命名
- 使用 `arbitrary` 前缀: `arbitraryPosition()`, `arbitraryCurrency()`
- 生成器返回 `fc.Arbitrary<T>` 类型

---

## 4. 文档与注释风格

### 语言偏好
- **代码注释**: 中文
- **文档**: 中文
- **UI 文案**: 中文
- **变量/函数名**: 英文

### JSDoc 格式
```typescript
/**
 * 构建结构化投资组合上下文
 * 
 * 将投资组合数据转换为 JSON 格式的上下文字符串，供 AI 理解。
 * 
 * 特性：
 * - 货币单位分离：current_price.value + current_price.currency
 * - 位置截断：超过 20 个持仓时只保留 top 20
 * 
 * @param data - 投资组合上下文数据
 * @returns 格式化的上下文字符串
 * 
 * @example
 * ```typescript
 * const context = buildStructuredContext({
 *   summary: { ... },
 *   positions: [...],
 * });
 * ```
 */
export function buildStructuredContext(data: PortfolioContext): string {
  // ...
}
```

### 交接文档
- 文件名: `HANDOVER.md`
- 记录每次会话完成的工作
- 包含：完成的任务、修改的文件、待办事项、运行命令

---

## 5. 技术栈偏好

### 前端
| 类别 | 技术选择 |
|------|----------|
| 框架 | React 19 |
| 语言 | TypeScript 5.x |
| 样式 | Tailwind CSS 4.x |
| UI 组件 | Radix UI + shadcn/ui |
| 状态管理 | React Query + 自定义 Hooks |
| 路由 | wouter |
| 图表 | Recharts |
| 动画 | Framer Motion |

### 后端/API
| 类别 | 技术选择 |
|------|----------|
| Serverless | Vercel Functions |
| 数据库 | Supabase (PostgreSQL) |
| ORM | Drizzle ORM |
| AI | Google Gemini API |
| 向量搜索 | LightRAG |

### 测试
| 类别 | 技术选择 |
|------|----------|
| 单元测试 | Vitest |
| 属性测试 | fast-check |
| E2E | Playwright |
| 组件测试 | Testing Library |

### macOS 原生开发
| 类别 | 技术选择 |
|------|----------|
| 语言 | Swift 5.9+ |
| UI | SwiftUI |
| 架构 | MVVM |
| 测试 | XCTest + SwiftCheck |

---

## 6. 错误处理模式

### 优雅降级
```typescript
try {
  const result = await primaryService.fetch();
  return result;
} catch (error) {
  console.warn('Primary service failed, falling back:', error);
  return await fallbackService.fetch();
}
```

### 不中断流程
```typescript
// 单个任务失败不影响整体
for (const task of tasks) {
  try {
    const result = await executeTask(task);
    results.push(result);
  } catch (error) {
    results.push(createFallbackResult(task, error));
    // 继续执行下一个任务
  }
}
```

### 错误状态枚举
```typescript
type TaskStatus = 'success' | 'partial' | 'failed' | 'skipped';

interface TaskResult {
  status: TaskStatus;
  message: string;
  error?: string;
}
```

---

## 7. 命名规范

### 文件命名
| 类型 | 格式 | 示例 |
|------|------|------|
| 组件 | PascalCase | `RiskMetricsCard.tsx` |
| Hook | camelCase + use 前缀 | `useDocumentsMeta.ts` |
| Service | camelCase | `riskEngine.ts` |
| 类型 | camelCase 或 types | `types.ts`, `index.ts` |
| 测试 | 源文件名 + .test | `riskEngine.test.ts` |

### 变量命名
| 类型 | 格式 | 示例 |
|------|------|------|
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_TIMEOUT`, `MAX_POSITIONS` |
| 函数 | camelCase | `calculatePositions`, `buildContext` |
| 类 | PascalCase | `AgentOrchestrator`, `CacheManager` |
| 接口 | PascalCase | `AgentResult`, `PortfolioState` |
| 类型别名 | PascalCase | `RiskLevel`, `OrchestrationMode` |

### 目录命名
- 使用 camelCase: `services/`, `components/`, `hooks/`
- 功能模块用复数: `agents/`, `adapters/`

---

## 8. 项目结构

### 典型 React 项目结构
```
client/
├── src/
│   ├── components/          # UI 组件
│   │   ├── ui/              # 基础 UI 组件 (shadcn)
│   │   ├── dashboard/       # 仪表板相关
│   │   ├── chat/            # 聊天相关
│   │   └── settings/        # 设置相关
│   ├── hooks/               # 自定义 Hooks
│   ├── services/            # 业务逻辑服务
│   │   ├── agents/          # AI Agent 系统
│   │   └── adaptiveRag/     # RAG 服务
│   ├── pages/               # 页面组件
│   ├── types/               # 类型定义
│   ├── lib/                 # 工具函数
│   ├── data/                # 静态数据
│   └── assets/              # 静态资源
├── public/                  # 公共资源
└── package.json
```

### 典型 Swift 项目结构
```
MacBoostApp/
├── App/
│   └── MacBoostApp.swift    # 应用入口
├── Views/
│   ├── MainView.swift
│   ├── MenuBarView.swift
│   └── SettingsView.swift
├── ViewModels/
│   └── AppState.swift
├── Services/
│   ├── OptimizerService.swift
│   ├── MonitorService.swift
│   └── ShellExecutor.swift
├── Models/
│   ├── OptimizationTask.swift
│   └── AppSettings.swift
└── Tests/
    └── MacBoostAppTests/
```

---

## 9. 工作流程偏好

### 开发流程
1. **需求分析** → 写 requirements.md
2. **设计** → 写 design.md (含 Correctness Properties)
3. **任务拆分** → 写 tasks.md
4. **增量实现** → 按任务逐个完成
5. **测试验证** → 属性测试 + 单元测试
6. **交接记录** → 更新 HANDOVER.md

### Checkpoint 机制
- 每完成一个阶段，验证所有测试通过
- 遇到问题时询问用户，不自行假设

### 代码审查要点
- 类型安全
- 错误处理
- 测试覆盖
- 文档完整

---

## 10. AI 集成模式

### RAG 系统架构
```
用户查询
    ↓
查询分类 (classifyQuery)
    ↓
┌─────────────────┬─────────────────┐
│ 结构化数据查询   │ 知识库查询       │
│ (持仓、交易等)   │ (策略、原则等)   │
└─────────────────┴─────────────────┘
    ↓
上下文构建 (buildContext)
    ↓
AI 生成响应
```

### 多 Agent 编排
```typescript
// 支持多种编排模式
type OrchestrationMode = 
  | 'sequential'      // 顺序执行
  | 'selector'        // LLM 动态选择
  | 'handoff'         // Agent 间显式交接
  | 'respond_directly'; // 简单查询直接响应
```

### Prompt 工程
- 使用 System Instruction 设定角色
- 提供结构化上下文 (JSON 格式)
- 明确输出格式要求
- 包含示例和约束

---

## 📝 使用说明

Kiro 在协作时应：

1. **代码风格**: 遵循上述命名规范和架构模式
2. **测试**: 为核心逻辑编写属性测试
3. **文档**: 使用中文注释，提供 JSDoc
4. **错误处理**: 优雅降级，不中断流程
5. **交接**: 完成工作后更新 HANDOVER.md

---

*最后更新: 2025-12-29*
*来源项目: RiskControl - AI 驱动的投资风控系统*
