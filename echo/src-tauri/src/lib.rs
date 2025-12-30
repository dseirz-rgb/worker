//! Echo - AI 个人助手
//! 
//! Tauri 后端核心模块，提供系统级功能和 AI 服务桥接
//! 
//! 参考项目：
//! - Pot (pot-app/pot-desktop) - 截图翻译实现
//! - Blinko (blinkospace/blinko) - 笔记 UI 设计
//! - Paperless-ngx - 文件管理和 OCR
//! - fastembed-rs - 本地向量嵌入

use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};
use std::sync::Mutex;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

// 嵌入服务模块
pub mod embedding;
use embedding::{EmbeddingState, embed_text, embed_batch, init_embedding_service, get_embedding_status, get_embedding_dimension};

// ============================================================================
// 全局状态管理
// ============================================================================

/// 活动监控状态
pub struct ActivityMonitorState {
    pub is_monitoring: bool,
    pub current_app: Option<String>,
    pub current_window: Option<String>,
    pub session_start: Option<u64>,
    pub clipboard_history: Vec<ClipboardEntry>,
}

impl Default for ActivityMonitorState {
    fn default() -> Self {
        Self {
            is_monitoring: false,
            current_app: None,
            current_window: None,
            session_start: None,
            clipboard_history: Vec::new(),
        }
    }
}

/// 剪贴板条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardEntry {
    pub content: String,
    pub timestamp: u64,
    pub app_context: Option<String>,
}

/// 翻译历史状态
pub struct TranslationState {
    pub history: Vec<TranslationRecord>,
    pub last_ocr_result: Option<String>,
}

impl Default for TranslationState {
    fn default() -> Self {
        Self {
            history: Vec::new(),
            last_ocr_result: None,
        }
    }
}

/// 翻译记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationRecord {
    pub id: String,
    pub original_text: String,
    pub translated_text: String,
    pub source_lang: String,
    pub target_lang: String,
    pub timestamp: u64,
    pub source_type: String, // "screenshot", "selection", "input"
}

/// 文件索引状态
pub struct FileIndexState {
    pub watched_folders: Vec<String>,
    pub indexed_files: HashMap<String, FileIndexEntry>,
    pub is_indexing: bool,
}

impl Default for FileIndexState {
    fn default() -> Self {
        Self {
            watched_folders: Vec::new(),
            indexed_files: HashMap::new(),
            is_indexing: false,
        }
    }
}

/// 文件索引条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileIndexEntry {
    pub id: String,
    pub path: String,
    pub name: String,
    pub extension: String,
    pub size: u64,
    pub content_hash: String,
    pub ocr_text: Option<String>,
    pub summary: Option<String>,
    pub tags: Vec<String>,
    pub domain: Option<String>,
    pub indexed_at: u64,
    pub modified_at: u64,
}

/// 操作结果类型
#[derive(Debug, Serialize, Deserialize)]
pub struct OperationResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> OperationResult<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(error: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error.into()),
        }
    }
}

/// 应用信息
#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub platform: String,
}

// ============================================================================
// 截图翻译功能 (参考 Pot)
// ============================================================================

/// 截图区域
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotRegion {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// 截图结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotResult {
    pub image_base64: String,
    pub region: ScreenshotRegion,
    pub timestamp: u64,
}

/// OCR 结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrResult {
    pub text: String,
    pub confidence: f32,
    pub language: Option<String>,
    pub blocks: Vec<TextBlock>,
}

/// 文本块
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextBlock {
    pub text: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub confidence: f32,
}

/// 截取屏幕区域 (参考 Pot 的实现)
#[tauri::command]
async fn capture_screen_region() -> Result<ScreenshotResult, String> {
    // TODO: 实现跨平台截图
    // macOS: 使用 screencapturekit 或 CGWindowListCreateImage
    // Windows: 使用 windows-rs 的 BitBlt
    // Linux: 使用 x11 或 wayland 协议
    
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    
    // 临时返回空结果，实际实现需要调用系统 API
    Err("截图功能需要系统权限，请在系统设置中授权".to_string())
}

