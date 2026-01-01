# Implementation Plan: 个人多端认证架构简化

## Overview

简化 Echo 项目的认证架构，屏蔽不需要的功能，方便个人开发使用。

**本阶段目标**: 屏蔽 OAuth2 和复杂认证，简化开发体验。
**后续阶段**: API Token 管理、设备管理等功能。

## Tasks

- [x] 1. 屏蔽 OAuth2 功能
  - [x] 1.1 添加环境变量控制 OAuth2 启用状态
    - 修改 `server/routerExpress/auth/config.ts`
    - 添加 `ENABLE_OAUTH` 环境变量检查，默认 false
    - _Requirements: 1.3_
    - ✅ 已完成: 添加了 `ENABLE_OAUTH` 环境变量，在 `configureSession` 中条件执行 OAuth 初始化，同时更新了 `reinitializeOAuthStrategies` 函数
  - [x] 1.2 更新环境变量配置
    - 更新 `get/blinko-main/.env` 添加 `ENABLE_OAUTH=false`
    - 更新 `.env.example` 添加说明
    - _Requirements: 1.3_
    - ✅ 已完成: 更新了 `.env.example`、`get/blinko-main/.env`、`get/blinko-main/.env.tmpl` 三个文件

- [x] 2. 简化 2FA 配置
  - [x] 2.1 添加 2FA 开关环境变量
    - 添加 `ENABLE_2FA` 环境变量，默认 false
    - 修改 2FA 检查逻辑，根据环境变量跳过
    - _Requirements: 5.1_
    - ✅ 已完成: 在 `server/routerExpress/auth/config.ts` 中添加了 `ENABLE_2FA` 环境变量检查，在 OAuth 回调、JWT 策略和 Local 策略三处 2FA 检查中都添加了 `ENABLE_2FA &&` 条件

- [x] 3. 服务间通信简化
  - [x] 3.1 确认 Janitor 客户端无需认证 ✅
    - 检查 `server/lib/janitorClient.ts`
    - 确保 Docker 内网调用不带认证 header
    - **已确认**: 客户端只设置 `Content-Type: application/json`，无认证 header
    - _Requirements: 4.1, 4.3_

- [x] 4. Checkpoint - 验证简化后的认证流程 ✅
  - ✅ 代码审查确认：OAuth2 和 2FA 通过环境变量控制，默认禁用
  - ✅ 服务间通信使用 Docker 内网直连，无需认证
  - ✅ 登录流程保持不变（Local + JWT 策略）

## 后续任务 (暂不实现)

以下任务在需要时再实现：

- API Token 生成和管理功能
- 设备管理功能
- 登录失败锁定
- IP 白名单
- 前端管理界面

## Notes

- 本阶段聚焦于简化，不增加新功能
- OAuth2 和 2FA 通过环境变量控制，保留代码但默认禁用
- 服务间通信依赖 Docker 内网，无需额外认证

