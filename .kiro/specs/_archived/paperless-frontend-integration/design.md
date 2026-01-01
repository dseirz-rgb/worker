# Design Document - Paperless 分阶段整合

## Overview

本设计文档描述 Paperless-ngx 分阶段整合到 Blinko 的技术方案。采用前端优先策略，先完全整合前端 UI，再分阶段整合后端服务。

### 设计原则

1. **前端优先** - 先统一用户体验，后端可以逐步迁移
2. **接口稳定** - 定义稳定的前端接口，后端实现可替换
3. **渐进增强** - 先实现核心功能，再添加高级功能
4. **开源复用** - 复用 Paperless-ngx 的成熟方案

### 技术栈

| 层级 | 技术选择 | 说明 |
|------|---------|------|
| 前端框架 | React 19 + TypeScript | Blinko 现有技术栈 |
| UI 组件 | Radix UI + Tailwind CSS | Blinko 现有组件库 |
| 状态管理 | React Query + Zustand | 数据获取和本地状态 |
| PDF 预览 | react-pdf (pdf.js) | PDF 渲染 |
| 后端框架 | tRPC + Express | Blinko 现有技术栈 |
| 数据库 | PostgreSQL + Prisma | Blinko 现有数据库 |
| 文件存储 | S3/本地文件系统 | 可配置 |
| OCR | tesseract.js | 浏览器/Node.js OCR |

---

## Architecture

### Phase 1 架构 (前端整合)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Blinko Frontend                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Pages                                                                   │
│  └── /files (FilesPage)                                                 │
│      ├── FileSidebar - 过滤器侧边栏                                      │
│      ├── FileToolbar - 搜索和操作栏                                      │
│      ├── FileList - 文档列表                                             │
│      ├── FileDetail - 文档详情面板                                       │
│      └── FilePreviewModal - 预览模态框                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Hooks                                                                   │
│  ├── useDocuments - 文档列表查询                                         │
│  ├── useDocumentSearch - 搜索查询                                        │
│  ├── useDocumentMutations - 文档 CRUD                                   │
│  ├── useTags - 标签管理                                                  │
│  ├── useDocumentTypes - 文档类型管理                                     │
│  └── useCorrespondents - 通讯者管理                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Services (tRPC Client)                                                 │
│  └── api.paperless.* - Paperless API 调用                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ tRPC
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Blinko Backend                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  tRPC Router                                                            │
│  └── paperlessRouter                                                    │
│      ├── documents.list - 文档列表                                       │
│      ├── documents.search - 搜索                                         │
│      ├── documents.get - 获取详情                                        │
│      ├── documents.upload - 上传                                         │
│      ├── documents.update - 更新                                         │
│      ├── documents.delete - 删除                                         │
│      ├── documents.download - 下载                                       │
│      ├── documents.preview - 预览                                        │
│      ├── tags.* - 标签 CRUD                                             │
│      ├── documentTypes.* - 类型 CRUD                                    │
│      ├── correspondents.* - 通讯者 CRUD                                 │
│      └── config.* - 配置管理                                             │
├─────────────────────────────────────────────────────────────────────────┤
│  Services                                                               │
│  └── PaperlessClient - Paperless API 客户端                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP REST API
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Paperless-ngx (独立服务)                              │
│  ├── Django Web Server (:8000)                                          │
│  ├── PostgreSQL (文档数据)                                               │
│  ├── Redis (任务队列)                                                    │
│  └── Consumer (OCR 处理)                                                 │
└─────────────────────────────────────────────────────────────────────────┘
```


### Phase 2-4 目标架构 (完全整合)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Blinko (完全整合)                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Frontend (不变)                                                        │
│  └── /files (FilesPage) - 相同的组件和 hooks                            │
├─────────────────────────────────────────────────────────────────────────┤
│  Backend                                                                │
│  ├── tRPC Router (接口不变)                                              │
│  │   └── documentsRouter - 替换 paperlessRouter                         │
│  ├── Services                                                           │
│  │   ├── DocumentService - 文档业务逻辑                                  │
│  │   ├── OcrService - OCR 处理                                          │
│  │   ├── SearchService - 全文搜索                                        │
│  │   └── StorageService - 文件存储                                       │
│  └── Jobs (pg-boss)                                                     │
│      ├── documentOcrJob - OCR 异步处理                                   │
│      └── documentIndexJob - 搜索索引更新                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Database (PostgreSQL)                                                  │
│  ├── Document - 文档表                                                   │
│  ├── DocumentType - 文档类型表                                           │
│  ├── Correspondent - 通讯者表                                            │
│  ├── DocumentTag - 文档标签关联表                                        │
│  └── FTS Index - 全文搜索索引                                            │
├─────────────────────────────────────────────────────────────────────────┤
│  Storage                                                                │
│  ├── S3/MinIO (生产环境)                                                 │
│  └── 本地文件系统 (开发环境)                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Components and Interfaces

### 1. 前端组件设计

#### 1.1 页面组件 (FilesPage)

```typescript
// app/src/pages/files.tsx

export default function FilesPage() {
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<DocumentFilters>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <div className="flex h-full">
      {/* 左侧边栏：过滤器 */}
      <FileSidebar 
        filters={filters}
        onFiltersChange={setFilters}
      />
      
      {/* 主内容区 */}
      <div className="flex-1 flex flex-col">
        <FileToolbar 
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
        <FileList 
          searchQuery={searchQuery}
          filters={filters}
          viewMode={viewMode}
          selectedDocId={selectedDocId}
          onSelectDoc={setSelectedDocId}
        />
      </div>
      
      {/* 右侧详情面板 */}
      {selectedDocId && (
        <FileDetail 
          documentId={selectedDocId}
          onClose={() => setSelectedDocId(null)}
        />
      )}
      
      {/* 预览模态框 */}
      <FilePreviewModal />
      
      {/* 上传模态框 */}
      <FileUploadModal />
    </div>
  );
}
```

#### 1.2 侧边栏组件 (FileSidebar)

```typescript
// app/src/components/Files/FileSidebar.tsx

