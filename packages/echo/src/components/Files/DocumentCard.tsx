/**
 * 文档卡片组件
 * 支持 grid 和 list 两种视图模式
 * 显示缩略图、标题、日期、通讯者、标签
 */

import { memo, useState, useEffect } from 'react';
import { Icon } from '@/components/Common/Iconify/icons';
import { Chip, Tooltip } from '@heroui/react';
import { cn } from '@heroui/react';
import { motion } from 'framer-motion';
import { api } from '@/lib/trpc';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

// ========== 类型定义 ==========

export interface PaperlessDocument {
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

export interface PaperlessTag {
  id: number;
  name: string;
  color: string;
}

export interface Correspondent {
  id: number;
  name: string;
}

export interface DocumentCardProps {
  /** 文档数据 */
  document: PaperlessDocument;
  /** 视图模式：grid 网格视图 / list 列表视图 */
  viewMode: 'grid' | 'list';
  /** 是否选中 */
  selected?: boolean;
  /** 标签列表 */
  tags?: PaperlessTag[];
  /** 通讯者列表 */
  correspondents?: Correspondent[];
  /** 单击回调 */
  onClick?: () => void;
  /** 双击回调 */
  onDoubleClick?: () => void;
  /** 动画延迟索引 */
  animationIndex?: number;
}

// ========== 工具函数 ==========

/**
 * 获取文件扩展名
 */
function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : 'file';
}

/**
 * 根据文件扩展名返回图标
 */
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
    xls: 'solar:chart-2-bold',
    xlsx: 'solar:chart-2-bold',
    csv: 'solar:chart-2-bold',
    ppt: 'solar:presentation-graph-bold',
    pptx: 'solar:presentation-graph-bold',
    zip: 'solar:archive-bold',
    rar: 'solar:archive-bold',
  };
  return iconMap[ext] || 'solar:file-bold';
}

/**
 * 格式化日期显示
 */
function formatDate(dateStr: string): string {
  return dayjs(dateStr).fromNow();
}

/**
 * 格式化完整日期
 */
function formatFullDate(dateStr: string): string {
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm');
}

// ========== 缩略图组件 ==========

interface DocumentThumbnailProps {
  documentId: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const DocumentThumbnail = memo(({ documentId, size = 'md', className }: DocumentThumbnailProps) => {
  const [thumbnail, setThumbnail] = useState<{ data: string; contentType: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setHasError(false);

    const loadThumbnail = async () => {
      try {
        const result = await api.paperless.getThumbnail.query({ id: documentId });
        if (isMounted && result) {
          setThumbnail(result);
        }
      } catch (error) {
        console.warn('缩略图加载失败:', error);
        if (isMounted) {
          setHasError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadThumbnail();
    return () => { isMounted = false; };
  }, [documentId]);

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-full h-full',
    lg: 'w-full h-full',
  };

  if (isLoading) {
    return (
      <div className={cn(
        'flex items-center justify-center bg-default-100 animate-pulse',
        sizeClasses[size],
        className
      )}>
        <Icon icon="solar:document-linear" className="w-8 h-8 text-foreground/20" />
      </div>
    );
  }

  if (hasError || !thumbnail?.data) {
    return (
      <div className={cn(
        'flex items-center justify-center bg-default-100',
        sizeClasses[size],
        className
      )}>
        <Icon icon="solar:document-linear" className="w-8 h-8 text-foreground/20" />
      </div>
    );
  }

  return (
    <img
      src={`data:${thumbnail.contentType};base64,${thumbnail.data}`}
      alt="文档缩略图"
      className={cn(
        'object-cover transition-transform',
        sizeClasses[size],
        className
      )}
    />
  );
});

DocumentThumbnail.displayName = 'DocumentThumbnail';

// ========== Grid 视图卡片 ==========

interface GridCardProps extends Omit<DocumentCardProps, 'viewMode'> {}

const GridCard = memo(({
  document: doc,
  selected,
  tags,
  correspondents,
  onClick,
  onDoubleClick,
  animationIndex = 0,
}: GridCardProps) => {
  // 获取文档关联的标签
  const docTags = tags?.filter(tag => doc.tags.includes(tag.id)) || [];
  // 获取通讯者
  const correspondent = correspondents?.find(c => c.id === doc.correspondent);
  // 文件扩展名
  const fileExtension = getFileExtension(doc.original_file_name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationIndex * 0.05, duration: 0.3 }}
      className={cn(
        'group relative rounded-xl border bg-content1 overflow-hidden cursor-pointer transition-all',
        'hover:shadow-lg hover:border-primary/50',
        selected && 'ring-2 ring-primary border-primary shadow-lg'
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* 缩略图区域 */}
      <div className="relative aspect-[4/3] bg-default-100 overflow-hidden">
        <DocumentThumbnail 
          documentId={doc.id} 
          className="group-hover:scale-105 transition-transform duration-300"
        />
        
        {/* 文件类型标签 */}
        <div className="absolute top-2 left-2">
          <Chip 
            size="sm" 
            variant="flat" 
            className="bg-background/80 backdrop-blur-sm text-xs font-medium"
          >
            {fileExtension.toUpperCase()}
          </Chip>
        </div>

        {/* 选中指示器 */}
        {selected && (
          <div className="absolute top-2 right-2">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* 信息区域 */}
      <div className="p-3 space-y-2">
        {/* 标题 */}
        <Tooltip content={doc.title || doc.original_file_name} delay={500}>
          <h3 className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">
            {doc.title || doc.original_file_name}
          </h3>
        </Tooltip>

        {/* 通讯者 */}
        {correspondent && (
          <div className="flex items-center gap-1.5 text-xs text-foreground/60">
            <Icon icon="solar:user-linear" className="w-3.5 h-3.5" />
            <span className="truncate">{correspondent.name}</span>
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
                className="text-xs h-5 px-1.5"
                style={{ 
                  backgroundColor: tag.color + '20', 
                  color: tag.color,
                  borderColor: tag.color + '40',
                }}
              >
                {tag.name}
              </Chip>
            ))}
            {docTags.length > 3 && (
              <Tooltip content={docTags.slice(3).map(t => t.name).join(', ')}>
                <Chip size="sm" variant="flat" className="text-xs h-5 px-1.5">
                  +{docTags.length - 3}
                </Chip>
              </Tooltip>
            )}
          </div>
        )}

        {/* 日期 */}
        <Tooltip content={formatFullDate(doc.added)}>
          <div className="flex items-center gap-1.5 text-xs text-foreground/50">
            <Icon icon="solar:calendar-linear" className="w-3.5 h-3.5" />
            <span>{formatDate(doc.added)}</span>
          </div>
        </Tooltip>
      </div>
    </motion.div>
  );
});

