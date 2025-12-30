/**
 * 提醒 Hook
 * 管理提醒状态和实时通知
 */

import * as React from "react";
import {
  startReminderScheduler,
  stopReminderScheduler,
  onReminder,
  getReminders,
  dismissReminder,
  snoozeReminder,
} from "@/services/reminder";
import type { Reminder } from "@/types/database";

interface UseRemindersReturn {
  reminders: Reminder[];
  activeReminder: Reminder | null;
  isLoading: boolean;
  dismissActiveReminder: () => Promise<void>;
  snoozeActiveReminder: (minutes?: number) => Promise<void>;
  refreshReminders: () => Promise<void>;
}

export function useReminders(): UseRemindersReturn {
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [activeReminder, setActiveReminder] = React.useState<Reminder | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // 加载提醒列表
  const refreshReminders = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getReminders({ status: "pending", limit: 50 });
      if (result.success && result.data) {
        setReminders(result.data);
      }
    } catch (error) {
      console.error("加载提醒失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化
  React.useEffect(() => {
    refreshReminders();

    // 启动调度器
    startReminderScheduler();

    // 监听新提醒
    const unsubscribe = onReminder((reminder) => {
      setActiveReminder(reminder);
      // 从列表中移除
      setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
    });

    return () => {
      stopReminderScheduler();
      unsubscribe();
    };
  }, [refreshReminders]);

  // 忽略当前提醒
  const dismissActiveReminder = React.useCallback(async () => {
    if (!activeReminder) return;
    await dismissReminder(activeReminder.id);
    setActiveReminder(null);
  }, [activeReminder]);

  // 延迟当前提醒
  const snoozeActiveReminder = React.useCallback(
    async (minutes: number = 30) => {
      if (!activeReminder) return;
      const result = await snoozeReminder(activeReminder.id, minutes);
      if (result.success && result.data) {
        setReminders((prev) => [...prev, result.data!]);
      }
      setActiveReminder(null);
    },
    [activeReminder]
  );

  return {
    reminders,
    activeReminder,
    isLoading,
    dismissActiveReminder,
    snoozeActiveReminder,
    refreshReminders,
  };
}
