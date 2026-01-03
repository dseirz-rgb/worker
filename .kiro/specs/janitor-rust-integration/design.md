# Design Document: Janitor Rust Integration

## Overview

Janitor 是一个智能文件整理助手，集成到 Echo 桌面应用（Tauri）中。它使用 AI 分析文件内容，自动分类并整理到指定目录，支持撤销操作和自然语言指令。

**平台限制：此功能仅在 macOS 和 Windows 桌面客户端可用。**
- Web 版、iOS 版、其他平台显示"此功能仅在电脑客户端可用"
- 移动端安装包不包含此模块

核心设计原则：
1. **Rust 原生** - 直接集成到 Tauri 后端，无需额外进程
2. **AI 优化** - 最小化 token 消耗，本地优先
3. **安全第一** - 系统文件夹保护，操作可撤销
4. **可选功能** - 桌面自动化作为开关功能
5. **条件编译** - 使用 Cargo features 控制平台可用性

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Echo Desktop (Tauri)                      │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React)                                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ File List   │ │ Category    │ │ Automation  │            │
│  │ View        │ │ Config      │ │ Panel       │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
├─────────────────────────────────────────────────────────────┤
│  Tauri Commands (IPC Bridge)                                 │
│  janitor_analyze | janitor_commit | janitor_undo | ...      │
├─────────────────────────────────────────────────────────────┤
│  Janitor Core (Rust)                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ FileScanner │ │ Classifier  │ │ FileMover   │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ UndoLogger  │ │ ConfigMgr   │ │ PathGuard   │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│  ┌─────────────┐ ┌─────────────┐                            │
│  │ AIClient    │ │ LocalClassi │ (Optional)                 │
│  │ (Groq/Olla) │ │ fier        │ ┌─────────────┐            │
│  └─────────────┘ └─────────────┘ │ DesktopAuto │            │
│                                   │ (rdev)      │            │
│                                   └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. FileScanner

扫描目录，提取文件元数据。

```rust
pub struct FileScanner {
    supported_extensions: Vec<String>,
    max_file_size: u64,
}

pub struct FileInfo {
    pub path: PathBuf,
    pub name: String,
    pub extension: String,
    pub size: u64,
    pub created: DateTime<Utc>,
    pub modified: DateTime<Utc>,
    pub content_preview: Option<String>,  // 前 1000 字符
}

impl FileScanner {
    /// 扫描目录，返回支持的文件列表
    pub async fn scan(&self, path: &Path) -> Result<Vec<FileInfo>, JanitorError>;
    
    /// 提取单个文件的元数据
    pub fn extract_metadata(&self, path: &Path) -> Result<FileInfo, JanitorError>;
}
```

### 2. Classifier

文件分类器，支持 AI 和本地关键词两种模式。

```rust
pub struct Classifier {
    ai_client: Option<AIClient>,
    local_classifier: LocalClassifier,
    cache: FileCache,
    config: ClassifierConfig,
}

pub struct ClassificationResult {
    pub file_path: PathBuf,
    pub suggested_category: String,
    pub confidence: f32,
    pub reason: String,
    pub from_cache: bool,
}

impl Classifier {
    /// 分类单个文件
    pub async fn classify(&self, file: &FileInfo) -> Result<ClassificationResult, JanitorError>;
    
    /// 批量分类（优化 API 调用）
    pub async fn classify_batch(&self, files: &[FileInfo]) -> Result<Vec<ClassificationResult>, JanitorError>;
}
```

### 3. LocalClassifier

本地关键词分类器，作为 AI 的 fallback。

```rust
pub struct LocalClassifier {
    categories: HashMap<String, CategoryConfig>,
}

impl LocalClassifier {
    /// 基于文件名和扩展名的快速分类
    pub fn classify(&self, file: &FileInfo) -> Option<ClassificationResult>;
    
    /// 基于关键词匹配
    pub fn match_keywords(&self, text: &str) -> Vec<(String, f32)>;
}
```

### 4. AIClient

AI 服务客户端，支持 Groq 和 Ollama。

```rust
pub struct AIClient {
    provider: AIProvider,
    config: AIConfig,
    token_tracker: TokenTracker,
}

pub enum AIProvider {
    Groq { api_key: String, model: String },
    Ollama { host: String, model: String },
}

pub struct AIConfig {
    pub max_context_items: usize,  // 默认 3
    pub timeout_secs: u64,
    pub max_retries: u32,
}

impl AIClient {
    /// 分析文件内容并返回分类建议
    pub async fn analyze(&self, prompt: &str) -> Result<AIResponse, JanitorError>;
    
    /// 分析图片（使用 vision 模型）
    pub async fn analyze_image(&self, image_data: &[u8]) -> Result<AIResponse, JanitorError>;
    
    /// 获取 token 使用统计
    pub fn get_token_stats(&self) -> TokenStats;
}
```

