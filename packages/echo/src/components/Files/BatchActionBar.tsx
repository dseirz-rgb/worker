/**
 * 批量操作工具栏组件
 * 显示在选中多个文档时，提供批量操作功能
 */

import { memo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Iconify/icons';
import { 
  Button, 
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Chip,
  Progress,
} from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/trpc';

// ========== 类型定义 ==========

interface PaperlessTag {
  id: number;
  name: string;
  color: string;
}

interface PaperlessDocumentType {
  id: number;
  name: string;
}

interface BatchActionBarProps {
  /** 选中的文档 ID 列表 */
  selectedIds: number[];
  /** 可用标签列表 */
  tags: PaperlessTag[];
  /** 可用文档类型列表 */
  documentTypes: PaperlessDocumentType[];
  /** 清除选择回调 */
  onClearSelection: () => void;
  /** 操作完成回调 */
  onActionComplete: () => void;
}

interface BatchOperationResult {
  success: number;
  failed: number;
  errors: string[];
}

// ========== 主组件 ==========

export const BatchActionBar = memo(({
  selectedIds,
  tags,
  documentTypes,
  onClearSelection,
  onActionComplete,
}: BatchActionBarProps) => {
  const { t } = useTranslation();
  
  // 状态
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BatchOperationResult | null>(null);
  
  // 标签选择状态
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tagAction, setTagAction] = useState<'add' | 'remove'>('add');
  
  // 文档类型选择状态
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);

  // 批量添加/移除标签
  const handleBatchTagOperation = useCallback(async () => {
    if (selectedTagIds.length === 0) return;
    
    setIsProcessing(true);
    setProgress(0);
    setResult(null);
    
    const results: BatchOperationResult = { success: 0, failed: 0, errors: [] };
    const total = selectedIds.length;
    
    for (let i = 0; i < selectedIds.length; i++) {
      const docId = selectedIds[i];
      try {
        // 获取当前文档
        const doc = await api.paperless.getDocument.query({ id: docId });
        if (!doc) {
          results.failed++;
          results.errors.push(`文档 ${docId} 不存在`);
          continue;
        }
        
        // 计算新的标签列表
        let newTags: number[];
        if (tagAction === 'add') {
          // 添加标签（去重）
          newTags = [...new Set([...doc.tags, ...selectedTagIds])];
        } else {
          // 移除标签
          newTags = doc.tags.filter((id: number) => !selectedTagIds.includes(id));
        }
        
        // 更新文档
        await api.paperless.updateDocument.mutate({
          id: docId,
          tagIds: newTags,
        });
        
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`文档 ${docId}: ${error instanceof Error ? error.message : '未知错误'}`);
      }
      
      setProgress(Math.round(((i + 1) / total) * 100));
    }
    
    setResult(results);
    setIsProcessing(false);
    
    if (results.success > 0) {
      onActionComplete();
    }
  }, [selectedIds, selectedTagIds, tagAction, onActionComplete]);

  // 批量更改文档类型
  const handleBatchTypeChange = useCallback(async () => {
    if (selectedTypeId === null) return;
    
    setIsProcessing(true);
    setProgress(0);
    setResult(null);
    
    const results: BatchOperationResult = { success: 0, failed: 0, errors: [] };
    const total = selectedIds.length;
    
    for (let i = 0; i < selectedIds.length; i++) {
      const docId = selectedIds[i];
      try {
        await api.paperless.updateDocument.mutate({
          id: docId,
          documentTypeId: selectedTypeId,
        });
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`文档 ${docId}: ${error instanceof Error ? error.message : '未知错误'}`);
      }
      
      setProgress(Math.round(((i + 1) / total) * 100));
    }
    
    setResult(results);
    setIsProcessing(false);
    
    if (results.success > 0) {
      onActionComplete();
    }
  }, [selectedIds, selectedTypeId, onActionComplete]);

  // 批量删除
  const handleBatchDelete = useCallback(async () => {
    setIsProcessing(true);
    setProgress(0);
    setResult(null);
    
    const results: BatchOperationResult = { success: 0, failed: 0, errors: [] };
    const total = selectedIds.length;
    
    for (let i = 0; i < selectedIds.length; i++) {
      const docId = selectedIds[i];
      try {
        await api.paperless.deleteDocument.mutate({ id: docId });
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`文档 ${docId}: ${error instanceof Error ? error.message : '未知错误'}`);
      }
      
      setProgress(Math.round(((i + 1) / total) * 100));
    }
    
    setResult(results);
    setIsProcessing(false);
    
    if (results.success > 0) {
      onClearSelection();
      onActionComplete();
    }
  }, [selectedIds, onClearSelection, onActionComplete]);

  // 关闭模态框并重置状态
  const closeTagModal = useCallback(() => {
    setIsTagModalOpen(false);
    setSelectedTagIds([]);
    setResult(null);
  }, []);

  const closeTypeModal = useCallback(() => {
    setIsTypeModalOpen(false);
    setSelectedTypeId(null);
    setResult(null);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    setResult(null);
  }, []);

  // 如果没有选中项，不显示
  if (selectedIds.length === 0) return null;

  return (
    <>
      {/* 批量操作工具栏 */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-2 px-4 py-3 bg-content1 rounded-xl shadow-lg border border-divider">
            {/* 选中计数 */}
            <div className="flex items-center gap-2 pr-3 border-r border-divider">
              <Chip size="sm" color="primary" variant="flat">
                {selectedIds.length}
              </Chip>
              <span className="text-sm text-foreground/70">
                {t('items-selected') || '项已选中'}
              </span>
            </div>

            {/* 添加标签 */}
            <Button
              size="sm"
              variant="flat"
              startContent={<Icon icon="solar:tag-linear" className="w-4 h-4" />}
              onPress={() => {
                setTagAction('add');
                setIsTagModalOpen(true);
              }}
            >
              {t('add-tags') || '添加标签'}
            </Button>

            {/* 移除标签 */}
            <Button
              size="sm"
              variant="flat"
              startContent={<Icon icon="solar:tag-cross-linear" className="w-4 h-4" />}
              onPress={() => {
                setTagAction('remove');
                setIsTagModalOpen(true);
              }}
            >
              {t('remove-tags') || '移除标签'}
            </Button>

            {/* 更改类型 */}
            <Button
              size="sm"
              variant="flat"
              startContent={<Icon icon="solar:document-linear" className="w-4 h-4" />}
              onPress={() => setIsTypeModalOpen(true)}
            >
              {t('change-type') || '更改类型'}
            </Button>

            {/* 删除 */}
            <Button
              size="sm"
              variant="flat"
              color="danger"
              startContent={<Icon icon="solar:trash-bin-trash-linear" className="w-4 h-4" />}
              onPress={() => setIsDeleteModalOpen(true)}
            >
              {t('delete') || '删除'}
            </Button>

            {/* 取消选择 */}
            <Button
              size="sm"
              variant="light"
              isIconOnly
              onPress={onClearSelection}
            >
              <Icon icon="solar:close-circle-linear" className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 标签操作模态框 */}
      <Modal isOpen={isTagModalOpen} onClose={closeTagModal}>
        <ModalContent>
          <ModalHeader>
            {tagAction === 'add' 
              ? (t('add-tags-to-documents') || '为文档添加标签')
              : (t('remove-tags-from-documents') || '从文档移除标签')
            }
          </ModalHeader>
          <ModalBody>
            {isProcessing ? (
              <div className="space-y-4">
                <Progress value={progress} color="primary" />
                <p className="text-center text-sm text-foreground/60">
                  {t('processing') || '处理中...'} {progress}%
                </p>
              </div>
            ) : result ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">{result.success}</div>
                    <div className="text-sm text-foreground/60">{t('success') || '成功'}</div>
                  </div>
                  {result.failed > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-danger">{result.failed}</div>
                      <div className="text-sm text-foreground/60">{t('failed') || '失败'}</div>
                    </div>
                  )}
                </div>
                {result.errors.length > 0 && (
                  <div className="text-sm text-danger">
                    {result.errors.slice(0, 3).map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                    {result.errors.length > 3 && (
                      <p>...还有 {result.errors.length - 3} 个错误</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-foreground/60">
                  {t('select-tags') || '选择标签'}:
                </p>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <Chip
                      key={tag.id}
                      variant={selectedTagIds.includes(tag.id) ? 'solid' : 'flat'}
                      className="cursor-pointer"
                      style={{ 
                        backgroundColor: selectedTagIds.includes(tag.id) ? tag.color : tag.color + '20',
                        color: selectedTagIds.includes(tag.id) ? 'white' : tag.color,
                      }}
                      onClick={() => {
                        setSelectedTagIds(prev => 
                          prev.includes(tag.id)
                            ? prev.filter(id => id !== tag.id)
                            : [...prev, tag.id]
                        );
                      }}
                    >
                      {tag.name}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={closeTagModal}>
              {result ? (t('close') || '关闭') : (t('cancel') || '取消')}
            </Button>
            {!result && (
              <Button 
                color="primary" 
                onPress={handleBatchTagOperation}
                isDisabled={selectedTagIds.length === 0}
                isLoading={isProcessing}
              >
                {tagAction === 'add' ? (t('add') || '添加') : (t('remove') || '移除')}
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 文档类型模态框 */}
      <Modal isOpen={isTypeModalOpen} onClose={closeTypeModal}>
        <ModalContent>
          <ModalHeader>{t('change-document-type') || '更改文档类型'}</ModalHeader>
          <ModalBody>
            {isProcessing ? (
              <div className="space-y-4">
                <Progress value={progress} color="primary" />
                <p className="text-center text-sm text-foreground/60">
                  {t('processing') || '处理中...'} {progress}%
                </p>
              </div>
            ) : result ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">{result.success}</div>
                    <div className="text-sm text-foreground/60">{t('success') || '成功'}</div>
                  </div>
                  {result.failed > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-danger">{result.failed}</div>
                      <div className="text-sm text-foreground/60">{t('failed') || '失败'}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-foreground/60">
                  {t('select-document-type') || '选择文档类型'}:
                </p>
                <div className="space-y-2">
                  {documentTypes.map(type => (
                    <div
                      key={type.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedTypeId === type.id 
                          ? 'bg-primary/10 border border-primary' 
                          : 'bg-default-100 hover:bg-default-200'
                      }`}
                      onClick={() => setSelectedTypeId(type.id)}
                    >
                      <Icon 
                        icon={selectedTypeId === type.id ? 'solar:check-circle-bold' : 'solar:document-linear'} 
                        className={`w-5 h-5 ${selectedTypeId === type.id ? 'text-primary' : 'text-foreground/50'}`}
                      />
                      <span>{type.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={closeTypeModal}>
              {result ? (t('close') || '关闭') : (t('cancel') || '取消')}
            </Button>
            {!result && (
              <Button 
                color="primary" 
                onPress={handleBatchTypeChange}
                isDisabled={selectedTypeId === null}
                isLoading={isProcessing}
              >
                {t('apply') || '应用'}
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal}>
        <ModalContent>
          <ModalHeader>{t('confirm-delete') || '确认删除'}</ModalHeader>
          <ModalBody>
            {isProcessing ? (
              <div className="space-y-4">
                <Progress value={progress} color="danger" />
                <p className="text-center text-sm text-foreground/60">
                  {t('deleting') || '删除中...'} {progress}%
                </p>
              </div>
            ) : result ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">{result.success}</div>
                    <div className="text-sm text-foreground/60">{t('deleted') || '已删除'}</div>
                  </div>
                  {result.failed > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-danger">{result.failed}</div>
                      <div className="text-sm text-foreground/60">{t('failed') || '失败'}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
                    <Icon icon="solar:trash-bin-trash-bold" className="w-8 h-8 text-danger" />
                  </div>
                </div>
                <p className="text-center">
                  {t('confirm-delete-files', { count: selectedIds.length }) || 
                    `确定要删除选中的 ${selectedIds.length} 个文件吗？此操作不可撤销。`}
                </p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={closeDeleteModal}>
              {result ? (t('close') || '关闭') : (t('cancel') || '取消')}
            </Button>
            {!result && (
              <Button 
                color="danger" 
                onPress={handleBatchDelete}
                isLoading={isProcessing}
              >
                {t('delete') || '删除'}
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
});

BatchActionBar.displayName = 'BatchActionBar';

export default BatchActionBar;
