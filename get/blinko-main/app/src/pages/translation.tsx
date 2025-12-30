/**
 * 翻译页面 - Echo on Blinko 扩展
 * 
 * 提供截图翻译、文本翻译和翻译历史功能
 */

import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { 
  Button, 
  Textarea, 
  Select, 
  SelectItem,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Spinner,
  Chip,
  Tooltip
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { ScrollArea } from '@/components/Common/ScrollArea';
import { api } from '@/lib/trpc';
import { captureScreen } from '@/lib/screenshot';
import { isDesktop } from '@/lib/tauriHelper';
import dayjs from 'dayjs';

// 支持的语言列表
const LANGUAGES = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'ru', name: 'Русский' },
  { code: 'pt', name: 'Português' },
];

interface TranslationHistoryItem {
  id: number;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  sourceType: string;
  createdAt: Date;
}

const TranslationPage = observer(() => {
  const { t } = useTranslation();
  
  // 状态
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [targetLang, setTargetLang] = useState('zh-CN');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [history, setHistory] = useState<TranslationHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载翻译历史
  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const result = await api.translation.getHistory.query({ limit: 20 });
      setHistory(result.items as TranslationHistoryItem[]);
    } catch (err: any) {
      console.error('加载翻译历史失败:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // 文本翻译
  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    
    setIsTranslating(true);
    setError(null);
    
    try {
      const result = await api.translation.translate.mutate({
        text: sourceText,
        targetLanguage: targetLang as any,
      });
      setTranslatedText(result.translatedText);
      loadHistory(); // 刷新历史
    } catch (err: any) {
      setError(err.message || '翻译失败');
    } finally {
      setIsTranslating(false);
    }
  };

  // 截图翻译
  const handleScreenshotTranslate = async () => {
    if (!isDesktop()) {
      setError('截图翻译仅支持桌面端');
      return;
    }
    
    setIsCapturing(true);
    setError(null);
    
    try {
      // 使用全屏截图
      const result = await captureScreen();
      if (!result || !result.imageBase64) {
        setIsCapturing(false);
        return;
      }
      
      setIsTranslating(true);
      const translateResult = await api.translation.ocrAndTranslate.mutate({
        imageBase64: result.imageBase64,
        targetLanguage: targetLang as any,
      });
      
      setSourceText(translateResult.originalText);
      setTranslatedText(translateResult.translatedText);
      loadHistory();
    } catch (err: any) {
      setError(err.message || '截图翻译失败');
    } finally {
      setIsCapturing(false);
      setIsTranslating(false);
    }
  };

  // 复制到剪贴板
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  // 删除历史记录
  const deleteHistoryItem = async (id: number) => {
    try {
      await api.translation.deleteHistory.mutate({ id });
      setHistory(history.filter(item => item.id !== id));
    } catch (err: any) {
      console.error('删除失败:', err);
    }
  };

  // 从历史记录恢复
  const restoreFromHistory = (item: TranslationHistoryItem) => {
    setSourceText(item.sourceText);
    setTranslatedText(item.translatedText);
    setTargetLang(item.targetLang);
  };

  // 获取语言名称
  const getLangName = (code: string) => {
    return LANGUAGES.find(l => l.code === code)?.name || code;
  };

  // 获取来源类型标签
  const getSourceTypeLabel = (type: string) => {
    switch (type) {
      case 'ocr': return '截图';
      case 'selection': return '划词';
      default: return '文本';
    }
  };

  return (
    <ScrollArea className="px-4 py-4 md:px-6 md:py-6 mx-auto max-w-6xl">
      <div className="space-y-6">
        {/* 标题 */}
        <div className="flex items-center gap-2">
          <Icon icon="mdi:translate" className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold">翻译</h1>
        </div>

        {/* 翻译区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 源文本 */}
          <Card>
            <CardHeader className="flex justify-between items-center pb-2">
              <span className="text-sm text-default-500">原文</span>
              <div className="flex gap-2">
                {isDesktop() && (
                  <Tooltip content="截图翻译">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="flat"
                      onPress={handleScreenshotTranslate}
                      isLoading={isCapturing}
                    >
                      <Icon icon="mdi:camera" className="w-4 h-4" />
                    </Button>
                  </Tooltip>
                )}
                <Tooltip content="清空">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    onPress={() => { setSourceText(''); setTranslatedText(''); }}
                  >
                    <Icon icon="mdi:close" className="w-4 h-4" />
                  </Button>
                </Tooltip>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <Textarea
                placeholder="输入要翻译的文本..."
                value={sourceText}
                onValueChange={setSourceText}
                minRows={6}
                maxRows={12}
                classNames={{
                  input: 'text-base',
                }}
              />
            </CardBody>
          </Card>

          {/* 译文 */}
          <Card>
            <CardHeader className="flex justify-between items-center pb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-default-500">译文</span>
                <Select
                  size="sm"
                  selectedKeys={[targetLang]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;
                    if (value) setTargetLang(value);
                  }}
                  className="w-32"
                  aria-label="目标语言"
                >
                  {LANGUAGES.map(lang => (
                    <SelectItem key={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <Tooltip content="复制">
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  onPress={() => copyToClipboard(translatedText)}
                  isDisabled={!translatedText}
                >
                  <Icon icon="mdi:content-copy" className="w-4 h-4" />
                </Button>
              </Tooltip>
            </CardHeader>
            <CardBody className="pt-0">
              <Textarea
                placeholder="翻译结果..."
                value={translatedText}
                isReadOnly
                minRows={6}
                maxRows={12}
                classNames={{
                  input: 'text-base',
                }}
              />
            </CardBody>
          </Card>
        </div>

        {/* 翻译按钮 */}
        <div className="flex justify-center">
          <Button
            color="primary"
            size="lg"
            onPress={handleTranslate}
            isLoading={isTranslating}
            isDisabled={!sourceText.trim()}
            startContent={!isTranslating && <Icon icon="mdi:translate" className="w-5 h-5" />}
          >
            翻译
          </Button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="text-center text-danger text-sm">
            {error}
          </div>
        )}

        <Divider />

        {/* 翻译历史 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">翻译历史</h2>
            <Button
              size="sm"
              variant="flat"
              onPress={loadHistory}
              isLoading={isLoadingHistory}
              startContent={<Icon icon="mdi:refresh" className="w-4 h-4" />}
            >
              刷新
            </Button>
          </div>

          {isLoadingHistory ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center text-default-400 py-8">
              暂无翻译历史
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(item => (
                <Card key={item.id} className="hover:bg-default-50 transition-colors">
                  <CardBody className="py-3">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Chip size="sm" variant="flat" color="primary">
                            {getSourceTypeLabel(item.sourceType)}
                          </Chip>
                          <span className="text-xs text-default-400">
                            {getLangName(item.sourceLang)} → {getLangName(item.targetLang)}
                          </span>
                          <span className="text-xs text-default-400">
                            {dayjs(item.createdAt).format('MM-DD HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm text-default-600 line-clamp-2 mb-1">
                          {item.sourceText}
                        </p>
                        <p className="text-sm text-default-800 line-clamp-2">
                          {item.translatedText}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Tooltip content="恢复">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onPress={() => restoreFromHistory(item)}
                          >
                            <Icon icon="mdi:restore" className="w-4 h-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="复制译文">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onPress={() => copyToClipboard(item.translatedText)}
                          >
                            <Icon icon="mdi:content-copy" className="w-4 h-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="删除">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() => deleteHistoryItem(item.id)}
                          >
                            <Icon icon="mdi:delete" className="w-4 h-4" />
                          </Button>
                        </Tooltip>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
});

export default TranslationPage;
