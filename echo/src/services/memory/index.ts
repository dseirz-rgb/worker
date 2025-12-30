/**
 * AI 记忆服务
 * 基于 Gemini API 实现记忆提取、组织和检索
 * 
 * 设计原则：
 * 1. 记忆优先 - 所有用户活动都被记忆系统捕获和组织
 * 2. 语义理解 - 使用 AI 理解内容含义，而非简单关键词匹配
 * 3. 本地存储 - 记忆数据存储在本地 SQLite，保证隐私
 */

import { initGeminiClient, getGeminiClient } from '../ai/gemini';
import { query, execute, generateId, getCurrentTimestamp } from '../database';
import type { Note, Task, LifeDomain } from '../../types/database';

// 记忆项类型
export interface MemoryItem {
  id: string;
  summary: string;
  category: string;
  sourceType: 'note' | 'task' | 'conversation' | 'activity';
  sourceId: string;
  keywords: string[];
  domain: LifeDomain;
  createdAt: string;
}

// 记忆检索结果
export interface MemorySearchResult {
  item: MemoryItem;
  relevance: number;
}

// 数据库行类型
interface MemoryRow {
  id: string;
  summary: string;
  category: string;
  source_type: string;
  source_id: string;
  keywords: string;
  domain: string;
  created_at: string;
}

/**
 * 初始化记忆系统
 * 创建记忆表（如果不存在）
 */
export async function initMemorySystem(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY NOT NULL,
      summary TEXT NOT NULL,
      category TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      keywords TEXT DEFAULT '[]',
      domain TEXT NOT NULL DEFAULT 'general',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_memories_source ON memories(source_type, source_id);
    CREATE INDEX IF NOT EXISTS idx_memories_domain ON memories(domain);
    CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
  `, []);
  
  console.log('记忆系统初始化完成');
}

/**
 * 从笔记中提取记忆
 */
export async function extractMemoryFromNote(note: Note): Promise<MemoryItem | null> {
  try {
    const client = getGeminiClient();
    
    // 使用 AI 提取记忆摘要和关键词
    const prompt = `分析以下笔记内容，提取关键信息：

笔记内容：
${note.content}

请以 JSON 格式返回：
{
  "summary": "简洁的一句话摘要（不超过50字）",
  "category": "分类（如：想法、计划、学习、工作、生活等）",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}

只返回 JSON，不要其他内容。`;

    const response = await client.generateContent(prompt, {
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 200,
      },
    });

    // 解析 AI 响应
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('无法解析 AI 响应:', response);
      return null;
    }

    const extracted = JSON.parse(jsonMatch[0]);
    
    // 创建记忆项
    const memory: MemoryItem = {
      id: generateId(),
      summary: extracted.summary || note.content.slice(0, 50),
      category: extracted.category || '未分类',
      sourceType: 'note',
      sourceId: note.id,
      keywords: extracted.keywords || [],
      domain: note.domain,
      createdAt: getCurrentTimestamp(),
    };

    // 存储到数据库
    await execute(
      `INSERT INTO memories (id, summary, category, source_type, source_id, keywords, domain, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        memory.id,
        memory.summary,
        memory.category,
        memory.sourceType,
        memory.sourceId,
        JSON.stringify(memory.keywords),
        memory.domain,
        memory.createdAt,
      ]
    );

    return memory;
  } catch (error) {
    console.error('提取记忆失败:', error);
    return null;
  }
}

/**
 * 从任务中提取记忆
 */
