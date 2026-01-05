/**
 * 投资笔记编辑器组件
 * 
 * Modal 形式的编辑器，支持创建和编辑笔记
 * 包含标题、内容、标签、关联股票、资产快照等功能
 */

import { useState, useCallback, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Checkbox,
  Select,
  SelectItem,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import type { InvestmentNote, PortfolioSnapshot } from '@/types/investmentNotes';

interface NoteEditorProps {
  isOpen: boolean;
  note: Partial<InvestmentNote> | null;
  isSaving: boolean;
  includeSnapshot: boolean;
  portfolioSnapshot?: PortfolioSnapshot;
  tickers?: string[]; // 可选的股票列表
  onClose: () => void;
  onSave: (note: Partial<InvestmentNote>) => void;
  onIncludeSnapshotChange: (include: boolean) => void;
}

/**
 * 解析标签字符串为数组
 */
function parseTags(tagsStr: string): string[] {
  return tagsStr
    .split(/[,，\s]+/)
    .map(tag => tag.trim().replace(/^#/, ''))
    .filter(tag => tag.length > 0);
}

/**
 * 格式化标签数组为字符串
 */
function formatTags(tags: string[] | undefined): string {
  if (!tags || tags.length === 0) return '';
  return tags.join(', ');
}

export const NoteEditor = observer(function NoteEditor({
  isOpen,
  note,
  isSaving,
  includeSnapshot,
  portfolioSnapshot,
  tickers = [],
  onClose,
  onSave,
  onIncludeSnapshotChange,
}: NoteEditorProps) {
  // 本地状态
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [relatedTicker, setRelatedTicker] = useState('');

  // 初始化表单
  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setTagsStr(formatTags(note.tags));
      setRelatedTicker(note.related_ticker || '');
    } else {
      setTitle('');
      setContent('');
      setTagsStr('');
      setRelatedTicker('');
    }
  }, [note]);

  // 保存处理
  const handleSave = useCallback(() => {
    const updatedNote: Partial<InvestmentNote> = {
      ...note,
      title: title.trim() || '无标题',
      content: content,
      tags: parseTags(tagsStr),
      related_ticker: relatedTicker || undefined,
    };
    onSave(updatedNote);
  }, [note, title, content, tagsStr, relatedTicker, onSave]);

  // 是否为编辑模式
  const isEditMode = !!note?.id;
  const modalTitle = isEditMode ? '编辑笔记' : '新建笔记';

  // 是否显示快照选项（仅日记模式）
  const showSnapshotOption = note?.source_type === 'note';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: 'bg-content1',
        header: 'border-b border-divider',
        footer: 'border-t border-divider',
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon 
            icon={isEditMode ? 'mdi:pencil' : 'mdi:plus'} 
            className="text-warning" 
          />
          {modalTitle}
        </ModalHeader>

        <ModalBody className="py-4 space-y-4">
          {/* 标题 */}
          <Input
            label="标题"
            placeholder="输入笔记标题"
            value={title}
            onValueChange={setTitle}
            variant="bordered"
            startContent={<Icon icon="mdi:format-title" className="text-foreground/50" />}
          />

          {/* 内容 */}
          <Textarea
            label="内容"
            placeholder="输入笔记内容（支持 Markdown）"
            value={content}
            onValueChange={setContent}
            variant="bordered"
            minRows={8}
            maxRows={16}
          />

          {/* 标签 */}
          <Input
            label="标签"
            placeholder="输入标签，用逗号分隔"
            value={tagsStr}
            onValueChange={setTagsStr}
            variant="bordered"
            description="多个标签用逗号分隔，如：AI, 半导体, 投资"
            startContent={<Icon icon="mdi:tag-outline" className="text-foreground/50" />}
          />

          {/* 关联股票 */}
          {tickers.length > 0 ? (
            <Select
              label="关联股票"
              placeholder="选择关联的股票"
              selectedKeys={relatedTicker ? [relatedTicker] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                setRelatedTicker(selected || '');
              }}
              variant="bordered"
              startContent={<Icon icon="mdi:chart-line" className="text-foreground/50" />}
            >
              {tickers.map((ticker) => (
                <SelectItem key={ticker}>
                  {ticker}
                </SelectItem>
              ))}
            </Select>
          ) : (
            <Input
              label="关联股票"
              placeholder="输入股票代码，如 NVDA"
              value={relatedTicker}
              onValueChange={setRelatedTicker}
              variant="bordered"
              startContent={<Icon icon="mdi:chart-line" className="text-foreground/50" />}
            />
          )}

          {/* 资产快照选项 */}
          {showSnapshotOption && (
            <div className="flex items-center gap-3 p-3 bg-content2/50 rounded-lg">
              <Checkbox
                isSelected={includeSnapshot}
                onValueChange={onIncludeSnapshotChange}
              >
                保存当前资产快照
              </Checkbox>
              {portfolioSnapshot && includeSnapshot && (
                <span className="text-sm text-foreground/60">
                  净值: ¥{portfolioSnapshot.totalNetWorth.toLocaleString()}
                </span>
              )}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button
            variant="flat"
            onPress={onClose}
            isDisabled={isSaving}
          >
            取消
          </Button>
          <Button
            color="primary"
            onPress={handleSave}
            isLoading={isSaving}
            startContent={!isSaving && <Icon icon="mdi:content-save" />}
          >
            保存
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
});

export default NoteEditor;
