/**
 * 知识库页面
 * 管理 Khoj 知识库，查看索引状态，上传文档，管理已索引文档
 */

import * as React from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Brain,
  Upload,
  RefreshCw,
  FileText,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff,
  FolderOpen,
  Trash2,
  File,
  FileType,
} from 'lucide-react';
import { UnifiedSearch } from '../components/search/UnifiedSearch';
import {
  getKhojClient,
  isKhojClientInitialized,
} from '../services/khoj/khojClient';
import { loadKhojSettings } from '../services/khoj/khojConfig';
import type { KhojIndexStatus, KhojIndexedDocument } from '../types/khoj';

export function KnowledgePage() {
  // 状态
  const [isConnected, setIsConnected] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [indexStatus, setIndexStatus] = React.useState<KhojIndexStatus | null>(null);
  const [documents, setDocuments] = React.useState<KhojIndexedDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = React.useState(false);
  const [uploadStatus, setUploadStatus] = React.useState<{
    uploading: boolean;
    message?: string;
    success?: boolean;
  }>({ uploading: false });
  const [deleteStatus, setDeleteStatus] = React.useState<{
    deleting: string | null;
    error?: string;
  }>({ deleting: null });
  const [activeTab, setActiveTab] = React.useState<'search' | 'documents'>('search');

  // 文件上传 ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 初始化
  React.useEffect(() => {
    checkConnectionAndLoadStatus();
  }, []);

  // 检查连接并加载状态
  const checkConnectionAndLoadStatus = async () => {
    setIsLoading(true);
    
    try {
      const settings = loadKhojSettings();
      
      if (!settings.connection.enabled || !isKhojClientInitialized()) {
        setIsConnected(false);
        setIsLoading(false);
        return;
      }

      const client = getKhojClient();
      const healthy = await client.healthCheck();
      setIsConnected(healthy);

      if (healthy) {
        await loadIndexStatus();
        await loadDocuments();
      }
    } catch (error) {
      console.error('检查连接失败:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  // 加载索引状态
  const loadIndexStatus = async () => {
    if (!isKhojClientInitialized()) return;

    try {
      const client = getKhojClient();
      const status = await client.getIndexStatus();
      setIndexStatus(status);
    } catch (error) {
      console.error('加载索引状态失败:', error);
    }
  };

  // 加载文档列表
  const loadDocuments = async () => {
    if (!isKhojClientInitialized()) return;

    setIsLoadingDocs(true);
    try {
      const client = getKhojClient();
      const docs = await client.getIndexedDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('加载文档列表失败:', error);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!isKhojClientInitialized()) {
      setUploadStatus({
        uploading: false,
        message: 'Khoj 未连接',
        success: false,
      });
      return;
    }

    setUploadStatus({ uploading: true });

    try {
      const client = getKhojClient();
      let successCount = 0;
      let failCount = 0;

      for (const file of Array.from(files)) {
        const content = await file.text();
        const result = await client.indexDocument(content, file.name, {
          source: 'echo-upload',
          uploadedAt: new Date().toISOString(),
        });

        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      setUploadStatus({
        uploading: false,
        message: `上传完成: ${successCount} 成功, ${failCount} 失败`,
        success: failCount === 0,
      });

      // 刷新索引状态和文档列表
      await loadIndexStatus();
      await loadDocuments();
    } catch (error) {
      setUploadStatus({
        uploading: false,
        message: error instanceof Error ? error.message : '上传失败',
        success: false,
      });
    }

    // 清除文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 删除文档
  const handleDeleteDocument = async (doc: KhojIndexedDocument) => {
    if (!isKhojClientInitialized()) return;

    const confirmed = window.confirm(`确定要删除文档 "${doc.filename}" 吗？`);
    if (!confirmed) return;

    setDeleteStatus({ deleting: doc.path });

    try {
      const client = getKhojClient();
      const success = await client.deleteDocument(doc.path);

      if (success) {
        // 从列表中移除
        setDocuments(prev => prev.filter(d => d.path !== doc.path));
        // 刷新索引状态
        await loadIndexStatus();
      } else {
        setDeleteStatus({ deleting: null, error: '删除失败' });
      }
    } catch (error) {
      setDeleteStatus({
        deleting: null,
        error: error instanceof Error ? error.message : '删除失败',
      });
    } finally {
      setDeleteStatus({ deleting: null });
    }
  };

  // 刷新状态
  const handleRefresh = async () => {
    await checkConnectionAndLoadStatus();
  };

  // 获取文件类型图标
  const getFileIcon = (type: KhojIndexedDocument['type']) => {
    switch (type) {
      case 'markdown':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'pdf':
        return <FileType className="h-4 w-4 text-red-500" />;
      case 'org':
        return <File className="h-4 w-4 text-green-500" />;
      case 'text':
        return <FileText className="h-4 w-4 text-gray-500" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // 未连接状态
  if (!isLoading && !isConnected) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5" />
          知识库
        </h1>

        <Card>
          <CardContent className="p-8 text-center">
            <WifiOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium mb-2">Khoj 未连接</h2>
            <p className="text-sm text-muted-foreground mb-4">
              请先在设置中配置并启用 Khoj 服务
            </p>
            <Button variant="outline" onClick={() => window.location.href = '/settings'}>
              前往设置
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5" />
          知识库
        </h1>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Wifi className="h-3 w-3" />
              已连接
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <WifiOff className="h-3 w-3" />
              未连接
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {isLoading ? '-' : indexStatus?.indexed_files ?? documents.length}
                </p>
                <p className="text-xs text-muted-foreground">已索引文档</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {isLoading ? '加载中...' : indexStatus?.last_updated 
                    ? new Date(indexStatus.last_updated).toLocaleDateString()
                    : '未知'}
                </p>
                <p className="text-xs text-muted-foreground">最后更新</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 文档上传 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Upload className="h-4 w-4" />
            上传文档
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              点击或拖拽文件到此处上传
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              支持 PDF, Markdown, Word, 纯文本
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.md,.txt,.doc,.docx"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* 上传状态 */}
          {uploadStatus.uploading && (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              上传中...
            </div>
          )}

          {uploadStatus.message && !uploadStatus.uploading && (
            <div className={`flex items-center gap-2 text-sm ${
              uploadStatus.success ? 'text-green-600' : 'text-red-600'
            }`}>
              {uploadStatus.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {uploadStatus.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 标签切换 */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'search'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('search')}
        >
          <Search className="h-4 w-4 inline mr-1" />
          知识搜索
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'documents'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('documents')}
        >
          <FileText className="h-4 w-4 inline mr-1" />
          文档管理
          {documents.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-muted rounded-full">
              {documents.length}
            </span>
          )}
        </button>
      </div>

      {/* 搜索标签内容 */}
      {activeTab === 'search' && (
        <Card>
          <CardContent className="pt-4">
            <UnifiedSearch
              placeholder="搜索知识库..."
              onResultClick={(result) => {
                console.log('点击结果:', result);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* 文档管理标签内容 */}
      {activeTab === 'documents' && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">已索引文档</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadDocuments}
                disabled={isLoadingDocs}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingDocs ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingDocs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无已索引文档</p>
                <p className="text-xs mt-1">上传文档后将显示在这里</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.path}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {getFileIcon(doc.type)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{doc.filename}</p>
                        <p className="text-xs text-muted-foreground truncate">{doc.path}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                        {doc.type}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                        onClick={() => handleDeleteDocument(doc)}
                        disabled={deleteStatus.deleting === doc.path}
                      >
                        {deleteStatus.deleting === doc.path ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 删除错误提示 */}
            {deleteStatus.error && (
              <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {deleteStatus.error}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default KnowledgePage;