export async function extractMemoryFromTask(task: Task): Promise<MemoryItem | null> {
  try {
    const memory: MemoryItem = {
      id: generateId(),
      summary: `任务: ${task.title}`,
      category: '任务',
      sourceType: 'task',
      sourceId: task.id,
      keywords: [task.priority, task.status],
      domain: task.domain,
      createdAt: getCurrentTimestamp(),
    };

    await execute(
      `INSERT INTO memories (id, summary, category, source_type, source_id, keywords, domain, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        memory.id,
        memory.summary,
        memory.category,
        memory.sourceType,
        memory.sourceId,
        JSON.stringify(memory.keywords),
        memory.domain,
        memory.createdAt,
      ]
    );

    return memory;
  } catch (error) {
    console.error('提取任务记忆失败:', error);
    return null;
  }
}

/**
 * 语义搜索记忆
 * 使用 AI 理解查询意图，返回相关记忆
 */
export async function searchMemories(
  queryText: string,
  options?: {
    domain?: LifeDomain;
    limit?: number;
  }
): Promise<MemorySearchResult[]> {
  try {
    // 先获取所有记忆
    let sql = 'SELECT * FROM memories';
    const params: unknown[] = [];
    
    if (options?.domain) {
      sql += ' WHERE domain = $1';
      params.push(options.domain);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    if (options?.limit) {
      sql += ` LIMIT ${options.limit * 3}`; // 获取更多用于 AI 筛选
    }

    const rows = await query<MemoryRow>(sql, params);
    
    if (rows.length === 0) {
      return [];
    }

    // 使用 AI 进行语义匹配
    const client = getGeminiClient();
    
    const memorySummaries = rows.map((r, i) => `${i + 1}. ${r.summary}`).join('\n');
    
    const prompt = `用户查询: "${queryText}"

以下是可用的记忆列表：
${memorySummaries}

请选出与用户查询最相关的记忆（最多5条），返回它们的序号和相关度（0-1）。
以 JSON 数组格式返回：
[{"index": 1, "relevance": 0.9}, {"index": 3, "relevance": 0.7}]

只返回 JSON，不要其他内容。如果没有相关记忆，返回空数组 []。`;

    const response = await client.generateContent(prompt, {
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 200,
      },
    });

    // 解析 AI 响应
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const matches: { index: number; relevance: number }[] = JSON.parse(jsonMatch[0]);
    
    // 构建结果
    const results: MemorySearchResult[] = [];
    for (const match of matches) {
      const row = rows[match.index - 1];
      if (row) {
        results.push({
          item: rowToMemory(row),
          relevance: match.relevance,
        });
      }
    }

    return results.slice(0, options?.limit || 5);
  } catch (error) {
    console.error('搜索记忆失败:', error);
    return [];
  }
}

/**
 * 获取记忆上下文
 * 用于 AI 对话时提供相关背景信息
 */
export async function getMemoryContext(
  queryText: string,
  maxItems: number = 5
): Promise<string> {
  const results = await searchMemories(queryText, { limit: maxItems });
  
  if (results.length === 0) {
    return '';
  }

  const contextLines = results.map(r => `- ${r.item.summary} (${r.item.category})`);
  
  return `相关记忆：\n${contextLines.join('\n')}`;
}

/**
 * 获取指定来源的记忆
 */
export async function getMemoryBySource(
  sourceType: MemoryItem['sourceType'],
  sourceId: string
): Promise<MemoryItem | null> {
  try {
    const rows = await query<MemoryRow>(
      'SELECT * FROM memories WHERE source_type = $1 AND source_id = $2',
      [sourceType, sourceId]
    );

    if (rows.length === 0) {
      return null;
    }

    return rowToMemory(rows[0]);
  } catch (error) {
    console.error('获取记忆失败:', error);
    return null;
  }
}

/**
 * 删除记忆
 */
export async function deleteMemory(id: string): Promise<boolean> {
  try {
    const result = await execute('DELETE FROM memories WHERE id = $1', [id]);
    return result.rowsAffected > 0;
  } catch (error) {
    console.error('删除记忆失败:', error);
    return false;
  }
}

/**
 * 删除指定来源的记忆
 */
export async function deleteMemoryBySource(
  sourceType: MemoryItem['sourceType'],
  sourceId: string
): Promise<boolean> {
  try {
    const result = await execute(
      'DELETE FROM memories WHERE source_type = $1 AND source_id = $2',
      [sourceType, sourceId]
    );
    return result.rowsAffected > 0;
  } catch (error) {
    console.error('删除记忆失败:', error);
    return false;
  }
}

/**
 * 将数据库行转换为 MemoryItem
 */
function rowToMemory(row: MemoryRow): MemoryItem {
  return {
    id: row.id,
    summary: row.summary,
    category: row.category,
    sourceType: row.source_type as MemoryItem['sourceType'],
    sourceId: row.source_id,
    keywords: JSON.parse(row.keywords || '[]'),
    domain: row.domain as LifeDomain,
    createdAt: row.created_at,
  };
}

// 导出初始化函数
export { initGeminiClient, getGeminiClient };
