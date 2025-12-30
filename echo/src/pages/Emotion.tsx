/**
 * 情绪管理页面
 */

import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import {
  recordEmotion,
  getRecentEmotions,
  analyzeEmotionPatterns,
  getEmotionStats,
  type EmotionType,
  type EmotionRecord,
  type EmotionAnalysis,
} from '../services/emotion';
import {
  Smile, Frown, Meh, Zap, Heart, AlertTriangle,
  TrendingUp, Brain, Loader2,
} from 'lucide-react';

// 情绪选项
const EMOTIONS: { type: EmotionType; label: string; icon: typeof Smile; color: string }[] = [
  { type: 'happy', label: '开心', icon: Smile, color: 'text-yellow-500' },
  { type: 'calm', label: '平静', icon: Heart, color: 'text-blue-500' },
  { type: 'focused', label: '专注', icon: Zap, color: 'text-purple-500' },
  { type: 'excited', label: '兴奋', icon: TrendingUp, color: 'text-orange-500' },
  { type: 'anxious', label: '焦虑', icon: AlertTriangle, color: 'text-red-500' },
  { type: 'stressed', label: '压力', icon: Brain, color: 'text-red-400' },
  { type: 'frustrated', label: '沮丧', icon: Frown, color: 'text-gray-500' },
  { type: 'neutral', label: '一般', icon: Meh, color: 'text-gray-400' },
];

export default function EmotionPage() {
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionType | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [context, setContext] = useState('');
  const [records, setRecords] = useState<EmotionRecord[]>([]);
  const [analysis, setAnalysis] = useState<EmotionAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  // 加载数据
  useEffect(() => {
    setRecords(getRecentEmotions(10));
  }, []);

  // 记录情绪
  const handleRecord = () => {
    if (!selectedEmotion) return;

    recordEmotion(selectedEmotion, intensity, context);
    setRecords(getRecentEmotions(10));
    setSelectedEmotion(null);
    setIntensity(5);
    setContext('');
  };

  // 分析情绪
  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await analyzeEmotionPatterns();
      if (result.success && result.data) {
        setAnalysis(result.data);
      }
    } catch (error) {
      console.error('分析失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = getEmotionStats();

  return (
    <div className="p-4 space-y-4">
      {/* 标题 */}
      <h1 className="text-xl font-semibold">情绪管理</h1>

      {/* 记录情绪 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">记录当前情绪</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 情绪选择 */}
          <div className="grid grid-cols-4 gap-2">
            {EMOTIONS.map(({ type, label, icon: Icon, color }) => (
              <button
                key={type}
                onClick={() => setSelectedEmotion(type)}
                className={`p-2 rounded-lg border transition-colors ${
                  selectedEmotion === type
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <Icon className={`h-5 w-5 mx-auto ${color}`} />
                <span className="text-xs mt-1 block">{label}</span>
              </button>
            ))}
          </div>

          {/* 强度滑块 */}
          {selectedEmotion && (
            <div>
              <label className="text-xs text-muted-foreground">
                强度: {intensity}/10
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>
          )}

          {/* 上下文 */}
          {selectedEmotion && (
            <Textarea
              placeholder="发生了什么？（可选）"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={2}
            />
          )}

          {/* 记录按钮 */}
          {selectedEmotion && (
            <Button onClick={handleRecord} className="w-full">
              记录
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 情绪分析 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">情绪分析</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                '分析'
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {analysis ? (
            <div className="space-y-3">
              {/* 主要情绪 */}
              <div>
                <span className="text-xs text-muted-foreground">主要情绪</span>
                <p className="font-medium">
                  {EMOTIONS.find(e => e.type === analysis.dominantEmotion)?.label || analysis.dominantEmotion}
                </p>
              </div>

              {/* 警告 */}
              {analysis.fomoDetected && (
                <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-600 text-sm">
                  ⚠️ 检测到 FOMO 情绪，注意理性决策
                </div>
              )}
              {analysis.tradingEmotionAlert && (
                <div className="p-2 bg-red-500/10 rounded-lg text-red-600 text-sm">
                  ⚠️ 当前情绪不适合做投资决策
                </div>
              )}

              {/* 模式 */}
              {analysis.patterns.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">发现的模式</span>
                  <ul className="text-sm mt-1 space-y-1">
                    {analysis.patterns.map((p, i) => (
                      <li key={i}>• {p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 建议 */}
              {analysis.suggestions.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">建议</span>
                  <ul className="text-sm mt-1 space-y-1">
                    {analysis.suggestions.map((s, i) => (
                      <li key={i}>💡 {s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              记录一些情绪后点击分析
            </p>
          )}
        </CardContent>
      </Card>

      {/* 最近记录 */}
      {records.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              最近记录 ({stats.total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {records.map((record) => {
                const emotionInfo = EMOTIONS.find(e => e.type === record.emotion);
                const Icon = emotionInfo?.icon || Meh;
                return (
                  <div
                    key={record.id}
                    className="flex items-center gap-3 py-2 border-b last:border-0"
                  >
                    <Icon className={`h-5 w-5 ${emotionInfo?.color}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {emotionInfo?.label} ({record.intensity}/10)
                      </p>
                      {record.context && (
                        <p className="text-xs text-muted-foreground truncate">
                          {record.context}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(record.createdAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
