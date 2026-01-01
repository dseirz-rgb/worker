/**
 * 上传文件项组件
 * 显示单个待上传文件的信息和状态
 * 
 * @module components/Files/UploadFileItem
 */

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Iconify/icons';
import { 
  Input,
  Button,
  Progress,
  Chip,
} from '@heroui/react';
import { motion } from 'framer-motion';
import type { PaperlessTag } from '@/hooks/usePaperless';

// 上传文件状态类型
export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

// 上传文件接口
export interface UploadFile {
  id: string;
  file: File;
  title: string;
  tags: number[];
  documentType: number | null;
  progress: number;
  status: UploadStatus;
  error?: string;
}

interface UploadFileItemProps {
  /** 上传文件对象 */
  uploadFile: UploadFile;
  /** 可选标签列表 */
  availableTags?: PaperlessTag[];
  /** 标题变更回调 */
  onTitleChange: (title: string) => void;
  /** 标签变更回调 */
  onTagsChange: (tagIds: number[]) => void;
  /** 移除文件回调 */
  onRemove: () => void;
  /** 重试上传回调 */
  onRetry?: () => void;
}

export const UploadFileItem = memo(({
  uploadFile,
  availableTags = [],
  onTitleChange,
  onTagsChange,
  onRemove,
  onRetry,
}: UploadFileItemProps) => {
  const { t } = useTranslation();
  const { file, title, tags, progress, status, error } = uploadFile;

  // 切换标签选择
  const toggleTag = (tagId: number) => {
    if (tags.includes(tagId)) {
      onTagsChange(tags.filter(id => id !== tagId));
    } else {
      onTagsChange([...tags, tagId]);
    }
  };

  // 获取状态图标
  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Icon icon="solar:clock-circle-linear" className="w-5 h-5 text-foreground/50" />;
      case 'uploading':
        return <Icon icon="solar:refresh-linear" className="w-5 h-5 animate-spin text-primary" />;
      case 'success':
        return <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-success" />;
      case 'error':
        return <Icon icon="solar:close-circle-bold" className="w-5 h-5 text-danger" />;
    }
  };

  // 获取状态颜色
  const getStatusColor = () => {
    switch (status) {
      case 'pending': return 'default';
      case 'uploading': return 'primary';
      case 'success': return 'success';
      case 'error': return 'danger';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="p-4 bg-default-50 rounded-lg border border-divider"
    >
      {/* 文件信息行 */}
      <div className="flex items-start gap-3">
        {/* 文件图标 */}
        <div className="shrink-0 w-10 h-10 rounded-lg bg-default-100 flex items-center justify-center">
          <Icon 
            icon={getFileIcon(file.name)} 
            className="w-6 h-6 text-foreground/60" 
          />
        </div>

        {/* 文件详情 */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* 标题输入 */}
          <Input
            size="sm"
            value={title}
            onValueChange={onTitleChange}
            placeholder={t('file-title') || '文件标题'}
            isDisabled={status !== 'pending'}
            classNames={{
              inputWrapper: 'bg-background shadow-none',
            }}
          />

          {/* 文件名和大小 */}
          <div className="flex items-center gap-2 text-xs text-foreground/50">
            <span className="truncate max-w-[200px]">{file.name}</span>
            <span>•</span>
            <span>{formatFileSize(file.size)}</span>
            <span>•</span>
            <span>{getFileExtension(file.name).toUpperCase()}</span>
          </div>

          {/* 标签选择 (仅在 pending 状态显示) */}
          {status === 'pending' && availableTags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {availableTags.slice(0, 8).map(tag => {
                const isSelected = tags.includes(tag.id);
                return (
                  <Chip
                    key={tag.id}
                    size="sm"
                    variant={isSelected ? 'solid' : 'flat'}
                    className="cursor-pointer text-xs"
                    style={isSelected ? { 
                      backgroundColor: tag.color, 
                      color: '#fff' 
                    } : {
                      backgroundColor: tag.color + '20',
                      color: tag.color,
                    }}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </Chip>
                );
              })}
              {availableTags.length > 8 && (
                <Chip size="sm" variant="flat" className="text-xs">
                  +{availableTags.length - 8}
                </Chip>
              )}
            </div>
          )}

          {/* 已选标签显示 (非 pending 状态) */}
          {status !== 'pending' && tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {tags.map(tagId => {
                const tag = availableTags.find(t => t.id === tagId);
                if (!tag) return null;
                return (
                  <Chip
                    key={tag.id}
                    size="sm"
                    variant="solid"
                    className="text-xs"
                    style={{ backgroundColor: tag.color, color: '#fff' }}
                  >
                    {tag.name}
                  </Chip>
                );
              })}
            </div>
          )}

          {/* 进度条 */}
          {status === 'uploading' && (
            <Progress 
              size="sm" 
              value={progress} 
              color={getStatusColor()}
              className="mt-2"
            />
          )}

          {/* 错误信息 */}
          {status === 'error' && error && (
            <div className="flex items-center gap-2 mt-2 text-xs text-danger">
              <Icon icon="solar:danger-triangle-linear" className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* 状态和操作 */}
        <div className="shrink-0 flex items-center gap-2">
          {/* 状态图标 */}
          {getStatusIcon()}

          {/* 操作按钮 */}
          {status === 'pending' && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={onRemove}
              aria-label={t('remove') || '移除'}
            >
              <Icon icon="solar:trash-bin-trash-linear" className="w-4 h-4" />
            </Button>
          )}

          {status === 'error' && onRetry && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              color="primary"
              onPress={onRetry}
              aria-label={t('retry') || '重试'}
            >
              <Icon icon="solar:refresh-linear" className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
});

UploadFileItem.displayName = 'UploadFileItem';

// ============================================
// 辅助函数
// ============================================

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * 获取文件扩展名
 */
function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * 根据文件名获取图标
 */
function getFileIcon(filename: string): string {
  const ext = getFileExtension(filename);
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
    xls: 'solar:chart-square-bold',
    xlsx: 'solar:chart-square-bold',
  };
  return iconMap[ext] || 'solar:file-bold';
}

export default UploadFileItem;
