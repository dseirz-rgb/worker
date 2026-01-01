# Requirements Document - File Management

## Introduction

本文档定义 Echo 文件管理功能的需求。通过集成 Paperless-ngx 开源项目，实现文件自动导入、OCR 识别、全文搜索和 AI 自动分类功能。

### 项目背景

**用户痛点**: 文件管理混乱，没有好的命名习惯，重要文件找不到

**解决方案**: 集成 Paperless-ngx 作为文件管理后端，通过 Echo 前端提供统一的搜索和浏览体验

### 技术策略

| 组件 | 技术方案 | 说明 |
|------|---------|------|
| 文件存储 | Paperless-ngx | Docker 部署，独立服务 |
| OCR 识别 | Paperless-ngx 内置 | Tesseract OCR |
| 全文搜索 | Paperless-ngx 内置 | 基于 PostgreSQL |
| AI 分类 | Paperless-ngx + Echo | 自动标签、分类建议 |
| 前端集成 | Echo (Blinko) | tRPC 代理 + React 页面 |

## Glossary

- **Paperless_Service**: Paperless-ngx 服务，负责文件存储、OCR 和搜索
- **File_Proxy**: Echo 后端代理，转发请求到 Paperless-ngx API
- **Document**: Paperless-ngx 中的文档对象
- **Correspondent**: Paperless-ngx 中的通讯者/来源
- **Document_Type**: Paperless-ngx 中的文档类型
- **Tag**: Paperless-ngx 中的标签

---

## Requirements

### Requirement 1: Paperless-ngx 部署

**User Story:** 作为开发者，我想要快速部署 Paperless-ngx 服务，以便开始文件管理功能开发。

#### Acceptance Criteria

1. THE System SHALL provide a Docker Compose configuration for Paperless-ngx
2. THE Docker Compose SHALL include PostgreSQL database for production use
3. THE Docker Compose SHALL include Redis for task queue
4. THE System SHALL configure persistent volumes for document storage
5. WHEN the service starts, THE System SHALL be accessible at a configurable port (default 8000)
6. THE System SHALL support environment variable configuration for API tokens

---

### Requirement 2: 文件上传

**User Story:** 作为用户，我想要上传文件到 Echo，以便系统帮我管理和搜索。

#### Acceptance Criteria

1. THE File_Page SHALL display a file upload area with drag-and-drop support
2. WHEN a user uploads a file, THE File_Proxy SHALL forward it to Paperless_Service
3. THE System SHALL support PDF, PNG, JPG, JPEG, TIFF, GIF, TXT, MD, DOC, DOCX file types
4. WHEN upload completes, THE System SHALL show a success notification with document ID
5. IF upload fails, THE System SHALL display a specific error message
6. THE System SHALL show upload progress for large files

---

### Requirement 3: 文件搜索

**User Story:** 作为用户，我想要通过关键词搜索文件内容，以便快速找到需要的文件。

#### Acceptance Criteria

1. THE File_Page SHALL display a search input field
2. WHEN a user enters search keywords, THE File_Proxy SHALL query Paperless_Service full-text search
3. THE Search_Results SHALL display document title, correspondent, tags, and match snippets
4. THE Search_Results SHALL support pagination (default 20 items per page)
5. WHEN a user clicks a search result, THE System SHALL open document preview
6. THE System SHALL support advanced search filters (date range, tags, document type)

---

### Requirement 4: 文件浏览

**User Story:** 作为用户，我想要浏览所有已上传的文件，以便了解我的文件库。

#### Acceptance Criteria

1. THE File_Page SHALL display a document list with thumbnail previews
2. THE Document_List SHALL show document title, date added, correspondent, and tags
3. THE Document_List SHALL support sorting by date, title, or correspondent
4. THE Document_List SHALL support filtering by tags and document types
5. WHEN a user clicks a document, THE System SHALL open a detail view with full preview
6. THE Detail_View SHALL allow downloading the original file

---

### Requirement 5: 文件预览

**User Story:** 作为用户，我想要预览文件内容而不下载，以便快速确认文件内容。

#### Acceptance Criteria

1. THE Preview_Modal SHALL display PDF files using an embedded PDF viewer
2. THE Preview_Modal SHALL display image files directly
3. THE Preview_Modal SHALL display text content for TXT and MD files
4. THE Preview_Modal SHALL show OCR extracted text for scanned documents
5. THE Preview_Modal SHALL provide zoom and page navigation controls for PDFs
6. IF preview is not available, THE System SHALL offer download option

---

### Requirement 6: 标签管理

**User Story:** 作为用户，我想要给文件添加标签，以便更好地组织和查找文件。

#### Acceptance Criteria

1. THE File_Page SHALL display available tags in a sidebar or filter panel
2. WHEN viewing a document, THE User SHALL be able to add or remove tags
3. THE System SHALL support creating new tags with custom colors
4. THE System SHALL suggest tags based on document content (AI-powered)
5. WHEN a tag is clicked in the sidebar, THE System SHALL filter documents by that tag
6. THE System SHALL sync tags with Paperless-ngx

---

### Requirement 7: 文档类型管理

**User Story:** 作为用户，我想要按文档类型分类文件，以便区分发票、合同、收据等不同类型。

#### Acceptance Criteria

1. THE System SHALL support predefined document types (Invoice, Contract, Receipt, Letter, etc.)
2. WHEN uploading a document, THE User SHALL be able to select document type
3. THE System SHALL suggest document type based on content (AI-powered)
4. THE Document_List SHALL support filtering by document type
5. THE User SHALL be able to create custom document types

---

### Requirement 8: API 代理服务

**User Story:** 作为开发者，我想要通过 Echo 后端代理访问 Paperless-ngx API，以便统一认证和错误处理。

#### Acceptance Criteria

1. THE File_Proxy SHALL implement tRPC routes for all Paperless-ngx operations
2. THE File_Proxy SHALL handle authentication with Paperless-ngx API token
3. THE File_Proxy SHALL transform Paperless-ngx responses to Echo data format
4. IF Paperless_Service is unavailable, THE File_Proxy SHALL return a friendly error message
5. THE File_Proxy SHALL cache frequently accessed data (tags, document types)
6. THE File_Proxy SHALL log all API calls for debugging

---

### Requirement 9: 文件页面集成

**User Story:** 作为用户，我想要在 Echo 侧边栏看到文件管理入口，以便快速访问文件功能。

#### Acceptance Criteria

1. THE Sidebar SHALL display a "Files" menu item with folder icon
2. WHEN clicking "Files", THE System SHALL navigate to /files page
3. THE File_Page SHALL use Echo's existing UI components (glass-effect, etc.)
4. THE File_Page SHALL be responsive for desktop, tablet, and mobile
5. THE File_Page SHALL integrate with Echo's search (optional: unified search)

---

### Requirement 10: 配置管理

**User Story:** 作为用户，我想要在设置页面配置 Paperless-ngx 连接，以便连接到我的文件服务。

#### Acceptance Criteria

1. THE Settings_Page SHALL have a "File Management" section
2. THE Settings SHALL allow configuring Paperless-ngx URL
3. THE Settings SHALL allow configuring API token
4. THE System SHALL validate connection when saving settings
5. IF connection fails, THE System SHALL display specific error message
6. THE Settings SHALL be stored in database and synced across devices

