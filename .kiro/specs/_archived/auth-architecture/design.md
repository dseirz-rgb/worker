# Design Document: 个人多端认证架构

## Overview

本文档定义 Echo 项目针对个人用户多端使用场景的简化认证架构。核心目标是：
- 简单易用的登录体验
- 多端 (Web/桌面/移动) Token 通用
- API Token 支持脚本自动化
- 服务间通信无需认证

> 版本: v1.0
> 最后更新: 2026-01-01

## Architecture

### 整体认证架构

```mermaid
graph TB
    subgraph "客户端层"
        Web[🌐 Web UI<br/>localhost:1111]
        Tauri[🖥️ Tauri 桌面端]
        Mobile[📱 移动端 (未来)]
        Script[🔧 脚本/自动化]
    end
    
    subgraph "认证层"
        Auth[🔐 Auth Service<br/>JWT + API Token]
    end
    
    subgraph "服务层 (Docker 内网)"
        Blinko[📝 Blinko Server]
        Janitor[🧹 Janitor]
        Paperless[📄 Paperless]
    end
    
    Web -->|JWT Token| Auth
    Tauri -->|JWT Token| Auth
    Mobile -->|JWT Token| Auth
    Script -->|API Token| Auth
    
    Auth --> Blinko
    
    Blinko <-->|内网直连| Janitor
    Blinko <-->|内网直连| Paperless
```

### Token 类型对比

| 类型 | 用途 | 有效期 | 存储位置 |
|------|------|--------|---------|
| JWT Token | 用户登录认证 | 30 天 (可延长) | 客户端 localStorage |
| API Token | 脚本/自动化 | 永不过期 | 数据库 accounts.apiToken |
| Refresh Token | Token 刷新 | 90 天 | 数据库 session 表 |

## Components and Interfaces

### 1. 认证端点设计

```typescript
// 简化后的认证端点
interface AuthEndpoints {
  // 登录
  'POST /api/auth/login': {
    body: { username: string; password: string; rememberMe?: boolean };
    response: { token: string; user: UserInfo; expiresAt: string };
  };
  
  // 登出
  'POST /api/auth/logout': {
    headers: { Authorization: string };
    response: { success: boolean };
  };
  
  // 验证 Token
  'GET /api/auth/profile': {
    headers: { Authorization: string };
    response: UserInfo;
  };
  
  // 刷新 Token
  'POST /api/auth/refresh': {
    body: { refreshToken: string };
    response: { token: string; expiresAt: string };
  };
  
  // API Token 管理
  'POST /api/auth/api-token': {
    headers: { Authorization: string };
    response: { apiToken: string };
  };
  
  'DELETE /api/auth/api-token': {
    headers: { Authorization: string };
    response: { success: boolean };
  };
  
  // 设备管理
  'GET /api/auth/devices': {
    headers: { Authorization: string };
    response: Device[];
  };
  
  'DELETE /api/auth/devices/:deviceId': {
    headers: { Authorization: string };
    response: { success: boolean };
  };
}
```

### 2. 屏蔽 OAuth2 配置

```typescript
// server/routerExpress/auth/config.ts 修改
export const configureSession = async (app: any) => {
  await initJwtStrategy();
  initLocalStrategy();
  
  // 屏蔽 OAuth2 - 个人使用不需要
  // await initOAuthStrategies();  // 注释掉
  
  app.use(passport.initialize());
};

// 或通过环境变量控制
const ENABLE_OAUTH = process.env.ENABLE_OAUTH === 'true';
if (ENABLE_OAUTH) {
  await initOAuthStrategies();
}
```

### 3. API Token 实现

```typescript
// server/lib/apiToken.ts
import crypto from 'crypto';
import { prisma } from '../prisma';

export const generateApiToken = async (userId: number): Promise<string> => {
  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  await prisma.accounts.update({
    where: { id: userId },
    data: { 
      apiToken: hashedToken,
      // 可选: 记录生成时间
    }
  });
  
  return token; // 返回原始 token，只显示一次
};

export const verifyApiToken = async (token: string): Promise<number | null> => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  const user = await prisma.accounts.findFirst({
    where: { apiToken: hashedToken }
  });
  
  if (user) {
    // 更新最后使用时间
    await prisma.accounts.update({
      where: { id: user.id },
      data: { updatedAt: new Date() }
    });
    return user.id;
  }
  
  return null;
};

export const revokeApiToken = async (userId: number): Promise<void> => {
  await prisma.accounts.update({
    where: { id: userId },
    data: { apiToken: '' }
  });
};
```

### 4. 统一 Token 验证中间件

