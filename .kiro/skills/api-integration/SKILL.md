---
name: api-integration
description: |
  API 集成技能：REST/GraphQL API 集成工作流、错误处理、重试策略。
  Use when: 需要集成第三方 API、设计 API 客户端、处理 API 错误。
  Triggers: "API", "接口", "集成", "REST", "GraphQL", "请求", "调用"
category: integration
triggers:
  - API
  - 接口
  - 集成
  - REST
  - GraphQL
  - 请求
  - 调用
  - fetch
  - axios
---

# API Integration (API 集成)

> 🔌 **核心理念**: 稳健的 API 集成 = 类型安全 + 优雅错误处理 + 智能重试

## 🔴 第一原则：防御性编程

**永远假设 API 会失败，做好所有准备！**

```
❌ 错误思路: "这个 API 很稳定，不需要错误处理"
✅ 正确思路: "任何 API 都可能失败，必须有完整的错误处理和降级方案"

❌ 错误思路: "直接调用就行，简单快速"  
✅ 正确思路: "封装一层，统一处理认证、错误、重试、日志"
```

## When to Use This Skill

使用此技能当你需要：
- 集成第三方 REST/GraphQL API
- 设计 API 客户端架构
- 实现错误处理和重试逻辑
- 处理 API 认证和授权
- 优化 API 调用性能

## Not For / Boundaries

此技能不适用于：
- 设计自己的 API（参考 API 设计规范）
- 数据库直接操作（参考 database-migration skill）
- WebSocket 实时通信（参考专门的实时通信方案）

---

## Quick Reference

### 🎯 API 集成决策流程

```
需求分析 → 选择客户端库 → 设计封装层 → 实现错误处理 → 添加重试逻辑 → 测试验证
              ↓
         优先使用官方 SDK
```

### 📋 集成前必问清单

| 问题 | 目的 |
|------|------|
| 1. 有没有官方 SDK？ | 优先使用官方维护的客户端 |
| 2. API 文档是否完整？ | 确认端点、参数、响应格式 |
| 3. 认证方式是什么？ | API Key / OAuth / JWT |
| 4. 有没有速率限制？ | 设计限流策略 |
| 5. 错误码有哪些？ | 设计错误处理映射 |
| 6. 是否需要重试？ | 确定重试策略 |

### 🔧 推荐技术栈

| 场景 | 推荐方案 |
|------|----------|
| HTTP 客户端 | ky, axios, fetch |
| 类型生成 | openapi-typescript, graphql-codegen |
| 请求缓存 | @tanstack/react-query, swr |
| 重试逻辑 | p-retry, axios-retry |
| 速率限制 | bottleneck, p-limit |
| Mock 测试 | msw, nock |

### ✅ API 客户端设计原则

```typescript
// ✅ 好的设计：封装统一的 API 客户端
class ApiClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  
  constructor(config: ApiConfig) {
    this.baseUrl = config.baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    };
  }
  
  async request<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    // 统一处理：认证、错误、重试、日志
  }
}

// ❌ 坏的设计：到处散落的 fetch 调用
const data = await fetch('https://api.example.com/users', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
```

---

## API 集成工作流

### Phase 1: 需求分析与准备

```
1. 阅读 API 文档，理解端点和数据结构
2. 确认认证方式和获取凭证
3. 了解速率限制和配额
4. 确定需要调用的端点列表
5. 设计数据模型和类型定义
```

### Phase 2: 客户端架构设计

```
1. 选择 HTTP 客户端库
2. 设计基础客户端类/函数
3. 实现认证逻辑
4. 设计请求/响应拦截器
5. 规划错误处理策略
```

### Phase 3: 实现与测试

```
1. 实现各端点调用方法
2. 添加类型定义
3. 实现错误处理
4. 添加重试逻辑
5. 编写单元测试和集成测试
```

### Phase 4: 优化与监控

```
1. 添加请求缓存
2. 实现请求合并/批处理
3. 添加日志和监控
4. 性能优化
```

---

## Examples

### Example 1: REST API 集成

**Input:** "需要集成 GitHub API 获取用户仓库列表"

**Steps:**
1. 检查官方 SDK: `@octokit/rest` ✅
2. 评估: Stars 5k+, 官方维护, TypeScript 支持
3. 决策: 使用官方 SDK

