/**
 * 文件侧边栏组件
 * 显示标签和文档类型过滤器
 */

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Iconify/icons';
import { Button, Skeleton, ScrollShadow } from '@heroui/react';
import { motion } from 'framer-motion';

interface PaperlessTag {
  id: number;
  name: string;
  color: string;
}

interface PaperlessDocumentType {
  id: number;
  name: string;
}

interface FileSidebarProps {
  tags: PaperlessTag[];
  documentTypes: PaperlessDocumentType[];
  selectedTagIds: number[];
  selectedDocumentTypeId?: number;
  onTagSelect: (tagIds: number[]) => void;
  onDocumentTypeSelect: (typeId?: number) => void;
  isLoading?: boolean;
  isMobile?: boolean;
}

export const FileSidebar = memo(({
  tags,
  documentTypes,
  selectedTagIds,
  selectedDocumentTypeId,
  onTagSelect,
  onDocumentTypeSelect,
  isLoading,
  isMobile,
}: FileSidebarProps) => {
  const { t } = useTranslation();

  const handleTagClick = (tagId: number) => {
    if (selectedTagIds.includes(tagId)) {
      onTagSelect(selectedTagIds.filter(id => id !== tagId));
    } else {
      onTagSelect([...selectedTagIds, tagId]);
    }
  };

  const handleDocumentTypeClick = (typeId: number) => {
    if (selectedDocumentTypeId === typeId) {
      onDocumentTypeSelect(undefined);
    } else {
      onDocumentTypeSelect(typeId);
    }
  };

  if (isLoading) {
    return (
      <div className={`${isMobile ? '' : 'w-64 border-r border-divider'} p-4 space-y-4`}>
        <Skeleton className="h-6 w-20 rounded" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-8 w-full rounded" />
          ))}
        </div>
        <Skeleton className="h-6 w-24 rounded mt-6" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-8 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${isMobile ? '' : 'w-64 border-r border-divider'} flex flex-col h-full`}>
      <ScrollShadow className="flex-1 p-4 space-y-6">
        {/* 标签部分 */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon icon="solar:tag-bold" className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">{t('tags') || '标签'}</span>
            <span className="text-xs text-foreground/50">({tags.length})</span>
          </div>
          
          {tags.length === 0 ? (
            <p className="text-sm text-foreground/50 py-2">{t('no-tags') || '暂无标签'}</p>
          ) : (
            <div className="space-y-1">
              {tags.map((tag, index) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <motion.button
                    key={tag.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => handleTagClick(tag.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all
                      ${isSelected 
                        ? 'bg-primary/20 text-primary' 
                        : 'hover:bg-default-100 text-foreground/80'
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
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* 文档类型部分 */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon icon="solar:document-bold" className="w-4 h-4 text-secondary" />
            <span className="font-semibold text-sm">{t('document-types') || '文档类型'}</span>
            <span className="text-xs text-foreground/50">({documentTypes.length})</span>
          </div>
          
          {documentTypes.length === 0 ? (
            <p className="text-sm text-foreground/50 py-2">{t('no-document-types') || '暂无文档类型'}</p>
          ) : (
            <div className="space-y-1">
              {documentTypes.map((type, index) => {
                const isSelected = selectedDocumentTypeId === type.id;
                return (
                  <motion.button
                    key={type.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => handleDocumentTypeClick(type.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all
                      ${isSelected 
                        ? 'bg-secondary/20 text-secondary' 
                        : 'hover:bg-default-100 text-foreground/80'
                      }`}
                  >
                    <Icon 
                      icon={getDocumentTypeIcon(type.name)} 
                      className="w-4 h-4 shrink-0" 
                    />
                    <span className="text-sm truncate flex-1">{type.name}</span>
                    {isSelected && (
                      <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-secondary shrink-0" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </ScrollShadow>
    </div>
  );
});

// 根据文档类型名称返回对应图标
function getDocumentTypeIcon(name: string): string {
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
  return 'solar:document-bold';
}

FileSidebar.displayName = 'FileSidebar';
