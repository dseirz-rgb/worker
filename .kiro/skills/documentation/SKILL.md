---
name: documentation
description: |
  文档生成技能：提供标准化的文档编写工作流和模板。
  Use when: 需要编写组件文档、API 文档、模块 README、项目文档。
  Triggers: "文档", "documentation", "README", "API 文档", "组件文档", "注释"
category: documentation
---

# Documentation (文档生成)

> 📝 **核心理念**: 好的文档是代码的延伸，让代码自己说话，让文档补充上下文。

## 🔴 第一原则：文档即代码

**文档和代码同等重要，必须同步维护！**

```
❌ 错误思路: "先写代码，有空再补文档"
✅ 正确思路: "代码和文档一起写，保持同步"

❌ 错误思路: "代码写得好就不需要文档"  
✅ 正确思路: "代码说明 How，文档说明 Why 和 When"
```

**文档优先级**: 类型定义 > 函数注释 > README > 详细文档

## When to Use This Skill

使用此技能当你需要：
- 为 React 组件编写文档
- 为 API 端点编写接口文档
- 为模块/包编写 README
- 编写项目级别的文档
- 生成代码注释和 JSDoc

## Not For / Boundaries

此技能不适用于：
- 自动生成的 API 文档（使用 OpenAPI/Swagger）
- 纯代码注释（遵循代码规范）
- 用户手册或产品文档

---

## Quick Reference

### 🎯 文档编写工作流

```
代码完成 → 类型定义 → 函数注释 → 使用示例 → README → 详细文档
              ↓          ↓          ↓         ↓
           interface   JSDoc     Example   模板填充
```

### 📋 文档必备要素

| 文档类型 | 必备要素 |
|----------|----------|
| 组件文档 | Props 说明、使用示例、注意事项 |
| API 文档 | 端点、参数、响应、错误码 |
| 模块 README | 功能说明、安装、快速开始、API |
| 函数注释 | 参数、返回值、示例、异常 |

### 🌐 中英文规范

| 场景 | 语言 | 示例 |
|------|------|------|
| 代码注释 | 中文 | `// 计算风险指标` |
| 变量/函数名 | 英文 | `calculateRiskMetrics` |
| UI 文案 | 中文 | `提交`, `取消` |
| 错误消息 | 中文 | `请输入有效的邮箱地址` |
| README | 中文为主 | 技术术语保留英文 |
| API 文档 | 中文描述 | 参数名用英文 |

---

## 文档编写工作流

### Phase 1: 类型定义文档化

**目标**: 让类型成为最好的文档

```typescript
/**
 * 用户信息
 * @description 系统中的用户实体，包含基本信息和权限
 */
export interface User {
  /** 用户唯一标识 */
  id: string;
  
  /** 用户邮箱，用于登录和通知 */
  email: string;
  
  /** 显示名称 */
  displayName: string;
  
  /** 用户角色 */
  role: UserRole;
  
  /** 创建时间 (ISO 8601 格式) */
  createdAt: string;
  
  /** 最后登录时间，未登录过则为 null */
  lastLoginAt: string | null;
}

/**
 * 用户角色枚举
 */
export type UserRole = 'admin' | 'editor' | 'viewer';
```

### Phase 2: 函数注释 (JSDoc)

**目标**: 提供完整的函数使用说明

