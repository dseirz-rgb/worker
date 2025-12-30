/**
 * 学习追踪服务
 * 追踪 AI、投资、英语等学习进度
 */

import { getGeminiClient } from '../ai/gemini';
import type { DbResult } from '../../types/database';

// 学习类别
export type LearningCategory = 'ai' | 'investment' | 'english' | 'programming' | 'other';

// 学习记录
export interface LearningRecord {
  id: string;
  category: LearningCategory;
  title: string;
  content: string;
  source?: string;
  keyPoints: string[];
  duration: number; // 分钟
  date: string;
  createdAt: string;
}

// 学习统计
export interface LearningStats {
  totalHours: number;
  byCategory: Record<LearningCategory, number>;
  streak: number;
  lastLearningDate: string;
}

// 存储
const learningRecords: LearningRecord[] = [];

/**
 * 添加学习记录
 */
export function addLearningRecord(
  category: LearningCategory,
  title: string,
  content: string,
  duration: number,
  source?: string,
  keyPoints?: string[]
): LearningRecord {
  const record: LearningRecord = {
    id: Date.now().toString(),
    category,
    title,
    content,
    source,
    keyPoints: keyPoints || [],
    duration,
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  };
  learningRecords.push(record);
  return record;
}

/**
 * 获取学习记录
 */
export function getLearningRecords(
  category?: LearningCategory,
  limit?: number
): LearningRecord[] {
  let records = [...learningRecords];
  if (category) {
    records = records.filter(r => r.category === category);
  }
  records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (limit) {
    records = records.slice(0, limit);
  }
  return records;
}

/**
 * 获取学习统计
 */
export function getLearningStats(): LearningStats {
  const byCategory: Record<LearningCategory, number> = {
    ai: 0,
    investment: 0,
    english: 0,
    programming: 0,
    other: 0,
  };

  let totalMinutes = 0;
  const dates = new Set<string>();

  learningRecords.forEach(r => {
    byCategory[r.category] += r.duration;
    totalMinutes += r.duration;
    dates.add(r.date);
  });

  // 计算连续学习天数
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    if (dates.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  const sortedDates = Array.from(dates).sort().reverse();

  return {
    totalHours: Math.round(totalMinutes / 60 * 10) / 10,
    byCategory: Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [k, Math.round(v / 60 * 10) / 10])
    ) as Record<LearningCategory, number>,
    streak,
    lastLearningDate: sortedDates[0] || '',
  };
}

/**
 * AI 提取学习要点
 */
export async function extractKeyPoints(content: string): Promise<DbResult<string[]>> {
  try {
    const client = getGeminiClient();
    const prompt = `从以下学习内容中提取 3-5 个关键要点：

${content}

以 JSON 数组格式返回，例如：["要点1", "要点2", "要点3"]
只返回 JSON 数组，不要其他内容。`;

    const response = await client.generateContent(prompt, {
      generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
    });

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const keyPoints = JSON.parse(jsonMatch[0]) as string[];
      return { success: true, data: keyPoints };
    }

    return { success: true, data: [] };
  } catch (error) {
    console.error('提取要点失败:', error);
    return { success: false, error: '提取失败' };
  }
}

/**
 * 生成学习报告
 */
export async function generateLearningReport(
  days: number = 7
): Promise<DbResult<string>> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const recentRecords = learningRecords.filter(r => r.date >= cutoffStr);
  const stats = getLearningStats();

  if (recentRecords.length === 0) {
    return {
      success: true,
      data: `📚 学习报告（最近 ${days} 天）\n\n暂无学习记录，开始学习吧！`,
    };
  }

  try {
    const client = getGeminiClient();
    const recordsSummary = recentRecords.map(r => ({
      category: r.category,
      title: r.title,
      keyPoints: r.keyPoints,
      duration: r.duration,
    }));

    const prompt = `根据以下学习记录生成一份简洁的学习报告：

${JSON.stringify(recordsSummary, null, 2)}

统计：
- 总学习时长: ${stats.totalHours} 小时
- 连续学习: ${stats.streak} 天

请生成一份包含以下内容的报告：
1. 学习概览
2. 主要收获
3. 改进建议

用中文回复，简洁明了。`;

    const response = await client.generateContent(prompt, {
      generationConfig: { temperature: 0.5, maxOutputTokens: 500 },
    });

    return { success: true, data: response };
  } catch (error) {
    console.error('生成报告失败:', error);
    return { success: false, error: '生成失败' };
  }
}

/**
 * 获取学习建议
 */
export async function getLearningRecommendations(): Promise<DbResult<string[]>> {
  const stats = getLearningStats();
  const recent = getLearningRecords(undefined, 10);

  try {
    const client = getGeminiClient();
    const prompt = `根据用户的学习情况给出 3 条学习建议：

学习统计：
${JSON.stringify(stats, null, 2)}

最近学习：
${recent.map(r => `- ${r.category}: ${r.title}`).join('\n')}

以 JSON 数组格式返回建议，例如：["建议1", "建议2", "建议3"]
只返回 JSON 数组，不要其他内容。`;

    const response = await client.generateContent(prompt, {
      generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
    });

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const recommendations = JSON.parse(jsonMatch[0]) as string[];
      return { success: true, data: recommendations };
    }

    return { success: true, data: ['继续保持学习习惯'] };
  } catch (error) {
    console.error('获取建议失败:', error);
    return { success: false, error: '获取失败' };
  }
}