interface FileSidebarProps {
  filters: DocumentFilters;
  onFiltersChange: (filters: DocumentFilters) => void;
}

export function FileSidebar({ filters, onFiltersChange }: FileSidebarProps) {
  const { data: tags } = useTags();
  const { data: documentTypes } = useDocumentTypes();
  const { data: correspondents } = useCorrespondents();

  return (
    <aside className="w-64 border-r bg-background/50 backdrop-blur p-4 space-y-6">
      {/* 标签过滤 */}
      <FilterSection title="标签">
        {tags?.map(tag => (
          <FilterItem
            key={tag.id}
            label={tag.name}
            count={tag.document_count}
            color={tag.color}
            selected={filters.tagIds?.includes(tag.id)}
            onToggle={() => toggleTagFilter(tag.id)}
          />
        ))}
        <AddTagButton />
      </FilterSection>

      {/* 文档类型过滤 */}
      <FilterSection title="文档类型">
        {documentTypes?.map(type => (
          <FilterItem
            key={type.id}
            label={type.name}
            count={type.document_count}
            selected={filters.documentTypeId === type.id}
            onToggle={() => setTypeFilter(type.id)}
          />
        ))}
      </FilterSection>

      {/* 通讯者过滤 */}
      <FilterSection title="通讯者">
        {correspondents?.map(corr => (
          <FilterItem
            key={corr.id}
            label={corr.name}
            count={corr.document_count}
            selected={filters.correspondentId === corr.id}
            onToggle={() => setCorrespondentFilter(corr.id)}
          />
        ))}
      </FilterSection>

      {/* 日期范围过滤 */}
      <FilterSection title="日期范围">
        <DateRangePicker
          value={filters.dateRange}
          onChange={(range) => onFiltersChange({ ...filters, dateRange: range })}
        />
      </FilterSection>
    </aside>
  );
}
```

#### 1.3 文档列表组件 (FileList)

```typescript
// app/src/components/Files/FileList.tsx

interface FileListProps {
  searchQuery: string;
  filters: DocumentFilters;
  viewMode: 'grid' | 'list';
  selectedDocId: number | null;
  onSelectDoc: (id: number) => void;
}

export function FileList({ searchQuery, filters, viewMode, selectedDocId, onSelectDoc }: FileListProps) {
  const { 
    data, 
    fetchNextPage, 
    hasNextPage, 
    isLoading 
  } = useDocuments({ searchQuery, filters });

  // 无限滚动
  const { ref: loadMoreRef } = useInView({
    onChange: (inView) => {
      if (inView && hasNextPage) fetchNextPage();
    }
  });

  if (isLoading) {
    return <FileListSkeleton viewMode={viewMode} />;
  }

  if (!data?.pages[0]?.results.length) {
    return <EmptyState onUpload={() => openUploadModal()} />;
  }

  const documents = data.pages.flatMap(page => page.results);

  return (
    <div className={viewMode === 'grid' ? 'grid grid-cols-4 gap-4 p-4' : 'flex flex-col'}>
      {documents.map(doc => (
        <DocumentCard
          key={doc.id}
          document={doc}
          viewMode={viewMode}
          selected={selectedDocId === doc.id}
          onClick={() => onSelectDoc(doc.id)}
          onDoubleClick={() => openPreview(doc.id)}
        />
      ))}
      <div ref={loadMoreRef} />
    </div>
  );
}
```


#### 1.4 文档卡片组件 (DocumentCard)

```typescript
// app/src/components/Files/DocumentCard.tsx

