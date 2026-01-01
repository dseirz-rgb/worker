/**
 * 标签管理组件
 * 提供标签的创建、编辑、删除功能
 * 
 * @module components/Files/TagManager
 */

import { memo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Iconify/icons';
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  Button,
  Input,
  Chip,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTags, useCreateTag, useDeleteTag, type PaperlessTag } from '@/hooks/usePaperless';

// 预设颜色列表
const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#78716c', '#71717a',
];

interface TagManagerProps {
  isOpen: boolean;
  onClose: () => void;
}


export const TagManager = memo(({ isOpen, onClose }: TagManagerProps) => {
  const { t } = useTranslation();
  const { data: tags, isLoading, refetch } = useTags();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();

  // 新建标签状态
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  
  // 删除确认状态
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // 创建标签
  const handleCreate = useCallback(async () => {
    if (!newTagName.trim()) return;
    
    try {
      await createTag.mutate({ name: newTagName.trim(), color: newTagColor });
      setNewTagName('');
      setNewTagColor(PRESET_COLORS[0]);
      setIsCreating(false);
      refetch();
    } catch (err) {
      console.error('创建标签失败:', err);
    }
  }, [newTagName, newTagColor, createTag, refetch]);

  // 删除标签
  const handleDelete = useCallback(async (id: number) => {
    try {
      await deleteTag.mutate({ id });
      setDeleteConfirmId(null);
      refetch();
    } catch (err) {
      console.error('删除标签失败:', err);
    }
  }, [deleteTag, refetch]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon icon="solar:tag-bold" className="w-5 h-5 text-primary" />
          {t('manage-tags') || '管理标签'}
        </ModalHeader>
        
        <ModalBody className="space-y-4">
          {/* 新建标签按钮/表单 */}
          {!isCreating ? (
            <Button
              variant="flat"
              color="primary"
              startContent={<Icon icon="solar:add-circle-linear" />}
              onPress={() => setIsCreating(true)}
            >
              {t('create-tag') || '新建标签'}
            </Button>
          ) : (
            <CreateTagForm
              name={newTagName}
              color={newTagColor}
              onNameChange={setNewTagName}
              onColorChange={setNewTagColor}
              onSubmit={handleCreate}
              onCancel={() => {
                setIsCreating(false);
                setNewTagName('');
              }}
              isLoading={createTag.isLoading}
            />
          )}

          {/* 标签列表 */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Icon icon="solar:refresh-linear" className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : tags.length === 0 ? (
              <div className="text-center py-8 text-foreground/50">
                {t('no-tags') || '暂无标签'}
              </div>
            ) : (
              <AnimatePresence>
                {tags.map(tag => (
                  <TagItem
                    key={tag.id}
                    tag={tag}
                    isDeleting={deleteConfirmId === tag.id}
                    onDeleteClick={() => setDeleteConfirmId(tag.id)}
                    onDeleteConfirm={() => handleDelete(tag.id)}
                    onDeleteCancel={() => setDeleteConfirmId(null)}
                    deleteLoading={deleteTag.isLoading}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {t('close') || '关闭'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
});

TagManager.displayName = 'TagManager';


// ============================================
// 子组件
// ============================================

/** 创建标签表单 */
interface CreateTagFormProps {
  name: string;
  color: string;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

const CreateTagForm = memo(({
  name, color, onNameChange, onColorChange, onSubmit, onCancel, isLoading
}: CreateTagFormProps) => {
  const { t } = useTranslation();
  
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="p-4 bg-default-50 rounded-lg border border-divider space-y-3"
    >
      <Input
        size="sm"
        label={t('tag-name') || '标签名称'}
        value={name}
        onValueChange={onNameChange}
        placeholder={t('enter-tag-name') || '输入标签名称'}
        autoFocus
      />
      
      <div>
        <label className="text-sm text-foreground/70 mb-2 block">
          {t('tag-color') || '标签颜色'}
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              type="button"
              className={`w-6 h-6 rounded-full transition-transform ${
                color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
              }`}
              style={{ backgroundColor: c }}
              onClick={() => onColorChange(c)}
            />
          ))}
        </div>
      </div>
      
      <div className="flex gap-2 pt-2">
        <Button size="sm" variant="light" onPress={onCancel}>
          {t('cancel') || '取消'}
        </Button>
        <Button 
          size="sm" 
          color="primary" 
          onPress={onSubmit}
          isDisabled={!name.trim()}
          isLoading={isLoading}
        >
          {t('create') || '创建'}
        </Button>
      </div>
    </motion.div>
  );
});

CreateTagForm.displayName = 'CreateTagForm';


/** 标签项 */
interface TagItemProps {
  tag: PaperlessTag;
  isDeleting: boolean;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  deleteLoading: boolean;
}

const TagItem = memo(({
  tag, isDeleting, onDeleteClick, onDeleteConfirm, onDeleteCancel, deleteLoading
}: TagItemProps) => {
  const { t } = useTranslation();
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex items-center justify-between p-3 bg-default-50 rounded-lg"
    >
      <div className="flex items-center gap-3">
        <div 
          className="w-4 h-4 rounded-full" 
          style={{ backgroundColor: tag.color }}
        />
        <span className="font-medium">{tag.name}</span>
        <Chip size="sm" variant="flat">
          {tag.document_count || 0} {t('documents') || '文档'}
        </Chip>
      </div>
      
      <div className="flex items-center gap-2">
        {isDeleting ? (
          <>
            <span className="text-sm text-danger mr-2">
              {t('confirm-delete') || '确认删除?'}
            </span>
            <Button
              size="sm"
              variant="light"
              onPress={onDeleteCancel}
            >
              {t('cancel') || '取消'}
            </Button>
            <Button
              size="sm"
              color="danger"
              onPress={onDeleteConfirm}
              isLoading={deleteLoading}
            >
              {t('delete') || '删除'}
            </Button>
          </>
        ) : (
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            onPress={onDeleteClick}
          >
            <Icon icon="solar:trash-bin-trash-linear" className="w-4 h-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
});

TagItem.displayName = 'TagItem';

export default TagManager;
