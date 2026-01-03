/**
 * 活动监控 TypeScript 绑定 - Echo on Blinko 扩展
 * 
 * 提供前端调用 Tauri 活动监控命令的接口
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * 活动信息接口
 */
export interface ActivityInfo {
  /** 应用名称 */
  app_name: string;
  /** 窗口标题 */
  window_title: string;
  /** macOS bundle ID 或 Windows exe 路径 */
  bundle_id: string | null;
  /** 浏览器 URL (如果是浏览器) */
  url: string | null;
  /** 时间戳 (毫秒) */
  timestamp: number;
}

/**
 * 活动记录接口 (用于发送到服务器)
 */
export interface ActivityRecord {
  appName: string;
  windowTitle: string;
  bundleId?: string;
  url?: string;
  duration: number;
  domainId?: number;
  startTime: string;
  endTime: string;
}

/**
 * 获取当前活动窗口信息
 */
export async function getCurrentActivity(): Promise<ActivityInfo> {
  return invoke<ActivityInfo>('get_current_activity_cmd');
}

/**
 * 启动活动监控
 */
export async function startActivityMonitoring(): Promise<void> {
  return invoke('start_activity_monitoring');
}

/**
 * 停止活动监控
 */
export async function stopActivityMonitoring(): Promise<void> {
  return invoke('stop_activity_monitoring');
}

/**
 * 检查活动监控是否正在运行
 */
export async function isActivityMonitoring(): Promise<boolean> {
  return invoke<boolean>('is_activity_monitoring');
}

/**
 * 活动监控管理器
 * 
 * 提供定时轮询当前活动并聚合记录的功能
 */
export class ActivityMonitor {
  private intervalId: number | null = null;
  private lastActivity: ActivityInfo | null = null;
  private activityStartTime: number | null = null;
  private pollInterval: number;
  private onActivityChange?: (record: ActivityRecord) => void;

  constructor(options: {
    /** 轮询间隔 (毫秒)，默认 5000 */
    pollInterval?: number;
    /** 活动变化回调 */
    onActivityChange?: (record: ActivityRecord) => void;
  } = {}) {
    this.pollInterval = options.pollInterval || 5000;
    this.onActivityChange = options.onActivityChange;
  }

  /**
   * 启动监控
   */
  async start(): Promise<void> {
    if (this.intervalId !== null) {
      console.warn('活动监控已在运行');
      return;
    }

    await startActivityMonitoring();
    
    // 获取初始活动
    this.lastActivity = await getCurrentActivity();
    this.activityStartTime = Date.now();

    // 开始轮询
    this.intervalId = window.setInterval(async () => {
      await this.poll();
    }, this.pollInterval);

    console.log('活动监控已启动');
  }

  /**
   * 停止监控
   */
  async stop(): Promise<void> {
    if (this.intervalId === null) {
      console.warn('活动监控未在运行');
      return;
    }

    // 记录最后一个活动
    if (this.lastActivity && this.activityStartTime) {
      this.emitActivityRecord();
    }

    window.clearInterval(this.intervalId);
    this.intervalId = null;
    this.lastActivity = null;
    this.activityStartTime = null;

    await stopActivityMonitoring();
    console.log('活动监控已停止');
  }

  /**
   * 轮询当前活动
   */
  private async poll(): Promise<void> {
    try {
      const currentActivity = await getCurrentActivity();
      
      // 检查活动是否变化
      if (this.hasActivityChanged(currentActivity)) {
        // 记录上一个活动
        if (this.lastActivity && this.activityStartTime) {
          this.emitActivityRecord();
        }

        // 更新当前活动
        this.lastActivity = currentActivity;
        this.activityStartTime = Date.now();
      }
    } catch (error) {
      console.error('获取当前活动失败:', error);
    }
  }

  /**
   * 检查活动是否变化
   */
  private hasActivityChanged(current: ActivityInfo): boolean {
    if (!this.lastActivity) return true;
    
    return (
      this.lastActivity.app_name !== current.app_name ||
      this.lastActivity.window_title !== current.window_title
    );
  }

  /**
   * 发送活动记录
   */
  private emitActivityRecord(): void {
    if (!this.lastActivity || !this.activityStartTime) return;

    const endTime = Date.now();
    const duration = Math.floor((endTime - this.activityStartTime) / 1000);

    // 忽略太短的活动 (小于 1 秒)
    if (duration < 1) return;

    const record: ActivityRecord = {
      appName: this.lastActivity.app_name,
      windowTitle: this.lastActivity.window_title,
      bundleId: this.lastActivity.bundle_id || undefined,
      url: this.lastActivity.url || undefined,
      duration,
      startTime: new Date(this.activityStartTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    };

    this.onActivityChange?.(record);
  }

  /**
   * 检查是否正在运行
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }
}

/**
 * 创建活动监控器实例
 */
export function createActivityMonitor(options?: {
  pollInterval?: number;
  onActivityChange?: (record: ActivityRecord) => void;
}): ActivityMonitor {
  return new ActivityMonitor(options);
}
