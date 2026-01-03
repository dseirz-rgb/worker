/**
 * 文件管理快捷键 Hook
 * 提供文件页面的键盘快捷键支持
 * 
 * 快捷键列表:
 * - Ctrl/Cmd+K: 聚焦搜索框
 * - Ctrl/Cmd+U: 打开上传对话框
 * - Escape: 关闭模态框/清除选择
 * - ↑/↓/←/→: 导航文档列表
 * - Enter: 打开预览
 * - Delete/Backspace: 删除选中文档
 * - Ctrl/Cmd+A: 全选
 */

import { useEffect, useCallback, useRef } from 'react';

// ========== 类型定义 ==========

interface UseFileKeyboardShortcutsOptions {
  /** 是否启用快捷键 */
  enabled?: boolean;
  /** 搜索框引用 */
  searchInputRef?: React.RefObject<HTMLInputElement>;
  /** 打开上传对话框 */
  onOpenUpload?: () => void;
  /** 关闭模态框 */
  onCloseModal?: () => void;
  /** 清除选择 */
  onClearSelection?: () => void;
  /** 打开预览 */
  onOpenPreview?: () => void;
  /** 删除选中文档 */
  onDelete?: () => void;
  /** 全选 */
  onSelectAll?: () => void;
  /** 导航到上一个文档 */
  onNavigatePrev?: () => void;
  /** 导航到下一个文档 */
  onNavigateNext?: () => void;
  /** 导航到上一行 */
  onNavigateUp?: () => void;
  /** 导航到下一行 */
  onNavigateDown?: () => void;
  /** 当前是否有模态框打开 */
  isModalOpen?: boolean;
  /** 当前是否有选中的文档 */
  hasSelection?: boolean;
}

interface ShortcutInfo {
  key: string;
  description: string;
  modifiers?: ('ctrl' | 'shift' | 'alt' | 'meta')[];
}

// ========== 快捷键列表 ==========

export const FILE_SHORTCUTS: ShortcutInfo[] = [
  { key: 'K', description: '聚焦搜索', modifiers: ['ctrl'] },
  { key: 'U', description: '上传文件', modifiers: ['ctrl'] },
  { key: 'A', description: '全选', modifiers: ['ctrl'] },
  { key: 'Escape', description: '关闭/取消' },
  { key: '↑↓←→', description: '导航列表' },
  { key: 'Enter', description: '打开预览' },
  { key: 'Delete', description: '删除选中' },
];

// ========== 主 Hook ==========

export function useFileKeyboardShortcuts({
  enabled = true,
  searchInputRef,
  onOpenUpload,
  onCloseModal,
  onClearSelection,
  onOpenPreview,
  onDelete,
  onSelectAll,
  onNavigatePrev,
  onNavigateNext,
  onNavigateUp,
  onNavigateDown,
  isModalOpen = false,
  hasSelection = false,
}: UseFileKeyboardShortcutsOptions) {
  // 防止重复触发
  const lastKeyTime = useRef<number>(0);
  const DEBOUNCE_MS = 100;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // 防抖
    const now = Date.now();
    if (now - lastKeyTime.current < DEBOUNCE_MS) return;
    lastKeyTime.current = now;

    // 检查是否在输入框中
    const target = event.target as HTMLElement;
    const isInInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

    // Escape - 关闭模态框或清除选择
    if (event.key === 'Escape') {
      event.preventDefault();
      if (isModalOpen) {
        onCloseModal?.();
      } else if (hasSelection) {
        onClearSelection?.();
      }
      return;
    }

    // 在输入框中时，只响应 Escape
    if (isInInput && event.key !== 'Escape') {
      // 允许 Ctrl+K 在输入框中也能聚焦搜索
      if (!(ctrlOrCmd && event.key.toLowerCase() === 'k')) {
        return;
      }
    }

    // Ctrl/Cmd+K - 聚焦搜索
    if (ctrlOrCmd && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      searchInputRef?.current?.focus();
      return;
    }

    // Ctrl/Cmd+U - 打开上传
    if (ctrlOrCmd && event.key.toLowerCase() === 'u') {
      event.preventDefault();
      onOpenUpload?.();
      return;
    }

    // Ctrl/Cmd+A - 全选
    if (ctrlOrCmd && event.key.toLowerCase() === 'a' && !isInInput) {
      event.preventDefault();
      onSelectAll?.();
      return;
    }

    // 模态框打开时不响应其他快捷键
    if (isModalOpen) return;

    // 方向键导航
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        onNavigatePrev?.();
        break;
      case 'ArrowRight':
        event.preventDefault();
        onNavigateNext?.();
        break;
      case 'ArrowUp':
        event.preventDefault();
        onNavigateUp?.();
        break;
      case 'ArrowDown':
        event.preventDefault();
        onNavigateDown?.();
        break;
      case 'Enter':
        if (hasSelection) {
          event.preventDefault();
          onOpenPreview?.();
        }
        break;
      case 'Delete':
      case 'Backspace':
        if (hasSelection && !isInInput) {
          event.preventDefault();
          onDelete?.();
        }
        break;
    }
  }, [
    enabled,
    searchInputRef,
    onOpenUpload,
    onCloseModal,
    onClearSelection,
    onOpenPreview,
    onDelete,
    onSelectAll,
    onNavigatePrev,
    onNavigateNext,
    onNavigateUp,
    onNavigateDown,
    isModalOpen,
    hasSelection,
  ]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  return {
    shortcuts: FILE_SHORTCUTS,
  };
}

export default useFileKeyboardShortcuts;
