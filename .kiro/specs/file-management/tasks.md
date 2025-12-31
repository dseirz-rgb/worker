# Implementation Plan: File Management

## Overview

集成 Paperless-ngx 实现文件管理功能，包括文件上传、OCR、全文搜索和标签管理。

**开发目录**: `get/blinko-main/` + `echo/`

**技术栈**: TypeScript + React + tRPC + Docker

---

## Phase 1: 基础设施

### Task 1: Docker Compose 配置

- [x] 1.1 创建 Paperless-ngx Docker Compose 配置
  - 创建 `echo/docker-compose.paperless.yml`
  - 配置 Paperless-ngx、PostgreSQL、Redis 服务
  - 配置持久化卷和网络
  - 配置中文 OCR 支持 (chi_sim+eng)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

- [x] 1.2 创建启动脚本
  - 创建 `echo/scripts/start-paperless.sh`
  - 包含环境变量检查和服务启动
  - _Requirements: 1.5_

- [x] 1.3 Checkpoint - 验证 Paperless-ngx 部署
  - 运行 `docker-compose up -d`
  - 访问 http://localhost:8000 确认服务正常
  - 如有问题，询问用户

---

## Phase 2: 后端 API 代理

### Task 2: Paperless API 客户端

- [x] 2.1 创建 PaperlessClient 类
  - 创建 `server/lib/paperlessClient.ts`
  - 实现 HTTP 请求封装和认证
  - 实现错误处理和重试逻辑
  - _Requirements: 8.2, 8.4_

- [x] 2.2 实现文档操作方法
  - 实现 listDocuments、searchDocuments、getDocument
  - 实现 uploadDocument、downloadDocument、getDocumentPreview
  - 实现 updateDocument、deleteDocument
  - _Requirements: 2.2, 3.2_

- [x] 2.3 实现标签和类型操作方法
  - 实现 listTags、createTag、deleteTag
  - 实现 listDocumentTypes、createDocumentType
  - _Requirements: 6.6_

- [ ]* 2.4 编写 PaperlessClient 单元测试
  - 测试 API 调用和响应转换
  - **Property 1: API Proxy Correctness**
  - **Validates: Requirements 2.2, 3.2, 8.2, 8.3**

---

### Task 3: tRPC 路由

- [x] 3.1 创建 paperless tRPC 路由
  - 创建 `server/routerTrpc/paperless.ts`
  - 实现 documents.list、documents.search、documents.get
  - 实现 documents.upload、documents.download、documents.preview
  - 实现 documents.update、documents.delete
  - _Requirements: 8.1_

- [x] 3.2 实现标签和类型路由
  - 实现 tags.list、tags.create
  - 实现 documentTypes.list、documentTypes.create
  - _Requirements: 6.3, 7.5_

- [x] 3.3 实现配置和连接测试路由
  - 实现 config.get、config.save
  - 实现 config.testConnection
  - _Requirements: 10.4_

- [x] 3.4 注册路由到 Blinko tRPC router
  - 在 `server/routerTrpc/index.ts` 中注册 paperlessRouter
  - _Requirements: 8.1_

- [ ]* 3.5 编写 tRPC 路由测试
  - 测试输入验证
  - 测试错误处理
  - **Property 6: Error Handling**
  - **Validates: Requirements 8.4, 10.4, 10.5**

- [ ] 3.6 Checkpoint - 验证后端 API
  - 使用 tRPC playground 测试各个路由
  - 如有问题，询问用户

---

## Phase 3: 前端页面

### Task 4: 文件管理页面框架

- [x] 4.1 创建文件页面
  - 创建 `app/src/pages/files.tsx`
  - 实现三栏布局 (侧边栏 + 主内容 + 预览)
  - 使用 glass-effect 样式
  - _Requirements: 9.3_

- [x] 4.2 添加路由配置
  - 在 App.tsx 添加 `/files` 路由
  - _Requirements: 9.2_

- [x] 4.3 添加侧边栏入口
  - 在侧边栏添加 "文件" 菜单项
  - 使用文件夹图标
  - _Requirements: 9.1_

---

### Task 5: 文件列表组件

- [x] 5.1 创建 FileList 组件
  - 创建 `app/src/components/Files/FileList.tsx`
  - 实现文档卡片列表
  - 显示标题、日期、标签
  - _Requirements: 4.1, 4.2_

