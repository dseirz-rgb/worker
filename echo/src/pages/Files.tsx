/**
 * 文件管理页面
 * 深度参考 Paperless-ngx 的设计
 * 
 * 功能：
 * - 文件夹监控
 * - 文档 OCR
 * - AI 智能分类
 * - 全文搜索 + 语义搜索
 * - 标签管理
 * - 文档类型分类
 */

import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { FileSearchInput } from '../components/files/FileSearchInput';
import { FileCard, FolderCard } from '../components/files/FileCard';
import {
  searchFiles,
  semanticSearchFiles,
  addWatchFolder,
  removeWatchFolder,
  getWatchedFolders,
  getFileStats,
  classifyDocument,
  type FileSearchResult,
  type FileStats,
} from '../services/files';
import { 
  FolderPlus, 
  Sparkles, 
  Search, 
  FileText,
  Image,
  FileArchive,
  Folder,
  Tag,
  Clock,
  HardDrive,
  RefreshCw,
  Settings,
  Filter,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export default function FilesPage() {
  // 状态
  const [searchResults, setSearchResults] = useState<FileSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'normal' | 'semantic'>('normal');
  const [watchedFolders, setWatchedFolders] = useState<string[]>(getWatchedFolders());
  const [stats, setStats] = useState<FileStats | null>(null);
  const [activeTab, setActiveTab] = useState('search');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  // 加载统计信息
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const result = await getFileStats();
    if (result.success && result.data) {
      setStats(result.data);
    }
  };

  // 搜索文件
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setLoading(true);
    try {
      const result =
        searchMode === 'semantic'
          ? await semanticSearchFiles(query, { 
              limit: 20,
              tags: selectedTags.length > 0 ? selectedTags : undefined,
              types: selectedTypes.length > 0 ? selectedTypes : undefined,
            })
          : await searchFiles(query, { 
              limit: 20,
              tags: selectedTags.length > 0 ? selectedTags : undefined,
              types: selectedTypes.length > 0 ? selectedTypes : undefined,
            });

      if (result.success && result.data) {
        setSearchResults(result.data);
      }
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 添加监控文件夹
  const handleAddFolder = async () => {
    try {
      const selected = await invoke<string | null>('select_folder');
      if (selected) {
        await addWatchFolder(selected);
        setWatchedFolders(getWatchedFolders());
        loadStats();
      }
    } catch (error) {
      console.error('添加文件夹失败:', error);
    }
  };

  // 移除监控文件夹
  const handleRemoveFolder = async (path: string) => {
    await removeWatchFolder(path);
    setWatchedFolders(getWatchedFolders());
    loadStats();
  };

  // AI 分类文档
  const handleClassifyDocument = async (filePath: string) => {
    setLoading(true);
    try {
      const result = await classifyDocument(filePath);
      if (result.success) {
        // 刷新搜索结果
        loadStats();
      }
    } catch (error) {
      console.error('分类失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 切换标签筛选
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // 切换类型筛选
  const toggleType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  // 文件类型图标
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText className="h-4 w-4" />;
      case 'image': return <Image className="h-4 w-4" />;
      case 'archive': return <FileArchive className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Folder className="h-5 w-5" />
          文件管理
        </h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={loadStats} title="刷新">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="设置">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalFiles}</p>
                  <p className="text-xs text-muted-foreground">总文件数</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{formatSize(stats.totalSize)}</p>
                  <p className="text-xs text-muted-foreground">总大小</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.tagCount}</p>
                  <p className="text-xs text-muted-foreground">标签数</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.recentCount}</p>
                  <p className="text-xs text-muted-foreground">最近添加</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search" className="gap-1">
            <Search className="h-4 w-4" />
            搜索
          </TabsTrigger>
          <TabsTrigger value="folders" className="gap-1">
            <Folder className="h-4 w-4" />
            文件夹
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-1">
            <Tag className="h-4 w-4" />
            标签
          </TabsTrigger>
        </TabsList>

        {/* 搜索标签页 */}
        <TabsContent value="search" className="space-y-4">
          {/* 搜索模式切换 */}
          <div className="flex items-center gap-2">
            <Button
              variant={searchMode === 'normal' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSearchMode('normal')}
            >
              <Search className="h-4 w-4 mr-1" />
              全文搜索
            </Button>
            <Button
              variant={searchMode === 'semantic' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSearchMode('semantic')}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              语义搜索
            </Button>
            
            {/* 筛选器 */}
            {(selectedTags.length > 0 || selectedTypes.length > 0) && (
              <div className="flex items-center gap-1 ml-auto">
                <Filter className="h-4 w-4 text-muted-foreground" />
                {selectedTags.map(tag => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag} ×
                  </Badge>
                ))}
                {selectedTypes.map(type => (
                  <Badge 
                    key={type} 
                    variant="outline" 
                    className="cursor-pointer"
                    onClick={() => toggleType(type)}
                  >
                    {type} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 搜索输入 */}
          <FileSearchInput onSearch={handleSearch} loading={loading} />

          {/* 搜索结果 */}
          {searchResults.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">
                  搜索结果 ({searchResults.length})
                </h2>
                {searchMode === 'semantic' && (
                  <Badge variant="outline" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI 语义匹配
                  </Badge>
                )}
              </div>
              {searchResults.map((result) => (
                <FileCard
                  key={result.file.id}
                  file={result.file}
                  highlights={result.highlights}
                  score={result.score}
                  onClassify={() => handleClassifyDocument(result.file.path)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>输入关键词搜索文件</p>
              <p className="text-xs mt-1">支持文件名、内容、标签搜索</p>
            </div>
          )}
        </TabsContent>

        {/* 文件夹标签页 */}
        <TabsContent value="folders" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">监控文件夹</CardTitle>
                <Button variant="outline" size="sm" onClick={handleAddFolder}>
                  <FolderPlus className="h-4 w-4 mr-1" />
                  添加
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                添加文件夹后，Echo 会自动索引其中的文档
              </p>
            </CardHeader>
            <CardContent>
              {watchedFolders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>暂未添加监控文件夹</p>
                  <p className="text-xs mt-1">点击"添加"选择要监控的文件夹</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {watchedFolders.map((folder) => (
                    <FolderCard
                      key={folder}
                      path={folder}
                      onRemove={() => handleRemoveFolder(folder)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 索引状态 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">索引状态</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">已索引文件</span>
                  <span>{stats?.totalFiles || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">待处理文件</span>
                  <span>{stats?.pendingCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">最后更新</span>
                  <span>{stats?.lastIndexed ? new Date(stats.lastIndexed).toLocaleString('zh-CN') : '-'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 标签标签页 */}
        <TabsContent value="tags" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">文档类型</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {stats?.typeDistribution && Object.entries(stats.typeDistribution).map(([type, count]) => (
                  <Badge 
                    key={type}
                    variant={selectedTypes.includes(type) ? 'default' : 'outline'}
                    className="cursor-pointer gap-1"
                    onClick={() => toggleType(type)}
                  >
                    {getTypeIcon(type)}
                    {type}
                    <span className="text-xs opacity-70">({count})</span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">标签云</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.topTags && stats.topTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {stats.topTags.map((tag) => (
                    <Badge 
                      key={tag.name}
                      variant={selectedTags.includes(tag.name) ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => toggleTag(tag.name)}
                    >
                      {tag.name}
                      <span className="text-xs opacity-70 ml-1">({tag.count})</span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  暂无标签
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
