/**
 * Janitor 面板组件
 * 显示 AI 文件整理功能
 */

import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Icon } from '@/components/Common/Iconify/icons';
import { 
  Button, 
  Card, 
  CardBody, 
  CardHeader,
  Input,
  Divider,
  Chip,
  Progress,
  Checkbox,
  ScrollShadow,
} from '@heroui/react';
import { api } from '@/lib/trpc';
import { RootStore } from '@/store';
import { ToastPlugin } from '@/store/module/Toast/Toast';

// 文件建议类型
interface FileSuggestion {
  src_path: string;
  dst_path: string;
  category: string;
  confidence: number;
  reason: string;
  summary: string;
  selected?: boolean;
}

export const JanitorPanel = observer(() => {
  const toast = RootStore.Get(ToastPlugin);
  
  const [inboxPath, setInboxPath] = useState('/Users/Shared/Echo/inbox');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [suggestions, setSuggestions] = useState<FileSuggestion[]>([]);
  const [instruction, setInstruction] = useState('');

  // 分析目录
  const handleAnalyze = async () => {
    if (!inboxPath) {
      toast.error('请输入要整理的目录路径');
      return;
    }

    setIsAnalyzing(true);
    setSuggestions([]);

    try {
      const result = await api.janitor.analyzeDirectory.mutate({
        path: inboxPath,
        instruction: instruction || undefined,
      });
      
      // 默认全选
      setSuggestions(result.map(s => ({ ...s, selected: true })));
      
      if (result.length === 0) {
        toast.success('目录中没有需要整理的文件');
      } else {
        toast.success(`找到 ${result.length} 个文件需要整理`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '分析失败');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 提交选中的文件
  const handleCommit = async () => {
    const selectedSuggestions = suggestions.filter(s => s.selected);
    
    if (selectedSuggestions.length === 0) {
      toast.error('请选择要整理的文件');
      return;
    }

    setIsCommitting(true);

    try {
      const result = await api.janitor.commitBatch.mutate({
        basePath: inboxPath,
        suggestions: selectedSuggestions,
      });
      
      toast.success(`成功整理 ${result.success} 个文件${result.failed > 0 ? `，${result.failed} 个失败` : ''}`);
      
      // 移除已成功的文件
      setSuggestions(prev => 
        prev.filter((s, i) => !selectedSuggestions.includes(s) || !result.results[i]?.success)
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '提交失败');
    } finally {
      setIsCommitting(false);
    }
  };

  // 切换选择
  const toggleSelection = (index: number) => {
    setSuggestions(prev => 
      prev.map((s, i) => i === index ? { ...s, selected: !s.selected } : s)
    );
  };

  // 全选/取消全选
  const toggleAll = () => {
    const allSelected = suggestions.every(s => s.selected);
    setSuggestions(prev => prev.map(s => ({ ...s, selected: !allSelected })));
  };

  // 获取置信度颜色
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.5) return 'warning';
    return 'danger';
  };

  // 获取分类图标
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      '工作': 'solar:briefcase-bold-duotone',
      '财务': 'solar:wallet-bold-duotone',
      '学习': 'solar:book-bold-duotone',
      '健康': 'solar:heart-bold-duotone',
      '家庭': 'solar:home-bold-duotone',
      '社交': 'solar:users-group-rounded-bold-duotone',
      '娱乐': 'solar:gamepad-bold-duotone',
      '旅行': 'solar:airplane-bold-duotone',
      '购物': 'solar:cart-bold-duotone',
      '其他': 'solar:folder-bold-duotone',
    };
    return icons[category] || 'solar:folder-bold-duotone';
  };

  const selectedCount = suggestions.filter(s => s.selected).length;

  return (
    <Card className="h-full">
      <CardHeader className="flex items-center gap-3 pb-2">
        <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
          <Icon icon="solar:magic-stick-3-bold-duotone" className="w-5 h-5 text-warning" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">AI 文件整理</h3>
          <p className="text-sm text-foreground/60">
            使用 AI 自动分类和重命名文件
          </p>
        </div>
      </CardHeader>
      
      <Divider />
      
      <CardBody className="space-y-4">
        {/* 输入区域 */}
        <div className="space-y-3">
          <Input
            label="待整理目录"
            placeholder="/path/to/inbox"
            value={inboxPath}
            onValueChange={setInboxPath}
            startContent={<Icon icon="solar:folder-open-linear" className="text-foreground/50" />}
            size="sm"
          />
          
          <Input
            label="整理指令（可选）"
            placeholder="例如：按项目分类、按日期整理..."
            value={instruction}
            onValueChange={setInstruction}
            startContent={<Icon icon="solar:chat-line-linear" className="text-foreground/50" />}
            size="sm"
          />
          
          <Button
            color="warning"
            onPress={handleAnalyze}
            isLoading={isAnalyzing}
            startContent={!isAnalyzing && <Icon icon="solar:magic-stick-3-linear" />}
            className="w-full"
          >
            {isAnalyzing ? '分析中...' : '开始分析'}
          </Button>
        </div>

        {/* 分析进度 */}
        {isAnalyzing && (
          <div className="space-y-2">
            <Progress
              size="sm"
              isIndeterminate
              color="warning"
              className="max-w-full"
            />
            <p className="text-xs text-foreground/60 text-center">
              AI 正在分析文件内容...
            </p>
          </div>
        )}

        {/* 建议列表 */}
        {suggestions.length > 0 && (
          <>
            <Divider />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  isSelected={suggestions.every(s => s.selected)}
                  isIndeterminate={selectedCount > 0 && selectedCount < suggestions.length}
                  onValueChange={toggleAll}
                  size="sm"
                />
                <span className="text-sm text-foreground/70">
                  已选择 {selectedCount}/{suggestions.length} 个文件
                </span>
              </div>
              
              <Button
                color="primary"
                size="sm"
                onPress={handleCommit}
                isLoading={isCommitting}
                isDisabled={selectedCount === 0}
                startContent={!isCommitting && <Icon icon="solar:check-circle-linear" />}
              >
                确认整理
              </Button>
            </div>

            <ScrollShadow className="max-h-[400px]">
              <div className="space-y-2">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                      suggestion.selected 
                        ? 'border-warning/50 bg-warning/5' 
                        : 'border-default-200 hover:border-default-300'
                    }`}
                    onClick={() => toggleSelection(index)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        isSelected={suggestion.selected}
                        onValueChange={() => toggleSelection(index)}
                        size="sm"
                        className="mt-1"
                      />
                      
                      <div className="flex-1 min-w-0">
                        {/* 原文件名 */}
                        <div className="flex items-center gap-2 mb-1">
                          <Icon icon="solar:file-linear" className="w-4 h-4 text-foreground/50 flex-shrink-0" />
                          <span className="text-sm truncate">{suggestion.src_path}</span>
                        </div>
                        
                        {/* 箭头 */}
                        <div className="flex items-center gap-2 my-1 ml-6">
                          <Icon icon="solar:arrow-down-linear" className="w-4 h-4 text-warning" />
                        </div>
                        
                        {/* 新路径 */}
                        <div className="flex items-center gap-2 mb-2">
                          <Icon icon={getCategoryIcon(suggestion.category)} className="w-4 h-4 text-warning flex-shrink-0" />
                          <span className="text-sm font-medium truncate text-warning">{suggestion.dst_path}</span>
                        </div>
                        
                        {/* 标签 */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Chip size="sm" variant="flat" color="default">
                            {suggestion.category}
                          </Chip>
                          <Chip 
                            size="sm" 
                            variant="flat" 
                            color={getConfidenceColor(suggestion.confidence)}
                          >
                            {Math.round(suggestion.confidence * 100)}% 置信度
                          </Chip>
                        </div>
                        
                        {/* 原因 */}
                        {suggestion.reason && (
                          <p className="text-xs text-foreground/60 mt-2 line-clamp-2">
                            {suggestion.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollShadow>
          </>
        )}

        {/* 空状态 */}
        {!isAnalyzing && suggestions.length === 0 && (
          <div className="text-center py-8 text-foreground/50">
            <Icon icon="solar:inbox-linear" className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">输入目录路径并点击"开始分析"</p>
            <p className="text-xs mt-1">AI 将自动识别文件内容并给出整理建议</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
});
