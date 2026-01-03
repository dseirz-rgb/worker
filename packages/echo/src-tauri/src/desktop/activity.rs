/**
 * 活动监控模块 - Echo on Blinko 扩展
 * 
 * 实现跨平台窗口活动监控，参考 ActivityWatch aw-watcher-window
 * - macOS: 使用 NSWorkspace API
 * - Windows: 使用 Win32 API
 */

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

/// 活动信息结构体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityInfo {
    /// 应用名称
    pub app_name: String,
    /// 窗口标题
    pub window_title: String,
    /// macOS bundle ID 或 Windows exe 路径
    pub bundle_id: Option<String>,
    /// 浏览器 URL (如果是浏览器)
    pub url: Option<String>,
    /// 时间戳 (毫秒)
    pub timestamp: u64,
}

impl Default for ActivityInfo {
    fn default() -> Self {
        Self {
            app_name: String::new(),
            window_title: String::new(),
            bundle_id: None,
            url: None,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        }
    }
}

/// 活动监控器状态
static MONITORING_ACTIVE: AtomicBool = AtomicBool::new(false);

/// 获取当前活动窗口信息
#[cfg(target_os = "macos")]
pub fn get_current_activity() -> Result<ActivityInfo, String> {
    use std::process::Command;
    
    // 使用 AppleScript 获取当前活动应用信息
    let script = r#"
        tell application "System Events"
            set frontApp to first application process whose frontmost is true
            set appName to name of frontApp
            set bundleId to bundle identifier of frontApp
            set windowTitle to ""
            try
                set windowTitle to name of front window of frontApp
            end try
            return appName & "|||" & bundleId & "|||" & windowTitle
        end tell
    "#;
    
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("执行 AppleScript 失败: {}", e))?;
    
    if !output.status.success() {
        return Err(format!(
            "AppleScript 执行错误: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    
    let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let parts: Vec<&str> = result.split("|||").collect();
    
    let app_name = parts.get(0).unwrap_or(&"").to_string();
    let bundle_id = parts.get(1).map(|s| s.to_string()).filter(|s| !s.is_empty());
    let window_title = parts.get(2).unwrap_or(&"").to_string();
    
    // 检测是否是浏览器，尝试获取 URL
    let url = get_browser_url(&app_name, bundle_id.as_deref());
    
    Ok(ActivityInfo {
        app_name,
        window_title,
        bundle_id,
        url,
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
    })
}

/// 获取浏览器 URL (macOS)
#[cfg(target_os = "macos")]
fn get_browser_url(app_name: &str, bundle_id: Option<&str>) -> Option<String> {
    let browser_bundles = [
        "com.google.Chrome",
        "com.apple.Safari",
        "org.mozilla.firefox",
        "com.microsoft.edgemac",
        "com.brave.Browser",
        "com.operasoftware.Opera",
    ];
    
    let is_browser = bundle_id
        .map(|id| browser_bundles.iter().any(|b| id.contains(b)))
        .unwrap_or(false)
        || ["Chrome", "Safari", "Firefox", "Edge", "Brave", "Opera"]
            .iter()
            .any(|b| app_name.contains(b));
    
    if !is_browser {
        return None;
    }
    
    // 根据浏览器类型获取 URL
    let script = match bundle_id {
        Some(id) if id.contains("Chrome") || id.contains("Brave") || id.contains("Edge") => {
            format!(
                r#"tell application "{}" to get URL of active tab of front window"#,
                app_name
            )
        }
        Some(id) if id.contains("Safari") => {
            r#"tell application "Safari" to get URL of front document"#.to_string()
        }
        Some(id) if id.contains("firefox") => {
            // Firefox 不支持 AppleScript 获取 URL
            return None;
        }
        _ => return None,
    };
    
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .ok()?;
    
    if output.status.success() {
        let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !url.is_empty() && url != "missing value" {
            return Some(url);
        }
    }
    
    None
}


/// 获取当前活动窗口信息 (Windows)
#[cfg(target_os = "windows")]
pub fn get_current_activity() -> Result<ActivityInfo, String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use std::ptr;
    
    // Windows API 类型定义
    #[link(name = "user32")]
    extern "system" {
        fn GetForegroundWindow() -> *mut std::ffi::c_void;
        fn GetWindowTextW(hwnd: *mut std::ffi::c_void, lpString: *mut u16, nMaxCount: i32) -> i32;
        fn GetWindowThreadProcessId(hwnd: *mut std::ffi::c_void, lpdwProcessId: *mut u32) -> u32;
    }
    
    #[link(name = "kernel32")]
    extern "system" {
        fn OpenProcess(dwDesiredAccess: u32, bInheritHandle: i32, dwProcessId: u32) -> *mut std::ffi::c_void;
        fn CloseHandle(hObject: *mut std::ffi::c_void) -> i32;
        fn QueryFullProcessImageNameW(
            hProcess: *mut std::ffi::c_void,
            dwFlags: u32,
            lpExeName: *mut u16,
            lpdwSize: *mut u32,
        ) -> i32;
    }
    
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return Err("无法获取前台窗口".to_string());
        }
        
        // 获取窗口标题
        let mut title_buf: [u16; 512] = [0; 512];
        let title_len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), 512);
        let window_title = if title_len > 0 {
            OsString::from_wide(&title_buf[..title_len as usize])
                .to_string_lossy()
                .to_string()
        } else {
            String::new()
        };
        
        // 获取进程 ID
        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);
        
        // 获取进程路径
        let mut app_name = String::new();
        let mut bundle_id = None;
        
        if process_id != 0 {
            let process_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id);
            if !process_handle.is_null() {
                let mut path_buf: [u16; 1024] = [0; 1024];
                let mut path_len: u32 = 1024;
                
                if QueryFullProcessImageNameW(process_handle, 0, path_buf.as_mut_ptr(), &mut path_len) != 0 {
                    let path = OsString::from_wide(&path_buf[..path_len as usize])
                        .to_string_lossy()
                        .to_string();
                    
                    bundle_id = Some(path.clone());
                    
                    // 从路径提取应用名称
                    app_name = std::path::Path::new(&path)
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default();
                }
                
                CloseHandle(process_handle);
            }
        }
        
        // 检测浏览器 URL
        let url = get_browser_url_windows(&app_name, &window_title);
        
        Ok(ActivityInfo {
            app_name,
            window_title,
            bundle_id,
            url,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        })
    }
}

