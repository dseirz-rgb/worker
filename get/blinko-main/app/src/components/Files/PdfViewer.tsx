/**
 * PDF 预览组件
 * 支持页面导航、缩放控制、页码显示
 */

import { memo, useState, useCallback, useRef } from 'react';
import { Button, Tooltip, Input, Spinner } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { cn } from '@heroui/react';

// ========== 类型定义 ==========

export interface PdfViewerProps {
  /** PDF 数据 URL（base64 data URI 或 URL） */
  url: string;
  /** 自定义样式类名 */
  className?: string;
}

// ========== 缩放级别 ==========

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const DEFAULT_ZOOM_INDEX = 2; // 默认 100%

// ========== 主组件 ==========

export const PdfViewer = memo(({ url, className }: PdfViewerProps) => {
  // 状态
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 当前缩放比例
  const currentZoom = ZOOM_LEVELS[zoomIndex];

  // 处理加载完成
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  // 处理加载错误
  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // 放大
  const handleZoomIn = useCallback(() => {
    setZoomIndex(prev => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  }, []);

  // 缩小
  const handleZoomOut = useCallback(() => {
    setZoomIndex(prev => Math.max(prev - 1, 0));
  }, []);

  // 适应宽度
  const handleFitWidth = useCallback(() => {
    setZoomIndex(DEFAULT_ZOOM_INDEX);
  }, []);

  // 上一页
  const handlePrevPage = useCallback(() => {
    setCurrentPage(prev => {
      const newPage = Math.max(prev - 1, 1);
      setPageInput(String(newPage));
      return newPage;
    });
  }, []);

  // 下一页
  const handleNextPage = useCallback(() => {
    setCurrentPage(prev => {
      const newPage = Math.min(prev + 1, totalPages);
      setPageInput(String(newPage));
      return newPage;
    });
  }, [totalPages]);

  // 跳转到指定页
  const handlePageInputChange = useCallback((value: string) => {
    setPageInput(value);
  }, []);

  // 确认跳转
  const handlePageInputConfirm = useCallback(() => {
    const page = parseInt(pageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    } else {
      setPageInput(String(currentPage));
    }
  }, [pageInput, totalPages, currentPage]);

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePageInputConfirm();
    }
  }, [handlePageInputConfirm]);

  // 构建 PDF URL（添加页码参数）
  const pdfUrl = url.startsWith('data:') 
    ? url 
    : `${url}#page=${currentPage}`;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 bg-default-100 border-b border-divider shrink-0">
        {/* 页面导航 */}
        <div className="flex items-center gap-2">
          <Tooltip content="上一页">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handlePrevPage}
              isDisabled={currentPage <= 1}
            >
              <Icon icon="solar:alt-arrow-left-linear" className="w-4 h-4" />
            </Button>
          </Tooltip>
          
          <div className="flex items-center gap-1 text-sm">
            <Input
              size="sm"
              value={pageInput}
              onValueChange={handlePageInputChange}
              onBlur={handlePageInputConfirm}
              onKeyDown={handleKeyDown}
              classNames={{
                base: 'w-12',
                input: 'text-center',
                inputWrapper: 'h-7 min-h-7',
              }}
            />
            <span className="text-foreground/60">/ {totalPages}</span>
          </div>
          
          <Tooltip content="下一页">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleNextPage}
              isDisabled={currentPage >= totalPages}
            >
              <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>

        {/* 缩放控制 */}
        <div className="flex items-center gap-2">
          <Tooltip content="缩小">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleZoomOut}
              isDisabled={zoomIndex <= 0}
            >
              <Icon icon="solar:minus-circle-linear" className="w-4 h-4" />
            </Button>
          </Tooltip>
          
          <span className="text-sm text-foreground/70 min-w-[4rem] text-center">
            {Math.round(currentZoom * 100)}%
          </span>
          
          <Tooltip content="放大">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleZoomIn}
              isDisabled={zoomIndex >= ZOOM_LEVELS.length - 1}
            >
              <Icon icon="solar:add-circle-linear" className="w-4 h-4" />
            </Button>
          </Tooltip>
          
          <Tooltip content="适应宽度">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleFitWidth}
            >
              <Icon icon="solar:maximize-linear" className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* PDF 显示区域 */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-default-50"
      >
        {/* 加载状态 */}
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <Spinner size="lg" color="primary" />
              <span className="text-sm text-foreground/60">正在加载 PDF...</span>
            </div>
          </div>
        )}

        {/* 错误状态 */}
        {hasError && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-foreground/50">
            <Icon icon="solar:document-cross-linear" className="w-16 h-16 mb-4" />
            <p className="text-lg font-medium mb-2">PDF 加载失败</p>
            <p className="text-sm">请检查文件是否有效或尝试下载查看</p>
          </div>
        )}

        {/* PDF iframe */}
        <div 
          className={cn(
            'transition-transform origin-top-left',
            isLoading && 'invisible'
          )}
          style={{
            transform: `scale(${currentZoom})`,
            width: `${100 / currentZoom}%`,
            height: `${100 / currentZoom}%`,
          }}
        >
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className="w-full h-full border-0"
            title="PDF Preview"
            onLoad={handleLoad}
            onError={handleError}
          />
        </div>
      </div>
    </div>
  );
});

PdfViewer.displayName = 'PdfViewer';

export default PdfViewer;
