/**
 * 文件验证工具函数
 * 提供文件类型和大小验证
 * 
 * @module lib/fileValidation
 */

// ============================================
// 常量定义
// ============================================

/** 支持的文件扩展名 */
export const ALLOWED_EXTENSIONS = [
  'pdf',
  'png', 'jpg', 'jpeg', 'gif', 'tiff', 'webp',
  'txt', 'md',
  'doc', 'docx',
  'xls', 'xlsx',
] as const;

/** 支持的 MIME 类型映射 */
export const MIME_TYPE_MAP: Record<string, string[]> = {
  // PDF
  'application/pdf': ['pdf'],
  // 图片
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/gif': ['gif'],
  'image/tiff': ['tiff'],
  'image/webp': ['webp'],
  // 文本
  'text/plain': ['txt'],
  'text/markdown': ['md'],
  // Office 文档
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
};

/** 默认最大文件大小 (50MB) */
export const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;

/** 文件类型分类 */
export const FILE_CATEGORIES = {
  document: ['pdf', 'doc', 'docx', 'txt', 'md'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'tiff', 'webp'],
  spreadsheet: ['xls', 'xlsx'],
} as const;

// ============================================
// 类型定义
// ============================================

/** 验证结果 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: ValidationErrorCode;
}

/** 验证错误码 */
export type ValidationErrorCode = 
  | 'INVALID_EXTENSION'
  | 'INVALID_MIME_TYPE'
  | 'FILE_TOO_LARGE'
  | 'FILE_EMPTY'
  | 'UNKNOWN_ERROR';

/** 验证选项 */
export interface ValidationOptions {
  /** 允许的扩展名列表 (默认使用 ALLOWED_EXTENSIONS) */
  allowedExtensions?: string[];
  /** 最大文件大小 (字节，默认 50MB) */
  maxFileSize?: number;
  /** 是否验证 MIME 类型 (默认 true) */
  validateMimeType?: boolean;
  /** 是否允许空文件 (默认 false) */
  allowEmpty?: boolean;
}

// ============================================
// 验证函数
// ============================================

/**
 * 验证文件
 * 
 * @param file - 要验证的文件
 * @param options - 验证选项
 * @returns 验证结果
 */
export function validateFile(
  file: File,
  options: ValidationOptions = {}
): ValidationResult {
  const {
    allowedExtensions = ALLOWED_EXTENSIONS as unknown as string[],
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    validateMimeType = true,
    allowEmpty = false,
  } = options;

  // 检查文件是否为空
  if (!allowEmpty && file.size === 0) {
    return {
      valid: false,
      error: '文件为空',
      errorCode: 'FILE_EMPTY',
    };
  }

  // 检查文件大小
  if (file.size > maxFileSize) {
    return {
      valid: false,
      error: `文件大小超过限制 (最大 ${formatFileSize(maxFileSize)})`,
      errorCode: 'FILE_TOO_LARGE',
    };
  }

  // 检查文件扩展名
  const extension = getFileExtension(file.name);
  if (!extension || !allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `不支持的文件类型: ${extension || '未知'}`,
      errorCode: 'INVALID_EXTENSION',
    };
  }

  // 检查 MIME 类型
  if (validateMimeType && file.type) {
    const validExtensions = MIME_TYPE_MAP[file.type];
    if (validExtensions && !validExtensions.includes(extension)) {
      return {
        valid: false,
        error: `文件类型与扩展名不匹配`,
        errorCode: 'INVALID_MIME_TYPE',
      };
    }
  }

  return { valid: true };
}

/**
 * 批量验证文件
 * 
 * @param files - 文件列表
 * @param options - 验证选项
 * @returns 验证结果数组
 */
export function validateFiles(
  files: File[],
  options: ValidationOptions = {}
): { file: File; result: ValidationResult }[] {
  return files.map(file => ({
    file,
    result: validateFile(file, options),
  }));
}

/**
 * 检查文件扩展名是否有效
 * 
 * @param filename - 文件名
 * @param allowedExtensions - 允许的扩展名列表
 * @returns 是否有效
 */
