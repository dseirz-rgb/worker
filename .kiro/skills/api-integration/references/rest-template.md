# REST API 集成模板

> 📋 完整的 REST API 集成代码模板，可直接复制使用

## 目录

1. [基础 API 客户端](#基础-api-客户端)
2. [类型定义](#类型定义)
3. [请求拦截器](#请求拦截器)
4. [响应处理](#响应处理)
5. [完整示例](#完整示例)

---

## 基础 API 客户端

### 使用 ky (推荐)

```typescript
// services/api/client.ts
import ky, { type KyInstance, type Options } from 'ky';

export interface ApiClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export function createApiClient(config: ApiClientConfig): KyInstance {
  return ky.create({
    prefixUrl: config.baseUrl,
    timeout: config.timeout ?? 30000,
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
      ...config.headers,
    },
    retry: {
      limit: 3,
      methods: ['get', 'put', 'delete'],
      statusCodes: [408, 429, 500, 502, 503, 504],
    },
  });
}
```


### 使用 axios

```typescript
// services/api/axiosClient.ts
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

export function createAxiosClient(config: ApiClientConfig): AxiosInstance {
  const instance = axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeout ?? 30000,
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
      ...config.headers,
    },
  });

  // 请求拦截器
  instance.interceptors.request.use(
    (config) => {
      // 添加请求时间戳用于日志
      config.metadata = { startTime: Date.now() };
      return config;
    },
    (error) => Promise.reject(error)
  );

  // 响应拦截器
  instance.interceptors.response.use(
    (response) => {
      const duration = Date.now() - response.config.metadata?.startTime;
      console.log(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${duration}ms`);
      return response;
    },
    (error) => {
      // 统一错误处理
      return Promise.reject(transformError(error));
    }
  );

  return instance;
}
```

---

## 类型定义

### API 响应类型

```typescript
// types/api.ts

// 通用 API 响应包装
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
}

// 分页响应
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// 错误响应
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
}
```

### 请求参数类型

```typescript
// types/requests.ts

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export type ListParams = PaginationParams & FilterParams;
```

---

## 请求拦截器

### 认证拦截器

```typescript
// services/api/interceptors/auth.ts

export function createAuthInterceptor(getToken: () => string | null) {
  return (config: AxiosRequestConfig) => {
    const token = getToken();
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return config;
  };
}
```

### 请求日志拦截器

```typescript
// services/api/interceptors/logging.ts

export function createLoggingInterceptor() {
  return {
    request: (config: AxiosRequestConfig) => {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        data: config.data,
      });
      return config;
    },
    response: (response: AxiosResponse) => {
      console.log(`[API Response] ${response.status}`, response.data);
      return response;
    },
  };
}
```


---

## 响应处理

### 统一响应处理

```typescript
// services/api/responseHandler.ts

import { ApiError, RateLimitError, AuthenticationError } from '@/errors/apiErrors';

export function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    return handleErrorResponse(response);
  }
  
  // 处理空响应
  if (response.status === 204) {
    return Promise.resolve(null as T);
  }
  
  return response.json();
}

async function handleErrorResponse(response: Response): Promise<never> {
  const contentType = response.headers.get('content-type');
  
  let errorData: ApiErrorResponse | null = null;
  if (contentType?.includes('application/json')) {
    try {
      errorData = await response.json();
    } catch {
      // 忽略 JSON 解析错误
    }
  }

  switch (response.status) {
    case 401:
      throw new AuthenticationError();
    case 429:
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10);
      throw new RateLimitError(retryAfter);
    default:
      throw new ApiError(
        errorData?.error?.message ?? `HTTP Error ${response.status}`,
        response.status,
        errorData?.error?.code ?? 'UNKNOWN_ERROR',
        response.status >= 500
      );
  }
}
```

---

## 完整示例

### 用户服务示例

```typescript
// services/userService.ts

import { createApiClient } from './api/client';
import type { User, CreateUserInput, UpdateUserInput } from '@/types/user';
import type { PaginatedResponse, ListParams } from '@/types/api';

const client = createApiClient({
  baseUrl: process.env.API_BASE_URL!,
  apiKey: process.env.API_KEY,
});

export const userService = {
  // 获取用户列表
  async list(params?: ListParams): Promise<PaginatedResponse<User>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.search) searchParams.set('search', params.search);
    
    return client.get(`users?${searchParams}`).json();
  },

  // 获取单个用户
  async getById(id: string): Promise<User> {
    return client.get(`users/${id}`).json();
  },

  // 创建用户
  async create(input: CreateUserInput): Promise<User> {
    return client.post('users', { json: input }).json();
  },

  // 更新用户
  async update(id: string, input: UpdateUserInput): Promise<User> {
    return client.put(`users/${id}`, { json: input }).json();
  },

  // 删除用户
  async delete(id: string): Promise<void> {
    await client.delete(`users/${id}`);
  },
};
```

### React Query 集成

```typescript
// hooks/useUsers.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/services/userService';
import type { ListParams } from '@/types/api';

export function useUsers(params?: ListParams) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => userService.list(params),
    staleTime: 5 * 60 * 1000, // 5 分钟
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => userService.getById(id),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: userService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      userService.update(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', id] });
    },
  });
}
```

---

## 环境变量配置

```bash
# .env.local
API_BASE_URL=https://api.example.com/v1
API_KEY=your-api-key-here
API_TIMEOUT=30000
```

```typescript
// config/api.ts
export const apiConfig = {
  baseUrl: process.env.API_BASE_URL ?? 'http://localhost:3001',
  apiKey: process.env.API_KEY,
  timeout: parseInt(process.env.API_TIMEOUT ?? '30000', 10),
};
```
