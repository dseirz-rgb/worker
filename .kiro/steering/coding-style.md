# Kiro 学习档案 - 用户开发风格与偏好

> 这份文档记录了用户的开发风格、技术偏好和工作习惯。
> Kiro 在后续协作中应参考这些信息，提供更贴合用户习惯的建议和代码。

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

---

## 2. TypeScript 风格

### 类型定义偏好
- 使用 `interface` 定义对象结构
- 使用 `type` 定义联合类型和别名
- 导出所有公共类型
- 类型文件集中在 `types/` 或 `*/types.ts`

### 严格模式
- 启用 `strict: true`
- 避免 `any`，使用 `unknown` 或泛型
- 所有函数参数和返回值都有类型

---

## 3. 测试策略

### 属性测试 (Property-Based Testing)
- **框架**: `fast-check` (TypeScript)
- **迭代次数**: 每个属性测试至少 100 次
- **注释格式**: `**Validates: Requirements X.Y**`

### 测试文件组织
- 测试文件与源文件同目录放置
- 使用 `.test.ts` 后缀

---

## 4. 文档与注释风格

### 语言偏好
- **代码注释**: 中文
- **文档**: 中文
- **UI 文案**: 中文
- **变量/函数名**: 英文

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

### 测试
| 类别 | 技术选择 |
|------|----------|
| 单元测试 | Vitest |
| 属性测试 | fast-check |
| E2E | Chrome DevTools MCP |
| 组件测试 | Testing Library |

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
- 单个任务失败不影响整体
- 使用 fallback 结果继续执行

---

## 7. 命名规范

### 文件命名
| 类型 | 格式 | 示例 |
|------|------|------|
| 组件 | PascalCase | `RiskMetricsCard.tsx` |
| Hook | camelCase + use 前缀 | `useDocumentsMeta.ts` |
| Service | camelCase | `riskEngine.ts` |
| 测试 | 源文件名 + .test | `riskEngine.test.ts` |

### 变量命名
| 类型 | 格式 | 示例 |
|------|------|------|
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_TIMEOUT` |
| 函数 | camelCase | `calculatePositions` |
| 类 | PascalCase | `AgentOrchestrator` |
| 接口 | PascalCase | `AgentResult` |

---

## 📝 使用说明

Kiro 在协作时应：

1. **代码风格**: 遵循上述命名规范和架构模式
2. **测试**: 为核心逻辑编写属性测试
3. **文档**: 使用中文注释，提供 JSDoc
4. **错误处理**: 优雅降级，不中断流程
5. **交接**: 完成工作后更新 HANDOVER.md
