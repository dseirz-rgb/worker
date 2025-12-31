# Design Document - Khoj 页面集成

## Overview

本设计文档描述在 Blinko 应用中添加 Khoj 页面的技术方案。采用 iframe 嵌入方式，快速将 Khoj 的 AI 对话功能集成到 Blinko 中。

### 设计原则

1. **快速实现** - 使用 iframe 嵌入，最小化开发工作量
2. **用户友好** - 提供清晰的连接状态和错误提示
3. **可扩展** - 为后续 API 集成预留接口

### 技术选型

| 组件 | 技术 | 理由 |
|------|------|------|
| 页面框架 | React + Vite | Blinko 现有技术栈 |
| 嵌入方式 | iframe | 最快实现，功能完整 |
| 状态检测 | fetch API | 简单的健康检查 |
| 样式 | Tailwind CSS | Blinko 现有样式方案 |

---

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Blinko Application                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Blinko Frontend (React)                   │    │
│  │                                                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │    │
│  │  │  Home Page   │  │  AI Page     │  │  Khoj Page   │       │    │
│  │  │  (笔记)      │  │  (Blinko AI) │  │  (新增)      │       │    │
│  │  └──────────────┘  └──────────────┘  └──────┬───────┘       │    │
│  │                                             │                │    │
│  │                                    ┌────────▼────────┐       │    │
│  │                                    │  KhojService    │       │    │
│  │                                    │  (健康检查)     │       │    │
│  │                                    └────────┬────────┘       │    │
│  │                                             │                │    │
│  └─────────────────────────────────────────────┼────────────────┘    │
│                                                │                     │
└────────────────────────────────────────────────┼─────────────────────┘
                                                 │
                                                 │ HTTP
                                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Khoj Server (Docker)                            │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │  Web UI         │  │  API Server     │  │  Vector Store   │      │
│  │  (iframe 嵌入)  │  │  (健康检查)     │  │  (知识库)       │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
│                                                                      │
│  http://localhost:42110                                              │
└──────────────────────────────────────────────────────────────────────┘
```

### 页面结构

```
/khoj 页面
├── Header (连接状态指示器)
├── Content Area
│   ├── Loading State (加载中)
│   ├── Error State (连接失败)
│   └── iframe (Khoj Web UI)
└── Footer (可选：快捷操作)
```

---

## Components and Interfaces

### 1. Khoj 服务检测

```typescript
// lib/khojService.ts

const DEFAULT_KHOJ_URL = 'http://localhost:42110';

/**
 * Khoj 连接配置
 */
export interface KhojConfig {
  baseUrl: string;
  enabled: boolean;
}

/**
 * 获取 Khoj 配置
 */
export function getKhojConfig(): KhojConfig {
  // 从 localStorage 或环境变量获取配置
  const savedUrl = localStorage.getItem('khoj_url');
  return {
    baseUrl: savedUrl || DEFAULT_KHOJ_URL,
    enabled: true,
  };
}

/**
 * 保存 Khoj 配置
 */
export function saveKhojConfig(config: Partial<KhojConfig>): void {
  if (config.baseUrl) {
    localStorage.setItem('khoj_url', config.baseUrl);
  }
}

/**
 * 检查 Khoj 服务是否可用
 */
