/**
 * 文件上传组件
 * 支持拖拽上传和文件类型验证
 */

import { memo, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Iconify/icons';
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Chip,
  Progress,
} from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/trpc';

// 支持的文件类型
const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'gif', 'txt', 'md', 'doc', 'docx'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface PaperlessTag {
  id: number;
  name: string;
  color: string;
}

interface PaperlessDocumentType {
  id: number;
  name: string;
}

interface FileUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  tags: PaperlessTag[];
  documentTypes: PaperlessDocumentType[];
}

interface UploadFile {
  file: File;
  title: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export const FileUpload = memo(({
  isOpen,
  onClose,
  onUploadComplete,
  tags,
  documentTypes,
}: FileUploadProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState<number | undefined>();
  const [isDragging, setIsDragging] = useState(false);

  // 验证文件
  const validateFile = useCallback((file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return t('unsupported-file-type') || `不支持的文件类型: ${ext}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return t('file-too-large') || '文件大小超过 50MB 限制';
    }
    return null;
  }, [t]);

  // 添加文件
  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles: UploadFile[] = [];
    
    fileArray.forEach(file => {
      const error = validateFile(file);
      validFiles.push({
        file,
        title: file.name.replace(/\.[^/.]+$/, ''), // 去掉扩展名作为默认标题
        progress: 0,
        status: error ? 'error' : 'pending',
        error: error || undefined,
      });
    });
    
    setFiles(prev => [...prev, ...validFiles]);
  }, [validateFile]);

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  // 文件选择
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  }, [addFiles]);

  // 移除文件
  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 更新文件标题
  const updateFileTitle = useCallback((index: number, title: string) => {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, title } : f));
  }, []);

  // 上传文件
  const uploadFiles = useCallback(async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    for (let i = 0; i < pendingFiles.length; i++) {
      const uploadFile = pendingFiles[i];
      const fileIndex = files.findIndex(f => f === uploadFile);
      
      // 更新状态为上传中
      setFiles(prev => prev.map((f, idx) => 
        idx === fileIndex ? { ...f, status: 'uploading', progress: 0 } : f
      ));

      try {
        // 读取文件为 base64
        const base64 = await fileToBase64(uploadFile.file);
        
        // 模拟进度
        setFiles(prev => prev.map((f, idx) => 
          idx === fileIndex ? { ...f, progress: 50 } : f
        ));

        // 上传 - 使用 vanilla tRPC client
        await api.paperless.uploadDocument.mutate({
          fileBase64: base64,
          filename: uploadFile.file.name,
          title: uploadFile.title,
          documentTypeId: selectedDocumentTypeId,
          tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        });

        // 更新状态为成功
        setFiles(prev => prev.map((f, idx) => 
          idx === fileIndex ? { ...f, status: 'success', progress: 100 } : f
        ));
      } catch (error) {
        // 更新状态为失败
        setFiles(prev => prev.map((f, idx) => 
          idx === fileIndex ? { 
            ...f, 
            status: 'error', 
            error: error instanceof Error ? error.message : '上传失败' 
          } : f
        ));
      }
    }

    // 如果所有文件都上传成功，关闭弹窗
    const allSuccess = files.every(f => f.status === 'success' || f.status === 'error');
    if (allSuccess) {
      setTimeout(() => {
        onUploadComplete();
        resetState();
      }, 1000);
    }
  }, [files, selectedTagIds, selectedDocumentTypeId, onUploadComplete]);

  // 重置状态
  const resetState = useCallback(() => {
    setFiles([]);
    setSelectedTagIds([]);
    setSelectedDocumentTypeId(undefined);
  }, []);

  // 关闭处理
  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const isUploading = files.some(f => f.status === 'uploading');

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose}
      size="2xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon icon="solar:upload-bold" className="w-5 h-5 text-primary" />
          {t('upload-files') || '上传文件'}
        </ModalHeader>
        
        <ModalBody className="space-y-4">
          {/* 拖拽上传区域 */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
              transition-all ${isDragging 
                ? 'border-primary bg-primary/10' 
                : 'border-divider hover:border-primary/50 hover:bg-default-50'
              }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_EXTENSIONS.map(ext => `.${ext}`).join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <motion.div
              animate={{ scale: isDragging ? 1.1 : 1 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon icon="solar:cloud-upload-bold-duotone" className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="font-medium">{t('drag-files-here') || '拖拽文件到这里'}</p>
                <p className="text-sm text-foreground/60">
                  {t('or-click-to-select') || '或点击选择文件'}
                </p>
              </div>
              <p className="text-xs text-foreground/50">
                {t('supported-formats') || '支持格式'}: {ALLOWED_EXTENSIONS.join(', ').toUpperCase()}
              </p>
            </motion.div>
          </div>

          {/* 文件列表 */}
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {t('selected-files') || '已选文件'} ({files.length})
                  </span>
                  <Button
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() => setFiles([])}
                  >
                    {t('clear-all') || '清除全部'}
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {files.map((uploadFile, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center gap-3 p-3 bg-default-50 rounded-lg"
                    >
                      <Icon 
                        icon={getFileIcon(uploadFile.file.name)} 
                        className="w-8 h-8 text-foreground/50 shrink-0" 
                      />
                      
                      <div className="flex-1 min-w-0">
                        <Input
                          size="sm"
                          value={uploadFile.title}
                          onValueChange={(value) => updateFileTitle(index, value)}
                          placeholder={t('file-title') || '文件标题'}
                          isDisabled={uploadFile.status !== 'pending'}
                          classNames={{
                            inputWrapper: 'bg-background',
                          }}
                        />
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-foreground/50">
                            {uploadFile.file.name}
                          </span>
                          <span className="text-xs text-foreground/40">
                            ({formatFileSize(uploadFile.file.size)})
                          </span>
                        </div>
                        
                        {uploadFile.status === 'uploading' && (
                          <Progress 
                            size="sm" 
                            value={uploadFile.progress} 
                            className="mt-2"
                          />
                        )}
                        
                        {uploadFile.error && (
                          <p className="text-xs text-danger mt-1">{uploadFile.error}</p>
                        )}
                      </div>
                      
                      <div className="shrink-0">
                        {uploadFile.status === 'pending' && (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onPress={() => removeFile(index)}
                          >
                            <Icon icon="solar:close-circle-linear" className="w-5 h-5" />
                          </Button>
                        )}
                        {uploadFile.status === 'uploading' && (
                          <Icon icon="solar:refresh-linear" className="w-5 h-5 animate-spin text-primary" />
                        )}
                        {uploadFile.status === 'success' && (
                          <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-success" />
                        )}
                        {uploadFile.status === 'error' && (
                          <Icon icon="solar:close-circle-bold" className="w-5 h-5 text-danger" />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 元数据选择 */}
          {files.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 文档类型 */}
              <Select
                label={t('document-type') || '文档类型'}
                placeholder={t('select-document-type') || '选择文档类型'}
                selectedKeys={selectedDocumentTypeId ? [String(selectedDocumentTypeId)] : []}
                onSelectionChange={(keys) => {
                  const key = Array.from(keys)[0];
                  setSelectedDocumentTypeId(key ? Number(key) : undefined);
                }}
              >
                {documentTypes.map(type => (
                  <SelectItem key={String(type.id)}>
                    {type.name}
                  </SelectItem>
                ))}
              </Select>

              {/* 标签 */}
              <div>
                <label className="text-sm text-foreground/70 mb-2 block">
                  {t('tags') || '标签'}
                </label>
                <div className="flex flex-wrap gap-1">
                  {tags.map(tag => {
                    const isSelected = selectedTagIds.includes(tag.id);
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
                            setSelectedTagIds(prev => prev.filter(id => id !== tag.id));
                          } else {
                            setSelectedTagIds(prev => [...prev, tag.id]);
                          }
                        }}
                      >
                        {tag.name}
                      </Chip>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={handleClose}>
            {t('cancel') || '取消'}
          </Button>
          <Button
            color="primary"
            onPress={uploadFiles}
            isDisabled={pendingCount === 0}
            isLoading={isUploading}
            startContent={!isUploading && <Icon icon="solar:upload-linear" />}
          >
            {isUploading 
              ? t('uploading') || '上传中...'
              : `${t('upload') || '上传'} (${pendingCount})`
            }
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
});

FileUpload.displayName = 'FileUpload';

// 辅助函数
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 移除 data:xxx;base64, 前缀
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
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