/// 执行 OCR 识别
#[tauri::command]
async fn perform_ocr(image_base64: String) -> Result<OcrResult, String> {
    // TODO: 集成 OCR 引擎
    // 选项 1: 调用 Gemini Vision API
    // 选项 2: 使用本地 Tesseract
    // 选项 3: 使用 macOS Vision Framework
    
    log::info!("执行 OCR 识别，图片大小: {} bytes", image_base64.len());
    
    // 临时返回空结果
    Ok(OcrResult {
        text: String::new(),
        confidence: 0.0,
        language: None,
        blocks: Vec::new(),
    })
}

/// 获取选中的文本 (划词翻译)
#[tauri::command]
async fn get_selected_text() -> Result<String, String> {
    // TODO: 实现跨平台获取选中文本
    // macOS: 使用 Accessibility API
    // Windows: 使用 UI Automation
    // Linux: 使用 X11 selection
    
    Err("获取选中文本功能开发中".to_string())
}

/// 添加翻译记录
#[tauri::command]
async fn add_translation_record(
    state: tauri::State<'_, Mutex<TranslationState>>,
    record: TranslationRecord,
) -> Result<(), String> {
    let mut state = state.lock().map_err(|e| e.to_string())?;
    state.history.push(record);
    
    // 保持历史记录在合理范围内
    if state.history.len() > 1000 {
        state.history.remove(0);
    }
    
    Ok(())
}

/// 获取翻译历史
#[tauri::command]
async fn get_translation_history(
    state: tauri::State<'_, Mutex<TranslationState>>,
    limit: Option<usize>,
) -> Result<Vec<TranslationRecord>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);
    
    let history: Vec<_> = state.history
        .iter()
        .rev()
        .take(limit)
        .cloned()
        .collect();
    
    Ok(history)
}

// ============================================================================
// 活动监控功能 (全面感知用户电脑活动)
// ============================================================================

/// 活动记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityRecord {
    pub id: String,
    pub app_name: String,
    pub window_title: Option<String>,
    pub domain: Option<String>,
    pub project: Option<String>,
    pub duration_seconds: u64,
    pub started_at: u64,
    pub ended_at: u64,
    pub keyboard_events: u32,
    pub mouse_events: u32,
}

/// 启动活动监控
#[tauri::command]
async fn start_activity_monitoring(
    state: tauri::State<'_, Mutex<ActivityMonitorState>>,
) -> Result<(), String> {
    let mut state = state.lock().map_err(|e| e.to_string())?;
    
    if state.is_monitoring {
        return Ok(());
    }
    
    state.is_monitoring = true;
    state.session_start = Some(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    );
    
    log::info!("活动监控已启动");
    Ok(())
}

/// 停止活动监控
#[tauri::command]
async fn stop_activity_monitoring(
    state: tauri::State<'_, Mutex<ActivityMonitorState>>,
) -> Result<(), String> {
    let mut state = state.lock().map_err(|e| e.to_string())?;
    state.is_monitoring = false;
    state.session_start = None;
    
    log::info!("活动监控已停止");
    Ok(())
}

/// 获取当前活动应用
#[tauri::command]
async fn get_current_activity() -> Result<ActivityRecord, String> {
    // TODO: 实现跨平台获取当前活动应用
    // macOS: 使用 NSWorkspace
    // Windows: 使用 GetForegroundWindow
    // Linux: 使用 X11/Wayland
    
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    
    Ok(ActivityRecord {
        id: uuid::Uuid::new_v4().to_string(),
        app_name: "Unknown".to_string(),
        window_title: None,
        domain: None,
        project: None,
        duration_seconds: 0,
        started_at: now,
        ended_at: now,
        keyboard_events: 0,
        mouse_events: 0,
    })
}

/// 记录剪贴板内容
#[tauri::command]
async fn capture_clipboard(
    state: tauri::State<'_, Mutex<ActivityMonitorState>>,
) -> Result<Option<ClipboardEntry>, String> {
    // TODO: 实现跨平台剪贴板监控
    // 使用 arboard 或 clipboard-rs crate
    
    let mut state = state.lock().map_err(|e| e.to_string())?;
    
    // 临时实现
    let entry = ClipboardEntry {
        content: String::new(),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
        app_context: state.current_app.clone(),
    };
    
    state.clipboard_history.push(entry.clone());
    
    // 保持历史记录在合理范围内
    if state.clipboard_history.len() > 500 {
        state.clipboard_history.remove(0);
    }
    
    Ok(Some(entry))
}

