/**
 * 笔记服务
 * 处理笔记的 CRUD 操作
 */

import { query, execute, generateId, getCurrentTimestamp } from './index';
import { khojSyncService } from '../sync/khojSync';
import type { Note, CreateNoteInput, UpdateNoteInput, DbResult } from '../../types/database';

// 数据库行类型（SQLite 返回的原始数据）
interface NoteRow {
  id: string;
  content: string;
  type: string;
  domain: string;
  tags: string;
  memory_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 将数据库行转换为 Note 对象
 */
function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    content: row.content,
    type: row.type as Note['type'],
    domain: row.domain as Note['domain'],
    tags: JSON.parse(row.tags || '[]'),
    memoryId: row.memory_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 创建笔记
 */
export async function createNote(input: CreateNoteInput): Promise<DbResult<Note>> {
  // 验证内容不为空
  const trimmedContent = input.content?.trim();
  if (!trimmedContent) {
    return {
      success: false,
      error: '笔记内容不能为空',
    };
  }

  const id = generateId();
  const now = getCurrentTimestamp();
  const tags = JSON.stringify(input.tags || []);

  try {
    await execute(
      `INSERT INTO notes (id, content, type, domain, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        trimmedContent,
        input.type || 'text',
        input.domain || 'general',
        tags,
        now,
        now,
      ]
    );

    const note: Note = {
      id,
      content: trimmedContent,
      type: input.type || 'text',
      domain: input.domain || 'general',
      tags: input.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    // 异步同步到 Khoj（不阻塞返回）
    khojSyncService.syncNote(note, 'create').catch(err => {
      console.warn('Khoj 同步失败:', err);
    });

    return { success: true, data: note };
  } catch (error) {
    console.error('创建笔记失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '创建笔记失败',
    };
  }
}

/**
 * 获取笔记列表
 */
export async function getNotes(options?: {
  domain?: Note['domain'];
  limit?: number;
  offset?: number;
}): Promise<DbResult<Note[]>> {
  try {
    let sql = 'SELECT * FROM notes';
    const params: unknown[] = [];
    
    if (options?.domain) {
      sql += ' WHERE domain = $1';
      params.push(options.domain);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    
    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    const rows = await query<NoteRow>(sql, params);
    const notes = rows.map(rowToNote);

    return { success: true, data: notes };
  } catch (error) {
    console.error('获取笔记列表失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取笔记列表失败',
    };
  }
}

/**
 * 根据 ID 获取笔记
 */
export async function getNoteById(id: string): Promise<DbResult<Note>> {
  try {
    const rows = await query<NoteRow>(
      'SELECT * FROM notes WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return {
        success: false,
        error: '笔记不存在',
      };
    }

    return { success: true, data: rowToNote(rows[0]) };
  } catch (error) {
    console.error('获取笔记失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取笔记失败',
    };
  }
}

/**
 * 更新笔记
 */
export async function updateNote(id: string, input: UpdateNoteInput): Promise<DbResult<Note>> {
  // 验证内容不为空（如果提供了内容）
  if (input.content !== undefined) {
    const trimmedContent = input.content?.trim();
    if (!trimmedContent) {
      return {
        success: false,
        error: '笔记内容不能为空',
      };
    }
    input.content = trimmedContent;
  }

  try {
    // 先检查笔记是否存在
    const existing = await getNoteById(id);
    if (!existing.success || !existing.data) {
      return {
        success: false,
        error: '笔记不存在',
      };
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (input.content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      params.push(input.content);
    }
    if (input.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      params.push(input.type);
    }
    if (input.domain !== undefined) {
      updates.push(`domain = $${paramIndex++}`);
      params.push(input.domain);
    }
    if (input.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      params.push(JSON.stringify(input.tags));
    }

    if (updates.length === 0) {
      return { success: true, data: existing.data };
    }

    const now = getCurrentTimestamp();
    updates.push(`updated_at = $${paramIndex++}`);
    params.push(now);
    params.push(id);

    await execute(
      `UPDATE notes SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    // 返回更新后的笔记
    const result = await getNoteById(id);
    
    // 异步同步到 Khoj
    if (result.success && result.data) {
      khojSyncService.syncNote(result.data, 'update').catch(err => {
        console.warn('Khoj 同步失败:', err);
      });
    }
    
    return result;
  } catch (error) {
    console.error('更新笔记失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新笔记失败',
    };
  }
}

/**
 * 删除笔记
 */
export async function deleteNote(id: string): Promise<DbResult<void>> {
  try {
    // 先获取笔记信息用于同步
    const noteResult = await getNoteById(id);
    
    const result = await execute('DELETE FROM notes WHERE id = $1', [id]);

    if (result.rowsAffected === 0) {
      return {
        success: false,
        error: '笔记不存在',
      };
    }

    // 异步同步删除到 Khoj
    if (noteResult.success && noteResult.data) {
      khojSyncService.syncNote(noteResult.data, 'delete').catch(err => {
        console.warn('Khoj 同步删除失败:', err);
      });
    }

    return { success: true };
  } catch (error) {
    console.error('删除笔记失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除笔记失败',
    };
  }
}

/**
 * 搜索笔记（简单文本搜索）
 */
export async function searchNotes(keyword: string): Promise<DbResult<Note[]>> {
  try {
    const rows = await query<NoteRow>(
      `SELECT * FROM notes WHERE content LIKE $1 ORDER BY created_at DESC`,
      [`%${keyword}%`]
    );

    const notes = rows.map(rowToNote);
    return { success: true, data: notes };
  } catch (error) {
    console.error('搜索笔记失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '搜索笔记失败',
    };
  }
}

/**
 * 获取笔记数量
 */
export async function getNotesCount(domain?: Note['domain']): Promise<DbResult<number>> {
  try {
    let sql = 'SELECT COUNT(*) as count FROM notes';
    const params: unknown[] = [];
    
    if (domain) {
      sql += ' WHERE domain = $1';
      params.push(domain);
    }

    const rows = await query<{ count: number }>(sql, params);
    return { success: true, data: rows[0]?.count || 0 };
  } catch (error) {
    console.error('获取笔记数量失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取笔记数量失败',
    };
  }
}
