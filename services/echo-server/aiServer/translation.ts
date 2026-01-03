/**
 * 翻译服务 - Echo on Blinko 扩展
 * 使用 Blinko 的 AI 模型进行翻译和 OCR
 */

import { AiModelFactory } from './aiModelFactory';
import { Agent, Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import dayjs from 'dayjs';

/** 翻译结果 */
export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  detectedLanguage?: string;
}

/** OCR 结果 */
export interface OCRResult {
  text: string;
  confidence: number;
}

/** OCR + 翻译结果 */
export interface OCRTranslationResult extends TranslationResult {
  ocrResult: OCRResult;
}

/** 支持的语言 */
export const SUPPORTED_LANGUAGES = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'en': 'English',
  'ja': '日本語',
  'ko': '한국어',
  'fr': 'Français',
  'de': 'Deutsch',
  'es': 'Español',
  'ru': 'Русский',
  'pt': 'Português',
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

/**
 * 翻译服务类
 */
export class TranslationService {
  /**
   * 创建翻译 Agent
   */
  private static async createTranslationAgent() {
    const provider = await AiModelFactory.GetProvider();
    
    const agent = new Agent({
      name: 'Blinko Translation Agent',
      instructions: `You are a professional translator. Your task is to:
1. Detect the source language of the input text
2. Translate the text to the target language accurately
3. Preserve the original formatting and structure
4. Maintain technical terms and proper nouns appropriately

Response format (JSON):
{
  "detectedLanguage": "detected language code",
  "translatedText": "translated content"
}

Important:
- Always respond with valid JSON
- Keep the translation natural and fluent
- Preserve code blocks, URLs, and special formatting`,
      model: provider?.LLM!,
    });

    return new Mastra({
      agents: { agent },
      logger: process.env.NODE_ENV === 'development' ? new PinoLogger({
        name: 'BlinkoTranslation',
        level: 'debug',
      }) : undefined,
    }).getAgent('agent');
  }


  /**
   * 翻译文本
   */
  static async translate(
    text: string,
    targetLanguage: LanguageCode = 'zh-CN',
    sourceLanguage?: LanguageCode
  ): Promise<TranslationResult> {
    const agent = await this.createTranslationAgent();
    
    const targetLangName = SUPPORTED_LANGUAGES[targetLanguage] || targetLanguage;
    const sourceLangHint = sourceLanguage 
      ? `Source language: ${SUPPORTED_LANGUAGES[sourceLanguage] || sourceLanguage}` 
      : 'Auto-detect source language';

    const response = await agent.generate([
      {
        role: 'user',
        content: `${sourceLangHint}
Target language: ${targetLangName}

Text to translate:
${text}`,
      },
    ], { temperature: 0.3 });

    try {
      // 尝试解析 JSON 响应
      const jsonMatch = response.text?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          originalText: text,
          translatedText: parsed.translatedText || response.text || '',
          sourceLanguage: sourceLanguage || parsed.detectedLanguage || 'auto',
          targetLanguage,
          detectedLanguage: parsed.detectedLanguage,
        };
      }
    } catch (e) {
      // JSON 解析失败，直接使用响应文本
    }

    return {
      originalText: text,
      translatedText: response.text?.trim() || '',
      sourceLanguage: sourceLanguage || 'auto',
      targetLanguage,
    };
  }

  /**
   * OCR 识别图片中的文字
   */
  static async ocr(imageBase64: string): Promise<OCRResult> {
    const agent = await AiModelFactory.ImageEmbeddingAgent();
    
    // 构建 data URL
    const dataUrl = imageBase64.startsWith('data:') 
      ? imageBase64 
      : `data:image/png;base64,${imageBase64}`;

    const response = await agent.generate([
      {
        role: 'user',
        content: [
          { type: 'image', image: dataUrl, mimeType: 'image/png' },
          {
            type: 'text',
            text: 'Extract all text from this image. Return only the extracted text, nothing else.',
          },
        ],
      },
    ], { temperature: 0.1 });

    const extractedText = response.text?.trim() || '';
    
    // 检查是否支持图片
    if (extractedText === 'not support image') {
      throw new Error('当前 AI 模型不支持图片识别');
    }

    return {
      text: extractedText,
      confidence: 1.0, // AI 模型不提供置信度，默认为 1.0
    };
  }

  /**
   * OCR + 翻译
   */
  static async ocrAndTranslate(
    imageBase64: string,
    targetLanguage: LanguageCode = 'zh-CN'
  ): Promise<OCRTranslationResult> {
    // 先进行 OCR
    const ocrResult = await this.ocr(imageBase64);
    
    if (!ocrResult.text) {
      throw new Error('图片中未识别到文字');
    }

    // 再进行翻译
    const translationResult = await this.translate(ocrResult.text, targetLanguage);

    return {
      ...translationResult,
      ocrResult,
    };
  }

  /**
   * 检测文本语言
   */
  static async detectLanguage(text: string): Promise<LanguageCode> {
    const agent = await this.createTranslationAgent();
    
    const response = await agent.generate([
      {
        role: 'user',
        content: `Detect the language of the following text and return only the language code (e.g., zh-CN, en, ja, ko, etc.):

${text}`,
      },
    ], { temperature: 0.1 });

    const detected = response.text?.trim().toLowerCase() || 'en';
    
    // 标准化语言代码
    if (detected.includes('chinese') || detected === 'zh' || detected === 'cn') {
      return 'zh-CN';
    }
    if (detected.includes('english') || detected === 'en') {
      return 'en';
    }
    if (detected.includes('japanese') || detected === 'ja' || detected === 'jp') {
      return 'ja';
    }
    if (detected.includes('korean') || detected === 'ko' || detected === 'kr') {
      return 'ko';
    }

    return (detected as LanguageCode) || 'en';
  }
}
