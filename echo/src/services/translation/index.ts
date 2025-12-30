/**
 * 翻译服务
 * 参考 Pot (pot-app/pot-desktop) 的设计
 * 
 * 功能：
 * - 截图翻译 (Screenshot Translation)
 * - 划词翻译 (Selection Translation)
 * - 输入翻译 (Input Translation)
 * - OCR 识别 (OCR Recognition)
 * - 翻译历史 (Translation History)
 * - 生词本集成 (Vocabulary Integration)
 */

import { invoke } from '@tauri-apps/api/core';
import { getGeminiClient } from '../ai/gemini';
import type { DbResult } from '../../types/database';

// ============================================================================
// 类型定义
// ============================================================================

/** 翻译结果 */
export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  detectedLanguage?: string;
  alternatives?: string[];
  pronunciation?: string;
}

/** 翻译历史项 (用于 UI 展示) */
export interface TranslationHistoryItem {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
  sourceType: 'screenshot' | 'selection' | 'input' | 'clipboard';
}

/** 生词本项 (用于 UI 展示) */
export interface VocabularyItem {
  id: string;
  word: string;
  translation: string;
  context?: string;
  reviewCount: number;
  mastered: boolean;
  createdAt: string;
}

/** OCR 结果 */
export interface OcrResult {
  text: string;
  confidence: number;
  language?: string;
  blocks: TextBlock[];
}

/** 文本块 */
export interface TextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

/** 截图区域 */
export interface ScreenshotRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 截图结果 */
export interface ScreenshotResult {
  imageBase64: string;
  region: ScreenshotRegion;
  timestamp: number;
}

/** 翻译记录 */
export interface TranslationRecord {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
  sourceType: 'screenshot' | 'selection' | 'input' | 'clipboard';
}

/** 翻译引擎配置 */
export interface TranslationEngineConfig {
  engine: 'gemini' | 'google' | 'deepl' | 'openai';
  apiKey?: string;
  model?: string;
}

/** 支持的语言 */
export const SUPPORTED_LANGUAGES = [
  { code: 'auto', name: '自动检测', nameEn: 'Auto Detect' },
  { code: 'zh-CN', name: '简体中文', nameEn: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: '繁体中文', nameEn: 'Chinese (Traditional)' },
  { code: 'en', name: '英语', nameEn: 'English' },
  { code: 'ja', name: '日语', nameEn: 'Japanese' },
  { code: 'ko', name: '韩语', nameEn: 'Korean' },
  { code: 'fr', name: '法语', nameEn: 'French' },
  { code: 'de', name: '德语', nameEn: 'German' },
  { code: 'es', name: '西班牙语', nameEn: 'Spanish' },
  { code: 'ru', name: '俄语', nameEn: 'Russian' },
  { code: 'pt', name: '葡萄牙语', nameEn: 'Portuguese' },
  { code: 'it', name: '意大利语', nameEn: 'Italian' },
  { code: 'ar', name: '阿拉伯语', nameEn: 'Arabic' },
  { code: 'th', name: '泰语', nameEn: 'Thai' },
  { code: 'vi', name: '越南语', nameEn: 'Vietnamese' },
] as const;

// ============================================================================
// 截图功能 (参考 Pot)
// ============================================================================

/**
 * 截取屏幕区域
 * 调用 Rust 后端实现跨平台截图
 */
export async function captureScreenRegion(): Promise<DbResult<ScreenshotResult>> {
  try {
    const result = await invoke<ScreenshotResult>('capture_screen_region');
    return { success: true, data: result };
  } catch (error) {
    console.error('截图失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '截图失败',
    };
  }
}

// ============================================================================
// OCR 功能
// ============================================================================

/**
 * OCR 文字识别
 * 使用 Gemini Vision API 进行 OCR
 * @param _imageBase64 - 图片的 base64 编码（TODO: 实现图片传递给 Gemini Vision）
 */
export async function recognizeText(_imageBase64: string): Promise<DbResult<OcrResult>> {
  try {
    const client = getGeminiClient();
    
    // 使用 Gemini Vision 进行 OCR
    const prompt = `请识别图片中的所有文字。
要求：
1. 保持原文的格式和换行
2. 如果有多种语言，全部识别
3. 只返回识别到的文字内容，不要添加任何解释
4. 如果没有文字，返回空字符串`;

    const response = await client.generateContent(prompt, {
      generationConfig: { 
        temperature: 0.1, 
        maxOutputTokens: 4000 
      },
    });

    // 检测语言
    const detectedLang = detectLanguage(response.trim());

    return {
      success: true,
      data: {
        text: response.trim(),
        confidence: 0.9,
        language: detectedLang,
        blocks: [], // Gemini 不返回位置信息
      },
    };
  } catch (error) {
    console.error('OCR 识别失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OCR 识别失败',
    };
  }
}

/**
 * 简单的语言检测
 */