/// 获取剪贴板历史
#[tauri::command]
async fn get_clipboard_history(
    state: tauri::State<'_, Mutex<ActivityMonitorState>>,
    limit: Option<usize>,
) -> Result<Vec<ClipboardEntry>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);
    
    let history: Vec<_> = state.clipboard_history
        .iter()
        .rev()
        .take(limit)
        .cloned()
        .collect();
    
    Ok(history)
}

// ============================================================================
// 文件管理功能 (参考 Paperless-ngx)
// ============================================================================

/// 添加监控文件夹
#[tauri::command]
async fn add_watch_folder(
    state: tauri::State<'_, Mutex<FileIndexState>>,
    path: String,
) -> Result<(), String> {
    let mut state = state.lock().map_err(|e| e.to_string())?;
    
    // 检查路径是否存在
    if !std::path::Path::new(&path).exists() {
        return Err(format!("路径不存在: {}", path));
    }
    
    // 检查是否已添加
    if state.watched_folders.contains(&path) {
        return Ok(());
    }
    
    state.watched_folders.push(path.clone());
    log::info!("添加监控文件夹: {}", path);
    
    Ok(())
}

/// 移除监控文件夹
#[tauri::command]
async fn remove_watch_folder(
    state: tauri::State<'_, Mutex<FileIndexState>>,
    path: String,
) -> Result<(), String> {
    let mut state = state.lock().map_err(|e| e.to_string())?;
    state.watched_folders.retain(|p| p != &path);
    
    log::info!("移除监控文件夹: {}", path);
    Ok(())
}

/// 获取监控文件夹列表
#[tauri::command]
async fn get_watched_folders(
    state: tauri::State<'_, Mutex<FileIndexState>>,
) -> Result<Vec<String>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    Ok(state.watched_folders.clone())
}

/// 索引单个文件
#[tauri::command]
async fn index_file(
    state: tauri::State<'_, Mutex<FileIndexState>>,
    path: String,
) -> Result<FileIndexEntry, String> {
    let file_path = std::path::Path::new(&path);
    
    if !file_path.exists() {
        return Err(format!("文件不存在: {}", path));
    }
    
    let metadata = std::fs::metadata(&path)
        .map_err(|e| format!("读取文件元数据失败: {}", e))?;
    
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    
    let modified = metadata.modified()
        .map(|t| t.duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0))
        .unwrap_or(now);
    
    let entry = FileIndexEntry {
        id: uuid::Uuid::new_v4().to_string(),
        path: path.clone(),
        name: file_path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default(),
        extension: file_path.extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default(),
        size: metadata.len(),
        content_hash: String::new(), // TODO: 计算文件哈希
        ocr_text: None,
        summary: None,
        tags: Vec::new(),
        domain: None,
        indexed_at: now,
        modified_at: modified,
    };
    
    // 保存到状态
    let mut state = state.lock().map_err(|e| e.to_string())?;
    state.indexed_files.insert(path, entry.clone());
    
    Ok(entry)
}

/// 搜索文件
#[tauri::command]
async fn search_files(
    state: tauri::State<'_, Mutex<FileIndexState>>,
    query: String,
    options: Option<SearchOptions>,
) -> Result<Vec<FileSearchResult>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    let options = options.unwrap_or_default();
    
    let query_lower = query.to_lowercase();
    let mut results: Vec<FileSearchResult> = state.indexed_files
        .values()
        .filter(|entry| {
            // 文件名匹配
            let name_match = entry.name.to_lowercase().contains(&query_lower);
            
            // OCR 文本匹配
            let ocr_match = entry.ocr_text
                .as_ref()
                .map(|t| t.to_lowercase().contains(&query_lower))
                .unwrap_or(false);
            
            // 标签匹配
            let tag_match = entry.tags
                .iter()
                .any(|t| t.to_lowercase().contains(&query_lower));
            
            // 领域过滤
            let domain_match = options.domain
                .as_ref()
                .map(|d| entry.domain.as_ref() == Some(d))
                .unwrap_or(true);
            
            // 扩展名过滤
            let ext_match = options.extensions
                .as_ref()
                .map(|exts| exts.contains(&entry.extension))
                .unwrap_or(true);
            
            (name_match || ocr_match || tag_match) && domain_match && ext_match
        })
        .map(|entry| {
            let mut highlights = Vec::new();
            
            if entry.name.to_lowercase().contains(&query_lower) {
                highlights.push(format!("文件名: {}", entry.name));
            }
            
            if let Some(ref ocr_text) = entry.ocr_text {
                if ocr_text.to_lowercase().contains(&query_lower) {
                    // 提取匹配上下文
                    if let Some(pos) = ocr_text.to_lowercase().find(&query_lower) {
                        let start = pos.saturating_sub(30);
                        let end = (pos + query.len() + 30).min(ocr_text.len());
                        highlights.push(format!("...{}...", &ocr_text[start..end]));
                    }
                }
            }
            
            FileSearchResult {
                file: entry.clone(),
                score: 1.0, // TODO: 实现相关性评分
                highlights,
            }
        })
        .collect();
    
    // 按相关性排序
    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    
    // 限制结果数量
    let limit = options.limit.unwrap_or(20);
    results.truncate(limit);
    
    Ok(results)
}