interface DocumentCardProps {
  document: PaperlessDocument;
  viewMode: 'grid' | 'list';
  selected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

export function DocumentCard({ document, viewMode, selected, onClick, onDoubleClick }: DocumentCardProps) {
  const { data: tags } = useTags();
  const { data: correspondents } = useCorrespondents();

  const correspondent = correspondents?.find(c => c.id === document.correspondent);
  const docTags = tags?.filter(t => document.tags.includes(t.id));

  if (viewMode === 'grid') {
    return (
      <div 
        className={cn(
          "group relative rounded-lg border bg-card p-3 cursor-pointer transition-all",
          "hover:shadow-md hover:border-primary/50",
          selected && "ring-2 ring-primary"
        )}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        {/* 缩略图 */}
        <div className="aspect-[3/4] rounded bg-muted mb-2 overflow-hidden">
          <DocumentThumbnail documentId={document.id} />
        </div>
        
        {/* 标题 */}
        <h3 className="font-medium text-sm truncate">{document.title}</h3>
        
        {/* 元数据 */}
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{formatDate(document.added)}</span>
          {correspondent && <span>• {correspondent.name}</span>}
        </div>
        
        {/* 标签 */}
        {docTags && docTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {docTags.slice(0, 3).map(tag => (
              <Badge key={tag.id} style={{ backgroundColor: tag.color }} variant="secondary" className="text-xs">
                {tag.name}
              </Badge>
            ))}
            {docTags.length > 3 && (
              <Badge variant="outline" className="text-xs">+{docTags.length - 3}</Badge>
            )}
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div 
      className={cn(
        "flex items-center gap-4 p-3 border-b cursor-pointer transition-colors",
        "hover:bg-muted/50",
        selected && "bg-primary/10"
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <DocumentThumbnail documentId={document.id} size="sm" />
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{document.title}</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{formatDate(document.added)}</span>
          {correspondent && <span>• {correspondent.name}</span>}
        </div>
      </div>
      <div className="flex gap-1">
        {docTags?.slice(0, 2).map(tag => (
          <Badge key={tag.id} style={{ backgroundColor: tag.color }} variant="secondary">
            {tag.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
```

#### 1.5 文档详情面板 (FileDetail)

```typescript
// app/src/components/Files/FileDetail.tsx

interface FileDetailProps {
  documentId: number;
  onClose: () => void;
}

export function FileDetail({ documentId, onClose }: FileDetailProps) {
  const { data: document, isLoading } = useDocument(documentId);
  const updateMutation = useUpdateDocument();
  const deleteMutation = useDeleteDocument();

  const [editMode, setEditMode] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedTags, setEditedTags] = useState<number[]>([]);

  useEffect(() => {
    if (document) {
      setEditedTitle(document.title);
      setEditedTags(document.tags);
    }
  }, [document]);

  const handleSave = async () => {
    await updateMutation.mutateAsync({
      id: documentId,
      title: editedTitle,
      tagIds: editedTags,
    });
    setEditMode(false);
  };

  const handleDelete = async () => {
    if (confirm('确定要删除这个文档吗？此操作不可撤销。')) {
      await deleteMutation.mutateAsync({ id: documentId });
      onClose();
    }
  };

  if (isLoading) return <FileDetailSkeleton />;
  if (!document) return null;

  return (
    <aside className="w-80 border-l bg-background/50 backdrop-blur p-4">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">文档详情</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 预览缩略图 */}
      <div className="aspect-[3/4] rounded-lg bg-muted mb-4 overflow-hidden cursor-pointer"
           onClick={() => openPreview(documentId)}>
        <DocumentThumbnail documentId={documentId} size="lg" />
      </div>

      {/* 标题 */}
      <div className="mb-4">
        <Label>标题</Label>
        {editMode ? (
          <Input value={editedTitle} onChange={e => setEditedTitle(e.target.value)} />
        ) : (
          <p className="text-sm">{document.title}</p>
        )}
      </div>

      {/* 标签 */}
      <div className="mb-4">
        <Label>标签</Label>
        <TagSelector 
          value={editedTags} 
          onChange={setEditedTags}
          disabled={!editMode}
        />
      </div>

      {/* 文档类型 */}
      <div className="mb-4">
        <Label>文档类型</Label>
        <DocumentTypeSelector 
          value={document.document_type}
          onChange={(typeId) => updateMutation.mutate({ id: documentId, documentTypeId: typeId })}
        />
      </div>

      {/* 通讯者 */}
      <div className="mb-4">
        <Label>通讯者</Label>
        <CorrespondentSelector 
          value={document.correspondent}
          onChange={(corrId) => updateMutation.mutate({ id: documentId, correspondentId: corrId })}
        />
      </div>

      {/* 日期信息 */}
      <div className="mb-4 text-sm text-muted-foreground">
        <p>添加时间: {formatDate(document.added)}</p>
        <p>创建时间: {formatDate(document.created)}</p>
        <p>修改时间: {formatDate(document.modified)}</p>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => openPreview(documentId)}>
          <Eye className="h-4 w-4 mr-2" />
          预览
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => downloadDocument(documentId)}>
          <Download className="h-4 w-4 mr-2" />
          下载
        </Button>
      </div>

      <div className="flex gap-2 mt-2">
        {editMode ? (
          <>
            <Button className="flex-1" onClick={handleSave}>保存</Button>
            <Button variant="outline" onClick={() => setEditMode(false)}>取消</Button>
          </>
        ) : (
          <Button variant="outline" className="flex-1" onClick={() => setEditMode(true)}>
            <Edit className="h-4 w-4 mr-2" />
            编辑
          </Button>
        )}
        <Button variant="destructive" size="icon" onClick={handleDelete}>
          <Trash className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
```


#### 1.6 预览模态框 (FilePreviewModal)

```typescript
// app/src/components/Files/FilePreviewModal.tsx

export function FilePreviewModal() {
  const { isOpen, documentId, close } = usePreviewStore();
  const { data: document } = useDocument(documentId);
  const { data: previewUrl } = useDocumentPreview(documentId);

  if (!isOpen || !document) return null;

  const isPdf = document.original_file_name.toLowerCase().endsWith('.pdf');
  const isImage = /\.(png|jpg|jpeg|gif|tiff)$/i.test(document.original_file_name);
  const isText = /\.(txt|md)$/i.test(document.original_file_name);

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{document.title}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="preview" className="flex-1 flex flex-col">
          <TabsList>
            <TabsTrigger value="preview">预览</TabsTrigger>
            <TabsTrigger value="ocr">OCR 文本</TabsTrigger>
            <TabsTrigger value="metadata">元数据</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="flex-1 overflow-hidden">
            {isPdf && (
              <PdfViewer url={previewUrl} />
            )}
            {isImage && (
              <ImageViewer url={previewUrl} />
            )}
            {isText && (
              <TextViewer content={document.content} />
            )}
            {!isPdf && !isImage && !isText && (
              <div className="flex flex-col items-center justify-center h-full">
                <FileIcon className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">无法预览此文件类型</p>
                <Button className="mt-4" onClick={() => downloadDocument(documentId)}>
                  下载文件
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ocr" className="flex-1 overflow-auto p-4">
            <pre className="whitespace-pre-wrap text-sm">{document.content}</pre>
          </TabsContent>

          <TabsContent value="metadata" className="flex-1 overflow-auto p-4">
            <DocumentMetadata document={document} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => downloadDocument(documentId)}>
            <Download className="h-4 w-4 mr-2" />
            下载原文件
          </Button>
          <Button onClick={close}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### 1.7 上传模态框 (FileUploadModal)

```typescript
// app/src/components/Files/FileUploadModal.tsx

export function FileUploadModal() {
  const { isOpen, close } = useUploadStore();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const uploadMutation = useUploadDocument();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: crypto.randomUUID(),
      title: file.name.replace(/\.[^/.]+$/, ''),
      tags: [],
      documentType: null,
      progress: 0,
      status: 'pending' as const,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.tiff'],
      'text/*': ['.txt', '.md'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleUpload = async () => {
    for (const uploadFile of files.filter(f => f.status === 'pending')) {
      try {
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
        ));

        const base64 = await fileToBase64(uploadFile.file);
        await uploadMutation.mutateAsync({
          fileBase64: base64,
          filename: uploadFile.file.name,
          title: uploadFile.title,
          tagIds: uploadFile.tags,
          documentTypeId: uploadFile.documentType,
        });

        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'success', progress: 100 } : f
        ));
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'error', error: String(error) } : f
        ));
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>上传文档</DialogTitle>
        </DialogHeader>

        {/* 拖放区域 */}
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            isDragActive ? "border-primary bg-primary/10" : "border-muted-foreground/25"
          )}
        >
          <input {...getInputProps()} />
          <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {isDragActive ? "放开以上传文件" : "拖放文件到这里，或点击选择文件"}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            支持 PDF, 图片, Word, Excel, 文本文件 (最大 50MB)
          </p>
        </div>

        {/* 文件列表 */}
        {files.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-auto">
            {files.map(file => (
              <UploadFileItem
                key={file.id}
                file={file}
                onTitleChange={(title) => updateFile(file.id, { title })}
                onTagsChange={(tags) => updateFile(file.id, { tags })}
                onRemove={() => removeFile(file.id)}
              />
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>取消</Button>
          <Button onClick={handleUpload} disabled={files.length === 0}>
            上传 {files.filter(f => f.status === 'pending').length} 个文件
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```


### 2. 后端服务设计

#### 2.1 Paperless API 客户端

```typescript
// server/lib/paperlessClient.ts

export interface PaperlessConfig {
  baseUrl: string;
  apiToken: string;
}

export interface PaperlessDocument {
  id: number;
  title: string;
  content: string;
  created: string;
  modified: string;
  added: string;
  correspondent: number | null;
  document_type: number | null;
  tags: number[];
  archive_serial_number: number | null;
  original_file_name: string;
  archived_file_name: string;
}

export interface PaperlessTag {
  id: number;
  name: string;
  color: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
  document_count?: number;
}

export interface PaperlessDocumentType {
  id: number;
  name: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
  document_count?: number;
}

export interface PaperlessCorrespondent {
  id: number;
  name: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
  document_count?: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export class PaperlessClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: PaperlessConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.headers = {
      'Authorization': `Token ${config.apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  // ========== 文档操作 ==========

  async listDocuments(params?: {
    page?: number;
    page_size?: number;
    ordering?: string;
    tags__id__in?: number[];
    document_type__id?: number;
    correspondent__id?: number;
    query?: string;
  }): Promise<PaginatedResponse<PaperlessDocument>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    if (params?.ordering) searchParams.set('ordering', params.ordering);
    if (params?.tags__id__in?.length) {
      searchParams.set('tags__id__in', params.tags__id__in.join(','));
    }
    if (params?.document_type__id) {
      searchParams.set('document_type__id', String(params.document_type__id));
    }
    if (params?.correspondent__id) {
      searchParams.set('correspondent__id', String(params.correspondent__id));
    }
    if (params?.query) searchParams.set('query', params.query);

    const response = await fetch(
      `${this.baseUrl}/api/documents/?${searchParams}`,
      { headers: this.headers }
    );
    
    if (!response.ok) {
      throw new Error(`Paperless API error: ${response.status}`);
    }
    
    return response.json();
  }

  async getDocument(id: number): Promise<PaperlessDocument> {
    const response = await fetch(
      `${this.baseUrl}/api/documents/${id}/`,
      { headers: this.headers }
    );
    
    if (!response.ok) {
      throw new Error(`Document not found: ${id}`);
    }
    
    return response.json();
  }

  async uploadDocument(
    file: Buffer,
    filename: string,
    metadata?: {
      title?: string;
      correspondent?: number;
      document_type?: number;
      tags?: number[];
    }
  ): Promise<{ task_id: string }> {
    const formData = new FormData();
    formData.append('document', new Blob([file]), filename);
    if (metadata?.title) formData.append('title', metadata.title);
    if (metadata?.correspondent) formData.append('correspondent', String(metadata.correspondent));
    if (metadata?.document_type) formData.append('document_type', String(metadata.document_type));
    if (metadata?.tags) {
      metadata.tags.forEach(tag => formData.append('tags', String(tag)));
    }

    const response = await fetch(
      `${this.baseUrl}/api/documents/post_document/`,
      {
        method: 'POST',
        headers: { 'Authorization': this.headers['Authorization'] },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upload failed: ${error}`);
    }

    return response.json();
  }

  async updateDocument(
    id: number,
    data: Partial<{
      title: string;
      correspondent: number | null;
      document_type: number | null;
      tags: number[];
    }>
  ): Promise<PaperlessDocument> {
    const response = await fetch(
      `${this.baseUrl}/api/documents/${id}/`,
      {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error(`Update failed: ${response.status}`);
    }

    return response.json();
  }

  async deleteDocument(id: number): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/documents/${id}/`,
      {
        method: 'DELETE',
        headers: this.headers,
      }
    );

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.status}`);
    }
  }

  async downloadDocument(id: number): Promise<Buffer> {
    const response = await fetch(
      `${this.baseUrl}/api/documents/${id}/download/`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async getDocumentPreview(id: number): Promise<Buffer> {
    const response = await fetch(
      `${this.baseUrl}/api/documents/${id}/preview/`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Preview failed: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async getDocumentThumbnail(id: number): Promise<Buffer> {
    const response = await fetch(
      `${this.baseUrl}/api/documents/${id}/thumb/`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Thumbnail failed: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  // ========== 标签操作 ==========

  async listTags(): Promise<PaperlessTag[]> {
    const response = await fetch(
      `${this.baseUrl}/api/tags/`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to list tags: ${response.status}`);
    }

    const data = await response.json();
    return data.results || data;
  }

  async createTag(data: { name: string; color?: string }): Promise<PaperlessTag> {
    const response = await fetch(
      `${this.baseUrl}/api/tags/`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create tag: ${response.status}`);
    }

    return response.json();
  }

  async updateTag(id: number, data: { name?: string; color?: string }): Promise<PaperlessTag> {
    const response = await fetch(
      `${this.baseUrl}/api/tags/${id}/`,
      {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update tag: ${response.status}`);
    }

    return response.json();
  }

  async deleteTag(id: number): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/tags/${id}/`,
      {
        method: 'DELETE',
        headers: this.headers,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete tag: ${response.status}`);
    }
  }

  // ========== 文档类型操作 ==========

  async listDocumentTypes(): Promise<PaperlessDocumentType[]> {
    const response = await fetch(
      `${this.baseUrl}/api/document_types/`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to list document types: ${response.status}`);
    }

    const data = await response.json();
    return data.results || data;
  }

  async createDocumentType(data: { name: string }): Promise<PaperlessDocumentType> {
    const response = await fetch(
      `${this.baseUrl}/api/document_types/`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create document type: ${response.status}`);
    }

    return response.json();
  }

  async deleteDocumentType(id: number): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/document_types/${id}/`,
      {
        method: 'DELETE',
        headers: this.headers,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete document type: ${response.status}`);
    }
  }

  // ========== 通讯者操作 ==========

  async listCorrespondents(): Promise<PaperlessCorrespondent[]> {
    const response = await fetch(
      `${this.baseUrl}/api/correspondents/`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to list correspondents: ${response.status}`);
    }

    const data = await response.json();
    return data.results || data;
  }

  async createCorrespondent(data: { name: string }): Promise<PaperlessCorrespondent> {
    const response = await fetch(
      `${this.baseUrl}/api/correspondents/`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create correspondent: ${response.status}`);
    }

    return response.json();
  }

