/**
 * 提醒服务（增强版）
 * 整合提醒调度、AI 生成和行为分析
 */

import * as reminderDb from '../database/reminderService';
import { getGeminiClient } from '../ai/gemini';
import { getUpcomingTasks } from '../database/taskService';
import type { Reminder, CreateReminderInput, DbResult } from '../../types/database';

// 提醒检查间隔（毫秒）
const CHECK_INTERVAL = 60000; // 1 分钟

// 提醒回调类型
type ReminderCallback = (reminder: Reminder) => void;

// 提醒监听器
let reminderCallbacks: ReminderCallback[] = [];
let checkIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * 启动提醒调度器
 */
export function startReminderScheduler(): void {
  if (checkIntervalId) return;

  // 立即检查一次
  checkPendingReminders();

  // 定期检查
  checkIntervalId = setInterval(checkPendingReminders, CHECK_INTERVAL);
  console.log('提醒调度器已启动');
}

/**
 * 停止提醒调度器
 */
export function stopReminderScheduler(): void {
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
    console.log('提醒调度器已停止');
  }
}

/**
 * 注册提醒回调
 */
export function onReminder(callback: ReminderCallback): () => void {
  reminderCallbacks.push(callback);
  return () => {
    reminderCallbacks = reminderCallbacks.filter((cb) => cb !== callback);
  };
}

/**
 * 检查待发送的提醒
 */
async function checkPendingReminders(): Promise<void> {
  try {
    const result = await reminderDb.getPendingReminders();
    if (!result.success || !result.data) return;

    for (const reminder of result.data) {
      // 触发回调
      reminderCallbacks.forEach((cb) => cb(reminder));
      // 标记为已发送
      await reminderDb.markReminderAsSent(reminder.id);
    }
  } catch (error) {
    console.error('检查提醒失败:', error);
  }
}

/**
 * 创建提醒
 */
export async function createReminder(input: CreateReminderInput): Promise<DbResult<Reminder>> {
  return reminderDb.createReminder(input);
}

/**
 * 获取提醒列表
 */
export async function getReminders(options?: {
  status?: Reminder['status'];
  type?: Reminder['type'];
  limit?: number;
}): Promise<DbResult<Reminder[]>> {
  return reminderDb.getReminders(options);
}

/**
 * 忽略提醒
 */
export async function dismissReminder(id: string): Promise<DbResult<Reminder>> {
  return reminderDb.dismissReminder(id);
}

/**
 * 延迟提醒
 */
export async function snoozeReminder(id: string, minutes: number = 30): Promise<DbResult<Reminder>> {
  const newTime = new Date(Date.now() + minutes * 60000).toISOString();
  return reminderDb.snoozeReminder(id, newTime);
}

/**
 * 删除提醒
 */
export async function deleteReminder(id: string): Promise<DbResult<void>> {
  return reminderDb.deleteReminder(id);
}

/**
 * 基于任务生成提醒
 * 检查即将到期的任务并创建提醒
 */
export async function generateTaskReminders(): Promise<DbResult<Reminder[]>> {
  try {
    const tasksResult = await getUpcomingTasks(3); // 3 天内到期
    if (!tasksResult.success || !tasksResult.data) {
      return { success: true, data: [] };
    }

    const reminders: Reminder[] = [];

    for (const task of tasksResult.data) {
      if (!task.deadline) continue;

      const deadline = new Date(task.deadline);
      const now = new Date();
      const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      // 根据紧急程度设置提醒时间
      let scheduledAt: Date;
      let priority: Reminder['priority'] = 'medium';

      if (hoursUntilDeadline <= 2) {
        scheduledAt = now;
        priority = 'urgent';
      } else if (hoursUntilDeadline <= 24) {
        scheduledAt = new Date(deadline.getTime() - 2 * 60 * 60 * 1000); // 2 小时前
        priority = 'high';
      } else {
        scheduledAt = new Date(deadline.getTime() - 24 * 60 * 60 * 1000); // 1 天前
      }

      const result = await createReminder({
        type: 'task_deadline',
        title: `任务即将到期: ${task.title}`,
        message: `任务「${task.title}」将在 ${formatDeadline(deadline)} 到期`,
        priority,
        scheduledAt: scheduledAt.toISOString(),
        context: { taskId: task.id, deadline: task.deadline },
      });

      if (result.success && result.data) {
        reminders.push(result.data);
      }
    }

    return { success: true, data: reminders };
  } catch (error) {
    console.error('生成任务提醒失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '生成任务提醒失败',
    };
  }
}

/**
 * AI 生成智能提醒
 * 基于用户行为和上下文生成个性化提醒
 */
export async function generateSmartReminder(
  context: string,
  type: Reminder['type'] = 'habit_reminder'
): Promise<DbResult<Reminder>> {
  try {
    const client = getGeminiClient();

    const prompt = `基于以下上下文，生成一条友好的提醒消息：

上下文：${context}

请以 JSON 格式返回：
{
  "title": "简短的提醒标题",
  "message": "友好、鼓励性的提醒内容",
  "priority": "low/medium/high",
  "delayMinutes": 提醒延迟分钟数（0-60）
}

只返回 JSON，不要其他内容。`;

    const response = await client.generateContent(prompt, {
      generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: '无法解析 AI 响应' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const scheduledAt = new Date(Date.now() + (parsed.delayMinutes || 0) * 60000);

    return createReminder({
      type,
      title: parsed.title,
      message: parsed.message,
      priority: parsed.priority || 'medium',
      scheduledAt: scheduledAt.toISOString(),
      context: { source: 'ai', originalContext: context },
    });
  } catch (error) {
    console.error('AI 生成提醒失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI 生成提醒失败',
    };
  }
}

/**
 * 格式化截止日期
 */
function formatDeadline(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 0) return '已过期';
  if (hours < 1) return '不到 1 小时';
  if (hours < 24) return `${hours} 小时后`;
  if (days === 1) return '明天';
  return `${days} 天后`;
}

// 重新导出类型
export type { Reminder, CreateReminderInput };
