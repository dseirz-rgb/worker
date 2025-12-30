// 截图服务 - Echo on Blinko 扩展
// 使用 xcap crate 实现屏幕截图功能

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use xcap::Monitor;

/// 截图区域
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenRegion {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// 截图结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotResult {
    pub image_base64: String,
    pub region: ScreenRegion,
}

/// 屏幕信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenInfo {
    pub id: u32,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f32,
    pub is_primary: bool,
}

/// 获取所有屏幕信息
#[tauri::command]
pub async fn get_screens<R: Runtime>(
    _app: AppHandle<R>
) -> Result<Vec<ScreenInfo>, String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let monitors = Monitor::all()
            .map_err(|e| format!("获取屏幕信息失败: {}", e))?;
        
        let mut screens = Vec::new();
        for m in monitors.iter() {
            screens.push(ScreenInfo {
                id: m.id().unwrap_or(0),
                name: m.name().unwrap_or_else(|_| "Unknown".to_string()),
                x: m.x().unwrap_or(0),
                y: m.y().unwrap_or(0),
                width: m.width().unwrap_or(0),
                height: m.height().unwrap_or(0),
                scale_factor: m.scale_factor().unwrap_or(1.0),
                is_primary: m.is_primary().unwrap_or(false),
            });
        }
        
        println!("📺 获取到 {} 个屏幕", screens.len());
        Ok(screens)
    }
    
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("截图功能不支持移动平台".to_string())
    }
}

/// 截取指定屏幕的全屏截图
#[tauri::command]
pub async fn capture_screen<R: Runtime>(
    _app: AppHandle<R>,
    screen_id: Option<u32>,
) -> Result<ScreenshotResult, String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        use base64::{Engine as _, engine::general_purpose::STANDARD};
        use std::io::Cursor;
        
        let monitors = Monitor::all()
            .map_err(|e| format!("获取屏幕信息失败: {}", e))?;
        
        let monitor = if let Some(id) = screen_id {
            monitors.iter()
                .find(|m| m.id().unwrap_or(0) == id)
                .ok_or_else(|| format!("屏幕 {} 不存在", id))?
        } else {
            monitors.iter()
                .find(|m| m.is_primary().unwrap_or(false))
                .or_else(|| monitors.first())
                .ok_or_else(|| "没有找到可用的屏幕".to_string())?
        };
        
        let name = monitor.name().unwrap_or_else(|_| "Unknown".to_string());
        let width = monitor.width().unwrap_or(0);
        let height = monitor.height().unwrap_or(0);
        let x = monitor.x().unwrap_or(0);
        let y = monitor.y().unwrap_or(0);
        
        println!("📸 开始截取屏幕 {} ({}x{})", name, width, height);
        
        let image = monitor.capture_image()
            .map_err(|e| format!("截图失败: {}", e))?;
        
        let mut png_data = Vec::new();
        let mut cursor = Cursor::new(&mut png_data);
        image.write_to(&mut cursor, image::ImageFormat::Png)
            .map_err(|e| format!("PNG 编码失败: {}", e))?;
        
        let base64_data = STANDARD.encode(&png_data);
        
        let region = ScreenRegion { x, y, width, height };
        
        println!("✅ 截图完成，大小: {} bytes", png_data.len());
        
        Ok(ScreenshotResult { image_base64: base64_data, region })
    }
    
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("截图功能不支持移动平台".to_string())
    }
}

/// 截取指定区域的截图
#[tauri::command]
pub async fn capture_screen_region<R: Runtime>(
    _app: AppHandle<R>,
    region: ScreenRegion,
) -> Result<ScreenshotResult, String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        use base64::{Engine as _, engine::general_purpose::STANDARD};
        use std::io::Cursor;
        
        // 使用 from_point 找到包含该点的屏幕
        let monitor = Monitor::from_point(region.x, region.y)
            .or_else(|_| {
                // 如果找不到，使用主屏幕
                Monitor::all().and_then(|monitors| {
                    monitors.into_iter()
                        .find(|m| m.is_primary().unwrap_or(false))
                        .or_else(|| Monitor::all().ok()?.into_iter().next())
                        .ok_or_else(|| xcap::XCapError::new("没有找到可用的屏幕"))
                })
            })
            .map_err(|e| format!("获取屏幕失败: {}", e))?;
        
        println!("📸 开始截取区域 ({}, {}) {}x{}", 
            region.x, region.y, region.width, region.height);
        
        let full_image = monitor.capture_image()
            .map_err(|e| format!("截图失败: {}", e))?;
        
        let mon_x = monitor.x().unwrap_or(0);
        let mon_y = monitor.y().unwrap_or(0);
        
        let rel_x = (region.x - mon_x).max(0) as u32;
        let rel_y = (region.y - mon_y).max(0) as u32;
        let crop_width = region.width.min(full_image.width().saturating_sub(rel_x));
        let crop_height = region.height.min(full_image.height().saturating_sub(rel_y));
        
        let cropped = image::imageops::crop_imm(
            &full_image, rel_x, rel_y, crop_width, crop_height
        ).to_image();
        
        let mut png_data = Vec::new();
        let mut cursor = Cursor::new(&mut png_data);
        cropped.write_to(&mut cursor, image::ImageFormat::Png)
            .map_err(|e| format!("PNG 编码失败: {}", e))?;
        
        let base64_data = STANDARD.encode(&png_data);
        
        println!("✅ 区域截图完成，大小: {} bytes", png_data.len());
        
        Ok(ScreenshotResult { image_base64: base64_data, region })
    }
    
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("截图功能不支持移动平台".to_string())
    }
}