  async deleteCorrespondent(id: number): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/correspondents/${id}/`,
      {
        method: 'DELETE',
        headers: this.headers,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete correspondent: ${response.status}`);
    }
  }

  // ========== 连接测试 ==========

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/`,
        { headers: this.headers }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

// 工厂函数：从数据库配置创建客户端
export async function createPaperlessClient(accountId: number): Promise<PaperlessClient> {
  const config = await prisma.config.findFirst({
    where: { accountId, key: 'paperless' },
  });

  if (!config?.value) {
    throw new Error('Paperless-ngx 未配置。请在设置中配置连接信息。');
  }

  const { baseUrl, apiToken } = config.value as { baseUrl: string; apiToken: string };
  
  if (!baseUrl || !apiToken) {
    throw new Error('Paperless-ngx 配置不完整。请检查 URL 和 API Token。');
  }

  return new PaperlessClient({ baseUrl, apiToken });
}
```


#### 2.2 tRPC 路由

```typescript
// server/routerTrpc/paperless.ts

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { createPaperlessClient } from '../lib/paperlessClient';

export const paperlessRouter = router({
  // ========== 文档操作 ==========

  listDocuments: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      ordering: z.string().optional(),
      tagIds: z.array(z.number()).optional(),
      documentTypeId: z.number().optional(),
      correspondentId: z.number().optional(),
      query: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const client = await createPaperlessClient(ctx.id);
      return client.listDocuments({
        page: input.page,
        page_size: input.pageSize,
        ordering: input.ordering,
        tags__id__in: input.tagIds,
        document_type__id: input.documentTypeId,
        correspondent__id: input.correspondentId,
        query: input.query,
      });
    }),

  searchDocuments: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      page: z.number().default(1),
      pageSize: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const client = await createPaperlessClient(ctx.id);
      return client.listDocuments({
        query: input.query,
        page: input.page,
        page_size: input.pageSize,
      });
    }),

  getDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const client = await createPaperlessClient(ctx.id);
      return client.getDocument(input.id);
    }),

  uploadDocument: protectedProcedure
    .input(z.object({
      fileBase64: z.string(),
      filename: z.string(),
      title: z.string().optional(),
      documentTypeId: z.number().optional(),
      correspondentId: z.number().optional(),
      tagIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = await createPaperlessClient(ctx.id);
      const buffer = Buffer.from(input.fileBase64, 'base64');
      return client.uploadDocument(buffer, input.filename, {
        title: input.title,
        document_type: input.documentTypeId,
        correspondent: input.correspondentId,
        tags: input.tagIds,
      });
    }),

  updateDocument: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      tagIds: z.array(z.number()).optional(),
      documentTypeId: z.number().nullish(),
      correspondentId: z.number().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = await createPaperlessClient(ctx.id);
      return client.updateDocument(input.id, {
        title: input.title,
        tags: input.tagIds,
        document_type: input.documentTypeId ?? undefined,
        correspondent: input.correspondentId ?? undefined,
      });
    }),

  deleteDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const client = await createPaperlessClient(ctx.id);
      await client.deleteDocument(input.id);
      return { success: true };
    }),

  downloadDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const client = await createPaperlessClient(ctx.id);
      const buffer = await client.downloadDocument(input.id);
      return buffer.toString('base64');
    }),

  getPreview: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const client = await createPaperlessClient(ctx.id);
      const buffer = await client.getDocumentPreview(input.id);
      return buffer.toString('base64');
    }),

  getThumbnail: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const client = await createPaperlessClient(ctx.id);
      const buffer = await client.getDocumentThumbnail(input.id);
      return buffer.toString('base64');
    }),

  // ========== 标签操作 ==========

  listTags: protectedProcedure
    .query(async ({ ctx }) => {
      const client = await createPaperlessClient(ctx.id);
      return client.listTags();
    }),

  createTag: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      color: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = await createPaperlessClient(ctx.id);
      return client.createTag(input);
    }),

  updateTag: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = await createPaperlessClient(ctx.id);
      return client.updateTag(input.id, {
        name: input.name,
        color: input.color,
      });
    }),

  deleteTag: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const client = await createPaperlessClient(ctx.id);
      await client.deleteTag(input.id);
      return { success: true };
    }),

  // ========== 文档类型操作 ==========

  listDocumentTypes: protectedProcedure
    .query(async ({ ctx }) => {
      const client = await createPaperlessClient(ctx.id);
      return client.listDocumentTypes();
    }),

  createDocumentType: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const client = await createPaperlessClient(ctx.id);
      return client.createDocumentType(input);
    }),

  deleteDocumentType: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const client = await createPaperlessClient(ctx.id);
      await client.deleteDocumentType(input.id);
      return { success: true };
    }),

  // ========== 通讯者操作 ==========

  listCorrespondents: protectedProcedure
    .query(async ({ ctx }) => {
      const client = await createPaperlessClient(ctx.id);
      return client.listCorrespondents();
    }),

  createCorrespondent: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const client = await createPaperlessClient(ctx.id);
      return client.createCorrespondent(input);
    }),

  deleteCorrespondent: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const client = await createPaperlessClient(ctx.id);
      await client.deleteCorrespondent(input.id);
      return { success: true };
    }),

  // ========== 配置操作 ==========

  getConfig: protectedProcedure
    .query(async ({ ctx }) => {
      const config = await prisma.config.findFirst({
        where: { accountId: ctx.id, key: 'paperless' },
      });
      if (!config?.value) {
        return { configured: false, baseUrl: '', apiToken: '' };
      }
      const { baseUrl, apiToken } = config.value as { baseUrl: string; apiToken: string };
      return { configured: true, baseUrl, apiToken: '••••••••' }; // 隐藏 token
    }),

  saveConfig: protectedProcedure
    .input(z.object({
      baseUrl: z.string().url(),
      apiToken: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await prisma.config.upsert({
        where: { accountId_key: { accountId: ctx.id, key: 'paperless' } },
        create: {
          accountId: ctx.id,
          key: 'paperless',
          value: { baseUrl: input.baseUrl, apiToken: input.apiToken },
        },
        update: {
          value: { baseUrl: input.baseUrl, apiToken: input.apiToken },
        },
      });
      return { success: true };
    }),

  testConnection: protectedProcedure
    .input(z.object({
      baseUrl: z.string().url(),
      apiToken: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      try {
        const client = new PaperlessClient({
          baseUrl: input.baseUrl,
          apiToken: input.apiToken,
        });
        const success = await client.testConnection();
        return { success, error: success ? null : '无法连接到 Paperless-ngx 服务' };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }),
});
```


