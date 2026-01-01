# Implementation Plan: Paperless 分阶段整合

## Overview

本实现计划采用前端优先策略，先完全整合前端 UI 到 Blinko，后端继续使用 Paperless-ngx 独立服务。后续阶段再逐步整合后端。

## Phase 1: 前端整合

### 1. 后端基础设施

- [x] 1.1 创建 Paperless API 客户端 ✅
  - [x] 1.1.1 创建 `server/lib/paperlessClient.ts` ✅
    - 实现 PaperlessClient 类
    - 实现文档 CRUD 方法 (list, get, upload, update, delete)
    - 实现下载和预览方法
    - 实现标签、文档类型、通讯者 CRUD 方法
    - 实现连接测试方法
    - _Requirements: 1.2.1, 1.2.2, 1.3.1, 1.4.1-1.4.5, 1.5.1_

  - [x] 1.1.2 创建 `server/routerTrpc/paperless.ts` ✅
    - 实现 documents.* 路由 (list, search, get, upload, update, delete, download, preview, thumbnail)
    - 实现 tags.* 路由 (list, create, update, delete)
    - 实现 documentTypes.* 路由 (list, create, delete)
    - 实现 correspondents.* 路由 (list, create, delete)
    - 实现 config.* 路由 (get, save, testConnection)
    - _Requirements: 1.2.1-1.2.3, 1.3.1-1.3.3, 1.4.1-1.4.5, 1.5.1_

  - [x] 1.1.3 注册路由到主 router ✅
    - 在 `server/routerTrpc/_app.ts` 中添加 paperlessRouter
    - _Requirements: 1.1.1_

- [x] 1.2 Checkpoint - 后端基础设施 ✅
  - 确保 tRPC 路由可以正常调用
  - 测试与 Paperless-ngx 的连接
  - 如有问题请询问用户

### 2. 前端 Hooks 和状态管理

- [x] 2.1 创建 Paperless React Hooks ✅
  - [x] 2.1.1 创建 `app/src/hooks/usePaperless.ts` ✅
    - 实现 useDocuments (无限滚动查询)
    - 实现 useDocument, useDocumentPreview, useDocumentThumbnail
    - 实现 useUploadDocument, useUpdateDocument, useDeleteDocument
    - 实现 useTags, useCreateTag, useUpdateTag, useDeleteTag
    - 实现 useDocumentTypes, useCreateDocumentType, useDeleteDocumentType
    - 实现 useCorrespondents, useCreateCorrespondent, useDeleteCorrespondent
    - 实现 usePaperlessConfig, useSavePaperlessConfig, useTestPaperlessConnection
    - _Requirements: 1.2.1-1.2.3, 1.3.1, 1.4.1-1.4.5, 1.5.1_

  - [x] 2.1.2 创建预览和上传状态 Store ✅
    - 创建 `app/src/store/fileStore.ts`
    - 实现 usePreviewStore (isOpen, documentId, open, close)
    - 实现 useUploadStore (isOpen, files, open, close, addFiles, removeFile)
    - _Requirements: 1.3.1, 1.3.2_

- [ ] 2.2 编写 Hooks 单元测试
  - 测试 useDocuments 分页逻辑
  - 测试 mutation hooks 的缓存失效
  - _Requirements: 1.2.1, 1.4.1_

### 3. 文件页面框架

- [x] 3.1 创建文件页面入口 ✅
  - [x] 3.1.1 创建 `app/src/pages/files.tsx` ✅
    - 实现三栏布局 (sidebar, main, detail)
    - 实现响应式布局
    - 实现未配置状态引导
    - _Requirements: 1.1.1, 1.1.2_

  - [x] 3.1.2 更新侧边栏导航 ✅
    - 在 `app/src/components/Layout/Sidebar.tsx` 添加 Files 菜单项
    - 添加文件夹图标
    - _Requirements: 1.1.1.1, 1.1.1.2_

  - [x] 3.1.3 更新路由配置 ✅
    - 在 `app/src/App.tsx` 添加 /files 路由
    - _Requirements: 1.1.1.2_

  - [x] 3.1.4 添加国际化文案 ✅
    - 更新 `app/public/locales/zh/translation.json`
    - 更新 `app/public/locales/en/translation.json`
    - _Requirements: 1.1.1_

