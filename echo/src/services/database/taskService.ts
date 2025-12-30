/**
 * 任务服务
 * 处理任务的 CRUD 操作
 */

import { query, execute, generateId, getCurrentTimestamp } from './index';
import { khojSyncService } from '../sync/khojSync';
import type { Task, CreateTaskInput, UpdateTaskInput, DbResult } from '../../types/database';

// 数据库行类型
interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  deadline: string | null;
  domain: string;
  assignee_id: string | null;
  parent_id: string | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * 将数据库行转换为 Task 对象
 */
function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    priority: row.priority as Task['priority'],
    status: row.status as Task['status'],
    deadline: row.deadline ?? undefined,
    domain: row.domain as Task['domain'],
    assigneeId: row.assignee_id ?? undefined,
    parentId: row.parent_id ?? undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
  };
}

/**
 * 创建任务
 */
export async function createTask(input: CreateTaskInput): Promise<DbResult<Task>> {
  // 验证标题不为空
  const trimmedTitle = input.title?.trim();
  if (!trimmedTitle) {
    return {
      success: false,
      error: '任务标题不能为空',
    };
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  try {
    await execute(
      `INSERT INTO tasks (id, title, description, priority, status, deadline, domain, assignee_id, parent_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        trimmedTitle,
        input.description || null,
        input.priority || 'medium', // 默认优先级为 medium
        'pending',
        input.deadline || null,
        input.domain || 'general',
        input.assigneeId || null,
        input.parentId || null,
        now,
      ]
    );

    const task: Task = {
      id,
      title: trimmedTitle,
      description: input.description,
      priority: input.priority || 'medium',
      status: 'pending',
      deadline: input.deadline,
      domain: input.domain || 'general',
      assigneeId: input.assigneeId,
      parentId: input.parentId,
      createdAt: now,
    };

    // 异步同步到 Khoj（不阻塞返回）
    khojSyncService.syncTask(task, 'create').catch(err => {
      console.warn('Khoj 同步失败:', err);
    });

    return { success: true, data: task };
  } catch (error) {
    console.error('创建任务失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '创建任务失败',
    };
  }
}

/**
 * 获取任务列表
 */
export async function getTasks(options?: {
  status?: Task['status'];
  priority?: Task['priority'];
  domain?: Task['domain'];
  limit?: number;
  offset?: number;
}): Promise<DbResult<Task[]>> {
  try {
    let sql = 'SELECT * FROM tasks';
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }
    if (options?.priority) {
      conditions.push(`priority = $${paramIndex++}`);
      params.push(options.priority);
    }
    if (options?.domain) {
      conditions.push(`domain = $${paramIndex++}`);
      params.push(options.domain);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    // 按优先级和截止日期排序
    sql += ` ORDER BY 
      CASE priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END,
      CASE WHEN deadline IS NULL THEN 1 ELSE 0 END,
      deadline ASC,
      created_at DESC`;

    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    const rows = await query<TaskRow>(sql, params);
    const tasks = rows.map(rowToTask);

    return { success: true, data: tasks };
  } catch (error) {
    console.error('获取任务列表失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取任务列表失败',
    };
  }
}

/**
 * 根据 ID 获取任务
 */
export async function getTaskById(id: string): Promise<DbResult<Task>> {
  try {
    const rows = await query<TaskRow>(
      'SELECT * FROM tasks WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return {
        success: false,
        error: '任务不存在',
      };
    }

    return { success: true, data: rowToTask(rows[0]) };
  } catch (error) {
    console.error('获取任务失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取任务失败',
    };
  }
}

/**
 * 更新任务
 */
export async function updateTask(id: string, input: UpdateTaskInput): Promise<DbResult<Task>> {
  // 验证标题不为空（如果提供了标题）
  if (input.title !== undefined) {
    const trimmedTitle = input.title?.trim();
    if (!trimmedTitle) {
      return {
        success: false,
        error: '任务标题不能为空',
      };
    }
    input.title = trimmedTitle;
  }

  try {
    // 先检查任务是否存在
    const existing = await getTaskById(id);
    if (!existing.success || !existing.data) {
      return {
        success: false,
        error: '任务不存在',
      };
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(input.description);
    }
    if (input.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      params.push(input.priority);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(input.status);
      
      // 如果状态变为 completed，记录完成时间
      if (input.status === 'completed' && existing.data.status !== 'completed') {
        updates.push(`completed_at = $${paramIndex++}`);
        params.push(getCurrentTimestamp());
      }
      // 如果状态从 completed 变为其他，清除完成时间
      if (input.status !== 'completed' && existing.data.status === 'completed') {
        updates.push(`completed_at = $${paramIndex++}`);
        params.push(null);
      }
    }
    if (input.deadline !== undefined) {
      updates.push(`deadline = $${paramIndex++}`);
      params.push(input.deadline);
    }
    if (input.domain !== undefined) {
      updates.push(`domain = $${paramIndex++}`);
      params.push(input.domain);
    }
    if (input.assigneeId !== undefined) {
      updates.push(`assignee_id = $${paramIndex++}`);
      params.push(input.assigneeId);
    }

    if (updates.length === 0) {
      return { success: true, data: existing.data };
    }

    params.push(id);

    await execute(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    // 返回更新后的任务
    const result = await getTaskById(id);
    
    // 异步同步到 Khoj
    if (result.success && result.data) {
      khojSyncService.syncTask(result.data, 'update').catch(err => {
        console.warn('Khoj 同步失败:', err);
      });
    }
    
    return result;
  } catch (error) {
    console.error('更新任务失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新任务失败',
    };
  }
}

/**
 * 完成任务
 */
export async function completeTask(id: string): Promise<DbResult<Task>> {
  return updateTask(id, { status: 'completed' });
}

/**
 * 删除任务
 */
export async function deleteTask(id: string): Promise<DbResult<void>> {
  try {
    // 先获取任务信息用于同步
    const taskResult = await getTaskById(id);
    
    const result = await execute('DELETE FROM tasks WHERE id = $1', [id]);

    if (result.rowsAffected === 0) {
      return {
        success: false,
        error: '任务不存在',
      };
    }

    // 异步同步删除到 Khoj
    if (taskResult.success && taskResult.data) {
      khojSyncService.syncTask(taskResult.data, 'delete').catch(err => {
        console.warn('Khoj 同步删除失败:', err);
      });
    }

    return { success: true };
  } catch (error) {
    console.error('删除任务失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除任务失败',
    };
  }
}

/**
 * 获取任务数量
 */
export async function getTasksCount(options?: {
  status?: Task['status'];
  domain?: Task['domain'];
}): Promise<DbResult<number>> {
  try {
    let sql = 'SELECT COUNT(*) as count FROM tasks';
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }
    if (options?.domain) {
      conditions.push(`domain = $${paramIndex++}`);
      params.push(options.domain);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    const rows = await query<{ count: number }>(sql, params);
    return { success: true, data: rows[0]?.count || 0 };
  } catch (error) {
    console.error('获取任务数量失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取任务数量失败',
    };
  }
}

/**
 * 获取即将到期的任务
 */
export async function getUpcomingTasks(days: number = 7): Promise<DbResult<Task[]>> {
  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    const rows = await query<TaskRow>(
      `SELECT * FROM tasks 
       WHERE status IN ('pending', 'in_progress') 
         AND deadline IS NOT NULL 
         AND deadline <= $1
       ORDER BY deadline ASC`,
      [futureDate.toISOString()]
    );

    const tasks = rows.map(rowToTask);
    return { success: true, data: tasks };
  } catch (error) {
    console.error('获取即将到期任务失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取即将到期任务失败',
    };
  }
}
