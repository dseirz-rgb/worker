/**
 * 投资笔记 MobX Store (InvestmentNotesStore)
 * 
 * 管理投资笔记的状态，包括列表、编辑、搜索
 * 数据存储在 Investment DB (Supabase) 的 documents 表
 * 
 * 复用 Echo 的 PromiseState/PromisePageState 模式
 * 
 * @module @echoai/store/investmentNotesStore
 */

import { makeAutoObservable, runInAction } from 'mobx';
import { Store } from './standard/base';
import { PromisePageState, PromiseState } from './standard/PromiseState';
import { 
  getDatabaseClient, 
  initDatabaseClient,
  type DatabaseConfig 
} from '@echoai/shared/database';
import type { 
  InvestmentNote, 
  NoteSourceType, 
  NoteTab,
  UpsertNoteParams,
  PortfolioSnapshot,
  Conversation,
  KnowledgeBook,
} from '@/types/investmentNotes';

// ============================================
// Tab 到 source_type 的映射
// ============================================

const TAB_SOURCE_TYPES: Record<Exclude<NoteTab, 'history'>, NoteSourceType[]> = {
  journal: ['note'],
  principles: ['principle'],
  knowledge: ['uploaded_file', 'wechat_article', 'wechat_group_chat'],
};

// ============================================
// InvestmentNotesStore
// ============================================

export class InvestmentNotesStore implements Store {
  sid = 'InvestmentNotesStore';

  // ============================================
  // 状态
  // ============================================

  /** 当前选中的 Tab */
  activeTab: NoteTab = 'journal';

  /** 搜索关键词 */
  searchQuery = '';

  /** 编辑器状态 */
  isEditing = false;

  /** 当前编辑的笔记 */
  currentNote: Partial<InvestmentNote> | null = null;

  /** 是否包含资产快照 */
  includeSnapshot = false;

  /** 历史对话列表 */
  historyConversations: Conversation[] = [];

  /** 知识库子 Tab */
  knowledgeSubTab: 'all' | 'books' | 'articles' | 'chats' | string = 'all';

  /** 展开的书籍 */
  expandedBooks: string[] = [];

  // ============================================
  // 笔记列表 (PromisePageState)
  // ============================================

  noteList = new PromisePageState({
    function: async ({ page, size }) => {
      // history tab 不使用这个列表
      if (this.activeTab === 'history') {
        return [];
      }

      const client = this.getSupabaseClient();
      if (!client) {
        console.warn('[InvestmentNotesStore] Supabase 客户端未初始化');
        return [];
      }

      const sourceTypes = TAB_SOURCE_TYPES[this.activeTab];
      
      let query = client
        .from('documents')
        .select('*')
        .in('source_type', sourceTypes)
        .order('created_at', { ascending: false })
        .range((page - 1) * size, page * size - 1);

      // 搜索过滤
      if (this.searchQuery.trim()) {
        const searchTerm = `%${this.searchQuery.trim()}%`;
        query = query.or(`title.ilike.${searchTerm},content.ilike.${searchTerm}`);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('[InvestmentNotesStore] 查询笔记失败:', error);
        throw new Error(error.message);
      }

      return (data || []) as InvestmentNote[];
    },
  });

  // ============================================
  // CRUD 操作 (PromiseState)
  // ============================================

