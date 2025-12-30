/**
 * 健康数据服务
 * 集成 Apple Health (iOS) 或手动输入
 */

import { invoke } from '@tauri-apps/api/core';
import type { DbResult } from '../../types/database';

// 健康数据类型
export interface HealthData {
  date: string;
  steps: number;
  heartRate: number;
  sleepHours: number;
  activeCalories: number;
  standHours: number;
  exerciseMinutes: number;
}

// 睡眠数据
export interface SleepData {
  date: string;
  bedTime: string;
  wakeTime: string;
  totalHours: number;
  deepSleepHours: number;
  quality: 'good' | 'fair' | 'poor';
}

// 压力指标
export interface StressIndicator {
  level: 'low' | 'medium' | 'high';
  heartRateVariability: number;
  restingHeartRate: number;
  sleepQuality: string;
  suggestions: string[];
}

/**
 * 获取今日健康数据
 */
export async function getTodayHealthData(): Promise<DbResult<HealthData>> {
  try {
    const data = await invoke<HealthData>('get_today_health_data');
    return { success: true, data };
  } catch (error) {
    // 返回模拟数据（用于开发）
    console.warn('获取健康数据失败，使用模拟数据:', error);
    return {
      success: true,
      data: {
        date: new Date().toISOString().split('T')[0],
        steps: 0,
        heartRate: 0,
        sleepHours: 0,
        activeCalories: 0,
        standHours: 0,
        exerciseMinutes: 0,
      },
    };
  }
}

/**
 * 获取睡眠数据
 */
export async function getSleepData(date?: string): Promise<DbResult<SleepData>> {
  try {
    const data = await invoke<SleepData>('get_sleep_data', { date });
    return { success: true, data };
  } catch (error) {
    console.warn('获取睡眠数据失败:', error);
    return {
      success: true,
      data: {
        date: date || new Date().toISOString().split('T')[0],
        bedTime: '',
        wakeTime: '',
        totalHours: 0,
        deepSleepHours: 0,
        quality: 'fair',
      },
    };
  }
}

/**
 * 分析压力指标
 */
export async function analyzeStress(): Promise<DbResult<StressIndicator>> {
  try {
    const healthData = await getTodayHealthData();
    const sleepData = await getSleepData();

    // 简单的压力分析逻辑
    let level: 'low' | 'medium' | 'high' = 'low';
    const suggestions: string[] = [];

    // 基于睡眠质量
    if (sleepData.data?.totalHours && sleepData.data.totalHours < 6) {
      level = 'high';
      suggestions.push('睡眠不足，建议今晚早点休息');
    } else if (sleepData.data?.totalHours && sleepData.data.totalHours < 7) {
      level = level === 'low' ? 'medium' : level;
      suggestions.push('睡眠时间略少，注意休息');
    }

    // 基于运动量
    if (healthData.data?.steps && healthData.data.steps < 3000) {
      suggestions.push('今日活动量较少，建议适当运动');
    }

    // 基于心率
    if (healthData.data?.heartRate && healthData.data.heartRate > 90) {
      level = 'high';
      suggestions.push('心率偏高，注意放松');
    }

    return {
      success: true,
      data: {
        level,
        heartRateVariability: 0,
        restingHeartRate: healthData.data?.heartRate || 0,
        sleepQuality: sleepData.data?.quality || 'fair',
        suggestions,
      },
    };
  } catch (error) {
    console.error('分析压力指标失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '分析失败',
    };
  }
}

/**
 * 手动记录健康数据
 */
export async function recordHealthData(data: Partial<HealthData>): Promise<DbResult<void>> {
  try {
    await invoke('record_health_data', { data });
    return { success: true };
  } catch (error) {
    console.error('记录健康数据失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '记录失败',
    };
  }
}

/**
 * 生成健康摘要（用于日报）
 */
export async function generateHealthSummary(): Promise<DbResult<string>> {
  const healthResult = await getTodayHealthData();
  const sleepResult = await getSleepData();
  const stressResult = await analyzeStress();

  if (!healthResult.success || !healthResult.data) {
    return { success: false, error: '获取健康数据失败' };
  }

  const health = healthResult.data;
  const sleep = sleepResult.data;
  const stress = stressResult.data;

  let summary = `🏃 健康摘要\n`;
  summary += `步数: ${health.steps.toLocaleString()}\n`;
  summary += `活动消耗: ${health.activeCalories} 卡路里\n`;
  summary += `运动时间: ${health.exerciseMinutes} 分钟\n`;

  if (sleep) {
    summary += `\n😴 睡眠\n`;
    summary += `睡眠时长: ${sleep.totalHours.toFixed(1)} 小时\n`;
    summary += `睡眠质量: ${sleep.quality === 'good' ? '良好' : sleep.quality === 'fair' ? '一般' : '较差'}\n`;
  }

  if (stress) {
    summary += `\n💆 压力状态: ${stress.level === 'low' ? '低' : stress.level === 'medium' ? '中等' : '高'}\n`;
    if (stress.suggestions.length > 0) {
      summary += `建议: ${stress.suggestions.join('; ')}\n`;
    }
  }

  return { success: true, data: summary };
}