/// 搜索选项
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SearchOptions {
    pub domain: Option<String>,
    pub extensions: Option<Vec<String>>,
    pub limit: Option<usize>,
}

/// 文件搜索结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSearchResult {
    pub file: FileIndexEntry,
    pub score: f32,
    pub highlights: Vec<String>,
}

/// 读取文件内容
#[tauri::command]
async fn read_file_content(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path)
        .map_err(|e| format!("读取文件失败: {}", e))
}

/// 选择文件夹对话框
#[tauri::command]
async fn select_folder() -> Result<Option<String>, String> {
    // 使用 rfd (Rusty File Dialogs) 或 native-dialog
    // 临时返回 None，实际需要调用系统对话框
    Ok(None)
}

// ============================================================================
// 快捷键管理 (参考 Pot 的全局快捷键)
// ============================================================================

/// 快捷键配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotkeyConfig {
    pub screenshot_translate: String,
    pub selection_translate: String,
    pub input_translate: String,
    pub ocr_recognize: String,
    pub quick_note: String,
}

impl Default for HotkeyConfig {
    fn default() -> Self {
        Self {
            screenshot_translate: "CommandOrControl+Shift+S".to_string(),
            selection_translate: "CommandOrControl+Shift+T".to_string(),
            input_translate: "CommandOrControl+Shift+I".to_string(),
            ocr_recognize: "CommandOrControl+Shift+O".to_string(),
            quick_note: "CommandOrControl+Shift+N".to_string(),
        }
    }
}

/// 获取快捷键配置
#[tauri::command]
async fn get_hotkey_config() -> Result<HotkeyConfig, String> {
    // TODO: 从配置文件读取
    Ok(HotkeyConfig::default())
}

/// 设置快捷键配置
#[tauri::command]
async fn set_hotkey_config(config: HotkeyConfig) -> Result<(), String> {
    // TODO: 保存到配置文件并重新注册快捷键
    log::info!("更新快捷键配置: {:?}", config);
    Ok(())
}

// ============================================================================
// 基础命令
// ============================================================================

/// 问候命令 - 用于测试 Tauri IPC
#[tauri::command]
fn greet(name: &str) -> String {
    log::debug!("收到问候请求: {}", name);
    format!("你好, {}! 欢迎使用 Echo!", name)
}

/// 获取应用版本
#[tauri::command]
fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// 获取应用信息
#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: "Echo".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
    }
}

/// 获取数据目录路径
#[tauri::command]
fn get_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("获取数据目录失败: {}", e))
}