### 5. FileMover

文件移动执行器。

```rust
pub struct FileMover {
    path_guard: PathGuard,
    undo_logger: UndoLogger,
}

pub struct MoveRequest {
    pub src_path: PathBuf,
    pub dst_path: PathBuf,
    pub category: String,
    pub confidence: f32,
    pub reason: String,
}

pub struct MoveResult {
    pub success: bool,
    pub src_path: PathBuf,
    pub dst_path: PathBuf,
    pub error: Option<String>,
}

impl FileMover {
    /// 执行文件移动
    pub async fn commit(&self, request: MoveRequest) -> Result<MoveResult, JanitorError>;
    
    /// 批量移动
    pub async fn commit_batch(&self, requests: Vec<MoveRequest>) -> Vec<MoveResult>;
}
```

### 6. UndoLogger

撤销日志管理器。

```rust
pub struct UndoLogger {
    log_path: PathBuf,
}

pub struct UndoRecord {
    pub timestamp: DateTime<Utc>,
    pub src_path: PathBuf,
    pub dst_path: PathBuf,
    pub original_name: String,
    pub category: String,
    pub confidence: f32,
    pub reason: String,
    pub status: MoveStatus,
}

impl UndoLogger {
    /// 记录移动操作
    pub fn log_move(&self, record: &UndoRecord) -> Result<(), JanitorError>;
    
    /// 获取历史记录
    pub fn get_history(&self, limit: usize) -> Result<Vec<UndoRecord>, JanitorError>;
    
    /// 撤销最近 N 条操作
    pub fn undo_last(&self, count: usize) -> Vec<UndoResult>;
    
    /// 撤销指定时间后的所有操作
    pub fn undo_since(&self, timestamp: DateTime<Utc>) -> Vec<UndoResult>;
}
```

### 7. PathGuard

系统路径保护器。

```rust
pub struct PathGuard {
    protected_paths: Vec<PathBuf>,
    custom_protected: Vec<PathBuf>,
}

impl PathGuard {
    /// 检查路径是否受保护
    pub fn is_protected(&self, path: &Path) -> bool;
    
    /// 验证操作是否安全
    pub fn validate_operation(&self, src: &Path, dst: &Path) -> Result<(), PathGuardError>;
    
    /// 添加自定义保护路径
    pub fn add_protected(&mut self, path: PathBuf);
    
    /// 检查目录文件数量
    pub fn check_file_count(&self, path: &Path) -> Result<usize, JanitorError>;
}

// 默认保护路径 (macOS)
const DEFAULT_PROTECTED_PATHS: &[&str] = &[
    "/System",
    "/Library",
    "/usr",
    "/bin",
    "/sbin",
    "/Applications",
    "~/Library",
];
```

### 8. ConfigManager

配置管理器。

```rust
pub struct ConfigManager {
    config_path: PathBuf,
    config: JanitorConfig,
}

pub struct JanitorConfig {
    pub groq: GroqConfig,
    pub ollama: OllamaConfig,
    pub inbox_dirs: Vec<PathBuf>,
    pub output_base: PathBuf,
    pub confidence_threshold: f32,
    pub categories: HashMap<String, CategoryConfig>,
    pub automation_enabled: bool,
    pub screen_capture_enabled: bool,
}

pub struct CategoryConfig {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub keywords: Vec<String>,
    pub color: String,
}

impl ConfigManager {
    /// 加载配置
    pub fn load(&mut self) -> Result<(), JanitorError>;
    
    /// 保存配置
    pub fn save(&self) -> Result<(), JanitorError>;
    
    /// 获取分类列表
    pub fn get_categories(&self) -> &HashMap<String, CategoryConfig>;
    
    /// 添加/更新/删除分类
    pub fn add_category(&mut self, category: CategoryConfig) -> Result<(), JanitorError>;
    pub fn update_category(&mut self, id: &str, updates: CategoryUpdate) -> Result<(), JanitorError>;
    pub fn delete_category(&mut self, id: &str) -> Result<(), JanitorError>;
}
```

### 9. DesktopAutomation (可选)

桌面自动化模块，使用 rdev 和 autopilot。

