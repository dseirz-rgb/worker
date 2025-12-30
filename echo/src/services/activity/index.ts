/**
 * 活动监控服务
 * 追踪用户电脑活动（需要 Rust 后端支持）
 */

import { invoke } from '@tauri-apps/api/core';
import type { Activity, LifeDomain, DbResult } from '../../types/database';

// 活动监控状态
let isMonitoring = false;

/**
 * 启动活动监控
 */
export async function startActivityMonitoring(): Promise<DbResult<void>> {
  if (isMonitoring) {
    return { success: true };
  }

  try {
    await invoke('start_activity_monitoring');
    isMonitoring = true;
    console.log('活动监控已启动');
    return { success: true };
  } catch (error) {
    console.error('启动活动监控失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '启动活动监控失败',
    };
  }
}

/**
 * 停止活动监控
 */
export async function stopActivityMonitoring(): Promise<DbResult<void>> {
  if (!isMonitoring) {
    return { success: true };
  }

  try {
    await invoke('stop_activity_monitoring');
    isMonitoring = false;
    console.log('活动监控已停止');
    return { success: true };
  } catch (error) {
    console.error('停止活动监控失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '停止活动监控失败',
    };
  }
}

/**
 * 获取活动记录
 */
export async function getActivities(options?: {
  domain?: LifeDomain;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<DbResult<Activity[]>> {
  try {
    const activities = await invoke<Activity[]>('get_activities', { options });
    return { success: true, data: activities };
  } catch (error) {
    console.error('获取活动记录失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取活动记录失败',
    };
  }
}

/**
 * 获取今日活动统计
 */
export async function getTodayActivityStats(): Promise<DbResult<{
  totalTime: number;
  byDomain: Record<LifeDomain, number>;
  byApp: { app: string; duration: number }[];
}>> {
  try {
    const stats = await invoke<{
      totalTime: number;
      byDomain: Record<LifeDomain, number>;
      byApp: { app: string; duration: number }[];
    }>('get_today_activity_stats');
    return { success: true, data: stats };
  } catch (error) {
    console.error('获取活动统计失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取活动统计失败',
    };
  }
}

/**
 * 获取监控状态
 */
export function isActivityMonitoringActive(): boolean {
  return isMonitoring;
}
