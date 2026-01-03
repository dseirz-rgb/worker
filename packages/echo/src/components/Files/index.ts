/**
 * 文件管理组件导出
 */

// 核心页面组件
export { FileSidebar } from './FileSidebar';
export { FileList } from './FileList';
export { FileUpload } from './FileUpload';
export { FilePreview } from './FilePreview';
export { FileToolbar, type FileToolbarProps } from './FileToolbar';
export { SearchModeSelector, useSearchMode, getAutoAlpha, type SearchMode } from './SearchModeSelector';
export { DocumentCard, type DocumentCardProps, type PaperlessDocument, type PaperlessTag, type Correspondent } from './DocumentCard';

// 上传组件
export { UploadFileItem, type UploadFile, type UploadStatus } from './UploadFileItem';

// 选择器组件
export { TagSelector } from './TagSelector';
export { DocumentTypeSelector } from './DocumentTypeSelector';
export { CorrespondentSelector } from './CorrespondentSelector';

// 元数据管理组件
export { TagManager } from './TagManager';
export { DocumentTypeManager } from './DocumentTypeManager';
export { CorrespondentManager } from './CorrespondentManager';

// 文档预览组件
export { PdfViewer, type PdfViewerProps } from './PdfViewer';
export { ImageViewer, type ImageViewerProps } from './ImageViewer';
export { TextViewer, type TextViewerProps } from './TextViewer';
export { DocumentMetadata, type DocumentMetadataProps, type DocumentMetadataDocument } from './DocumentMetadata';

// 过滤组件
export { FilterSection } from './FilterSection';
export { FilterItem } from './FilterItem';
export { ActiveFilters, type FilterType, type FilterItem as ActiveFilterItem, type ActiveFiltersProps } from './ActiveFilters';

// 批量操作组件
export { BatchActionBar } from './BatchActionBar';

// 快捷键帮助
export { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