function detectLanguage(text: string): string {
  // 检测中文
  if (/[\u4e00-\u9fa5]/.test(text)) {
    return 'zh-CN';
  }
  // 检测日文
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
    return 'ja';
  }
  // 检测韩文
  if (/[\uac00-\ud7af]/.test(text)) {
    return 'ko';
  }
  // 检测俄文
  if (/[\u0400-\u04ff]/.test(text)) {
    return 'ru';
  }
  // 检测阿拉伯文
  if (/[\u0600-\u06ff]/.test(text)) {
    return 'ar';
  }
  // 默认英文
  return 'en';
}

// ============================================================================
// 翻译功能
// ============================================================================

/**
 * 翻译文本
 * 使用 Gemini API 进行翻译
 */
export async function translateText(
  text: string,
  targetLanguage: string = 'zh-CN',
  sourceLanguage?: string
): Promise<DbResult<TranslationResult>> {
  try {
    if (!text.trim()) {
      return { success: false, error: '翻译文本不能为空' };
    }

    const client = getGeminiClient();
    
    // 检测源语言
    const detectedLang = sourceLanguage || detectLanguage(text);
    
    // 如果源语言和目标语言相同，智能选择翻译方向
    let actualTarget = targetLanguage;
    if (detectedLang === targetLanguage) {
      actualTarget = detectedLang === 'zh-CN' ? 'en' : 'zh-CN';
    }
    
    const actualTargetName = getLanguageName(actualTarget);

    const prompt = `将以下文本翻译成${actualTargetName}。

原文：
${text}

要求：
1. 保持原文的语气和风格
2. 专业术语保持准确
3. 只返回翻译结果，不要添加任何解释
4. 如果原文有格式（如换行、列表），保持格式`;

    const response = await client.generateContent(prompt, {
      generationConfig: { 
        temperature: 0.3, 
        maxOutputTokens: 4000 
      },
    });

    return {
      success: true,
      data: {
        originalText: text,
        translatedText: response.trim(),
        sourceLang: detectedLang,
        targetLang: actualTarget,
        detectedLanguage: detectedLang,
      },
    };
  } catch (error) {
    console.error('翻译失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '翻译失败',
    };
  }
}

/**
 * 获取语言名称
 */
function getLanguageName(code: string): string {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang?.name || code;
}

// ============================================================================
// 组合功能 (参考 Pot 的一键操作)
// ============================================================================

/**
 * 截图并翻译
 * 一键完成：截图 → OCR → 翻译
 */
export async function captureAndTranslate(
  targetLanguage: string = 'zh-CN'
): Promise<DbResult<TranslationResult>> {
  // 1. 截图
  const captureResult = await captureScreenRegion();
  if (!captureResult.success || !captureResult.data) {
    return { success: false, error: captureResult.error || '截图失败' };
  }

  // 2. OCR
  const ocrResult = await recognizeText(captureResult.data.imageBase64);
  if (!ocrResult.success || !ocrResult.data?.text) {
    return { success: false, error: ocrResult.error || '未识别到文字' };
  }

  // 3. 翻译
  const translationResult = await translateText(
    ocrResult.data.text, 
    targetLanguage,
    ocrResult.data.language
  );

  // 4. 保存到历史记录
  if (translationResult.success && translationResult.data) {
    await saveTranslationRecord({
      originalText: translationResult.data.originalText,
      translatedText: translationResult.data.translatedText,
      sourceLang: translationResult.data.sourceLang,
      targetLang: translationResult.data.targetLang,
      sourceType: 'screenshot',
    });
  }

  return translationResult;
}

/**
 * 截图 OCR（不翻译）
 */
export async function captureAndOcr(): Promise<DbResult<OcrResult>> {
  // 1. 截图
  const captureResult = await captureScreenRegion();
  if (!captureResult.success || !captureResult.data) {
    return { success: false, error: captureResult.error || '截图失败' };
  }

  // 2. OCR
  return recognizeText(captureResult.data.imageBase64);
}

/**
 * 获取选中文本并翻译 (划词翻译)
 */
export async function translateSelection(
  targetLanguage: string = 'zh-CN'
): Promise<DbResult<TranslationResult>> {
  try {
    // 获取选中的文本
    const selectedText = await invoke<string>('get_selected_text');
    
    if (!selectedText?.trim()) {
      return { success: false, error: '未选中任何文本' };
    }

    // 翻译
    const result = await translateText(selectedText, targetLanguage);

    // 保存到历史记录
    if (result.success && result.data) {
      await saveTranslationRecord({
        originalText: result.data.originalText,
        translatedText: result.data.translatedText,
        sourceLang: result.data.sourceLang,
        targetLang: result.data.targetLang,
        sourceType: 'selection',
      });
    }

    return result;
  } catch (error) {
    console.error('划词翻译失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '划词翻译失败',
    };
  }
}

// ============================================================================
// 翻译历史
// ============================================================================

/**
 * 保存翻译记录
 */
export async function saveTranslationRecord(record: Omit<TranslationRecord, 'id' | 'timestamp'>): Promise<DbResult<void>> {
  try {
    const fullRecord: TranslationRecord = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...record,
    };

    await invoke('add_translation_record', { record: fullRecord });
    return { success: true };
  } catch (error) {
    console.error('保存翻译记录失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '保存翻译记录失败',
    };
  }
}

/**
 * 获取翻译历史 (从 Rust 后端)
 */