### 3. React Hooks 设计

```typescript
// app/src/hooks/usePaperless.ts

import { api } from '@/lib/trpc';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ========== 文档查询 ==========

export interface DocumentFilters {
  tagIds?: number[];
  documentTypeId?: number;
  correspondentId?: number;
  dateRange?: { from: Date; to: Date };
}

export function useDocuments(params: {
  searchQuery?: string;
  filters?: DocumentFilters;
  pageSize?: number;
}) {
  return useInfiniteQuery({
    queryKey: ['documents', params],
    queryFn: async ({ pageParam = 1 }) => {
      return api.paperless.listDocuments.query({
        page: pageParam,
        pageSize: params.pageSize || 20,
        query: params.searchQuery,
        tagIds: params.filters?.tagIds,
        documentTypeId: params.filters?.documentTypeId,
        correspondentId: params.filters?.correspondentId,
      });
    },
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.next) {
        return pages.length + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });
}

export function useDocument(id: number | null) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => api.paperless.getDocument.query({ id: id! }),
    enabled: !!id,
  });
}

export function useDocumentPreview(id: number | null) {
  return useQuery({
    queryKey: ['document-preview', id],
    queryFn: async () => {
      const base64 = await api.paperless.getPreview.query({ id: id! });
      return `data:application/pdf;base64,${base64}`;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
  });
}

export function useDocumentThumbnail(id: number) {
  return useQuery({
    queryKey: ['document-thumbnail', id],
    queryFn: async () => {
      const base64 = await api.paperless.getThumbnail.query({ id });
      return `data:image/png;base64,${base64}`;
    },
    staleTime: 10 * 60 * 1000, // 10 分钟缓存
  });
}

// ========== 文档变更 ==========

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      fileBase64: string;
      filename: string;
      title?: string;
      tagIds?: number[];
      documentTypeId?: number;
    }) => api.paperless.uploadDocument.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      id: number;
      title?: string;
      tagIds?: number[];
      documentTypeId?: number | null;
      correspondentId?: number | null;
    }) => api.paperless.updateDocument.mutate(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', variables.id] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: number }) => api.paperless.deleteDocument.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

// ========== 标签 ==========

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => api.paperless.listTags.query(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; color?: string }) => 
      api.paperless.createTag.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: number; name?: string; color?: string }) =>
      api.paperless.updateTag.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: number }) => api.paperless.deleteTag.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

// ========== 文档类型 ==========

export function useDocumentTypes() {
  return useQuery({
    queryKey: ['documentTypes'],
    queryFn: () => api.paperless.listDocumentTypes.query(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateDocumentType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string }) => 
      api.paperless.createDocumentType.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentTypes'] });
    },
  });
}

export function useDeleteDocumentType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: number }) => 
      api.paperless.deleteDocumentType.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentTypes'] });
    },
  });
}

// ========== 通讯者 ==========

export function useCorrespondents() {
  return useQuery({
    queryKey: ['correspondents'],
    queryFn: () => api.paperless.listCorrespondents.query(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCorrespondent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string }) => 
      api.paperless.createCorrespondent.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correspondents'] });
    },
  });
}

export function useDeleteCorrespondent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: number }) => 
      api.paperless.deleteCorrespondent.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correspondents'] });
    },
  });
}

// ========== 配置 ==========

export function usePaperlessConfig() {
  return useQuery({
    queryKey: ['paperless-config'],
    queryFn: () => api.paperless.getConfig.query(),
  });
}

export function useSavePaperlessConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { baseUrl: string; apiToken: string }) =>
      api.paperless.saveConfig.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paperless-config'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['documentTypes'] });
      queryClient.invalidateQueries({ queryKey: ['correspondents'] });
    },
  });
}

export function useTestPaperlessConnection() {
  return useMutation({
    mutationFn: (data: { baseUrl: string; apiToken: string }) =>
      api.paperless.testConnection.mutate(data),
  });
}
```


