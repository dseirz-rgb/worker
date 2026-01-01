/**
 * 通讯者选择器组件
 * 支持下拉选择、搜索过滤和新建通讯者
 */

import { memo, useState, useCallback, useMemo } from 'react';
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

interface Correspondent {
  id: number;
  name: string;
}

interface CorrespondentSelectorProps {
  value: number | null;
  onChange: (correspondentId: number | null) => void;
  correspondents: Correspondent[];
  onCreateCorrespondent?: (name: string) => Promise<void>;
  disabled?: boolean;
}

export const CorrespondentSelector = memo(({
  value,
  onChange,
  correspondents,
  onCreateCorrespondent,
  disabled = false,
}: CorrespondentSelectorProps) => {
  const { t } = useTranslation();
  
  // 搜索过滤状态
  const [searchQuery, setSearchQuery] = useState('');
  
  // 新建通讯者状态
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCorrespondentName, setNewCorrespondentName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // 过滤后的通讯者列表
  const filteredCorrespondents = useMemo(() => {
    if (!searchQuery.trim()) return correspondents;
    const query = searchQuery.toLowerCase();
    return correspondents.filter(c => c.name.toLowerCase().includes(query));
  }, [correspondents, searchQuery]);

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

  // 创建新通讯者
  const handleCreateCorrespondent = useCallback(async () => {
    if (!onCreateCorrespondent || !newCorrespondentName.trim()) return;
    
    setIsCreating(true);
    try {
      await onCreateCorrespondent(newCorrespondentName.trim());
      setNewCorrespondentName('');
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('创建通讯者失败:', error);
    } finally {
      setIsCreating(false);
    }
  }, [onCreateCorrespondent, newCorrespondentName]);

  // 打开新建通讯者弹窗
  const handleOpenCreateModal = useCallback(() => {
    // 如果搜索框有内容，用作新通讯者名称
    if (searchQuery.trim()) {
      setNewCorrespondentName(searchQuery.trim());
    }
    setIsCreateModalOpen(true);
  }, [searchQuery]);

  // 根据通讯者名称返回对应图标
  const getCorrespondentIcon = (name: string): string => {
    const lowerName = name.toLowerCase();
    // 公司/组织相关
    if (lowerName.includes('公司') || lowerName.includes('company') || 
        lowerName.includes('corp') || lowerName.includes('inc') ||
        lowerName.includes('ltd') || lowerName.includes('有限')) {
      return 'solar:buildings-bold';
    }
    // 银行相关
    if (lowerName.includes('银行') || lowerName.includes('bank')) {
      return 'solar:bank-bold';
    }
    // 政府/机构相关
    if (lowerName.includes('政府') || lowerName.includes('government') ||
        lowerName.includes('局') || lowerName.includes('部') ||
        lowerName.includes('委员会') || lowerName.includes('office')) {
      return 'solar:buildings-2-bold';
    }
    // 医院/医疗相关
    if (lowerName.includes('医院') || lowerName.includes('hospital') ||
        lowerName.includes('诊所') || lowerName.includes('clinic')) {
      return 'solar:hospital-bold';
    }
    // 学校/教育相关
    if (lowerName.includes('学校') || lowerName.includes('school') ||
        lowerName.includes('大学') || lowerName.includes('university') ||
        lowerName.includes('学院') || lowerName.includes('college')) {
      return 'solar:square-academic-cap-bold';
    }
    // 默认使用用户图标
    return 'solar:user-bold';
  };

  // 获取当前选中的通讯者名称
  const selectedCorrespondentName = useMemo(() => {
    if (value === null) return '';
    return correspondents.find(c => c.id === value)?.name || '';
  }, [value, correspondents]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {/* 下拉选择器 */}
        <Select
          label={t('correspondent') || '通讯者'}
          placeholder={t('select-correspondent') || '选择通讯者'}
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
                icon={getCorrespondentIcon(selectedCorrespondentName)}
                className="w-4 h-4 text-foreground/60"
              />
            ) : (
              <Icon
                icon="solar:user-linear"
                className="w-4 h-4 text-foreground/40"
              />
            )
          }
        >
          {filteredCorrespondents.map(correspondent => (
            <SelectItem
              key={String(correspondent.id)}
              startContent={
                <Icon
                  icon={getCorrespondentIcon(correspondent.name)}
                  className="w-4 h-4 text-foreground/60"
                />
              }
            >
              {correspondent.name}
            </SelectItem>
          ))}
        </Select>

        {/* 新建通讯者按钮 */}
        {onCreateCorrespondent && !disabled && (
          <Button
            isIconOnly
            variant="flat"
            className="min-w-[40px] h-[40px] self-end"
            onPress={handleOpenCreateModal}
            title={t('create-correspondent') || '创建通讯者'}
          >
            <Icon icon="solar:user-plus-linear" className="w-5 h-5" />
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

      {/* 新建通讯者弹窗 */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        size="sm"
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Icon icon="solar:user-plus-bold" className="w-5 h-5 text-primary" />
            {t('create-correspondent') || '创建通讯者'}
          </ModalHeader>
          
          <ModalBody>
            <Input
              label={t('correspondent-name') || '通讯者名称'}
              placeholder={t('enter-correspondent-name') || '输入通讯者名称'}
              value={newCorrespondentName}
              onValueChange={setNewCorrespondentName}
              autoFocus
              description={t('correspondent-description') || '例如：公司名称、个人姓名、机构名称等'}
              startContent={
                <Icon
                  icon={getCorrespondentIcon(newCorrespondentName)}
                  className="w-4 h-4 text-foreground/50"
                />
              }
            />
          </ModalBody>
          
          <ModalFooter>
            <Button variant="light" onPress={() => setIsCreateModalOpen(false)}>
              {t('cancel') || '取消'}
            </Button>
            <Button
              color="primary"
              onPress={handleCreateCorrespondent}
              isDisabled={!newCorrespondentName.trim()}
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

CorrespondentSelector.displayName = 'CorrespondentSelector';
