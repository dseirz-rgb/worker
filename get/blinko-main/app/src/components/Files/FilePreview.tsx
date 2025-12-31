/**
 * 文件预览组件
 * 支持 PDF、图片、文本预览
 */

import { memo, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Iconify/icons';
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody,
  Button,
  Chip,
  Tabs,
  Tab,
  Input,
  Skeleton,
  Tooltip,
} from '@heroui/react';
import { motion } from 'framer-motion';
import { api } from '@/lib/trpc';
import dayjs from 'dayjs';

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

interface FilePreviewProps {
  document: PaperlessDocument | null;
  isOpen: boolean;
  onClose: () => void;
  tags: PaperlessTag[];
  documentTypes: PaperlessDocumentType[];
  onRefresh: () => void;
}

export const FilePreview = memo(({
  document: doc,
  isOpen,
  onClose,
  tags,
  documentTypes,
  onRefresh,
}: FilePreviewProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('preview');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editTagIds, setEditTagIds] = useState<number[]>([]);
  const [editDocumentTypeId, setEditDocumentTypeId] = useState<number | undefined>();
  
  // 预览数据状态
  const [previewData, setPreviewData] = useState<{ data: string; contentType: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // 加载预览
  useEffect(() => {
    if (!isOpen || !doc?.id) return;
    
    let isMounted = true;
    const loadPreview = async () => {
      setIsLoadingPreview(true);
      try {
        const result = await api.paperless.getPreview.query({ id: doc.id });
        if (isMounted && result) {
          setPreviewData(result);
        }
      } catch (error) {
        console.warn('预览加载失败:', error);
      } finally {
        if (isMounted) {
          setIsLoadingPreview(false);
        }
      }
    };
    loadPreview();
    return () => { isMounted = false; };
  }, [isOpen, doc?.id]);

  // 初始化编辑状态
  useEffect(() => {
    if (doc) {
      setEditTitle(doc.title);
      setEditTagIds(doc.tags);
      setEditDocumentTypeId(doc.document_type || undefined);
    }
  }, [doc]);

  // 下载处理
  const handleDownload = useCallback(async () => {
    if (!doc) return;
    
    setIsDownloading(true);
    try {
      const result = await api.paperless.downloadDocument.query({ id: doc.id });
      if (result) {
        // 创建下载链接
        const blob = base64ToBlob(result.data, getMimeType(doc.original_file_name));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('下载失败:', error);
    } finally {
      setIsDownloading(false);
    }
  }, [doc]);

  // 保存编辑
  const handleSave = useCallback(async () => {
    if (!doc) return;
    
    setIsUpdating(true);
    try {
      await api.paperless.updateDocument.mutate({
        id: doc.id,
        title: editTitle,
        tagIds: editTagIds,
        documentTypeId: editDocumentTypeId || null,
      });
      setIsEditing(false);
      onRefresh();
    } catch (error) {
      console.error('更新失败:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [doc, editTitle, editTagIds, editDocumentTypeId, onRefresh]);

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    if (doc) {
      setEditTitle(doc.title);
      setEditTagIds(doc.tags);
      setEditDocumentTypeId(doc.document_type || undefined);
    }
    setIsEditing(false);
  }, [doc]);

  if (!doc) return null;

  const docTags = tags.filter(tag => doc.tags.includes(tag.id));
  const docType = documentTypes.find(type => type.id === doc.document_type);
  const fileExtension = doc.original_file_name.split('.').pop()?.toLowerCase() || '';

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="5xl"
      scrollBehavior="inside"
      classNames={{
        base: 'max-h-[90vh]',
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center justify-between gap-4 border-b border-divider pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon icon={getFileIcon(fileExtension)} className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              {isEditing ? (
                <Input
                  size="sm"
                  value={editTitle}
                  onValueChange={setEditTitle}
                  classNames={{
                    inputWrapper: 'bg-default-100',
                  }}
                />
              ) : (
                <h3 className="font-semibold truncate">{doc.title || doc.original_file_name}</h3>
              )}
              <p className="text-xs text-foreground/50">{doc.original_file_name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {isEditing ? (
              <>
                <Button size="sm" variant="light" onPress={handleCancelEdit}>
                  {t('cancel') || '取消'}
                </Button>
                <Button 
                  size="sm" 
                  color="primary" 
                  onPress={handleSave}
                  isLoading={isUpdating}
                >
                  {t('save') || '保存'}
                </Button>
              </>
            ) : (
              <>
                <Tooltip content={t('edit') || '编辑'}>
                  <Button isIconOnly size="sm" variant="light" onPress={() => setIsEditing(true)}>
                    <Icon icon="solar:pen-linear" className="w-4 h-4" />
                  </Button>
                </Tooltip>
                <Tooltip content={t('download') || '下载'}>
                  <Button 
                    isIconOnly 
                    size="sm" 
                    variant="light" 
                    onPress={handleDownload}
                    isLoading={isDownloading}
                  >
                    <Icon icon="solar:download-linear" className="w-4 h-4" />
                  </Button>
                </Tooltip>
              </>
            )}
          </div>
        </ModalHeader>
        
        <ModalBody className="p-0">
          <div className="flex h-[70vh]">
            {/* 预览区域 */}
            <div className="flex-1 bg-default-50 overflow-auto">
              <Tabs 
                selectedKey={activeTab} 
                onSelectionChange={(key) => setActiveTab(key as string)}
                classNames={{
                  tabList: 'bg-background border-b border-divider',
                  cursor: 'bg-primary',
                }}
              >
                <Tab key="preview" title={
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:eye-linear" className="w-4 h-4" />
                    {t('preview') || '预览'}
                  </div>
                }>
                  <div className="p-4 h-full">
                    {isLoadingPreview ? (
                      <div className="flex items-center justify-center h-full">
                        <Icon icon="solar:refresh-linear" className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    ) : previewData ? (
                      <PreviewContent
                        data={previewData.data}
                        contentType={previewData.contentType}
                        filename={doc.original_file_name}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-foreground/50">
                        <Icon icon="solar:eye-closed-linear" className="w-16 h-16 mb-4" />
                        <p>{t('preview-not-available') || '预览不可用'}</p>
                        <Button 
                          className="mt-4" 
                          color="primary" 
                          variant="flat"
                          onPress={handleDownload}
                        >
                          {t('download-original') || '下载原文件'}
                        </Button>
                      </div>
                    )}
                  </div>
                </Tab>
                
                <Tab key="ocr" title={
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:text-linear" className="w-4 h-4" />
                    {t('ocr-text') || 'OCR 文本'}
                  </div>
                }>
                  <div className="p-4 h-full overflow-auto">
                    {doc.content ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                          {doc.content}
                        </pre>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-foreground/50">
                        <Icon icon="solar:text-linear" className="w-16 h-16 mb-4" />
                        <p>{t('no-ocr-content') || '暂无 OCR 内容'}</p>
                      </div>
                    )}
                  </div>
                </Tab>
              </Tabs>
            </div>

            {/* 信息侧边栏 */}
            <div className="w-72 border-l border-divider p-4 space-y-6 overflow-auto">
              {/* 文档信息 */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Icon icon="solar:info-circle-linear" className="w-4 h-4" />
                  {t('document-info') || '文档信息'}
                </h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-foreground/50">{t('added') || '添加时间'}</span>
                    <p>{dayjs(doc.added).format('YYYY-MM-DD HH:mm')}</p>
                  </div>
                  <div>
                    <span className="text-foreground/50">{t('created') || '创建时间'}</span>
                    <p>{dayjs(doc.created).format('YYYY-MM-DD HH:mm')}</p>
                  </div>
                  <div>
                    <span className="text-foreground/50">{t('modified') || '修改时间'}</span>
                    <p>{dayjs(doc.modified).format('YYYY-MM-DD HH:mm')}</p>
                  </div>
                </div>
              </div>

              {/* 文档类型 */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Icon icon="solar:document-linear" className="w-4 h-4" />
                  {t('document-type') || '文档类型'}
                </h4>
                {isEditing ? (
                  <div className="flex flex-wrap gap-1">
                    {documentTypes.map(type => {
                      const isSelected = editDocumentTypeId === type.id;
                      return (
                        <Chip
                          key={type.id}
                          size="sm"
                          variant={isSelected ? 'solid' : 'flat'}
                          color={isSelected ? 'secondary' : 'default'}
                          className="cursor-pointer"
                          onClick={() => setEditDocumentTypeId(isSelected ? undefined : type.id)}
                        >
                          {type.name}
                        </Chip>
                      );
                    })}
                  </div>
                ) : docType ? (
                  <Chip size="sm" variant="flat" color="secondary">
                    {docType.name}
                  </Chip>
                ) : (
                  <p className="text-sm text-foreground/50">{t('not-set') || '未设置'}</p>
                )}
              </div>

              {/* 标签 */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Icon icon="solar:tag-linear" className="w-4 h-4" />
                  {t('tags') || '标签'}
                </h4>
                {isEditing ? (
                  <div className="flex flex-wrap gap-1">
                    {tags.map(tag => {
                      const isSelected = editTagIds.includes(tag.id);
                      return (
                        <Chip
                          key={tag.id}
                          size="sm"
                          variant={isSelected ? 'solid' : 'flat'}
                          className="cursor-pointer"
                          style={isSelected ? { 
                            backgroundColor: tag.color, 
                            color: '#fff' 
                          } : {
                            backgroundColor: tag.color + '20',
                            color: tag.color,
                          }}
                          onClick={() => {
                            if (isSelected) {
                              setEditTagIds(prev => prev.filter(id => id !== tag.id));
                            } else {
                              setEditTagIds(prev => [...prev, tag.id]);
                            }
                          }}
                        >
                          {tag.name}
                        </Chip>
                      );
                    })}
                  </div>
                ) : docTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {docTags.map(tag => (
                      <Chip
                        key={tag.id}
                        size="sm"
                        variant="flat"
                        style={{ 
                          backgroundColor: tag.color + '20', 
                          color: tag.color 
                        }}
                      >
                        {tag.name}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-foreground/50">{t('no-tags') || '暂无标签'}</p>
                )}
              </div>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
});

FilePreview.displayName = 'FilePreview';

// 预览内容组件
interface PreviewContentProps {
  data: string;
  contentType: string;
  filename: string;
}

const PreviewContent = memo(({ data, contentType, filename }: PreviewContentProps) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  // PDF 预览
  if (contentType === 'application/pdf' || ext === 'pdf') {
    return (
      <iframe
        src={`data:application/pdf;base64,${data}`}
        className="w-full h-full rounded-lg"
        title="PDF Preview"
      />
    );
  }
  
  // 图片预览
  if (contentType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'tiff'].includes(ext)) {
    return (
      <div className="flex items-center justify-center h-full">
        <img
          src={`data:${contentType};base64,${data}`}
          alt={filename}
          className="max-w-full max-h-full object-contain rounded-lg"
        />
      </div>
    );
  }
  
  // 文本预览
  if (['txt', 'md'].includes(ext)) {
    const text = atob(data);
    return (
      <pre className="whitespace-pre-wrap font-mono text-sm p-4 bg-background rounded-lg">
        {text}
      </pre>
    );
  }
  
  // 默认：显示不支持预览
  return (
    <div className="flex flex-col items-center justify-center h-full text-foreground/50">
      <Icon icon="solar:file-bold" className="w-16 h-16 mb-4" />
      <p>此文件类型不支持预览</p>
    </div>
  );
});

PreviewContent.displayName = 'PreviewContent';

// 辅助函数
function getFileIcon(ext: string): string {
  const iconMap: Record<string, string> = {
    pdf: 'solar:document-text-bold',
    doc: 'solar:document-bold',
    docx: 'solar:document-bold',
    txt: 'solar:text-bold',
    md: 'solar:text-bold',
    png: 'solar:gallery-bold',
    jpg: 'solar:gallery-bold',
    jpeg: 'solar:gallery-bold',
    gif: 'solar:gallery-bold',
    tiff: 'solar:gallery-bold',
  };
  return iconMap[ext] || 'solar:file-bold';
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    tiff: 'image/tiff',
    txt: 'text/plain',
    md: 'text/markdown',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
