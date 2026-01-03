/**
 * 文档列表属性测试
 * 使用 fast-check 进行属性测试
 * 
 * @module components/Files/documentList.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================
// 类型定义
// ============================================

interface PaperlessDocument {
  id: number;
  title: string;
  content: string;
  created: string;
  modified: string;
  added: string;
  correspondent: number | null;
  document_type: number | null;
  tags: number[];
  original_file_name: string;
}

interface PaperlessTag {
  id: number;
  name: string;
  color: string;
}

interface Correspondent {
  id: number;
  name: string;
}

// ============================================
// 生成器
// ============================================

/**
 * 生成随机 ISO 日期字符串
 */
const isoDateArb = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2025-12-31').getTime(),
}).map(timestamp => new Date(timestamp).toISOString());

/**
 * 生成随机文件扩展名
 */
const fileExtensionArb = fc.constantFrom('pdf', 'png', 'jpg', 'docx', 'txt', 'xlsx');

/**
 * 生成随机文件名
 */
const filenameArb = fc.tuple(
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  fileExtensionArb
).map(([name, ext]) => `${name}.${ext}`);

/**
 * 生成随机标签
 */
const hexColorArb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([r, g, b]) => `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);

const tagArb: fc.Arbitrary<PaperlessTag> = fc.record({
  id: fc.integer({ min: 1, max: 1000 }),
  name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
  color: hexColorArb,
});

/**
 * 生成随机通讯者
 */
const correspondentArb: fc.Arbitrary<Correspondent> = fc.record({
  id: fc.integer({ min: 1, max: 1000 }),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
});

/**
 * 生成随机文档
 */
const documentArb: fc.Arbitrary<PaperlessDocument> = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  title: fc.string({ minLength: 0, maxLength: 100 }),
  content: fc.string({ minLength: 0, maxLength: 500 }),
  created: isoDateArb,
  modified: isoDateArb,
  added: isoDateArb,
  correspondent: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  document_type: fc.option(fc.integer({ min: 1, max: 50 }), { nil: null }),
  tags: fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 0, maxLength: 5 }),
  original_file_name: filenameArb,
});

// ============================================
// 工具函数 (从组件中提取的纯函数)
// ============================================

/**
 * 获取文件扩展名
 */
function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : 'file';
}

/**
 * 获取文档显示标题
 */
function getDocumentDisplayTitle(doc: PaperlessDocument): string {
  return doc.title || doc.original_file_name;
}

/**
 * 获取文档关联的标签
 */
function getDocumentTags(doc: PaperlessDocument, allTags: PaperlessTag[]): PaperlessTag[] {
  return allTags.filter(tag => doc.tags.includes(tag.id));
}

/**
 * 获取文档的通讯者
 */
function getDocumentCorrespondent(
  doc: PaperlessDocument, 
  correspondents: Correspondent[]
): Correspondent | undefined {
  return correspondents.find(c => c.id === doc.correspondent);
}

/**
 * 排序文档
 */
type SortField = 'added' | 'created' | 'modified' | 'title';
type SortOrder = 'asc' | 'desc';

function sortDocuments(
  docs: PaperlessDocument[],
  field: SortField,
  order: SortOrder
): PaperlessDocument[] {
  return [...docs].sort((a, b) => {
    let comparison = 0;
    
    if (field === 'title') {
      const titleA = getDocumentDisplayTitle(a).toLowerCase();
      const titleB = getDocumentDisplayTitle(b).toLowerCase();
      comparison = titleA.localeCompare(titleB);
    } else {
      const dateA = new Date(a[field]).getTime();
      const dateB = new Date(b[field]).getTime();
      comparison = dateA - dateB;
    }
    
    return order === 'asc' ? comparison : -comparison;
  });
}

/**
 * 过滤文档
 */
interface FilterCriteria {
  tagIds?: number[];
  correspondentId?: number | null;
  documentTypeId?: number | null;
  searchQuery?: string;
}

function filterDocuments(
  docs: PaperlessDocument[],
  criteria: FilterCriteria
): PaperlessDocument[] {
  return docs.filter(doc => {
    // 标签过滤
    if (criteria.tagIds && criteria.tagIds.length > 0) {
      const hasAllTags = criteria.tagIds.every(tagId => doc.tags.includes(tagId));
      if (!hasAllTags) return false;
    }
    
    // 通讯者过滤
    if (criteria.correspondentId !== undefined && criteria.correspondentId !== null) {
      if (doc.correspondent !== criteria.correspondentId) return false;
    }
    
    // 文档类型过滤
    if (criteria.documentTypeId !== undefined && criteria.documentTypeId !== null) {
      if (doc.document_type !== criteria.documentTypeId) return false;
    }
    
    // 搜索过滤
    if (criteria.searchQuery && criteria.searchQuery.trim()) {
      const query = criteria.searchQuery.toLowerCase();
      const title = getDocumentDisplayTitle(doc).toLowerCase();
      const content = doc.content.toLowerCase();
      if (!title.includes(query) && !content.includes(query)) return false;
    }
    
    return true;
  });
}

// ============================================
// Property 1: 文档列表显示完整性
// **Validates: Requirements 1.2.1.2**
// ============================================

describe('文档列表显示完整性 (Property 1)', () => {
  /**
   * 属性: 每个文档都应该有可显示的标题
   * 如果 title 为空，应该使用 original_file_name
   */
  it('每个文档都应该有可显示的标题', () => {
    fc.assert(
      fc.property(documentArb, (doc) => {
        const displayTitle = getDocumentDisplayTitle(doc);
        // 显示标题不应该为空
        return displayTitle.length > 0;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 文档的标签应该正确关联
   * 返回的标签 ID 应该是文档 tags 数组的子集
   */
  it('文档的标签应该正确关联', () => {
    fc.assert(
      fc.property(
        documentArb,
        fc.array(tagArb, { minLength: 0, maxLength: 20 }),
        (doc, allTags) => {
          const docTags = getDocumentTags(doc, allTags);
          // 返回的每个标签都应该在文档的 tags 数组中
          return docTags.every(tag => doc.tags.includes(tag.id));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 文档的通讯者应该正确关联
   */
  it('文档的通讯者应该正确关联', () => {
    fc.assert(
      fc.property(
        documentArb,
        fc.array(correspondentArb, { minLength: 0, maxLength: 10 }),
        (doc, correspondents) => {
          const correspondent = getDocumentCorrespondent(doc, correspondents);
          if (doc.correspondent === null) {
            // 如果文档没有通讯者，应该返回 undefined
            return correspondent === undefined;
          }
          // 如果找到通讯者，ID 应该匹配
          return correspondent === undefined || correspondent.id === doc.correspondent;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 文件扩展名应该正确提取
   */
  it('文件扩展名应该正确提取', () => {
    fc.assert(
      fc.property(filenameArb, (filename) => {
        const ext = getFileExtension(filename);
        // 扩展名应该是小写
        return ext === ext.toLowerCase();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 文件扩展名应该与文件名后缀匹配
   */
  it('文件扩展名应该与文件名后缀匹配', () => {
    fc.assert(
      fc.property(filenameArb, (filename) => {
        const ext = getFileExtension(filename);
        // 文件名应该以 .ext 结尾
        return filename.toLowerCase().endsWith(`.${ext}`);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Property 4: 排序正确性
// **Validates: Requirements 1.2.1.4**
// ============================================

describe('排序正确性 (Property 4)', () => {
  /**
   * 属性: 按日期升序排序后，每个文档的日期应该 >= 前一个
   */
  it('按添加日期升序排序应该正确', () => {
    fc.assert(
      fc.property(
        fc.array(documentArb, { minLength: 2, maxLength: 20 }),
        (docs) => {
          const sorted = sortDocuments(docs, 'added', 'asc');
          for (let i = 1; i < sorted.length; i++) {
            const prevDate = new Date(sorted[i - 1].added).getTime();
            const currDate = new Date(sorted[i].added).getTime();
            if (currDate < prevDate) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 按日期降序排序后，每个文档的日期应该 <= 前一个
   */
  it('按添加日期降序排序应该正确', () => {
    fc.assert(
      fc.property(
        fc.array(documentArb, { minLength: 2, maxLength: 20 }),
        (docs) => {
          const sorted = sortDocuments(docs, 'added', 'desc');
          for (let i = 1; i < sorted.length; i++) {
            const prevDate = new Date(sorted[i - 1].added).getTime();
            const currDate = new Date(sorted[i].added).getTime();
            if (currDate > prevDate) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 按标题排序应该保持字母顺序
   */
  it('按标题升序排序应该正确', () => {
    fc.assert(
      fc.property(
        fc.array(documentArb, { minLength: 2, maxLength: 20 }),
        (docs) => {
          const sorted = sortDocuments(docs, 'title', 'asc');
          for (let i = 1; i < sorted.length; i++) {
            const prevTitle = getDocumentDisplayTitle(sorted[i - 1]).toLowerCase();
            const currTitle = getDocumentDisplayTitle(sorted[i]).toLowerCase();
            if (prevTitle.localeCompare(currTitle) > 0) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 排序不应该改变文档数量
   */
  it('排序不应该改变文档数量', () => {
    fc.assert(
      fc.property(
        fc.array(documentArb, { minLength: 0, maxLength: 20 }),
        fc.constantFrom('added', 'created', 'modified', 'title') as fc.Arbitrary<SortField>,
        fc.constantFrom('asc', 'desc') as fc.Arbitrary<SortOrder>,
        (docs, field, order) => {
          const sorted = sortDocuments(docs, field, order);
          return sorted.length === docs.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 排序应该保留所有原始文档
   */
  it('排序应该保留所有原始文档', () => {
    fc.assert(
      fc.property(
        fc.array(documentArb, { minLength: 0, maxLength: 20 }),
        fc.constantFrom('added', 'created', 'modified', 'title') as fc.Arbitrary<SortField>,
        fc.constantFrom('asc', 'desc') as fc.Arbitrary<SortOrder>,
        (docs, field, order) => {
          const sorted = sortDocuments(docs, field, order);
          const originalIds = new Set(docs.map(d => d.id));
          const sortedIds = new Set(sorted.map(d => d.id));
          // 两个集合应该相等
          if (originalIds.size !== sortedIds.size) return false;
          for (const id of originalIds) {
            if (!sortedIds.has(id)) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 排序是稳定的 - 相同值的元素保持相对顺序
   * (这是一个弱化的测试，只检查排序后再排序结果相同)
   */
  it('排序是幂等的', () => {
    fc.assert(
      fc.property(
        fc.array(documentArb, { minLength: 0, maxLength: 20 }),
        fc.constantFrom('added', 'created', 'modified', 'title') as fc.Arbitrary<SortField>,
        fc.constantFrom('asc', 'desc') as fc.Arbitrary<SortOrder>,
        (docs, field, order) => {
          const sorted1 = sortDocuments(docs, field, order);
          const sorted2 = sortDocuments(sorted1, field, order);
          // 排序两次应该得到相同结果
          return JSON.stringify(sorted1.map(d => d.id)) === JSON.stringify(sorted2.map(d => d.id));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Property 3: 过滤结果正确性
// **Validates: Requirements 1.2.3.4, 1.2.3.5, 1.2.3.6**
// ============================================

describe('过滤结果正确性 (Property 3)', () => {
  /**
   * 属性: 按标签过滤后，所有结果都应该包含指定标签
   */
  it('按标签过滤后所有结果都应该包含指定标签', () => {
    fc.assert(
      fc.property(
        fc.array(documentArb, { minLength: 0, maxLength: 20 }),
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 3 }),
        (docs, tagIds) => {
          const filtered = filterDocuments(docs, { tagIds });
          // 所有过滤结果都应该包含所有指定的标签
          return filtered.every(doc => 
            tagIds.every(tagId => doc.tags.includes(tagId))
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 按通讯者过滤后，所有结果的通讯者都应该匹配
   */
  it('按通讯者过滤后所有结果的通讯者都应该匹配', () => {
    fc.assert(
      fc.property(
        fc.array(documentArb, { minLength: 0, maxLength: 20 }),
        fc.integer({ min: 1, max: 100 }),
        (docs, correspondentId) => {
          const filtered = filterDocuments(docs, { correspondentId });
          return filtered.every(doc => doc.correspondent === correspondentId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 按文档类型过滤后，所有结果的类型都应该匹配
   */
  it('按文档类型过滤后所有结果的类型都应该匹配', () => {
    fc.assert(
      fc.property(
        fc.array(documentArb, { minLength: 0, maxLength: 20 }),
        fc.integer({ min: 1, max: 50 }),
        (docs, documentTypeId) => {
          const filtered = filterDocuments(docs, { documentTypeId });
          return filtered.every(doc => doc.document_type === documentTypeId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 过滤结果应该是原始列表的子集
   */
  it('过滤结果应该是原始列表的子集', () => {
    fc.assert(
      fc.property(
        fc.array(documentArb, { minLength: 0, maxLength: 20 }),
        fc.record({
          tagIds: fc.option(fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 0, maxLength: 3 })),
          correspondentId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
          documentTypeId: fc.option(fc.integer({ min: 1, max: 50 }), { nil: null }),
        }),
        (docs, criteria) => {
          const filtered = filterDocuments(docs, {
            tagIds: criteria.tagIds ?? undefined,
            correspondentId: criteria.correspondentId,
            documentTypeId: criteria.documentTypeId,
          });
          // 过滤结果数量不应该超过原始数量
          if (filtered.length > docs.length) return false;
          // 过滤结果中的每个文档都应该在原始列表中
          const originalIds = new Set(docs.map(d => d.id));
          return filtered.every(doc => originalIds.has(doc.id));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 空过滤条件应该返回所有文档
   */
  it('空过滤条件应该返回所有文档', () => {
    fc.assert(
      fc.property(
        fc.array(documentArb, { minLength: 0, maxLength: 20 }),
        (docs) => {
          const filtered = filterDocuments(docs, {});
          return filtered.length === docs.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Property 5: 搜索结果高亮 (简化版)
// **Validates: Requirements 1.2.2.3**
// ============================================

describe('搜索结果正确性 (Property 5)', () => {
  /**
   * 属性: 搜索结果应该包含搜索词
   */
  it('搜索结果的标题或内容应该包含搜索词', () => {
    fc.assert(
      fc.property(
        fc.array(documentArb, { minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
        (docs, searchQuery) => {
          const filtered = filterDocuments(docs, { searchQuery });
          const query = searchQuery.toLowerCase();
          return filtered.every(doc => {
            const title = getDocumentDisplayTitle(doc).toLowerCase();
            const content = doc.content.toLowerCase();
            return title.includes(query) || content.includes(query);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 空搜索词应该返回所有文档
   */
  it('空搜索词应该返回所有文档', () => {
    fc.assert(
      fc.property(
        fc.array(documentArb, { minLength: 0, maxLength: 20 }),
        fc.constantFrom('', '   ', '\t', '\n'),
        (docs, searchQuery) => {
          const filtered = filterDocuments(docs, { searchQuery });
          return filtered.length === docs.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});