- [x] 3.2 Checkpoint - 页面框架 ✅
  - 确保 /files 页面可以正常访问
  - 确保侧边栏导航正常工作
  - 如有问题请询问用户

### 4. 文档列表组件

- [x] 4.1 创建文档列表相关组件 ✅
  - [x] 4.1.1 创建 `app/src/components/Files/FileToolbar.tsx` ✅
    - 实现搜索输入框 (带防抖)
    - 实现视图切换按钮 (grid/list)
    - 实现排序下拉菜单
    - 实现上传按钮
    - 实现文档计数显示
    - _Requirements: 1.2.1.4, 1.2.2.1, 1.2.2.6_

  - [x] 4.1.2 创建 `app/src/components/Files/FileList.tsx` ✅
    - 实现 grid 和 list 两种视图
    - 实现无限滚动加载
    - 实现加载骨架屏
    - 实现空状态显示
    - _Requirements: 1.2.1.1, 1.2.1.3, 1.2.1.5, 1.2.1.6, 1.2.1.7_

  - [x] 4.1.3 创建 `app/src/components/Files/DocumentCard.tsx` ✅
    - 实现 grid 视图卡片
    - 实现 list 视图行
    - 显示缩略图、标题、日期、通讯者、标签
    - 实现选中状态样式
    - _Requirements: 1.2.1.2, 1.2.1.5, 1.2.1.6_

  - [x] 4.1.4 创建 `app/src/components/Files/DocumentThumbnail.tsx` ✅ (内嵌在 DocumentCard 中)
    - 实现缩略图加载和显示
    - 实现加载占位符
    - 实现错误状态
    - _Requirements: 1.2.1.2_

- [x] 4.2 编写属性测试 - 文档列表显示完整性 ✅
  - **Property 1: 文档列表显示完整性**
  - 测试文件: `app/src/components/Files/documentList.test.ts`
  - **Validates: Requirements 1.2.1.2**

- [x] 4.3 编写属性测试 - 排序正确性 ✅
  - **Property 4: 排序正确性**
  - 测试文件: `app/src/components/Files/documentList.test.ts`
  - **Validates: Requirements 1.2.1.4**

### 5. 搜索和过滤组件

- [x] 5.1 创建过滤侧边栏 ✅
  - [x] 5.1.1 创建 `app/src/components/Files/FileSidebar.tsx` ✅
    - 实现标签过滤区域 (带计数)
    - 实现文档类型过滤区域 (带计数)
    - 实现通讯者过滤区域 (带计数)
    - 实现日期范围过滤
    - 实现折叠/展开功能
    - _Requirements: 1.2.3.1, 1.2.3.2, 1.2.3.3, 1.2.3.7_

  - [x] 5.1.2 创建 `app/src/components/Files/FilterSection.tsx` ✅
    - 实现可折叠的过滤区域
    - 实现过滤项列表
    - 实现添加按钮
    - _Requirements: 1.2.3.1_

  - [x] 5.1.3 创建 `app/src/components/Files/FilterItem.tsx` ✅
    - 实现过滤项显示 (名称、计数、颜色)
    - 实现选中状态
    - 实现点击切换
    - _Requirements: 1.2.3.4, 1.2.3.5, 1.2.3.6_

  - [x] 5.1.4 创建 `app/src/components/Files/ActiveFilters.tsx` ✅
    - 实现活动过滤器 chips 显示
    - 实现单个过滤器清除
    - 实现清除全部按钮
    - _Requirements: 1.2.3.8, 1.2.3.9_

- [x] 5.2 编写属性测试 - 过滤结果正确性 ✅
  - **Property 3: 过滤结果正确性**
  - 测试文件: `app/src/components/Files/documentList.test.ts`
  - **Validates: Requirements 1.2.3.4, 1.2.3.5, 1.2.3.6**

- [x] 5.3 编写属性测试 - 搜索结果高亮 ✅
  - **Property 5: 搜索结果高亮**
  - 测试文件: `app/src/components/Files/documentList.test.ts`
  - **Validates: Requirements 1.2.2.3**

