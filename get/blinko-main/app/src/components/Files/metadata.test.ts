/**
 * 元数据管理属性测试
 * 使用 fast-check 进行属性测试
 * 
 * @module components/Files/metadata.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================
// 类型定义
// ============================================

interface PaperlessTag {
  id: number;
  name: string;
  color: string;
  slug?: string;
  matching_algorithm?: number;
  is_inbox_tag?: boolean;
}

interface DocumentMetadata {
  id: number;
  title: string;
  correspondent: number | null;
  document_type: number | null;
  tags: number[];
  created: string;
}

interface MetadataUpdate {
  title?: string;
  correspondent?: number | null;
  document_type?: number | null;
  tags?: number[];
}

// ============================================
// 生成器
// ============================================

/**
 * 生成随机颜色
 */
const hexColorArb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([r, g, b]) => 
  `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
);

/**
 * 生成随机标签
 */
const tagArb: fc.Arbitrary<PaperlessTag> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  color: hexColorArb,
  slug: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
  matching_algorithm: fc.option(fc.integer({ min: 0, max: 5 })),
  is_inbox_tag: fc.option(fc.boolean()),
});

/**
 * 生成随机 ISO 日期字符串
 */
const isoDateArb = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2025-12-31').getTime(),
}).map(timestamp => new Date(timestamp).toISOString());

/**
 * 生成随机文档元数据
 */
const metadataArb: fc.Arbitrary<DocumentMetadata> = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  correspondent: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
  document_type: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  tags: fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 0, maxLength: 10 }),
  created: isoDateArb,
});

/**
 * 生成随机元数据更新
 */
const metadataUpdateArb: fc.Arbitrary<MetadataUpdate> = fc.record({
  title: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
  correspondent: fc.option(fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null })),
  document_type: fc.option(fc.option(fc.integer({ min: 1, max: 100 }), { nil: null })),
  tags: fc.option(fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 0, maxLength: 10 })),
});

// ============================================
// 模拟服务函数 (纯函数，用于测试)
// ============================================

/**
 * 应用元数据更新
 */
function applyMetadataUpdate(
  original: DocumentMetadata,
  update: MetadataUpdate
): DocumentMetadata {
  return {
    ...original,
    title: update.title !== undefined ? update.title : original.title,
    correspondent: update.correspondent !== undefined ? update.correspondent : original.correspondent,
    document_type: update.document_type !== undefined ? update.document_type : original.document_type,
    tags: update.tags !== undefined ? update.tags : original.tags,
  };
}

/**
 * 序列化元数据为 API 请求格式
 */
function serializeMetadata(metadata: DocumentMetadata): Record<string, unknown> {
  return {
    id: metadata.id,
    title: metadata.title,
    correspondent: metadata.correspondent,
    document_type: metadata.document_type,
    tags: metadata.tags,
    created: metadata.created,
  };
}

/**
 * 反序列化 API 响应为元数据
 */
function deserializeMetadata(data: Record<string, unknown>): DocumentMetadata {
  return {
    id: data.id as number,
    title: data.title as string,
    correspondent: data.correspondent as number | null,
    document_type: data.document_type as number | null,
    tags: data.tags as number[],
    created: data.created as string,
  };
}

/**
 * 创建标签
 */
function createTag(name: string, color: string): Omit<PaperlessTag, 'id'> {
  return {
    name: name.trim(),
    color: color,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    matching_algorithm: 0,
    is_inbox_tag: false,
  };
}

/**
 * 更新标签
 */
function updateTag(tag: PaperlessTag, updates: Partial<PaperlessTag>): PaperlessTag {
  return {
    ...tag,
    ...updates,
    // 如果名称更新了，也更新 slug
    slug: updates.name 
      ? updates.name.toLowerCase().replace(/\s+/g, '-')
      : tag.slug,
  };
}

/**
 * 验证标签名称
 */
function isValidTagName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 100;
}

/**
 * 验证颜色格式
 */
function isValidColor(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

/**
 * 标签列表管理
 */
function addTagToList(tags: PaperlessTag[], newTag: PaperlessTag): PaperlessTag[] {
  // 检查是否已存在相同 ID
  if (tags.some(t => t.id === newTag.id)) {
    return tags;
  }
  return [...tags, newTag];
}

function removeTagFromList(tags: PaperlessTag[], tagId: number): PaperlessTag[] {
  return tags.filter(t => t.id !== tagId);
}

function updateTagInList(tags: PaperlessTag[], tagId: number, updates: Partial<PaperlessTag>): PaperlessTag[] {
  return tags.map(t => t.id === tagId ? updateTag(t, updates) : t);
}

// ============================================
// Property 6: 元数据编辑 Round-Trip
// **Validates: Requirements 1.4.1.5, 1.4.1.6**
// ============================================

describe('元数据编辑 Round-Trip (Property 6)', () => {
  /**
   * 属性: 序列化后反序列化应该得到等价的元数据
   */
  it('序列化后反序列化应该得到等价的元数据', () => {
    fc.assert(
      fc.property(metadataArb, (metadata) => {
        const serialized = serializeMetadata(metadata);
        const deserialized = deserializeMetadata(serialized);
        
        return (
          deserialized.id === metadata.id &&
          deserialized.title === metadata.title &&
          deserialized.correspondent === metadata.correspondent &&
          deserialized.document_type === metadata.document_type &&
          JSON.stringify(deserialized.tags) === JSON.stringify(metadata.tags) &&
          deserialized.created === metadata.created
        );
      }),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 应用更新后，更新的字段应该反映新值
   */
  it('应用更新后更新的字段应该反映新值', () => {
    fc.assert(
      fc.property(
        metadataArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        (original, newTitle) => {
          const updated = applyMetadataUpdate(original, { title: newTitle });
          return updated.title === newTitle;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 应用更新后，未更新的字段应该保持不变
   */
  it('应用更新后未更新的字段应该保持不变', () => {
    fc.assert(
      fc.property(
        metadataArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        (original, newTitle) => {
          const updated = applyMetadataUpdate(original, { title: newTitle });
          return (
            updated.id === original.id &&
            updated.correspondent === original.correspondent &&
            updated.document_type === original.document_type &&
            JSON.stringify(updated.tags) === JSON.stringify(original.tags) &&
            updated.created === original.created
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 空更新应该返回等价的元数据
   */
  it('空更新应该返回等价的元数据', () => {
    fc.assert(
      fc.property(metadataArb, (original) => {
        const updated = applyMetadataUpdate(original, {});
        return (
          updated.id === original.id &&
          updated.title === original.title &&
          updated.correspondent === original.correspondent &&
          updated.document_type === original.document_type &&
          JSON.stringify(updated.tags) === JSON.stringify(original.tags) &&
          updated.created === original.created
        );
      }),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 连续应用多个更新应该等价于应用合并后的更新
   */
  it('连续应用多个更新应该等价于应用合并后的更新', () => {
    fc.assert(
      fc.property(
        metadataArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.integer({ min: 1, max: 1000 }),
        (original, newTitle, newCorrespondent) => {
          // 连续应用
          const step1 = applyMetadataUpdate(original, { title: newTitle });
          const step2 = applyMetadataUpdate(step1, { correspondent: newCorrespondent });
          
          // 合并应用
          const merged = applyMetadataUpdate(original, { 
            title: newTitle, 
            correspondent: newCorrespondent 
          });
          
          return (
            step2.title === merged.title &&
            step2.correspondent === merged.correspondent
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Property 7: 标签管理 Round-Trip
// **Validates: Requirements 1.4.2.4, 1.4.2.8**
// ============================================

describe('标签管理 Round-Trip (Property 7)', () => {
  /**
   * 属性: 创建标签后名称应该被正确保存
   */
  it('创建标签后名称应该被正确保存', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        hexColorArb,
        (name, color) => {
          const tag = createTag(name, color);
          return tag.name === name.trim();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 创建标签后颜色应该被正确保存
   */
  it('创建标签后颜色应该被正确保存', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        hexColorArb,
        (name, color) => {
          const tag = createTag(name, color);
          return tag.color === color;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 更新标签后应该反映新值
   */
  it('更新标签后应该反映新值', () => {
    fc.assert(
      fc.property(
        tagArb,
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (tag, newName) => {
          const updated = updateTag(tag, { name: newName });
          return updated.name === newName;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 更新标签后 ID 应该保持不变
   */
  it('更新标签后 ID 应该保持不变', () => {
    fc.assert(
      fc.property(
        tagArb,
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        hexColorArb,
        (tag, newName, newColor) => {
          const updated = updateTag(tag, { name: newName, color: newColor });
          return updated.id === tag.id;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 添加标签到列表后列表应该包含该标签
   */
  it('添加标签到列表后列表应该包含该标签', () => {
    fc.assert(
      fc.property(
        fc.array(tagArb, { minLength: 0, maxLength: 10 }),
        tagArb,
        (tags, newTag) => {
          // 确保新标签 ID 不在现有列表中
          const uniqueNewTag = { ...newTag, id: Math.max(...tags.map(t => t.id), 0) + 1 };
          const updated = addTagToList(tags, uniqueNewTag);
          return updated.some(t => t.id === uniqueNewTag.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 添加标签后列表长度应该增加 1（如果是新标签）
   */
  it('添加新标签后列表长度应该增加 1', () => {
    fc.assert(
      fc.property(
        fc.array(tagArb, { minLength: 0, maxLength: 10 }),
        tagArb,
        (tags, newTag) => {
          // 确保新标签 ID 不在现有列表中
          const uniqueNewTag = { ...newTag, id: Math.max(...tags.map(t => t.id), 0) + 1 };
          const updated = addTagToList(tags, uniqueNewTag);
          return updated.length === tags.length + 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 删除标签后列表不应该包含该标签
   */
  it('删除标签后列表不应该包含该标签', () => {
    fc.assert(
      fc.property(
        fc.array(tagArb, { minLength: 1, maxLength: 10 }),
        (tags) => {
          const tagToRemove = tags[0];
          const updated = removeTagFromList(tags, tagToRemove.id);
          return !updated.some(t => t.id === tagToRemove.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 删除标签后列表长度应该减少 1
   */
  it('删除标签后列表长度应该减少 1', () => {
    fc.assert(
      fc.property(
        fc.array(tagArb, { minLength: 1, maxLength: 10 })
          .map(tags => {
            // 确保没有重复 ID
            const seen = new Set<number>();
            return tags.filter(t => {
              if (seen.has(t.id)) return false;
              seen.add(t.id);
              return true;
            });
          })
          .filter(tags => tags.length >= 1),
        (tags) => {
          const tagToRemove = tags[0];
          const updated = removeTagFromList(tags, tagToRemove.id);
          return updated.length === tags.length - 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 更新列表中的标签后应该反映新值
   */
  it('更新列表中的标签后应该反映新值', () => {
    fc.assert(
      fc.property(
        fc.array(tagArb, { minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (tags, newName) => {
          const tagToUpdate = tags[0];
          const updated = updateTagInList(tags, tagToUpdate.id, { name: newName });
          const updatedTag = updated.find(t => t.id === tagToUpdate.id);
          return updatedTag?.name === newName;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 更新列表中的标签后列表长度应该保持不变
   */
  it('更新列表中的标签后列表长度应该保持不变', () => {
    fc.assert(
      fc.property(
        fc.array(tagArb, { minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (tags, newName) => {
          const tagToUpdate = tags[0];
          const updated = updateTagInList(tags, tagToUpdate.id, { name: newName });
          return updated.length === tags.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// 验证函数测试
// ============================================

describe('验证函数', () => {
  /**
   * 属性: 有效的标签名称应该通过验证
   */
  it('有效的标签名称应该通过验证', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        (name) => {
          return isValidTagName(name) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 空白标签名称应该不通过验证
   */
  it('空白标签名称应该不通过验证', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '   ', '\t', '\n', '  \t  '),
        (name) => {
          return isValidTagName(name) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 有效的颜色格式应该通过验证
   */
  it('有效的颜色格式应该通过验证', () => {
    fc.assert(
      fc.property(hexColorArb, (color) => {
        return isValidColor(color) === true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 无效的颜色格式应该不通过验证
   */
  it('无效的颜色格式应该不通过验证', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('red', 'blue', '#fff', '#12345', '123456', '#GGGGGG'),
        (color) => {
          return isValidColor(color) === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});

