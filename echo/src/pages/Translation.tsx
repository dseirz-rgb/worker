/**
 * 翻译页面
 * 深度参考 Pot (pot-app/pot-desktop) 的设计
 * 
 * 功能：
 * - 截图翻译（OCR + 翻译）
 * - 划词翻译
 * - 输入翻译
 * - 翻译历史
 * - 生词本集成
 * - 多引擎支持
 */

import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  captureAndTranslate,
  translateText,
  getTranslationHistory,
  clearTranslationHistory,
  saveToVocabulary,
  getVocabularyList,
  SUPPORTED_LANGUAGES,
  type TranslationResult,
  type TranslationHistoryItem,
  type VocabularyItem,
} from '../services/translation';
import { 
  Camera, 
  Loader2, 
  Languages, 
  History, 
  BookOpen,
  Trash2,
  Plus,
  ArrowRightLeft,
  Volume2,
  Copy,
  Check,
  Star,
  Settings,
  Keyboard,
} from 'lucide-react';

export default function TranslationPage() {
  // 状态
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('zh-CN');
  const [history, setHistory] = useState<TranslationHistoryItem[]>([]);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('translate');

  // 加载历史和生词本
  useEffect(() => {
    setHistory(getTranslationHistory());
    setVocabulary(getVocabularyList());
  }, []);

  // 截图翻译
  const handleCaptureTranslate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await captureAndTranslate(targetLang);
      if (result.success && result.data) {
        setTranslationResult(result.data);
        setInputText(result.data.originalText);
        refreshHistory();
      } else {
        setError(result.error || '截图翻译失败');
      }
    } catch (err) {
      setError('截图翻译失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 文本翻译
  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await translateText(inputText, targetLang, sourceLang === 'auto' ? undefined : sourceLang);
      if (result.success && result.data) {
        setTranslationResult(result.data);
        refreshHistory();
      } else {
        setError(result.error || '翻译失败');
      }
    } catch (err) {
      setError('翻译失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 刷新历史
  const refreshHistory = () => {
    setHistory(getTranslationHistory());
  };

  // 清空历史
  const handleClearHistory = () => {
    clearTranslationHistory();
    setHistory([]);
  };

  // 添加到生词本
  const handleAddToVocabulary = (word: string, translation: string) => {
    saveToVocabulary(word, translation);
    setVocabulary(getVocabularyList());
  };

  // 复制译文
  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 交换语言
  const handleSwapLanguages = () => {
    if (sourceLang !== 'auto') {
      const temp = sourceLang;
      setSourceLang(targetLang);
      setTargetLang(temp);
    }
  };

  // 从历史恢复
  const handleRestoreFromHistory = (item: TranslationHistoryItem) => {
    setInputText(item.originalText);
    setTranslationResult({
      originalText: item.originalText,
      translatedText: item.translatedText,
      sourceLang: item.sourceLang,
      targetLang: item.targetLang,
    });
    setActiveTab('translate');
  };

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Languages className="h-5 w-5" />
          翻译
        </h1>
        <Button variant="ghost" size="icon" title="快捷键设置">
          <Keyboard className="h-4 w-4" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="translate" className="gap-1">
            <Languages className="h-4 w-4" />
            翻译
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <History className="h-4 w-4" />
            历史
          </TabsTrigger>
          <TabsTrigger value="vocabulary" className="gap-1">
            <BookOpen className="h-4 w-4" />
            生词本
          </TabsTrigger>
        </TabsList>

        {/* 翻译标签页 */}
        <TabsContent value="translate" className="space-y-4">
          {/* 快捷操作 */}
          <div className="flex gap-2">
            <Button 
              onClick={handleCaptureTranslate} 
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              截图翻译
            </Button>
            <Button variant="outline" disabled title="划词翻译（全局快捷键）">
              <Settings className="h-4 w-4 mr-2" />
              划词翻译
            </Button>
          </div>

          {/* 语言选择 */}
          <div className="flex items-center gap-2">
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="flex-1 h-9 px-3 rounded-md border bg-background text-sm"
            >
              <option value="auto">自动检测</option>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleSwapLanguages}
              disabled={sourceLang === 'auto'}
            >
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
            
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="flex-1 h-9 px-3 rounded-md border bg-background text-sm"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* 输入区域 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                原文
                {translationResult?.sourceLang && (
                  <Badge variant="secondary" className="text-xs">
                    {SUPPORTED_LANGUAGES.find(l => l.code === translationResult.sourceLang)?.name || translationResult.sourceLang}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="输入要翻译的文本..."
                className="min-h-[120px] resize-none"
              />
              <div className="flex justify-between mt-2">
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="朗读">
                    <Volume2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8" 
                    title="复制"
                    onClick={() => handleCopy(inputText)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button 
                  onClick={handleTranslate}
                  disabled={loading || !inputText.trim()}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Languages className="h-4 w-4 mr-2" />
                  )}
                  翻译
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 错误提示 */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* 翻译结果 */}
          {translationResult && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  译文
                  <Badge variant="secondary" className="text-xs">
                    {SUPPORTED_LANGUAGES.find(l => l.code === translationResult.targetLang)?.name || translationResult.targetLang}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{translationResult.translatedText}</p>
                <div className="flex justify-between mt-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="朗读">
                      <Volume2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8" 
                      title={copied ? "已复制" : "复制"}
                      onClick={() => handleCopy(translationResult.translatedText)}
                    >
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleAddToVocabulary(
                      translationResult.originalText, 
                      translationResult.translatedText
                    )}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    加入生词本
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 历史标签页 */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              共 {history.length} 条翻译记录
            </p>
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                <Trash2 className="h-4 w-4 mr-1" />
                清空
              </Button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>暂无翻译历史</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <Card 
                  key={item.id} 
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleRestoreFromHistory(item)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-1">{item.originalText}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                          → {item.translatedText}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-xs">
                          {item.sourceLang} → {item.targetLang}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.timestamp).toLocaleString('zh-CN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 生词本标签页 */}
        <TabsContent value="vocabulary" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              共 {vocabulary.length} 个生词
            </p>
            <Button variant="outline" size="sm" title="导出到 DejaVocab">
              导出
            </Button>
          </div>

          {vocabulary.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>生词本为空</p>
              <p className="text-xs mt-1">翻译时点击"加入生词本"添加</p>
            </div>
          ) : (
            <div className="space-y-2">
              {vocabulary.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{item.word}</p>
                          {item.mastered && (
                            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{item.translation}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          复习 {item.reviewCount} 次
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 快捷键提示 */}
      <div className="text-xs text-muted-foreground text-center space-x-4">
        <span><kbd className="px-1 py-0.5 bg-muted rounded">⌘</kbd> + <kbd className="px-1 py-0.5 bg-muted rounded">Shift</kbd> + <kbd className="px-1 py-0.5 bg-muted rounded">S</kbd> 截图翻译</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded">⌘</kbd> + <kbd className="px-1 py-0.5 bg-muted rounded">Shift</kbd> + <kbd className="px-1 py-0.5 bg-muted rounded">D</kbd> 划词翻译</span>
      </div>
    </div>
  );
}
