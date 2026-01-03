/**
 * 文档类型选择器组件
 * 支持下拉选择和新建类型
 */

import { memo, useState, useCallback } from 'react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Iconify/icons';
import {
  Select,
  SelectItem,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
} from '@heroui/react';

interface DocumentType {
  id: number;
  name: string;
}

interface DocumentTypeSelectorProps {
  value: number | null;
  onChange: (typeId: number | null) => void;
  documentTypes: DocumentType[];
  onCreateType?: (name: string) => Promise<void>;
  disabled?: boolean;
}

export const DocumentTypeSelector = memo(({
  value,
  onChange,
  documentTypes,
  onCreateType,
  disabled = false,
}: DocumentTypeSelectorProps) => {
  const { t } = useTranslation();
  
  // 新建类型状态
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // 处理选择变化
  const handleSelectionChange = useCallback((keys: 'all' | Set<React.Key>) => {
    if (keys === 'all') return;
    const selectedKey = Array.from(keys)[0];
    if (selectedKey === undefined || selectedKey === '') {
      onChange(null);
    } else {
      onChange(Number(selectedKey));
    }
  }, [onChange]);

  // 创建新类型
  const handleCreateType = useCallback(async () => {
    if (!onCreateType || !newTypeName.trim()) return;
    
    setIsCreating(true);
    try {
      await onCreateType(newTypeName.trim());
      setNewTypeName('');
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('创建文档类型失败:', error);
    } finally {
      setIsCreating(false);
    }
  }, [onCreateType, newTypeName]);

  // 根据文档类型名称返回对应图标
  const getDocumentTypeIcon = (name: string): string => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('invoice') || lowerName.includes('发票')) {
      return 'solar:bill-list-bold';
    }
    if (lowerName.includes('contract') || lowerName.includes('合同')) {
      return 'solar:document-text-bold';
    }
    if (lowerName.includes('receipt') || lowerName.includes('收据')) {
      return 'solar:receipt-bold';
    }
    if (lowerName.includes('letter') || lowerName.includes('信件')) {
      return 'solar:letter-bold';
    }
    if (lowerName.includes('report') || lowerName.includes('报告')) {
      return 'solar:chart-bold';
    }
    if (lowerName.includes('manual') || lowerName.includes('手册')) {
      return 'solar:book-bold';
    }
    if (lowerName.includes('certificate') || lowerName.includes('证书')) {
      return 'solar:diploma-bold';
    }
    return 'solar:document-bold';
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {/* 下拉选择器 */}
        <Select
          label={t('document-type') || '文档类型'}
          placeholder={t('select-document-type') || '选择文档类型'}
          selectedKeys={value !== null ? [String(value)] : []}
          onSelectionChange={handleSelectionChange}
          isDisabled={disabled}
          className="flex-1"
          classNames={{
            trigger: 'min-h-[40px]',
          }}
          startContent={
            value !== null ? (
              <Icon
                icon={getDocumentTypeIcon(
                  documentTypes.find(t => t.id === value)?.name || ''
                )}
                className="w-4 h-4 text-foreground/60"
              />
            ) : null
          }
        >
          {documentTypes.map(type => (
            <SelectItem
              key={String(type.id)}
              startContent={
                <Icon
                  icon={getDocumentTypeIcon(type.name)}
                  className="w-4 h-4 text-foreground/60"
                />
              }
            >
              {type.name}
            </SelectItem>
          ))}
        </Select>

        {/* 新建类型按钮 */}
        {onCreateType && !disabled && (
          <Button
            isIconOnly
            variant="flat"
            className="min-w-[40px] h-[40px] self-end"
            onPress={() => setIsCreateModalOpen(true)}
          >
            <Icon icon="solar:add-circle-linear" className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* 清除选择按钮 */}
      {value !== null && !disabled && (
        <Button
          size="sm"
          variant="light"
          className="h-6 px-2"
          startContent={<Icon icon="solar:close-circle-linear" className="w-4 h-4" />}
          onPress={() => onChange(null)}
        >
          {t('clear-selection') || '清除选择'}
        </Button>
      )}

      {/* 新建类型弹窗 */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        size="sm"
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Icon icon="solar:document-add-bold" className="w-5 h-5 text-primary" />
            {t('create-document-type') || '创建文档类型'}
          </ModalHeader>
          
          <ModalBody>
            <Input
              label={t('type-name') || '类型名称'}
              placeholder={t('enter-type-name') || '输入类型名称'}
              value={newTypeName}
              onValueChange={setNewTypeName}
              autoFocus
              description={t('document-type-description') || '例如：发票、合同、收据、报告等'}
            />
          </ModalBody>
          
          <ModalFooter>
            <Button variant="light" onPress={() => setIsCreateModalOpen(false)}>
              {t('cancel') || '取消'}
            </Button>
            <Button
              color="primary"
              onPress={handleCreateType}
              isDisabled={!newTypeName.trim()}
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

DocumentTypeSelector.displayName = 'DocumentTypeSelector';