GridCard.displayName = 'GridCard';

// ========== List 视图行 ==========

interface ListRowProps extends Omit<DocumentCardProps, 'viewMode'> {}

const ListRow = memo(({
  document: doc,
  selected,
  tags,
  correspondents,
  onClick,
  onDoubleClick,
  animationIndex = 0,
}: ListRowProps) => {
  // 获取文档关联的标签
  const docTags = tags?.filter(tag => doc.tags.includes(tag.id)) || [];
  // 获取通讯者
  const correspondent = correspondents?.find(c => c.id === doc.correspondent);
  // 文件扩展名
  const fileExtension = getFileExtension(doc.original_file_name);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: animationIndex * 0.03, duration: 0.2 }}
      className={cn(
        'group flex items-center gap-4 px-4 py-3 border-b border-divider cursor-pointer transition-all',
        'hover:bg-default-100/50',
        selected && 'bg-primary/10 border-l-2 border-l-primary'
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* 缩略图 */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-default-100 shrink-0">
        <DocumentThumbnail documentId={doc.id} size="sm" />
      </div>

      {/* 文件类型图标 */}
      <div className="shrink-0">
        <Icon 
          icon={getFileIcon(fileExtension)} 
          className="w-5 h-5 text-foreground/40" 
        />
      </div>

      {/* 主要信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm truncate">
            {doc.title || doc.original_file_name}
          </h3>
          <Chip 
            size="sm" 
            variant="flat" 
            className="text-xs h-5 shrink-0"
          >
            {fileExtension.toUpperCase()}
          </Chip>
        </div>
        
        <div className="flex items-center gap-3 mt-1 text-xs text-foreground/60">
          {/* 通讯者 */}
          {correspondent && (
            <span className="flex items-center gap-1">
              <Icon icon="solar:user-linear" className="w-3 h-3" />
              {correspondent.name}
            </span>
          )}
          
          {/* 日期 */}
          <Tooltip content={formatFullDate(doc.added)}>
            <span className="flex items-center gap-1">
              <Icon icon="solar:calendar-linear" className="w-3 h-3" />
              {formatDate(doc.added)}
            </span>
          </Tooltip>
        </div>
      </div>

      {/* 标签 */}
      <div className="flex items-center gap-1 shrink-0">
        {docTags.slice(0, 2).map(tag => (
          <Chip
            key={tag.id}
            size="sm"
            variant="flat"
            className="text-xs h-5 px-1.5"
            style={{ 
              backgroundColor: tag.color + '20', 
              color: tag.color,
            }}
          >
            {tag.name}
          </Chip>
        ))}
        {docTags.length > 2 && (
          <Tooltip content={docTags.slice(2).map(t => t.name).join(', ')}>
            <Chip size="sm" variant="flat" className="text-xs h-5 px-1.5">
              +{docTags.length - 2}
            </Chip>
          </Tooltip>
        )}
      </div>

      {/* 选中指示器 */}
      {selected && (
        <div className="shrink-0">
          <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-primary" />
        </div>
      )}
    </motion.div>
  );
});

ListRow.displayName = 'ListRow';

// ========== 主组件 ==========

export const DocumentCard = memo(({
  document,
  viewMode,
  selected = false,
  tags,
  correspondents,
  onClick,
  onDoubleClick,
  animationIndex = 0,
}: DocumentCardProps) => {
  if (viewMode === 'grid') {
    return (
      <GridCard
        document={document}
        selected={selected}
        tags={tags}
        correspondents={correspondents}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        animationIndex={animationIndex}
      />
    );
  }

  return (
    <ListRow
      document={document}
      selected={selected}
      tags={tags}
      correspondents={correspondents}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      animationIndex={animationIndex}
    />
  );
});

DocumentCard.displayName = 'DocumentCard';

export default DocumentCard;
