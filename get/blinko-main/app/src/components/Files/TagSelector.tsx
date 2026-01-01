/**
 * 标签选择器组件
 * 支持多选、搜索过滤和新建标签
 */

import { memo, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Iconify/icons';
import {
  Chip,
  Input,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Popover,
  PopoverTrigger,
  PopoverContent,
  ScrollShadow,
} from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';

// 预设颜色列表
const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
];

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface TagSelectorProps {
  value: number[];
  onChange: (tagIds: number[]) => void;
  tags: Tag[];
  onCreateTag?: (name: string, color: string) => Promise<void>;
  disabled?: boolean;
}

export const TagSelector = memo(({
  value,
  onChange,
  tags,
  onCreateTag,
  disabled = false,
}: TagSelectorProps) => {
  const { t } = useTranslation();
  
  // 搜索和过滤状态
  const [searchQuery, setSearchQuery] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  // 新建标签状态
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  // 过滤后的标签列表
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const query = searchQuery.toLowerCase();
    return tags.filter(tag => tag.name.toLowerCase().includes(query));
  }, [tags, searchQuery]);

  // 已选中的标签
  const selectedTags = useMemo(() => {
    return tags.filter(tag => value.includes(tag.id));
  }, [tags, value]);

  // 切换标签选中状态
  const handleToggleTag = useCallback((tagId: number) => {
    if (disabled) return;
    if (value.includes(tagId)) {
      onChange(value.filter(id => id !== tagId));
    } else {
      onChange([...value, tagId]);
    }
  }, [value, onChange, disabled]);

  // 移除标签
  const handleRemoveTag = useCallback((tagId: number) => {
    if (disabled) return;
    onChange(value.filter(id => id !== tagId));
  }, [value, onChange, disabled]);

  // 创建新标签
  const handleCreateTag = useCallback(async () => {
    if (!onCreateTag || !newTagName.trim()) return;
    
    setIsCreating(true);
    try {
      await onCreateTag(newTagName.trim(), newTagColor);
      setNewTagName('');
      setNewTagColor(PRESET_COLORS[0]);
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('创建标签失败:', error);
    } finally {
      setIsCreating(false);
    }
  }, [onCreateTag, newTagName, newTagColor]);

  // 打开新建标签弹窗
  const handleOpenCreateModal = useCallback(() => {
    // 如果搜索框有内容，用作新标签名称
    if (searchQuery.trim()) {
      setNewTagName(searchQuery.trim());
    }
    setIsCreateModalOpen(true);
    setIsPopoverOpen(false);
  }, [searchQuery]);

  return (
    <div className="space-y-2">
      {/* 已选标签显示 */}
      <div className="flex flex-wrap gap-1 min-h-[32px]">
        <AnimatePresence mode="popLayout">
          {selectedTags.map(tag => (
            <motion.div
              key={tag.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
            >
              <Chip
                size="sm"
                variant="flat"
                onClose={disabled ? undefined : () => handleRemoveTag(tag.id)}
                className="cursor-default"
                style={{
                  backgroundColor: tag.color + '20',
                  color: tag.color,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full mr-1 inline-block"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </Chip>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {/* 添加标签按钮 */}
        {!disabled && (
          <Popover
            isOpen={isPopoverOpen}
            onOpenChange={setIsPopoverOpen}
            placement="bottom-start"
          >
            <PopoverTrigger>
              <Button
                size="sm"
                variant="flat"
                className="h-6 min-w-0 px-2"
                startContent={<Icon icon="solar:add-circle-linear" className="w-4 h-4" />}
              >
                {t('add-tag') || '添加标签'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0">
              <div className="p-2">
                {/* 搜索框 */}
                <Input
                  size="sm"
                  placeholder={t('search-tags') || '搜索标签...'}
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  startContent={<Icon icon="solar:magnifer-linear" className="w-4 h-4 text-foreground/50" />}
                  classNames={{
                    inputWrapper: 'bg-default-100',
                  }}
                />
              </div>
              
              {/* 标签列表 */}
              <ScrollShadow className="max-h-48 px-2">
                {filteredTags.length === 0 ? (
                  <div className="py-4 text-center text-sm text-foreground/50">
                    {searchQuery ? (
                      <span>{t('no-matching-tags') || '没有匹配的标签'}</span>
                    ) : (
                      <span>{t('no-tags') || '暂无标签'}</span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1 pb-2">
                    {filteredTags.map(tag => {
                      const isSelected = value.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => handleToggleTag(tag.id)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all
                            ${isSelected
                              ? 'bg-primary/20'
                              : 'hover:bg-default-100'
                            }`}
                        >
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="text-sm truncate flex-1">{tag.name}</span>
                          {isSelected && (
                            <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollShadow>
              
              {/* 新建标签按钮 */}
              {onCreateTag && (
                <div className="p-2 border-t border-divider">
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    className="w-full"
                    startContent={<Icon icon="solar:add-circle-linear" className="w-4 h-4" />}
                    onPress={handleOpenCreateModal}
                  >
                    {searchQuery.trim()
                      ? `${t('create-tag') || '创建标签'} "${searchQuery.trim()}"`
                      : t('create-new-tag') || '创建新标签'
                    }
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* 新建标签弹窗 */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        size="sm"
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Icon icon="solar:tag-bold" className="w-5 h-5 text-primary" />
            {t('create-new-tag') || '创建新标签'}
          </ModalHeader>
          
          <ModalBody className="space-y-4">
            {/* 标签名称 */}
            <Input
              label={t('tag-name') || '标签名称'}
              placeholder={t('enter-tag-name') || '输入标签名称'}
              value={newTagName}
              onValueChange={setNewTagName}
              autoFocus
            />
            
            {/* 颜色选择 */}
            <div>
              <label className="text-sm text-foreground/70 mb-2 block">
                {t('tag-color') || '标签颜色'}
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    className={`w-7 h-7 rounded-full transition-all ${
                      newTagColor === color
                        ? 'ring-2 ring-offset-2 ring-primary scale-110'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            
            {/* 预览 */}
            <div>
              <label className="text-sm text-foreground/70 mb-2 block">
                {t('preview') || '预览'}
              </label>
              <Chip
                size="md"
                variant="flat"
                style={{
                  backgroundColor: newTagColor + '20',
                  color: newTagColor,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full mr-1 inline-block"
                  style={{ backgroundColor: newTagColor }}
                />
                {newTagName || t('new-tag') || '新标签'}
              </Chip>
            </div>
          </ModalBody>
          
          <ModalFooter>
            <Button variant="light" onPress={() => setIsCreateModalOpen(false)}>
              {t('cancel') || '取消'}
            </Button>
            <Button
              color="primary"
              onPress={handleCreateTag}
              isDisabled={!newTagName.trim()}
              isLoading={isCreating}
            >
              {t('create') || '创建'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
});

TagSelector.displayName = 'TagSelector';
