# Requirements Document

## Introduction

将 Janitor（文件整理助手）从 Python 重写为 Rust，直接集成到 Tauri 桌面应用中。Janitor 的核心功能是使用 AI 分析文件内容，自动分类并整理到指定目录，支持撤销操作。

## Glossary

- **Janitor**: 文件整理服务，负责分析、分类和移动文件
- **Category**: 文件分类，如"投资"、"工作"、"个人"等
- **Undo_Logger**: 撤销日志记录器，记录所有文件移动操作以支持回滚
- **AI_Classifier**: AI 分类器，调用 LLM API 分析文件内容并推荐分类
- **Tauri_Command**: Tauri 前端可调用的 Rust 后端命令

## Requirements

### Requirement 1: 文件分析

**User Story:** As a user, I want to analyze files in a directory, so that I can get AI-powered classification suggestions.

#### Acceptance Criteria

1. WHEN a user requests analysis of a directory, THE Janitor SHALL scan all supported file types (pdf, txt, png, jpg, jpeg)
2. WHEN analyzing a file, THE AI_Classifier SHALL extract file metadata (name, size, creation date, modification date)
3. WHEN analyzing a text file, THE AI_Classifier SHALL read and summarize the content
4. WHEN analyzing an image file, THE AI_Classifier SHALL use vision model to describe the content
5. THE Janitor SHALL return a list of files with suggested categories and confidence scores

### Requirement 2: 文件分类配置

**User Story:** As a user, I want to configure file categories, so that I can customize how my files are organized.

#### Acceptance Criteria

1. THE Janitor SHALL support loading categories from a YAML configuration file
2. WHEN a category is defined, THE Category SHALL have id, name, path, keywords, and color properties
3. THE Janitor SHALL provide default categories if no configuration exists
4. WHEN a user adds a new category, THE Janitor SHALL persist it to the configuration file
5. WHEN a user updates a category, THE Janitor SHALL validate the path exists or can be created
6. WHEN a user deletes a category, THE Janitor SHALL remove it from the configuration

### Requirement 3: 文件移动

**User Story:** As a user, I want to move files to their suggested categories, so that my files are automatically organized.

#### Acceptance Criteria

1. WHEN a user commits a file move, THE Janitor SHALL move the file from source to destination
2. WHEN moving a file, THE Janitor SHALL create the destination directory if it doesn't exist
3. WHEN a file is moved, THE Undo_Logger SHALL record the operation with timestamp, paths, category, and reason
4. IF a file already exists at destination, THEN THE Janitor SHALL return an error without overwriting
5. WHEN a move fails, THE Janitor SHALL log the failure and return a descriptive error

### Requirement 4: 撤销操作

**User Story:** As a user, I want to undo file moves, so that I can recover from mistakes.

#### Acceptance Criteria

1. WHEN a user requests undo, THE Undo_Logger SHALL move the file back to its original location
2. THE Undo_Logger SHALL support undoing the last N operations
3. THE Undo_Logger SHALL support undoing all operations since a specific timestamp
4. WHEN undoing, THE Janitor SHALL verify the file still exists at the destination
5. IF the original location already has a file, THEN THE Janitor SHALL return an error
6. THE Undo_Logger SHALL persist history to a CSV file for durability

### Requirement 5: Tauri 集成

**User Story:** As a developer, I want Janitor integrated into Tauri, so that the desktop app has built-in file organization.

#### Acceptance Criteria

1. THE Janitor SHALL expose Tauri commands for: analyze, commit, undo, history, get_config, update_config, get_categories
2. WHEN the Tauri app starts, THE Janitor SHALL initialize with default or saved configuration
3. THE Tauri_Command SHALL handle errors gracefully and return structured error responses
4. THE Janitor SHALL use async operations to avoid blocking the UI thread

### Requirement 6: AI 服务调用

**User Story:** As a user, I want Janitor to use cloud AI for classification, so that I get accurate suggestions.

#### Acceptance Criteria