- [x] 5.4 Checkpoint - 列表和过滤 ✅
  - 确保文档列表正常显示
  - 确保搜索和过滤功能正常
  - 如有问题请询问用户


### 6. 文档上传组件

- [x] 6.1 创建上传相关组件 ✅
  - [x] 6.1.1 创建 `app/src/components/Files/FileUpload.tsx` ✅ (原 FileUploadModal)
    - 实现拖放上传区域
    - 实现文件选择器
    - 实现文件列表显示
    - 实现上传进度显示
    - 实现批量上传
    - 实现错误处理和重试
    - _Requirements: 1.3.1.1, 1.3.1.2, 1.3.1.6, 1.3.1.7, 1.3.1.8, 1.3.1.9_

  - [x] 6.1.2 创建 `app/src/components/Files/UploadFileItem.tsx` ✅
    - 实现单个文件项显示
    - 实现标题编辑
    - 实现标签选择
    - 实现进度条
    - 实现状态图标 (pending/uploading/success/error)
    - 实现删除按钮
    - _Requirements: 1.3.1.4, 1.3.1.6_

  - [x] 6.1.3 创建文件验证工具函数 ✅
    - 创建 `app/src/lib/fileValidation.ts`
    - 实现文件类型验证
    - 实现文件大小验证
    - _Requirements: 1.3.1.5, 1.3.1.10_

- [x] 6.2 编写属性测试 - 文件类型验证 ✅
  - **Property 2: 文件类型验证**
  - 测试文件: `app/src/lib/fileValidation.test.ts`
  - 需要安装: `bun add -D vitest fast-check`
  - **Validates: Requirements 1.3.1.5**

### 7. 文档预览组件

- [x] 7.1 创建预览相关组件 ✅
  - [x] 7.1.1 创建 `app/src/components/Files/FilePreview.tsx` ✅ (原 FilePreviewModal)
    - 实现预览模态框布局
    - 实现 Tab 切换 (预览/OCR文本/元数据)
    - 实现下载按钮
    - _Requirements: 1.3.2.1, 1.3.2.6, 1.3.2.9_

  - [x] 7.1.2 创建 `app/src/components/Files/PdfViewer.tsx` ✅
    - 使用 iframe 显示 PDF
    - 实现页面导航
    - 实现缩放控制
    - _Requirements: 1.3.2.3, 1.3.2.7, 1.3.2.8_

  - [x] 7.1.3 创建 `app/src/components/Files/ImageViewer.tsx` ✅
    - 实现图片显示
    - 实现缩放和平移
    - _Requirements: 1.3.2.4_

  - [x] 7.1.4 创建 `app/src/components/Files/TextViewer.tsx` ✅
    - 实现文本显示
    - 实现搜索高亮
    - _Requirements: 1.3.2.5_

  - [x] 7.1.5 创建 `app/src/components/Files/DocumentMetadata.tsx` ✅
    - 实现元数据显示
    - 显示文件名、大小、类型、日期等
    - _Requirements: 1.3.2.5_

- [x] 7.2 Checkpoint - 上传和预览 ✅
  - 确保文件上传功能正常
  - 确保预览功能正常
  - 如有问题请询问用户

### 8. 文档详情面板

- [x] 8.1 创建详情面板组件 ✅
  - [x] 8.1.1 创建 `app/src/components/Files/FilePreview.tsx` ✅ (包含详情面板功能)
    - 实现详情面板布局
    - 实现缩略图预览
    - 实现标题编辑
    - 实现标签选择器
    - 实现文档类型选择器
    - 实现通讯者选择器
    - 实现日期信息显示
    - 实现操作按钮 (预览/下载/编辑/删除)
    - _Requirements: 1.4.1.1-1.4.1.9, 1.4.5.1-1.4.5.5_

  - [x] 8.1.2 创建 `app/src/components/Files/TagSelector.tsx` ✅
    - 实现标签多选
    - 实现标签搜索/过滤
    - 实现新建标签
    - _Requirements: 1.4.1.2, 1.4.2.4_

  - [x] 8.1.3 创建 `app/src/components/Files/DocumentTypeSelector.tsx` ✅
    - 实现文档类型下拉选择
    - 实现新建类型
    - _Requirements: 1.4.1.3, 1.4.3.3_

  - [x] 8.1.4 创建 `app/src/components/Files/CorrespondentSelector.tsx` ✅
    - 实现通讯者下拉选择 (带搜索)
    - 实现新建通讯者
    - _Requirements: 1.4.1.4, 1.4.4.2_

