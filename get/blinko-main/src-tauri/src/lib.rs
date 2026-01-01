// Echo iOS App - Tauri 库入口
// iOS 版本不包含 Janitor Sidecar

#[cfg(target_os = "ios")]
mod ios {
    use tauri::Manager;

    #[tauri::command]
    fn get_platform() -> String {
        "ios".to_string()
    }

    #[tauri::command]
    fn janitor_available() -> bool {
        // iOS 不支持 Janitor
        false
    }

    pub fn run() {
        tauri::Builder::default()
            .plugin(tauri_plugin_shell::init())
            .invoke_handler(tauri::generate_handler![
                get_platform,
                janitor_available
            ])
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }
}

#[cfg(target_os = "ios")]
pub use ios::run;
