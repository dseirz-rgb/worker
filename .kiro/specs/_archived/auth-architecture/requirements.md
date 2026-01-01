# Requirements Document

## Introduction

本文档梳理 Echo 项目的认证架构，针对**个人用户多端使用**场景进行简化设计。

> 版本: v1.0
> 最后更新: 2026-01-01
> 使用场景: 个人用户、多端 (Web/桌面/移动)、云端自托管

## 当前认证架构分析

### 现有认证方式

| 认证方式 | 实现位置 | 个人使用需求 |
|---------|---------|-------------|
| 本地账号密码 | Blinko Server (Passport Local) | ✅ 保留 - 主要登录方式 |
| JWT Token | Blinko Server (Passport JWT) | ✅ 保留 - 多端认证核心 |
| OAuth2 | Blinko Server (Passport OAuth) | ❌ 屏蔽 - 个人使用不需要 |
| 2FA (TOTP) | Blinko Server | ⚠️ 可选 - 云端暴露时启用 |
| API Token | accounts.apiToken | ✅ 需要 - 脚本/自动化使用 |

### 简化后的认证流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     多端客户端                                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ Web UI  │  │ Tauri   │  │ Mobile  │  │ 脚本/API │            │
│  │ :1111   │  │ 桌面端   │  │ (未来)  │  │ 自动化   │            │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │
│       │            │            │            │                  │
│       └────────────┴────────────┴────────────┘                  │
│                         │                                        │
│              ┌──────────▼──────────┐                            │
│              │   JWT Token 认证    │                            │
│              │   (Bearer Token)    │                            │
│              └──────────┬──────────┘                            │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Blinko Server                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  认证端点 (简化版)                                        │    │
│  │  /api/auth/login    → 用户名密码登录                      │    │
│  │  /api/auth/profile  → 验证 Token + 返回用户信息           │    │
│  │  /api/auth/token    → 生成/管理 API Token                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  内部服务调用 (无需认证)                                   │    │
│  │  Blinko ←→ Janitor (Docker 内网)                         │    │
│  │  Blinko ←→ Paperless (Docker 内网)                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 需要处理的问题

1. **屏蔽 OAuth2** - 个人使用不需要第三方登录
2. **简化 2FA** - 默认关闭，云端暴露时可选启用
3. **API Token** - 需要完善生成和管理功能
4. **多端 Token 同步** - 确保各端 Token 一致性
5. **服务间通信** - Docker 内网直接调用，无需认证

## Glossary

- **JWT**: JSON Web Token，多端认证的核心机制
- **API_Token**: 长期有效的访问令牌，用于脚本和自动化
- **Single_User**: 单用户模式，简化认证流程
- **Internal_Network**: Docker 内部网络，服务间直接通信

## Requirements

### Requirement 1: 简化登录认证

**User Story:** As a 个人用户, I want 简单的登录方式, so that 我可以快速访问我的数据。

#### Acceptance Criteria

1. THE Auth_System SHALL 支持用户名密码登录
2. THE Auth_System SHALL 返回长期有效的 JWT Token (30 天)
3. THE Auth_System SHALL 屏蔽 OAuth2 相关功能
4. WHEN 用户登录成功 THEN Token SHALL 在所有端通用
5. THE Auth_System SHALL 支持"记住我"功能延长 Token 有效期

### Requirement 2: 多端 Token 管理

**User Story:** As a 多端用户, I want 在不同设备上保持登录状态, so that 我不需要频繁登录。

#### Acceptance Criteria

1. THE JWT_Token SHALL 在 Web、桌面、移动端通用
2. THE Tauri_App SHALL 安全存储 Token 到本地
3. WHEN Token 即将过期 THEN 客户端 SHALL 自动刷新
4. THE Auth_System SHALL 支持查看活跃设备列表
5. THE Auth_System SHALL 支持远程登出指定设备

### Requirement 3: API Token 功能

**User Story:** As a 个人用户, I want 生成 API Token, so that 我可以在脚本中自动化操作。

#### Acceptance Criteria

1. THE Auth_System SHALL 在设置页面提供 API Token 生成功能
2. THE API_Token SHALL 支持一键复制
3. THE API_Token SHALL 永不过期 (除非手动撤销)
4. WHEN API Token 被撤销 THEN 使用该 Token 的请求 SHALL 立即失效
5. THE Auth_System SHALL 显示 API Token 最后使用时间

### Requirement 4: 服务间通信简化

**User Story:** As a 系统, I want 内部服务直接通信, so that 不需要复杂的认证配置。

#### Acceptance Criteria

1. THE Blinko_Server SHALL 通过 Docker 内网直接调用 Janitor
2. THE Blinko_Server SHALL 通过 Docker 内网直接调用 Paperless
3. THE Internal_Services SHALL 不需要 Token 认证
4. WHEN 服务部署在同一 Docker 网络 THEN 通信 SHALL 使用内部域名

### Requirement 5: 云端安全 (可选)

**User Story:** As a 云端用户, I want 在公网暴露时有额外保护, so that 我的数据安全。

#### Acceptance Criteria

1. THE Auth_System SHALL 支持可选启用 2FA
2. THE Auth_System SHALL 支持 IP 白名单 (可选)
3. WHEN 检测到异常登录 THEN Auth_System SHALL 记录日志
4. THE Auth_System SHALL 支持配置登录失败锁定次数

