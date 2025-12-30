/**
 * 情绪管理服务
 * 追踪和分析用户情绪状态
 */

import { getGeminiClient } from '../ai/gemini';
import type { DbResult } from '../../types/database';

// 情绪类型
export type EmotionType = 
  | 'happy' | 'calm' | 'focused' | 'excited'
  | 'anxious' | 'stressed' | 'frustrated' | 'sad'
  | 'neutral';

// 情绪记录
export interface EmotionRecord {
  id: string;
  emotion: EmotionType;
  intensity: number; // 1-10
  context: string;
  triggers?: string[];
  createdAt: string;
}

// 情绪分析结果
export interface EmotionAnalysis {
  dominantEmotion: EmotionType;
  patterns: string[];
  suggestions: string[];
  fomoDetected: boolean;
  tradingEmotionAlert: boolean;
}

// 存储情绪记录
const emotionRecords: EmotionRecord[] = [];

/**
 * 记录情绪
 */
export function recordEmotion(
  emotion: EmotionType,
  intensity: number,
  context: string,
  triggers?: string[]
): EmotionRecord {
  const record: EmotionRecord = {
    id: Date.now().toString(),
    emotion,
    intensity: Math.min(10, Math.max(1, intensity)),
    context,
    triggers,
    createdAt: new Date().toISOString(),
  };
  emotionRecords.push(record);
  return record;
}

/**
 * 获取最近的情绪记录
 */
export function getRecentEmotions(limit: number = 10): EmotionRecord[] {
  return emotionRecords.slice(-limit);
}

/**
 * 分析情绪模式
 */
export async function analyzeEmotionPatterns(): Promise<DbResult<EmotionAnalysis>> {
  const recent = getRecentEmotions(20);
  
  if (recent.length === 0) {
    return {
      success: true,
      data: {
        dominantEmotion: 'neutral',
        patterns: [],
        suggestions: ['开始记录你的情绪，帮助我更好地了解你'],
        fomoDetected: false,
        tradingEmotionAlert: false,
      },
    };
  }

  try {
    const client = getGeminiClient();
    const emotionData = recent.map(r => ({
      emotion: r.emotion,
      intensity: r.intensity,
      context: r.context,
      time: r.createdAt,
    }));

    const prompt = `分析以下情绪记录，识别模式并给出建议：

${JSON.stringify(emotionData, null, 2)}

请以 JSON 格式返回：
{
  "dominantEmotion": "主要情绪",
  "patterns": ["模式1", "模式2"],
  "suggestions": ["建议1", "建议2"],
  "fomoDetected": false,
  "tradingEmotionAlert": false
}

注意：
- fomoDetected: 如果检测到 FOMO（错失恐惧）情绪，设为 true
- tradingEmotionAlert: 如果情绪状态不适合做投资决策，设为 true`;

    const response = await client.generateContent(prompt, {
      generationConfig: { temperature: 0.5, maxOutputTokens: 500 },
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]) as EmotionAnalysis;
      return { success: true, data: analysis };
    }

    return {
      success: true,
      data: {
        dominantEmotion: 'neutral',
        patterns: [],
        suggestions: ['继续记录情绪以获得更准确的分析'],
        fomoDetected: false,
        tradingEmotionAlert: false,
      },
    };
  } catch (error) {
    console.error('情绪分析失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '分析失败',
    };
  }
}

/**
 * 检测投资情绪
 * 在用户准备做投资决策前检查情绪状态
 */
export async function checkTradingEmotion(): Promise<DbResult<{
  canTrade: boolean;
  reason: string;
  suggestions: string[];
}>> {
  const recent = getRecentEmotions(5);
  
  // 检查最近是否有负面情绪
  const negativeEmotions = ['anxious', 'stressed', 'frustrated', 'excited'];
  const hasNegative = recent.some(
    r => negativeEmotions.includes(r.emotion) && r.intensity >= 7
  );

  if (hasNegative) {
    return {
      success: true,
      data: {
        canTrade: false,
        reason: '检测到较强的情绪波动，建议暂缓投资决策',
        suggestions: [
          '先休息一下，让情绪平复',
          '回顾你的投资原则',
          '考虑明天再做决定',
        ],
      },
    };
  }

  return {
    success: true,
    data: {
      canTrade: true,
      reason: '情绪状态稳定，可以进行理性决策',
      suggestions: ['记得遵循你的投资原则'],
    },
  };
}

/**
 * 获取情绪统计
 */
export function getEmotionStats(): {
  total: number;
  byEmotion: Record<EmotionType, number>;
  averageIntensity: number;
} {
  const byEmotion: Record<EmotionType, number> = {
    happy: 0, calm: 0, focused: 0, excited: 0,
    anxious: 0, stressed: 0, frustrated: 0, sad: 0,
    neutral: 0,
  };

  let totalIntensity = 0;

  emotionRecords.forEach(r => {
    byEmotion[r.emotion]++;
    totalIntensity += r.intensity;
  });

  return {
    total: emotionRecords.length,
    byEmotion,
    averageIntensity: emotionRecords.length > 0 
      ? totalIntensity / emotionRecords.length 
      : 0,
  };
}