- [x] 5.2 实现排序和分页
  - 实现按日期、标题排序
  - 实现分页控件
  - _Requirements: 4.3, 3.4_

- [ ]* 5.3 编写 FileList 属性测试
  - **Property 3: Document Display Completeness**
  - **Validates: Requirements 3.3, 4.2**

---

### Task 6: 搜索和过滤组件

- [x] 6.1 创建 FileToolbar 组件
  - 创建 `app/src/components/Files/FileToolbar.tsx`
  - 实现搜索输入框
  - 实现排序下拉菜单
  - _Requirements: 3.1_

- [x] 6.2 创建 FileSidebar 组件
  - 创建 `app/src/components/Files/FileSidebar.tsx`
  - 显示标签列表
  - 显示文档类型列表
  - 实现点击过滤
  - _Requirements: 6.1, 6.5, 7.4_

- [ ]* 6.3 编写过滤属性测试
  - **Property 4: List Filtering and Sorting**
  - **Validates: Requirements 3.4, 3.6, 4.3, 4.4, 6.5, 7.4**

---

### Task 7: 文件上传组件

- [x] 7.1 创建 FileUpload 组件
  - 创建 `app/src/components/Files/FileUpload.tsx`
  - 实现拖拽上传区域
  - 实现文件类型验证
  - _Requirements: 2.1, 2.3_

- [x] 7.2 实现上传进度和反馈
  - 显示上传进度条
  - 显示成功/失败通知
  - _Requirements: 2.4, 2.5, 2.6_

- [ ]* 7.3 编写文件类型验证测试
  - **Property 2: File Type Validation**
  - **Validates: Requirements 2.3, 2.5**

---

### Task 8: 文件预览组件

- [x] 8.1 创建 FilePreview 组件
  - 创建 `app/src/components/Files/FilePreview.tsx`
  - 实现 PDF 预览 (使用 react-pdf)
  - 实现图片预览
  - 实现文本预览
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 8.2 实现 OCR 文本显示
  - 显示 OCR 提取的文本
  - _Requirements: 5.4_

- [x] 8.3 实现预览控件
  - 实现缩放控件
  - 实现页面导航
  - 实现下载按钮
  - _Requirements: 5.5, 5.6, 4.6_

- [ ] 8.4 Checkpoint - 验证前端页面
  - 测试文件上传、搜索、预览完整流程
  - 如有问题，询问用户

---

## Phase 4: 标签和类型管理

### Task 9: 标签管理

- [x] 9.1 实现标签添加/删除
  - 在 FilePreview 中添加标签编辑功能
  - 支持从现有标签选择
  - 支持创建新标签
  - _Requirements: 6.2, 6.3_

- [ ]* 9.2 编写标签管理测试
  - **Property 5: Metadata Management**
  - **Validates: Requirements 6.2, 6.3, 6.6, 7.5**

---

### Task 10: 文档类型管理

- [x] 10.1 实现文档类型选择
  - 在上传时支持选择文档类型
  - 在预览中支持修改文档类型
  - _Requirements: 7.1, 7.2_

---

## Phase 5: 设置集成

### Task 11: 配置页面

- [x] 11.1 扩展设置页面
  - 在 Blinko 设置页面添加 "文件管理" 区域
  - 添加 Paperless URL 输入框
  - 添加 API Token 输入框
  - 添加测试连接按钮
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 11.2 实现配置保存
  - 保存配置到数据库
  - 验证连接后再保存
  - _Requirements: 10.4, 10.5, 10.6_

- [ ]* 11.3 编写配置持久化测试
  - **Property 7: Settings Persistence**
  - **Validates: Requirements 10.6**

---

## Phase 6: 最终验收

- [x] 12. Final Checkpoint
  - 验证 Docker 部署正常
  - 验证文件上传、OCR、搜索完整流程
  - 验证标签和类型管理
  - 验证设置保存和加载
  - 代码已更新为 vanilla tRPC client 模式

---

## Notes

- 任务标记 `*` 为可选任务，可跳过以加快 MVP 进度
- **开发目录**: Docker 配置在 `echo/`，代码修改在 `get/blinko-main/`
- 属性测试使用 `fast-check`，每个属性至少 100 次迭代
- Paperless-ngx 默认端口 8000，可通过环境变量配置