```rust
#[cfg(feature = "desktop-automation")]
pub struct DesktopAutomation {
    enabled: bool,
}

impl DesktopAutomation {
    /// 截取屏幕
    pub fn screenshot(&self) -> Result<Vec<u8>, JanitorError>;
    
    /// 移动鼠标
    pub fn move_mouse(&self, x: f64, y: f64) -> Result<(), JanitorError>;
    
    /// 点击
    pub fn click(&self, x: f64, y: f64) -> Result<(), JanitorError>;
    
    /// 拖拽
    pub fn drag(&self, from: (f64, f64), to: (f64, f64)) -> Result<(), JanitorError>;
    
    /// 输入文本
    pub fn type_text(&self, text: &str) -> Result<(), JanitorError>;
}
```

### 10. IntentParser

自然语言意图解析器。

```rust
pub struct IntentParser {
    patterns: Vec<IntentPattern>,
}

pub enum Intent {
    OrganizeFolder { path: PathBuf },
    MoveFiles { src: PathBuf, dst: PathBuf, filter: Option<String> },
    ArchiveOld { path: PathBuf, days: u32 },
    Search { query: String },
    Undo { count: usize },
    Unknown { text: String },
}

impl IntentParser {
    /// 本地解析意图（不调用 AI）
    pub fn parse_local(&self, text: &str) -> Option<Intent>;
    
    /// AI 辅助解析（当本地解析失败时）
    pub async fn parse_with_ai(&self, text: &str, ai: &AIClient) -> Result<Intent, JanitorError>;
}
```

## Data Models

### 配置文件格式 (YAML)

```yaml
# ~/.config/echo/janitor.yaml
groq:
  api_key: "gsk_xxx"
  model: "llama-3.1-70b-versatile"

ollama:
  host: "http://localhost:11434"
  model: "moondream"

inbox_dirs:
  - "~/Downloads"
  - "~/Desktop"

output_base: "~/Echo"

confidence_threshold: 0.6

automation_enabled: false
screen_capture_enabled: false

categories:
  01_Investment:
    name: "投资理财"
    path: "01_Investment"
    keywords: ["股票", "基金", "投资", "理财", "stock", "fund"]
    color: "#4CAF50"
  
  02_Work:
    name: "工作文档"
    path: "02_Work"
    keywords: ["工作", "项目", "报告", "会议", "work", "project"]
    color: "#2196F3"
  
  03_Personal:
    name: "个人文件"
    path: "03_Personal"
    keywords: ["个人", "照片", "家庭", "personal", "photo"]
    color: "#FF9800"
```

### 撤销日志格式 (CSV)

```csv
timestamp,src_path,dst_path,original_name,new_name,category,confidence,reason,status
2026-01-03T10:30:00Z,/Users/xxx/Downloads/report.pdf,/Users/xxx/Echo/02_Work/report.pdf,report.pdf,report.pdf,02_Work,0.85,Contains work-related keywords,success
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: File Scanner Returns Only Supported Types
*For any* directory containing mixed file types, scanning SHALL return only files with supported extensions (pdf, txt, png, jpg, jpeg).
**Validates: Requirements 1.1**

### Property 2: Metadata Extraction Completeness
*For any* valid file, extracted metadata SHALL contain path, name, extension, size, created, and modified fields.
**Validates: Requirements 1.2**

### Property 3: Classification Result Structure
*For any* classified file, the result SHALL contain file_path, suggested_category, confidence (0-1), and reason.
**Validates: Requirements 1.5**

### Property 4: Category Configuration Round-Trip
*For any* valid category configuration, saving then loading SHALL produce an equivalent configuration.
**Validates: Requirements 2.1, 2.4**

### Property 5: Category CRUD Consistency
*For any* category, adding then getting SHALL return the same category; deleting then getting SHALL return None.
**Validates: Requirements 2.4, 2.6**

### Property 6: File Move Round-Trip (Undo)
*For any* successful file move, undoing SHALL restore the file to its original location with original name.
**Validates: Requirements 3.1, 3.3, 4.1**

### Property 7: Move Creates Destination Directory
*For any* move to a non-existent directory, the operation SHALL create the directory and succeed.
**Validates: Requirements 3.2**

### Property 8: No Overwrite on Conflict
*For any* move where destination file exists, the operation SHALL fail without modifying the existing file.
**Validates: Requirements 3.4**

### Property 9: Undo History Persistence
*For any* sequence of moves, history SHALL persist across restarts and contain all operations.
**Validates: Requirements 4.6**

### Property 10: Protected Path Enforcement
*For any* operation targeting a protected system path (as source or destination), the operation SHALL be rejected.
**Validates: Requirements 9.1, 9.2, 9.3**

### Property 11: Large Folder Warning
*For any* folder containing more than 1000 files, operations SHALL trigger a warning before proceeding.
**Validates: Requirements 9.5**

### Property 12: AI Context Window Limit
*For any* AI interaction, the context SHALL contain at most 3 previous interactions.
**Validates: Requirements 6.1.8**

### Property 13: File Summary Caching
*For any* unchanged file, the second analysis SHALL use cached summary (from_cache = true).
**Validates: Requirements 6.1.3**

### Property 14: Local Classifier Fallback
*For any* file with matching keywords, local classifier SHALL return a result without AI call.
**Validates: Requirements 6.1.7**

### Property 15: Intent Parsing for Known Patterns
*For any* instruction matching known patterns (e.g., "整理下载文件夹"), local parsing SHALL extract correct intent.
**Validates: Requirements 8.2, 6.1.6**

### Property 16: Automation Toggle Enforcement
*For any* automation request when automation_enabled is false, the request SHALL be rejected.
**Validates: Requirements 8.1**

## Error Handling

### Error Types

```rust
#[derive(Debug, thiserror::Error)]
pub enum JanitorError {
    #[error("File not found: {0}")]
    FileNotFound(PathBuf),
    
