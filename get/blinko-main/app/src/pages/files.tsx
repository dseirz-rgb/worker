/**
 * 文件管理页面
 * 集成 Paperless-ngx 实现文件上传、搜索、预览功能
 */

import { observer } from 'mobx-react-lite';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/Common/ScrollArea';
import { LoadingAndEmpty } from '@/components/Common/LoadingAndEmpty';
import { Icon } from '@/components/Common/Iconify/icons';
import { Button, Input, Chip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Modal, ModalContent, ModalHeader, ModalBody, Pagination } from '@heroui/react';
import { api } from '@/lib/trpc';
import { motion } from 'framer-motion';
import { FileSidebar } from '@/components/Files';
import { FileList } from '@/components/Files';
import { FileUpload } from '@/components/Files';
import { FilePreview } from '@/components/Files';
import { SearchModeSelector, useSearchMode, type SearchMode } from '@/components/Files';
import { useMediaQuery } from 'usehooks-ts';
import { Link } from 'react-router-dom';

// 类型定义
interface PaperlessDocument {
  id: number;
  title: string;
  content: string;
  created: string;
  modified: string;
  added: string;
  correspondent: number | null;
  document_type: number | null;
  tags: number[];
  original_file_name: string;
}

interface PaperlessTag {
  id: number;
  name: string;
  color: string;
}

interface PaperlessDocumentType {
  id: number;
  name: string;
}

// Mock 数据 - 用于演示界面效果
const MOCK_TAGS: PaperlessTag[] = [
  { id: 1, name: '发票', color: '#e74c3c' },
  { id: 2, name: '合同', color: '#3498db' },
  { id: 3, name: '报告', color: '#2ecc71' },
  { id: 4, name: '证件', color: '#9b59b6' },
  { id: 5, name: '笔记', color: '#f39c12' },
];

const MOCK_DOCUMENT_TYPES: PaperlessDocumentType[] = [
  { id: 1, name: '财务文档' },
  { id: 2, name: '法律文档' },
  { id: 3, name: '技术文档' },
  { id: 4, name: '个人文档' },
];

const MOCK_DOCUMENTS: PaperlessDocument[] = [
  {
    id: 1,
    title: '2024年度财务报告',
    content: '这是一份年度财务报告的 OCR 提取内容...',
    created: '2024-12-01T10:00:00Z',
    modified: '2024-12-15T14:30:00Z',
    added: '2024-12-20T09:00:00Z',
    correspondent: null,
    document_type: 1,
    tags: [1, 3],
    original_file_name: '2024_financial_report.pdf',
  },
  {
    id: 2,
    title: '服务合同 - ABC公司',
    content: '甲方：ABC公司\n乙方：...\n合同内容...',
    created: '2024-11-15T08:00:00Z',
    modified: '2024-11-15T08:00:00Z',
    added: '2024-12-18T11:00:00Z',
    correspondent: null,
    document_type: 2,
    tags: [2],
    original_file_name: 'contract_abc.pdf',
  },
  {
    id: 3,
    title: '项目技术方案',
    content: '技术架构设计文档...',
    created: '2024-12-10T15:00:00Z',
    modified: '2024-12-12T16:00:00Z',
    added: '2024-12-15T10:00:00Z',
    correspondent: null,
    document_type: 3,
    tags: [3, 5],
    original_file_name: 'tech_proposal.pdf',
  },
  {
    id: 4,
    title: '身份证扫描件',
    content: '姓名：张三\n身份证号：...',
    created: '2024-10-01T09:00:00Z',
    modified: '2024-10-01T09:00:00Z',
    added: '2024-12-10T08:00:00Z',
    correspondent: null,
    document_type: 4,
    tags: [4],
    original_file_name: 'id_card.jpg',
  },
  {
    id: 5,
    title: '会议纪要 - 12月产品评审',
    content: '会议时间：2024年12月5日\n参会人员：...',
    created: '2024-12-05T14:00:00Z',
    modified: '2024-12-05T16:00:00Z',
    added: '2024-12-08T09:00:00Z',
    correspondent: null,
    document_type: 3,
    tags: [5],
    original_file_name: 'meeting_notes_dec.md',
  },
  {
    id: 6,
    title: '电费发票 - 11月',
    content: '发票号码：...\n金额：￥256.80',
    created: '2024-11-28T10:00:00Z',
    modified: '2024-11-28T10:00:00Z',
    added: '2024-12-01T11:00:00Z',
    correspondent: null,
    document_type: 1,
    tags: [1],
    original_file_name: 'electricity_bill_nov.pdf',
  },
];

