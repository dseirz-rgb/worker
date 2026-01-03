/**
 * 通讯者管理组件
 * 提供通讯者的创建、编辑、删除功能
 * 
 * @module components/Files/CorrespondentManager
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
  useCorrespondents, 
  type PaperlessCorrespondent 
} from '@/hooks/usePaperless';

interface CorrespondentManagerProps {
  isOpen: boolean;
  onClose: () => void;
}


export const CorrespondentManager = memo(({ isOpen, onClose }: CorrespondentManagerProps) => {
  const { t } = useTranslation();
  const { data: correspondents, isLoading, refetch } = useCorrespondents();

  // 新建状态
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // 创建通讯者 (当前后端暂不支持)
  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    
    setCreateError(null);
    try {
      // 注意：当前后端暂不支持通讯者功能
      // 这里预留接口，待后端实现后启用
      setCreateError(t('correspondent-not-supported') || '当前后端暂不支持通讯者功能');
    } catch (err) {
      console.error('创建通讯者失败:', err);
      setCreateError(err instanceof Error ? err.message : '创建失败');
    }
  }, [newName, t]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon icon="solar:user-bold" className="w-5 h-5 text-primary" />
          {t('manage-correspondents') || '管理通讯者'}
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
              {t('create-correspondent') || '新建通讯者'}
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
                label={t('correspondent-name') || '通讯者名称'}
                value={newName}
                onValueChange={setNewName}
                placeholder={t('enter-correspondent-name') || '输入通讯者名称'}
                autoFocus
              />
              
              {createError && (
                <div className="text-xs text-danger flex items-center gap-1">
                  <Icon icon="solar:danger-triangle-linear" className="w-4 h-4" />
                  {createError}
                </div>
              )}
              
              <div className="flex gap-2 pt-2">
                <Button 
                  size="sm" 
                  variant="light" 
                  onPress={() => {
                    setIsCreating(false);
                    setNewName('');
                    setCreateError(null);
                  }}
                >
                  {t('cancel') || '取消'}
                </Button>
                <Button 
                  size="sm" 
                  color="primary" 
                  onPress={handleCreate}
                  isDisabled={!newName.trim()}
                >
                  {t('create') || '创建'}
                </Button>
              </div>
            </motion.div>
          )}

          {/* 通讯者列表 */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Icon icon="solar:refresh-linear" className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : correspondents.length === 0 ? (
              <div className="text-center py-8 text-foreground/50">
                {t('no-correspondents') || '暂无通讯者'}
              </div>
            ) : (
              <AnimatePresence>
                {correspondents.map(correspondent => (
                  <CorrespondentItem key={correspondent.id} correspondent={correspondent} />
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* 说明文字 */}
          <div className="text-xs text-foreground/50 p-3 bg-default-50 rounded-lg">
            <Icon icon="solar:info-circle-linear" className="w-4 h-4 inline mr-1" />
            {t('correspondent-note') || '通讯者用于标记文档的来源或发送者，便于分类管理。'}
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

CorrespondentManager.displayName = 'CorrespondentManager';


// ============================================
// 子组件
// ============================================

/** 通讯者项 */
interface CorrespondentItemProps {
  correspondent: PaperlessCorrespondent;
}

const CorrespondentItem = memo(({ correspondent }: CorrespondentItemProps) => {
  const { t } = useTranslation();
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex items-center justify-between p-3 bg-default-50 rounded-lg"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon icon="solar:user-linear" className="w-4 h-4 text-primary" />
        </div>
        <span className="font-medium">{correspondent.name}</span>
        <Chip size="sm" variant="flat">
          {correspondent.document_count || 0} {t('documents') || '文档'}
        </Chip>
      </div>
    </motion.div>
  );
});

CorrespondentItem.displayName = 'CorrespondentItem';

export default CorrespondentManager;
