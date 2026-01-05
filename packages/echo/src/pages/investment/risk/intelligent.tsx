/**
 * 投资模块 - 智能风控页面
 * 
 * AI 驱动的情绪检测与风险预警
 * 整合 UnifiedAIAnalysisPanel 功能
 */

import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Chip, 
  Progress,
  Tabs,
  Tab,
  Textarea,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';
import { RiskAlertPanel, RiskDashboard } from '@/components/InvestmentRisk';

// ============ 类型定义 ============

interface EmotionMetric {
  name: string;
  value: number;
  status: 'good' | 'warning' | 'danger';
  description: string;
  icon: string;
}

interface AIAnalysisResult {
  summary: string;
  riskScore: number;
  suggestions: string[];
  emotionalState: 'calm' | 'anxious' | 'greedy' | 'fearful';
  timestamp: Date;
}

type AnalysisTab = 'emotion' | 'ai-analysis' | 'behavior';


// ============ Mock 数据 ============

const EMOTION_METRICS: EmotionMetric[] = [
  {
    name: '贪婪指数',
    value: 32,
    status: 'good',
    description: '当前情绪偏理性，适合做出投资决策',
    icon: 'mdi:emoticon-cool',
  },
  {
    name: 'FOMO 风险',
    value: 55,
    status: 'warning',
    description: '存在一定追涨冲动，建议冷静分析',
    icon: 'mdi:emoticon-excited',
  },
  {
    name: '决策质量',
    value: 78,
    status: 'good',
    description: '近期决策质量良好，继续保持',
    icon: 'mdi:brain',
  },
  {
    name: '恐惧指数',
    value: 25,
    status: 'good',
    description: '恐惧情绪较低，心态稳定',
    icon: 'mdi:emoticon-sad',
  },
];

// ============ 子组件 ============

interface EmotionCardProps {
  metric: EmotionMetric;
}

