/**
 * 学习追踪页面
 */

import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  addLearningRecord,
  getLearningRecords,
  getLearningStats,
  extractKeyPoints,
  generateLearningReport,
  type LearningCategory,
  type LearningRecord,
  type LearningStats,
} from '../services/learning';
import {
  BookOpen, Brain, DollarSign, Code, Globe,
  Plus, Clock, Flame, Loader2, FileText,
} from 'lucide-react';

// 学习类别选项
const CATEGORIES: { type: LearningCategory; label: string; icon: typeof Brain }[] = [
  { type: 'ai', label: 'AI', icon: Brain },
  { type: 'investment', label: '投资', icon: DollarSign },
  { type: 'english', label: '英语', icon: Globe },
  { type: 'programming', label: '编程', icon: Code },
  { type: 'other', label: '其他', icon: BookOpen },
];

export default function LearningPage() {
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  // 表单状态
  const [category, setCategory] = useState<LearningCategory>('ai');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [duration, setDuration] = useState(30);
  const [source, setSource] = useState('');

  // 加载数据
  useEffect(() => {
    setRecords(getLearningRecords(undefined, 20));
    setStats(getLearningStats());
  }, []);

  // 添加记录
  const handleAdd = async () => {
    if (!title) return;

    setLoading(true);
    try {
      // 提取要点
      let keyPoints: string[] = [];
      if (content) {
        const result = await extractKeyPoints(content);
        if (result.success && result.data) {
          keyPoints = result.data;
        }
      }

      addLearningRecord(category, title, content, duration, source || undefined, keyPoints);
      setRecords(getLearningRecords(undefined, 20));
      setStats(getLearningStats());

      // 重置表单
      setTitle('');
      setContent('');
      setDuration(30);
      setSource('');
      setShowAdd(false);
    } finally {
      setLoading(false);
    }
  };

  // 生成报告
  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const result = await generateLearningReport(7);
      if (result.success && result.data) {
        setReport(result.data);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">学习追踪</h1>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" />
          记录
        </Button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">总时长</span>
              </div>
              <p className="text-lg font-semibold mt-1">{stats.totalHours}h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">连续</span>
              </div>
              <p className="text-lg font-semibold mt-1">{stats.streak}天</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">记录</span>
              </div>
              <p className="text-lg font-semibold mt-1">{records.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 添加记录表单 */}
      {showAdd && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">添加学习记录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 类别选择 */}
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setCategory(type)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-colors ${
                    category === type
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm">{label}</span>
                </button>
              ))}
            </div>

            <Input
              placeholder="学习主题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <Textarea
              placeholder="学习内容/笔记（可选，AI 会自动提取要点）"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
            />

            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="时长（分钟）"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-32"
              />
              <Input
                placeholder="来源（可选）"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="flex-1"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={!title || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存'}
              </Button>
              <Button variant="outline" onClick={() => setShowAdd(false)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 学习报告 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              学习报告
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateReport}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '生成'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {report ? (
            <div className="text-sm whitespace-pre-wrap">{report}</div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              点击生成查看学习报告
            </p>
          )}
        </CardContent>
      </Card>

      {/* 学习记录列表 */}
      {records.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">最近学习</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {records.map((record) => {
                const categoryInfo = CATEGORIES.find(c => c.type === record.category);
                const Icon = categoryInfo?.icon || BookOpen;
                return (
                  <div
                    key={record.id}
                    className="border-b last:border-0 pb-3 last:pb-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{record.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {record.duration}分钟
                      </span>
                    </div>
                    {record.keyPoints.length > 0 && (
                      <div className="mt-2 pl-6">
                        {record.keyPoints.map((point, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            • {point}
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 pl-6">
                      {record.date}
                      {record.source && ` · ${record.source}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 空状态 */}
      {records.length === 0 && !showAdd && (
        <Card>
          <CardContent className="p-6 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              开始记录你的学习历程
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