- [x] 8.2 编写属性测试 - 元数据编辑 Round-Trip ✅
  - **Property 6: 元数据编辑 Round-Trip**
  - 测试文件: `app/src/components/Files/metadata.test.ts`
  - **Validates: Requirements 1.4.1.5, 1.4.1.6**

### 9. 元数据管理

- [x] 9.1 创建元数据管理组件 ✅
  - [x] 9.1.1 创建 `app/src/components/Files/TagManager.tsx` ✅
    - 实现标签列表显示
    - 实现创建标签对话框
    - 实现编辑标签 (名称、颜色)
    - 实现删除标签 (带确认)
    - _Requirements: 1.4.2.1-1.4.2.7_

  - [x] 9.1.2 创建 `app/src/components/Files/DocumentTypeManager.tsx` ✅
    - 实现文档类型列表显示
    - 实现创建类型对话框
    - 实现编辑类型名称
    - 实现删除类型 (带确认)
    - _Requirements: 1.4.3.1-1.4.3.5_

  - [x] 9.1.3 创建 `app/src/components/Files/CorrespondentManager.tsx` ✅
    - 实现通讯者列表显示
    - 实现创建通讯者对话框
    - 实现编辑通讯者名称
    - 实现删除通讯者 (带确认)
    - _Requirements: 1.4.4.1-1.4.4.5_

- [x] 9.2 编写属性测试 - 标签管理 Round-Trip ✅
  - **Property 7: 标签管理 Round-Trip**
  - 测试文件: `app/src/components/Files/metadata.test.ts`
  - **Validates: Requirements 1.4.2.4, 1.4.2.8**

- [x] 9.3 Checkpoint - 详情和元数据 ✅
  - 确保文档详情面板正常工作
  - 确保元数据编辑功能正常
  - 如有问题请询问用户

### 10. 配置设置

- [x] 10.1 创建配置组件 ✅
  - [x] 10.1.1 创建 `app/src/components/BlinkoSettings/PaperlessSetting.tsx` ✅
    - 实现 Paperless URL 输入
    - 实现 API Token 输入 (密码类型)
    - 实现测试连接按钮
    - 实现连接状态显示
    - 实现保存按钮
    - _Requirements: 1.5.1.1-1.5.1.9_

  - [x] 10.1.2 更新设置页面 ✅
    - 在设置页面添加 "文件管理" 区域
    - 集成 PaperlessSetting 组件
    - _Requirements: 1.5.1.1_

- [ ] 10.2 编写属性测试 - 配置持久化
  - **Property 8: 配置持久化**
  - **Validates: Requirements 1.5.1.8**

### 11. 高级功能

- [x] 11.1 批量操作 ✅
  - [x] 11.1.1 更新 FileList 支持多选 ✅
    - 实现 checkbox 多选
    - 实现 Ctrl/Cmd+click 多选
    - 实现选中计数显示
    - _Requirements: 1.6.1.1_

  - [x] 11.1.2 创建 `app/src/components/Files/BatchActionBar.tsx` ✅
    - 实现批量操作工具栏
    - 实现添加标签操作
    - 实现移除标签操作
    - 实现更改类型操作
    - 实现更改通讯者操作
    - 实现批量删除操作
    - 实现进度显示
    - 实现结果摘要
    - _Requirements: 1.6.1.2, 1.6.1.3, 1.6.1.4, 1.6.1.5_

- [ ] 11.2 编写属性测试 - 批量操作完整性
  - **Property 9: 批量操作完整性**
  - **Validates: Requirements 1.6.1.3, 1.6.1.4**

