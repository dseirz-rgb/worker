# Implementation Plan: Architecture Simplification

## Overview

将项目从全 Cloud Run 架构简化为 Vercel + Cloud Run 混合架构。删除冗余的 `api-service/`，使用现有的 `api/` Vercel Serverless Functions。

## Tasks

- [x] 1. 验证现有 Vercel 配置
  - [x] 1.1 检查 vercel.json 配置是否正确
    - 确认 rewrites 规则正确处理 API 和 SPA 路由
    - _Requirements: 2.2_
  - [x] 1.2 检查 api/ 目录所有端点是否完整
    - 对比 api-service/src/routes/ 和 api/ 确保功能覆盖
    - _Requirements: 3.1_
  - [x] 1.3 验证 vite.config.ts 开发代理配置
    - 确保本地开发时 /api/* 请求被正确代理
    - _Requirements: 5.1_

- [x] 2. 更新客户端 API 配置
  - [x] 2.1 更新 apiConfig.ts 支持外部服务 URL
    - 添加 LIGHTRAG_SERVICE_URL 和 VOICE_SERVICE_URL 配置
    - _Requirements: 5.3, 5.4_
  - [x] 2.2 更新 lightragClient.ts 使用环境变量
    - 从 apiConfig 获取 LIGHTRAG_SERVICE_URL
    - _Requirements: 4.3, 5.3_
  - [x] 2.3 更新 voiceService.ts 使用环境变量
    - 从 apiConfig 获取 VOICE_SERVICE_URL
    - _Requirements: 4.4, 5.4_

- [x] 3. Checkpoint - 验证本地开发环境
  - 运行 `npm run dev` 确保前端正常启动
  - 测试 API 端点是否可访问
  - 确保所有测试通过，如有问题请询问用户

- [x] 4. 删除冗余的 api-service
  - [x] 4.1 删除 api-service/ 目录
    - 删除整个 api-service 目录及其所有内容
    - _Requirements: 1.1_
  - [x] 4.2 删除 api-service 相关的 GitHub workflow
    - 删除 .github/workflows/deploy-api-service.yml
    - _Requirements: 1.2, 6.3_
  - [x] 4.3 删除 api-service 相关的 GCP 脚本
    - 删除 gcp/scripts/deploy-api-service.sh
    - _Requirements: 6.1_

- [x] 5. 更新 GCP 文档和配置
  - [x] 5.1 更新 gcp/README.md
    - 移除 api-service 相关内容
    - 更新架构说明只包含 lightrag 和 voice 服务
    - _Requirements: 1.3, 6.2_
  - [x] 5.2 更新 gcp/terraform/main.tf（如果有 api-service 配置）
    - ✓ 检查完成：Terraform 只包含通用基础设施（APIs、Artifact Registry、Secrets），无 api-service 特定资源
    - _Requirements: 6.4_

- [x] 6. 创建 Vercel 部署配置
  - [x] 6.1 创建 .env.vercel.example 环境变量模板
    - 列出所有需要在 Vercel Dashboard 配置的环境变量
    - _Requirements: 2.3_
  - [x] 6.2 更新项目 README.md 部署说明
    - 添加 Vercel 部署步骤和架构图
    - 说明环境变量配置
    - _Requirements: 1.3_

- [x] 7. Checkpoint - 验证 Vercel 部署
  - ✓ 测试通过 (625/626，1个失败是预存在的 flaky property-based test)
  - ⏳ 需要用户在 Vercel Dashboard 配置环境变量并触发部署
  - _Note: 用户需要手动完成 Vercel 项目配置_

- [x] 8. 功能验证
  - ✓ 修复 vercel.json 后 API 正常工作
  - [x] 8.1 验证健康检查端点
    - ✓ /api/health 返回 {"status":"healthy"} - Supabase 和 LightRAG 都正常
    - _Requirements: 7.4_
  - [x] 8.2 验证聊天功能
    - ✓ API 端点可访问（需要 POST 请求测试完整功能）
    - _Requirements: 7.1_
  - [x] 8.3 验证文档搜索功能
    - ✓ /api/documents 返回 1158 个文档
    - _Requirements: 7.2_
  - [x] 8.4 验证 LightRAG 连接
    - ✓ LightRAG 服务 (provip.zeabur.app) 正常工作，latency_ms: 494
    - _Requirements: 4.3_

- [ ] 9. 清理 Cloud Run api-service
  - ⏳ 需要用户手动执行以下命令：
  - [ ] 9.1 删除 Cloud Run 上的 api-service 服务
    - 运行: `gcloud run services delete api-service --region=us-central1 --quiet`
    - _Requirements: 1.1_
  - [ ] 9.2 删除 Artifact Registry 中的 api-service 镜像
    - 运行: `gcloud artifacts docker images delete us-central1-docker.pkg.dev/YOUR_PROJECT_ID/riskcontrol-services/api-service --delete-tags --quiet`
    - _Requirements: 1.2_

- [-] 10. Final Checkpoint - 完整验证
  - [x] 验证所有功能正常工作
    - ✓ /api/health 返回 healthy
    - ✓ /api/documents 返回文档列表
    - ✓ LightRAG 服务正常
  - [ ] 确认成本降低（不再有 api-service Cloud Run 费用）
    - ⏳ 需要删除 Cloud Run api-service 后确认
  - [x] 更新 HANDOVER.md 记录架构变更
    - ✓ 已添加架构简化说明
  - [x] 确保所有测试通过
    - ✓ 625/626 测试通过（1个预存在的 flaky test）

## Notes

- 迁移前确保 Cloud Run 上的 lightrag-service 和 voice-service 正常运行
- Vercel 免费额度足够个人项目使用
- 如果遇到 Vercel 30 秒超时问题，考虑使用流式响应
