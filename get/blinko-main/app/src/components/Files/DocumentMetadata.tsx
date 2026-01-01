/**
 * 文档元数据显示组件
 * 显示文件名、创建/修改/添加时间、归档序号等信息
 */

import { memo } from 'react';
import { Chip, Tooltip } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { cn } from '@heroui/react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

// 初始化 dayjs 插件
dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

// ========== 类型定义 ==========

export interface DocumentMetadataDocument {
  /** 原始文件名 */
  original_file_name: string;
  /** 创建时间 */
  created: string;
  /** 修改时间 */
  modified: string;
  /** 添加时间 */
  added: string;
  /** 归档序号 */
  archive_serial_number?: number | null;
}

export interface DocumentMetadataProps {
  /** 文档数据 */
  document: DocumentMetadataDocument;
  /** 自定义样式类名 */
  className?: string;
  /** 是否紧凑模式 */
  compact?: boolean;
}


// ========== 工具函数 ==========

/**
 * 格式化日期为相对时间
 */
function formatRelativeDate(dateStr: string): string {
  return dayjs(dateStr).fromNow();
}

/**
 * 格式化日期为完整格式
 */
function formatFullDate(dateStr: string): string {
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss');
}

/**
 * 获取文件扩展名
 */
function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/**
 * 获取文件类型描述
 */
function getFileTypeDescription(ext: string): string {
  const typeMap: Record<string, string> = {
    pdf: 'PDF 文档',
    doc: 'Word 文档',
    docx: 'Word 文档',
    txt: '文本文件',
    md: 'Markdown 文档',
    png: 'PNG 图片',
    jpg: 'JPEG 图片',
    jpeg: 'JPEG 图片',
    gif: 'GIF 图片',
    tiff: 'TIFF 图片',
    xls: 'Excel 表格',
    xlsx: 'Excel 表格',
    csv: 'CSV 文件',
    ppt: 'PowerPoint 演示',
    pptx: 'PowerPoint 演示',
    zip: 'ZIP 压缩包',
    rar: 'RAR 压缩包',
  };
  return typeMap[ext] || '未知类型';
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


// ========== 元数据项组件 ==========

interface MetadataItemProps {
  icon: string;
  label: string;
  value: string;
  tooltip?: string;
  compact?: boolean;
}

const MetadataItem = memo(({ icon, label, value, tooltip, compact }: MetadataItemProps) => {
  const content = (
    <div className={cn(
      'flex items-start gap-2',
      compact ? 'py-1' : 'py-2'
    )}>
      <Icon 
        icon={icon} 
        className={cn(
          'text-foreground/40 shrink-0',
          compact ? 'w-3.5 h-3.5 mt-0.5' : 'w-4 h-4 mt-0.5'
        )} 
      />
      <div className="min-w-0 flex-1">
        <p className={cn(
          'text-foreground/50',
          compact ? 'text-xs' : 'text-xs'
        )}>
          {label}
        </p>
        <p className={cn(
          'font-medium truncate',
          compact ? 'text-xs' : 'text-sm'
        )}>
          {value}
        </p>
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} delay={300}>
        {content}
      </Tooltip>
    );
  }

  return content;
});

MetadataItem.displayName = 'MetadataItem';


// ========== 主组件 ==========

export const DocumentMetadata = memo(({ 
  document: doc, 
  className,
  compact = false,
}: DocumentMetadataProps) => {
  const fileExtension = getFileExtension(doc.original_file_name);
  const fileType = getFileTypeDescription(fileExtension);
  const fileIcon = getFileIcon(fileExtension);

  return (
    <div className={cn('space-y-1', className)}>
      {/* 文件名 */}
      <MetadataItem
        icon={fileIcon}
        label="文件名"
        value={doc.original_file_name}
        tooltip={doc.original_file_name}
        compact={compact}
      />

      {/* 文件类型 */}
      <MetadataItem
        icon="solar:file-check-linear"
        label="文件类型"
        value={fileType}
        compact={compact}
      />

      {/* 添加时间 */}
      <MetadataItem
        icon="solar:add-circle-linear"
        label="添加时间"
        value={formatRelativeDate(doc.added)}
        tooltip={formatFullDate(doc.added)}
        compact={compact}
      />

      {/* 创建时间 */}
      <MetadataItem
        icon="solar:calendar-linear"
        label="创建时间"
        value={formatRelativeDate(doc.created)}
        tooltip={formatFullDate(doc.created)}
        compact={compact}
      />

      {/* 修改时间 */}
      <MetadataItem
        icon="solar:pen-linear"
        label="修改时间"
        value={formatRelativeDate(doc.modified)}
        tooltip={formatFullDate(doc.modified)}
        compact={compact}
      />

      {/* 归档序号 */}
      {doc.archive_serial_number != null && (
        <div className={cn(
          'flex items-center gap-2',
          compact ? 'py-1' : 'py-2'
        )}>
          <Icon 
            icon="solar:archive-linear" 
            className={cn(
              'text-foreground/40 shrink-0',
              compact ? 'w-3.5 h-3.5' : 'w-4 h-4'
            )} 
          />
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-foreground/50',
              compact ? 'text-xs' : 'text-xs'
            )}>
              归档序号
            </span>
            <Chip 
              size="sm" 
              variant="flat" 
              color="primary"
              className="h-5"
            >
              #{doc.archive_serial_number}
            </Chip>
          </div>
        </div>
      )}
    </div>
  );
});

DocumentMetadata.displayName = 'DocumentMetadata';

export default DocumentMetadata;
