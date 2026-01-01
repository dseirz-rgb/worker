// Echo Desktop App - Tauri 主入口
// 包含 Janitor Sidecar 管理

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, State};
use serde::{Deserialize, Serialize};

// Janitor 配置
const JANITOR_PORT: u16 = 8766;
const JANITOR_HOST: &str = "127.0.0.1";
const HEALTH_CHECK_TIMEOUT: Duration = Duration::from_secs(5);

// Janitor 进程状态
struct JanitorState {
    process: Mutex<Option<Child>>,
    port: Mutex<u16>,
}

// Janitor 状态响应
#[derive(Serialize, Deserialize)]
struct JanitorStatusResponse {
    running: bool,
    port: u16,
    healthy: bool,
    url: String,
}

// 获取 Sidecar 可执行文件名
fn get_sidecar_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "janitor-x86_64-pc-windows-msvc.exe"
    }
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        "janitor-aarch64-apple-darwin"
    }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        "janitor-x86_64-apple-darwin"
    }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        "janitor-x86_64-unknown-linux-gnu"
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        "janitor-aarch64-unknown-linux-gnu"
    }
}

// 检查 Janitor 健康状态
async fn check_janitor_health(port: u16) -> bool {
    let url = format!("http://{}:{}/health", JANITOR_HOST, port);
    
    match reqwest::Client::new()
        .get(&url)
        .timeout(HEALTH_CHECK_TIMEOUT)
        .send()
        .await
    {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    }
}

// 启动 Janitor Sidecar
#[tauri::command]
async fn start_janitor(state: State<'_, JanitorState>, app: tauri::AppHandle) -> Result<String, String> {
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;
    
    // 检查是否已在运行
    if let Some(ref mut child) = *process_guard {
        match child.try_wait() {
            Ok(Some(_)) => {
                // 进程已退出，清理状态
                *process_guard = None;
            }
            Ok(None) => {
                // 进程仍在运行
                return Ok("Janitor already running".to_string());
            }
            Err(_) => {
                *process_guard = None;
            }
        }
    }
    
    // 获取 sidecar 路径
    let sidecar_name = get_sidecar_name();
    let sidecar_path = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("binaries")
        .join(sidecar_name);
    
    if !sidecar_path.exists() {
        return Err(format!("Sidecar not found: {:?}", sidecar_path));
    }
    
    let port = *state.port.lock().map_err(|e| e.to_string())?;
    
    // 启动 Janitor
    let child = Command::new(&sidecar_path)
        .args(["--port", &port.to_string(), "--host", JANITOR_HOST])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start Janitor: {}", e))?;
    
    *process_guard = Some(child);
    
    // 等待服务启动
    drop(process_guard);
    tokio::time::sleep(Duration::from_secs(2)).await;
    
    // 验证健康状态
    if check_janitor_health(port).await {
        Ok(format!("Janitor started on port {}", port))
    } else {
        Ok(format!("Janitor started (health check pending) on port {}", port))
    }
}

// 停止 Janitor Sidecar
#[tauri::command]
fn stop_janitor(state: State<JanitorState>) -> Result<String, String> {
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;
    
    if let Some(mut child) = process_guard.take() {
        // 先尝试优雅关闭
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            unsafe {
                libc::kill(child.id() as i32, libc::SIGTERM);
            }
            std::thread::sleep(Duration::from_millis(500));
        }
        
        // 如果还在运行，强制终止
        match child.try_wait() {
            Ok(Some(_)) => {}
            _ => {
                let _ = child.kill();
            }
        }
        
        Ok("Janitor stopped".to_string())
    } else {
        Ok("Janitor not running".to_string())
    }
}

// 检查 Janitor 状态
#[tauri::command]
async fn janitor_status(state: State<'_, JanitorState>) -> Result<JanitorStatusResponse, String> {
    let process_guard = state.process.lock().map_err(|e| e.to_string())?;
    let port = *state.port.lock().map_err(|e| e.to_string())?;
    
    let running = if let Some(ref child) = *process_guard {
        // 检查进程是否还在运行
        match std::process::Command::new("kill")
            .args(["-0", &child.id().to_string()])
            .status()
        {
            Ok(status) => status.success(),
            Err(_) => false,
        }
    } else {
        false
    };
    
    drop(process_guard);
    
    let healthy = if running {
        check_janitor_health(port).await
    } else {
        false
    };
    
    Ok(JanitorStatusResponse {
        running,
        port,
        healthy,
        url: format!("http://{}:{}", JANITOR_HOST, port),
    })
}

// 获取 Janitor API URL
#[tauri::command]
fn get_janitor_url(state: State<JanitorState>) -> Result<String, String> {
    let port = *state.port.lock().map_err(|e| e.to_string())?;
    Ok(format!("http://{}:{}", JANITOR_HOST, port))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(JanitorState {
            process: Mutex::new(None),
            port: Mutex::new(JANITOR_PORT),
        })
        .invoke_handler(tauri::generate_handler![
            start_janitor,
            stop_janitor,
            janitor_status,
            get_janitor_url
        ])
        .setup(|app| {
            // 应用启动时自动启动 Janitor (仅桌面端，非 iOS)
            #[cfg(not(target_os = "ios"))]
            {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    // 等待应用初始化
                    tokio::time::sleep(Duration::from_secs(3)).await;
                    
                    // 发送启动事件
                    if let Err(e) = handle.emit("janitor-starting", ()) {
                        eprintln!("Failed to emit janitor-starting event: {}", e);
                    }
                    
                    // 自动启动 Janitor
                    let state: State<JanitorState> = handle.state();
                    match start_janitor(state, handle.clone()).await {
                        Ok(msg) => {
                            println!("Janitor: {}", msg);
                            let _ = handle.emit("janitor-started", msg);
                        }
                        Err(e) => {
                            eprintln!("Failed to start Janitor: {}", e);
                            let _ = handle.emit("janitor-error", e);
                        }
                    }
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // 窗口关闭时停止 Janitor
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state: State<JanitorState> = window.state();
                match stop_janitor(state) {
                    Ok(msg) => println!("Janitor shutdown: {}", msg),
                    Err(e) => eprintln!("Janitor shutdown error: {}", e),
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
