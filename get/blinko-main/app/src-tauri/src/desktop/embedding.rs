/**
 * 本地嵌入服务 - Echo on Blinko 扩展
 * 
 * 提供本地向量嵌入生成功能，支持:
 * 1. 调用本地 Ollama 嵌入 API
 * 2. 未来可扩展支持 fastembed-rs
 * 
 * 优势: 离线可用、更快、更私密
 */

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

/// 嵌入配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingConfig {
    /// Ollama API 地址
    pub ollama_url: String,
    /// 嵌入模型名称
    pub model: String,
    /// 是否启用本地嵌入
    pub enabled: bool,
}

impl Default for EmbeddingConfig {
    fn default() -> Self {
        Self {
            ollama_url: "http://localhost:11434".to_string(),
            model: "nomic-embed-text".to_string(),
            enabled: false,
        }
    }
}

/// 嵌入状态
pub struct EmbeddingState {
    pub config: Mutex<EmbeddingConfig>,
}

impl Default for EmbeddingState {
    fn default() -> Self {
        Self {
            config: Mutex::new(EmbeddingConfig::default()),
        }
    }
}

/// Ollama 嵌入请求
#[derive(Serialize)]
struct OllamaEmbedRequest {
    model: String,
    prompt: String,
}

/// Ollama 嵌入响应
#[derive(Deserialize)]
struct OllamaEmbedResponse {
    embedding: Vec<f32>,
}

/// 嵌入结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingResult {
    pub embedding: Vec<f32>,
    pub model: String,
    pub dimensions: usize,
}

/// 获取嵌入配置
#[tauri::command]
pub fn get_embedding_config(state: State<'_, EmbeddingState>) -> Result<EmbeddingConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

/// 设置嵌入配置
#[tauri::command]
pub fn set_embedding_config(
    state: State<'_, EmbeddingState>,
    config: EmbeddingConfig,
) -> Result<(), String> {
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    *current = config;
    Ok(())
}

/// 检查 Ollama 是否可用
#[tauri::command]
pub async fn check_ollama_available(state: State<'_, EmbeddingState>) -> Result<bool, String> {
    let config = {
        let c = state.config.lock().map_err(|e| e.to_string())?;
        c.clone()
    };

    let client = reqwest::Client::new();
    let url = format!("{}/api/tags", config.ollama_url);
    
    match client.get(&url).timeout(std::time::Duration::from_secs(5)).send().await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// 列出可用的嵌入模型
#[tauri::command]
pub async fn list_embedding_models(state: State<'_, EmbeddingState>) -> Result<Vec<String>, String> {
    let config = {
        let c = state.config.lock().map_err(|e| e.to_string())?;
        c.clone()
    };

    let client = reqwest::Client::new();
    let url = format!("{}/api/tags", config.ollama_url);
    
    let resp = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !resp.status().is_success() {
        return Err("Ollama 服务不可用".to_string());
    }

    #[derive(Deserialize)]
    struct TagsResponse {
        models: Vec<ModelInfo>,
    }

    #[derive(Deserialize)]
    struct ModelInfo {
        name: String,
    }

    let tags: TagsResponse = resp.json().await.map_err(|e| format!("解析响应失败: {}", e))?;
    
    // 过滤出嵌入模型 (通常包含 embed 关键词)
    let embedding_models: Vec<String> = tags
        .models
        .into_iter()
        .map(|m| m.name)
        .filter(|name| {
            let lower = name.to_lowercase();
            lower.contains("embed") || lower.contains("bge") || lower.contains("nomic")
        })
        .collect();

    Ok(embedding_models)
}

/// 生成文本嵌入
#[tauri::command]
pub async fn generate_embedding(
    state: State<'_, EmbeddingState>,
    text: String,
) -> Result<EmbeddingResult, String> {
    let config = {
        let c = state.config.lock().map_err(|e| e.to_string())?;
        c.clone()
    };

    if !config.enabled {
        return Err("本地嵌入未启用".to_string());
    }

    let client = reqwest::Client::new();
    let url = format!("{}/api/embeddings", config.ollama_url);
    
    let request = OllamaEmbedRequest {
        model: config.model.clone(),
        prompt: text,
    };

    let resp = client
        .post(&url)
        .json(&request)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Ollama 返回错误 {}: {}", status, body));
    }

    let embed_resp: OllamaEmbedResponse = resp
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    let dimensions = embed_resp.embedding.len();

    Ok(EmbeddingResult {
        embedding: embed_resp.embedding,
        model: config.model,
        dimensions,
    })
}

/// 批量生成嵌入
#[tauri::command]
pub async fn generate_embeddings_batch(
    state: State<'_, EmbeddingState>,
    texts: Vec<String>,
) -> Result<Vec<EmbeddingResult>, String> {
    let config = {
        let c = state.config.lock().map_err(|e| e.to_string())?;
        c.clone()
    };

    if !config.enabled {
        return Err("本地嵌入未启用".to_string());
    }

    let client = reqwest::Client::new();
    let url = format!("{}/api/embeddings", config.ollama_url);
    
    let mut results = Vec::with_capacity(texts.len());

    for text in texts {
        let request = OllamaEmbedRequest {
            model: config.model.clone(),
            prompt: text,
        };

        let resp = client
            .post(&url)
            .json(&request)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !resp.status().is_success() {
            continue; // 跳过失败的
        }

        if let Ok(embed_resp) = resp.json::<OllamaEmbedResponse>().await {
            let dimensions = embed_resp.embedding.len();
            results.push(EmbeddingResult {
                embedding: embed_resp.embedding,
                model: config.model.clone(),
                dimensions,
            });
        }
    }

    Ok(results)
}

/// 计算两个向量的余弦相似度
#[tauri::command]
pub fn cosine_similarity(a: Vec<f32>, b: Vec<f32>) -> Result<f32, String> {
    if a.len() != b.len() {
        return Err("向量维度不匹配".to_string());
    }

    let mut dot_product = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for i in 0..a.len() {
        dot_product += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    if norm_a == 0.0 || norm_b == 0.0 {
        return Ok(0.0);
    }

    Ok(dot_product / (norm_a.sqrt() * norm_b.sqrt()))
}
