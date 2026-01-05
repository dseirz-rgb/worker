
import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Trash2, Loader2, BookOpen, Plus, FileSpreadsheet, Newspaper, MessageCircle, Lightbulb, RefreshCw, Cloud, CloudOff, CheckCircle, AlertCircle } from 'lucide-react';
import { getClient } from '../../services/supabaseData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

// 同步状态类型
type SyncStatus = 'idle' | 'syncing' | 'error' | 'not_configured';

interface DriveSyncStatus {
  status: SyncStatus;
  lastSyncAt: string | null;
  errorMessage: string | null;
  fileCount: number;
  isSyncing: boolean;
}

export function KnowledgeBaseDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [syncStatus, setSyncStatus] = useState<DriveSyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = getClient();

  // 加载文档列表
  useEffect(() => {
    if (isOpen) {
      loadDocuments();
      loadSyncStatus();
    }
  }, [isOpen]);

  // 加载同步状态
  async function loadSyncStatus() {
    try {
      const response = await fetch('/api/trpc/driveSync.status');
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data.result?.data || null);
      }
    } catch (e) {
      console.error('Failed to load sync status:', e);
    }
  }

  // 手动触发同步
  async function triggerSync(forceFullSync: boolean = false) {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/trpc/driveSync.trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceFullSync }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.result?.data?.success) {
          alert(`同步完成！处理了 ${data.result.data.filesProcessed} 个文件`);
          loadDocuments();
          loadSyncStatus();
        } else {
          alert('同步失败: ' + (data.result?.data?.errors?.[0]?.error || '未知错误'));
        }
      } else {
        const errData = await response.json();
        alert('同步失败: ' + (errData.error?.message || '请求失败'));
      }
    } catch (e) {
      console.error('Sync failed:', e);
      alert('同步失败: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsSyncing(false);
      loadSyncStatus();
    }
  }

  async function loadDocuments() {
    if (!supabase) return;
    setIsLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        // 如果表不存在，忽略错误（可能是旧版数据库）
        if (error.code !== '42P01') console.error('Error loading documents:', error);
        return;
      }
      setDocuments(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingDocs(false);
    }
  }

  // 简单的文本切片
  function chunkText(text: string, chunkSize: number = 1000, overlap: number = 100): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += chunkSize - overlap;
    }
    return chunks;
  }

  // 调用本地代理获取向量
  async function getEmbeddings(texts: string[]) {
    // 每次处理 5 个，避免超时
    const batchSize = 5;
    const allEmbeddings: number[][] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const instances = batch.map(t => ({ content: t, task_type: 'RETRIEVAL_DOCUMENT' }));
      
      const response = await fetch('/api/embedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instances }),
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Embedding API failed (${response.status}): ${errText}`);
      }
      
      const data = await response.json();
      if (data.predictions) {
          data.predictions.forEach((p: any) => allEmbeddings.push(p.embeddings.values));
      }
      
      // 更新进度
      setUploadProgress(`正在向量化... ${Math.min(i + batchSize, texts.length)}/${texts.length}`);
    }
    
    return allEmbeddings;
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !supabase) return;

    setIsUploading(true);
    setUploadProgress('开始读取文件...');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.name.endsWith('.txt')) {
            alert(`仅支持 TXT 文件: ${file.name}`);
            continue;
        }

        const text = await file.text();
        setUploadProgress(`正在切片: ${file.name}`);
        
        const chunks = chunkText(text);
        const embeddings = await getEmbeddings(chunks);
        
        setUploadProgress(`正在保存: ${file.name}`);
        
        const rows = chunks.map((chunk, idx) => ({
          title: `${file.name.replace('.txt', '')} (Part ${idx + 1})`,
          content: chunk,
          embedding: embeddings[idx],
          source_type: 'uploaded_file',
          metadata: { original_filename: file.name }
        }));
        
        const { error } = await supabase.from('documents').insert(rows);
        if (error) throw new Error(`Supabase Insert Error: ${error.message} (${error.code})`);
      }
      
      alert('导入成功！');
      // setIsOpen(false); // 保持打开以便查看
    } catch (error) {
      console.error('Upload failed:', error);
      alert('导入失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const renderDocList = (type: string) => {
    const filtered = documents.filter(d => d.source_type === type);
    if (isLoadingDocs) return <div className="p-4 text-center"><Loader2 className="animate-spin inline mr-2" />加载中...</div>;
    if (filtered.length === 0) return <div className="p-4 text-center text-text-muted">暂无内容</div>;

    return (
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {filtered.map(doc => (
          <div key={doc.id} className="p-3 bg-bg-tertiary rounded-lg border border-border flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
               {type === 'wechat_article' ? <Newspaper size={16} className="text-accent-cyan flex-shrink-0"/> : 
                type === 'wechat_group_chat' ? <MessageCircle size={16} className="text-accent-green flex-shrink-0"/> :
                type === 'strategy_sheet' ? <Lightbulb size={16} className="text-accent-yellow flex-shrink-0"/> :
                <FileText size={16} className="text-text-secondary flex-shrink-0"/>}
               <span className="text-sm truncate">{doc.title}</span>
            </div>
            <span className="text-xs text-text-muted flex-shrink-0">
              {new Date(doc.created_at).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger ? trigger : (
          <Button variant="ghost" className="w-full justify-start text-text-secondary hover:text-text-primary">
            <BookOpen className="w-4 h-4 mr-2" />
            知识库管理
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-bg-secondary border-border-primary text-text-primary">
        <DialogHeader>
          <DialogTitle>知识库管理</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upload">文件上传</TabsTrigger>
            <TabsTrigger value="strategy">投资策略</TabsTrigger>
            <TabsTrigger value="articles">微信文章</TabsTrigger>
            <TabsTrigger value="chats">群聊精华</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload">
            <div className="grid gap-4 py-4">
              {/* Google Drive 同步状态 */}
              <div className="p-3 bg-bg-tertiary rounded-lg border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {syncStatus?.status === 'not_configured' ? (
                      <CloudOff size={16} className="text-text-muted" />
                    ) : syncStatus?.status === 'error' ? (
                      <AlertCircle size={16} className="text-red-500" />
                    ) : syncStatus?.status === 'syncing' || isSyncing ? (
                      <RefreshCw size={16} className="text-accent-cyan animate-spin" />
                    ) : (
                      <Cloud size={16} className="text-accent-green" />
                    )}
                    <span className="text-sm font-medium">Google Drive 同步</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => triggerSync(false)}
                    disabled={isSyncing || syncStatus?.status === 'not_configured'}
                    className="h-7 text-xs"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 size={12} className="mr-1 animate-spin" />
                        同步中...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={12} className="mr-1" />
                        立即同步
                      </>
                    )}
                  </Button>
                </div>
                <div className="text-xs text-text-muted">
                  {syncStatus?.status === 'not_configured' ? (
                    <span>未配置 Google Drive 同步</span>
                  ) : syncStatus?.lastSyncAt ? (
                    <span>
                      上次同步: {new Date(syncStatus.lastSyncAt).toLocaleString()} · 
                      {syncStatus.fileCount} 个文件
                    </span>
                  ) : (
                    <span>尚未同步</span>
                  )}
                  {syncStatus?.errorMessage && (
                    <span className="text-red-400 ml-2">错误: {syncStatus.errorMessage}</span>
                  )}
                </div>
              </div>

              {/* 上传区域 */}
              <div className="border-2 border-dashed border-border-primary rounded-lg p-8 text-center hover:bg-bg-tertiary transition-colors cursor-pointer"
                   onClick={() => fileInputRef.current?.click()}>
                
                {isUploading ? (
                    <div className="flex flex-col items-center">
                        <Loader2 className="w-8 h-8 animate-spin mb-2 text-accent-primary" />
                        <p className="text-sm text-text-secondary">{uploadProgress}</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        <div className="flex gap-4 mb-2">
                            <FileText className="w-8 h-8 text-text-secondary" />
                            <FileSpreadsheet className="w-8 h-8 text-text-secondary" />
                        </div>
                        <p className="text-sm font-medium">点击上传文件</p>
                        <p className="text-xs text-text-tertiary mt-1">支持 .txt, .md, .csv, .xlsx</p>
                        <p className="text-xs text-accent-cyan mt-2">支持自动去重 & 表格语义化</p>
                    </div>
                )}
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".txt,.md,.csv,.xlsx,.xls" 
                    multiple 
                    onChange={handleFileUpload}
                    disabled={isUploading}
                />
              </div>
              
              {/* 新增：已上传文件列表展示 */}
              <div className="mt-4">
                <h4 className="text-sm font-bold text-text-primary mb-2">已上传文件</h4>
                {renderDocList('uploaded_file')}
              </div>
              
              <div className="text-xs text-text-tertiary">
                <p>提示：导入的书籍将自动用于回答您的投资问题。</p>
                <p>请确保已运行 scripts/enable_vector.sql 以启用向量支持。</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="strategy">
             <div className="py-2">
                <p className="text-xs text-text-tertiary mb-2">自动同步的 Google Sheets 投资策略和 Excel 财务模型将显示在这里。</p>
                <h4 className="text-sm font-bold text-text-primary mb-2 mt-4">投资策略 (Google Sheets)</h4>
                {renderDocList('strategy_sheet')}
                <h4 className="text-sm font-bold text-text-primary mb-2 mt-4">财务模型 (Excel)</h4>
                {renderDocList('financial_model')}
             </div>
          </TabsContent>

          <TabsContent value="articles">
             <div className="py-2">
                <p className="text-xs text-text-tertiary mb-2">通过 iOS 快捷指令导入的微信文章将显示在这里。</p>
                {renderDocList('wechat_article')}
             </div>
          </TabsContent>

          <TabsContent value="chats">
             <div className="py-2">
                <p className="text-xs text-text-tertiary mb-2">通过 AI 清洗后的群聊精华将显示在这里。</p>
                {renderDocList('wechat_group_chat')}
             </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