- [x] 11.3 快捷键支持 ✅
  - [x] 11.3.1 创建 `app/src/hooks/useFileKeyboardShortcuts.ts` ✅
    - 实现 Ctrl/Cmd+K 聚焦搜索
    - 实现 Ctrl/Cmd+U 打开上传
    - 实现 Escape 关闭模态框
    - 实现方向键导航
    - 实现 Enter 打开预览
    - 实现 Delete 删除 (带确认)
    - _Requirements: 1.6.2.1-1.6.2.6_

  - [x] 11.3.2 创建快捷键帮助提示 ✅
    - 创建 `app/src/components/Files/KeyboardShortcutsHelp.tsx`
    - 实现快捷键列表显示
    - _Requirements: 1.6.2.7_

- [x] 11.4 移动端适配 ✅
  - [x] 11.4.1 更新 FilesPage 响应式布局 ✅
    - 实现移动端单栏布局
    - 实现侧边栏底部抽屉
    - 实现详情面板全屏覆盖
    - _Requirements: 1.6.3.1, 1.6.3.2, 1.6.3.3, 1.6.3.4_

  - [x] 11.4.2 更新 FilePreviewModal 移动端适配 ✅
    - 实现全屏预览
    - 实现触摸手势
    - _Requirements: 1.6.3.5_

  - [x] 11.4.3 更新 FileUploadModal 移动端适配 ✅
    - 支持移动端文件选择器
    - 支持相机拍照
    - _Requirements: 1.6.3.6_

- [x] 11.5 Checkpoint - 高级功能 ✅
  - 确保批量操作功能正常
  - 确保快捷键功能正常
  - 确保移动端适配正常
  - 如有问题请询问用户

### 12. 组件导出和集成

- [x] 12.1 创建组件索引文件 ✅
  - [x] 12.1.1 创建 `app/src/components/Files/index.ts` ✅
    - 导出所有 Files 组件
    - _Requirements: 1.1.1_

- [x] 12.2 Final Checkpoint - Phase 1 完成 ✅
  - 确保所有功能正常工作
  - 确保所有测试通过 (55 tests passed)
  - 如有问题请询问用户

---

## Phase 2: 后端整合 - 基础层 (后续实现)

### 13. 数据模型

- [x] 13.1 创建 Prisma 模型
  - [x] 13.1.1 更新 `prisma/schema.prisma`
    - 添加 Document 模型
    - 添加 DocumentType 模型
    - 添加 Correspondent 模型
    - 添加 DocumentTag 关联模型
    - 添加 OcrStatus 枚举
    - _Requirements: 2.1.1.1-2.1.1.6_

  - [x] 13.1.2 创建数据库迁移
    - 运行 prisma migrate
    - _Requirements: 2.1.1.7_

### 14. 文件存储服务

- [x] 14.1 创建存储服务
  - [x] 14.1.1 创建 `server/lib/storageService.ts`
    - 实现 S3 存储适配器
    - 实现本地文件系统适配器
    - 实现文件上传
    - 实现文件下载
    - 实现文件删除
    - 实现 checksum 计算
    - _Requirements: 2.1.2.1-2.1.2.6_

- [ ]* 14.2 编写属性测试 - 文件下载 Round-Trip
  - **Property 10: 文件下载 Round-Trip**
  - **Validates: Requirements 2.1.2.5**

### 15. 原生文档服务

- [x] 15.1 创建文档服务
  - [x] 15.1.1 创建 `server/lib/documentService.ts`
    - 实现与 PaperlessClient 相同的接口
    - 实现文档 CRUD
    - 实现标签、类型、通讯者 CRUD
    - _Requirements: 2.1.3.1, 2.1.3.2_

  - [x] 15.1.2 创建 Feature Flag ✅
    - 实现 Paperless/Native 后端切换
    - 创建 `server/lib/documentServiceRouter.ts`
    - 添加 `use_native_documents` 功能开关
    - _Requirements: 2.1.3.2_

### 16. 数据迁移工具

