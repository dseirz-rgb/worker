/**
 * 投资模块 - 决策中心页面
 * AI 驱动的投资分析与决策支持
 * 
 * 从 RiskControl DecisionCenter.tsx 迁移，使用 HeroUI 组件
 * 
 * **Validates: Requirements 4.1**
 */

import { observer } from 'mobx-react-lite';
import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Button,
  Textarea,
  Tabs,
  Tab,
  Spinner,
  Progress,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';
import { RootStore } from '@/store';
import InvestmentStore from '@/store/investmentStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ============ Types ============

interface AISuggestion {
  id: number;
  type: 'buy' | 'hold' | 'sell';
  ticker: string;
  title: string;
  reason: string;
  confidence: number;
  risk: 'low' | 'medium' | 'high';
}

interface AIAnalysis {
  id: number;
  title: string;
  content: string;
  recommendation: string;
  riskLevel: string;
  createdAt: Date;
}

// ============ Constants ============

// AI API 端点（使用环境变量或默认值）
const AI_API_URL = import.meta.env.VITE_AI_API_URL || '/api/chat';

// 模拟 AI 建议数据（当 API 不可用时使用）
const MOCK_SUGGESTIONS: AISuggestion[] = [
  {
    id: 1,
    type: 'buy',
    ticker: 'NVDA',
    title: '英伟达买入建议',
    reason: 'AI 芯片需求持续增长，技术面突破关键阻力位',
    confidence: 85,
    risk: 'medium',
  },
  {
    id: 2,
    type: 'hold',
    ticker: 'AAPL',
    title: '苹果持有建议',
    reason: '估值合理，等待新产品周期',
    confidence: 72,
    risk: 'low',
  },
  {
    id: 3,
    type: 'sell',
    ticker: 'TSLA',
    title: '特斯拉减仓建议',
    reason: '竞争加剧，估值偏高，建议部分获利了结',
    confidence: 68,
    risk: 'high',
  },
];

// ============ Components ============

// 建议卡片组件
const SuggestionCard = observer(({ suggestion }: { suggestion: AISuggestion }) => {
  const typeConfig = {
    buy: { color: 'success', icon: 'mdi:arrow-up-bold', label: '买入' },
    hold: { color: 'warning', icon: 'mdi:minus', label: '持有' },
    sell: { color: 'danger', icon: 'mdi:arrow-down-bold', label: '卖出' },
  };

  const config = typeConfig[suggestion.type];
  const riskColors = { low: 'success', medium: 'warning', high: 'danger' };

  return (
    <Card className="bg-content1/50 backdrop-blur-sm">
      <CardBody className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-${config.color}/10`}>
              <Icon icon={config.icon} className={`text-xl text-${config.color}`} />
            </div>
            <div>
              <p className="font-semibold">{suggestion.ticker}</p>
              <p className="text-xs text-foreground/50">{suggestion.title}</p>
            </div>
          </div>
          <Chip color={config.color as any} variant="flat" size="sm">
            {config.label}
          </Chip>
        </div>
        <p className="text-sm text-foreground/70 mb-3">{suggestion.reason}</p>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-foreground/50">置信度:</span>
            <Progress 
              value={suggestion.confidence} 
              size="sm" 
              color={config.color as any}
              className="w-20"
            />
            <span className="font-semibold">{suggestion.confidence}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-foreground/50">风险:</span>
            <Chip size="sm" color={riskColors[suggestion.risk] as any} variant="flat">
              {suggestion.risk === 'low' ? '低' : suggestion.risk === 'medium' ? '中' : '高'}
            </Chip>
          </div>
        </div>
      </CardBody>
    </Card>
  );
});

// 研报卡片组件
const AnalysisCard = observer(({ analysis, onDelete }: { analysis: AIAnalysis; onDelete?: () => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 解析风险等级
  const riskMatch = analysis.content.match(/<!--RISK_LEVEL:(.*?)-->/);
  const riskLevel = riskMatch ? riskMatch[1] : analysis.riskLevel || 'MEDIUM';
  const cleanContent = analysis.content.replace(/<!--RISK_LEVEL:.*?-->\n?/, '').replace(/<!--ACTION_PLAN:.*?-->\n?/, '');
  
  const riskColors: Record<string, string> = {
    LOW: 'success',
    MEDIUM: 'warning',
    HIGH: 'danger',
    CRITICAL: 'danger',
  };

  return (
    <Card className="bg-content1/50 backdrop-blur-sm">
      <CardHeader className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Icon icon="mdi:file-document" className="text-primary" />
            <span className="font-bold">{analysis.title}</span>
          </div>
          <div className="text-xs text-foreground/50 flex items-center gap-2">
            <Icon icon="mdi:clock-outline" />
            {analysis.createdAt.toLocaleString()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Chip color={riskColors[riskLevel] as any} variant="flat" size="sm">
            风险: {riskLevel}
          </Chip>
          <Chip color="primary" variant="flat" size="sm">
            {analysis.recommendation}
          </Chip>
          {onDelete && (
            <Button isIconOnly size="sm" variant="light" color="danger" onPress={onDelete}>
              <Icon icon="mdi:delete" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        <div className={`prose prose-sm dark:prose-invert max-w-none ${!isExpanded ? 'line-clamp-6' : ''}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {cleanContent}
          </ReactMarkdown>
        </div>
        <Button
          size="sm"
          variant="light"
          className="mt-2"
          onPress={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '收起' : '展开全文'}
        </Button>
      </CardBody>
    </Card>
  );
});