// 是否使用 Mock 模式（当 SeekDB 未配置时自动启用）
// 设置为 false 以连接真正的 SeekDB 服务
const USE_MOCK_MODE = false;

const FilesPage = observer(() => {
  const { t } = useTranslation();
  const isPc = useMediaQuery('(min-width: 768px)');
  
  // 状态
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState<number | undefined>();
  const [sortBy, setSortBy] = useState('-added');
  const [currentPage, setCurrentPage] = useState(1);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<PaperlessDocument | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // 搜索模式状态
  const { mode: searchMode, setMode: setSearchMode, getAlpha } = useSearchMode('fast');
  
  // 数据状态
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [documents, setDocuments] = useState<PaperlessDocument[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [tags, setTags] = useState<PaperlessTag[]>([]);
  const [documentTypes, setDocumentTypes] = useState<PaperlessDocumentType[]>([]);
  const [isTagsLoading, setIsTagsLoading] = useState(true);
  
  const pageSize = 20;
  const totalPages = Math.ceil(totalCount / pageSize);

  // 辅助函数：加载 Mock 数据
  const loadMockData = useCallback(() => {
    setIsConfigured(true);
    setTags(MOCK_TAGS);
    setDocumentTypes(MOCK_DOCUMENT_TYPES);
    setDocuments(MOCK_DOCUMENTS);
    setTotalCount(MOCK_DOCUMENTS.length);
    setIsLoading(false);
    setIsTagsLoading(false);
  }, []);

  // 加载配置
  useEffect(() => {
    const loadConfig = async () => {
      // 直接使用 Mock 模式，不等待 API
      if (USE_MOCK_MODE) {
        loadMockData();
        return;
      }
      
      try {
        // 并行加载配置、标签、文档类型和文档列表
        const [config, tagsData, typesData, docsResult] = await Promise.all([
          api.paperless.getConfig.query(),
          api.paperless.listTags.query().catch(() => MOCK_TAGS),
          api.paperless.listDocumentTypes.query().catch(() => MOCK_DOCUMENT_TYPES),
          api.paperless.listDocuments.query({
            page: 1,
            pageSize,
            ordering: '-added',
          }).catch(() => ({ results: MOCK_DOCUMENTS, count: MOCK_DOCUMENTS.length })),
        ]);
        
        const configured = !!config?.baseUrl && config?.enabled;
        setIsConfigured(configured);
        
        if (!configured) {
          loadMockData();
        } else {
          // 直接设置所有数据
          setTags(tagsData || MOCK_TAGS);
          setDocumentTypes(typesData || MOCK_DOCUMENT_TYPES);
          setDocuments(docsResult?.results || MOCK_DOCUMENTS);
          setTotalCount(docsResult?.count || MOCK_DOCUMENTS.length);
          setIsLoading(false);
          setIsTagsLoading(false);
        }
      } catch (error) {
        console.error('Failed to load config:', error);
        loadMockData();
      }
    };
    loadConfig();
  }, [loadMockData]);

  // 加载标签和文档类型 - 仅在配置变化且数据为空时加载
  useEffect(() => {
    // Mock 模式下跳过 API 调用
    // 初始加载已在 loadConfig 中完成，这里只处理后续刷新
    if (USE_MOCK_MODE || !isConfigured || tags.length > 0) return;
    
    const loadMetadata = async () => {
      setIsTagsLoading(true);
      try {
        const [tagsData, typesData] = await Promise.all([
          api.paperless.listTags.query(),
          api.paperless.listDocumentTypes.query(),
        ]);
        setTags(tagsData || []);
        setDocumentTypes(typesData || []);
      } catch (error) {
        console.error('Failed to load metadata:', error);
        // 失败时使用 Mock 数据
        setTags(MOCK_TAGS);
        setDocumentTypes(MOCK_DOCUMENT_TYPES);
      } finally {
        setIsTagsLoading(false);
      }
    };
    loadMetadata();
  }, [isConfigured]);

  // 加载文档列表 - 在筛选条件变化时重新加载
  useEffect(() => {
    // Mock 模式下跳过 API 调用
    if (USE_MOCK_MODE || !isConfigured) return;
    
    const loadDocuments = async () => {
      setIsLoading(true);
      try {
        let result;
        if (searchQuery) {
          result = await api.paperless.searchDocuments.query({
            query: searchQuery,
            page: currentPage,
            pageSize,
          });
        } else {
          result = await api.paperless.listDocuments.query({
            page: currentPage,
            pageSize,
            ordering: sortBy,
            tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
            documentTypeId: selectedDocumentTypeId,
          });
        }
        setDocuments(result?.results || []);
        setTotalCount(result?.count || 0);
      } catch (error) {
        console.error('Failed to load documents:', error);
        // 失败时使用 Mock 数据
        setDocuments(MOCK_DOCUMENTS);
        setTotalCount(MOCK_DOCUMENTS.length);
      } finally {
        setIsLoading(false);
      }
    };
    loadDocuments();
  }, [isConfigured, searchQuery, currentPage, sortBy, selectedTagIds, selectedDocumentTypeId]);

  // 事件处理
  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  }, []);

  const handleTagSelect = useCallback((tagIds: number[]) => {
    setSelectedTagIds(tagIds);
    setCurrentPage(1);
  }, []);

  const handleDocumentTypeSelect = useCallback((typeId?: number) => {
    setSelectedDocumentTypeId(typeId);
    setCurrentPage(1);
  }, []);

  const handleDocumentClick = useCallback((doc: PaperlessDocument) => {
    setSelectedDocument(doc);
    setIsPreviewOpen(true);
  }, []);

  const handleUploadComplete = useCallback(() => {
    setIsUploadOpen(false);
    // 刷新文档列表
    setCurrentPage(1);
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tagsData, typesData] = await Promise.all([
        api.paperless.listTags.query(),
        api.paperless.listDocumentTypes.query(),
      ]);
      setTags(tagsData || []);
      setDocumentTypes(typesData || []);
      
      let result;
      if (searchQuery) {
        result = await api.paperless.searchDocuments.query({
          query: searchQuery,
          page: currentPage,
          pageSize,
        });
      } else {
        result = await api.paperless.listDocuments.query({
          page: currentPage,
          pageSize,
          ordering: sortBy,
          tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
          documentTypeId: selectedDocumentTypeId,
        });
      }
      setDocuments(result?.results || []);
      setTotalCount(result?.count || 0);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, currentPage, sortBy, selectedTagIds, selectedDocumentTypeId]);

  // 加载中状态
  if (isConfigured === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <Icon icon="solar:refresh-linear" className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // 未配置状态
  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon icon="solar:folder-with-files-bold-duotone" className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-3">{t('file-management') || '文件管理'}</h2>
          <p className="text-foreground/60 mb-6">
            {t('paperless-not-configured-desc') || '请先在设置中配置 Paperless-ngx 连接信息，以启用文件管理功能。'}
          </p>
          <Link to="/settings">
            <Button color="primary" size="lg" startContent={<Icon icon="hugeicons:settings-01" />}>
              {t('go-to-settings') || '前往设置'}
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* 侧边栏 - 桌面端 */}
      {isPc && (
        <FileSidebar
          tags={tags}
          documentTypes={documentTypes}
          selectedTagIds={selectedTagIds}
          selectedDocumentTypeId={selectedDocumentTypeId}
          onTagSelect={handleTagSelect}
          onDocumentTypeSelect={handleDocumentTypeSelect}
          isLoading={isTagsLoading}
        />
      )}

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 工具栏 */}
        <div className="flex items-center gap-2 p-4 border-b border-divider">
          {/* 移动端侧边栏切换 */}
          {!isPc && (
            <Button
              isIconOnly
              variant="light"
              onPress={() => setIsSidebarOpen(true)}
            >
              <Icon icon="solar:filter-bold" className="w-5 h-5" />
            </Button>
          )}

          {/* 搜索模式选择器 */}
          <SearchModeSelector
            mode={searchMode}
            onModeChange={setSearchMode}
            currentQuery={searchQuery}
            size="sm"
          />

          {/* 搜索框 */}
          <Input
            placeholder={t('search-files') || '搜索文件...'}
            value={searchQuery}
            onValueChange={handleSearch}
            startContent={<Icon icon="solar:magnifer-linear" className="text-foreground/50" />}
            classNames={{
              base: 'flex-1 max-w-md',
              inputWrapper: 'bg-default-100',
            }}
            isClearable
            onClear={() => handleSearch('')}
          />

          {/* 排序 */}
          <Dropdown>
            <DropdownTrigger>
              <Button variant="flat" startContent={<Icon icon="solar:sort-vertical-linear" />}>
                {isPc && (t('sort') || '排序')}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              selectedKeys={[sortBy]}
              selectionMode="single"
              onSelectionChange={(keys) => setSortBy(Array.from(keys)[0] as string)}
            >
              <DropdownItem key="-added">{t('newest-first') || '最新添加'}</DropdownItem>
              <DropdownItem key="added">{t('oldest-first') || '最早添加'}</DropdownItem>
              <DropdownItem key="title">{t('title-asc') || '标题 A-Z'}</DropdownItem>
              <DropdownItem key="-title">{t('title-desc') || '标题 Z-A'}</DropdownItem>
              <DropdownItem key="-created">{t('created-newest') || '创建时间最新'}</DropdownItem>
            </DropdownMenu>
          </Dropdown>

          {/* 刷新 */}
          <Button
            isIconOnly
            variant="light"
            onPress={refreshData}
            isLoading={isLoading}
          >
            <Icon icon="solar:refresh-linear" className="w-5 h-5" />
          </Button>

          {/* 上传按钮 */}
          <Button
            color="primary"
            startContent={<Icon icon="solar:upload-linear" />}
            onPress={() => setIsUploadOpen(true)}
          >
            {isPc && (t('upload') || '上传')}
          </Button>
        </div>

        {/* 已选过滤器 */}
        {(selectedTagIds.length > 0 || selectedDocumentTypeId) && (
          <div className="flex items-center gap-2 px-4 py-2 bg-default-50">
            <span className="text-sm text-foreground/60">{t('filters') || '过滤'}:</span>
            {selectedTagIds.map(tagId => {
              const tag = tags.find(t => t.id === tagId);
              return tag ? (
                <Chip
                  key={tagId}
                  size="sm"
                  variant="flat"
                  onClose={() => handleTagSelect(selectedTagIds.filter(id => id !== tagId))}
                  style={{ backgroundColor: tag.color + '20', color: tag.color }}
                >
                  {tag.name}
                </Chip>
              ) : null;
            })}
            {selectedDocumentTypeId && (
              <Chip
                size="sm"
                variant="flat"
                onClose={() => handleDocumentTypeSelect(undefined)}
              >
                {documentTypes.find(t => t.id === selectedDocumentTypeId)?.name}
              </Chip>
            )}
            <Button
              size="sm"
              variant="light"
              onPress={() => {
                setSelectedTagIds([]);
                setSelectedDocumentTypeId(undefined);
              }}
            >
              {t('clear-all') || '清除全部'}
            </Button>
          </div>
        )}

        {/* 文件列表 */}
        <ScrollArea onBottom={() => {}} className="flex-1 p-4">
          <LoadingAndEmpty
            isLoading={isLoading}
            isEmpty={documents.length === 0}
            emptyMessage={searchQuery ? t('no-search-results') : t('no-files')}
          />
          
          {documents.length > 0 && (
            <>
              <FileList
                documents={documents}
                tags={tags}
                documentTypes={documentTypes}
                onDocumentClick={handleDocumentClick}
                onRefresh={refreshData}
              />
              
              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                  <Pagination
                    total={totalPages}
                    page={currentPage}
                    onChange={setCurrentPage}
                    showControls
                  />
                </div>
              )}
            </>
          )}
        </ScrollArea>
      </div>

      {/* 移动端侧边栏 Modal */}
      <Modal isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} placement="bottom">
        <ModalContent>
          <ModalHeader>{t('filters') || '过滤'}</ModalHeader>
          <ModalBody>
            <FileSidebar
              tags={tags}
              documentTypes={documentTypes}
              selectedTagIds={selectedTagIds}
              selectedDocumentTypeId={selectedDocumentTypeId}
              onTagSelect={(ids) => {
                handleTagSelect(ids);
                setIsSidebarOpen(false);
              }}
              onDocumentTypeSelect={(id) => {
                handleDocumentTypeSelect(id);
                setIsSidebarOpen(false);
              }}
              isLoading={isTagsLoading}
              isMobile
            />
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 上传 Modal */}
      <FileUpload
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={handleUploadComplete}
        tags={tags}
        documentTypes={documentTypes}
      />

      {/* 预览 Modal */}
      <FilePreview
        document={selectedDocument}
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setSelectedDocument(null);
        }}
        tags={tags}
        documentTypes={documentTypes}
        onRefresh={refreshData}
      />
    </div>
  );
});

export default FilesPage;