```typescript
/**
 * 计算投资组合的风险指标
 * 
 * @description
 * 基于历史收益率数据计算多种风险指标，包括波动率、
 * 最大回撤、夏普比率等。支持自定义时间窗口和无风险利率。
 * 
 * @param returns - 历史收益率数组 (日收益率)
 * @param options - 计算选项
 * @param options.window - 滚动窗口大小 (默认: 252 交易日)
 * @param options.riskFreeRate - 年化无风险利率 (默认: 0.02)
 * 
 * @returns 风险指标对象
 * 
 * @throws {InvalidDataError} 当收益率数据为空或包含无效值时
 * 
 * @example
 * ```typescript
 * const returns = [0.01, -0.02, 0.015, 0.008, -0.005];
 * const metrics = calculateRiskMetrics(returns, { window: 20 });
 * console.log(metrics.volatility); // 0.0234
 * console.log(metrics.sharpeRatio); // 1.52
 * ```
 * 
 * @see {@link RiskMetrics} 返回值类型定义
 * @see {@link calculateMaxDrawdown} 最大回撤计算
 */
export function calculateRiskMetrics(
  returns: number[],
  options?: RiskCalculationOptions
): RiskMetrics {
  // 实现...
}
```

### Phase 3: 使用示例

**目标**: 提供可运行的代码示例

```typescript
// examples/risk-calculation.ts

import { calculateRiskMetrics } from '../src/services/riskEngine';

// 基础用法
const dailyReturns = [0.01, -0.02, 0.015, 0.008, -0.005];
const metrics = calculateRiskMetrics(dailyReturns);

console.log('波动率:', metrics.volatility);
console.log('夏普比率:', metrics.sharpeRatio);
console.log('最大回撤:', metrics.maxDrawdown);

// 自定义参数
const customMetrics = calculateRiskMetrics(dailyReturns, {
  window: 20,
  riskFreeRate: 0.03,
});

// 错误处理
try {
  calculateRiskMetrics([]);
} catch (error) {
  console.error('数据无效:', error.message);
}
```

### Phase 4: README 编写

**目标**: 提供模块的完整说明

使用模板: `templates/readme-template.md`

### Phase 5: 详细文档

**目标**: 补充复杂功能的详细说明

```markdown
# 风险计算引擎

## 概述

风险计算引擎提供投资组合风险分析功能...

## 架构

```
RiskEngine
├── MetricsCalculator    # 指标计算
├── DataValidator        # 数据验证
└── CacheManager         # 结果缓存
```

## 算法说明

### 波动率计算

使用标准差方法计算年化波动率：

$$\sigma = \sqrt{252} \times \text{std}(r)$$

其中 $r$ 为日收益率序列。

## 性能考虑

- 大数据集建议分批处理
- 启用缓存可提升重复计算性能
```

---

## 组件文档规范

### 📦 组件文档结构

```markdown
# ComponentName

简短描述组件的用途。

## 使用场景

- 场景 1
- 场景 2

## 基础用法

\`\`\`tsx
<ComponentName prop1="value" />
\`\`\`

## Props

| 属性 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| prop1 | string | - | ✅ | 属性说明 |
| prop2 | number | 0 | - | 属性说明 |

## 示例

### 示例 1: 基础用法
### 示例 2: 高级用法

## 注意事项

- 注意点 1
- 注意点 2

## 相关组件

- [RelatedComponent1](./RelatedComponent1.md)
```

### 🎨 组件文档示例

参考模板: `templates/component-doc.md`

---

## API 文档规范

### 📡 API 文档结构

```markdown
# API 端点名称

## 概述

端点的简短描述。

## 请求

\`\`\`
METHOD /api/path
\`\`\`

### 请求头

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| Authorization | string | ✅ | Bearer token |

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | ✅ | 资源 ID |

### 请求体

\`\`\`json
{
  "field": "value"
}
\`\`\`

## 响应

### 成功响应 (200)

\`\`\`json
{
  "data": { ... }
}
\`\`\`

### 错误响应

| 状态码 | 错误码 | 说明 |
|--------|--------|------|
| 400 | INVALID_INPUT | 输入参数无效 |
| 404 | NOT_FOUND | 资源不存在 |

## 示例

### cURL

\`\`\`bash
curl -X GET "https://api.example.com/api/path" \
  -H "Authorization: Bearer token"
\`\`\`

### TypeScript

\`\`\`typescript
const response = await fetch('/api/path');
\`\`\`
```

### 📋 API 文档示例

参考模板: `templates/api-doc.md`

