/**
 * SearchResultCard 组件
 * 增强的搜索结果卡片，支持视频/PPT/文档类型
 */

import { memo, useState } from 'react';
import { Card, CardBody, Chip, Button, Progress, Modal, ModalContent, ModalBody } from '@heroui/react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { VideoPreview } from '../Preview/VideoPreview';
import { PPTPreview } from '../Preview/PPTPreview';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

// 搜索结果类型
interface SearchResult {
  id: string;
  content: string;
  source_type: 'video' | 'ppt' | 'document' | 'note';
  source_path: string;
  score: number;
  text_score?: number;
  vector_score?: number;
  metadata: {
    start_time?: number;
    end_time?: number;
    page_number?: number;
    title?: string;
    total_pages?: number;
  };
  created_at?: string;
}

interface SearchResultCardProps {
  result: SearchResult;
  query: string;
  index: number;
  onClick?: () => void;
}

// 来源类型配置
const sourceTypeConfig: Record<string, { icon: string; color: string; label: string }> = {
  video: { icon: 'mdi:video', color: 'primary', label: '视频' },
  ppt: { icon: 'mdi:file-powerpoint', color: 'warning', label: 'PPT' },
  document: { icon: 'mdi:file-document', color: 'secondary', label: '文档' },
  note: { icon: 'mdi:note-text', color: 'success', label: '笔记' },
};

/**
 * 高亮搜索关键词
 */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  
  const words = query.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return text;
  
  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(pattern);
  
  return parts.map((part, i) => 
    words.some(w => part.toLowerCase() === w.toLowerCase()) ? (
      <mark key={i} className="bg-warning-200 text-warning-800 px-0.5 rounded">{part}</mark>
    ) : (
      part
    )
  );
}

/**
 * 格式化时间戳
 */
function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * 获取文件名
 */
function getFileName(path: string): string {
  return path.split('/').pop() || path;
}

export const SearchResultCard = memo(({
  result,
  query,
  index,
  onClick,
}: SearchResultCardProps) => {
  const [showPreview, setShowPreview] = useState(false);
  
  const config = sourceTypeConfig[result.source_type] || sourceTypeConfig.document;
  const fileName = getFileName(result.source_path);
  
  // 位置信息
  const positionInfo = result.source_type === 'video' && result.metadata.start_time !== undefined
    ? `${formatTimestamp(result.metadata.start_time)} - ${formatTimestamp(result.metadata.end_time || result.metadata.start_time)}`
    : result.source_type === 'ppt' && result.metadata.page_number
    ? `第 ${result.metadata.page_number} 页`
    : null;

  // 相关度百分比
  const relevancePercent = Math.round(result.score * 100);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03, duration: 0.2 }}
      >
        <Card
          isPressable
          onPress={() => onClick?.() || setShowPreview(true)}
          className="hover:shadow-md transition-shadow"
        >
          <CardBody className="p-4">
            <div className="flex gap-3">
              {/* 来源类型图标 */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-${config.color}/10 flex items-center justify-center`}>
                <Icon icon={config.icon} className={`text-xl text-${config.color}`} />
              </div>
              
              {/* 内容区域 */}
              <div className="flex-1 min-w-0">
                {/* 标题行 */}
                <div className="flex items-center gap-2 mb-1">
                  <Chip size="sm" variant="flat" color={config.color as any}>
                    {config.label}
                  </Chip>
                  {positionInfo && (
                    <Chip size="sm" variant="flat" color="default">
                      <Icon icon="mdi:map-marker" className="mr-1" />
                      {positionInfo}
                    </Chip>
                  )}
                </div>
                
                {/* 文件名/标题 */}
                <h4 className="font-medium text-sm mb-1 truncate" title={fileName}>
                  {result.metadata.title || fileName}
                </h4>
                
                {/* 内容摘要 */}
                <p className="text-sm text-default-500 line-clamp-2 mb-2">
                  {highlightText(result.content, query)}
                </p>
                
                {/* 底部信息 */}
                <div className="flex items-center justify-between">
                  {/* 相关度 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-default-400">相关度</span>
                    <Progress
                      size="sm"
                      value={relevancePercent}
                      color={relevancePercent > 70 ? 'success' : relevancePercent > 40 ? 'warning' : 'default'}
                      className="w-20"
                    />
                    <span className="text-xs font-medium">{relevancePercent}%</span>
                  </div>
                  
                  {/* 时间 */}
                  {result.created_at && (
                    <span className="text-xs text-default-400">
                      {dayjs(result.created_at).fromNow()}
                    </span>
                  )}
                </div>
                
                {/* 分数详情 (调试用，可选显示) */}
                {(result.text_score !== undefined || result.vector_score !== undefined) && (
                  <div className="flex gap-3 mt-2 text-xs text-default-400">
                    {result.text_score !== undefined && (
                      <span>文本: {(result.text_score * 100).toFixed(0)}%</span>
                    )}
                    {result.vector_score !== undefined && (
                      <span>语义: {(result.vector_score * 100).toFixed(0)}%</span>
                    )}
                  </div>
                )}
              </div>
              
              {/* 预览按钮 */}
              <div className="flex-shrink-0">
                <Button
                  size="sm"
                  variant="light"
                  isIconOnly
                  onPress={() => setShowPreview(true)}
                >
                  <Icon icon="mdi:eye" />
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>
      
      {/* 预览模态框 */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalBody className="p-4">
            {result.source_type === 'video' ? (
              <VideoPreview
                src={result.source_path}
                startTime={result.metadata.start_time}
                endTime={result.metadata.end_time}
                title={result.metadata.title || fileName}
                onClose={() => setShowPreview(false)}
              />
            ) : result.source_type === 'ppt' ? (
              <PPTPreview
                filePath={result.source_path}
                currentPage={result.metadata.page_number}
                totalPages={result.metadata.total_pages}
                title={result.metadata.title || fileName}
                highlightText={query}
                onClose={() => setShowPreview(false)}
              />
            ) : (
              <Card>
                <CardBody>
                  <div className="flex items-center gap-2 mb-4">
                    <Icon icon={config.icon} className="text-2xl" />
                    <h3 className="font-semibold">{result.metadata.title || fileName}</h3>
                  </div>
                  <div className="p-4 bg-default-50 rounded-lg">
                    <p className="whitespace-pre-wrap">{highlightText(result.content, query)}</p>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button variant="light" onPress={() => setShowPreview(false)}>
                      关闭
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
});

SearchResultCard.displayName = 'SearchResultCard';

export default SearchResultCard;