1. THE AI_Classifier SHALL support Groq API for text analysis (llama-3.1-70b-versatile)
2. THE AI_Classifier SHALL support configurable API endpoints and models
3. WHEN AI service is unavailable, THE Janitor SHALL return a graceful error
4. THE AI_Classifier SHALL use JSON response format for structured output
5. THE Janitor SHALL support configurable confidence threshold for auto-classification

### Requirement 6.1: AI 上下文优化

**User Story:** As a user, I want Janitor to minimize AI token usage, so that I save costs and get faster responses.

#### Acceptance Criteria

1. THE AI_Classifier SHALL use minimal prompts with only essential information
2. WHEN analyzing files, THE Janitor SHALL batch similar files to reduce API calls
3. THE Janitor SHALL cache file summaries to avoid re-analyzing unchanged files
4. WHEN using vision models, THE Janitor SHALL compress screenshots before sending
5. THE Janitor SHALL use structured output schemas to reduce response tokens
6. WHEN processing natural language instructions, THE Janitor SHALL extract intent locally before calling AI
7. THE Janitor SHALL maintain a local keyword-based classifier as fallback to reduce AI dependency
8. THE AI_Classifier SHALL limit context window to last 3 interactions maximum (not 5 like UI-TARS)
9. THE Janitor SHALL provide token usage statistics for monitoring

### Requirement 7: 健康检查

**User Story:** As a user, I want to check if Janitor is working, so that I can troubleshoot issues.

#### Acceptance Criteria

1. THE Janitor SHALL provide a health check command returning service status
2. THE health check SHALL verify configuration is loaded
3. THE health check SHALL return version information

### Requirement 8: 自然语言文件自动化（可选功能）

**User Story:** As a user, I want to describe tasks in natural language like "整理下载文件夹" or "把所有PDF归档", so that Janitor can automatically perform the operations on any folder.

#### Acceptance Criteria

1. THE Janitor SHALL provide a toggle to enable/disable file automation feature
2. WHEN automation is enabled and user provides a text instruction, THE Janitor SHALL interpret the intent
3. THE Janitor SHALL support operations on any user-accessible folder, not just Desktop
4. WHEN instruction is "整理下载文件夹", THE Janitor SHALL analyze Downloads folder and suggest classifications
5. WHEN instruction is "把文档里的旧文件归档", THE Janitor SHALL identify and move old files
6. THE Janitor SHALL support common Chinese and English instructions for file organization
7. WHEN automation is disabled, THE Janitor SHALL still provide core manual classification features
8. THE Janitor SHALL use AI to parse natural language instructions into structured operations
9. IF instruction is ambiguous, THEN THE Janitor SHALL ask for clarification before executing

### Requirement 9: 系统文件夹保护

**User Story:** As a user, I want system folders protected, so that Janitor won't accidentally damage my system.

#### Acceptance Criteria

1. THE Janitor SHALL maintain a list of protected system paths (e.g., /System, /Library, /usr, /bin, /Applications, ~/Library)
2. WHEN a user attempts to organize a protected folder, THE Janitor SHALL refuse and explain why
3. WHEN moving files, THE Janitor SHALL never move files INTO protected system folders
4. THE Janitor SHALL allow users to add custom protected paths
5. THE Janitor SHALL warn before operating on folders containing more than 1000 files
6. IF a file operation would affect system stability, THEN THE Janitor SHALL block it with a clear error

### Requirement 10: 桌面截图分析（可选功能）

**User Story:** As a user, I want Janitor to see my screen and help organize visible files, so that I can get context-aware suggestions.

#### Acceptance Criteria

1. THE Janitor SHALL provide a toggle to enable/disable screen capture feature
2. WHEN screen capture is enabled, THE Janitor SHALL be able to take screenshots of the desktop
3. WHEN analyzing a screenshot, THE AI_Classifier SHALL identify visible files and folders
4. THE Janitor SHALL suggest organization actions based on visible desktop clutter
5. WHEN automation is combined with screen capture, THE Janitor SHALL perform click and drag operations via UI automation
6. THE Janitor SHALL request user permission before any automated mouse/keyboard actions
