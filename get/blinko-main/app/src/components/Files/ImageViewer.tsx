/**
 * 图片预览组件
 * 支持缩放控制（滚轮缩放）、平移拖动、重置
 */

import { memo, useState, useCallback, useRef } from 'react';
import { Button, Tooltip, Spinner } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { cn } from '@heroui/react';
import { motion } from 'framer-motion';

// ========== 类型定义 ==========

export interface ImageViewerProps {
  /** 图片 URL（base64 data URI 或 URL） */
  url: string;
  /** 图片描述 */
  alt?: string;
  /** 自定义样式类名 */
  className?: string;
}

// ========== 常量 ==========

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;
const WHEEL_ZOOM_FACTOR = 0.001;

// ========== 主组件 ==========

export const ImageViewer = memo(({ url, alt = '图片预览', className }: ImageViewerProps) => {
  // 状态
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // 处理图片加载完成
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  // 处理图片加载错误
  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // 放大
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + ZOOM_STEP * 2, MAX_ZOOM));
  }, []);

  // 缩小
  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - ZOOM_STEP * 2, MIN_ZOOM));
  }, []);

  // 重置
  const handleReset = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // 适应窗口
  const handleFitToWindow = useCallback(() => {
    if (!containerRef.current || !imageRef.current) return;
    
    const container = containerRef.current.getBoundingClientRect();
    const image = imageRef.current;
    
    const scaleX = (container.width - 40) / image.naturalWidth;
    const scaleY = (container.height - 40) / image.naturalHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    
    setZoom(scale);
    setPosition({ x: 0, y: 0 });
  }, []);

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const delta = -e.deltaY * WHEEL_ZOOM_FACTOR;
    setZoom(prev => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta * prev));
      return newZoom;
    });
  }, []);

  // 开始拖动
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // 只响应左键
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  }, [position]);

  // 拖动中
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  // 结束拖动
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 鼠标离开时结束拖动
  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 双击重置
  const handleDoubleClick = useCallback(() => {
    handleReset();
  }, [handleReset]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 bg-default-100 border-b border-divider shrink-0">
        {/* 缩放信息 */}
        <div className="flex items-center gap-2 text-sm text-foreground/70">
          <Icon icon="solar:gallery-linear" className="w-4 h-4" />
          <span>{Math.round(zoom * 100)}%</span>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center gap-1">
          <Tooltip content="缩小">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleZoomOut}
              isDisabled={zoom <= MIN_ZOOM}
            >
              <Icon icon="solar:minus-circle-linear" className="w-4 h-4" />
            </Button>
          </Tooltip>
          
          <Tooltip content="放大">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleZoomIn}
              isDisabled={zoom >= MAX_ZOOM}
            >
              <Icon icon="solar:add-circle-linear" className="w-4 h-4" />
            </Button>
          </Tooltip>
          
          <div className="w-px h-4 bg-divider mx-1" />
          
          <Tooltip content="适应窗口">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleFitToWindow}
            >
              <Icon icon="solar:maximize-linear" className="w-4 h-4" />
            </Button>
          </Tooltip>
          
          <Tooltip content="重置 (双击图片)">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleReset}
            >
              <Icon icon="solar:restart-linear" className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* 图片显示区域 */}
      <div 
        ref={containerRef}
        className={cn(
          'flex-1 overflow-hidden bg-default-50 relative',
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
      >
        {/* 加载状态 */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <Spinner size="lg" color="primary" />
              <span className="text-sm text-foreground/60">正在加载图片...</span>
            </div>
          </div>
        )}

        {/* 错误状态 */}
        {hasError && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-foreground/50">
            <Icon icon="solar:gallery-remove-linear" className="w-16 h-16 mb-4" />
            <p className="text-lg font-medium mb-2">图片加载失败</p>
            <p className="text-sm">请检查图片是否有效</p>
          </div>
        )}

        {/* 图片 */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
          }}
        >
          <motion.img
            ref={imageRef}
            src={url}
            alt={alt}
            className={cn(
              'max-w-none select-none transition-opacity',
              isLoading ? 'opacity-0' : 'opacity-100'
            )}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
            }}
            onLoad={handleLoad}
            onError={handleError}
            draggable={false}
          />
        </div>

        {/* 操作提示 */}
        {!isLoading && !hasError && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-background/80 backdrop-blur-sm rounded-full text-xs text-foreground/60">
            滚轮缩放 · 拖动平移 · 双击重置
          </div>
        )}
      </div>
    </div>
  );
});

ImageViewer.displayName = 'ImageViewer';

export default ImageViewer;
