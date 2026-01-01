/**
 * Echo v3.2: 桌面通知 Hook
 * 提供 React 组件中使用桌面通知的便捷方法
 */

import { useState, useEffect, useCallback } from 'react';
import {
  checkNotificationPermission,
  requestNotificationPermission,
  sendDesktopNotification,
  sendReportNotification,
  sendSuggestionNotification,
  sendTaskReminderNotification,
  getNotificationPreferences,
  saveNotificationPreferences,
  shouldSendNotification,
  NotificationPermission,
  NotificationPreferences,
  DesktopNotificationOptions,
} from '@/lib/desktopNotification';

/**
 * 桌面通知 Hook
 */
export function useDesktopNotification() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [preferences, setPreferences] = useState<NotificationPreferences>(getNotificationPreferences);
  const [loading, setLoading] = useState(true);

  // 初始化时检查权限
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const perm = await checkNotificationPermission();
        setPermission(perm);
      } catch (error) {
        console.error('Failed to check notification permission:', error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // 请求权限
  const requestPermission = useCallback(async () => {
    setLoading(true);
    try {
      const perm = await requestNotificationPermission();
      setPermission(perm);
      return perm === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // 发送通知
  const sendNotification = useCallback(async (options: DesktopNotificationOptions) => {
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return false;
    }
    return sendDesktopNotification(options);
  }, [permission]);

  // 发送日报通知
  const notifyReport = useCallback(async (
    type: 'morning' | 'evening',
    summary: string,
    date: string
  ) => {
    if (!shouldSendNotification('report')) return false;
    return sendReportNotification(type, summary, date);
  }, []);

  // 发送建议通知
  const notifySuggestion = useCallback(async (content: string, suggestionId: number) => {
    if (!shouldSendNotification('suggestion')) return false;
    return sendSuggestionNotification(content, suggestionId);
  }, []);

  // 发送任务提醒通知
  const notifyTaskReminder = useCallback(async (taskContent: string, taskId: number) => {
    if (!shouldSendNotification('task')) return false;
    return sendTaskReminderNotification(taskContent, taskId);
  }, []);

  // 更新偏好设置
  const updatePreferences = useCallback((updates: Partial<NotificationPreferences>) => {
    saveNotificationPreferences(updates);
    setPreferences(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    // 状态
    permission,
    preferences,
    loading,
    isGranted: permission === 'granted',
    
    // 方法
    requestPermission,
    sendNotification,
    notifyReport,
    notifySuggestion,
    notifyTaskReminder,
    updatePreferences,
  };
}

export default useDesktopNotification;