**Expected Output:**
```bash
pnpm add @octokit/rest
```

```typescript
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function getUserRepos(username: string) {
  try {
    const { data } = await octokit.repos.listForUser({
      username,
      sort: 'updated',
      per_page: 100,
    });
    return data;
  } catch (error) {
    if (error.status === 404) {
      throw new UserNotFoundError(username);
    }
    throw error;
  }
}
```

### Example 2: 自定义 API 客户端

**Input:** "需要集成一个没有官方 SDK 的第三方 API"

**Expected Output:**
```typescript
// services/api/customApiClient.ts
import ky from 'ky';
import pRetry from 'p-retry';

interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export function createApiClient(config: ApiConfig) {
  const client = ky.create({
    prefixUrl: config.baseUrl,
    timeout: config.timeout ?? 30000,
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    hooks: {
      beforeError: [
        (error) => {
          // 统一错误处理
          const { response } = error;
          if (response?.status === 429) {
            error.name = 'RateLimitError';
          }
          return error;
        },
      ],
    },
  });

  return {
    async get<T>(endpoint: string): Promise<T> {
      return pRetry(
        () => client.get(endpoint).json<T>(),
        { retries: 3, onFailedAttempt: logRetry }
      );
    },
    
    async post<T>(endpoint: string, data: unknown): Promise<T> {
      return pRetry(
        () => client.post(endpoint, { json: data }).json<T>(),
        { retries: 3, onFailedAttempt: logRetry }
      );
    },
  };
}
```

### Example 3: GraphQL API 集成

**Input:** "需要集成 GraphQL API"

**Expected Output:**
```bash
pnpm add graphql-request graphql
```

```typescript
// services/api/graphqlClient.ts
import { GraphQLClient, gql } from 'graphql-request';

const client = new GraphQLClient(process.env.GRAPHQL_ENDPOINT!, {
  headers: {
    Authorization: `Bearer ${process.env.API_TOKEN}`,
  },
});

// 类型安全的查询
const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }
`;

interface User {
  id: string;
  name: string;
  email: string;
}

export async function getUser(id: string): Promise<User> {
  const { user } = await client.request<{ user: User }>(GET_USER, { id });
  return user;
}
```

---

## 错误处理最佳实践

### 错误分类与处理策略

| 错误类型 | HTTP 状态码 | 处理策略 |
|----------|-------------|----------|
| 客户端错误 | 400-499 | 不重试，返回用户友好错误 |
| 认证错误 | 401, 403 | 刷新 token 或提示重新登录 |
| 资源不存在 | 404 | 返回 null 或抛出特定错误 |
| 速率限制 | 429 | 等待后重试 |
| 服务器错误 | 500-599 | 指数退避重试 |
| 网络错误 | - | 重试 + 降级方案 |

### 自定义错误类

```typescript
// errors/apiErrors.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class RateLimitError extends ApiError {
  constructor(public retryAfter: number) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT', true);
  }
}

export class AuthenticationError extends ApiError {
  constructor() {
    super('Authentication failed', 401, 'AUTH_FAILED', false);
  }
}
```

---

## 重试策略

### 指数退避重试

```typescript
import pRetry from 'p-retry';

const result = await pRetry(
  async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  },
  {
    retries: 3,
    minTimeout: 1000,      // 首次重试等待 1s
    maxTimeout: 10000,     // 最大等待 10s
    factor: 2,             // 指数因子
    onFailedAttempt: (error) => {
      console.log(`Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
    },
  }
);
```

### 条件重试

```typescript
// 只对特定错误重试
const shouldRetry = (error: Error) => {
  if (error instanceof ApiError) {
    return error.retryable;
  }
  // 网络错误总是重试
  return error.name === 'TypeError' || error.name === 'NetworkError';
};
```

---

## References

- `references/rest-template.md`: REST API 集成完整模板
- `references/error-handling.md`: API 错误处理模式详解

---

## Maintenance

- **Sources**: 行业最佳实践, 开源社区经验
- **Last Updated**: 2025-01-01
- **Known Limits**: 
  - 具体 API 的特殊处理需要根据文档调整
  - 某些 API 可能需要特殊的认证流程
