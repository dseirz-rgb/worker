/**
 * 投资笔记卡片组件
 * 
 * 复用 BlinkoCard 的布局模式
 * 显示笔记标题、时间、标签、内容预览、关联股票
 */

import { memo } from 'react';
import { Card, CardBody, Chip, Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import dayjs from 'dayjs';
import type { InvestmentNote } from '@/types/investmentNotes';

interface NoteCardProps {
  note: InvestmentNote;
  onClick: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

/**
 * 截断文本
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * 获取笔记类型图标
 */
function getNoteIcon(sourceType: string): string {
  switch (sourceType) {
    case 'note':
      return 'mdi:notebook-outline';
    case 'principle':
      return 'mdi:lightbulb-outline';
    case 'uploaded_file':
      return 'mdi:file-document-outline';
    case 'wechat_article':
      return 'mdi:wechat';
    case 'wechat_group_chat':
      return 'mdi:forum-outline';
    default:
      return 'mdi:note-outline';
  }
}

export const NoteCard = memo(function NoteCard({
  note,
  onClick,
  onDelete,
  isDeleting = false,
}: NoteCardProps) {
  const formattedDate = dayjs(note.created_at).format('YYYY-MM-DD HH:mm');
  const contentPreview = truncateText(note.content.replace(/[#*`]/g, ''), 120);
  const icon = getNoteIcon(note.source_type);

  return (
    <Card
      isPressable
      onPress={onClick}
      className="bg-content1/80 backdrop-blur-sm hover:bg-content1 transition-all cursor-pointer"
    >
      <CardBody className="p-4 space-y-3">
        {/* 头部：标题 + 时间 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Icon icon={icon} className="text-lg text-warning shrink-0" />
            <h3 className="font-medium text-foreground truncate">
              {note.title || '无标题'}
            </h3>
          </div>
          <span className="text-xs text-foreground/50 shrink-0">
            {formattedDate}
          </span>
        </div>

        {/* 标签 */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {note.tags.slice(0, 5).map((tag, index) => (
              <Chip
                key={index}
                size="sm"
                variant="flat"
                className="text-xs"
              >
                #{tag}
              </Chip>
            ))}
            {note.tags.length > 5 && (
              <Chip size="sm" variant="flat" className="text-xs">
                +{note.tags.length - 5}
              </Chip>
            )}
          </div>
        )}

        {/* 内容预览 */}
        <p className="text-sm text-foreground/70 line-clamp-2">
          {contentPreview || '暂无内容'}
        </p>

        {/* 底部：关联股票 + 操作 */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {note.related_ticker && (
              <Chip
                size="sm"
                color="primary"
                variant="flat"
                startContent={<Icon icon="mdi:chart-line" className="text-xs" />}
              >
                {note.related_ticker}
              </Chip>
            )}
            {note.portfolio_snapshot && (
              <Chip
                size="sm"
                color="success"
                variant="flat"
                startContent={<Icon icon="mdi:camera" className="text-xs" />}
              >
                快照
              </Chip>
            )}
          </div>
          
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            isLoading={isDeleting}
            onPress={() => onDelete()}
          >
            <Icon icon="mdi:delete-outline" className="text-lg" />
          </Button>
        </div>
      </CardBody>
    </Card>
  );
});

export default NoteCard;
