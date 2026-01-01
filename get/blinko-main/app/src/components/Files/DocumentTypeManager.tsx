/**
 * 文档类型管理组件
 * 提供文档类型的创建、编辑、删除功能
 * 
 * @module components/Files/DocumentTypeManager
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
} from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  useDocumentTypes, 
  useCreateDocumentType, 
  type PaperlessDocumentType 
} from '@/hooks/usePaperless';

interface DocumentTypeManagerProps {
  isOpen: boolean;
  onClose: () => void;
}


export const DocumentTypeManager = memo(({ isOpen, onClose }: DocumentTypeManagerProps) => {
  const { t } = useTranslation();
  const { data: documentTypes, isLoading, refetch } = useDocumentTypes();
  const createDocumentType = useCreateDocumentType();

  // 新建状态
  const [isCreating, setIsCreating] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  // 创建文档类型
  const handleCreate = useCallback(async () => {
    if (!newTypeName.trim()) return;
    
    try {
      await createDocumentType.mutate({ name: newTypeName.trim() });
      setNewTypeName('');
      setIsCreating(false);
      refetch();
    } catch (err) {
      console.error('创建文档类型失败:', err);
    }
  }, [newTypeName, createDocumentType, refetch]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon icon="solar:folder-bold" className="w-5 h-5 text-primary" />
          {t('manage-document-types') || '管理文档类型'}
        </ModalHeader>
        
        <ModalBody className="space-y-4">
          {/* 新建按钮/表单 */}
          {!isCreating ? (
            <Button
              variant="flat"
              color="primary"
              startContent={<Icon icon="solar:add-circle-linear" />}
              onPress={() => setIsCreating(true)}
            >
              {t('create-document-type') || '新建文档类型'}
            </Button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 bg-default-50 rounded-lg border border-divider space-y-3"
            >
              <Input
                size="sm"
                label={t('type-name') || '类型名称'}
                value={newTypeName}
                onValueChange={setNewTypeName}
                placeholder={t('enter-type-name') || '输入类型名称'}
                autoFocus
              />
              
              <div className="flex gap-2 pt-2">
                <Button 
                  size="sm" 
                  variant="light" 
                  onPress={() => {
                    setIsCreating(false);
                    setNewTypeName('');
                  }}
                >
                  {t('cancel') || '取消'}
                </Button>
                <Button 
                  size="sm" 
                  color="primary" 
                  onPress={handleCreate}
                  isDisabled={!newTypeName.trim()}
                  isLoading={createDocumentType.isLoading}
                >
                  {t('create') || '创建'}
                </Button>
              </div>
            </motion.div>
          )}

          {/* 类型列表 */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Icon icon="solar:refresh-linear" className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : documentTypes.length === 0 ? (
              <div className="text-center py-8 text-foreground/50">
                {t('no-document-types') || '暂无文档类型'}
              </div>
            ) : (
              <AnimatePresence>
                {documentTypes.map(type => (
                  <DocumentTypeItem key={type.id} type={type} />
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* 说明文字 */}
          <div className="text-xs text-foreground/50 p-3 bg-default-50 rounded-lg">
            <Icon icon="solar:info-circle-linear" className="w-4 h-4 inline mr-1" />
            {t('document-type-note') || '文档类型是根据文件扩展名自动聚合的，无法手动删除。'}
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

DocumentTypeManager.displayName = 'DocumentTypeManager';


// ============================================
// 子组件
// ============================================

/** 文档类型项 */
interface DocumentTypeItemProps {
  type: PaperlessDocumentType;
}

const DocumentTypeItem = memo(({ type }: DocumentTypeItemProps) => {
  const { t } = useTranslation();
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex items-center justify-between p-3 bg-default-50 rounded-lg"
    >
      <div className="flex items-center gap-3">
        <Icon icon="solar:folder-linear" className="w-5 h-5 text-foreground/60" />
        <span className="font-medium">{type.name}</span>
        <Chip size="sm" variant="flat">
          {type.document_count || 0} {t('documents') || '文档'}
        </Chip>
      </div>
    </motion.div>
  );
});

DocumentTypeItem.displayName = 'DocumentTypeItem';

export default DocumentTypeManager;
