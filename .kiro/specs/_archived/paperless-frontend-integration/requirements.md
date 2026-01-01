# Requirements Document - Paperless 分阶段整合

## Introduction

本文档定义 Paperless-ngx 分阶段整合到 Blinko 的完整需求。采用**前端优先**的整合策略：先完全整合前端 UI，确保用户体验统一后，再分阶段整合后端服务。

### 整合策略概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        整合路线图                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Phase 1: 前端整合 (本阶段重点)                                          │
│  ├── 1.1 文件页面框架                                                    │
│  ├── 1.2 文档列表与搜索                                                  │
│  ├── 1.3 文档上传与预览                                                  │
│  ├── 1.4 元数据管理 (标签/类型/通讯者)                                   │
│  └── 1.5 配置与设置                                                      │
│                                                                         │
│  Phase 2: 后端整合 - 基础层 (后续)                                       │
│  ├── 2.1 文档存储迁移 (Paperless → Blinko S3/本地)                      │
│  ├── 2.2 元数据迁移 (Paperless DB → Blinko PostgreSQL)                  │
│  └── 2.3 API 适配层 (保持前端接口不变)                                   │
│                                                                         │
│  Phase 3: 后端整合 - 能力层 (后续)                                       │
│  ├── 3.1 OCR 能力 (tesseract.js / 外部服务)                             │
│  ├── 3.2 全文搜索 (PostgreSQL FTS / pgvector)                           │
│  └── 3.3 AI 分类 (复用 Blinko AI 服务)                                  │
│                                                                         │
│  Phase 4: 完全整合 (后续)                                                │
│  ├── 4.1 移除 Paperless 依赖                                            │
│  ├── 4.2 数据迁移工具                                                    │
│  └── 4.3 统一搜索 (笔记 + 文档)                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 当前架构 vs 目标架构

**当前架构 (Phase 1)**:
```
┌─────────────────────────────────────────────────────────────────┐
│                    Blinko 应用                                   │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React)                                               │
│  └── /files - 文件管理页面 (新增)                                │
├─────────────────────────────────────────────────────────────────┤
│  Backend (tRPC)                                                 │
│  └── paperless.ts - API 代理                                    │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Paperless-ngx (独立服务)                         │
│  ├── Web Server (Django)                                        │
│  ├── PostgreSQL (文档数据)                                       │
│  ├── Redis (任务队列)                                            │
│  └── Consumer (OCR 处理)                                         │
└─────────────────────────────────────────────────────────────────┘
```

**目标架构 (Phase 4)**:
```
┌─────────────────────────────────────────────────────────────────┐
│                    Blinko 应用 (完全整合)                        │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React)                                               │
│  └── /files - 文件管理页面                                       │
├─────────────────────────────────────────────────────────────────┤
│  Backend (tRPC + Services)                                      │
│  ├── documents.ts - 文档 CRUD                                   │
│  ├── documentService.ts - 业务逻辑                              │
│  ├── ocrService.ts - OCR 处理                                   │
│  └── searchService.ts - 全文搜索                                │
├─────────────────────────────────────────────────────────────────┤
│  Database (PostgreSQL)                                          │
│  ├── Document 表                                                │
│  ├── DocumentType 表                                            │
│  ├── Correspondent 表                                           │
│  └── FTS 索引                                                   │
├─────────────────────────────────────────────────────────────────┤
│  Storage                                                        │
│  ├── S3/MinIO (生产)                                            │
│  └── 本地文件系统 (开发)                                         │
└─────────────────────────────────────────────────────────────────┘
```

## Glossary

- **Paperless_Service**: Paperless-ngx 后端服务，提供 REST API
- **File_Proxy**: Blinko 后端 tRPC 路由，代理 Paperless API 调用
- **Document_Service**: Blinko 原生文档服务 (Phase 2+)
- **Document**: 文档对象，包含元数据和内容
- **Correspondent**: 通讯者/来源，如公司、个人
- **Document_Type**: 文档类型，如发票、合同、收据
- **Tag**: 标签，用于分类和过滤
- **OCR_Service**: 光学字符识别服务，从图片/扫描件提取文本
- **FTS**: Full-Text Search，全文搜索

---

# Phase 1: 前端整合

## 1.1 文件页面框架

### Requirement 1.1.1: 页面入口

**User Story:** 作为用户，我想要在 Blinko 侧边栏看到文件管理入口，以便快速访问文件功能。

#### Acceptance Criteria

