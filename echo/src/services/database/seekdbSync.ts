/**
 * SeekDB 同步服务
 * 将 SQLite 数据同步到 SeekDB，实现向量搜索能力
 */

import { seekdbService } from './seekdbService';
import type { Note, Task } from '../../types/database';

// ============== 同步状态 ==============

let isSeekDBAvailable = false;

/**
 * 检查 SeekDB 是否可用
 */
export async function checkSeekDBAvailable(): Promise<boolean> {
  try {
    isSeekDBAvailable = await seekdbService.healthCheck();
    return isSeekDBAvailable;
  } catch {
    isSeekDBAvailable = false;
    return false;
  }
}

/**
 * 获取 SeekDB 可用状态
 */
export function getSeekDBStatus(): boolean {
  return isSeekDBAvailable;
}

// ============== 笔记同步 ==============

/**
 * 同步笔记到 SeekDB
 */
export async function syncNoteToSeekDB(note: Note): Promise<boolean> {
  if (!isSeekDBAvailable) {
    console.warn('[SeekDB] 服务不可用，跳过同步');
    return false;
  }

  try {
    await seekdbService.createNote({
      id: note.id,
      content: note.content,
      domain: note.domain,
      tags: note.tags || [],
      createdAt: note.createdAt,
    });
    return true;
  } catch (error) {
    console.error('[SeekDB] 同步笔记失败:', error);
    return false;
  }
}

/**
 * 更新 SeekDB 中的笔记
 */
export async function updateNoteInSeekDB(note: Note): Promise<boolean> {
  if (!isSeekDBAvailable) {
    return false;
  }

  try {
    await seekdbService.updateNote(note.id, {
      content: note.content,
      domain: note.domain,
      tags: note.tags,
    });
    return true;
  } catch (error) {
    console.error('[SeekDB] 更新笔记失败:', error);
    return false;
  }
}

/**
 * 从 SeekDB 删除笔记
 */
export async function deleteNoteFromSeekDB(noteId: string): Promise<boolean> {
  if (!isSeekDBAvailable) {
    return false;
  }

  try {
    return await seekdbService.deleteNote(noteId);
  } catch (error) {
    console.error('[SeekDB] 删除笔记失败:', error);
    return false;
  }
}

// ============== 任务同步 ==============

/**
 * 同步任务到 SeekDB
 */
export async function syncTaskToSeekDB(task: Task): Promise<boolean> {
  if (!isSeekDBAvailable) {
    return false;
  }

  try {
    await seekdbService.createTask({
      id: task.id,
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      status: task.status,
      deadline: task.deadline,
      domain: task.domain,
      createdAt: task.createdAt,
    });
    return true;
  } catch (error) {
    console.error('[SeekDB] 同步任务失败:', error);
    return false;
  }
}

/**
 * 更新 SeekDB 中的任务
 */
export async function updateTaskInSeekDB(task: Task): Promise<boolean> {
  if (!isSeekDBAvailable) {
    return false;
  }

  try {
    await seekdbService.updateTask(task.id, {
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      deadline: task.deadline,
      domain: task.domain,
      completedAt: task.completedAt,
    });
    return true;
  } catch (error) {
    console.error('[SeekDB] 更新任务失败:', error);
    return false;
  }
}

/**
 * 从 SeekDB 删除任务
 */
export async function deleteTaskFromSeekDB(taskId: string): Promise<boolean> {
  if (!isSeekDBAvailable) {
    return false;
  }

  try {
    return await seekdbService.deleteTask(taskId);
  } catch (error) {
    console.error('[SeekDB] 删除任务失败:', error);
    return false;
  }
}

// ============== 语义搜索 ==============

/**
 * 语义搜索笔记
 */
export async function semanticSearchNotes(
  query: string,
  options?: { limit?: number; domain?: string }
): Promise<Array<{ id: string; content: string; score: number }>> {
  if (!isSeekDBAvailable) {
    console.warn('[SeekDB] 服务不可用，无法执行语义搜索');
    return [];
  }

  try {
    const results = await seekdbService.search({
      query,
      collection: 'notes',
      limit: options?.limit || 10,
      domain: options?.domain,
      searchType: 'hybrid',
    });

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      score: r.score,
    }));
  } catch (error) {
    console.error('[SeekDB] 语义搜索失败:', error);
    return [];
  }
}

/**
 * 语义搜索任务
 */
export async function semanticSearchTasks(
  query: string,
  options?: { limit?: number; status?: string }
): Promise<Array<{ id: string; content: string; score: number }>> {
  if (!isSeekDBAvailable) {
    return [];
  }

  try {
    const results = await seekdbService.search({
      query,
      collection: 'tasks',
      limit: options?.limit || 10,
      searchType: 'hybrid',
    });

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      score: r.score,
    }));
  } catch (error) {
    console.error('[SeekDB] 语义搜索任务失败:', error);
    return [];
  }
}

/**
 * 语义搜索记忆
 */
export async function semanticSearchMemories(
  query: string,
  options?: { limit?: number; domain?: string }
): Promise<Array<{ id: string; content: string; score: number }>> {
  if (!isSeekDBAvailable) {
    return [];
  }

  try {
    const results = await seekdbService.search({
      query,
      collection: 'memories',
      limit: options?.limit || 10,
      domain: options?.domain,
      searchType: 'hybrid',
    });

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      score: r.score,
    }));
  } catch (error) {
    console.error('[SeekDB] 语义搜索记忆失败:', error);
    return [];
  }
}

// ============== 初始化 ==============

/**
 * 初始化 SeekDB 同步服务
 */
export async function initSeekDBSync(): Promise<boolean> {
  console.log('[SeekDB] 正在检查服务可用性...');
  const available = await checkSeekDBAvailable();
  
  if (available) {
    console.log('[SeekDB] 服务已连接，语义搜索功能已启用');
  } else {
    console.warn('[SeekDB] 服务不可用，语义搜索功能已禁用');
  }
  
  return available;
}