---

## 注释规范

### 📝 代码注释原则

```typescript
// ✅ 好的注释：解释 Why
// 使用指数退避策略，避免在服务恢复时造成请求风暴
const delay = baseDelay * Math.pow(2, retryCount);

// ❌ 差的注释：解释 What (代码已经说明了)
// 计算延迟
const delay = baseDelay * Math.pow(2, retryCount);

// ✅ 好的注释：解释业务逻辑
// 根据监管要求，单笔交易金额不能超过 100 万
if (amount > 1_000_000) {
  throw new Error('超出单笔交易限额');
}

// ✅ 好的注释：标记待办事项
// TODO: 优化大数据集的性能，考虑使用流式处理
// FIXME: 边界情况处理不完善，空数组会导致 NaN
// HACK: 临时解决方案，等待上游库修复后移除
```

### 📋 注释类型

| 类型 | 用途 | 示例 |
|------|------|------|
| `// 单行注释` | 简短说明 | `// 验证用户权限` |
| `/* 多行注释 */` | 复杂说明 | 算法解释 |
| `/** JSDoc */` | 函数/类文档 | API 说明 |
| `// TODO:` | 待办事项 | 功能待实现 |
| `// FIXME:` | 已知问题 | Bug 待修复 |
| `// HACK:` | 临时方案 | 需要重构 |
| `// NOTE:` | 重要说明 | 特殊处理 |

---

## 文档模板

### 📄 可用模板

| 模板 | 路径 | 用途 |
|------|------|------|
| 组件文档 | `templates/component-doc.md` | React 组件文档 |
| API 文档 | `templates/api-doc.md` | REST API 端点文档 |
| README | `templates/readme-template.md` | 模块/包 README |

### 🔧 使用方法

```bash
# 复制模板
cp .kiro/skills/documentation/templates/component-doc.md docs/components/MyComponent.md

# 编辑填充内容
code docs/components/MyComponent.md
```

---

## Examples

### Example 1: 为 React 组件编写文档

**Input:** "为 RiskMetricsCard 组件编写文档"

**Steps:**
1. 复制组件文档模板
2. 填写组件基本信息
3. 列出所有 Props 及说明
4. 添加使用示例
5. 补充注意事项

**Output:** 参考 `templates/component-doc.md`

### Example 2: 为 API 端点编写文档

**Input:** "为 /api/users 端点编写文档"

**Steps:**
1. 复制 API 文档模板
2. 填写端点信息
3. 列出请求参数和响应格式
4. 添加错误码说明
5. 提供调用示例

**Output:** 参考 `templates/api-doc.md`

### Example 3: 为模块编写 README

**Input:** "为 risk-engine 模块编写 README"

**Steps:**
1. 复制 README 模板
2. 填写模块概述
3. 添加安装和使用说明
4. 列出 API 参考
5. 补充贡献指南

**Output:** 参考 `templates/readme-template.md`

---

## 文档质量检查清单

### ✅ 完整性检查

- [ ] 所有公开 API 都有文档
- [ ] 所有 Props 都有说明
- [ ] 包含使用示例
- [ ] 包含错误处理说明
- [ ] 包含注意事项

### ✅ 准确性检查

- [ ] 示例代码可运行
- [ ] 类型定义与实现一致
- [ ] 参数说明与代码一致
- [ ] 链接有效

### ✅ 可读性检查

- [ ] 结构清晰
- [ ] 语言简洁
- [ ] 格式统一
- [ ] 中英文规范

---

## References

- `templates/component-doc.md`: React 组件文档模板
- `templates/api-doc.md`: API 端点文档模板
- `templates/readme-template.md`: 模块 README 模板

---

## Maintenance

- **Sources**: 项目文档规范, JSDoc 标准, 行业最佳实践
- **Last Updated**: 2025-01-01
- **Known Limits**: 
  - 模板基于 TypeScript/React 项目
  - 其他技术栈需要适当调整
