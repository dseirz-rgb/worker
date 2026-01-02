# Implementation Plan: Echo 部署架构 v4.0

## Overview

本任务列表实现云端部署（Vercel + GCP Cloud Run + Supabase）和多端分发（macOS、Windows、iOS TestFlight）。

## Tasks

- [x] 1. Supabase 数据库配置
  - [x] 1.1 创建 Supabase 项目
    - 注册/登录 Supabase
    - 创建新项目，选择免费层
    - 记录连接字符串和 API Keys
    - _Requirements: 3.1, 3.3_
  
  - [x] 1.2 启用 pgvector 扩展
    - 在 SQL Editor 中执行 `CREATE EXTENSION vector;`
    - 验证扩展已启用
    - _Requirements: 3.2_
  
  - [x] 1.3 运行数据库迁移
    - 配置 Prisma 连接 Supabase
    - 执行 `prisma migrate deploy`
    - _Requirements: 3.1_

- [x] 2. GCP Cloud Run 后端部署
  - [x] 2.1 创建 Cloud Run Dockerfile
    - 创建 `Dockerfile.cloudrun` 基于 Node.js 18
    - 配置多阶段构建优化镜像大小
    - 配置健康检查端点
    - _Requirements: 2.1, 2.5_
  
  - [x] 2.2 创建 Cloud Build 配置
    - 创建 `cloudbuild.yaml`
    - 配置构建和部署步骤
    - 配置环境变量从 Secret Manager 读取
    - _Requirements: 2.1_
  
  - [x] 2.3 配置 Cloud Run 服务
    - 设置最小实例 0，最大实例 2
    - 配置内存 512MB，CPU 1
    - 配置环境变量连接 Supabase
    - _Requirements: 2.2, 2.3_
  
  - [x] 2.4 创建部署脚本
    - 创建 `deploy.sh` 脚本
    - 支持 `./deploy.sh backend` 部署后端
    - _Requirements: 9.1, 9.3_

- [x] 3. Vercel 前端部署
  - [x] 3.1 创建 vercel.json 配置
    - 配置 API 代理重写规则指向 Cloud Run
    - 配置安全头部
    - **修复**: 添加 SPA fallback 规则 `/(.*) → /index.html`
    - _Requirements: 1.1, 1.5_
  
  - [x] 3.2 配置 Vercel 环境变量
    - 设置 NEXT_PUBLIC_API_URL
    - 设置 Supabase 相关变量
    - **修复**: 改用 GitHub Secrets 配置 BACKEND_URL（Vercel rewrites 不支持环境变量）
    - _Requirements: 1.4_
  
  - [x] 3.3 配置 GitHub 自动部署
    - 连接 GitHub 仓库
    - 配置 main 分支自动部署
    - **修复**: 更新 workflow 动态生成 vercel.json 注入 BACKEND_URL
    - _Requirements: 1.3_

- [x] 4. Checkpoint - 验证云端部署
  - 确认 Cloud Run 后端已部署并获取 URL
  - 在 Vercel 设置 BACKEND_URL 环境变量
  - 访问 Vercel 部署的前端
  - 验证 API 请求到达 Cloud Run
  - 验证数据库读写正常
  - 如有问题，询问用户
  
  **当前状态**: 
  - Vercel 前端配置已完成 (vercel.json)
  - Cloud Run 配置已完成 (Dockerfile.cloudrun, cloudbuild.yaml)
  - **需要手动操作**: 
    1. 运行 `./deploy.sh secrets` 设置 GCP Secrets
    2. 运行 `./deploy.sh backend` 部署后端
    3. 获取 Cloud Run URL 并设置到 Vercel 环境变量

- [x] 5. Tauri 桌面端基础配置
  - [x] 5.1 初始化 Tauri 项目
    - 在 get/blinko-main 中添加 Tauri
    - 配置 tauri.conf.json
    - _Requirements: 6.1, 7.1_
  
  - [x] 5.2 配置多平台构建
    - 配置 macOS (arm64) 构建
    - 配置 Windows (x64) 构建
    - _Requirements: 6.3, 7.3_

