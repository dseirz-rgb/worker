/**
 * 翻译弹窗组件
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { translateText, type TranslationResult } from '../../services/translation';
import { Languages, Copy, Check, Loader2, ArrowRightLeft } from 'lucide-react';

interface TranslationPopupProps {
  initialText?: string;
  onClose?: () => void;
}

export function TranslationPopup({ initialText = '', onClose }: TranslationPopupProps) {
  const [inputText, setInputText] = useState(initialText);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [targetLang, setTargetLang] = useState<'zh-CN' | 'en'>('zh-CN');

  // 翻译
  const handleTranslate = async () => {
    if (!inputText.trim()) return;

    setLoading(true);
    try {
      const res = await translateText(inputText, targetLang);
      if (res.success && res.data) {
        setResult(res.data);
      }
    } catch (error) {
      console.error('翻译失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 复制结果
  const handleCopy = async () => {
    if (!result?.translatedText) return;
    await navigator.clipboard.writeText(result.translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 切换语言
  const toggleLanguage = () => {
    setTargetLang((prev) => (prev === 'zh-CN' ? 'en' : 'zh-CN'));
    // 如果有结果，交换输入和输出
    if (result) {
      setInputText(result.translatedText);
      setResult(null);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Languages className="h-4 w-4" />
            翻译
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 输入区域 */}
        <Textarea
          placeholder="输入要翻译的文本..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows={3}
          className="resize-none"
        />

        {/* 语言切换和翻译按钮 */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="text-xs"
          >
            {targetLang === 'zh-CN' ? '英 → 中' : '中 → 英'}
            <ArrowRightLeft className="h-3 w-3 ml-1" />
          </Button>
          <Button
            size="sm"
            onClick={handleTranslate}
            disabled={loading || !inputText.trim()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              '翻译'
            )}
          </Button>
        </div>

        {/* 结果区域 */}
        {result && (
          <div className="relative">
            <div className="p-3 bg-secondary rounded-lg min-h-[60px]">
              <p className="text-sm whitespace-pre-wrap pr-8">
                {result.translatedText}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