// ============ Main Component ============

const DecisionCenterPage = observer(() => {
  const [selectedTab, setSelectedTab] = useState('suggestions');
  const [query, setQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [analyses, setAnalyses] = useState<AIAnalysis[]>([]);
  const [suggestions] = useState<AISuggestion[]>(MOCK_SUGGESTIONS);

  // 获取 InvestmentStore
  const investmentStore = RootStore.Get(InvestmentStore);

  // 智能问答
  const handleAnalyze = useCallback(async () => {
    if (!query.trim()) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // 构建上下文
      const portfolioContext = investmentStore.positions.length > 0
        ? `当前持仓: ${investmentStore.positions.map(p => `${p.ticker}(${p.weight.toFixed(1)}%)`).join(', ')}`
        : '暂无持仓数据';

      const prompt = `
你是一位专业的投资顾问。用户问题: "${query}"

${portfolioContext}

请提供专业、简洁的分析和建议。使用 Markdown 格式，包含：
1. 直接回答问题
2. 相关的市场分析
3. 具体的操作建议
4. 风险提示

限制在 500 字以内。
      `;

      const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7
          }
        })
      });

      if (!response.ok) {
        throw new Error('AI API 请求失败');
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                   (Array.isArray(data) ? data[0]?.candidates?.[0]?.content?.parts?.[0]?.text : '');
      
      setAnalysisResult(text || '抱歉，无法生成分析结果。请稍后重试。');
    } catch (error) {
      console.error('AI 分析失败:', error);
      // 使用模拟响应
      setAnalysisResult(`
## 分析结果

根据您的问题「${query}」，以下是我的分析：

### 市场观点
当前市场处于震荡整理阶段，建议保持谨慎乐观态度。

### 操作建议
1. 控制仓位在 60-70% 之间
2. 关注科技板块的回调机会
3. 设置好止损位，控制风险

### 风险提示
- 注意美联储政策变化
- 关注地缘政治风险
- 保持流动性储备

*注：AI 服务暂时不可用，以上为模拟响应*
      `);
    } finally {
      setIsAnalyzing(false);
    }
  }, [query, investmentStore.positions]);

  // 生成深度研报
  const handleGenerateReport = useCallback(async () => {
    setIsGeneratingReport(true);
    setStreamingContent('');

    try {
      const dashboard = investmentStore.dashboardSnapshot || {
        netWorthCNY: investmentStore.accountNetWorth,
        dailyPnLPercent: investmentStore.dailyPnLPercent,
      };
      const positions = investmentStore.positions;

      const prompt = `
你是一位顶级的华尔街投资风控专家。请基于以下投资组合数据生成一份专业的中文风控研报。

### 投资组合数据
- 账户净值: ¥${dashboard.netWorthCNY?.toLocaleString() || '未知'}
- 日盈亏: ${dashboard.dailyPnLPercent?.toFixed(2) || 0}%
- 持仓数量: ${positions.length}
- 主要持仓: ${positions.slice(0, 5).map(p => `${p.ticker}(${p.weight.toFixed(1)}%)`).join(', ') || '无'}

### 报告要求
请生成包含以下内容的研报：
1. **宏观环境分析** - 当前市场周期定位
2. **持仓结构诊断** - 集中度、相关性分析
3. **风险预警** - 潜在的下行风险点
4. **操作建议** - 具体的调仓建议

使用 Markdown 格式，限制在 1000 字以内。
      `;

      const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.7
          }
        })
      });

      if (!response.ok) {
        throw new Error('AI API 请求失败');
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (text) {
        const newAnalysis: AIAnalysis = {
          id: Date.now(),
          title: `投资研报 ${new Date().toLocaleDateString()}`,
          content: `<!--RISK_LEVEL:MEDIUM-->\n${text}`,
          recommendation: 'HOLD',
          riskLevel: 'MEDIUM',
          createdAt: new Date(),
        };
        setAnalyses(prev => [newAnalysis, ...prev]);
      }
    } catch (error) {
      console.error('生成研报失败:', error);
      // 使用模拟研报
      const mockAnalysis: AIAnalysis = {
        id: Date.now(),
        title: `投资研报 ${new Date().toLocaleDateString()}`,
        content: `<!--RISK_LEVEL:MEDIUM-->
## 宏观环境分析

当前全球市场处于**高利率环境**下的调整期，美联储维持利率不变的预期增强。

### 市场周期定位
- 美股：牛市后期，估值偏高
- A股：底部震荡，等待政策催化
- 港股：估值洼地，关注科技股

## 持仓结构诊断

### 集中度分析
当前持仓集中度适中，建议关注单一标的占比不超过 20%。

### 相关性检查
科技股占比较高，存在一定的行业集中风险。

## 风险预警

🚨 **主要风险点**：
1. 美联储政策转向风险
2. 地缘政治不确定性
3. 科技股估值回调风险

## 操作建议

💡 **建议操作**：
1. 维持当前仓位，不追高
2. 关注回调买入机会
3. 设置 5% 止损位

*注：AI 服务暂时不可用，以上为模拟研报*
        `,
        recommendation: 'HOLD',
        riskLevel: 'MEDIUM',
        createdAt: new Date(),
      };
      setAnalyses(prev => [mockAnalysis, ...prev]);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [investmentStore]);

  // 删除研报
  const handleDeleteAnalysis = useCallback((id: number) => {
    setAnalyses(prev => prev.filter(a => a.id !== id));
  }, []);

  // 初始化加载持仓数据
  useEffect(() => {
    if (investmentStore.positions.length === 0) {
      investmentStore.fetchPositions();
    }
  }, [investmentStore]);

  return (
    <GradientBackground className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/investment">
              <Button isIconOnly variant="light" size="sm">
                <Icon icon="mdi:arrow-left" className="text-xl" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Icon icon="mdi:brain" className="text-secondary" />
                决策中心
              </h1>
              <p className="text-foreground/60 mt-1">
                AI 驱动的投资分析与决策支持
              </p>
            </div>
          </div>
          <Button
            color="secondary"
            startContent={isGeneratingReport ? <Spinner size="sm" /> : <Icon icon="mdi:sparkles" />}
            onPress={handleGenerateReport}
            isDisabled={isGeneratingReport}
          >
            {isGeneratingReport ? '生成中...' : '生成今日研报'}
          </Button>
        </div>

        {/* 标签页 */}
        <Tabs
          selectedKey={selectedTab}
          onSelectionChange={(key) => setSelectedTab(key as string)}
          variant="underlined"
          classNames={{
            tabList: 'gap-6',
            cursor: 'bg-primary',
            tab: 'px-0 h-12',
          }}
        >
          <Tab
            key="suggestions"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:lightbulb" />
                <span>AI 建议</span>
              </div>
            }
          />
          <Tab
            key="analysis"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:chat-processing" />
                <span>智能问答</span>
              </div>
            }
          />
          <Tab
            key="reports"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:file-document" />
                <span>研报解读</span>
                {analyses.length > 0 && (
                  <Chip size="sm" color="primary" variant="flat">{analyses.length}</Chip>
                )}
              </div>
            }
          />
        </Tabs>

        {/* AI 建议 Tab */}
        {selectedTab === 'suggestions' && (
          <div className="space-y-6">
            <Card className="bg-primary/5 border border-primary/20">
              <CardBody className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon icon="mdi:robot" className="text-2xl text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">AI 投资顾问</p>
                    <p className="text-sm text-foreground/60">
                      基于市场数据和您的持仓情况，为您提供个性化投资建议
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggestions.map(suggestion => (
                <SuggestionCard key={suggestion.id} suggestion={suggestion} />
              ))}
            </div>

            <Card className="bg-content1/50 backdrop-blur-sm">
              <CardBody className="p-6 text-center">
                <Icon icon="mdi:sparkles" className="text-4xl text-primary/50 mb-3 mx-auto" />
                <p className="text-foreground/60">
                  更多 AI 建议将根据市场变化实时更新
                </p>
              </CardBody>
            </Card>
          </div>
        )}

        {/* 智能问答 Tab */}
        {selectedTab === 'analysis' && (
          <div className="space-y-6">
            <Card className="bg-content1/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon icon="mdi:chat-question" className="text-xl text-primary" />
                  <h3 className="font-semibold">向 AI 提问</h3>
                </div>
              </CardHeader>
              <CardBody className="pt-0 space-y-4">
                <Textarea
                  placeholder="输入您的投资问题，例如：当前市场环境下，科技股还值得投资吗？"
                  value={query}
                  onValueChange={setQuery}
                  minRows={3}
                  maxRows={6}
                />
                <div className="flex justify-end">
                  <Button
                    color="primary"
                    startContent={isAnalyzing ? <Spinner size="sm" /> : <Icon icon="mdi:send" />}
                    isDisabled={!query.trim() || isAnalyzing}
                    onPress={handleAnalyze}
                  >
                    {isAnalyzing ? '分析中...' : '开始分析'}
                  </Button>
                </div>
              </CardBody>
            </Card>

            {analysisResult && (
              <Card className="bg-content1/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon icon="mdi:robot" className="text-xl text-success" />
                    <h3 className="font-semibold">AI 分析结果</h3>
                  </div>
                </CardHeader>
                <CardBody className="pt-0">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {analysisResult}
                    </ReactMarkdown>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* 快捷问题 */}
            <Card className="bg-content1/50 backdrop-blur-sm">
              <CardHeader>
                <h3 className="font-semibold">常见问题</h3>
              </CardHeader>
              <CardBody className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {[
                    '当前市场趋势如何？',
                    '我的持仓风险如何？',
                    '有哪些值得关注的机会？',
                    '如何优化资产配置？',
                  ].map((q, i) => (
                    <Button
                      key={i}
                      size="sm"
                      variant="flat"
                      onPress={() => setQuery(q)}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {/* 研报解读 Tab */}
        {selectedTab === 'reports' && (
          <div className="space-y-6">
            {analyses.length === 0 ? (
              <Card className="bg-content1/50 backdrop-blur-sm">
                <CardBody className="p-8 text-center">
                  <Icon icon="mdi:file-document-multiple" className="text-6xl text-primary/50 mb-4 mx-auto" />
                  <h3 className="text-xl font-semibold mb-2">研报解读</h3>
                  <p className="text-foreground/60 mb-4">
                    暂无研报，点击上方按钮生成今日研报
                  </p>
                  <Button 
                    color="primary" 
                    variant="flat"
                    startContent={<Icon icon="mdi:sparkles" />}
                    onPress={handleGenerateReport}
                    isDisabled={isGeneratingReport}
                  >
                    生成研报
                  </Button>
                </CardBody>
              </Card>
            ) : (
              <>
                {/* 流式输出预览 */}
                {isGeneratingReport && streamingContent && (
                  <Card className="bg-secondary/10 border border-secondary/30">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Spinner size="sm" color="secondary" />
                        <span className="font-semibold text-secondary">正在生成中...</span>
                      </div>
                    </CardHeader>
                    <CardBody className="pt-0">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {streamingContent}
                        </ReactMarkdown>
                      </div>
                    </CardBody>
                  </Card>
                )}

                {/* 历史研报列表 */}
                {analyses.map(analysis => (
                  <AnalysisCard 
                    key={analysis.id} 
                    analysis={analysis} 
                    onDelete={() => handleDeleteAnalysis(analysis.id)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </GradientBackground>
  );
});

export default DecisionCenterPage;
