/**
 * 投资模块 - 投资笔记页面
 * 
 * 功能：
 * - 笔记 CRUD（创建、编辑、删除）
 * - 分类视图（日记、原则、知识库、历史对话）
 * - 搜索过滤
 * - 关联股票
 * - 资产快照
 * - 向量嵌入（保存时自动生成）
 * - 知识库上传
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Button, 
  Input, 
  Tabs, 
  Tab,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Card,
  CardBody,
  Chip,
  Spinner,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { GradientBackground } from '@/components/Common/GradientBackground';
import { ScrollArea } from '@/components/Common/ScrollArea';
import { NoteList, NoteEditor, KnowledgeUploadDialog } from '@/components/InvestmentNotes';
import { RootStore } from '@/store/root';
import { InvestmentNotesStore } from '@/store/investmentNotesStore';
import { InvestmentStore } from '@/store/investmentStore';
import type { InvestmentNote, NoteTab, PortfolioSnapshot, Conversation, KnowledgeBook } from '@/types/investmentNotes';

// 防抖 Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// 历史对话卡片
const HistoryCard = ({ 
  conversation, 
  onClick 
}: { 
  conversation: Conversation; 
  onClick: () => void;
}) => (
  <Card
    isPressable
    onPress={onClick}
    className="bg-content1/80 backdrop-blur-sm hover:bg-content1 transition-all"
  >
    <CardBody className="p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon icon="mdi:message-text-outline" className="text-lg text-primary shrink-0" />
          <h3 className="font-medium truncate">{conversation.title || '未命名对话'}</h3>
        </div>
        <span className="text-xs text-foreground/50 shrink-0">
          {dayjs(conversation.updated_at).format('MM-DD HH:mm')}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Chip size="sm" variant="flat" color="primary">
          <Icon icon="mdi:chevron-right" className="text-xs" />
          查看详情
        </Chip>
      </div>
    </CardBody>
  </Card>
);

// 知识库书籍卡片
const BookCard = ({
  book,
  isExpanded,
  onToggle,
  onDelete,
}: {
  book: KnowledgeBook;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) => (
  <Card className="bg-content1/80 backdrop-blur-sm">
    <CardBody className="p-0">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-content2/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <Icon icon="mdi:folder" className="text-xl text-warning" />
          <div>
            <h3 className="font-medium">{book.title}</h3>
            <p className="text-xs text-foreground/50">{book.count} 个片段</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            onPress={() => onDelete()}
          >
            <Icon icon="mdi:delete-outline" />
          </Button>
          <Icon 
            icon={isExpanded ? 'mdi:chevron-down' : 'mdi:chevron-right'} 
            className="text-foreground/50"
          />
        </div>
      </div>
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-divider">
          <p className="text-xs text-foreground/50">
            已收纳 {book.count} 个向量切片，用于 RAG 检索
          </p>
        </div>
      )}
    </CardBody>
  </Card>
);

const InvestmentNotesPage = observer(() => {
  const navigate = useNavigate();
  const notesStore = RootStore.Get(InvestmentNotesStore);
  const investmentStore = RootStore.Get(InvestmentStore);

  // 本地状态
  const [searchInput, setSearchInput] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmDeleteBook, setConfirmDeleteBook] = useState<KnowledgeBook | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // 防抖搜索
  const debouncedSearch = useDebounce(searchInput, 300);

  // 初始化
  useEffect(() => {
    notesStore.use();
    investmentStore.use();
  }, []);

  // 搜索变化时执行搜索
  useEffect(() => {
    notesStore.setSearchQuery(debouncedSearch);
    notesStore.executeSearch();
  }, [debouncedSearch]);

  // 构建资产快照
  const portfolioSnapshot = useMemo((): PortfolioSnapshot | undefined => {
    if (!investmentStore.positions.length) return undefined;
    
    const topPositions = investmentStore.positions
      .slice(0, 5)
      .map(p => ({
        ticker: p.ticker,
        weight: p.weight,
        pnl: p.unrealizedPnLPercent,
        quantity: p.quantity,
        avgCost: p.avgCost,
        currentPrice: p.currentPrice,
        unrealizedPnLPercent: p.unrealizedPnLPercent,
      }));

    return {
      date: new Date().toISOString().split('T')[0],
      // 使用账户净值而不是持仓市值累加
      totalNetWorth: investmentStore.accountNetWorth,
      cashRatio: investmentStore.dashboardSnapshot?.cashRatio || 0,
      topPositions,
    };
  }, [investmentStore.positions, investmentStore.accountNetWorth, investmentStore.dashboardSnapshot]);

  // 可用的股票代码列表
  const availableTickers = useMemo(() => {
    return investmentStore.positions.map(p => p.ticker);
  }, [investmentStore.positions]);

  // Tab 切换
  const handleTabChange = useCallback((key: React.Key) => {
    notesStore.setActiveTab(key as NoteTab);
  }, [notesStore]);

  // 新建笔记
  const handleCreateNew = useCallback(() => {
    notesStore.openCreateEditor();
  }, [notesStore]);

  // 点击笔记卡片
  const handleNoteClick = useCallback((note: InvestmentNote) => {
    notesStore.openEditEditor(note);
  }, [notesStore]);

  // 删除确认
  const handleDeleteClick = useCallback((id: number) => {
    setConfirmDeleteId(id);
  }, []);

  // 确认删除笔记
  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDeleteId) return;
    
    setDeletingId(confirmDeleteId);
    setConfirmDeleteId(null);
    
    const success = await notesStore.removeNote(confirmDeleteId);
    
    if (success) {
      toast.success('笔记已删除');
    } else {
      toast.error('删除失败');
    }
    
    setDeletingId(null);
  }, [confirmDeleteId, notesStore]);

  // 确认删除书籍
  const handleConfirmDeleteBook = useCallback(async () => {
    if (!confirmDeleteBook) return;
    
    // TODO: 实现批量删除书籍的所有片段
    toast.info('批量删除功能开发中');
    setConfirmDeleteBook(null);
  }, [confirmDeleteBook]);

  // 取消删除
  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
    setConfirmDeleteBook(null);
  }, []);

  // 保存笔记
  const handleSaveNote = useCallback(async (note: Partial<InvestmentNote>) => {
    notesStore.updateCurrentNote(note);
    
    const snapshot = notesStore.includeSnapshot ? portfolioSnapshot : undefined;
    const success = await notesStore.saveNote(snapshot);
    
    if (success) {
      toast.success(note.id ? '笔记已更新' : '笔记已创建');
    } else {
      toast.error('保存失败');
    }
  }, [notesStore, portfolioSnapshot]);

  // 关闭编辑器
  const handleCloseEditor = useCallback(() => {
    notesStore.closeEditor();
  }, [notesStore]);

  // 加载更多
  const handleLoadMore = useCallback(() => {
    notesStore.noteList.callNextPage({});
  }, [notesStore]);

  // 点击历史对话
  const handleHistoryClick = useCallback((conv: Conversation) => {
    // 跳转到对话页面
    navigate(`/chat/${conv.id}`);
  }, [navigate]);

  // 上传成功
  const handleUploadSuccess = useCallback(() => {
    notesStore.refresh();
  }, [notesStore]);

  // 渲染知识库内容
  const renderKnowledgeContent = () => {
    const { books, others } = notesStore.groupedKnowledge;
    const isEmpty = books.length === 0 && others.length === 0;

    if (notesStore.isLoading && notesStore.notes.length === 0) {
      return (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      );
    }

    if (isEmpty) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Icon icon="mdi:book-open-outline" className="text-6xl text-foreground/20 mb-4" />
          <h3 className="text-lg font-medium text-foreground/60 mb-2">暂无知识库</h3>
          <p className="text-sm text-foreground/40 mb-4">上传文档以构建您的投资知识库</p>
          <Button
            color="primary"
            variant="flat"
            startContent={<Icon icon="mdi:upload" />}
            onPress={() => setShowUploadDialog(true)}
          >
            上传文档
          </Button>
        </div>
      );
    }

    return (
      <ScrollArea className="h-full" onBottom={() => {}}>
        <div className="space-y-3 pb-4">
          {/* 书籍分组 */}
          {books.map(book => (
            <BookCard
              key={book.title}
              book={book}
              isExpanded={notesStore.expandedBooks.includes(book.title)}
              onToggle={() => notesStore.toggleBookExpanded(book.title)}
              onDelete={() => setConfirmDeleteBook(book)}
            />
          ))}
          {/* 其他文档 */}
          {others.map(note => (
            <Card
              key={note.id}
              isPressable
              onPress={() => handleNoteClick(note)}
              className="bg-content1/80 backdrop-blur-sm hover:bg-content1 transition-all"
            >
              <CardBody className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Icon 
                      icon={note.source_type === 'wechat_article' ? 'mdi:wechat' : 'mdi:forum-outline'} 
                      className={`text-lg shrink-0 ${note.source_type === 'wechat_article' ? 'text-success' : 'text-primary'}`}
                    />
                    <h3 className="font-medium truncate">{note.title}</h3>
                  </div>
                  <span className="text-xs text-foreground/50 shrink-0">
                    {dayjs(note.created_at).format('MM-DD')}
                  </span>
                </div>
                <p className="text-sm text-foreground/70 line-clamp-2">
                  {note.content.slice(0, 100)}...
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </ScrollArea>
    );
  };

  // 渲染历史对话
  const renderHistoryContent = () => {
    const conversations = notesStore.filteredHistory;

    if (conversations.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Icon icon="mdi:message-text-outline" className="text-6xl text-foreground/20 mb-4" />
          <h3 className="text-lg font-medium text-foreground/60 mb-2">暂无历史对话</h3>
          <p className="text-sm text-foreground/40">与 AI 的对话记录将显示在这里</p>
        </div>
      );
    }

    return (
      <ScrollArea className="h-full" onBottom={() => {}}>
        <div className="space-y-3 pb-4">
          {conversations.map(conv => (
            <HistoryCard
              key={conv.id}
              conversation={conv}
              onClick={() => handleHistoryClick(conv)}
            />
          ))}
        </div>
      </ScrollArea>
    );
  };

  return (
    <GradientBackground className="h-full overflow-hidden flex flex-col">
      <div className="max-w-4xl mx-auto w-full p-4 md:p-6 flex flex-col h-full">
        {/* 头部 */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Link to="/investment">
              <Button isIconOnly variant="light" size="sm">
                <Icon icon="mdi:arrow-left" className="text-xl" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Icon icon="mdi:note-text" className="text-warning" />
                投资笔记
              </h1>
              <p className="text-foreground/60 text-sm">记录投资思考与交易笔记</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {notesStore.activeTab === 'knowledge' && (
              <Button
                variant="flat"
                startContent={<Icon icon="mdi:upload" />}
                onPress={() => setShowUploadDialog(true)}
              >
                上传
              </Button>
            )}
            {(notesStore.activeTab === 'journal' || notesStore.activeTab === 'principles') && (
              <Button
                color="primary"
                startContent={<Icon icon="mdi:plus" />}
                onPress={handleCreateNew}
              >
                新建
              </Button>
            )}
          </div>
        </div>

        {/* Tab 切换 */}
        <Tabs
          selectedKey={notesStore.activeTab}
          onSelectionChange={handleTabChange}
          variant="underlined"
          classNames={{
            tabList: 'gap-4',
            tab: 'px-0',
          }}
        >
          <Tab
            key="journal"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:notebook-outline" />
                <span>投资日记</span>
              </div>
            }
          />
          <Tab
            key="principles"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:lightbulb-outline" />
                <span>投资原则</span>
              </div>
            }
          />
          <Tab
            key="knowledge"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:book-open-outline" />
                <span>知识库</span>
              </div>
            }
          />
          <Tab
            key="history"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:message-text-outline" />
                <span>历史对话</span>
              </div>
            }
          />
        </Tabs>

        {/* 搜索框 */}
        <div className="my-4">
          <Input
            placeholder="搜索笔记..."
            value={searchInput}
            onValueChange={setSearchInput}
            startContent={<Icon icon="mdi:magnify" className="text-foreground/50" />}
            isClearable
            onClear={() => setSearchInput('')}
            variant="bordered"
            classNames={{
              inputWrapper: 'bg-content1/50',
            }}
          />
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden">
          {notesStore.activeTab === 'knowledge' ? (
            renderKnowledgeContent()
          ) : notesStore.activeTab === 'history' ? (
            renderHistoryContent()
          ) : (
            <NoteList
              notes={notesStore.notes}
              isLoading={notesStore.isLoading}
              isEmpty={notesStore.isEmpty}
              isLoadAll={notesStore.noteList.isLoadAll}
              deletingId={deletingId}
              onNoteClick={handleNoteClick}
              onNoteDelete={handleDeleteClick}
              onLoadMore={handleLoadMore}
              onCreateNew={handleCreateNew}
            />
          )}
        </div>
      </div>

      {/* 编辑器 Modal */}
      <NoteEditor
        isOpen={notesStore.isEditing}
        note={notesStore.currentNote}
        isSaving={notesStore.isSaving}
        includeSnapshot={notesStore.includeSnapshot}
        portfolioSnapshot={portfolioSnapshot}
        tickers={availableTickers}
        onClose={handleCloseEditor}
        onSave={handleSaveNote}
        onIncludeSnapshotChange={(include) => notesStore.setIncludeSnapshot(include)}
      />

      {/* 知识库上传 Dialog */}
      <KnowledgeUploadDialog
        isOpen={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        onSuccess={handleUploadSuccess}
      />

      {/* 删除确认 Modal */}
      <Modal
        isOpen={!!confirmDeleteId || !!confirmDeleteBook}
        onClose={handleCancelDelete}
        size="sm"
      >
        <ModalContent>
          <ModalHeader>确认删除</ModalHeader>
          <ModalBody>
            {confirmDeleteBook ? (
              <p>确定要删除《{confirmDeleteBook.title}》吗？这将删除其所有 {confirmDeleteBook.count} 个片段。</p>
            ) : (
              <p>确定要删除这条笔记吗？此操作无法撤销。</p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={handleCancelDelete}>
              取消
            </Button>
            <Button 
              color="danger" 
              onPress={confirmDeleteBook ? handleConfirmDeleteBook : handleConfirmDelete}
            >
              删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </GradientBackground>
  );
});

export default InvestmentNotesPage;