---

## Data Models

### Phase 1: 配置存储 (复用 Blinko config 表)

```typescript
// 存储在 config 表中
// key: 'paperless'
// value: JSON
interface PaperlessConfigValue {
  baseUrl: string;      // e.g., 'http://localhost:8000'
  apiToken: string;     // Paperless-ngx API token
}

// key: 'paperless-preferences'
// value: JSON
interface PaperlessPreferences {
  viewMode: 'grid' | 'list';
  sortBy: 'added' | 'created' | 'title' | 'correspondent';
  sortOrder: 'asc' | 'desc';
  pageSize: 20 | 50 | 100;
  showThumbnails: boolean;
}
```

### Phase 2+: 原生数据模型 (Prisma Schema)

```prisma
// prisma/schema.prisma

model Document {
  id              String   @id @default(cuid())
  title           String
  content         String?  @db.Text  // OCR 提取的文本内容
  originalFile    String   // 原始文件路径 (S3 key 或本地路径)
  archivedFile    String?  // 归档文件路径
  mimeType        String
  fileSize        Int
  checksum        String?  // SHA256 校验和，用于去重
  
  // 分类
  tags            DocumentTag[]
  documentType    DocumentType? @relation(fields: [documentTypeId], references: [id])
  documentTypeId  String?
  correspondent   Correspondent? @relation(fields: [correspondentId], references: [id])
  correspondentId String?
  
  // OCR 状态
  ocrStatus       OcrStatus @default(PENDING)
  ocrError        String?
  
  // 时间戳
  created         DateTime @default(now())  // 文档创建时间
  modified        DateTime @updatedAt       // 最后修改时间
  added           DateTime @default(now())  // 添加到系统时间
  
  // 用户关联
  accountId       Int
  account         Account  @relation(fields: [accountId], references: [id])
  
  // 全文搜索
  searchVector    Unsupported("tsvector")?
  
  @@index([title])
  @@index([accountId])
  @@index([documentTypeId])
  @@index([correspondentId])
  @@index([created])
  @@index([added])
}

enum OcrStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  SKIPPED
}

model DocumentType {
  id          String     @id @default(cuid())
  name        String
  accountId   Int
  account     Account    @relation(fields: [accountId], references: [id])
  documents   Document[]
  
  @@unique([accountId, name])
}

model Correspondent {
  id          String     @id @default(cuid())
  name        String
  accountId   Int
  account     Account    @relation(fields: [accountId], references: [id])
  documents   Document[]
  
  @@unique([accountId, name])
}

model DocumentTag {
  id          String   @id @default(cuid())
  documentId  String
  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  tagId       Int
  tag         Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)
  
  @@unique([documentId, tagId])
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do.*

### Property 1: 文档列表显示完整性

*For any* document in the list, the rendered component SHALL display the document's title, date added, correspondent (if any), and tags.

**Validates: Requirements 1.2.1.2**

### Property 2: 文件类型验证

*For any* file upload, if the file extension is in the allowed list (PDF, PNG, JPG, JPEG, TIFF, GIF, TXT, MD, DOC, DOCX, XLS, XLSX), the upload SHALL be accepted; otherwise, it SHALL be rejected with an error message.

**Validates: Requirements 1.3.1.5**

### Property 3: 过滤结果正确性

*For any* combination of tag filters, document type filters, and correspondent filters, the document list SHALL only contain documents matching all active filters.

**Validates: Requirements 1.2.3.4, 1.2.3.5, 1.2.3.6**

### Property 4: 排序正确性

*For any* document list and sort option (date added, date created, title, correspondent), the list SHALL be ordered according to the selected sort option and direction.

**Validates: Requirements 1.2.1.4**

### Property 5: 搜索结果高亮

*For any* search result, the highlighted text snippets SHALL contain the search keywords.

**Validates: Requirements 1.2.2.3**

### Property 6: 元数据编辑 Round-Trip

*For any* document metadata change (title, tags, document type, correspondent), saving and then reloading the document SHALL return the same values.

**Validates: Requirements 1.4.1.5, 1.4.1.6**

### Property 7: 标签管理 Round-Trip

*For any* tag creation with valid name and color, the tag SHALL appear in the tag list with the same name and color.

**Validates: Requirements 1.4.2.4, 1.4.2.8**

### Property 8: 配置持久化

*For any* Paperless configuration (URL, API token), saving and then reloading the settings page SHALL display the same URL (token should be masked).

**Validates: Requirements 1.5.1.8**

### Property 9: 批量操作完整性

*For any* batch operation (add tags, remove tags, change type), all selected documents SHALL be updated with the specified changes.

**Validates: Requirements 1.6.1.3, 1.6.1.4**

### Property 10: 文件下载 Round-Trip (Phase 2+)

*For any* uploaded file, downloading the file SHALL return content identical to the original upload (verified by checksum).

**Validates: Requirements 2.1.2.5**

### Property 11: 全文搜索包含性 (Phase 3+)

*For any* document with extracted text content, searching for a word that exists in the content SHALL return that document in the results.

**Validates: Requirements 3.2.1.4**

---

## Error Handling

| 错误场景 | 处理方式 | 用户提示 |
|---------|---------|---------|
| Paperless 未配置 | 显示配置引导 | "请先配置 Paperless-ngx 连接" |
| Paperless 连接失败 | 显示错误状态 | "无法连接到文件服务，请检查配置" |
| API Token 无效 | 显示认证错误 | "认证失败，请检查 API Token" |
| 文件类型不支持 | 拒绝上传 | "不支持的文件类型：{type}" |
| 文件过大 | 拒绝上传 | "文件大小超过限制 (最大 50MB)" |
| 上传失败 | 显示错误，提供重试 | "上传失败：{error}，点击重试" |
| 搜索无结果 | 显示空状态 | "未找到匹配的文档" |
| 预览不可用 | 提供下载选项 | "无法预览此文件类型，请下载查看" |
| 删除失败 | 显示错误 | "删除失败：{error}" |
| 网络错误 | 显示重试选项 | "网络错误，请检查连接后重试" |

---

## Testing Strategy

### 单元测试

- **PaperlessClient**: 测试 API 调用和响应转换
- **tRPC 路由**: 测试输入验证和错误处理
- **React Hooks**: 测试数据获取和缓存逻辑
- **React 组件**: 测试渲染和交互

### 属性测试 (fast-check)

使用 `fast-check` 进行属性测试，每个属性至少 100 次迭代。

```typescript
// Property 2: 文件类型验证
import fc from 'fast-check';

