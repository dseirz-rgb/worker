/**
 * EchoAI 语义搜索页面
 * 从 Khoj 源码移植，提供知识库语义搜索功能
 */

import { observer } from 'mobx-react-lite';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardBody, 
  CardHeader,
  CardFooter,
  Button, 
  Spinner,
  Input,
  ScrollShadow,
  Chip,
  Divider,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { api } from '@/lib/trpc';

// ============================================
// 类型定义
// ============================================

interface SearchResult {
  entry: string;
  score: number;
  file: string;
  compiled: string;
  additional: {
    file: string;
    heading?: string;
    source?: string;
  };
}

// ============================================
// 搜索结果卡片组件
// ============================================

interface SearchResultCardProps {
  result: SearchResult;
  onUseInChat: (content: string) => void;
}

function SearchResultCard({ result, onUseInChat }: SearchResultCardProps) {
  const isUrl = result.file?.startsWith('http') || result.additional?.file?.startsWith('http');
  const fileName = isUrl 
    ? result.additional?.heading || '链接'
    : (result.file || result.additional?.file)?.split('/').pop() || '未知文件';
  
  // 获取文件类型图标
  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'notion': return 'simple-icons:notion';
      case 'github': return 'mdi:github';
      case 'pdf': return 'mdi:file-pdf-box';
      case 'markdown': return 'mdi:language-markdown';
      default: return 'mdi:file-document-outline';
    }
  };

  // 计算相关度百分比
  const relevancePercent = Math.round(result.score * 100);

  return (
    <Card className="mb-3 animate-fade-in">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Icon 
              icon={getSourceIcon(result.additional?.source)} 
              className="w-5 h-5 text-foreground/60" 
            />
            <span className="font-medium text-sm truncate max-w-[200px]" title={fileName}>
              {fileName}
            </span>
          </div>
          <Chip size="sm" variant="flat" color={relevancePercent > 70 ? 'success' : 'default'}>
            {relevancePercent}% 相关
          </Chip>
        </div>
      </CardHeader>
      <CardBody className="py-2">
        <p className="text-sm text-foreground/80 line-clamp-4">
          {result.entry}
        </p>
      </CardBody>
      <CardFooter className="pt-2 flex justify-between items-center">
        {isUrl && (
          <a 
            href={result.additional.file} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Icon icon="mdi:open-in-new" className="w-3 h-3" />
            打开链接
          </a>
        )}
        <Button
          size="sm"
          variant="flat"
          color="primary"
          onPress={() => onUseInChat(result.entry)}
          startContent={<Icon icon="mdi:chat-outline" className="w-4 h-4" />}
        >
          在对话中使用
        </Button>
      </CardFooter>
    </Card>
  );
}

// ============================================
// 主页面组件
// ============================================