1. THE Sidebar SHALL display a "Files" menu item with folder icon
2. WHEN clicking "Files", THE System SHALL navigate to /files page
3. THE File_Page SHALL use Blinko's glass-effect design language
4. THE File_Page SHALL be responsive for desktop, tablet, and mobile
5. THE File_Page SHALL display loading skeleton while fetching initial data
6. IF Paperless_Service is not configured, THE File_Page SHALL show configuration guide with link to settings

---

### Requirement 1.1.2: 页面布局

**User Story:** 作为用户，我想要一个清晰的文件管理界面，以便高效地浏览和操作文档。

#### Acceptance Criteria

1. THE File_Page SHALL have a three-column layout: sidebar, main content, detail panel
2. THE Sidebar SHALL contain filters (tags, types, correspondents) and be collapsible
3. THE Main_Content SHALL contain search bar, toolbar, and document list
4. THE Detail_Panel SHALL show selected document preview and metadata
5. WHEN no document is selected, THE Detail_Panel SHALL show placeholder or hide
6. THE Layout SHALL remember user's panel size preferences in localStorage

---

## 1.2 文档列表与搜索

### Requirement 1.2.1: 文档列表

**User Story:** 作为用户，我想要浏览所有已上传的文档，以便了解我的文档库。

#### Acceptance Criteria

1. THE Document_List SHALL display documents in grid view (default) or list view
2. THE Document_List SHALL show document thumbnail, title, date added, correspondent, and tags
3. THE Document_List SHALL support infinite scroll with 20 items per page
4. THE Document_List SHALL support sorting by: date added, date created, title, correspondent
5. WHEN a document is clicked, THE System SHALL select it and show in detail panel
6. WHEN a document is double-clicked, THE System SHALL open full preview modal
7. THE Document_List SHALL show empty state with upload prompt when no documents exist
8. THE Document_List SHALL show document count in toolbar

---

### Requirement 1.2.2: 文档搜索

**User Story:** 作为用户，我想要通过关键词搜索文档内容，以便快速找到需要的文档。

#### Acceptance Criteria

1. THE File_Page SHALL display a prominent search input field in toolbar
2. WHEN user enters search keywords, THE System SHALL query Paperless full-text search API
3. THE Search_Results SHALL highlight matching text snippets in document cards
4. THE Search_Results SHALL show match count for each document
5. WHEN search query is cleared, THE System SHALL show all documents
6. THE System SHALL debounce search input by 300ms to avoid excessive API calls
7. THE System SHALL show "Searching..." indicator during search
8. IF no results found, THE System SHALL show "No documents match your search" message

---

### Requirement 1.2.3: 文档过滤

**User Story:** 作为用户，我想要按标签、类型、日期过滤文档，以便缩小查找范围。

#### Acceptance Criteria

1. THE File_Sidebar SHALL display available tags with document count badge
2. THE File_Sidebar SHALL display available document types with document count badge
3. THE File_Sidebar SHALL display available correspondents with document count badge
4. WHEN a tag is clicked, THE Document_List SHALL filter to show only documents with that tag
5. WHEN multiple tags are selected, THE System SHALL use OR logic (show documents with any selected tag)
6. WHEN a document type is selected, THE Document_List SHALL filter to that type only
7. THE System SHALL support date range filter with date picker
8. THE System SHALL show active filters as chips in toolbar with clear button
9. WHEN "Clear all filters" is clicked, THE System SHALL reset to show all documents

---

## 1.3 文档上传与预览

### Requirement 1.3.1: 文档上传

**User Story:** 作为用户，我想要上传文档到系统，以便系统帮我管理和搜索。

#### Acceptance Criteria

1. THE Toolbar SHALL display an "Upload" button with plus icon
2. THE File_Page SHALL support drag-and-drop upload anywhere on the page
3. WHEN files are dropped, THE System SHALL show upload modal with file list
4. THE Upload_Modal SHALL allow setting title, tags, document type before upload
5. THE System SHALL support: PDF, PNG, JPG, JPEG, TIFF, GIF, TXT, MD, DOC, DOCX, XLS, XLSX
6. THE System SHALL show upload progress bar for each file
7. THE System SHALL support batch upload (multiple files at once)
8. WHEN upload completes, THE System SHALL show success notification and refresh list
9. IF upload fails, THE System SHALL display specific error message with retry option
10. THE System SHALL validate file size (max 50MB per file)

---

### Requirement 1.3.2: 文档预览

**User Story:** 作为用户，我想要预览文档内容而不下载，以便快速确认文档内容。

#### Acceptance Criteria