/// 获取浏览器 URL (Windows) - 从窗口标题解析
#[cfg(target_os = "windows")]
fn get_browser_url_windows(app_name: &str, window_title: &str) -> Option<String> {
    let browsers = ["chrome", "firefox", "msedge", "brave", "opera"];
    let is_browser = browsers.iter().any(|b| app_name.to_lowercase().contains(b));
    
    if !is_browser {
        return None;
    }
    
    // 尝试从窗口标题解析 URL (某些浏览器会在标题中显示)
    // 这是一个简化实现，完整实现需要使用 UI Automation API
    None
}

/// 获取当前活动窗口信息 (Linux - 占位实现)
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn get_current_activity() -> Result<ActivityInfo, String> {
    Err("Linux 平台暂不支持活动监控".to_string())
}

/// 检查监控是否正在运行
pub fn is_monitoring() -> bool {
    MONITORING_ACTIVE.load(Ordering::SeqCst)
}

/// 启动活动监控
pub fn start_monitoring() -> Result<(), String> {
    if MONITORING_ACTIVE.load(Ordering::SeqCst) {
        return Err("监控已在运行".to_string());
    }
    
    MONITORING_ACTIVE.store(true, Ordering::SeqCst);
    Ok(())
}

/// 停止活动监控
pub fn stop_monitoring() -> Result<(), String> {
    if !MONITORING_ACTIVE.load(Ordering::SeqCst) {
        return Err("监控未在运行".to_string());
    }
    
    MONITORING_ACTIVE.store(false, Ordering::SeqCst);
    Ok(())
}

// ============ Tauri 命令 ============

/// Tauri 命令: 获取当前活动
#[tauri::command]
pub fn get_current_activity_cmd() -> Result<ActivityInfo, String> {
    get_current_activity()
}

/// Tauri 命令: 启动活动监控
#[tauri::command]
pub fn start_activity_monitoring() -> Result<(), String> {
    start_monitoring()
}

/// Tauri 命令: 停止活动监控
#[tauri::command]
pub fn stop_activity_monitoring() -> Result<(), String> {
    stop_monitoring()
}

/// Tauri 命令: 检查监控状态
#[tauri::command]
pub fn is_activity_monitoring() -> bool {
    is_monitoring()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_activity_info_default() {
        let info = ActivityInfo::default();
        assert!(info.app_name.is_empty());
        assert!(info.window_title.is_empty());
        assert!(info.bundle_id.is_none());
        assert!(info.url.is_none());
        assert!(info.timestamp > 0);
    }
    
    #[test]
    fn test_monitoring_state() {
        // 确保初始状态为未监控
        MONITORING_ACTIVE.store(false, Ordering::SeqCst);
        
        assert!(!is_monitoring());
        
        // 启动监控
        assert!(start_monitoring().is_ok());
        assert!(is_monitoring());
        
        // 重复启动应该失败
        assert!(start_monitoring().is_err());
        
        // 停止监控
        assert!(stop_monitoring().is_ok());
        assert!(!is_monitoring());
        
        // 重复停止应该失败
        assert!(stop_monitoring().is_err());
    }
}
