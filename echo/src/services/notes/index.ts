/**
 * 笔记服务（增强版）
 * 整合数据库操作和记忆系统
 */

import * as noteDb from '../database/noteService';
import { extractMemoryFromNote, deleteMemoryBySource, searchMemories } from '../memory';
import type { Note, CreateNoteInput, UpdateNoteInput, DbResult, LifeDomain } from '../../types/database';

/**
 * 创建笔记并提取记忆
 */
export async function createNote(input: CreateNoteInput): Promise<DbResult<Note>> {
  // 创建笔记
  const result = await noteDb.createNote(input);
  
  if (result.success && result.data) {
    // 异步提取记忆（不阻塞主流程）
    extractMemoryFromNote(result.data).catch(err => {
      console.warn('提取笔记记忆失败:', err);
    });
  }
  
  return result;
}

/**
 * 获取笔记列表
 */
export async function getNotes(options?: {
  domain?: LifeDomain;
  limit?: number;
  offset?: number;
}): Promise<DbResult<Note[]>> {
  return noteDb.getNotes(options);
}

/**
 * 根据 ID 获取笔记
 */
export async function getNoteById(id: string): Promise<DbResult<Note>> {
  return noteDb.getNoteById(id);
}

/**
 * 更新笔记
 */
export async function updateNote(id: string, input: UpdateNoteInput): Promise<DbResult<Note>> {
  const result = await noteDb.updateNote(id, input);
  
  // 如果内容更新了，重新提取记忆
  if (result.success && result.data && input.content) {
    // 删除旧记忆
    await deleteMemoryBySource('note', id);
    // 提取新记忆
    extractMemoryFromNote(result.data).catch(err => {
      console.warn('更新笔记记忆失败:', err);
    });
  }
  
  return result;
}

/**
 * 删除笔记
 */
export async function deleteNote(id: string): Promise<DbResult<void>> {
  const result = await noteDb.deleteNote(id);
  
  if (result.success) {
    // 删除关联的记忆
    await deleteMemoryBySource('note', id);
  }
  
  return result;
}

/**
 * 搜索笔记（简单文本搜索）
 */
export async function searchNotes(keyword: string): Promise<DbResult<Note[]>> {
  return noteDb.searchNotes(keyword);
}

/**
 * 语义搜索笔记
 * 使用 AI 理解查询意图
 */
export async function semanticSearchNotes(
  query: string,
  options?: { domain?: LifeDomain; limit?: number }
): Promise<DbResult<Note[]>> {
  try {
    // 使用记忆系统进行语义搜索
    const memoryResults = await searchMemories(query, {
      domain: options?.domain,
      limit: options?.limit || 10,
    });
    
    // 过滤出笔记类型的记忆
    const noteIds = memoryResults
      .filter(r => r.item.sourceType === 'note')
      .map(r => r.item.sourceId);
    
    if (noteIds.length === 0) {
      return { success: true, data: [] };
    }
    
    // 获取对应的笔记
    const notes: Note[] = [];
    for (const id of noteIds) {
      const result = await noteDb.getNoteById(id);
      if (result.success && result.data) {
        notes.push(result.data);
      }
    }
    
    return { success: true, data: notes };
  } catch (error) {
    console.error('语义搜索笔记失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '语义搜索失败',
    };
  }
}

/**
 * 获取笔记数量
 */
export async function getNotesCount(domain?: LifeDomain): Promise<DbResult<number>> {
  return noteDb.getNotesCount(domain);
}

/**
 * 获取最近的笔记
 */
export async function getRecentNotes(limit: number = 10): Promise<DbResult<Note[]>> {
  return noteDb.getNotes({ limit });
}

/**
 * 按领域获取笔记统计
 */
export async function getNoteStatsByDomain(): Promise<DbResult<Record<LifeDomain, number>>> {
  const domains: LifeDomain[] = ['work', 'investment', 'development', 'learning', 'family', 'health', 'entertainment', 'general'];
  const stats: Record<string, number> = {};
  
  for (const domain of domains) {
    const result = await noteDb.getNotesCount(domain);
    if (result.success) {
      stats[domain] = result.data || 0;
    }
  }
  
  return { success: true, data: stats as Record<LifeDomain, number> };
}

// 重新导出类型
export type { Note, CreateNoteInput, UpdateNoteInput };