```typescript
// server/middleware/auth.ts
import { verifyToken } from '../lib/helper';
import { verifyApiToken } from '../lib/apiToken';

export const authMiddleware = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }
  
  // 支持两种格式: Bearer <jwt> 或 Token <api-token>
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const user = await verifyToken(token);
    if (user) {
      req.user = user;
      return next();
    }
  } else if (authHeader.startsWith('Token ')) {
    const token = authHeader.slice(6);
    const userId = await verifyApiToken(token);
    if (userId) {
      req.user = { id: userId, sub: userId.toString() };
      return next();
    }
  }
  
  return res.status(401).json({ error: 'Invalid token' });
};
```

### 5. 服务间通信 (无认证)

```typescript
// server/lib/janitorClient.ts
const JANITOR_URL = process.env.JANITOR_API_URL || 'http://janitor:8000';

export const janitorClient = {
  async classify(filePath: string) {
    // Docker 内网直接调用，无需认证
    const response = await fetch(`${JANITOR_URL}/api/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath })
    });
    return response.json();
  }
};
```

## Data Models

### 数据库 Schema 扩展

```prisma
model accounts {
  // ... 现有字段
  
  // API Token (哈希存储)
  apiToken      String   @default("") @db.VarChar
  apiTokenCreatedAt DateTime? @db.Timestamptz(6)
  apiTokenLastUsed  DateTime? @db.Timestamptz(6)
  
  // 设备管理
  devices       device[]
}

model device {
  id          Int      @id @default(autoincrement())
  accountId   Int
  deviceName  String   @db.VarChar(255)
  deviceType  String   @db.VarChar(50)  // web, desktop, mobile
  userAgent   String?  @db.Text
  ipAddress   String?  @db.VarChar(45)
  lastActive  DateTime @default(now()) @db.Timestamptz(6)
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  
  account     accounts @relation(fields: [accountId], references: [id])
  
  @@index([accountId])
}

model session {
  // ... 现有字段
  deviceId    Int?
}
```

### 环境变量配置

```env
# .env.example 新增

# ============ 认证配置 ============
# JWT Token 有效期 (秒)，默认 30 天
JWT_EXPIRES_IN=2592000

# 记住我 Token 有效期 (秒)，默认 90 天
JWT_REMEMBER_ME_EXPIRES_IN=7776000

# 是否启用 OAuth2 (个人使用建议关闭)
ENABLE_OAUTH=false

# 是否启用 2FA (云端暴露时建议开启)
ENABLE_2FA=false

# 登录失败锁定次数 (0 = 不锁定)
LOGIN_FAIL_LOCK_COUNT=5

# IP 白名单 (逗号分隔，空 = 不限制)
IP_WHITELIST=
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: Token 通用性

*For any* 有效的 JWT Token，在 Web、桌面、移动端的验证结果应该一致。

**Validates: Requirements 1.4, 2.1**

### Property 2: API Token 生命周期

*For any* API Token，生成后应永不过期，撤销后应立即失效，使用后应更新最后使用时间。

**Validates: Requirements 3.3, 3.4, 3.5**

### Property 3: 登录失败锁定

*For any* 账户，连续登录失败次数达到配置值后，账户应被锁定。

**Validates: Requirements 5.4**

### Property 4: IP 白名单

*For any* 配置了 IP 白名单的系统，白名单外的 IP 请求应被拒绝。

**Validates: Requirements 5.2**

### Property 5: 设备登出

*For any* 设备，远程登出后该设备的 Token 应立即失效。

**Validates: Requirements 2.5**

## Error Handling

| 错误场景 | HTTP 状态码 | 错误消息 |
|---------|------------|---------|
| 用户名或密码错误 | 401 | Invalid credentials |
| Token 过期 | 401 | Token expired |
| Token 无效 | 401 | Invalid token |
| API Token 已撤销 | 401 | API token revoked |
| 账户被锁定 | 423 | Account locked |
| IP 不在白名单 | 403 | IP not allowed |
| 2FA 验证失败 | 401 | Invalid 2FA code |

## Testing Strategy

### 单元测试

- Token 生成和验证逻辑
- API Token 哈希和比对
- 密码加密和验证

### 属性测试 (fast-check)

使用 `fast-check` 进行属性测试，每个属性至少 100 次迭代：

```typescript
// Token 通用性测试
test('Property 1: Token 通用性', () => {
  fc.assert(
    fc.property(fc.string(), (userId) => {
      const token = generateToken({ id: userId });
      const webResult = verifyToken(token);
      const desktopResult = verifyToken(token);
      return webResult === desktopResult;
    }),
    { numRuns: 100 }
  );
});
```

### 集成测试

- 完整登录流程
- API Token 生成和使用
- 设备管理功能
- 服务间通信

