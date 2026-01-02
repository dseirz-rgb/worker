# {API 端点名称}

> 简短描述此 API 端点的用途。

## 概述

| 属性 | 值 |
|------|-----|
| 端点 | `{METHOD} /api/{path}` |
| 认证 | 需要 / 不需要 |
| 权限 | admin / user / public |
| 版本 | v1 |

## 请求

```
{METHOD} /api/{path}/{:id}
```

### 请求头

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `Authorization` | `string` | ✅ | Bearer token，格式: `Bearer {token}` |
| `Content-Type` | `string` | ✅ | `application/json` |
| `X-Request-ID` | `string` | - | 请求追踪 ID，用于日志关联 |

### 路径参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 资源唯一标识符 |

### 查询参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | `number` | `1` | 页码，从 1 开始 |
| `limit` | `number` | `20` | 每页数量，最大 100 |
| `sort` | `string` | `createdAt` | 排序字段 |
| `order` | `asc \| desc` | `desc` | 排序方向 |
| `search` | `string` | - | 搜索关键词 |

### 请求体

```json
{
  "field1": "string (必填) - 字段说明",
  "field2": 123,
  "field3": {
    "nested": "value"
  },
  "field4": ["item1", "item2"]
}
```

#### 请求体字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field1` | `string` | ✅ | 字段 1 的详细说明 |
| `field2` | `number` | - | 字段 2 的详细说明，范围: 0-1000 |
| `field3` | `object` | - | 嵌套对象 |
| `field3.nested` | `string` | - | 嵌套字段说明 |
| `field4` | `string[]` | - | 字符串数组，最多 10 项 |

## 响应

### 成功响应 (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "field1": "value",
    "field2": 123,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "meta": {
    "requestId": "req_xxx"
  }
}
```

### 列表响应 (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "field1": "value1"
    },
    {
      "id": "def456",
      "field1": "value2"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasMore": true
  }
}
```

### 创建成功响应 (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "new_id",
    "field1": "value"
  },
  "message": "资源创建成功"
}
```

### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | `boolean` | 请求是否成功 |
| `data` | `object \| array` | 响应数据 |
| `meta` | `object` | 元数据信息 |
| `meta.page` | `number` | 当前页码 |
| `meta.total` | `number` | 总记录数 |
| `message` | `string` | 操作结果消息 |

## 错误响应

### 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述信息",
    "details": {
      "field": "具体字段的错误信息"
    }
  },
  "meta": {
    "requestId": "req_xxx"
  }
}
```

### 错误码列表

| HTTP 状态码 | 错误码 | 说明 | 解决方案 |
|-------------|--------|------|----------|
| 400 | `INVALID_INPUT` | 输入参数无效 | 检查请求参数格式 |
| 400 | `VALIDATION_ERROR` | 数据验证失败 | 查看 details 字段获取具体错误 |
| 401 | `UNAUTHORIZED` | 未授权访问 | 检查 Authorization 头 |
| 401 | `TOKEN_EXPIRED` | Token 已过期 | 刷新 token 后重试 |
| 403 | `FORBIDDEN` | 无权限访问 | 确认用户权限 |
| 404 | `NOT_FOUND` | 资源不存在 | 检查资源 ID |
| 409 | `CONFLICT` | 资源冲突 | 资源已存在或状态冲突 |
| 422 | `UNPROCESSABLE_ENTITY` | 无法处理的实体 | 检查业务逻辑约束 |
| 429 | `RATE_LIMITED` | 请求过于频繁 | 等待后重试，查看 Retry-After 头 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 | 联系技术支持 |
| 503 | `SERVICE_UNAVAILABLE` | 服务暂时不可用 | 稍后重试 |

## 示例

### cURL

```bash
# GET 请求
curl -X GET "https://api.example.com/api/resource/abc123" \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json"

# POST 请求
curl -X POST "https://api.example.com/api/resource" \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "field1": "value",
    "field2": 123
  }'

# 带查询参数
curl -X GET "https://api.example.com/api/resource?page=1&limit=10&search=keyword" \
  -H "Authorization: Bearer your_token"
```

### TypeScript / JavaScript

```typescript
// 使用 fetch
async function getResource(id: string) {
  const response = await fetch(`/api/resource/${id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  return response.json();
}

// 使用 ky
import ky from 'ky';

const client = ky.create({
  prefixUrl: 'https://api.example.com',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const data = await client.get('api/resource/abc123').json();
```

### React Query

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

// 查询
function useResource(id: string) {
  return useQuery({
    queryKey: ['resource', id],
    queryFn: () => getResource(id),
  });
}

// 创建
function useCreateResource() {
  return useMutation({
    mutationFn: (data: CreateResourceInput) => createResource(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}
```

## 速率限制

| 限制类型 | 限制值 | 说明 |
|----------|--------|------|
| 每分钟请求数 | 60 | 普通用户 |
| 每分钟请求数 | 600 | 高级用户 |
| 并发请求数 | 10 | 同时进行的请求 |

### 速率限制响应头

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1704067200
Retry-After: 30
```

## 版本历史

### v1.1.0 (2025-01-01)

- 新增 `field3` 参数支持
- 优化错误响应格式

### v1.0.0 (2024-12-01)

- 初始版本发布

## 相关端点

- [GET /api/resources](./get-resources.md) - 获取资源列表
- [POST /api/resources](./create-resource.md) - 创建资源
- [PUT /api/resources/:id](./update-resource.md) - 更新资源
- [DELETE /api/resources/:id](./delete-resource.md) - 删除资源

## 注意事项

### ⚠️ 安全提示

- 不要在客户端代码中暴露 API 密钥
- 所有敏感操作都需要认证
- 建议使用 HTTPS

### ⚠️ 性能建议

- 使用分页获取大量数据
- 合理设置缓存策略
- 避免频繁轮询，考虑使用 WebSocket

### ⚠️ 已知限制

- 单次请求最大响应体: 10MB
- 请求超时时间: 30 秒
- 文件上传大小限制: 50MB