const EchoAISearchPage = observer(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 状态
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 检查服务状态
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await api.khoj.getStatus.query();
        setIsAvailable(status.success);
      } catch (err) {
        setIsAvailable(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkStatus();
  }, []);

  // 执行搜索
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const results = await api.khoj.search.query({ query });
      setSearchResults(results || []);
    } catch (err) {
      console.error('搜索失败:', err);
      setError('搜索失败，请稍后重试');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 处理搜索输入变化（防抖）
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);

    // 清除之前的定时器
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // 防抖搜索
    if (value.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(value);
      }, 500);
    } else {
      setSearchResults(null);
    }
  }, [performSearch]);

  // 处理回车搜索
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      performSearch(searchQuery);
    }
  }, [searchQuery, performSearch]);

  // 在对话中使用搜索结果
  const handleUseInChat = useCallback(async (content: string) => {
    try {
      // 创建新对话
      const result = await api.khoj.createConversation.mutate({});
      
      if (result.conversation_id) {
        // 存储上下文到 localStorage
        localStorage.setItem('echoai_pending_context', content);
        localStorage.setItem('echoai_pending_message', `基于以下内容回答我的问题：\n\n${content.slice(0, 500)}...`);
        
        // 跳转到对话页面
        navigate(`/echoai?conversationId=${result.conversation_id}`);
      }
    } catch (error) {
      console.error('创建对话失败:', error);
    }
  }, [navigate]);

  // 加载中
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  // 服务不可用
  if (!isAvailable) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md p-8">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-danger/10 flex items-center justify-center">
            <Icon icon="mdi:magnify-close" className="w-12 h-12 text-danger/70" />
          </div>
          <h2 className="text-xl font-semibold mb-2">
            {t('echoai-service-disconnected')}
          </h2>
          <p className="text-foreground/60 mb-4">
            {t('echoai-not-connected')}
          </p>
          <Button
            color="primary"
            onPress={() => window.location.reload()}
            startContent={<Icon icon="solar:refresh-linear" className="w-4 h-4" />}
          >
            {t('retry-connection')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 头部搜索区域 */}
      <div className="p-4 border-b border-divider bg-background/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold mb-4 text-center">
            知识库语义搜索
          </h1>
          <Input
            ref={searchInputRef}
            placeholder="输入关键词搜索您的知识库..."
            value={searchQuery}
            onValueChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            startContent={
              <Icon icon="mdi:magnify" className="w-5 h-5 text-foreground/50" />
            }
            endContent={
              isSearching ? (
                <Spinner size="sm" />
              ) : searchQuery ? (
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => {
                    setSearchQuery('');
                    setSearchResults(null);
                    searchInputRef.current?.focus();
                  }}
                >
                  <Icon icon="mdi:close" className="w-4 h-4" />
                </Button>
              ) : null
            }
            classNames={{
              inputWrapper: 'bg-default-100',
            }}
            size="lg"
            autoFocus
          />
        </div>
      </div>

      {/* 搜索结果区域 */}
      <ScrollShadow className="flex-1 p-4">
        <div className="max-w-2xl mx-auto">
          {/* 错误提示 */}
          {error && (
            <div className="p-4 rounded-lg bg-danger/10 text-danger mb-4 flex items-center gap-2">
              <Icon icon="mdi:alert-circle" className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* 搜索结果 */}
          {searchResults && searchResults.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-foreground/60">
                  找到 {searchResults.length} 条结果
                </span>
              </div>
              {searchResults.map((result, index) => (
                <SearchResultCard
                  key={result['corpus-id'] || index}
                  result={result}
                  onUseInChat={handleUseInChat}
                />
              ))}
            </>
          )}

          {/* 无结果 */}
          {searchResults && searchResults.length === 0 && !isSearching && (
            <div className="text-center py-12">
              <Icon icon="mdi:file-search-outline" className="w-16 h-16 mx-auto text-foreground/30 mb-4" />
              <p className="text-foreground/60">没有找到相关结果</p>
              <p className="text-sm text-foreground/40 mt-2">
                尝试使用不同的关键词搜索
              </p>
            </div>
          )}

          {/* 初始状态 */}
          {!searchResults && !isSearching && (
            <div className="text-center py-12">
              <Icon icon="mdi:brain" className="w-16 h-16 mx-auto text-foreground/30 mb-4" />
              <p className="text-foreground/60">输入关键词开始搜索</p>
              <p className="text-sm text-foreground/40 mt-2">
                EchoAI 将在您的知识库中进行语义搜索
              </p>
              
              <Divider className="my-8" />
              
              {/* 搜索提示 */}
              <div className="text-left max-w-md mx-auto">
                <h3 className="text-sm font-medium mb-3">搜索技巧</h3>
                <ul className="text-sm text-foreground/60 space-y-2">
                  <li className="flex items-start gap-2">
                    <Icon icon="mdi:lightbulb-outline" className="w-4 h-4 mt-0.5 text-warning" />
                    使用自然语言描述您要查找的内容
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon icon="mdi:lightbulb-outline" className="w-4 h-4 mt-0.5 text-warning" />
                    可以使用 <code className="bg-default-100 px-1 rounded">file:"文件名"</code> 过滤特定文件
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon icon="mdi:lightbulb-outline" className="w-4 h-4 mt-0.5 text-warning" />
                    点击"在对话中使用"可将结果作为 AI 对话的上下文
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </ScrollShadow>
    </div>
  );
});

export default EchoAISearchPage;
