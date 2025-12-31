/**
 * PPTPreview 组件
 * PPT 幻灯片预览，显示指定页面的缩略图和内容
 */

import { useState } from 'react';
import { Card, CardBody, Button, Chip, Pagination } from '@heroui/react';
import { Icon } from '@iconify/react';

interface SlideInfo {
  pageNumber: number;
  title?: string;
  content: string;
  thumbnailUrl?: string;
}

interface PPTPreviewProps {
  /** PPT 文件路径 */
  filePath: string;
  /** 当前页码 */
  currentPage?: number;
  /** 总页数 */
  totalPages?: number;
  /** 幻灯片信息列表 */
  slides?: SlideInfo[];
  /** 标题 */
  title?: string;
  /** 高亮的文本内容 */
  highlightText?: string;
  /** 关闭回调 */
  onClose?: () => void;
  /** 页码变化回调 */
  onPageChange?: (page: number) => void;
}

/**
 * 高亮文本中的匹配部分
 */
function highlightContent(content: string, highlight?: string): React.ReactNode {
  if (!highlight || !content) return content;
  
  const parts = content.split(new RegExp(`(${highlight})`, 'gi'));
  return parts.map((part, i) => 
    part.toLowerCase() === highlight.toLowerCase() ? (
      <mark key={i} className="bg-warning-200 px-0.5 rounded">{part}</mark>
    ) : (
      part
    )
  );
}

export const PPTPreview = ({
  filePath,
  currentPage = 1,
  totalPages = 1,
  slides = [],
  title,
  highlightText,
  onClose,
  onPageChange,
}: PPTPreviewProps) => {
  const [page, setPage] = useState(currentPage);
  
  // 获取当前页的幻灯片信息
  const currentSlide = slides.find(s => s.pageNumber === page) || {
    pageNumber: page,
    content: '',
  };
  
  // 文件名
  const fileName = title || filePath.split('/').pop() || 'PPT 预览';
  
  // 页码变化处理
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    onPageChange?.(newPage);
  };

  return (
    <Card className="w-full">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-default-100">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:file-powerpoint" className="text-orange-500" />
          <span className="font-medium text-sm truncate">{fileName}</span>
          <Chip size="sm" variant="flat">
            第 {page} / {totalPages} 页
          </Chip>
        </div>
        {onClose && (
          <Button size="sm" variant="light" isIconOnly onPress={onClose}>
            <Icon icon="mdi:close" />
          </Button>
        )}
      </div>

      <CardBody className="p-4">
        {/* 缩略图区域 */}
        <div className="mb-4">
          {currentSlide.thumbnailUrl ? (
            <div className="relative aspect-video bg-default-100 rounded-lg overflow-hidden">
              <img
                src={currentSlide.thumbnailUrl}
                alt={`第 ${page} 页`}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="aspect-video bg-default-100 rounded-lg flex items-center justify-center">
              <div className="text-center text-default-400">
                <Icon icon="mdi:file-powerpoint-outline" className="text-6xl mb-2" />
                <p>第 {page} 页</p>
              </div>
            </div>
          )}
        </div>

        {/* 幻灯片标题 */}
        {currentSlide.title && (
          <h3 className="text-lg font-semibold mb-2">
            {highlightContent(currentSlide.title, highlightText)}
          </h3>
        )}

        {/* 幻灯片内容 */}
        {currentSlide.content && (
          <div className="p-3 bg-default-50 rounded-lg text-sm max-h-40 overflow-y-auto">
            <p className="whitespace-pre-wrap">
              {highlightContent(currentSlide.content, highlightText)}
            </p>
          </div>
        )}

        {/* 分页控制 */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-4">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="flat"
                isIconOnly
                isDisabled={page <= 1}
                onPress={() => handlePageChange(page - 1)}
              >
                <Icon icon="mdi:chevron-left" />
              </Button>
              
              <Pagination
                total={totalPages}
                page={page}
                onChange={handlePageChange}
                size="sm"
                showControls={false}
                siblings={1}
                boundaries={1}
              />
              
              <Button
                size="sm"
                variant="flat"
                isIconOnly
                isDisabled={page >= totalPages}
                onPress={() => handlePageChange(page + 1)}
              >
                <Icon icon="mdi:chevron-right" />
              </Button>
            </div>
          </div>
        )}

        {/* 快速跳转到匹配页 */}
        {currentPage !== page && (
          <div className="flex justify-center mt-2">
            <Button
              size="sm"
              variant="flat"
              color="primary"
              onPress={() => handlePageChange(currentPage)}
              startContent={<Icon icon="mdi:target" />}
            >
              跳转到匹配页 (第 {currentPage} 页)
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default PPTPreview;