1. THE Detail_Panel SHALL show document preview thumbnail
2. WHEN "Open Preview" is clicked, THE System SHALL open full-screen preview modal
3. THE Preview_Modal SHALL display PDF files using embedded PDF viewer (pdf.js)
4. THE Preview_Modal SHALL display image files with zoom and pan support
5. THE Preview_Modal SHALL display text content for TXT and MD files with syntax highlighting
6. THE Preview_Modal SHALL show OCR extracted text tab for scanned documents
7. THE Preview_Modal SHALL provide page navigation for multi-page documents
8. THE Preview_Modal SHALL provide zoom controls (fit width, fit page, zoom in/out)
9. THE Preview_Modal SHALL provide download original file button
10. IF preview is not available, THE System SHALL show message and download button

---

### Requirement 1.3.3: 文档下载

**User Story:** 作为用户，我想要下载文档原文件，以便在本地使用。

#### Acceptance Criteria

1. THE Detail_Panel SHALL display "Download" button
2. WHEN Download is clicked, THE System SHALL download original file with original filename
3. THE System SHALL support downloading archived version (if available)
4. THE System SHALL show download progress for large files

---

## 1.4 元数据管理

### Requirement 1.4.1: 文档编辑

**User Story:** 作为用户，我想要编辑文档的元数据，以便更好地组织文档。

#### Acceptance Criteria

1. THE Detail_Panel SHALL display editable document title field
2. THE Detail_Panel SHALL display tag selector with autocomplete
3. THE Detail_Panel SHALL display document type dropdown
4. THE Detail_Panel SHALL display correspondent dropdown with search
5. THE Detail_Panel SHALL display date fields (created, added)
6. WHEN any field is changed, THE System SHALL show "Save" button
7. WHEN Save is clicked, THE System SHALL sync changes to Paperless_Service
8. THE System SHALL show save success/error notification
9. THE System SHALL support inline editing (click to edit)

---

### Requirement 1.4.2: 标签管理

**User Story:** 作为用户，我想要管理标签，以便更好地组织文档。

#### Acceptance Criteria

1. THE File_Sidebar SHALL display "Tags" section with all tags
2. THE Tag_Item SHALL show tag name, color indicator, and document count
3. THE System SHALL allow creating new tags via "+" button
4. THE Create_Tag_Modal SHALL allow setting name and color
5. THE System SHALL allow editing tag by right-click context menu
6. THE System SHALL allow deleting tag with confirmation dialog
7. WHEN a tag is deleted, THE System SHALL remove it from all documents
8. THE System SHALL sync all tag changes to Paperless_Service
9. THE System SHALL support drag-and-drop to assign tags to documents

---

### Requirement 1.4.3: 文档类型管理

**User Story:** 作为用户，我想要管理文档类型，以便区分不同类型的文档。

#### Acceptance Criteria

1. THE File_Sidebar SHALL display "Document Types" section
2. THE System SHALL provide predefined types: Invoice, Contract, Receipt, Letter, Report, Other
3. THE System SHALL allow creating custom document types
4. THE System SHALL allow editing document type name
5. THE System SHALL allow deleting document types with confirmation
6. THE System SHALL sync document type changes to Paperless_Service

---

### Requirement 1.4.4: 通讯者管理

**User Story:** 作为用户，我想要管理通讯者/来源，以便追踪文档来源。

#### Acceptance Criteria

1. THE File_Sidebar SHALL display "Correspondents" section
2. THE System SHALL allow creating new correspondents
3. THE System SHALL allow editing correspondent name
4. THE System SHALL allow deleting correspondents with confirmation
5. THE System SHALL sync correspondent changes to Paperless_Service
6. THE System SHALL suggest correspondents based on document content (if AI enabled)

---

### Requirement 1.4.5: 文档删除

**User Story:** 作为用户，我想要删除不需要的文档，以便保持文档库整洁。

#### Acceptance Criteria

1. THE Detail_Panel SHALL display "Delete" button with trash icon
2. WHEN Delete is clicked, THE System SHALL show confirmation dialog
3. THE Confirmation_Dialog SHALL warn about permanent deletion
4. WHEN confirmed, THE System SHALL delete document from Paperless_Service
5. WHEN deleted, THE System SHALL remove from list and clear detail panel
6. THE System SHALL show delete success notification

---

## 1.5 配置与设置

### Requirement 1.5.1: Paperless 连接配置

**User Story:** 作为用户，我想要配置 Paperless 连接，以便连接到我的文档服务。

#### Acceptance Criteria