export async function checkKhojHealth(): Promise<boolean> {
  const config = getKhojConfig();
  
  try {
    const response = await fetch(`${config.baseUrl}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (error) {
    console.warn('Khoj health check failed:', error);
    return false;
  }
}

/**
 * 获取 Khoj Chat URL
 */
export function getKhojChatUrl(): string {
  const config = getKhojConfig();
  return `${config.baseUrl}/chat`;
}
```

### 2. Khoj 页面组件

```typescript
// pages/khoj.tsx

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Iconify/icons';
import { Button, Spinner } from '@heroui/react';
import { checkKhojHealth, getKhojChatUrl, getKhojConfig } from '@/lib/khojService';

type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

export default function KhojPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    setStatus('checking');
    setError(null);
    
    const isHealthy = await checkKhojHealth();
    setStatus(isHealthy ? 'connected' : 'disconnected');
    
    if (!isHealthy) {
      setError('无法连接到 Khoj 服务');
    }
  }, []);

  useEffect(() => {
    checkConnection();
    
    // 定期检查连接状态
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  const handleIframeLoad = () => {
    setIframeLoaded(true);
  };

  const handleIframeError = () => {
    setError('无法加载 Khoj 界面');
    setStatus('disconnected');
  };

  const config = getKhojConfig();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:robot-outline" className="w-6 h-6" />
          <h1 className="text-lg font-semibold">Khoj AI 助手</h1>
        </div>
        
        {/* 连接状态指示器 */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            status === 'connected' ? 'bg-green-500' :
            status === 'disconnected' ? 'bg-red-500' :
            'bg-yellow-500 animate-pulse'
          }`} />
          <span className="text-sm text-gray-500">
            {status === 'connected' ? '已连接' :
             status === 'disconnected' ? '未连接' :
             '检查中...'}
          </span>
          
          {status === 'disconnected' && (
            <Button
              size="sm"
              variant="light"
              onPress={checkConnection}
              startContent={<Icon icon="mdi:refresh" />}
            >
              重试
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {/* Loading State */}
        {status === 'checking' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
              <Spinner size="lg" />
              <p className="text-gray-500">正在连接 Khoj 服务...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'disconnected' && error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4 max-w-md text-center p-6">
              <Icon icon="mdi:robot-dead-outline" className="w-16 h-16 text-gray-400" />
              <h2 className="text-xl font-semibold">Khoj 服务未连接</h2>
              <p className="text-gray-500">{error}</p>
              
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 w-full text-left">
                <p className="text-sm font-medium mb-2">启动 Khoj 服务：</p>
                <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded block">
                  docker-compose -f docker-compose.khoj.yml up -d
                </code>
              </div>
              
              <div className="flex gap-2">
                <Button
                  color="primary"
                  onPress={checkConnection}
                  startContent={<Icon icon="mdi:refresh" />}
                >
                  重试连接
                </Button>
                <Button
                  variant="light"
                  as="a"
                  href={config.baseUrl}
                  target="_blank"
                  startContent={<Icon icon="mdi:open-in-new" />}
                >
                  在新窗口打开
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* iframe */}
        {status === 'connected' && (
          <>
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-background">
                <Spinner size="lg" />
              </div>
            )}
            <iframe
              src={getKhojChatUrl()}
              className={`w-full h-full border-0 ${iframeLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              title="Khoj AI"
              allow="microphone; clipboard-write"
            />
          </>
        )}
      </div>
    </div>
  );
}
```

### 3. 设置页面 Khoj 配置区域

```typescript
// components/BlinkoSettings/KhojSetting.tsx

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Button, Card, CardBody } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { getKhojConfig, saveKhojConfig, checkKhojHealth } from '@/lib/khojService';

export function KhojSetting() {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    const config = getKhojConfig();
    setUrl(config.baseUrl);
  }, []);

  const handleSave = () => {
    saveKhojConfig({ baseUrl: url });
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    // 临时保存以测试
    saveKhojConfig({ baseUrl: url });
    
    const isHealthy = await checkKhojHealth();
    setTestResult(isHealthy ? 'success' : 'error');
    setTesting(false);
  };

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:robot-outline" className="w-5 h-5" />
          <h3 className="font-semibold">Khoj AI 助手</h3>
        </div>
        
        <p className="text-sm text-gray-500">
          配置 Khoj 服务器连接，启用 AI 知识检索功能
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium">服务器地址</label>
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:42110"
              className="flex-1"
            />
            <Button
              variant="flat"
              onPress={handleTest}
              isLoading={testing}
              startContent={!testing && <Icon icon="mdi:connection" />}
            >
              测试连接
            </Button>
          </div>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 text-sm ${
            testResult === 'success' ? 'text-green-600' : 'text-red-600'
          }`}>
            <Icon icon={testResult === 'success' ? 'mdi:check-circle' : 'mdi:alert-circle'} />
            {testResult === 'success' ? '连接成功' : '连接失败，请检查服务是否启动'}
          </div>
        )}

        <Button
          color="primary"
          onPress={handleSave}
          className="w-full"
        >
          保存配置
        </Button>
      </CardBody>
    </Card>
  );
}
```

---

## Data Models

### Khoj 配置存储

```typescript
// 存储在 localStorage 中
interface KhojLocalStorage {
  khoj_url: string;        // Khoj 服务器地址
  khoj_enabled: boolean;   // 是否启用
}