export function isValidExtension(
  filename: string,
  allowedExtensions: string[] = ALLOWED_EXTENSIONS as unknown as string[]
): boolean {
  const ext = getFileExtension(filename);
  return ext !== '' && allowedExtensions.includes(ext);
}

/**
 * 检查文件大小是否有效
 * 
 * @param size - 文件大小 (字节)
 * @param maxSize - 最大大小 (字节)
 * @returns 是否有效
 */
export function isValidFileSize(
  size: number,
  maxSize: number = DEFAULT_MAX_FILE_SIZE
): boolean {
  return size > 0 && size <= maxSize;
}

// ============================================
// 工具函数
// ============================================

/**
 * 获取文件扩展名 (小写)
 * 
 * @param filename - 文件名
 * @returns 扩展名 (不含点号)
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  return parts.pop()?.toLowerCase() || '';
}

/**
 * 获取文件类别
 * 
 * @param filename - 文件名
 * @returns 文件类别
 */
export function getFileCategory(filename: string): keyof typeof FILE_CATEGORIES | 'other' {
  const ext = getFileExtension(filename);
  
  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if ((extensions as readonly string[]).includes(ext)) {
      return category as keyof typeof FILE_CATEGORIES;
    }
  }
  
  return 'other';
}

/**
 * 格式化文件大小
 * 
 * @param bytes - 字节数
 * @returns 格式化后的字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

/**
 * 获取文件的 MIME 类型
 * 
 * @param filename - 文件名
 * @returns MIME 类型
 */
export function getMimeType(filename: string): string {
  const ext = getFileExtension(filename);
  
  for (const [mimeType, extensions] of Object.entries(MIME_TYPE_MAP)) {
    if (extensions.includes(ext)) {
      return mimeType;
    }
  }
  
  return 'application/octet-stream';
}

/**
 * 获取文件图标名称
 * 
 * @param filename - 文件名
 * @returns 图标名称 (Solar 图标)
 */
export function getFileIcon(filename: string): string {
  const ext = getFileExtension(filename);
  
  const iconMap: Record<string, string> = {
    pdf: 'solar:document-text-bold',
    doc: 'solar:document-bold',
    docx: 'solar:document-bold',
    txt: 'solar:text-bold',
    md: 'solar:text-bold',
    png: 'solar:gallery-bold',
    jpg: 'solar:gallery-bold',
    jpeg: 'solar:gallery-bold',
    gif: 'solar:gallery-bold',
    tiff: 'solar:gallery-bold',
    webp: 'solar:gallery-bold',
    xls: 'solar:chart-square-bold',
    xlsx: 'solar:chart-square-bold',
  };
  
  return iconMap[ext] || 'solar:file-bold';
}

/**
 * 生成 accept 属性字符串
 * 
 * @param extensions - 扩展名列表
 * @returns accept 属性值
 */
export function generateAcceptString(
  extensions: string[] = ALLOWED_EXTENSIONS as unknown as string[]
): string {
  return extensions.map(ext => `.${ext}`).join(',');
}

/**
 * 从文件名中提取标题 (去除扩展名)
 * 
 * @param filename - 文件名
 * @returns 标题
 */
export function extractTitleFromFilename(filename: string): string {
  const ext = getFileExtension(filename);
  if (!ext) return filename;
  return filename.slice(0, -(ext.length + 1));
}

// ============================================
// 导出
// ============================================

export default {
  // 常量
  ALLOWED_EXTENSIONS,
  MIME_TYPE_MAP,
  DEFAULT_MAX_FILE_SIZE,
  FILE_CATEGORIES,
  
  // 验证函数
  validateFile,
  validateFiles,
  isValidExtension,
  isValidFileSize,
  
  // 工具函数
  getFileExtension,
  getFileCategory,
  formatFileSize,
  getMimeType,
  getFileIcon,
  generateAcceptString,
  extractTitleFromFilename,
};
