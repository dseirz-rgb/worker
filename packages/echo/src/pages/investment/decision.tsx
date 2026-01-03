/**
 * 投资模块 - 决策中心页面
 * AI 驱动的投资分析与决策支持
 * 
 * **Validates: Requirements 4.1**
 */

import { observer } from 'mobx-react-lite';
import { useState } from 'react';
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
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';

// AI 分析建议（模拟）
const aiSuggestions = [
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

// 建议卡片组件
const SuggestionCard = observer(({ suggestion }: { suggestion: typeof aiSuggestions[0] }) => {
  const typeConfig = {
    buy: { color: 'success', icon: 'mdi:arrow-up-bold', label: '买入' },
    hold: { color: 'warning', icon: 'mdi:minus', label: '持有' },
    sell: { color: 'danger', icon: 'mdi:arrow-down-bold', label: '卖出' },
  };

  const config = typeConfig[suggestion.type as keyof typeof typeConfig];
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
            <span className="font-semibold">{suggestion.confidence}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-foreground/50">风险:</span>
            <Chip size="sm" color={riskColors[suggestion.risk as keyof typeof riskColors] as any} variant="flat">
              {suggestion.risk === 'low' ? '低' : suggestion.risk === 'medium' ? '中' : '高'}
            </Chip>
          </div>
        </div>
      </CardBody>
    </Card>
  );
});

// 主页面组件
const DecisionCenterPage = observer(() => {
  const [selectedTab, setSelectedTab] = useState('suggestions');
  const [query, setQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!query.trim()) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);

    // 模拟 AI 分析
    await new Promise(resolve => setTimeout(resolve, 2000));
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
    `);
    setIsAnalyzing(false);
  };

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
              </div>
            }
          />
        </Tabs>

        {/* AI 建议 */}
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
              {aiSuggestions.map(suggestion => (
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

        {/* 智能问答 */}
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
                    <pre className="whitespace-pre-wrap text-sm text-foreground/80 font-sans">
                      {analysisResult}
                    </pre>
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

        {/* 研报解读 */}
        {selectedTab === 'reports' && (
          <Card className="bg-content1/50 backdrop-blur-sm">
            <CardBody className="p-8 text-center">
              <Icon icon="mdi:file-document-multiple" className="text-6xl text-primary/50 mb-4 mx-auto" />
              <h3 className="text-xl font-semibold mb-2">研报解读</h3>
              <p className="text-foreground/60 mb-4">
                AI 自动解读研报功能正在开发中...
              </p>
              <Button color="primary" variant="flat">
                敬请期待
              </Button>
            </CardBody>
          </Card>
        )}
      </div>
    </GradientBackground>
  );
});

export default DecisionCenterPage;