function EmotionCard({ metric }: EmotionCardProps) {
  const colorMap = {
    good: 'success',
    warning: 'warning',
    danger: 'danger',
  } as const;
  
  const bgColorMap = {
    good: 'bg-success/10 border-success/30',
    warning: 'bg-warning/10 border-warning/30',
    danger: 'bg-danger/10 border-danger/30',
  };
  
  return (
    <div className={`p-4 rounded-lg border ${bgColorMap[metric.status]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon icon={metric.icon} className={`text-xl text-${colorMap[metric.status]}`} />
        <span className="text-sm text-foreground/60">{metric.name}</span>
      </div>
      <p className={`text-2xl font-bold text-${colorMap[metric.status]}`}>{metric.value}</p>
      <Progress 
        value={metric.value} 
        color={colorMap[metric.status]} 
        size="sm" 
        className="mt-2" 
      />
      <p className="text-xs text-foreground/60 mt-2">{metric.description}</p>
    </div>
  );
}

function AIAnalysisPanel() {
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    
    setIsAnalyzing(true);
    // 模拟 AI 分析
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setResult({
      summary: '根据您的描述，当前投资决策整体合理，但需注意以下几点风险因素。',
      riskScore: 35,
      suggestions: [
        '建议分散投资，降低单一标的权重',
        '当前市场波动较大，可适当降低杠杆',
        '设置止损点位，控制最大回撤',
      ],
      emotionalState: 'calm',
      timestamp: new Date(),
    });
    setIsAnalyzing(false);
  };

  return (
    <Card className="bg-content1/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon icon="mdi:robot" className="text-xl text-secondary" />
          <h2 className="font-semibold">AI 风险分析</h2>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <Textarea
          placeholder="描述您当前的投资计划或交易想法，AI 将为您分析潜在风险..."
          value={input}
          onValueChange={setInput}
          minRows={3}
          maxRows={6}
        />
        <Button 
          color="secondary" 
          onPress={handleAnalyze}
          isLoading={isAnalyzing}
          isDisabled={!input.trim()}
          startContent={!isAnalyzing && <Icon icon="mdi:brain" />}
        >
          {isAnalyzing ? '分析中...' : '开始分析'}
        </Button>

        {result && (
          <div className="space-y-4 pt-4 border-t border-divider">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">风险评分</span>
              <Chip 
                color={result.riskScore < 40 ? 'success' : result.riskScore < 70 ? 'warning' : 'danger'}
                variant="flat"
              >
                {result.riskScore}/100
              </Chip>
            </div>
            
            <div>
              <p className="text-sm text-foreground/80">{result.summary}</p>
            </div>
            
            <div>
              <p className="text-xs text-foreground/60 mb-2">建议措施</p>
              <ul className="space-y-2">
                {result.suggestions.map((suggestion, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Icon icon="mdi:lightbulb" className="text-warning flex-shrink-0 mt-0.5" />
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="text-xs text-foreground/50 text-right">
              分析时间: {result.timestamp.toLocaleString('zh-CN')}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}


function BehaviorAnalysisPanel() {
  const behaviors = [
    { label: '交易频率', value: '正常', status: 'good', detail: '本周 3 笔交易' },
    { label: '持仓时间', value: '偏短', status: 'warning', detail: '平均持仓 2.3 天' },
    { label: '止损执行', value: '良好', status: 'good', detail: '100% 执行率' },
    { label: '追涨杀跌', value: '轻微', status: 'warning', detail: '2 次追高买入' },
  ];

  return (
    <Card className="bg-content1/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon icon="mdi:chart-bar" className="text-xl text-primary" />
          <h2 className="font-semibold">行为分析</h2>
        </div>
      </CardHeader>
      <CardBody>
        <div className="space-y-3">
          {behaviors.map((item, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-content2/50">
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-foreground/60">{item.detail}</p>
              </div>
              <Chip 
                size="sm" 
                color={item.status === 'good' ? 'success' : 'warning'}
                variant="flat"
              >
                {item.value}
              </Chip>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

// ============ 主组件 ============

const IntelligentRiskPage = observer(() => {
  const [activeTab, setActiveTab] = useState<AnalysisTab>('emotion');

  return (
    <GradientBackground className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center gap-3">
          <Link to="/investment/risk">
            <Button isIconOnly variant="light" size="sm">
              <Icon icon="mdi:arrow-left" className="text-xl" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Icon icon="mdi:brain" className="text-secondary" />
              智能风控
            </h1>
            <p className="text-foreground/60 mt-1">AI 驱动的情绪检测与风险预警</p>
          </div>
        </div>

        {/* 紧凑仪表盘 */}
        <RiskDashboard compact showDetails={false} />

        {/* Tab 导航 */}
        <Tabs 
          selectedKey={activeTab} 
          onSelectionChange={(key) => setActiveTab(key as AnalysisTab)}
          color="secondary"
          variant="underlined"
        >
          <Tab 
            key="emotion" 
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:emoticon" />
                <span>情绪检测</span>
              </div>
            }
          />
          <Tab 
            key="ai-analysis" 
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:robot" />
                <span>AI 分析</span>
              </div>
            }
          />
          <Tab 
            key="behavior" 
            title={
              <div className="flex items-center gap-2">
                <Icon icon="mdi:chart-bar" />
                <span>行为分析</span>
              </div>
            }
          />
        </Tabs>

        {/* Tab 内容 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {activeTab === 'emotion' && (
              <Card className="bg-content1/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon icon="mdi:emoticon-outline" className="text-xl text-warning" />
                    <h2 className="font-semibold">交易情绪检测</h2>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {EMOTION_METRICS.map((metric, i) => (
                      <EmotionCard key={i} metric={metric} />
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}
            {activeTab === 'ai-analysis' && <AIAnalysisPanel />}
            {activeTab === 'behavior' && <BehaviorAnalysisPanel />}
          </div>

          {/* 右侧预警面板 */}
          <div className="lg:col-span-1">
            <RiskAlertPanel maxAlerts={5} showEmotionalAlerts />
          </div>
        </div>
      </div>
    </GradientBackground>
  );
});

export default IntelligentRiskPage;