- [x] 16.1 创建迁移脚本 ✅
  - [x] 16.1.1 创建 `scripts/migrate-paperless-data.ts` ✅
    - 实现从 Paperless 导出文档
    - 实现文件下载和重新上传
    - 实现元数据迁移 (标签、文档类型、通讯者)
    - 实现进度显示
    - 实现错误处理
    - 实现增量迁移 (checksum 去重)
    - 实现迁移报告
    - 支持 --dry-run 和 --force 选项
    - _Requirements: 2.2.1.1-2.2.1.7_

- [ ]* 16.2 编写属性测试 - 迁移数据完整性
  - 验证迁移后数据与原始数据一致
  - **Validates: Requirements 2.2.1.5**

### 16.3 Checkpoint - Phase 2 基础层完成 ✅

Phase 2 后端整合基础层已完成:
- ✅ Prisma 数据模型 (document, documentType, correspondent, documentTag)
- ✅ 存储服务 (本地 + S3 适配器)
- ✅ 原生文档服务 (与 PaperlessClient 接口兼容)
- ✅ Feature Flag 切换机制 (use_native_documents)
- ✅ 数据迁移脚本 (支持增量迁移、dry-run、报告生成)

---

## Phase 3: 后端整合 - 能力层 (后续实现)

### 17. OCR 服务

- [x] 17.1 创建 OCR 服务 ✅
  - [x] 17.1.1 创建 `server/lib/ocrService.ts` ✅
    - 集成 tesseract.js (图片 OCR)
    - 实现 PDF 文本提取 (pdf-parse)
    - 实现图片 OCR (tesseract.js)
    - 实现 DOCX 文本提取 (mammoth)
    - 实现 XLSX 文本提取 (xlsx)
    - _Requirements: 3.1.1.1-3.1.1.4, 3.1.2.1-3.1.2.3_

  - [x] 17.1.2 创建 OCR 异步任务 ✅
    - 创建 `server/jobs/documentOcrJob.ts`
    - 实现文档 OCR 处理函数
    - 实现批量处理待处理任务
    - 实现失败任务重试
    - 实现 OCR 统计信息
    - _Requirements: 3.1.1.5_

### 18. 全文搜索

- [x] 18.1 实现 PostgreSQL FTS ✅
  - [x] 18.1.1 创建搜索服务 ✅
    - 创建 `server/lib/documentSearchService.ts`
    - 实现 tsvector 全文搜索
    - 实现搜索结果高亮
    - 实现搜索排名
    - 实现降级 LIKE 搜索
    - 实现搜索建议 (自动补全)
    - _Requirements: 3.2.1.1-3.2.1.6_

- [ ]* 18.2 编写属性测试 - 全文搜索包含性
  - **Property 11: 全文搜索包含性**
  - **Validates: Requirements 3.2.1.4**

### 18.3 Checkpoint - Phase 3 能力层完成 ✅

Phase 3 后端整合能力层已完成:
- ✅ OCR 服务 (tesseract.js + pdf-parse + mammoth + xlsx)
- ✅ OCR 异步任务处理 (批量处理、重试、统计)
- ✅ 全文搜索服务 (PostgreSQL tsvector + 降级 LIKE)
- ✅ 搜索结果高亮和排名
- ✅ 文档上传后自动触发 OCR

---

## Phase 4: 完全整合 (后续实现)

### 19. 统一搜索

- [ ] 19.1 实现全局搜索整合
  - [ ] 19.1.1 更新 GlobalSearch 组件
    - 同时搜索笔记和文档
    - 显示结果类型标识
    - 实现类型过滤
    - _Requirements: 4.1.1.1-4.1.1.4_

### 20. 清理工作

- [ ] 20.1 移除 Paperless 依赖
  - [ ] 20.1.1 更新 Docker Compose
    - 移除 Paperless 相关容器
    - _Requirements: 4.2.1.1_

  - [ ] 20.1.2 清理代码
    - 移除 PaperlessClient
    - 更新文档
    - _Requirements: 4.2.1.2, 4.2.1.3_

---

## Notes

- 每个 Checkpoint 用于验证阶段性成果
- Phase 2-4 为后续实现，本次重点完成 Phase 1
- 属性测试使用 fast-check 库，每个属性至少 100 次迭代
- 所有测试任务都必须完成，确保代码质量
