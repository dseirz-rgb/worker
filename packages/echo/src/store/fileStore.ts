/**
 * 文件预览和上传状态 Store
 * 
 * 使用 Zustand 管理文件预览模态框和上传模态框的状态
 * 
 * @module fileStore
 */

import create, { SetState, GetState } from 'zustand';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 上传文件类型
 * 包含文件信息、元数据和上传状态
 */
export interface UploadFile {
  /** 唯一标识符 */
  id: string;
  /** 原始文件对象 */
  file: File;
  /** 文件标题（用户可编辑） */
  title: string;
  /** 关联的标签 ID 列表 */
  tags: number[];
  /** 文档类型 ID */
  documentType: number | null;
  /** 上传进度 (0-100) */
  progress: number;
  /** 上传状态 */
  status: 'pending' | 'uploading' | 'success' | 'error';
  /** 错误信息（仅在 status 为 'error' 时有值） */
  error?: string;
}

/**
 * 预览 Store 状态接口
 */
interface PreviewState {
  /** 预览模态框是否打开 */
  isOpen: boolean;
  /** 当前预览的文档 ID */
  documentId: number | null;
}

/**
 * 预览 Store 操作接口
 */
interface PreviewActions {
  /** 打开预览模态框 */
  open: (id: number) => void;
  /** 关闭预览模态框 */
  close: () => void;
}

/**
 * 上传 Store 状态接口
 */
interface UploadState {
  /** 上传模态框是否打开 */
  isOpen: boolean;
  /** 待上传文件列表 */
  files: UploadFile[];
}

/**
 * 上传 Store 操作接口
 */
interface UploadActions {
  /** 打开上传模态框 */
  open: () => void;
  /** 关闭上传模态框 */
  close: () => void;
  /** 添加文件到上传列表 */
  addFiles: (files: File[]) => void;
  /** 从上传列表移除文件 */
  removeFile: (id: string) => void;
  /** 更新文件信息 */
  updateFile: (id: string, updates: Partial<UploadFile>) => void;
  /** 清空文件列表 */
  clearFiles: () => void;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成唯一 ID
 * 使用时间戳和随机数组合
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * 从文件名提取标题
 * 移除文件扩展名
 */
const extractTitleFromFile = (file: File): string => {
  const name = file.name;
  const lastDotIndex = name.lastIndexOf('.');
  return lastDotIndex > 0 ? name.substring(0, lastDotIndex) : name;
};

// ============================================================================
// Store 实现
// ============================================================================

/** 预览 Store 完整类型 */
export type PreviewStore = PreviewState & PreviewActions;

/** 上传 Store 完整类型 */
export type UploadStore = UploadState & UploadActions;

/**
 * 预览 Store
 * 
 * 管理文件预览模态框的状态
 * 
 * @example
 * ```tsx
 * const { isOpen, documentId, open, close } = usePreviewStore();
 * 
 * // 打开预览
 * open(123);
 * 
 * // 关闭预览
 * close();
 * ```
 */
export const usePreviewStore = create<PreviewStore>(
  (set: SetState<PreviewStore>, _get: GetState<PreviewStore>): PreviewStore => ({
    // 初始状态
    isOpen: false,
    documentId: null,

    // 打开预览模态框
    open: (id: number) => {
      set({
        isOpen: true,
        documentId: id,
      });
    },

    // 关闭预览模态框
    close: () => {
      set({
        isOpen: false,
        documentId: null,
      });
    },
  })
);

/**
 * 上传 Store
 * 
 * 管理文件上传模态框和上传文件列表的状态
 * 
 * @example
 * ```tsx
 * const { isOpen, files, open, close, addFiles, removeFile, updateFile, clearFiles } = useUploadStore();
 * 
 * // 打开上传模态框
 * open();
 * 
 * // 添加文件
 * addFiles(selectedFiles);
 * 
 * // 更新上传进度
 * updateFile(fileId, { progress: 50, status: 'uploading' });
 * 
 * // 移除文件
 * removeFile(fileId);
 * 
 * // 清空并关闭
 * clearFiles();
 * close();
 * ```
 */
export const useUploadStore = create<UploadStore>(
  (set: SetState<UploadStore>, _get: GetState<UploadStore>): UploadStore => ({
    // 初始状态
    isOpen: false,
    files: [],

    // 打开上传模态框
    open: () => {
      set({ isOpen: true });
    },

    // 关闭上传模态框
    close: () => {
      set({ isOpen: false });
    },

    // 添加文件到上传列表
    addFiles: (newFiles: File[]) => {
      const newUploadFiles: UploadFile[] = newFiles.map((file: File) => ({
        id: generateId(),
        file,
        title: extractTitleFromFile(file),
        tags: [],
        documentType: null,
        progress: 0,
        status: 'pending' as const,
      }));

      set((state) => ({
        files: [...state.files, ...newUploadFiles],
      }));
    },

    // 从上传列表移除文件
    removeFile: (id: string) => {
      set((state) => ({
        files: state.files.filter((file: UploadFile) => file.id !== id),
      }));
    },

    // 更新文件信息
    updateFile: (id: string, updates: Partial<UploadFile>) => {
      set((state) => ({
        files: state.files.map((file: UploadFile) =>
          file.id === id ? { ...file, ...updates } : file
        ),
      }));
    },

    // 清空文件列表
    clearFiles: () => {
      set({ files: [] });
    },
  })
);
