/**
 * Echo v3.2: 桌面通知服务
 * 使用 Web Notification API 发送桌面通知
 * 支持 macOS、Windows、Linux 桌面平台和浏览器
 * 
 * 注意: Tauri notification plugin 未安装，使用 Web API 作为主要实现
 * 如需原生通知，可安装 @tauri-apps/plugin-notification
 */

import { isInTauri, isDesktop } from './tauriHelper';

// 通知选项接口
export interface DesktopNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  actionUrl?: string;  // 点击通知后跳转的 URL
  tag?: string;        // 通知标签，用于替换同类通知
  silent?: boolean;    // 是否静音
}

// 通知权限状态
export type NotificationPermission = 'granted' | 'denied' | 'default';

/**
 * 检查通知权限
 */
export async function checkNotificationPermission(): Promise<NotificationPermission> {
  // Web 环境 (包括 Tauri WebView)
  if ('Notification' in window) {
    return Notification.permission as NotificationPermission;
  }

  return 'denied';
}

/**
 * 请求通知权限
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  // Web 环境 (包括 Tauri WebView)
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermission;
  }

  return 'denied';
}

/**
 * 发送桌面通知
 */
export async function sendDesktopNotification(options: DesktopNotificationOptions): Promise<boolean> {
  const { title, body, icon, actionUrl, tag, silent } = options;

  // 检查权限
  const permission = await checkNotificationPermission();
  if (permission !== 'granted') {
    console.warn('Notification permission not granted');
    return false;
  }

  // 使用 Web Notification API
  if ('Notification' in window) {
    try {
      const notification = new Notification(title, {
        body,
        icon: icon || '/icon.png',
        tag,
        silent,
      });

      // 点击通知时跳转
      if (actionUrl) {
        notification.onclick = () => {
          window.focus();
          // 使用 history API 或直接跳转
          if (actionUrl.startsWith('/')) {
            window.location.href = actionUrl;
          } else {
            window.open(actionUrl, '_blank');
          }
        };
      }

      // 自动关闭通知 (5秒后)
      setTimeout(() => notification.close(), 5000);

      return true;
    } catch (error) {
      console.error('Failed to send web notification:', error);
      return false;
    }
  }

  return false;
}

/**
 * 发送日报通知
 */
export async function sendReportNotification(
  type: 'morning' | 'evening',
  summary: string,
  date: string
): Promise<boolean> {
  const title = type === 'morning' ? '☀️ 早报已生成' : '🌙 晚报已生成';
  const actionUrl = `/daily-report/${type}/${date}`;

  return sendDesktopNotification({
    title,
    body: summary.slice(0, 100),
    actionUrl,
    tag: `daily-report-${type}`,
  });
}

/**
 * 发送建议通知
 */
export async function sendSuggestionNotification(
  content: string,
  suggestionId: number
): Promise<boolean> {
  return sendDesktopNotification({
    title: '💡 新建议',
    body: content.slice(0, 100),
    actionUrl: `/suggestions?highlight=${suggestionId}`,
    tag: 'suggestion',
  });
}

/**
 * 发送任务提醒通知
 */
export async function sendTaskReminderNotification(
  taskContent: string,
  taskId: number
): Promise<boolean> {
  return sendDesktopNotification({
    title: '⏰ 任务提醒',
    body: taskContent.slice(0, 100),
    actionUrl: `/notes?task=${taskId}`,
    tag: `task-reminder-${taskId}`,
  });
}

/**
 * 通知偏好设置
 */
export interface NotificationPreferences {
  enabled: boolean;
  reportNotifications: boolean;
  suggestionNotifications: boolean;
  taskReminders: boolean;
  soundEnabled: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  reportNotifications: true,
  suggestionNotifications: true,
  taskReminders: true,
  soundEnabled: true,
};

/**
 * 获取通知偏好设置
 */
export function getNotificationPreferences(): NotificationPreferences {
  try {
    const stored = localStorage.getItem('notification_preferences');
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.warn('Failed to load notification preferences:', error);
  }
  return DEFAULT_PREFERENCES;
}

/**
 * 保存通知偏好设置
 */
export function saveNotificationPreferences(preferences: Partial<NotificationPreferences>): void {
  try {
    const current = getNotificationPreferences();
    const updated = { ...current, ...preferences };
    localStorage.setItem('notification_preferences', JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save notification preferences:', error);
  }
}

/**
 * 检查是否应该发送特定类型的通知
 */
export function shouldSendNotification(type: 'report' | 'suggestion' | 'task'): boolean {
  const prefs = getNotificationPreferences();
  
  if (!prefs.enabled) return false;

  switch (type) {
    case 'report':
      return prefs.reportNotifications;
    case 'suggestion':
      return prefs.suggestionNotifications;
    case 'task':
      return prefs.taskReminders;
    default:
      return true;
  }
}
