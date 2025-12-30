/**
 * 提醒服务
 * 处理提醒的 CRUD 操作
 */

import { query, execute, generateId, getCurrentTimestamp } from './index';
import type { Reminder, CreateReminderInput, DbResult } from '../../types/database';

// 数据库行类型
interface ReminderRow {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  scheduled_at: string;
  status: string;
  context: string;
  created_at: string;
}

/**
 * 将数据库行转换为 Reminder 对象
 */
function rowToReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    type: row.type as Reminder['type'],
    title: row.title,
    message: row.message,
    priority: row.priority as Reminder['priority'],
    scheduledAt: row.scheduled_at,
    status: row.status as Reminder['status'],
    context: JSON.parse(row.context || '{}'),
    createdAt: row.created_at,
  };
}

/**
 * 创建提醒
 */
export async function createReminder(input: CreateReminderInput): Promise<DbResult<Reminder>> {
  const id = generateId();
  const now = getCurrentTimestamp();
  const context = JSON.stringify(input.context || {});

  try {
    await execute(
      `INSERT INTO reminders (id, type, title, message, priority, scheduled_at, status, context, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        input.type,
        input.title,
        input.message,
        input.priority || 'medium',
        input.scheduledAt,
        'pending',
        context,
        now,
      ]
    );

    const reminder: Reminder = {
      id,
      type: input.type,
      title: input.title,
      message: input.message,
      priority: input.priority || 'medium',
      scheduledAt: input.scheduledAt,
      status: 'pending',
      context: input.context || {},
      createdAt: now,
    };

    return { success: true, data: reminder };
  } catch (error) {
    console.error('创建提醒失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '创建提醒失败',
    };
  }
}

/**
 * 获取待发送的提醒
 */
export async function getPendingReminders(): Promise<DbResult<Reminder[]>> {
  try {
    const now = getCurrentTimestamp();
    const rows = await query<ReminderRow>(
      `SELECT * FROM reminders 
       WHERE status = 'pending' AND scheduled_at <= $1
       ORDER BY scheduled_at ASC`,
      [now]
    );

    const reminders = rows.map(rowToReminder);
    return { success: true, data: reminders };
  } catch (error) {
    console.error('获取待发送提醒失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取待发送提醒失败',
    };
  }
}

/**
 * 获取所有提醒
 */
export async function getReminders(options?: {
  status?: Reminder['status'];
  type?: Reminder['type'];
  limit?: number;
}): Promise<DbResult<Reminder[]>> {
  try {
    let sql = 'SELECT * FROM reminders';
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }
    if (options?.type) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(options.type);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY scheduled_at DESC';

    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }

    const rows = await query<ReminderRow>(sql, params);
    const reminders = rows.map(rowToReminder);

    return { success: true, data: reminders };
  } catch (error) {
    console.error('获取提醒列表失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取提醒列表失败',
    };
  }
}

/**
 * 更新提醒状态
 */
export async function updateReminderStatus(
  id: string,
  status: Reminder['status']
): Promise<DbResult<Reminder>> {
  try {
    const result = await execute(
      'UPDATE reminders SET status = $1 WHERE id = $2',
      [status, id]
    );

    if (result.rowsAffected === 0) {
      return {
        success: false,
        error: '提醒不存在',
      };
    }

    // 返回更新后的提醒
    const rows = await query<ReminderRow>(
      'SELECT * FROM reminders WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return {
        success: false,
        error: '提醒不存在',
      };
    }

    return { success: true, data: rowToReminder(rows[0]) };
  } catch (error) {
    console.error('更新提醒状态失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新提醒状态失败',
    };
  }
}

/**
 * 删除提醒
 */
export async function deleteReminder(id: string): Promise<DbResult<void>> {
  try {
    const result = await execute('DELETE FROM reminders WHERE id = $1', [id]);

    if (result.rowsAffected === 0) {
      return {
        success: false,
        error: '提醒不存在',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('删除提醒失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除提醒失败',
    };
  }
}

/**
 * 标记提醒为已发送
 */
export async function markReminderAsSent(id: string): Promise<DbResult<Reminder>> {
  return updateReminderStatus(id, 'sent');
}

/**
 * 标记提醒为已忽略
 */
export async function dismissReminder(id: string): Promise<DbResult<Reminder>> {
  return updateReminderStatus(id, 'dismissed');
}

/**
 * 延迟提醒
 */
export async function snoozeReminder(
  id: string,
  newScheduledAt: string
): Promise<DbResult<Reminder>> {
  try {
    const result = await execute(
      'UPDATE reminders SET status = $1, scheduled_at = $2 WHERE id = $3',
      ['pending', newScheduledAt, id]
    );

    if (result.rowsAffected === 0) {
      return {
        success: false,
        error: '提醒不存在',
      };
    }

    // 返回更新后的提醒
    const rows = await query<ReminderRow>(
      'SELECT * FROM reminders WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return {
        success: false,
        error: '提醒不存在',
      };
    }

    return { success: true, data: rowToReminder(rows[0]) };
  } catch (error) {
    console.error('延迟提醒失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '延迟提醒失败',
    };
  }
}
