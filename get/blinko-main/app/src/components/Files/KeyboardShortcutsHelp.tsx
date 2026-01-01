/**
 * 快捷键帮助提示组件
 * 显示文件管理页面可用的键盘快捷键
 */

import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Iconify/icons';
import { 
  Button, 
  Popover, 
  PopoverTrigger, 
  PopoverContent,
  Kbd,
} from '@heroui/react';
import { FILE_SHORTCUTS } from '@/hooks/useFileKeyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  /** 按钮大小 */
  size?: 'sm' | 'md' | 'lg';
}

export const KeyboardShortcutsHelp = memo(({ size = 'sm' }: KeyboardShortcutsHelpProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // 检测是否为 Mac
  const isMac = typeof navigator !== 'undefined' && 
    navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen} placement="bottom-end">
      <PopoverTrigger>
        <Button
          isIconOnly
          variant="light"
          size={size}
          aria-label={t('keyboard-shortcuts') || '快捷键'}
        >
          <Icon icon="solar:keyboard-linear" className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="p-3 space-y-3">
          <h4 className="font-medium text-sm">
            {t('keyboard-shortcuts') || '快捷键'}
          </h4>
          <div className="space-y-2">
            {FILE_SHORTCUTS.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-foreground/70">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.modifiers?.includes('ctrl') && (
                    <Kbd>{modKey}</Kbd>
                  )}
                  {shortcut.modifiers?.includes('shift') && (
                    <Kbd>Shift</Kbd>
                  )}
                  {shortcut.modifiers?.includes('alt') && (
                    <Kbd>{isMac ? '⌥' : 'Alt'}</Kbd>
                  )}
                  <Kbd>{shortcut.key}</Kbd>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

KeyboardShortcutsHelp.displayName = 'KeyboardShortcutsHelp';

export default KeyboardShortcutsHelp;
