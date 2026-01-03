
import React, { useState, useEffect } from 'react';
import { useLocation } from "wouter";
import { getClient } from '../services/supabaseData';
import { useSupabasePortfolio } from '../hooks/useSupabasePortfolio';
import { adaptDashboardToPortfolio } from '../adapters/supabaseToPortfolio';
import { Button } from '../components/ui/button';
import { 
    ArrowLeft, Plus, Search, Trash2, Edit2, Save, Loader2, 
    BookOpen, Camera, Tag, Link as LinkIcon, Library, 
    NotebookPen, Folder, ChevronRight, ChevronDown, 
    MessageSquare, Lightbulb, Newspaper, MessageCircle, 
    FileText, Eye, EyeOff, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { KnowledgeBaseDialog } from '../components/chat/KnowledgeBaseDialog';
import { DynamicNote, getSourceLabel } from '../types';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

interface Document extends DynamicNote {
  similarity?: number;
}

interface DynamicNotesProps {
  embedded?: boolean;
  onSelectConversation?: (id: number) => void;
}

interface KnowledgeBook {
  title: string;
  count: number;
  ids: number[];
  last_updated: string;
  source_type: string;
}

export default function DynamicNotes({ embedded = false, onSelectConversation }: DynamicNotesProps) {
  const [, setLocation] = useLocation();
  const supabase = getClient();
  
  // Portfolio Data for Snapshot
  const { 
    dashboard, 
    stockPositions, 
    optionPositions, 
    settings 
  } = useSupabasePortfolio();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Layout State
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // View State
  const [activeTab, setActiveTab] = useState<'journal' | 'principles' | 'knowledge' | 'history'>('journal');
  const [knowledgeSubTab, setKnowledgeSubTab] = useState<'all' | 'books' | 'articles' | 'chats' | string>('all');
  const [expandedBooks, setExpandedBooks] = useState<string[]>([]);

  // Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const [currentDoc, setCurrentDoc] = useState<Partial<Document>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [includeSnapshot, setIncludeSnapshot] = useState(true);

  // History State
  const [historyConversations, setHistoryConversations] = useState<any[]>([]);

  const currentPortfolioState = React.useMemo(() => {
    return adaptDashboardToPortfolio(dashboard, stockPositions || [], optionPositions || [], settings?.riskLimits);
  }, [dashboard, stockPositions, optionPositions, settings]);

  useEffect(() => {
    fetchDocuments();
    if (activeTab === 'history') {
        fetchHistory();
    }
  }, [activeTab]);

  // Mobile: Close sidebar when a document is selected
  useEffect(() => {
    if (currentDoc.id || currentDoc.source_type) {
        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    }
  }, [currentDoc]);

  async function fetchHistory() {
    if (!supabase) return;
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', 1)
      .order('updated_at', { ascending: false });
    
    if (data) setHistoryConversations(data);
  }

  async function fetchDocuments() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (e) {
      console.error(e);
      toast.error('加载文档失败');
    } finally {
      setIsLoading(false);
    }
  }

  // --- Filtering Logic ---
  const journalDocs = documents.filter(d => d.source_type === 'note');
  const principlesDocs = documents.filter(d => d.source_type === 'principle');
  const knowledgeDocs = documents.filter(d => ['uploaded_file', 'wechat_article', 'wechat_group_chat'].includes(d.source_type));

  const groupedKnowledge = React.useMemo(() => {
    const books: Record<string, KnowledgeBook> = {};
    const others: Document[] = [];

    knowledgeDocs.forEach(doc => {
        if (doc.source_type === 'uploaded_file' && /\(Part \d+\)$/.test(doc.title)) {
            const baseTitle = doc.title.replace(/\s*\(Part \d+\)$/, '');
            if (!books[baseTitle]) {
                books[baseTitle] = {
                    title: baseTitle,
                    count: 0,
                    ids: [],
                    last_updated: doc.createdAt || (doc as any).created_at,
                    source_type: 'book'
                };
            }
            books[baseTitle].count++;
            books[baseTitle].ids.push(doc.id);
            if (new Date(doc.createdAt || (doc as any).created_at) > new Date(books[baseTitle].last_updated)) {
                books[baseTitle].last_updated = doc.createdAt || (doc as any).created_at;
            }
        } else {
            others.push(doc);
        }
    });

    const bookList = Object.values(books).sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime());
    return { books: bookList, others };
  }, [knowledgeDocs]);

  const filterDocs = (list: Document[]) => {
      return list.filter(d => 
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        d.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
  };

  const filteredJournal = filterDocs(journalDocs);
  const filteredPrinciples = filterDocs(principlesDocs);
  const filteredBooks = groupedKnowledge.books.filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredOthers = filterDocs(groupedKnowledge.others);
  
  const knowledgeTickers = React.useMemo(() => {
    const tickers = new Set<string>();
    knowledgeDocs.forEach(d => {
        if (d.related_ticker) tickers.add(d.related_ticker);
    });
    return Array.from(tickers).sort();
  }, [knowledgeDocs]);

  const getFilteredKnowledge = () => {
      let books = filteredBooks;
      let others = filteredOthers;

      if (knowledgeSubTab === 'books') {
          others = [];
      } else if (knowledgeSubTab === 'articles') {
          books = [];
          others = others.filter(d => d.source_type === 'wechat_article');
      } else if (knowledgeSubTab === 'chats') {
          books = [];
          others = others.filter(d => d.source_type === 'wechat_group_chat');
      } else if (knowledgeSubTab.startsWith('ticker-')) {
          const ticker = knowledgeSubTab.replace('ticker-', '');
          books = books.filter(b => knowledgeDocs.some(d => d.title.includes(b.title) && d.related_ticker === ticker)); // 这里的 book logic 稍微复杂，因为 book 是聚合的
          // 实际上 KnowledgeBook 没有 related_ticker，需要检查其内部文档
          // 但这里 groupedKnowledge 已经是聚合过的了。我们暂时只过滤 others，或者更复杂的逻辑。
          // 修正：我们重新基于原始 knowledgeDocs 过滤可能会更简单，但 UI 是分 books 和 others 的。
          // 让我们简化逻辑：如果选了 ticker，只过滤 others (文章/群聊) 和 包含该 ticker 文档的书籍？
          // 书籍通常是上传的文件，可能没有 related_ticker。假设只有 others 有。
          
          // 更加健壮的逻辑：
          // 检查 books 中是否有任何一章有该 ticker (假设我们有数据)。
          // 目前 KnowledgeBook 结构没有存 ticker。
          // 暂时只过滤 others。
          books = []; // 暂时隐藏书籍，或者我们需要在 KnowledgeBook 构建时保留元数据
          others = others.filter(d => d.related_ticker === ticker);
      }

      return { books, others };
  };

  const finalKnowledge = getFilteredKnowledge();
  const filteredHistory = historyConversations.filter(c => 
    c.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const tickers = currentPortfolioState?.positions.map(p => p.ticker) || [];

  // --- Actions ---
  async function handleDelete(id: number) {
    if (!confirm('确定要删除这条记录吗？')) return;
    if (!supabase) return;
    
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) {
        toast.error('删除失败');
    } else {
        toast.success('已删除');
        setDocuments(prev => prev.filter(n => n.id !== id));
        if (currentDoc.id === id) {
            setCurrentDoc({});
            setIsEditing(false);
        }
    }
  }

  async function handleDeleteBook(book: KnowledgeBook) {
    if (!confirm(`确定要删除《${book.title}》吗？这将删除其所有 ${book.count} 个片段。`)) return;
    if (!supabase) return;

    const { error } = await supabase.from('documents').delete().in('id', book.ids);
    if (error) {
        toast.error('删除失败');
    } else {
        toast.success(`已删除《${book.title}》`);
        setDocuments(prev => prev.filter(n => !book.ids.includes(n.id)));
    }
  }

  async function handleSave() {
    if (!currentDoc.title || !currentDoc.content) {
        toast.error('标题和内容不能为空');
        return;
    }
    setIsSaving(true);
    try {
        let embedding = null;
        try {
            const res = await fetch('/api/embedding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instances: [{ content: currentDoc.content, task_type: 'RETRIEVAL_DOCUMENT' }]
                })
            });
            if (res.ok) {
                const data = await res.json();
                embedding = data.predictions[0].embeddings.values;
            }
        } catch (e) {
            console.warn('Embedding failed:', e);
        }

        let snapshot = currentDoc.portfolio_snapshot;
        if (activeTab === 'journal' && includeSnapshot && !currentDoc.id && currentPortfolioState) {
            const relatedPosition = currentDoc.related_ticker 
                ? currentPortfolioState.positions.find(p => p.ticker === currentDoc.related_ticker)
                : null;

            snapshot = {
                date: new Date().toISOString(),
                totalNetWorth: currentPortfolioState.totalNetWorthCNY,
                cashRatio: currentPortfolioState.allocation.cashRatio,
                relatedPosition: relatedPosition ? {
                    ticker: relatedPosition.ticker,
                    quantity: relatedPosition.quantity,
                    avgCost: relatedPosition.avgCost,
                    currentPrice: relatedPosition.currentPrice,
                    unrealizedPnLPercent: relatedPosition.unrealizedPnLPercent,
                    weight: relatedPosition.weight
                } : null,
                topPositions: currentPortfolioState.positions
                    .sort((a, b) => b.marketValueCNY - a.marketValueCNY)
                    .slice(0, 5)
                    .map(p => ({ ticker: p.ticker, weight: p.weight, pnl: p.unrealizedPnLPercent }))
            };
        }

        let sourceType = currentDoc.source_type;
        if (!sourceType) {
            sourceType = activeTab === 'principles' ? 'principle' : 'note';
        }

        const payload: any = {
            title: currentDoc.title,
            content: currentDoc.content,
            tags: currentDoc.tags || [],
            related_ticker: currentDoc.related_ticker || null,
            portfolio_snapshot: snapshot,
            source_type: sourceType,
        };
        
        if (embedding) payload.embedding = embedding;

        if (currentDoc.id) {
            const { error } = await supabase!.from('documents').update(payload).eq('id', currentDoc.id);
            if (error) throw error;
        } else {
            const { error } = await supabase!.from('documents').insert(payload);
            if (error) throw error;
        }

        toast.success('保存成功');
        setIsEditing(false);
        setIsPreviewMode(true);
        fetchDocuments();
    } catch (e) {
        console.error(e);
        toast.error('保存失败');
    } finally {
        setIsSaving(false);
    }
  }

  const renderListItem = (doc: Document, icon: React.ReactNode, subtext?: string) => {
    // 获取点评（如果有）
    const comment = (doc.metadata as any)?.comment;
    
    return (
    <div 
        key={doc.id} 
        onClick={() => { setCurrentDoc(doc); setIsEditing(true); setIsPreviewMode(true); }}
        className={`p-3 rounded-lg cursor-pointer border transition-all ${
            currentDoc.id === doc.id 
            ? 'bg-accent-cyan/10 border-accent-cyan/50' 
            : 'bg-bg-tertiary border-transparent hover:border-border-primary'
        }`}
    >
        <div className="flex justify-between items-start mb-1">
            <h3 className="font-bold text-sm line-clamp-1 flex items-center gap-2">
                {icon}
                {doc.title}
            </h3>
            <span className="text-xs text-text-tertiary flex-shrink-0">{new Date(doc.createdAt || (doc as any).created_at).toLocaleDateString()}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
             {doc.source_type !== 'note' && doc.source_type !== 'principle' && (
                 <span className="text-[10px] bg-bg-secondary text-text-secondary px-1.5 py-0.5 rounded border border-border-primary">
                     {getSourceLabel(doc.source_type)}
                 </span>
             )}
             {Array.isArray(doc.tags) && doc.tags.map(t => (
                 <span key={t} className="text-[10px] bg-bg-secondary text-text-tertiary px-1.5 py-0.5 rounded">
                     #{t}
                 </span>
             ))}
             {doc.related_ticker && (
                <span className="text-[10px] bg-accent-yellow/20 text-accent-yellow px-1.5 py-0.5 rounded font-mono">
                    {doc.related_ticker}
                </span>
            )}
        </div>
        {/* 显示用户点评 */}
        {comment && (
            <div className="mb-2 p-2 bg-accent-purple/10 border border-accent-purple/30 rounded-lg">
                <p className="text-xs text-accent-purple italic line-clamp-2">💬 {comment}</p>
            </div>
        )}
        <p className="text-xs text-text-secondary line-clamp-2">{subtext || doc.content}</p>
    </div>
    );
  };

  return (
    <div className="flex flex-col bg-bg-primary overflow-hidden h-full relative">
        {/* Mobile Header */}
        {!embedded && (
            <header className="border-b border-border bg-card/95 backdrop-blur flex items-center justify-between px-4 flex-shrink-0 z-40 md:hidden pt-safe transition-[padding] duration-200">
                <div className="flex items-center gap-3 h-14">
                    <button onClick={() => setLocation('/')} className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors" title="返回仪表板">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-2">
                         <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-blue flex items-center justify-center shadow-lg shadow-accent-cyan/20">
                            <NotebookPen size={18} className="text-primary-foreground" />
                        </div>
                        <span className="font-bold text-foreground tracking-wide font-display">动态笔记</span>
                    </div>
                </div>
                 <button onClick={() => setSidebarOpen(true)} className="p-2 text-text-secondary">
                    <PanelLeftOpen size={20} />
                </button>
            </header>
        )}

        <div className="flex flex-1 overflow-hidden relative">
            {/* Mobile Sidebar Overlay */}
            <div 
                className={`fixed inset-0 z-20 bg-black/50 md:hidden ${sidebarOpen ? 'block' : 'hidden'}`} 
                onClick={() => setSidebarOpen(false)} 
            />

            {/* Sidebar Container */}
            <div className={`
                bg-bg-secondary border-r border-border h-full flex-shrink-0 flex flex-col
                transition-all duration-300 ease-in-out
                absolute inset-y-0 left-0 z-30 md:relative md:z-auto
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                md:transform-none md:overflow-hidden
                ${sidebarOpen ? 'md:w-80 md:opacity-100' : 'md:w-0 md:opacity-0 md:border-r-0'}
            `}>
                <div className="w-80 h-full flex flex-col">
                    {/* Top Bar */}
                    <div className="p-4 border-b border-border bg-bg-secondary sticky top-0 z-10 flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                            {!embedded && (
                                <Button variant="ghost" onClick={() => setLocation('/')} className="text-text-secondary hover:text-text-primary -ml-2 p-2 h-8 w-8 hidden md:flex">
                                    <ArrowLeft className="w-4 h-4" />
                                </Button>
                            )}
                            
                            {/* Mode Switcher */}
                            <div className="flex-1 flex bg-bg-tertiary rounded-lg p-1 overflow-x-auto no-scrollbar">
                                <button onClick={() => setActiveTab('knowledge')} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${activeTab === 'knowledge' ? 'bg-bg-primary shadow text-accent-cyan' : 'text-text-secondary hover:text-text-primary'}`}><Library size={14} /></button>
                                <button onClick={() => setActiveTab('journal')} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${activeTab === 'journal' ? 'bg-bg-primary shadow text-accent-cyan' : 'text-text-secondary hover:text-text-primary'}`}><NotebookPen size={14} /></button>
                                <button onClick={() => setActiveTab('principles')} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${activeTab === 'principles' ? 'bg-bg-primary shadow text-accent-yellow' : 'text-text-secondary hover:text-text-primary'}`}><Lightbulb size={14} /></button>
                                <button onClick={() => setActiveTab('history')} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-bg-primary shadow text-accent-cyan' : 'text-text-secondary hover:text-text-primary'}`}><MessageSquare size={14} /></button>
                            </div>

                            {/* New Button */}
                            {(activeTab === 'journal' || activeTab === 'principles') && (
                                <Button size="sm" onClick={() => { setCurrentDoc({ source_type: activeTab === 'principles' ? 'principle' : 'note' }); setIsEditing(true); setIsPreviewMode(false); }} className="bg-accent-cyan text-bg-primary flex-shrink-0 h-8 w-8 p-0 rounded-lg shadow-lg shadow-accent-cyan/20">
                                    <Plus className="w-5 h-5" />
                                </Button>
                            )}
                            
                            {activeTab === 'knowledge' && (
                                <KnowledgeBaseDialog trigger={<Button size="sm" className="bg-accent-cyan text-bg-primary flex-shrink-0 h-8 w-8 p-0 rounded-lg shadow-lg shadow-accent-cyan/20"><Plus className="w-5 h-5" /></Button>} />
                            )}
                        </div>
                        
                        {/* Knowledge Sub-tabs */}
                        {activeTab === 'knowledge' && (
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                {[
                                    { id: 'all', label: '全部' }, 
                                    { id: 'books', label: '书籍' }, 
                                    { id: 'articles', label: '文章' }, 
                                    { id: 'chats', label: '群聊' },
                                    ...knowledgeTickers.map(t => ({ id: `ticker-${t}`, label: t }))
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setKnowledgeSubTab(tab.id as any)}
                                        className={`flex-1 text-[10px] px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap text-center ${
                                            knowledgeSubTab === tab.id ? 'bg-accent-cyan/10 border-accent-cyan text-accent-cyan font-medium' : 'bg-bg-tertiary border-transparent text-text-secondary hover:border-border-primary'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                            <input 
                                className="w-full bg-bg-tertiary border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:border-accent-cyan outline-none transition-all focus:bg-bg-primary"
                                placeholder="搜索..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Content List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-bg-secondary/50 scrollbar-hide">
                        {isLoading ? (
                            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-accent-cyan" /></div>
                        ) : (
                            <>
                                {activeTab === 'journal' && (filteredJournal.length === 0 ? <div className="text-center py-8 text-text-tertiary text-sm">暂无笔记</div> : filteredJournal.map(doc => renderListItem(doc, null)))}
                                {activeTab === 'principles' && (filteredPrinciples.length === 0 ? <div className="text-center py-8 text-text-tertiary text-sm">暂无原则</div> : filteredPrinciples.map(doc => renderListItem(doc, <Lightbulb size={14} className="text-accent-yellow" />)))}
                                {activeTab === 'knowledge' && (
                                    (finalKnowledge.books.length === 0 && finalKnowledge.others.length === 0) ? <div className="text-center py-8 text-text-tertiary text-sm">暂无知识库</div> : (
                                        <>
                                            {finalKnowledge.books.map(book => (
                                                <div key={book.title} className="bg-bg-tertiary rounded-lg border border-border overflow-hidden mb-2">
                                                    <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-bg-primary/50" onClick={() => setExpandedBooks(prev => prev.includes(book.title) ? prev.filter(t => t !== book.title) : [...prev, book.title])}>
                                                        <div className="flex items-center gap-3"><Folder className="w-5 h-5 text-accent-yellow" /><div><h3 className="font-bold text-sm">{book.title}</h3><p className="text-xs text-text-tertiary">{book.count} 个片段</p></div></div>
                                                        <div className="flex items-center gap-2"><button onClick={(e) => { e.stopPropagation(); handleDeleteBook(book); }} className="p-1.5 hover:bg-accent-red/20 text-text-tertiary hover:text-accent-red rounded"><Trash2 size={14} /></button>{expandedBooks.includes(book.title) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
                                                    </div>
                                                    {expandedBooks.includes(book.title) && <div className="bg-bg-secondary/30 p-2 text-xs text-text-tertiary border-t border-border">已收纳 {book.count} 个向量切片</div>}
                                                </div>
                                            ))}
                                            {finalKnowledge.others.map(doc => renderListItem(doc, doc.source_type === 'wechat_article' ? <Newspaper size={14} className="text-accent-cyan" /> : (doc.source_type === 'wechat_group_chat' ? <MessageCircle size={14} className="text-accent-green" /> : <FileText size={14} className="text-text-secondary" />)))}
                                        </>
                                    )
                                )}
                                {activeTab === 'history' && (filteredHistory.length === 0 ? <div className="text-center py-8 text-text-tertiary text-sm">暂无历史对话</div> : filteredHistory.map(conv => (
                                    <div key={conv.id} className="bg-bg-tertiary rounded-lg border border-border p-3 cursor-pointer hover:border-accent-cyan/50" onClick={() => onSelectConversation ? onSelectConversation(conv.id) : setLocation(`/chat/${conv.id}`)}>
                                        <div className="flex justify-between items-start mb-1"><h3 className="font-bold text-sm line-clamp-1">{conv.title || '未命名对话'}</h3><span className="text-xs text-text-tertiary">{new Date(conv.updated_at).toLocaleDateString()}</span></div>
                                        <div className="flex items-center gap-2 mt-2"><Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] bg-bg-secondary text-text-secondary hover:text-text-primary">查看详情 <ChevronRight size={10} className="ml-1" /></Button></div>
                                    </div>
                                )))}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full w-full relative bg-bg-primary">
                {/* Desktop & Mobile Sidebar Toggle */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className={`
                        absolute top-3 left-3 z-10 p-2 rounded-lg
                        text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/80
                        transition-all duration-300
                        ${sidebarOpen ? 'md:opacity-50 md:hover:opacity-100 opacity-0 pointer-events-none md:pointer-events-auto' : 'opacity-100'}
                    `}
                >
                     {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                </button>

                {currentDoc.id || currentDoc.source_type ? (
                    <>
                        {/* Toolbar */}
                        <div className="p-4 border-b border-border flex items-center justify-between bg-bg-secondary shrink-0 pl-14">
                            <input 
                                className="bg-transparent text-lg font-bold outline-none placeholder:text-text-tertiary min-w-[200px] flex-1 mr-4"
                                placeholder="输入标题..."
                                value={currentDoc.title || ''}
                                onChange={e => setCurrentDoc({...currentDoc, title: e.target.value})}
                                readOnly={isPreviewMode}
                            />
                            <div className="flex items-center gap-2">
                                {currentDoc.source_type && <span className="text-xs px-2 py-1 bg-bg-tertiary rounded border border-border text-text-secondary hidden sm:inline-block">{getSourceLabel(currentDoc.source_type)}</span>}
                                {currentDoc.id && <Button variant="ghost" size="sm" onClick={() => handleDelete(currentDoc.id!)} className="text-accent-red hover:bg-accent-red/10"><Trash2 className="w-4 h-4" /></Button>}
                                <Button variant="ghost" size="sm" onClick={() => setIsPreviewMode(!isPreviewMode)} className={isPreviewMode ? 'text-accent-cyan' : 'text-text-secondary'}>
                                    {isPreviewMode ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                                    <span className="hidden sm:inline">{isPreviewMode ? '阅读' : '编辑'}</span>
                                </Button>
                                <Button onClick={handleSave} disabled={isSaving} className="bg-accent-cyan text-bg-primary shadow-lg shadow-accent-cyan/20">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    <span className="hidden sm:inline">保存</span>
                                </Button>
                            </div>
                        </div>

                        {/* Meta Inputs (Journal/Principles only) */}
                        {!isPreviewMode && (activeTab === 'journal' || activeTab === 'principles') && (
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-bg-secondary/30 border-b border-border">
                                <div className="flex items-center gap-2">
                                    <LinkIcon className="w-4 h-4 text-text-tertiary" />
                                    <select className="bg-bg-tertiary border border-border rounded px-2 py-1.5 text-sm outline-none focus:border-accent-cyan w-full" value={currentDoc.related_ticker || ''} onChange={e => setCurrentDoc({...currentDoc, related_ticker: e.target.value})}>
                                        <option value="">关联标的 (可选)</option>
                                        <option value="MARKET">大盘 / 宏观</option>
                                        {tickers.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-text-tertiary" />
                                    <input className="bg-bg-tertiary border border-border rounded px-2 py-1.5 text-sm outline-none focus:border-accent-cyan w-full" placeholder="标签 (逗号分隔)" value={Array.isArray(currentDoc.tags) ? currentDoc.tags.join(', ') : (currentDoc.tags || '')} onChange={e => setCurrentDoc({...currentDoc, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})} />
                                </div>
                                {activeTab === 'journal' && (
                                    <div className="md:col-span-2 flex items-center gap-2">
                                        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
                                            <input type="checkbox" checked={includeSnapshot} onChange={e => setIncludeSnapshot(e.target.checked)} className="accent-accent-cyan" />
                                            <Camera className="w-4 h-4" />
                                            <span>保存当前资产快照 (净值: {currentPortfolioState?.totalNetWorthCNY.toLocaleString()} CNY)</span>
                                        </label>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Editor / Content */}
                        {isPreviewMode ? (
                            <div className="flex-1 w-full bg-bg-primary p-6 md:p-10 overflow-y-auto pb-32">
                                {/* 显示用户点评 */}
                                {(currentDoc.metadata as any)?.comment && (
                                    <div className="mb-6 p-4 bg-accent-purple/10 border border-accent-purple/30 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-accent-purple font-semibold text-sm">💬 我的点评</span>
                                        </div>
                                        <p className="text-text-primary text-sm leading-relaxed italic">{(currentDoc.metadata as any).comment}</p>
                                    </div>
                                )}
                                <article className="prose prose-invert prose-sm md:prose-base max-w-none 
                                    text-gray-200 leading-relaxed
                                    [&>h1]:text-accent-cyan [&>h1]:font-bold [&>h1]:mb-4 [&>h1]:mt-2
                                    [&>h2]:text-accent-cyan/90 [&>h2]:font-bold [&>h2]:mb-3 [&>h2]:mt-6 [&>h2]:border-b [&>h2]:border-accent-cyan/20 [&>h2]:pb-2
                                    [&>h3]:text-accent-cyan/80 [&>h3]:font-semibold [&>h3]:mb-2 [&>h3]:mt-4
                                    [&>p>strong]:text-accent-yellow [&>p>strong]:font-bold
                                    [&>li>strong]:text-accent-yellow [&>li>strong]:font-bold
                                    [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1 [&>ul]:my-3
                                    [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:space-y-1 [&>ol]:my-3
                                    [&>li]:text-gray-300
                                    [&>blockquote]:border-l-4 [&>blockquote]:border-accent-cyan/50 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-gray-400 [&>blockquote]:bg-bg-tertiary/30 [&>blockquote]:py-1 [&>blockquote]:my-4 [&>blockquote]:rounded-r
                                    [&>pre]:bg-[#1e1e1e] [&>pre]:p-3 [&>pre]:rounded-md [&>pre]:border [&>pre]:border-white/10 [&>pre]:my-4 [&>pre]:overflow-x-auto
                                    [&>code]:text-accent-yellow [&>code]:bg-white/10 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:font-mono [&>code]:text-xs
                                    [&>p]:mb-4 last:[&>p]:mb-0
                                    [&>img]:rounded-xl [&>img]:border [&>img]:border-border [&>img]:my-8 [&>img]:shadow-lg
                                    [&>a]:text-accent-blue [&>a]:hover:underline [&>a]:decoration-accent-blue/50 [&>a]:underline-offset-4
                                ">
                                     {/* Special handling for Jina Summary Card to prevent Markdown escaping */}
                                     {currentDoc.content?.includes('Jina 智能摘要') ? (
                                        <>
                                            <div 
                                                className="mb-8"
                                                dangerouslySetInnerHTML={{ 
                                                    __html: (currentDoc.content.match(/<div class="jina-summary-card">[\s\S]*?<\/div>/)?.[0] || 
                                                             currentDoc.content.match(/<div style="background-color: #f0f9ff[\s\S]*?<\/div>/)?.[0] || '')
                                                             .replace(/class="jina-summary-card"/, 'class="bg-accent-cyan/10 border-l-4 border-accent-cyan p-4 rounded-r-lg mb-8 shadow-sm"')
                                                             .replace(/class="jina-summary-title"/, 'class="text-accent-cyan font-bold text-lg mb-3 flex items-center gap-2"')
                                                             .replace(/class="jina-summary-list"/, 'class="list-disc pl-5 space-y-2 text-text-secondary text-sm leading-relaxed"')
                                                }} 
                                            />
                                            <ReactMarkdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>
                                                {currentDoc.content
                                                    .replace(/<div class="jina-summary-card">[\s\S]*?<\/div>/, '')
                                                    .replace(/<div style="background-color: #f0f9ff[\s\S]*?<\/div>/, '')
                                                }
                                            </ReactMarkdown>
                                        </>
                                     ) : (
                                         <ReactMarkdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>
                                             {currentDoc.content?.trim().startsWith('<') ? currentDoc.content : currentDoc.content || ''}
                                         </ReactMarkdown>
                                     )}
                                </article>
                            </div>
                        ) : (
                            <textarea 
                                className="flex-1 w-full bg-bg-primary p-6 md:p-10 outline-none font-mono text-sm resize-none leading-relaxed text-text-primary"
                                placeholder="开始写作..."
                                value={currentDoc.content || ''}
                                onChange={e => setCurrentDoc({...currentDoc, content: e.target.value})}
                            />
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary">
                         {activeTab === 'journal' ? (
                           <>
                              <NotebookPen className="w-16 h-16 mb-4 opacity-20" />
                              <p>选择左侧笔记或新建</p>
                           </>
                       ) : activeTab === 'principles' ? (
                          <>
                             <Lightbulb className="w-16 h-16 mb-4 opacity-20 text-accent-yellow" />
                             <p>投资原则与纪律</p>
                             <p className="text-xs mt-2 text-text-tertiary">常读常新，知行合一</p>
                          </>
                       ) : (
                           <>
                              {activeTab === 'history' ? (
                                  <>
                                      <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
                                      <p>历史对话存档</p>
                                      <p className="text-xs mt-2 text-text-tertiary text-center max-w-xs">这些对话已被纳入 RAG 知识库，<br/>AI 在回答新问题时会参考过去的交流。</p>
                                  </>
                              ) : (
                                  <>
                                      <Library className="w-16 h-16 mb-4 opacity-20" />
                                      <p>知识库模式</p>
                                      <p className="text-xs mt-2 text-text-tertiary">选择左侧文档进行阅读或修改</p>
                                  </>
                              )}
                           </>
                       )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}