const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'gif', 'txt', 'md', 'doc', 'docx', 'xls', 'xlsx'];

test('Property 2: File Type Validation', () => {
  fc.assert(
    fc.property(fc.string(), (filename) => {
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      const isAllowed = allowedExtensions.includes(ext);
      const result = validateFileType(filename);
      
      return result.valid === isAllowed;
    }),
    { numRuns: 100 }
  );
});

// **Validates: Requirements 1.3.1.5**

// Property 3: 过滤结果正确性
test('Property 3: Filter Results Correctness', () => {
  fc.assert(
    fc.property(
      fc.array(documentArbitrary),
      fc.array(fc.nat()),
      fc.option(fc.nat()),
      fc.option(fc.nat()),
      (documents, tagIds, documentTypeId, correspondentId) => {
        const filtered = filterDocuments(documents, { tagIds, documentTypeId, correspondentId });
        
        return filtered.every(doc => {
          const matchesTags = tagIds.length === 0 || tagIds.some(id => doc.tags.includes(id));
          const matchesType = !documentTypeId || doc.document_type === documentTypeId;
          const matchesCorr = !correspondentId || doc.correspondent === correspondentId;
          return matchesTags && matchesType && matchesCorr;
        });
      }
    ),
    { numRuns: 100 }
  );
});

// **Validates: Requirements 1.2.3.4, 1.2.3.5, 1.2.3.6**

// Property 4: 排序正确性
test('Property 4: Sort Correctness', () => {
  fc.assert(
    fc.property(
      fc.array(documentArbitrary, { minLength: 2 }),
      fc.constantFrom('added', 'created', 'title', 'correspondent'),
      fc.constantFrom('asc', 'desc'),
      (documents, sortBy, sortOrder) => {
        const sorted = sortDocuments(documents, sortBy, sortOrder);
        
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1][sortBy];
          const curr = sorted[i][sortBy];
          if (sortOrder === 'asc') {
            if (prev > curr) return false;
          } else {
            if (prev < curr) return false;
          }
        }
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

// **Validates: Requirements 1.2.1.4**
```

### 集成测试

- Docker Compose 启动 Paperless-ngx 测试环境
- 完整上传 → OCR → 搜索流程
- 配置保存和加载
- 批量操作

### E2E 测试

- 使用 Playwright 测试完整用户流程
- 文件上传和预览
- 搜索和过滤
- 元数据编辑