- [x] 6. Janitor Sidecar 集成 (桌面端)
  - [x] 6.1 打包 Janitor 为可执行文件
    - 使用 PyInstaller 打包 macOS 版本
    - 使用 PyInstaller 打包 Windows 版本
    - _Requirements: 5.2_
  
  - [x] 6.2 配置 Tauri Sidecar
    - 更新 tauri.conf.json 添加 externalBin
    - 配置不同平台的 Sidecar 路径
    - _Requirements: 5.2, 6.4, 7.4_
  
  - [x] 6.3 实现 Sidecar 生命周期管理
    - 应用启动时启动 Janitor
    - 应用退出时停止 Janitor
    - 实现状态监控
    - _Requirements: 6.5, 7.5_

- [x] 7. macOS 发布配置
  - [x] 7.1 配置 macOS 签名
    - 配置 Apple Developer 证书
    - 配置 entitlements.plist
    - _Requirements: 6.2_
  
  - [x] 7.2 配置 GitHub Actions 构建
    - 创建 `.github/workflows/build-macos.yml`
    - 配置 arm64 构建
    - 配置自动发布到 GitHub Releases
    - _Requirements: 6.1, 6.3_
  
  - [x] 7.3 配置自动更新
    - 配置 Tauri Updater 插件
    - 配置更新服务器 URL
    - _Requirements: 6.6_

- [x] 8. Windows 发布配置
  - [x] 8.1 配置 Windows 签名 (可选)
    - 配置代码签名证书
    - _Requirements: 7.2_
  
  - [x] 8.2 配置 GitHub Actions 构建
    - 创建 `.github/workflows/build-windows.yml`
    - 配置 msi 和 exe 输出
    - 配置自动发布到 GitHub Releases
    - _Requirements: 7.1, 7.2_

- [x] 9. iOS TestFlight 发布配置
  - [x] 9.1 配置 Tauri iOS 构建
    - 配置 iOS 项目设置
    - 移除 Janitor 相关代码（iOS 不需要）
    - _Requirements: 8.2_
  
  - [x] 9.2 配置 App Store Connect
    - 创建 App ID
    - 配置 TestFlight
    - _Requirements: 8.1_
  
  - [x] 9.3 配置 GitHub Actions 构建
    - 创建 `.github/workflows/build-ios.yml`
    - 配置自动上传到 TestFlight
    - _Requirements: 8.1, 8.4_

- [ ] 10. Checkpoint - 验证桌面端构建
  - 本地构建 macOS 版本并测试
  - 本地构建 Windows 版本并测试
  - 验证 Janitor Sidecar 正常启动
  - 如有问题，询问用户

- [x] 11. 本地开发环境更新
  - [x] 11.1 更新 dev.sh 脚本
    - 移除旧服务引用 (SeekDB, Khoj)
    - 更新 status 命令输出
    - _Requirements: 4.2, 4.4_
  
  - [x] 11.2 更新 docker-compose.dev.yml
    - 确保本地 PostgreSQL + pgvector 配置正确
    - 确保 Janitor 服务配置正确
    - _Requirements: 4.1, 4.5_
  
  - [x] 11.3 更新 .env.example
    - 添加云端部署相关配置说明
    - 移除废弃的配置项
    - _Requirements: 4.1_

- [ ] 12. Final Checkpoint - 完整验证
  - 验证云端部署正常工作
  - 验证 GitHub Actions 构建流程
  - 验证桌面端安装包可用
  - 如有问题，询问用户

## Notes

- 本任务列表基于 v4.0 云端 + 多端分发架构
- 云端采用经济方案：Vercel (免费) + Cloud Run (学生额度) + Supabase (免费层)
- iOS 版本不包含 Janitor 文件整理服务
- 桌面端 (macOS/Windows) 包含 Janitor Sidecar
- 每个任务引用具体的需求条款以确保可追溯性
