/**
 * 文件列表组件
 * 显示文档卡片网格，支持多选
 */

import { memo, useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Iconify/icons';
import { Button, Chip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Checkbox } from '@heroui/react';
import { motion } from 'framer-motion';
import { api } from '@/lib/trpc';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface PaperlessDocument {
  id: number;
  title: string;
  content: string;
  created: string;
  modified: string;
  added: string;
  correspondent: number | null;
  document_type: number | null;
  tags: number[];
  original_file_name: string;
}

interface PaperlessTag {
  id: number;
  name: string;
  color: string;
}

interface PaperlessDocumentType {
  id: number;
  name: string;
}

interface FileListProps {
  documents: PaperlessDocument[];
  tags: PaperlessTag[];
  documentTypes: PaperlessDocumentType[];
  onDocumentClick: (doc: PaperlessDocument) => void;
  onRefresh: () => void;
  /** 是否启用多选模式 */
  selectable?: boolean;
  /** 选中的文档 ID 列表 */
  selectedIds?: number[];
  /** 选择变化回调 */
  onSelectionChange?: (ids: number[]) => void;
  /** 当前聚焦的文档索引（用于键盘导航） */
  focusedIndex?: number;
  /** 聚焦变化回调 */
  onFocusChange?: (index: number) => void;
}

export const FileList = memo(({
  documents,
  tags,
  documentTypes,
  onDocumentClick,
  onRefresh,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  focusedIndex = -1,
  onFocusChange,
}: FileListProps) => {
  const { t } = useTranslation();

  // 处理选择变化
  const handleSelect = useCallback((docId: number, isSelected: boolean, event?: React.MouseEvent) => {
    if (!onSelectionChange) return;
    
    // Ctrl/Cmd+Click 切换单个选择
    // Shift+Click 范围选择（简化实现）
    if (event?.shiftKey && selectedIds.length > 0) {
      // 范围选择：从最后选中的到当前
      const lastSelectedIndex = documents.findIndex(d => d.id === selectedIds[selectedIds.length - 1]);
      const currentIndex = documents.findIndex(d => d.id === docId);
      const start = Math.min(lastSelectedIndex, currentIndex);
      const end = Math.max(lastSelectedIndex, currentIndex);
      const rangeIds = documents.slice(start, end + 1).map(d => d.id);
      const newIds = [...new Set([...selectedIds, ...rangeIds])];
      onSelectionChange(newIds);
    } else if (event?.ctrlKey || event?.metaKey) {
      // 切换单个
      if (isSelected) {
        onSelectionChange(selectedIds.filter(id => id !== docId));
      } else {
        onSelectionChange([...selectedIds, docId]);
      }
    } else {
      // 普通点击：切换选择
      if (isSelected) {
        onSelectionChange(selectedIds.filter(id => id !== docId));
      } else {
        onSelectionChange([...selectedIds, docId]);
      }
    }
  }, [documents, selectedIds, onSelectionChange]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {documents.map((doc, index) => (
        <FileCard
          key={doc.id}
          document={doc}
          tags={tags}
          documentTypes={documentTypes}
          onClick={() => onDocumentClick(doc)}
          onRefresh={onRefresh}
          index={index}
          selectable={selectable}
          isSelected={selectedIds.includes(doc.id)}
          isFocused={focusedIndex === index}
          onSelect={(isSelected, event) => handleSelect(doc.id, isSelected, event)}
          onFocus={() => onFocusChange?.(index)}
        />
      ))}
    </div>
  );
});

FileList.displayName = 'FileList';

// 文件卡片组件
interface FileCardProps {
  document: PaperlessDocument;
  tags: PaperlessTag[];
  documentTypes: PaperlessDocumentType[];
  onClick: () => void;
  onRefresh: () => void;
  index: number;
  /** 是否可选择 */
  selectable?: boolean;
  /** 是否已选中 */
  isSelected?: boolean;
  /** 是否聚焦 */
  isFocused?: boolean;
  /** 选择回调 */
  onSelect?: (isSelected: boolean, event?: React.MouseEvent) => void;
  /** 聚焦回调 */
  onFocus?: () => void;
}

const FileCard = memo(({
  document: doc,
  tags,
  documentTypes,
  onClick,
  onRefresh,
  index,
  selectable = false,
  isSelected = false,
  isFocused = false,
  onSelect,
  onFocus,
}: FileCardProps) => {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [thumbnail, setThumbnail] = useState<{ data: string; contentType: string } | null>(null);

  // 加载缩略图
  useEffect(() => {
    let isMounted = true;
    const loadThumbnail = async () => {
      try {
        const result = await api.paperless.getThumbnail.query({ id: doc.id });
        if (isMounted && result) {
          setThumbnail(result);
        }
      } catch (error) {
        // 缩略图加载失败，静默处理
        console.warn('缩略图加载失败:', error);
      }
    };
    loadThumbnail();
    return () => { isMounted = false; };
  }, [doc.id]);

  const docTags = tags.filter(tag => doc.tags.includes(tag.id));
  const docType = documentTypes.find(type => type.id === doc.document_type);
  const fileExtension = getFileExtension(doc.original_file_name);

  // 删除文档
  const handleDelete = useCallback(async () => {
    if (confirm(t('confirm-delete-file') || '确定要删除这个文件吗？')) {
      setIsDeleting(true);
      try {
        await api.paperless.deleteDocument.mutate({ id: doc.id });
        onRefresh();
      } catch (error) {
        console.error('删除文件失败:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  }, [doc.id, t, onRefresh]);

  // 处理点击
  const handleClick = useCallback((e: React.MouseEvent) => {
    // 如果是可选择模式且点击了 checkbox 区域，不触发预览
    if (selectable && (e.target as HTMLElement).closest('.select-checkbox')) {
      return;
    }
    onClick();
  }, [selectable, onClick]);

  // 处理选择
  const handleSelectClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(!isSelected, e);
  }, [isSelected, onSelect]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`group relative bg-content1 rounded-xl border overflow-hidden
        hover:shadow-lg transition-all cursor-pointer
        ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-divider hover:border-primary/30'}
        ${isFocused ? 'ring-2 ring-primary/40' : ''}`}
      onClick={handleClick}
      onMouseEnter={onFocus}
    >
      {/* 缩略图区域 */}
      <div className="relative aspect-[4/3] bg-default-100 overflow-hidden">
        {thumbnail?.data ? (
          <img
            src={`data:${thumbnail.contentType};base64,${thumbnail.data}`}
            alt={doc.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon 
              icon={getFileIcon(fileExtension)} 
              className="w-16 h-16 text-foreground/20" 
            />
          </div>
        )}
        
        {/* 选择 Checkbox */}
        {selectable && (
          <div 
            className={`select-checkbox absolute top-2 left-2 z-10 transition-opacity ${
              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            onClick={handleSelectClick}
          >
            <Checkbox
              isSelected={isSelected}
              size="lg"
              classNames={{
                wrapper: 'bg-background/80 backdrop-blur-sm rounded',
              }}
            />
          </div>
        )}
        
        {/* 文件类型标签 */}
        <div className={`absolute top-2 ${selectable ? 'left-10' : 'left-2'}`}>
          <Chip size="sm" variant="flat" className="bg-background/80 backdrop-blur-sm">
            {fileExtension.toUpperCase()}
          </Chip>
        </div>

        {/* 操作菜单 */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Dropdown>
            <DropdownTrigger>
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                className="bg-background/80 backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <Icon icon="solar:menu-dots-bold" className="w-4 h-4" />
              </Button>
            </DropdownTrigger>
            <DropdownMenu>
              <DropdownItem
                key="download"
                startContent={<Icon icon="solar:download-linear" />}
                onClick={(e) => {
                  e.stopPropagation();
                  // 下载逻辑
                }}
              >
                {t('download') || '下载'}
              </DropdownItem>
              <DropdownItem
                key="delete"
                className="text-danger"
                color="danger"
                startContent={<Icon icon="solar:trash-bin-trash-linear" />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
              >
                {t('delete') || '删除'}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      {/* 信息区域 */}
      <div className="p-3 space-y-2">
        {/* 标题 */}
        <h3 className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">
          {doc.title || doc.original_file_name}
        </h3>

        {/* 文档类型 */}
        {docType && (
          <div className="flex items-center gap-1 text-xs text-foreground/60">
            <Icon icon="solar:document-linear" className="w-3 h-3" />
            <span>{docType.name}</span>
          </div>
        )}

        {/* 标签 */}
        {docTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {docTags.slice(0, 3).map(tag => (
              <Chip
                key={tag.id}
                size="sm"
                variant="flat"
                className="text-xs h-5"
                style={{ 
                  backgroundColor: tag.color + '20', 
                  color: tag.color 
                }}
              >
                {tag.name}
              </Chip>
            ))}
            {docTags.length > 3 && (
              <Chip size="sm" variant="flat" className="text-xs h-5">
                +{docTags.length - 3}
              </Chip>
            )}
          </div>
        )}

        {/* 日期 */}
        <div className="flex items-center gap-1 text-xs text-foreground/50">
          <Icon icon="solar:calendar-linear" className="w-3 h-3" />
          <span>{dayjs(doc.added).fromNow()}</span>
        </div>
      </div>

      {/* 删除中遮罩 */}
      {isDeleting && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <Icon icon="solar:refresh-linear" className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
    </motion.div>
  );
});

FileCard.displayName = 'FileCard';

// 获取文件扩展名
function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : 'file';
}

// 根据文件扩展名返回图标
function getFileIcon(ext: string): string {
  const iconMap: Record<string, string> = {
    pdf: 'solar:document-text-bold',
    doc: 'solar:document-bold',
    docx: 'solar:document-bold',
    txt: 'solar:text-bold',
    md: 'solar:text-bold',
    png: 'solar:gallery-bold',
    jpg: 'solar:gallery-bold',
    jpeg: 'solar:gallery-bold',
    gif: 'solar:gallery-bold',
    tiff: 'solar:gallery-bold',
  };
  return iconMap[ext] || 'solar:file-bold';
}
