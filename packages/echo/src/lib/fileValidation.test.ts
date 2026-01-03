/**
 * 文件验证工具属性测试
 * 使用 fast-check 进行属性测试
 * 
 * 运行前需要安装依赖:
 * bun add -D vitest fast-check @testing-library/react
 * 
 * @module lib/fileValidation.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateFile,
  validateFiles,
  isValidExtension,
  isValidFileSize,
  getFileExtension,
  getFileCategory,
  formatFileSize,
  getMimeType,
  getFileIcon,
  generateAcceptString,
  extractTitleFromFilename,
  ALLOWED_EXTENSIONS,
  DEFAULT_MAX_FILE_SIZE,
  FILE_CATEGORIES,
} from './fileValidation';

// ============================================
// 辅助函数：创建模拟 File 对象
// ============================================

/**
 * 创建模拟 File 对象
 * 注意：为了测试性能，我们使用 ArrayBuffer 而不是重复字符串
 */
function createMockFile(name: string, size: number, type: string = ''): File {
  // 使用 ArrayBuffer 创建指定大小的文件，避免大字符串操作
  const buffer = new ArrayBuffer(Math.min(size, 1024)); // 实际内容最多 1KB
  const blob = new Blob([buffer], { type });
  // 使用 Object.defineProperty 模拟文件大小
  const file = new File([blob], name, { type });
  Object.defineProperty(file, 'size', { value: size, writable: false });
  return file;
}

// ============================================
// Property 2: 文件类型验证
// **Validates: Requirements 1.3.1.5**
// ============================================

describe('文件类型验证 (Property 2)', () => {
  /**
   * 属性: 所有允许的扩展名都应该通过验证
   */
  it('允许的扩展名应该通过验证', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALLOWED_EXTENSIONS),
        fc.integer({ min: 1, max: DEFAULT_MAX_FILE_SIZE }),
        (ext, size) => {
          const file = createMockFile(`test.${ext}`, size);
          const result = validateFile(file);
          return result.valid === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 不允许的扩展名应该被拒绝
   */
  it('不允许的扩展名应该被拒绝', () => {
    const disallowedExtensions = ['exe', 'bat', 'sh', 'dll', 'so', 'bin', 'app'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...disallowedExtensions),
        fc.integer({ min: 1, max: 1000 }),
        (ext, size) => {
          const file = createMockFile(`test.${ext}`, size);
          const result = validateFile(file);
          return result.valid === false && result.errorCode === 'INVALID_EXTENSION';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 超过大小限制的文件应该被拒绝
   */
  it('超过大小限制的文件应该被拒绝', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALLOWED_EXTENSIONS),
        fc.integer({ min: DEFAULT_MAX_FILE_SIZE + 1, max: DEFAULT_MAX_FILE_SIZE * 2 }),
        (ext, size) => {
          const file = createMockFile(`test.${ext}`, size);
          const result = validateFile(file);
          return result.valid === false && result.errorCode === 'FILE_TOO_LARGE';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 空文件应该被拒绝 (除非明确允许)
   */
  it('空文件应该被拒绝', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALLOWED_EXTENSIONS),
        (ext) => {
          const file = createMockFile(`test.${ext}`, 0);
          const result = validateFile(file);
          return result.valid === false && result.errorCode === 'FILE_EMPTY';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 允许空文件时，空文件应该通过验证
   */
  it('允许空文件时应该通过验证', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALLOWED_EXTENSIONS),
        (ext) => {
          const file = createMockFile(`test.${ext}`, 0);
          const result = validateFile(file, { allowEmpty: true });
          return result.valid === true;
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================
// 工具函数测试
// ============================================

describe('getFileExtension', () => {
  /**
   * 属性: 扩展名提取应该返回小写
   */
  it('应该返回小写扩展名', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALLOWED_EXTENSIONS),
        fc.boolean(),
        (ext, uppercase) => {
          const filename = `test.${uppercase ? ext.toUpperCase() : ext}`;
          const result = getFileExtension(filename);
          return result === ext.toLowerCase();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 无扩展名的文件应该返回空字符串
   */
  it('无扩展名应该返回空字符串', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('.')),
        (filename) => {
          const result = getFileExtension(filename);
          return result === '';
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('getFileCategory', () => {
  /**
   * 属性: 文档类型文件应该返回 'document' 类别
   */
  it('文档类型应该返回 document 类别', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FILE_CATEGORIES.document),
        (ext) => {
          const result = getFileCategory(`test.${ext}`);
          return result === 'document';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 图片类型文件应该返回 'image' 类别
   */
  it('图片类型应该返回 image 类别', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FILE_CATEGORIES.image),
        (ext) => {
          const result = getFileCategory(`test.${ext}`);
          return result === 'image';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 表格类型文件应该返回 'spreadsheet' 类别
   */
  it('表格类型应该返回 spreadsheet 类别', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FILE_CATEGORIES.spreadsheet),
        (ext) => {
          const result = getFileCategory(`test.${ext}`);
          return result === 'spreadsheet';
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('formatFileSize', () => {
  /**
   * 属性: 格式化结果应该包含单位
   */
  it('格式化结果应该包含单位', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 * 1024 * 1024 * 1024 }),
        (bytes) => {
          const result = formatFileSize(bytes);
          return result.includes('B') || result.includes('KB') || 
                 result.includes('MB') || result.includes('GB');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 小于 1KB 的文件应该显示 B 单位
   */
  it('小于 1KB 应该显示 B 单位', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1023 }),
        (bytes) => {
          const result = formatFileSize(bytes);
          return result.endsWith(' B');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 1KB-1MB 的文件应该显示 KB 单位
   */
  it('1KB-1MB 应该显示 KB 单位', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1024, max: 1024 * 1024 - 1 }),
        (bytes) => {
          const result = formatFileSize(bytes);
          return result.includes('KB');
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('extractTitleFromFilename', () => {
  /**
   * 属性: 提取的标题不应该包含扩展名
   */
  it('提取的标题不应该包含扩展名', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('.')),
        fc.constantFrom(...ALLOWED_EXTENSIONS),
        (name, ext) => {
          const filename = `${name}.${ext}`;
          const title = extractTitleFromFilename(filename);
          return title === name;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('isValidExtension', () => {
  /**
   * 属性: 允许列表中的扩展名应该返回 true
   */
  it('允许的扩展名应该返回 true', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALLOWED_EXTENSIONS),
        (ext) => {
          return isValidExtension(`test.${ext}`) === true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('isValidFileSize', () => {
  /**
   * 属性: 在限制内的大小应该返回 true
   */
  it('在限制内的大小应该返回 true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: DEFAULT_MAX_FILE_SIZE }),
        (size) => {
          return isValidFileSize(size) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性: 超过限制的大小应该返回 false
   */
  it('超过限制的大小应该返回 false', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: DEFAULT_MAX_FILE_SIZE + 1, max: DEFAULT_MAX_FILE_SIZE * 2 }),
        (size) => {
          return isValidFileSize(size) === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('validateFiles (批量验证)', () => {
  /**
   * 属性: 批量验证应该返回与输入相同数量的结果
   */
  it('批量验证应该返回与输入相同数量的结果', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.constantFrom(...ALLOWED_EXTENSIONS),
            fc.integer({ min: 1, max: 1000 })
          ),
          { minLength: 1, maxLength: 10 }
        ),
        (fileSpecs) => {
          const files = fileSpecs.map(([ext, size]) => 
            createMockFile(`test.${ext}`, size)
          );
          const results = validateFiles(files);
          return results.length === files.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});