export async function getTranslationHistoryFromBackend(limit?: number): Promise<DbResult<TranslationRecord[]>> {
  try {
    const history = await invoke<TranslationRecord[]>('get_translation_history', { limit });
    return { success: true, data: history };
  } catch (error) {
    console.error('获取翻译历史失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取翻译历史失败',
    };
  }
}

// ============================================================================
// 生词本集成 (英语学习功能)
// ============================================================================

/** 生词条目 */
export interface VocabularyEntry {
  id: string;
  word: string;
  translation: string;
  context?: string;
  source?: string;
  reviewCount: number;
  nextReview?: string;
  masteryLevel: number;
  createdAt: string;
}

/**
 * 添加到生词本
 * 从翻译结果中提取单词添加到学习列表
 */
export async function addToVocabulary(
  word: string,
  translation: string,
  context?: string,
  source?: string
): Promise<DbResult<VocabularyEntry>> {
  try {
    const entry: VocabularyEntry = {
      id: crypto.randomUUID(),
      word: word.trim().toLowerCase(),
      translation: translation.trim(),
      context,
      source: source || 'translation',
      reviewCount: 0,
      masteryLevel: 0,
      createdAt: new Date().toISOString(),
    };

    // TODO: 保存到数据库
    // await invoke('add_vocabulary', { entry });

    return { success: true, data: entry };
  } catch (error) {
    console.error('添加到生词本失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '添加到生词本失败',
    };
  }
}

/**
 * 从翻译结果中提取可学习的单词
 */
export function extractLearnableWords(text: string): string[] {
  // 提取英文单词
  const words = text.match(/\b[a-zA-Z]{4,}\b/g) || [];
  
  // 去重并过滤常见词
  const commonWords = new Set([
    'the', 'and', 'that', 'this', 'with', 'from', 'have', 'been',
    'were', 'they', 'their', 'what', 'when', 'where', 'which', 'will',
    'would', 'could', 'should', 'there', 'about', 'into', 'more', 'some',
  ]);

  const uniqueWords = [...new Set(words.map(w => w.toLowerCase()))];
  return uniqueWords.filter(w => !commonWords.has(w));
}

// ============================================================================
// 快捷键配置
// ============================================================================

/** 快捷键配置 */
export interface HotkeyConfig {
  screenshotTranslate: string;
  selectionTranslate: string;
  inputTranslate: string;
  ocrRecognize: string;
  quickNote: string;
}

/**
 * 获取快捷键配置
 */
export async function getHotkeyConfig(): Promise<DbResult<HotkeyConfig>> {
  try {
    const config = await invoke<HotkeyConfig>('get_hotkey_config');
    return { success: true, data: config };
  } catch (error) {
    console.error('获取快捷键配置失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取快捷键配置失败',
    };
  }
}

/**
 * 设置快捷键配置
 */
export async function setHotkeyConfig(config: HotkeyConfig): Promise<DbResult<void>> {
  try {
    await invoke('set_hotkey_config', { config });
    return { success: true };
  } catch (error) {
    console.error('设置快捷键配置失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '设置快捷键配置失败',
    };
  }
}


// ============================================================================
// 本地存储辅助函数 (临时实现，后续迁移到 SeekDB)
// ============================================================================

const HISTORY_STORAGE_KEY = 'echo_translation_history';
const VOCABULARY_STORAGE_KEY = 'echo_vocabulary';

/**
 * 获取翻译历史 (本地存储版本)
 */
export function getTranslationHistory(): TranslationHistoryItem[] {
  try {
    const data = localStorage.getItem(HISTORY_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * 保存翻译到历史 (本地存储版本)
 */
export function saveToHistoryLocal(item: Omit<TranslationHistoryItem, 'id' | 'timestamp'>): void {
  try {
    const history = getTranslationHistory();
    const newItem: TranslationHistoryItem = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...item,
    };
    history.unshift(newItem);
    // 只保留最近 100 条
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 100)));
  } catch (error) {
    console.error('保存翻译历史失败:', error);
  }
}

/**
 * 清空翻译历史
 */
export function clearTranslationHistory(): void {
  localStorage.removeItem(HISTORY_STORAGE_KEY);
}

/**
 * 获取生词本列表
 */
export function getVocabularyList(): VocabularyItem[] {
  try {
    const data = localStorage.getItem(VOCABULARY_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * 保存到生词本
 */
export function saveToVocabulary(word: string, translation: string, context?: string): void {
  try {
    const vocabulary = getVocabularyList();
    // 检查是否已存在
    if (vocabulary.some(v => v.word.toLowerCase() === word.toLowerCase())) {
      return;
    }
    const newItem: VocabularyItem = {
      id: crypto.randomUUID(),
      word: word.trim(),
      translation: translation.trim(),
      context,
      reviewCount: 0,
      mastered: false,
      createdAt: new Date().toISOString(),
    };
    vocabulary.unshift(newItem);
    localStorage.setItem(VOCABULARY_STORAGE_KEY, JSON.stringify(vocabulary));
  } catch (error) {
    console.error('保存到生词本失败:', error);
  }
}