  /**
   * 生成文本嵌入向量
   * 调用 /api/embedding 接口
   * 失败时返回 null，不阻塞保存
   */
  private async generateEmbedding(content: string): Promise<number[] | null> {
    try {
      const res = await fetch('/api/embedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ content, task_type: 'RETRIEVAL_DOCUMENT' }]
        })
      });
      
      if (!res.ok) {
        console.warn('[InvestmentNotesStore] Embedding API 返回错误:', res.status);
        return null;
      }
      
      const data = await res.json();
      return data.predictions?.[0]?.embeddings?.values || null;
    } catch (e) {
      console.warn('[InvestmentNotesStore] 生成嵌入失败:', e);
      return null;
    }
  }

  /** 创建/更新笔记 */
  upsertNote = new PromiseState({
    function: async (params: UpsertNoteParams): Promise<InvestmentNote | null> => {
      const client = this.getSupabaseClient();
      if (!client) {
        throw new Error('Supabase 客户端未初始化');
      }

      const now = new Date().toISOString();
      
      // 生成嵌入向量（异步，失败不阻塞）
      const embedding = await this.generateEmbedding(params.content);

      if (params.id) {
        // 更新
        const updateData: Record<string, unknown> = {
          title: params.title,
          content: params.content,
          tags: params.tags || [],
          related_ticker: params.related_ticker,
          portfolio_snapshot: params.portfolio_snapshot,
          metadata: params.metadata,
          updated_at: now,
        };
        
        // 只有成功生成嵌入时才更新
        if (embedding) {
          updateData.embedding = embedding;
        }

        const { data, error } = await client
          .from('documents')
          .update(updateData)
          .eq('id', params.id)
          .select()
          .single();

        if (error) {
          console.error('[InvestmentNotesStore] 更新笔记失败:', error);
          throw new Error(error.message);
        }

        return data as InvestmentNote;
      } else {
        // 创建
        const insertData: Record<string, unknown> = {
          title: params.title,
          content: params.content,
          tags: params.tags || [],
          source_type: params.source_type || 'note',
          related_ticker: params.related_ticker,
          portfolio_snapshot: params.portfolio_snapshot,
          metadata: params.metadata,
          user_id: 1,
          created_at: now,
          updated_at: now,
        };
        
        if (embedding) {
          insertData.embedding = embedding;
        }

        const { data, error } = await client
          .from('documents')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          console.error('[InvestmentNotesStore] 创建笔记失败:', error);
          throw new Error(error.message);
        }

        return data as InvestmentNote;
      }
    },
  });

  /** 删除笔记 */
  deleteNote = new PromiseState({
    function: async (id: number): Promise<void> => {
      const client = this.getSupabaseClient();
      if (!client) {
        throw new Error('Supabase 客户端未初始化');
      }

      const { error } = await client
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[InvestmentNotesStore] 删除笔记失败:', error);
        throw new Error(error.message);
      }
    },
  });

  // ============================================
  // 构造函数
  // ============================================

  constructor() {
    makeAutoObservable(this);
    this.initSupabase();
  }

  // ============================================
  // 私有方法
  // ============================================

  /** 初始化 Supabase 客户端 */
  private initSupabase(): void {
    const client = getDatabaseClient();
    if (client) return;

    // 从环境变量初始化
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    if (supabaseUrl && supabaseAnonKey) {
      const config: DatabaseConfig = {
        rcSupabaseUrl: supabaseUrl,
        rcSupabaseAnonKey: supabaseAnonKey,
      };
      initDatabaseClient(config);
      console.log('[InvestmentNotesStore] Supabase 客户端初始化成功');
    } else {
      console.warn('[InvestmentNotesStore] 缺少 Supabase 环境变量');
    }
  }

  /** 获取 Supabase 客户端 */
  private getSupabaseClient() {
    const client = getDatabaseClient();
    return client?.riskcontrol || null;
  }

  // ============================================
  // 公共方法
  // ============================================

  /** 切换 Tab */
  setActiveTab(tab: NoteTab): void {
    this.activeTab = tab;
    if (tab === 'history') {
      this.fetchHistory();
    } else {
      this.noteList.resetAndCall({});
    }
  }

  /** 设置知识库子 Tab */
  setKnowledgeSubTab(subTab: string): void {
    this.knowledgeSubTab = subTab;
  }

  /** 切换书籍展开状态 */
  toggleBookExpanded(title: string): void {
    if (this.expandedBooks.includes(title)) {
      this.expandedBooks = this.expandedBooks.filter(t => t !== title);
    } else {
      this.expandedBooks = [...this.expandedBooks, title];
    }
  }

  /** 获取历史对话 */
  async fetchHistory(): Promise<void> {
    const client = this.getSupabaseClient();
    if (!client) return;

    try {
      const { data, error } = await client
        .from('conversations')
        .select('*')
        .eq('user_id', 1)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[InvestmentNotesStore] 获取历史对话失败:', error);
        return;
      }

      runInAction(() => {
        this.historyConversations = (data || []) as Conversation[];
      });
    } catch (e) {
      console.error('[InvestmentNotesStore] 获取历史对话异常:', e);
    }
  }

  /** 设置搜索关键词 */
  setSearchQuery(query: string): void {
    this.searchQuery = query;
  }

  /** 执行搜索（防抖后调用） */
  executeSearch(): void {
    this.noteList.resetAndCall({});
  }

  /** 打开编辑器 - 新建 */
  openCreateEditor(): void {
    const sourceType: NoteSourceType = this.activeTab === 'principles' ? 'principle' : 'note';
    this.currentNote = {
      title: '',
      content: '',
      tags: [],
      source_type: sourceType,
    };
    this.isEditing = true;
    this.includeSnapshot = false;
  }

  /** 打开编辑器 - 编辑 */
  openEditEditor(note: InvestmentNote): void {
    this.currentNote = { ...note };
    this.isEditing = true;
    this.includeSnapshot = !!note.portfolio_snapshot;
  }

  /** 关闭编辑器 */
  closeEditor(): void {
    this.currentNote = null;
    this.isEditing = false;
    this.includeSnapshot = false;
  }

  /** 更新当前笔记字段 */
  updateCurrentNote(updates: Partial<InvestmentNote>): void {
    if (this.currentNote) {
      this.currentNote = { ...this.currentNote, ...updates };
    }
  }

  /** 设置是否包含快照 */
  setIncludeSnapshot(include: boolean): void {
    this.includeSnapshot = include;
  }

  /** 保存笔记 */
  async saveNote(portfolioSnapshot?: PortfolioSnapshot): Promise<boolean> {
    if (!this.currentNote) return false;

    try {
      const params: UpsertNoteParams = {
        id: this.currentNote.id,
        title: this.currentNote.title || '无标题',
        content: this.currentNote.content || '',
        tags: this.currentNote.tags,
        source_type: this.currentNote.source_type,
        related_ticker: this.currentNote.related_ticker,
        portfolio_snapshot: this.includeSnapshot ? portfolioSnapshot : undefined,
        metadata: this.currentNote.metadata,
      };

      await this.upsertNote.call(params);
      this.closeEditor();
      this.noteList.resetAndCall({});
      return true;
    } catch (error) {
      console.error('[InvestmentNotesStore] 保存笔记失败:', error);
      return false;
    }
  }

  /** 删除笔记并刷新列表 */
  async removeNote(id: number): Promise<boolean> {
    try {
      await this.deleteNote.call(id);
      this.noteList.resetAndCall({});
      return true;
    } catch (error) {
      console.error('[InvestmentNotesStore] 删除笔记失败:', error);
      return false;
    }
  }

  /** 刷新列表 */
  refresh(): void {
    this.noteList.resetAndCall({});
  }

  // ============================================
  // 计算属性
  // ============================================

  /** 笔记列表 */
  get notes(): InvestmentNote[] {
    return (this.noteList.value as InvestmentNote[]) || [];
  }

  /** 是否正在加载 */
  get isLoading(): boolean {
    return this.noteList.loading.value;
  }

  /** 是否为空 */
  get isEmpty(): boolean {
    return this.noteList.isEmpty;
  }

  /** 是否正在保存 */
  get isSaving(): boolean {
    return this.upsertNote.loading.value;
  }

  /** 是否正在删除 */
  get isDeleting(): boolean {
    return this.deleteNote.loading.value;
  }

  /** 知识库文档（用于分组） */
  get knowledgeDocs(): InvestmentNote[] {
    if (this.activeTab !== 'knowledge') return [];
    return this.notes.filter(d => 
      ['uploaded_file', 'wechat_article', 'wechat_group_chat'].includes(d.source_type)
    );
  }

  /** 知识库分组（书籍 + 其他） */
  get groupedKnowledge(): { books: KnowledgeBook[]; others: InvestmentNote[] } {
    const books: Record<string, KnowledgeBook> = {};
    const others: InvestmentNote[] = [];

    this.knowledgeDocs.forEach(doc => {
      // 检测是否为书籍的一部分（标题以 Part N 结尾）
      if (doc.source_type === 'uploaded_file' && /\(Part \d+\)$/.test(doc.title)) {
        const baseTitle = doc.title.replace(/\s*\(Part \d+\)$/, '');
        if (!books[baseTitle]) {
          books[baseTitle] = {
            title: baseTitle,
            count: 0,
            ids: [],
            lastUpdated: doc.created_at,
            sourceType: 'book',
          };
        }
        books[baseTitle].count++;
        books[baseTitle].ids.push(doc.id);
        // 更新最后修改时间
        if (new Date(doc.created_at) > new Date(books[baseTitle].lastUpdated)) {
          books[baseTitle].lastUpdated = doc.created_at;
        }
      } else {
        others.push(doc);
      }
    });

    const bookList = Object.values(books).sort(
      (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );

    return { books: bookList, others };
  }

  /** 知识库中的所有 ticker */
  get knowledgeTickers(): string[] {
    const tickers = new Set<string>();
    this.knowledgeDocs.forEach(d => {
      if (d.related_ticker) tickers.add(d.related_ticker);
    });
    return Array.from(tickers).sort();
  }

  /** 过滤后的历史对话 */
  get filteredHistory(): Conversation[] {
    if (!this.searchQuery.trim()) return this.historyConversations;
    const query = this.searchQuery.toLowerCase();
    return this.historyConversations.filter(c => 
      c.title?.toLowerCase().includes(query)
    );
  }

  // ============================================
  // 初始化方法
  // ============================================

  /** 初始化数据加载 */
  use(): void {
    // 直接调用，不使用 useEffect
    // useEffect 应该在组件中使用，而不是在 store 中
    if (!this.noteList.value || this.noteList.value.length === 0) {
      this.noteList.resetAndCall({});
    }
  }
}

// ============================================
// 导出
// ============================================

export default InvestmentNotesStore;
