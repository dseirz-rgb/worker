//! fastembed-rs 本地嵌入服务
//!
//! 基于 fastembed-rs 实现完全离线的文本向量嵌入。
//! 使用 all-MiniLM-L6-v2 模型，生成 384 维向量。
//!
//! **参考项目**: [fastembed-rs](https://github.com/Anush008/fastembed-rs)
//! **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

// ============================================================================
// 全局嵌入模型实例
// ============================================================================

/// 全局嵌入模型实例 (懒加载)
static EMBEDDING_MODEL: OnceCell<Mutex<TextEmbedding>> = OnceCell::new();

/// 嵌入模型配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingConfig {
    /// 模型名称 (默认 "all-MiniLM-L6-v2")
    pub model_name: String,
    /// 模型缓存目录
    pub cache_dir: Option<String>,
    /// 是否显示下载进度
    pub show_download_progress: bool,
}

impl Default for EmbeddingConfig {
    fn default() -> Self {
        Self {
            model_name: "all-MiniLM-L6-v2".to_string(),
            cache_dir: None,
            show_download_progress: true,
        }
    }
}

/// 嵌入结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingResult {
    /// 向量数组
    pub embedding: Vec<f32>,
    /// 向量维度
    pub dimension: usize,
    /// 模型名称
    pub model: String,
}

/// 批量嵌入结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchEmbeddingResult {
    /// 向量数组列表
    pub embeddings: Vec<Vec<f32>>,
    /// 向量维度
    pub dimension: usize,
    /// 模型名称
    pub model: String,
    /// 处理的文本数量
    pub count: usize,
}

/// 嵌入服务状态
pub struct EmbeddingState {
    pub config: EmbeddingConfig,
    pub is_initialized: bool,
    pub model_loaded: bool,
}

impl Default for EmbeddingState {
    fn default() -> Self {
        Self {
            config: EmbeddingConfig::default(),
            is_initialized: false,
            model_loaded: false,
        }
    }
}

// ============================================================================
// 内部函数
// ============================================================================

/// 获取或初始化嵌入模型
fn get_or_init_model(config: &EmbeddingConfig) -> Result<&'static Mutex<TextEmbedding>, String> {
    EMBEDDING_MODEL.get_or_try_init(|| {
        log::info!("初始化嵌入模型: {}", config.model_name);
        
        let mut options = InitOptions::new(EmbeddingModel::AllMiniLML6V2)
            .with_show_download_progress(config.show_download_progress);
        
        // 设置缓存目录
        if let Some(ref cache_dir) = config.cache_dir {
            let path = PathBuf::from(cache_dir);
            options = options.with_cache_dir(path);
        }
        
        let model = TextEmbedding::try_new(options)
            .map_err(|e| format!("初始化嵌入模型失败: {}", e))?;
        
        log::info!("嵌入模型初始化完成");
        Ok(Mutex::new(model))
    })
}

// ============================================================================
// Tauri 命令
// ============================================================================

/// 初始化嵌入服务
/// 
/// 首次调用会下载模型 (~90MB)，后续调用使用缓存。
#[tauri::command]
pub async fn init_embedding_service(
    state: State<'_, Mutex<EmbeddingState>>,
    config: Option<EmbeddingConfig>,
) -> Result<bool, String> {
    let config = config.unwrap_or_default();
    
    // 更新状态
    {
        let mut state = state.lock().map_err(|e| e.to_string())?;
        state.config = config.clone();
        state.is_initialized = true;
    }
    
    // 初始化模型
    get_or_init_model(&config)?;
    
    // 更新状态
    {
        let mut state = state.lock().map_err(|e| e.to_string())?;
        state.model_loaded = true;
    }
    
    Ok(true)
}

/// 生成单条文本的向量嵌入
/// 
/// # 参数
/// - `text`: 要嵌入的文本
/// 
/// # 返回
/// - 384 维向量
#[tauri::command]
pub async fn embed_text(
    state: State<'_, Mutex<EmbeddingState>>,
    text: String,
) -> Result<EmbeddingResult, String> {
    // 获取配置
    let config = {
        let state = state.lock().map_err(|e| e.to_string())?;
        state.config.clone()
    };
    
    // 获取模型
    let model = get_or_init_model(&config)?;
    let model = model.lock().map_err(|e| e.to_string())?;
    
    // 生成嵌入
    let embeddings = model
        .embed(vec![text.as_str()], None)
        .map_err(|e| format!("生成嵌入失败: {}", e))?;
    
    let embedding = embeddings
        .into_iter()
        .next()
        .ok_or("嵌入结果为空")?;
    
    Ok(EmbeddingResult {
        dimension: embedding.len(),
        embedding,
        model: config.model_name,
    })
}

/// 批量生成文本向量嵌入
/// 
/// # 参数
/// - `texts`: 要嵌入的文本数组
/// 
/// # 返回
/// - 384 维向量数组
#[tauri::command]
pub async fn embed_batch(
    state: State<'_, Mutex<EmbeddingState>>,
    texts: Vec<String>,
) -> Result<BatchEmbeddingResult, String> {
    if texts.is_empty() {
        return Ok(BatchEmbeddingResult {
            embeddings: Vec::new(),
            dimension: 384,
            model: "all-MiniLM-L6-v2".to_string(),
            count: 0,
        });
    }
    
    // 获取配置
    let config = {
        let state = state.lock().map_err(|e| e.to_string())?;
        state.config.clone()
    };
    
    // 获取模型
    let model = get_or_init_model(&config)?;
    let model = model.lock().map_err(|e| e.to_string())?;
    
    // 转换为 &str 切片
    let text_refs: Vec<&str> = texts.iter().map(|s| s.as_str()).collect();
    
    // 生成嵌入
    let embeddings = model
        .embed(text_refs, None)
        .map_err(|e| format!("批量生成嵌入失败: {}", e))?;
    
    let dimension = embeddings.first().map(|e| e.len()).unwrap_or(384);
    let count = embeddings.len();
    
    Ok(BatchEmbeddingResult {
        embeddings,
        dimension,
        model: config.model_name,
        count,
    })
}

/// 获取嵌入服务状态
#[tauri::command]
pub async fn get_embedding_status(
    state: State<'_, Mutex<EmbeddingState>>,
) -> Result<EmbeddingServiceStatus, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    
    Ok(EmbeddingServiceStatus {
        is_initialized: state.is_initialized,
        model_loaded: state.model_loaded,
        model_name: state.config.model_name.clone(),
        dimension: 384,
    })
}

/// 嵌入服务状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingServiceStatus {
    pub is_initialized: bool,
    pub model_loaded: bool,
    pub model_name: String,
    pub dimension: usize,
}

/// 获取向量维度
#[tauri::command]
pub fn get_embedding_dimension() -> usize {
    384 // all-MiniLM-L6-v2 固定维度
}

// ============================================================================
// 测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = EmbeddingConfig::default();
        assert_eq!(config.model_name, "all-MiniLM-L6-v2");
        assert!(config.show_download_progress);
    }

    #[test]
    fn test_embedding_dimension() {
        assert_eq!(get_embedding_dimension(), 384);
    }
}
