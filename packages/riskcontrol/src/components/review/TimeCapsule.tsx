import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Clock, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  History,
  Target,
  Award,
  XCircle,
  Lightbulb,
  Loader2
} from 'lucide-react';
import { Card, Badge, NumberDisplay, Button, Modal, Textarea } from '../ui';
import type { TimeCapsule as TimeCapsuleType, Transaction, RoundTrip, TradingStats, Position } from '../../types';
import { aiService } from '../../services/aiService';
import { saveTradeReview } from '../../services/supabase';
import { toast } from 'sonner';

// AI Weekly Review Component
interface AIWeeklyReviewProps {
    transactions: Transaction[];
    positions?: Position[];
}

export function AIWeeklyReview({ transactions, positions = [] }: AIWeeklyReviewProps) {
    const [review, setReview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
    // 单笔交易分析状态
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [singleAnalysis, setSingleAnalysis] = useState<string | null>(null);
    const [singleLoading, setSingleLoading] = useState(false);
    const [userReview, setUserReview] = useState("");
    const [isSavingReview, setIsSavingReview] = useState(false);

    const recentTx = React.useMemo(() => {
        return transactions.filter(t => {
            const txDate = new Date(t.date);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return txDate >= weekAgo && ['BUY', 'SELL', 'SHORT', 'COVER'].includes(t.action);
        });
    }, [transactions]);

    // 分析单笔交易
    const analyzeTransaction = async (tx: Transaction) => {
        setSelectedTx(tx);
        setSingleAnalysis(null);
        setSingleLoading(true);
        setUserReview("");

        try {
            // 获取当前价格和 PnL
            const position = positions.find(p => p.ticker === tx.ticker);
            const currentPrice = position?.currentPrice || 0;
            const buyPrice = tx.price || 0;
            let pnlInfo = "";
            
            if (currentPrice > 0 && buyPrice > 0) {
                const diff = currentPrice - buyPrice;
                const pnlPercent = (diff / buyPrice) * 100;
                pnlInfo = `
当前价格: ${currentPrice.toFixed(2)}
买入价格: ${buyPrice.toFixed(2)}
价差: ${diff.toFixed(2)}
盈亏幅度: ${pnlPercent.toFixed(2)}%
                `;
            }

            const prompt = `
请作为一名严格的投资风控官，对我的一笔具体交易进行深度复盘分析。

交易详情：
- 标的: ${tx.ticker} (${tx.name})
- 操作: ${tx.action}
- 价格: ${tx.price}
- 数量: ${tx.quantity}
- 时间: ${tx.date}
- 策略备注: ${tx.strategyNote || '无'}
${pnlInfo}

请结合【知识库】中的投资原则，判断这笔操作是否正确。

请严格按照以下 **Markdown** 格式输出：

### 结论
**[正确买入 / 错误买入 / 正确卖出 / 错误卖出]** (请四选一，并加粗)

### 原因分析
(请列出 2-3 点具体原因)

### 盈亏分析
(基于当前价格的分析)

### 改进建议
(一句话建议)

### 复盘问题
(请提出 3 个针对性的复盘问题，引导用户思考，以 "1. " 格式列表输出)
            `;

            let fullResponse = '';
            await aiService.sendMessage(
                [{ id: Date.now(), role: 'user', content: prompt, conversationId: 0, createdAt: new Date().toISOString() }],
                (chunk) => { fullResponse += chunk; setSingleAnalysis(fullResponse); },
                () => setSingleLoading(false)
            );

        } catch (e) {
            setSingleAnalysis("分析失败，请稍后重试。");
            setSingleLoading(false);
        }
    };

    // 保存复盘并更新知识库
    const handleSaveReview = async () => {
        if (!selectedTx || !singleAnalysis) return;
        
        setIsSavingReview(true);
        
        try {
            // 1. 保存复盘记录
            const { success } = await saveTradeReview({
                transaction_id: selectedTx.id,
                ai_analysis: singleAnalysis,
                user_review: userReview,
                is_completed: true,
            });
            
            if (!success) {
                toast.error('保存失败，请重试');
                setIsSavingReview(false);
                return;
            }
            
            // 2. 如果用户写了复盘笔记，提取教训并更新知识库
            if (userReview.trim().length > 20) {
                try {
                    // 从 AI 分析中提取结论
                    const conclusionMatch = singleAnalysis.match(/### 结论\s*\n\*\*([^*]+)\*\*/);
                    const conclusion = conclusionMatch ? conclusionMatch[1].trim() : '';
                    
                    // 如果是错误交易，自动生成教训笔记
                    if (conclusion.includes('错误')) {
                        const lessonNote = {
                            title: `交易教训: ${selectedTx.ticker} ${selectedTx.action} (${new Date(selectedTx.date).toLocaleDateString()})`,
                            content: `## AI 分析结论\n${conclusion}\n\n## 我的反思\n${userReview}\n\n## 改进承诺\n下次遇到类似情况，我会...`,
                            source_type: 'principle' as const,
                            related_ticker: selectedTx.ticker,
                            tags: ['交易复盘', '教训', selectedTx.action === 'BUY' ? '买入错误' : '卖出错误'],
                        };
                        
                        // 保存到知识库（使用 Supabase）
                        const { getClient } = await import('../../services/supabaseData');
                        const supabase = getClient();
                        if (supabase) {
                            await supabase.from('dynamic_notes').insert({
                                user_id: 1,
                                ...lessonNote,
                                tags: lessonNote.tags.join(','),
                            });
                            toast.success('教训已自动归档到知识库');
                        }
                    }
                } catch (e) {
                    console.warn('知识库更新失败，但复盘已保存:', e);
                }
            }
            
            toast.success('复盘记录已保存');
            setSelectedTx(null); // 关闭弹窗
        } catch (error) {
            console.error('Save review error:', error);
            toast.error('保存失败，请重试');
        } finally {
            setIsSavingReview(false);
        }
    };

    const handleReview = async () => {
        setLoading(true);
        try {
            if (recentTx.length === 0) {
                setReview("过去一周暂无有效交易记录，无需复盘。");
                setLoading(false);
                return;
            }

            const prompt = `
请作为一名严格的投资风控官，对我过去一周的交易进行复盘。
请结合我的【知识库】中的投资原则（如：趋势价值投资、不追涨杀跌、止损纪律等）进行点评。

交易记录如下：
${recentTx.map(t => `- ${t.date} ${t.action} ${t.ticker}: ${t.quantity}股 @ ${t.price} (备注: ${t.strategyNote || '无'})`).join('\n')}

请使用 **Markdown** 格式输出，并严格遵循以下排版规则：
1. **标题清晰**：使用 ### 三级标题区分【交易行为点评】、【潜在风险警示】、【下周改进建议】。
2. **重点突出**：关键结论、风险点或建议必须使用 **加粗**（如：**追涨杀跌**）。
3. **列表清晰**：使用无序列表列出具体要点。

请输出：
1. 交易行为点评（是否符合策略？）
2. 潜在风险警示
3. 下周改进建议
            `;

            let fullResponse = '';
            await aiService.sendMessage(
                [{ id: Date.now(), role: 'user', content: prompt, conversationId: 0, createdAt: new Date().toISOString() }],
                (chunk) => { fullResponse += chunk; setReview(fullResponse); },
                () => setLoading(false)
            );
        } catch (e) {
            setReview("复盘生成失败，请稍后重试。");
            setLoading(false);
        }
    };

    return (
        <Card className="mt-6 bg-gradient-to-br from-bg-secondary to-bg-tertiary border-accent-purple/20">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Lightbulb size={18} className="text-accent-purple" />
                    <span className="font-bold text-text-primary">AI 智能周复盘</span>
                </div>
                <Button size="sm" variant="secondary" onClick={handleReview} disabled={loading}>
                    {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Clock size={14} className="mr-1" />}
                    {review ? '重新复盘' : '开始复盘'}
                </Button>
            </div>

            {/* 显示最近一周的交易记录 */}
            {recentTx.length > 0 && !review && (
                <div className="mb-4 space-y-2">
                    <div className="text-xs text-text-muted mb-2">本周交易记录 ({recentTx.length}) - 点击进行单笔分析</div>
                    {recentTx.map(t => (
                        <div 
                            key={t.id} 
                            className="flex items-center justify-between p-2 bg-bg-tertiary/50 rounded border border-border/50 text-sm hover:bg-bg-tertiary cursor-pointer transition-colors group"
                            onClick={() => analyzeTransaction(t)}
                        >
                            <div className="flex items-center gap-2">
                                <span className={`font-mono font-medium ${t.action === 'BUY' ? 'text-accent-green' : 'text-accent-red'}`}>
                                    {t.action}
                                </span>
                                <span className="font-bold text-text-primary">{t.ticker}</span>
                                <span className="text-text-muted text-xs">{new Date(t.date).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <span className="mono-nums text-text-primary">{t.quantity} @ {t.price?.toFixed(2)}</span>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Badge variant="info" className="text-[10px] h-5">AI 分析</Badge>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {review ? (
                <div className="bg-bg-primary/50 p-4 rounded-lg border border-border/50 text-sm overflow-hidden">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h3: ({node, ...props}) => <h3 className="text-base font-bold text-accent-cyan mt-4 mb-2 flex items-center gap-2" {...props} />,
                            strong: ({node, ...props}) => <strong className="text-accent-yellow font-bold" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-1 text-text-secondary" {...props} />,
                            li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                            p: ({node, ...props}) => <p className="mb-2 text-text-primary leading-relaxed" {...props} />,
                        }}
                    >
                        {review}
                    </ReactMarkdown>
                </div>
            ) : (
                <div className="text-center py-6 text-text-muted text-sm">
                    点击按钮，让 AI 基于你的交易原则检查本周操作。
                </div>
            )}

            {/* 单笔交易分析详情弹窗 */}
            <Modal
                isOpen={!!selectedTx}
                onClose={() => setSelectedTx(null)}
                title={`交易深度复盘: ${selectedTx?.ticker}`}
                size="lg"
            >
                {selectedTx && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[80vh]">
                        {/* 左侧：AI 分析 */}
                        <div className="flex flex-col gap-4 overflow-y-auto pr-2">
                            {/* 交易详情 Header */}
                            <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border/50">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={selectedTx.action === 'BUY' ? 'success' : 'danger'}>{selectedTx.action}</Badge>
                                        <span className="font-bold text-lg text-text-primary">{selectedTx.ticker}</span>
                                    </div>
                                    <div className="text-xs text-text-muted mt-1">{new Date(selectedTx.date).toLocaleString()}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-mono text-text-primary">
                                        {selectedTx.quantity} @ {selectedTx.price?.toFixed(2)}
                                    </div>
                                    <div className="text-xs text-text-secondary">
                                        总额: ¥{selectedTx.amountCNY?.toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {/* AI 分析内容 */}
                            {singleLoading ? (
                                <div className="flex flex-col items-center justify-center py-8 space-y-3 flex-1">
                                    <Loader2 size={24} className="animate-spin text-accent-cyan" />
                                    <p className="text-sm text-text-muted">AI 正在深度分析这笔交易...</p>
                                </div>
                            ) : singleAnalysis ? (
                                 <div className="bg-bg-primary/50 p-4 rounded-lg border border-border/50 text-sm flex-1">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            h3: ({node, ...props}) => <h3 className="text-base font-bold text-accent-cyan mt-4 mb-2 flex items-center gap-2" {...props} />,
                                            strong: ({node, ...props}) => <strong className="text-accent-yellow font-bold" {...props} />,
                                            ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-1 text-text-secondary" {...props} />,
                                            li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                                            p: ({node, ...props}) => <p className="mb-2 text-text-primary leading-relaxed" {...props} />,
                                        }}
                                    >
                                        {singleAnalysis}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-text-muted flex-1">
                                    分析准备就绪
                                </div>
                            )}
                        </div>

                        {/* 右侧：用户复盘 */}
                        <div className="flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-border/50 pt-4 lg:pt-0 lg:pl-6">
                            <div>
                                <h3 className="text-base font-bold text-text-primary mb-2 flex items-center gap-2">
                                    <Target size={16} className="text-accent-purple" />
                                    我的复盘笔记
                                </h3>
                                <p className="text-xs text-text-muted mb-4">
                                    参考 AI 提出的问题，记录当时的心态和反思。
                                </p>
                            </div>

                            <Textarea
                                placeholder="当时为什么这么做？现在回头看有什么可以改进的？..."
                                className="flex-1 min-h-[200px] bg-bg-tertiary/50 border-border/50 resize-none focus:ring-accent-purple/50"
                                value={userReview}
                                onChange={(e) => setUserReview(e.target.value)}
                            />

                            <div className="flex justify-end gap-3 mt-auto pt-4">
                                <Button variant="ghost" onClick={() => setSelectedTx(null)}>
                                    稍后复盘
                                </Button>
                                <Button 
                                    variant="primary" 
                                    onClick={handleSaveReview} 
                                    disabled={isSavingReview || !userReview.trim() || singleLoading}
                                    className="bg-accent-purple hover:bg-accent-purple/90 text-white"
                                >
                                    {isSavingReview ? <Loader2 size={14} className="animate-spin mr-2" /> : <CheckCircle size={14} className="mr-2" />}
                                    完成复盘并归档
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </Card>
    );
}

// TimeCapsule export removed as per refactoring plan.
// The "Time Capsule" monthly review feature has been deprecated in favor of AI Weekly Review.


// 交易统计组件
interface TradingStatsCardProps {
  stats: TradingStats | null;
  hideAbsoluteValues?: boolean;
}

export function TradingStatsCard({ stats, hideAbsoluteValues = false }: TradingStatsCardProps) {
  if (!stats) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Award size={16} className="text-accent-cyan" />
          <span className="text-xs text-text-secondary uppercase tracking-wider">交易统计</span>
        </div>
        <div className="text-sm text-text-muted">暂无数据</div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Award size={16} className="text-accent-cyan" />
        <span className="text-xs text-text-secondary uppercase tracking-wider">交易统计</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-bg-tertiary rounded-lg">
          <div className="text-xs text-text-muted">总交易次数</div>
          <div className="text-2xl font-bold text-text-primary mono-nums">
            {stats.totalTrades}
          </div>
        </div>

        <div className="p-3 bg-bg-tertiary rounded-lg">
          <div className="text-xs text-text-muted">胜率</div>
          <div className={`text-2xl font-bold mono-nums ${stats.winRate >= 50 ? 'text-accent-green' : 'text-accent-red'}`}>
            {stats.winRate.toFixed(1)}%
          </div>
        </div>

        <div className="p-3 bg-bg-tertiary rounded-lg">
          <div className="text-xs text-text-muted">盈亏比</div>
          <div className={`text-2xl font-bold mono-nums ${stats.profitFactor >= 1 ? 'text-accent-green' : 'text-accent-red'}`}>
            {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
          </div>
        </div>

        <div className="p-3 bg-bg-tertiary rounded-lg">
          <div className="text-xs text-text-muted">已实现盈亏</div>
          {hideAbsoluteValues ? (
             <div className="text-2xl font-bold text-text-primary mono-nums">***</div>
          ) : (
            <NumberDisplay 
              value={stats.totalRealizedPnL} 
              prefix="¥" 
              decimals={0}
              size="lg"
            />
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-muted">盈利交易</span>
            <span className="text-accent-green mono-nums">{stats.winningTrades}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">亏损交易</span>
            <span className="text-accent-red mono-nums">{stats.losingTrades}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">平均盈利</span>
            {hideAbsoluteValues ? (
               <span className="mono-nums">***</span>
            ) : (
               <NumberDisplay value={stats.avgWin} prefix="¥" decimals={0} size="sm" />
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">平均亏损</span>
            {hideAbsoluteValues ? (
               <span className="mono-nums">***</span>
            ) : (
               <NumberDisplay value={-stats.avgLoss} prefix="¥" decimals={0} size="sm" />
            )}
          </div>
        </div>
      </div>

      {/* 最大盈利/亏损交易 */}
      {(stats.maxWin || stats.maxLoss) && !hideAbsoluteValues && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          {stats.maxWin && (
            <div className="flex items-center justify-between p-2 bg-accent-green/10 rounded">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-accent-green" />
                <span className="text-xs text-text-secondary">最大盈利</span>
                <span className="text-sm text-text-primary">{stats.maxWin.ticker}</span>
              </div>
              <NumberDisplay value={stats.maxWin.realizedPnL} prefix="¥" decimals={0} size="sm" />
            </div>
          )}
          {stats.maxLoss && (
            <div className="flex items-center justify-between p-2 bg-accent-red/10 rounded">
              <div className="flex items-center gap-2">
                <XCircle size={14} className="text-accent-red" />
                <span className="text-xs text-text-secondary">最大亏损</span>
                <span className="text-sm text-text-primary">{stats.maxLoss.ticker}</span>
              </div>
              <NumberDisplay value={stats.maxLoss.realizedPnL} prefix="¥" decimals={0} size="sm" />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// 交易历史列表
interface TransactionHistoryProps {
  transactions: Transaction[];
  onDelete?: (id: string) => void;
}

export function TransactionHistory({ transactions, onDelete }: TransactionHistoryProps) {
  const [filter, setFilter] = useState<'all' | 'trade' | 'cash'>('all');

  // 调试：检查交易记录数据
  React.useEffect(() => {
    console.log('[TransactionHistory] 交易记录数量:', transactions.length);
    if (transactions.length > 0) {
      console.log('[TransactionHistory] 前3条交易记录:', transactions.slice(0, 3).map(t => ({
        id: t.id,
        ticker: t.ticker,
        action: t.action,
        date: t.date,
        price: t.price,
        quantity: t.quantity,
      })));
    }
  }, [transactions]);

  const filteredTransactions = transactions.filter(t => {
    if (filter === 'trade') {
      return ['BUY', 'SELL', 'SHORT', 'COVER'].includes(t.action);
    }
    if (filter === 'cash') {
      return ['DEPOSIT', 'WITHDRAW', 'SYNC_BALANCE'].includes(t.action);
    }
    return true;
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'text-accent-green';
      case 'SELL': return 'text-accent-red';
      case 'SHORT': return 'text-accent-red';
      case 'COVER': return 'text-accent-green';
      case 'DEPOSIT': return 'text-accent-blue';
      case 'WITHDRAW': return 'text-accent-yellow';
      default: return 'text-text-secondary';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'BUY':
      case 'COVER':
      case 'DEPOSIT':
        return <TrendingUp size={14} />;
      case 'SELL':
      case 'SHORT':
      case 'WITHDRAW':
        return <TrendingDown size={14} />;
      default:
        return <Target size={14} />;
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History size={16} className="text-accent-blue" />
          <span className="text-xs text-text-secondary uppercase tracking-wider">交易历史</span>
          <Badge variant="info">{transactions.length}</Badge>
          <span className="text-xs text-text-muted">(过滤后: {filteredTransactions.length})</span>
        </div>
        
        <div className="flex gap-1">
          {(['all', 'trade', 'cash'] as const).map(f => (
            <button
              key={f}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                filter === f 
                  ? 'bg-accent-cyan text-bg-primary' 
                  : 'text-text-muted hover:text-text-primary'
              }`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '全部' : f === 'trade' ? '交易' : '资金'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredTransactions.length > 0 ? filteredTransactions.slice(0, 50).map(txn => (
          <div
            key={txn.id}
            className="p-3 bg-bg-tertiary rounded-lg hover:bg-bg-tertiary/80 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-bg-secondary ${getActionColor(txn.action)}`}>
                  {getActionIcon(txn.action)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{txn.ticker}</span>
                    <Badge variant={txn.isPlanned ? 'success' : 'warning'}>
                      {txn.action}
                    </Badge>
                    {!txn.isPlanned && txn.action !== 'DEPOSIT' && txn.action !== 'WITHDRAW' && (
                      <Badge variant="danger">非计划</Badge>
                    )}
                  </div>
                  <div className="text-xs text-text-muted">
                    {new Date(txn.date).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>

              <div className="text-right">
                {['BUY', 'SELL', 'SHORT', 'COVER'].includes(txn.action) ? (
                  <>
                    <div className="text-sm text-text-primary mono-nums">
                      {(txn.price && txn.price > 0 ? txn.price.toFixed(2) : 'N/A')} × {txn.quantity || 0}
                    </div>
                    <div className="text-xs text-text-muted mono-nums">
                      ¥{(txn.amountCNY || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                    </div>
                  </>
                ) : (
                  <div className={`text-lg font-bold mono-nums ${txn.action === 'DEPOSIT' ? 'text-accent-green' : 'text-accent-red'}`}>
                    {txn.action === 'DEPOSIT' ? '+' : '-'}¥{(txn.amount || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                  </div>
                )}
              </div>
            </div>

            {txn.strategyNote && (
              <div className="mt-2 text-xs text-text-secondary line-clamp-1">
                {txn.strategyNote}
              </div>
            )}
          </div>
        )) : (
          <div className="text-center py-8 text-text-muted">
            <History size={40} className="mx-auto mb-3 opacity-30" />
            <p>暂无交易记录</p>
            {transactions.length === 0 && (
              <p className="text-xs mt-2">请检查数据源或同步 IBKR 数据</p>
            )}
            {transactions.length > 0 && filteredTransactions.length === 0 && (
              <p className="text-xs mt-2">当前筛选条件下没有匹配的交易记录</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