1. THE Settings_Page SHALL have a "File Management" section
2. THE Settings SHALL display Paperless-ngx URL input field
3. THE Settings SHALL display API token input field (password type)
4. THE Settings SHALL display "Test Connection" button
5. WHEN Test Connection is clicked, THE System SHALL verify API connectivity
6. IF connection succeeds, THE System SHALL show green checkmark and "Connected"
7. IF connection fails, THE System SHALL show red X and specific error message
8. THE Settings SHALL have "Save" button to persist configuration
9. THE System SHALL store configuration in database (encrypted for token)

---

### Requirement 1.5.2: 显示偏好

**User Story:** 作为用户，我想要自定义文件页面的显示方式，以便符合我的使用习惯。

#### Acceptance Criteria

1. THE Settings SHALL allow choosing default view mode (grid/list)
2. THE Settings SHALL allow choosing default sort order
3. THE Settings SHALL allow choosing items per page (20/50/100)
4. THE Settings SHALL allow enabling/disabling thumbnail previews
5. THE System SHALL persist preferences in localStorage

---

## 1.6 高级功能

### Requirement 1.6.1: 批量操作

**User Story:** 作为用户，我想要批量操作多个文档，以便提高效率。

#### Acceptance Criteria

1. THE Document_List SHALL support multi-select via checkbox or Ctrl/Cmd+click
2. WHEN documents are selected, THE Toolbar SHALL show selection count and batch actions
3. THE Batch_Actions SHALL include: Add tags, Remove tags, Change type, Change correspondent, Delete
4. WHEN batch action is executed, THE System SHALL show progress indicator
5. WHEN batch action completes, THE System SHALL show result summary (X succeeded, Y failed)
6. THE System SHALL allow canceling batch operation in progress

---

### Requirement 1.6.2: 快捷键支持

**User Story:** 作为用户，我想要使用快捷键操作，以便提高效率。

#### Acceptance Criteria

1. THE System SHALL support Ctrl/Cmd+K for focus search
2. THE System SHALL support Ctrl/Cmd+U for upload dialog
3. THE System SHALL support Escape to close modals and clear selection
4. THE System SHALL support Arrow keys for document navigation in list
5. THE System SHALL support Enter to open selected document preview
6. THE System SHALL support Delete/Backspace to delete selected document (with confirmation)
7. THE System SHALL display keyboard shortcuts in help tooltip

---

### Requirement 1.6.3: 移动端适配

**User Story:** 作为用户，我想要在手机上使用文件管理功能，以便随时查看文档。

#### Acceptance Criteria

1. THE File_Page SHALL use responsive layout for screens < 768px
2. THE File_Sidebar SHALL collapse to bottom sheet on mobile
3. THE Document_List SHALL use single column card layout on mobile
4. THE Detail_Panel SHALL be full-screen overlay on mobile
5. THE Preview_Modal SHALL be full-screen with touch gestures on mobile
6. THE Upload SHALL support mobile file picker and camera capture

---

# Phase 2: 后端整合 - 基础层

## 2.1 数据模型

### Requirement 2.1.1: Document 数据模型

**User Story:** 作为开发者，我想要在 Blinko 数据库中存储文档数据，以便减少对 Paperless 的依赖。

#### Acceptance Criteria

1. THE System SHALL create Document table in PostgreSQL with Prisma
2. THE Document model SHALL include: id, title, content, originalFile, archivedFile, mimeType, fileSize, checksum
3. THE Document model SHALL include relations: tags, documentType, correspondent, account
4. THE Document model SHALL include timestamps: created, modified, added
5. THE System SHALL create DocumentType, Correspondent tables
6. THE System SHALL reuse existing Tag model or create document-specific tags
7. THE System SHALL create database indexes for search optimization

---

### Requirement 2.1.2: 文件存储

**User Story:** 作为开发者，我想要将文档文件存储在 Blinko 管理的存储中，以便统一文件管理。

#### Acceptance Criteria

1. THE System SHALL support S3-compatible storage for production
2. THE System SHALL support local filesystem storage for development
3. THE System SHALL store original files with unique identifiers
4. THE System SHALL store archived/processed versions separately
5. THE System SHALL generate and store file checksums for deduplication
6. THE System SHALL support file streaming for large files

---

### Requirement 2.1.3: API 适配层

**User Story:** 作为开发者，我想要保持前端 API 接口不变，以便平滑迁移后端。

#### Acceptance Criteria

1. THE Document_Service SHALL implement same interface as Paperless proxy
2. THE System SHALL support feature flag to switch between Paperless and native backend
3. THE System SHALL maintain backward compatibility during migration
4. THE System SHALL log API calls for debugging and monitoring

---