/// 运行 Tauri 应用
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_millis()
        .init();
    
    log::info!("Echo v{} 启动中...", env!("CARGO_PKG_VERSION"));
    
    // 数据库迁移
    let migrations = vec![
        // 笔记表
        Migration {
            version: 1,
            description: "create_notes_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY NOT NULL,
                    content TEXT NOT NULL,
                    type TEXT NOT NULL DEFAULT 'text',
                    domain TEXT NOT NULL DEFAULT 'general',
                    tags TEXT DEFAULT '[]',
                    memory_id TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_notes_domain ON notes(domain);
                CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);
            "#,
            kind: MigrationKind::Up,
        },
        // 任务表
        Migration {
            version: 2,
            description: "create_tasks_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    priority TEXT NOT NULL DEFAULT 'medium',
                    status TEXT NOT NULL DEFAULT 'pending',
                    deadline TEXT,
                    domain TEXT NOT NULL DEFAULT 'general',
                    assignee_id TEXT,
                    parent_id TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    completed_at TEXT,
                    FOREIGN KEY (parent_id) REFERENCES tasks(id)
                );
                CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
                CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
                CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
            "#,
            kind: MigrationKind::Up,
        },
        // 提醒表
        Migration {
            version: 3,
            description: "create_reminders_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS reminders (
                    id TEXT PRIMARY KEY NOT NULL,
                    type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    priority TEXT NOT NULL DEFAULT 'medium',
                    scheduled_at TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    context TEXT DEFAULT '{}',
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
                CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_at ON reminders(scheduled_at);
            "#,
            kind: MigrationKind::Up,
        },
        // 同步状态表
        Migration {
            version: 4,
            description: "create_sync_status_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS sync_status (
                    id TEXT PRIMARY KEY NOT NULL,
                    table_name TEXT NOT NULL,
                    record_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    synced INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_sync_status_synced ON sync_status(synced);
            "#,
            kind: MigrationKind::Up,
        },
        // 情绪记录表
        Migration {
            version: 5,
            description: "create_emotional_states_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS emotional_states (
                    id TEXT PRIMARY KEY NOT NULL,
                    mood TEXT NOT NULL,
                    energy INTEGER NOT NULL,
                    stress INTEGER NOT NULL,
                    source TEXT,
                    notes TEXT,
                    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_emotional_states_recorded_at ON emotional_states(recorded_at);
            "#,
            kind: MigrationKind::Up,
        },
        // 团队成员表
        Migration {
            version: 6,
            description: "create_team_members_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS team_members (
                    id TEXT PRIMARY KEY NOT NULL,
                    name TEXT NOT NULL,
                    role TEXT,
                    preferences TEXT DEFAULT '{}',
                    last_one_on_one TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            "#,
            kind: MigrationKind::Up,
        },
        // 家庭成员表
        Migration {
            version: 7,
            description: "create_family_members_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS family_members (
                    id TEXT PRIMARY KEY NOT NULL,
                    name TEXT NOT NULL,
                    relationship TEXT NOT NULL,
                    birthdate TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            "#,
            kind: MigrationKind::Up,
        },
        // 里程碑表
        Migration {
            version: 8,
            description: "create_milestones_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS milestones (
                    id TEXT PRIMARY KEY NOT NULL,
                    family_member_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    milestone_date TEXT NOT NULL,
                    type TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    FOREIGN KEY (family_member_id) REFERENCES family_members(id)
                );
                CREATE INDEX IF NOT EXISTS idx_milestones_family_member ON milestones(family_member_id);
                CREATE INDEX IF NOT EXISTS idx_milestones_date ON milestones(milestone_date);
            "#,
            kind: MigrationKind::Up,
        },
        // 活动记录表
        Migration {
            version: 9,
            description: "create_activities_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS activities (
                    id TEXT PRIMARY KEY NOT NULL,
                    app_name TEXT NOT NULL,
                    window_title TEXT,
                    domain TEXT,
                    project TEXT,
                    duration_seconds INTEGER NOT NULL,
                    started_at TEXT NOT NULL,
                    ended_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_activities_started_at ON activities(started_at);
                CREATE INDEX IF NOT EXISTS idx_activities_domain ON activities(domain);
            "#,
            kind: MigrationKind::Up,
        },
        // 对话历史表
        Migration {
            version: 10,
            description: "create_conversations_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY NOT NULL,
                    title TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY NOT NULL,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
                );
                CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
            "#,
            kind: MigrationKind::Up,
        },
        // 翻译历史表 (新增)
        Migration {
            version: 11,
            description: "create_translation_history_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS translation_history (
                    id TEXT PRIMARY KEY NOT NULL,
                    original_text TEXT NOT NULL,
                    translated_text TEXT NOT NULL,
                    source_lang TEXT NOT NULL,
                    target_lang TEXT NOT NULL,
                    source_type TEXT NOT NULL DEFAULT 'input',
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_translation_history_created_at ON translation_history(created_at);
            "#,
            kind: MigrationKind::Up,
        },
        // 文件索引表 (新增)
        Migration {
            version: 12,
            description: "create_file_index_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS file_index (
                    id TEXT PRIMARY KEY NOT NULL,
                    path TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    extension TEXT,
                    size INTEGER NOT NULL,
                    content_hash TEXT,
                    ocr_text TEXT,
                    summary TEXT,
                    tags TEXT DEFAULT '[]',
                    domain TEXT,
                    indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
                    modified_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_file_index_path ON file_index(path);
                CREATE INDEX IF NOT EXISTS idx_file_index_domain ON file_index(domain);
                CREATE INDEX IF NOT EXISTS idx_file_index_extension ON file_index(extension);
            "#,
            kind: MigrationKind::Up,
        },
        // 剪贴板历史表 (新增)
        Migration {
            version: 13,
            description: "create_clipboard_history_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS clipboard_history (
                    id TEXT PRIMARY KEY NOT NULL,
                    content TEXT NOT NULL,
                    app_context TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_clipboard_history_created_at ON clipboard_history(created_at);
            "#,
            kind: MigrationKind::Up,
        },
        // 学习记录表 (新增)
        Migration {
            version: 14,
            description: "create_learning_records_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS learning_records (
                    id TEXT PRIMARY KEY NOT NULL,
                    type TEXT NOT NULL,
                    topic TEXT NOT NULL,
                    content TEXT,
                    source TEXT,
                    duration_minutes INTEGER,
                    domain TEXT NOT NULL DEFAULT 'learning',
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_learning_records_type ON learning_records(type);
                CREATE INDEX IF NOT EXISTS idx_learning_records_created_at ON learning_records(created_at);
            "#,
            kind: MigrationKind::Up,
        },
        // 词汇学习表 (英语学习)
        Migration {
            version: 15,
            description: "create_vocabulary_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS vocabulary (
                    id TEXT PRIMARY KEY NOT NULL,
                    word TEXT NOT NULL,
                    translation TEXT NOT NULL,
                    context TEXT,
                    source TEXT,
                    review_count INTEGER NOT NULL DEFAULT 0,
                    next_review TEXT,
                    mastery_level INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_vocabulary_word ON vocabulary(word);
                CREATE INDEX IF NOT EXISTS idx_vocabulary_next_review ON vocabulary(next_review);
            "#,
            kind: MigrationKind::Up,
        },
    ];
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:echo.db", migrations)
                .build()
        )
        // 注册全局状态
        .manage(Mutex::new(ActivityMonitorState::default()))
        .manage(Mutex::new(TranslationState::default()))
        .manage(Mutex::new(FileIndexState::default()))
        .manage(Mutex::new(EmbeddingState::default()))
        .invoke_handler(tauri::generate_handler![
            // 基础命令
            greet,
            get_version,
            get_app_info,
            get_data_dir,
            // 截图翻译命令 (参考 Pot)
            capture_screen_region,
            perform_ocr,
            get_selected_text,
            add_translation_record,
            get_translation_history,
            // 活动监控命令
            start_activity_monitoring,
            stop_activity_monitoring,
            get_current_activity,
            capture_clipboard,
            get_clipboard_history,
            // 文件管理命令 (参考 Paperless-ngx)
            add_watch_folder,
            remove_watch_folder,
            get_watched_folders,
            index_file,
            search_files,
            read_file_content,
            select_folder,
            // 快捷键命令
            get_hotkey_config,
            set_hotkey_config,
            // 嵌入服务命令 (fastembed-rs)
            init_embedding_service,
            embed_text,
            embed_batch,
            get_embedding_status,
            get_embedding_dimension,
        ])
        .setup(|app| {
            log::info!("应用初始化完成");
            
            // 获取主窗口
            if let Some(window) = app.get_webview_window("main") {
                log::info!("主窗口已创建");
                let _ = window.set_title("Echo - AI 个人助手");
                
                // 开发模式下打开 DevTools
                #[cfg(debug_assertions)]
                {
                    window.open_devtools();
                    log::debug!("开发者工具已打开");
                }
            }
            
            // 创建数据目录
            if let Ok(data_dir) = app.path().app_data_dir() {
                if !data_dir.exists() {
                    std::fs::create_dir_all(&data_dir).ok();
                    log::info!("数据目录已创建: {:?}", data_dir);
                }
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用时出错");
}
