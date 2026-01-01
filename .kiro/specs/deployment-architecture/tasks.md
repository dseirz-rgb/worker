# Implementation Plan: Echo 多端部署架构

## Overview

本任务列表将 Echo 项目的云端+本地混合部署架构分解为可执行的实施步骤，涵盖 Vercel 前端部署、GCP 后端部署、本地 Janitor Sidecar 集成。

## Tasks

- [ ] 1. Vercel 前端部署配置
  - [ ] 1.1 创建 vercel.json 配置文件
    - 配置 API 代理重写规则
    - 配置安全头部 (X-Frame-Options, CSP)
    - 配置环境变量引用
    - _Requirements: 1.1, 1.2, 1.4_
  
  - [ ] 1.2 更新前端环境变量配置
    - 创建 .env.production 模板
    - 配置 NEXT_PUBLIC_API_URL 指向 GCP Cloud Run
    - 配置 NEXT_PUBLIC_WS_URL 用于 WebSocket
    - _Requirements: 1.5_
  
  - [ ] 1.3 创建 Vercel 部署脚本
    - 编写 deploy-vercel.sh 脚本
    - 配置 GitHub Actions 自动部署
    - _Requirements: 1.1_

- [ ] 2. GCP Cloud Run 后端部署
  - [ ] 2.1 创建 Blinko Server Dockerfile
    - 基于 Node.js 18 Alpine 镜像
    - 配置多阶段构建优化镜像大小
    - 配置健康检查端点
    - _Requirements: 2.1, 3.5_
  
  - [ ] 2.2 创建 SeekDB API Dockerfile
    - 基于 Python 3.11 Slim 镜像
    - 安装依赖并配置 FastAPI
    - 配置健康检查端点
    - _Requirements: 3.1, 3.5_
  
  - [ ] 2.3 创建 Cloud Build 配置
    - 编写 cloudbuild.yaml
    - 配置构建和部署步骤
    - 配置环境变量从 Secret Manager 读取
    - _Requirements: 2.1, 2.5_
  
  - [ ] 2.4 创建 Cloud Run 服务配置
    - 编写 service.yaml (Blinko Server)
    - 编写 service-seekdb.yaml (SeekDB API)
    - 配置最小/最大实例数、内存、CPU
    - _Requirements: 2.3, 2.4_

  - [ ]* 2.5 编写健康检查端点测试
    - **Property 3: 健康检查响应**
    - **Validates: Requirements 3.5**

- [ ] 3. GCP Cloud SQL 数据库配置
  - [ ] 3.1 创建 Cloud SQL 实例配置脚本
    - 编写 setup-cloudsql.sh
    - 配置 PostgreSQL 15 实例
    - 配置自动备份和高可用
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ] 3.2 配置 Cloud SQL Proxy
    - 创建服务账号和 IAM 权限
    - 配置 Cloud Run 连接 Cloud SQL
    - _Requirements: 6.5_
  
  - [ ] 3.3 创建数据库迁移脚本
    - 编写 migrate-cloudsql.sh
    - 配置 Prisma 迁移命令
    - _Requirements: 6.1_

- [ ] 4. GCP Compute Engine (SeekDB) 配置
  - [ ] 4.1 创建 Compute Engine 启动脚本
    - 编写 setup-seekdb-vm.sh
    - 配置 Docker 安装和 SeekDB 容器启动
    - 配置防火墙规则 (仅 VPC 内网访问)
    - _Requirements: 3.3, 3.4_
  
  - [ ] 4.2 实现服务降级逻辑
    - 在 searchRouter.ts 中添加 SeekDB 健康检查
    - 实现 SeekDB 不可用时回退到 PostgreSQL FTS
    - _Requirements: 3.4_

  - [ ]* 4.3 编写降级逻辑属性测试
    - **Property 2: 服务降级**
    - **Validates: Requirements 3.4**

- [ ] 5. Tauri Sidecar (Janitor) 集成
  - [ ] 5.1 配置 Tauri Sidecar
    - 更新 tauri.conf.json 添加 externalBin
    - 创建 Janitor Python 打包脚本 (PyInstaller)
    - 配置不同平台的 Sidecar 二进制文件
    - _Requirements: 3.5.1, 3.5.2_
  
  - [ ] 5.2 实现 Sidecar 生命周期管理
    - 在 Tauri 主进程中启动/停止 Janitor
    - 实现 Janitor 状态监控
    - 实现 IPC 通信 (Tauri ↔ Janitor)
    - _Requirements: 3.5.3_
  
  - [ ] 5.3 创建 Janitor 配置 UI
    - 添加 Janitor 设置页面
    - 配置监听文件夹、分类规则
    - 配置 Ollama/云端 API 选择
    - _Requirements: 3.5.4, 3.5.5_
  
  - [ ] 5.4 实现元数据云端同步
    - 添加可选的元数据同步功能
    - 实现同步开关和 API Key 配置
    - _Requirements: 3.5.6_

  - [ ]* 5.5 编写本地隔离属性测试
    - **Property 4: Janitor 本地隔离**
    - **Validates: Requirements 3.5.4, 3.5.6**

- [ ] 6. 桌面端打包与分发
  - [ ] 6.1 配置 Tauri 多平台打包
    - 配置 macOS (dmg/pkg) 打包
    - 配置 Windows (msi/exe) 打包
    - 配置 Linux (AppImage/deb) 打包
    - _Requirements: 4.2, 4.3, 4.4_
  
  - [ ] 6.2 配置 GitHub Actions 自动构建
    - 创建 .github/workflows/build-desktop.yml
    - 配置多平台并行构建
    - 配置自动发布到 GitHub Releases
    - _Requirements: 4.1_
  
  - [ ] 6.3 配置 Tauri 自动更新
    - 配置 updater 插件
    - 创建更新服务器配置
    - _Requirements: 4.6_

- [ ] 7. 移动端打包与分发
  - [ ] 7.1 配置 iOS 打包
    - 配置 Tauri iOS 构建
    - 配置 TestFlight 分发
    - _Requirements: 5.1_
  
  - [ ] 7.2 配置 Android 打包
    - 配置 Tauri Android 构建
    - 配置 Google Play 分发
    - 配置 APK 直接下载
    - _Requirements: 5.3, 5.4_

- [ ] 8. 本地开发环境
  - [ ] 8.1 更新 Docker Compose 配置
    - 确保 docker-compose.dev.yml 包含所有服务
    - 配置本地开发环境变量
    - _Requirements: 7.1_
  
  - [ ] 8.2 更新开发脚本
    - 更新 dev.sh 脚本
    - 添加服务启动顺序控制
    - _Requirements: 7.2_
  
  - [ ] 8.3 创建自托管文档
    - 编写 SELF_HOSTING.md
    - 包含 NAS/家庭服务器部署指南
    - _Requirements: 7.4, 7.5_

- [ ] 9. Checkpoint - 验证部署配置
  - 确保所有配置文件语法正确
  - 确保 Docker 镜像可以正常构建
  - 确保本地开发环境可以正常启动
  - 如有问题，询问用户

- [ ]* 10. 编写配置读取属性测试
  - **Property 1: 环境变量配置读取**
  - **Validates: Requirements 1.5, 4.5, 5.5**

- [ ] 11. Final Checkpoint - 完整验证
  - 确保所有测试通过
  - 确保文档完整
  - 如有问题，询问用户

## Notes

- 任务标记 `*` 为可选测试任务，可跳过以加快 MVP 进度
- 每个任务引用具体的需求条款以确保可追溯性
- Checkpoint 任务用于阶段性验证
- 属性测试验证核心正确性属性