## 2.2 数据迁移

### Requirement 2.2.1: Paperless 数据迁移

**User Story:** 作为用户，我想要将 Paperless 中的文档迁移到 Blinko，以便完全切换到原生后端。

#### Acceptance Criteria

1. THE System SHALL provide migration script/tool
2. THE Migration_Tool SHALL export all documents from Paperless API
3. THE Migration_Tool SHALL download and re-upload all files
4. THE Migration_Tool SHALL preserve all metadata (tags, types, correspondents)
5. THE Migration_Tool SHALL show progress and handle errors gracefully
6. THE Migration_Tool SHALL support incremental migration (only new documents)
7. THE Migration_Tool SHALL generate migration report

---

# Phase 3: 后端整合 - 能力层

## 3.1 OCR 能力

### Requirement 3.1.1: 文本提取

**User Story:** 作为用户，我想要系统自动提取文档中的文本，以便进行全文搜索。

#### Acceptance Criteria

1. THE OCR_Service SHALL extract text from PDF files (native text or OCR)
2. THE OCR_Service SHALL extract text from images (PNG, JPG, TIFF)
3. THE OCR_Service SHALL support Chinese and English languages
4. THE OCR_Service SHALL process documents asynchronously via job queue
5. THE System SHALL store extracted text in Document.content field
6. THE System SHALL show OCR processing status in document detail

---

### Requirement 3.1.2: 文档解析

**User Story:** 作为用户，我想要系统解析各种文档格式，以便提取内容。

#### Acceptance Criteria

1. THE System SHALL parse DOCX files and extract text
2. THE System SHALL parse XLSX files and extract cell content
3. THE System SHALL parse TXT and MD files directly
4. THE System SHALL handle encoding issues gracefully

---

## 3.2 全文搜索

### Requirement 3.2.1: PostgreSQL FTS

**User Story:** 作为用户，我想要快速搜索文档内容，以便找到需要的文档。

#### Acceptance Criteria

1. THE System SHALL use PostgreSQL Full-Text Search for document content
2. THE System SHALL create tsvector column for Document.content
3. THE System SHALL create GIN index for fast search
4. THE System SHALL support Chinese text search (zhparser or pg_jieba)
5. THE Search SHALL return ranked results with relevance score
6. THE Search SHALL highlight matching terms in results

---

### Requirement 3.2.2: 向量搜索 (可选)

**User Story:** 作为用户，我想要通过语义搜索找到相关文档，即使关键词不完全匹配。

#### Acceptance Criteria

1. THE System SHALL generate embeddings for document content using AI service
2. THE System SHALL store embeddings in pgvector
3. THE System SHALL support semantic similarity search
4. THE System SHALL combine FTS and vector search for hybrid results

---

## 3.3 AI 分类

### Requirement 3.3.1: 自动标签建议

**User Story:** 作为用户，我想要系统自动建议标签，以便快速分类文档。

#### Acceptance Criteria

1. THE System SHALL analyze document content after OCR
2. THE System SHALL suggest relevant tags based on content
3. THE System SHALL use existing Blinko AI service for analysis
4. THE User SHALL be able to accept or reject suggested tags
5. THE System SHALL learn from user feedback to improve suggestions

---

### Requirement 3.3.2: 自动文档类型识别

**User Story:** 作为用户，我想要系统自动识别文档类型，以便自动分类。

#### Acceptance Criteria

1. THE System SHALL analyze document content to determine type
2. THE System SHALL recognize common types: Invoice, Contract, Receipt, Letter
3. THE System SHALL suggest document type with confidence score
4. THE User SHALL be able to confirm or change suggested type

---

# Phase 4: 完全整合

## 4.1 统一搜索

### Requirement 4.1.1: 全局搜索整合

**User Story:** 作为用户，我想要在一个搜索框中同时搜索笔记和文档，以便快速找到信息。

#### Acceptance Criteria

1. THE Global_Search SHALL search both notes and documents
2. THE Search_Results SHALL show result type (note/document) indicator
3. THE Search_Results SHALL be ranked by relevance across both types
4. THE User SHALL be able to filter results by type
5. THE System SHALL support advanced search syntax

---

## 4.2 清理与优化

### Requirement 4.2.1: 移除 Paperless 依赖

**User Story:** 作为开发者，我想要完全移除 Paperless 依赖，以便简化部署。

#### Acceptance Criteria

1. THE System SHALL remove Paperless Docker containers from compose files
2. THE System SHALL remove Paperless client code
3. THE System SHALL update documentation
4. THE System SHALL provide migration guide for existing users