    #[error("Permission denied: {0}")]
    PermissionDenied(PathBuf),
    
    #[error("Protected path: {0}")]
    ProtectedPath(PathBuf),
    
    #[error("File already exists: {0}")]
    FileExists(PathBuf),
    
    #[error("AI service error: {0}")]
    AIError(String),
    
    #[error("Configuration error: {0}")]
    ConfigError(String),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Undo failed: {0}")]
    UndoError(String),
    
    #[error("Large folder warning: {0} files in {1}")]
    LargeFolderWarning(usize, PathBuf),
}
```

### Error Response Format (Tauri)

```rust
#[derive(Serialize)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}
```

## Testing Strategy

### Unit Tests
- FileScanner: 测试各种文件类型的扫描
- LocalClassifier: 测试关键词匹配
- PathGuard: 测试保护路径检测
- IntentParser: 测试意图解析

### Property-Based Tests (使用 proptest)
- 配置文件 round-trip
- 文件移动 + 撤销 round-trip
- 保护路径验证
- 缓存一致性

### Integration Tests
- AI 服务调用（mock）
- Tauri 命令调用
- 完整工作流测试

### 测试配置
- 属性测试至少 100 次迭代
- 使用 `proptest` crate
- 注释格式: `**Validates: Requirements X.Y**`


## Platform Availability

### 条件编译配置

```toml
# Cargo.toml
[features]
default = []
janitor = ["dep:rdev", "dep:autopilot", "dep:reqwest"]
desktop-automation = ["janitor"]

[target.'cfg(any(target_os = "macos", target_os = "windows"))'.dependencies]
rdev = { version = "0.5", optional = true }
autopilot = { version = "0.4", optional = true }
```

### 平台检测

```rust
/// 检查 Janitor 功能是否可用
pub fn is_janitor_available() -> bool {
    #[cfg(all(feature = "janitor", any(target_os = "macos", target_os = "windows")))]
    {
        true
    }
    #[cfg(not(all(feature = "janitor", any(target_os = "macos", target_os = "windows"))))]
    {
        false
    }
}

/// Tauri 命令：检查功能可用性
#[tauri::command]
pub fn janitor_check_availability() -> JanitorAvailability {
    JanitorAvailability {
        available: is_janitor_available(),
        platform: std::env::consts::OS.to_string(),
        message: if is_janitor_available() {
            None
        } else {
            Some("此功能仅在电脑客户端（macOS/Windows）可用".to_string())
        },
    }
}

#[derive(Serialize)]
pub struct JanitorAvailability {
    pub available: bool,
    pub platform: String,
    pub message: Option<String>,
}
```

### 前端处理

```typescript
// 前端检查功能可用性
async function checkJanitorAvailability() {
  const result = await invoke('janitor_check_availability');
  if (!result.available) {
    // 显示提示：此功能仅在电脑客户端可用
    showUnavailableMessage(result.message);
    return false;
  }
  return true;
}
```

### 构建配置

```bash
# macOS/Windows 构建（包含 Janitor）
cargo tauri build --features janitor

# iOS/其他平台构建（不包含 Janitor）
cargo tauri build
```
