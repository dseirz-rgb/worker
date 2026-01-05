/**
 * 投资笔记列表组件
 * 
 * 渲染 NoteCard 列表，支持分页加载和空状态
 */

import { memo } from 'react';
import { observer } from 'mobx-react-lite';
import { Spinner, Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { ScrollArea } from '@/components/Common/ScrollArea';
import { NoteCard } from './NoteCard';
import type { InvestmentNote } from '@/types/investmentNotes';

interface NoteListProps {
  notes: InvestmentNote[];
  isLoading: boolean;
  isEmpty: boolean;
  isLoadAll: boolean;
  deletingId: number | null;
  onNoteClick: (note: InvestmentNote) => void;
  onNoteDelete: (id: number) => void;
  onLoadMore: () => void;
  onCreateNew: () => void;
}

/**
 * 空状态组件
 */
const EmptyState = memo(function EmptyState({ 
  onCreateNew 
}: { 
  onCreateNew: () => void 
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon 
        icon="mdi:notebook-outline" 
        className="text-6xl text-foreground/20 mb-4" 
      />
      <h3 className="text-lg font-medium text-foreground/60 mb-2">
        暂无笔记
      </h3>
      <p className="text-sm text-foreground/40 mb-4">
        开始记录您的投资思考吧
      </p>
      <Button
        color="primary"
        variant="flat"
        startContent={<Icon icon="mdi:plus" />}
        onPress={onCreateNew}
      >
        新建笔记
      </Button>
    </div>
  );
});

/**
 * 加载更多按钮
 */
const LoadMoreButton = memo(function LoadMoreButton({
  isLoading,
  isLoadAll,
  onLoadMore,
}: {
  isLoading: boolean;
  isLoadAll: boolean;
  onLoadMore: () => void;
}) {
  if (isLoadAll) {
    return (
      <div className="text-center py-4 text-sm text-foreground/40">
        已加载全部
      </div>
    );
  }

  return (
    <div className="flex justify-center py-4">
      <Button
        variant="flat"
        isLoading={isLoading}
        onPress={onLoadMore}
      >
        加载更多
      </Button>
    </div>
  );
});

export const NoteList = observer(function NoteList({
  notes,
  isLoading,
  isEmpty,
  isLoadAll,
  deletingId,
  onNoteClick,
  onNoteDelete,
  onLoadMore,
  onCreateNew,
}: NoteListProps) {
  // 首次加载中
  if (isLoading && notes.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  // 空状态
  if (isEmpty) {
    return <EmptyState onCreateNew={onCreateNew} />;
  }

  return (
    <ScrollArea className="h-full" onBottom={onLoadMore}>
      <div className="space-y-3 pb-4">
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onClick={() => onNoteClick(note)}
            onDelete={() => onNoteDelete(note.id)}
            isDeleting={deletingId === note.id}
          />
        ))}
        
        {notes.length > 0 && (
          <LoadMoreButton
            isLoading={isLoading}
            isLoadAll={isLoadAll}
            onLoadMore={onLoadMore}
          />
        )}
      </div>
    </ScrollArea>
  );
});

export default NoteList;
