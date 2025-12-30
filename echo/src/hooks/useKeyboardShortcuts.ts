import { useEffect, useCallback } from 'react';
import { ShortcutConfig } from '../types/navigation';

/**
 * 检查按键事件是否匹配快捷键配置
 */
function matchesShortcut(event: KeyboardEvent, config: ShortcutConfig): boolean {
  const key = event.key.toLowerCase();
  if (key !== config.key.toLowerCase()) return false;

  const hasCtrl = config.modifiers.includes('ctrl');
  const hasShift = config.modifiers.includes('shift');
  const hasAlt = config.modifiers.includes('alt');
  const hasMeta = config.modifiers.includes('meta');

  // macOS 使用 metaKey (Cmd), Windows/Linux 使用 ctrlKey
  const ctrlOrMeta = event.metaKey || event.ctrlKey;

  if (hasCtrl || hasMeta) {
    if (!ctrlOrMeta) return false;
  } else {
    if (ctrlOrMeta) return false;
  }

  if (hasShift !== event.shiftKey) return false;
  if (hasAlt !== event.altKey) return false;

  return true;
}

/**
 * 键盘快捷键 Hook
 * 注册全局键盘快捷键监听
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]): void {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // 忽略输入框中的快捷键
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    for (const shortcut of shortcuts) {
      if (matchesShortcut(event, shortcut)) {
        event.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * 解析快捷键字符串为配置
 * 例如: "Cmd+Shift+S" -> { key: 's', modifiers: ['meta', 'shift'] }
 */
export function parseShortcutString(shortcut: string): Omit<ShortcutConfig, 'action'> {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  const modifiers: ShortcutConfig['modifiers'] = [];

  for (let i = 0; i < parts.length - 1; i++) {
    const mod = parts[i];
    if (mod === 'cmd' || mod === 'meta') modifiers.push('meta');
    else if (mod === 'ctrl') modifiers.push('ctrl');
    else if (mod === 'shift') modifiers.push('shift');
    else if (mod === 'alt') modifiers.push('alt');
  }

  return { key, modifiers };
}

/**
 * 格式化快捷键显示文本
 * macOS 显示符号，其他平台显示文字
 */
export function formatShortcut(shortcut: string): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
  
  if (isMac) {
    return shortcut
      .replace(/Cmd\+/gi, '⌘')
      .replace(/Ctrl\+/gi, '⌃')
      .replace(/Shift\+/gi, '⇧')
      .replace(/Alt\+/gi, '⌥');
  }
  
  return shortcut.replace(/Cmd\+/gi, 'Ctrl+');
}
