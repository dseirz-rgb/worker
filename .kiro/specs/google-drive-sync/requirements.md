# Requirements Document

## Introduction

恢复 Google Drive 自动同步功能，将指定文件夹中的书籍和文档自动同步到投资知识库。支持多种文件类型，包括书籍（TXT/PDF/Markdown）、Google Sheets 投资策略、Excel 财务模型等。

## Glossary

- **Drive_Sync_Service**: Google Drive 同步服务，负责监听文件变更并同步到知识库
- **Knowledge_Base**: 投资知识库，存储在 Investment DB 的 documents 表
- **Service_Account**: Google Cloud Service Account，用于 API 认证
- **Change_Token**: Google Drive API 的变更令牌，用于增量同步
- **Investment_DB**: 投资数据库 (Supabase)，存储知识库文档

## Requirements

### Requirement 1: Google Drive 认证

**User Story:** As a system administrator, I want to authenticate with Google Drive using a Service Account, so that the system can access files without user interaction.

#### Acceptance Criteria

1. THE Drive_Sync_Service SHALL authenticate using Google Cloud Service Account credentials
2. WHEN credentials are invalid or missing, THE Drive_Sync_Service SHALL log an error and skip sync
3. THE Drive_Sync_Service SHALL only access the folder specified by GOOGLE_DRIVE_FOLDER_ID environment variable

### Requirement 2: 文件变更检测

**User Story:** As a user, I want the system to automatically detect file changes in Google Drive, so that my knowledge base stays up-to-date.

#### Acceptance Criteria

1. THE Drive_Sync_Service SHALL use Google Drive API change tokens for incremental sync
2. WHEN a new file is added to the monitored folder, THE Drive_Sync_Service SHALL detect and process it
3. WHEN an existing file is modified, THE Drive_Sync_Service SHALL re-process and update the knowledge base
4. WHEN a file is deleted, THE Drive_Sync_Service SHALL remove corresponding entries from the knowledge base
5. THE Drive_Sync_Service SHALL persist the change token to survive restarts

### Requirement 3: 书籍文件处理 (TXT/PDF/Markdown)

**User Story:** As a user, I want to sync investment books from Google Drive, so that I can query them through the AI assistant.

#### Acceptance Criteria

1. WHEN a TXT file is detected, THE Drive_Sync_Service SHALL read and chunk the text content
2. WHEN a PDF file is detected, THE Drive_Sync_Service SHALL extract text and chunk it
3. WHEN a Markdown file is detected, THE Drive_Sync_Service SHALL parse and chunk the content
4. FOR ALL book files, THE Drive_Sync_Service SHALL generate embeddings for each chunk
5. FOR ALL book files, THE Drive_Sync_Service SHALL store chunks with source_type='uploaded_file'
6. THE Drive_Sync_Service SHALL use the filename (without extension) as the document title prefix

### Requirement 4: Google Sheets 投资策略同步

**User Story:** As a user, I want to sync my investment strategy sheets from Google Drive, so that the AI can reference my trading rules.

#### Acceptance Criteria

1. WHEN a Google Sheets file is detected, THE Drive_Sync_Service SHALL export it as text
2. THE Drive_Sync_Service SHALL preserve table structure in a readable format
3. FOR ALL strategy sheets, THE Drive_Sync_Service SHALL store with source_type='strategy_sheet'
4. THE Drive_Sync_Service SHALL update existing entries when the sheet is modified

### Requirement 5: Excel 财务模型处理

**User Story:** As a user, I want to sync Excel financial models from Google Drive, so that I can reference them in investment analysis.

#### Acceptance Criteria

1. WHEN an Excel file (.xlsx/.xls) is detected, THE Drive_Sync_Service SHALL parse all sheets
2. THE Drive_Sync_Service SHALL convert table data to a structured text format
3. FOR ALL Excel files, THE Drive_Sync_Service SHALL store with source_type='financial_model'
4. THE Drive_Sync_Service SHALL preserve numerical precision for financial data

### Requirement 6: 同步调度

**User Story:** As a user, I want the sync to run automatically, so that I don't need to manually trigger updates.

#### Acceptance Criteria

1. THE Drive_Sync_Service SHALL check for changes every 5 minutes (configurable)
2. WHEN the server starts, THE Drive_Sync_Service SHALL perform an initial sync
3. THE Drive_Sync_Service SHALL support manual sync trigger via API endpoint
4. IF a sync is already in progress, THE Drive_Sync_Service SHALL skip the new sync request

### Requirement 7: 错误处理与日志

**User Story:** As a system administrator, I want comprehensive logging, so that I can troubleshoot sync issues.

#### Acceptance Criteria

1. THE Drive_Sync_Service SHALL log all sync operations with timestamps
2. WHEN a file fails to process, THE Drive_Sync_Service SHALL log the error and continue with other files
3. THE Drive_Sync_Service SHALL track sync statistics (files processed, errors, duration)
4. IF Google API rate limits are hit, THE Drive_Sync_Service SHALL implement exponential backoff

### Requirement 8: 前端状态显示

**User Story:** As a user, I want to see the sync status in the knowledge base dialog, so that I know if my files are up-to-date.

#### Acceptance Criteria

1. THE KnowledgeBaseDialog SHALL display the last sync time
2. THE KnowledgeBaseDialog SHALL show sync status (idle/syncing/error)
3. THE KnowledgeBaseDialog SHALL provide a manual sync button
4. WHEN sync completes, THE KnowledgeBaseDialog SHALL refresh the document list

## Verification Criteria

1. ✅ Service Account 认证成功连接 Google Drive
2. ✅ 新增/修改/删除文件能被正确检测
3. ✅ TXT/PDF/Markdown 文件能被正确解析和向量化
4. ✅ Google Sheets 能被导出并存储
5. ✅ Excel 文件能被解析并保留数据结构
6. ✅ 定时同步正常运行
7. ✅ 前端能显示同步状态并手动触发同步
