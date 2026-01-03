/**
 * Research 研究页面 - AI 服务统一迁移
 * 
 * 提供深度研究功能：
 * - 多轮迭代研究
 * - 来源引用展示
 * - 研究历史管理
 */

import { observer } from 'mobx-react-lite';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Spinner,
  Chip,
  Progress,
  Divider,
  Accordion,
  AccordionItem,
  Tooltip,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/trpc';
import { RootStore } from '@/store';
import { ToastPlugin } from '@/store/module/Toast/Toast';
import { ScrollArea } from '@/components/Common/ScrollArea';
import { MarkdownRender } from '@/components/Common/MarkdownRender';

// 研究迭代类型
interface ResearchIteration {
  iteration: number;
  query: string;
  findings: string;
  sources: ResearchSource[];
  nextSteps: string[];
}

// 来源类型
interface ResearchSource {
  type: 'note' | 'web' | 'file';
  title: string;
  url?: string;
  noteId?: number;
  snippet: string;
  relevance: number;
}

// 研究会话类型
interface ResearchSession {
  id: number;
  query: string;
  summary: string | null;
  iterations: ResearchIteration[];
  sources: ResearchSource[];
  confidence: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

// 来源卡片组件
const SourceCard = ({ source }: { source: ResearchSource }) => {
  const typeIcon = {
    note: 'solar:document-text-bold-duotone',
    web: 'solar:global-bold-duotone',
    file: 'solar:file-bold-duotone',
  }[source.type];

  const typeColor = {
    note: 'primary',
    web: 'secondary',
    file: 'warning',
  }[source.type] as 'primary' | 'secondary' | 'warning';

  return (
    <Card className="bg-default-50">
      <CardBody className="p-3">
        <div className="flex items-start gap-2">
          <div className={`w-8 h-8 rounded-lg bg-${typeColor}/10 flex items-center justify-center flex-shrink-0`}>
            <Icon icon={typeIcon} className={`w-4 h-4 text-${typeColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{source.title}</span>
              <Chip size="sm" variant="flat" color={typeColor}>
                {source.type}
              </Chip>
            </div>
            <p className="text-xs text-foreground/60 line-clamp-2 mt-1">
              {source.snippet}
            </p>
            {source.url && (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
              >
                <Icon icon="solar:link-linear" className="w-3 h-3" />
                查看来源
              </a>
            )}
          </div>
          <Tooltip content={`相关度: ${Math.round(source.relevance * 100)}%`}>
            <div className="w-8 h-8 rounded-full bg-default-100 flex items-center justify-center">
              <span className="text-xs font-medium">{Math.round(source.relevance * 100)}</span>
            </div>
          </Tooltip>
        </div>
      </CardBody>
    </Card>
  );
};

// 迭代卡片组件
const IterationCard = ({ iteration }: { iteration: ResearchIteration }) => {
  return (
    <Card className="bg-default-50/50">
      <CardBody className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">{iteration.iteration}</span>
          </div>
          <span className="text-sm font-medium">迭代 {iteration.iteration}</span>
        </div>
        
        <div className="space-y-3">
          <div>
            <p className="text-xs text-foreground/50 mb-1">查询</p>
            <p className="text-sm">{iteration.query}</p>
          </div>
          
          <div>
            <p className="text-xs text-foreground/50 mb-1">发现</p>
            <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
              <MarkdownRender content={iteration.findings} />
            </div>
          </div>

          {iteration.sources.length > 0 && (
            <div>
              <p className="text-xs text-foreground/50 mb-2">来源 ({iteration.sources.length})</p>
              <div className="space-y-2">
                {iteration.sources.slice(0, 3).map((source, idx) => (
                  <SourceCard key={idx} source={source} />
                ))}
                {iteration.sources.length > 3 && (
                  <p className="text-xs text-foreground/50 text-center">
                    还有 {iteration.sources.length - 3} 个来源
                  </p>
                )}
              </div>
            </div>
          )}

          {iteration.nextSteps.length > 0 && iteration.nextSteps[0] !== 'COMPLETE' && (
            <div>
              <p className="text-xs text-foreground/50 mb-1">下一步</p>
              <div className="flex flex-wrap gap-1">
                {iteration.nextSteps.map((step, idx) => (
                  <Chip key={idx} size="sm" variant="flat">
                    {step}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

// 研究历史卡片
const HistoryCard = ({ 
  session, 
  onSelect 
}: { 
  session: ResearchSession; 
  onSelect: () => void;
}) => {
  const statusColor = {
    completed: 'success',
    running: 'primary',
    failed: 'danger',
    pending: 'default',
  }[session.status] as 'success' | 'primary' | 'danger' | 'default';

  return (
    <Card 
      isPressable 
      onPress={onSelect}
      className="hover:shadow-md transition-shadow"
    >
      <CardBody className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{session.query}</p>
            <p className="text-xs text-foreground/50 mt-1">
              {new Date(session.createdAt).toLocaleString()}
            </p>
          </div>
          <Chip size="sm" color={statusColor} variant="flat">
            {session.status}
          </Chip>
        </div>
        {session.summary && (
          <p className="text-xs text-foreground/60 line-clamp-2 mt-2">
            {session.summary}
          </p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-foreground/50">
          <span className="flex items-center gap-1">
            <Icon icon="solar:layers-linear" className="w-3 h-3" />
            {session.iterations?.length || 0} 轮
          </span>
          <span className="flex items-center gap-1">
            <Icon icon="solar:link-linear" className="w-3 h-3" />
            {session.sources?.length || 0} 来源
          </span>
          {session.confidence > 0 && (
            <span className="flex items-center gap-1">
              <Icon icon="solar:verified-check-linear" className="w-3 h-3" />
              {Math.round(session.confidence * 100)}%
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

// 主组件
const ResearchPage = observer(() => {
  const toast = RootStore.Get(ToastPlugin);

  // 状态
  const [query, setQuery] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [currentIterations, setCurrentIterations] = useState<ResearchIteration[]>([]);
  const [currentResult, setCurrentResult] = useState<ResearchSession | null>(null);
  const [history, setHistory] = useState<ResearchSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ResearchSession | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // 加载历史
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const result = await api.research.listSessions.query({ limit: 20 });
      setHistory(result as ResearchSession[]);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // 开始研究
  const handleStartResearch = useCallback(async () => {
    if (!query.trim() || isResearching) return;

    setIsResearching(true);
    setCurrentIterations([]);
    setCurrentResult(null);
    setSelectedSession(null);

    try {
      const result = await api.research.startResearch.mutate({
        query: query.trim(),
        config: {
          maxIterations: 5,
          searchDepth: 'deep',
          tools: ['rag', 'web'],
        },
      });

      setCurrentResult(result as ResearchSession);
      setCurrentIterations((result as ResearchSession).iterations || []);
      toast.success('研究完成');
      loadHistory();
    } catch (err) {
      toast.error('研究失败');
      console.error('Research failed:', err);
    } finally {
      setIsResearching(false);
    }
  }, [query, isResearching, toast, loadHistory]);

  // 选择历史会话
  const handleSelectSession = useCallback(async (session: ResearchSession) => {
    try {
      const detail = await api.research.getSession.query({ id: session.id });
      setSelectedSession(detail as ResearchSession);
      setCurrentIterations((detail as ResearchSession).iterations || []);
      setCurrentResult(detail as ResearchSession);
    } catch (err) {
      toast.error('加载失败');
    }
  }, [toast]);

  // 清除当前结果
  const handleClear = useCallback(() => {
    setQuery('');
    setCurrentIterations([]);
    setCurrentResult(null);
    setSelectedSession(null);
    inputRef.current?.focus();
  }, []);

  // 显示的结果
  const displayResult = selectedSession || currentResult;
  const displayIterations = displayResult?.iterations || currentIterations;

  return (
    <div className="flex h-full">
      {/* 左侧：历史记录 */}
      <div className="w-72 border-r border-divider flex flex-col bg-default-50/50">
        <div className="p-4 border-b border-divider">
          <h2 className="font-semibold flex items-center gap-2">
            <Icon icon="solar:history-bold-duotone" className="w-5 h-5 text-primary" />
            研究历史
          </h2>
        </div>
        <ScrollArea onBottom={() => {}} className="flex-1 p-3">
          {isLoadingHistory ? (
            <div className="flex justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-2">
              {history.map((session) => (
                <HistoryCard
                  key={session.id}
                  session={session}
                  onSelect={() => handleSelectSession(session)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-foreground/50">
              <Icon icon="solar:inbox-linear" className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无研究历史</p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* 右侧：主内容区 */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-divider bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <Icon icon="solar:magnifer-zoom-in-bold-duotone" className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">深度研究</h1>
              <p className="text-xs text-foreground/50">
                多轮迭代研究，综合笔记和网络信息
              </p>
            </div>
          </div>

          {/* 搜索输入 */}
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入研究问题，例如：React 19 有哪些新特性？"
              size="lg"
              classNames={{
                inputWrapper: 'bg-default-100',
              }}
              startContent={
                <Icon icon="solar:magnifer-linear" className="w-5 h-5 text-foreground/50" />
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleStartResearch();
                }
              }}
              isDisabled={isResearching}
            />
            <Button
              color="primary"
              size="lg"
              onPress={handleStartResearch}
              isLoading={isResearching}
              isDisabled={!query.trim()}
            >
              {isResearching ? '研究中...' : '开始研究'}
            </Button>
            {displayResult && (
              <Button
                variant="flat"
                size="lg"
                onPress={handleClear}
              >
                清除
              </Button>
            )}
          </div>
        </div>

        {/* 内容区 */}
        <ScrollArea onBottom={() => {}} className="flex-1 p-4">
          {/* 研究进度 */}
          {isResearching && (
            <Card className="mb-4">
              <CardBody className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Spinner size="sm" />
                  <span className="font-medium">正在研究...</span>
                </div>
                <Progress
                  size="sm"
                  isIndeterminate
                  color="primary"
                  className="mb-2"
                />
                <p className="text-xs text-foreground/50">
                  正在搜索笔记和网络资源，分析相关信息...
                </p>
              </CardBody>
            </Card>
          )}

          {/* 研究结果 */}
          {displayResult && (
            <div className="space-y-4">
              {/* 摘要 */}
              {displayResult.summary && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5 text-primary" />
                      <span className="font-semibold">研究摘要</span>
                      {displayResult.confidence > 0 && (
                        <Chip size="sm" color="success" variant="flat">
                          置信度 {Math.round(displayResult.confidence * 100)}%
                        </Chip>
                      )}
                    </div>
                  </CardHeader>
                  <CardBody className="pt-0">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <MarkdownRender content={displayResult.summary} />
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* 来源汇总 */}
              {displayResult.sources && displayResult.sources.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:link-bold-duotone" className="w-5 h-5 text-secondary" />
                      <span className="font-semibold">
                        来源引用 ({displayResult.sources.length})
                      </span>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {displayResult.sources.map((source, idx) => (
                        <SourceCard key={idx} source={source} />
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* 迭代详情 */}
              {displayIterations.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:layers-bold-duotone" className="w-5 h-5 text-warning" />
                      <span className="font-semibold">
                        研究过程 ({displayIterations.length} 轮)
                      </span>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-0">
                    <Accordion variant="splitted">
                      {displayIterations.map((iteration, idx) => (
                        <AccordionItem
                          key={idx}
                          aria-label={`迭代 ${iteration.iteration}`}
                          title={
                            <div className="flex items-center gap-2">
                              <span className="font-medium">迭代 {iteration.iteration}</span>
                              <span className="text-xs text-foreground/50">
                                {iteration.query}
                              </span>
                            </div>
                          }
                        >
                          <IterationCard iteration={iteration} />
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardBody>
                </Card>
              )}
            </div>
          )}

          {/* 空状态 */}
          {!isResearching && !displayResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="w-32 h-32 mb-6 rounded-full bg-gradient-to-br from-violet-500/10 to-purple-500/10 flex items-center justify-center">
                <Icon icon="solar:magnifer-zoom-in-bold-duotone" className="w-16 h-16 text-violet-500/50" />
              </div>
              <h3 className="text-xl font-semibold mb-2">开始深度研究</h3>
              <p className="text-foreground/60 text-center max-w-md mb-6">
                输入你想研究的问题，AI 将综合你的笔记和网络资源，进行多轮迭代研究，为你提供全面的答案。
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  'React 19 新特性',
                  'TypeScript 最佳实践',
                  'AI 发展趋势',
                ].map((suggestion) => (
                  <Chip
                    key={suggestion}
                    variant="flat"
                    className="cursor-pointer hover:bg-primary/20"
                    onClick={() => setQuery(suggestion)}
                  >
                    {suggestion}
                  </Chip>
                ))}
              </div>
            </motion.div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
});

export default ResearchPage;