// 默认值
const DEFAULTS = {
  khoj_url: 'http://localhost:42110',
  khoj_enabled: true,
};
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: Connection Status Accuracy
*For any* Khoj server state (running or stopped), the connection status indicator SHALL accurately reflect the actual server availability within 5 seconds of state change.
**Validates: Requirements 2.2, 2.3, 4.1, 4.2, 4.3**

### Property 2: Error Message Clarity
*For any* connection failure scenario, the error message displayed SHALL provide actionable guidance for the user to resolve the issue.
**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 3: iframe Load State Consistency
*For any* iframe load attempt, the loading indicator SHALL be visible until the iframe content is fully loaded or an error occurs.
**Validates: Requirements 3.4, 3.5**

---

## Error Handling

### 错误场景和处理

| 场景 | 错误信息 | 处理方式 |
|------|----------|----------|
| Khoj 服务未启动 | "Khoj 服务未连接" | 显示启动命令，提供重试按钮 |
| 网络超时 | "连接超时" | 提供重试按钮 |
| iframe 加载失败 | "无法加载 Khoj 界面" | 提供"在新窗口打开"链接 |
| CORS 错误 | "跨域访问被阻止" | 提示检查 Khoj 配置 |

### 错误处理代码

```typescript
// 统一错误处理
function handleKhojError(error: unknown): string {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return '网络连接失败，请检查 Khoj 服务是否启动';
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '连接超时，请稍后重试';
  }
  return '未知错误，请检查控制台日志';
}
```

---

## Testing Strategy

### 测试类型

| 类型 | 框架 | 用途 |
|------|------|------|
| 单元测试 | Vitest | 服务函数测试 |
| 组件测试 | Testing Library | UI 组件测试 |
| 手动测试 | - | 端到端验证 |

### 测试场景

1. **连接成功场景**
   - Khoj 服务运行时，页面正常加载 iframe
   - 连接状态显示"已连接"

2. **连接失败场景**
   - Khoj 服务未运行时，显示错误信息
   - 连接状态显示"未连接"
   - 重试按钮可用

3. **配置保存场景**
   - 修改 URL 后保存，刷新页面配置保持
   - 测试连接按钮正确反馈结果

---

## 路由配置

### 添加 Khoj 路由

```typescript
// 在 Blinko 路由配置中添加
{
  path: '/khoj',
  element: <KhojPage />,
  meta: {
    title: 'Khoj AI',
    icon: 'mdi:robot-outline',
  }
}
```

### 导航菜单配置

```typescript
// 在导航配置中添加
{
  name: 'Khoj AI',
  path: '/khoj',
  icon: 'mdi:robot-outline',
  group: 'ai', // 与 AI 页面同组
}
```

---

## Docker 配置

### Khoj Docker Compose

```yaml
# docker-compose.khoj.yml
version: '3.8'

services:
  khoj:
    image: ghcr.io/khoj-ai/khoj:latest
    container_name: blinko-khoj
    ports:
      - "42110:42110"
    environment:
      - KHOJ_ADMIN_EMAIL=admin@blinko.local
      - KHOJ_ADMIN_PASSWORD=your-secure-password
      - KHOJ_DJANGO_SECRET_KEY=your-secret-key
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    volumes:
      - khoj_data:/root/.khoj
    restart: unless-stopped

volumes:
  khoj_data:
```

### 启动脚本

```bash
#!/bin/bash
# scripts/start-khoj.sh

echo "Starting Khoj service..."

# 检查 Docker
if ! docker info > /dev/null 2>&1; then
  echo "Error: Docker is not running"
  exit 1
fi

# 启动 Khoj
docker-compose -f docker-compose.khoj.yml up -d

# 等待启动
echo "Waiting for Khoj to start..."
for i in {1..30}; do
  if curl -s http://localhost:42110/api/health > /dev/null; then
    echo "✓ Khoj is ready at http://localhost:42110"
    exit 0
  fi
  sleep 1
done

echo "Error: Khoj failed to start"
exit 1
```
