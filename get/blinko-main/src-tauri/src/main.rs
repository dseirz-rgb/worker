// Echo Desktop App - Tauri 主入口
// 包含 Janitor Sidecar 管理

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{Manager, State};

// Janitor 进程状态
struct JanitorState {
    process: Mutex<Option<Child>>,
}

// 启动 Janitor Sidecar
#[tauri::command]
fn start_janitor(state: State<JanitorState>, app: tauri::AppHandle) -> Result<String, String> {
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;
    
    if process_guard.is_some() {
        return Ok("Janitor already running".to_string());
    }
    
    // 获取 sidecar 路径
    let sidecar_path = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("binaries")
        .join(if cfg!(target_os = "windows") {
            "janitor.exe"
        } else {
            "janitor"
        });
    
    // 启动 Janitor
    let child = Command::new(&sidecar_path)
        .spawn()
        .map_err(|e| format!("Failed to start Janitor: {}", e))?;
    
    *process_guard = Some(child);
    
    Ok("Janitor started".to_string())
}

// 停止 Janitor Sidecar
#[tauri::command]
fn stop_janitor(state: State<JanitorState>) -> Result<String, String> {
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;
    
    if let Some(mut child) = process_guard.take() {
        child.kill().map_err(|e| format!("Failed to stop Janitor: {}", e))?;
        Ok("Janitor stopped".to_string())
    } else {
        Ok("Janitor not running".to_string())
    }
}

// 检查 Janitor 状态
#[tauri::command]
fn janitor_status(state: State<JanitorState>) -> Result<bool, String> {
    let process_guard = state.process.lock().map_err(|e| e.to_string())?;
    Ok(process_guard.is_some())
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
        })
        .invoke_handler(tauri::generate_handler![
            start_janitor,
            stop_janitor,
            janitor_status
        ])
        .setup(|app| {
            // 应用启动时自动启动 Janitor (仅桌面端)
            #[cfg(not(target_os = "ios"))]
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(2));
                    if let Err(e) = handle.emit("janitor-starting", ()) {
                        eprintln!("Failed to emit event: {}", e);
                    }
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // 窗口关闭时停止 Janitor
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state: State<JanitorState> = window.state();
                let _ = stop_janitor(state);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
