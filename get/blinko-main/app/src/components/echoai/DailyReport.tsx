/**
 * DailyReport 组件 - 日报显示和管理
 * 
 * 功能：
 * - 显示今日日报内容
 * - 手动触发生成日报
 * - 配置日报生成时间
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Spinner,
  Divider,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { api } from '@/lib/trpc';
import { RootStore } from '@/store';
import { ToastPlugin } from '@/store/module/Toast/Toast';
import { MarkdownRender } from '@/components/Common/MarkdownRender';

// ============================================
// 类型定义
// ============================================

interface DailyReportStatus {
  isScheduled: boolean;
  schedule: string | null;
  taskName: string;
}

// 预设时间选项
const TIME_OPTIONS = [
  { key: '0 12 * * *', label: '每天 20:00 (UTC+8)' },
  { key: '0 13 * * *', label: '每天 21:00 (UTC+8)' },
  { key: '0 14 * * *', label: '每天 22:00 (UTC+8)' },
  { key: '0 1 * * *', label: '每天 09:00 (UTC+8)' },
  { key: '0 10 * * *', label: '每天 18:00 (UTC+8)' },
];

// ============================================
// 组件
// ============================================

export function DailyReport() {
  const toast = RootStore.Get(ToastPlugin);

  // 状态
  const [status, setStatus] = useState<DailyReportStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>('0 13 * * *');
  const [isSaving, setIsSaving] = useState(false);

  // 加载状态
  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.dailyReport.getStatus.query();
      setStatus(result);
      if (result.schedule) {
        setSelectedTime(result.schedule);
      }
    } catch (err) {
      console.error('加载日报状态失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // 手动生成日报
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGeneratedContent(null);
    try {
      const result = await api.dailyReport.generate.mutate();
      setGeneratedContent(result.content);
      toast.success('日报生成成功');
    } catch (err) {
      toast.error('生成失败，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  // 保存设置
  const handleSaveSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      await api.dailyReport.updateSchedule.mutate({ cronTime: selectedTime });
      toast.success('设置已保存');
      setIsSettingsOpen(false);
      loadStatus();
    } catch (err) {
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  }, [selectedTime, toast, loadStatus]);

  // 启动/停止任务
  const handleToggleTask = useCallback(async () => {
    try {
      if (status?.isScheduled) {
        await api.dailyReport.stop.mutate();
        toast.success('日报任务已停止');
      } else {
        await api.dailyReport.start.mutate({ cronTime: selectedTime, immediate: false });
        toast.success('日报任务已启动');
      }
      loadStatus();
    } catch (err) {
      toast.error('操作失败');
    }
  }, [status, selectedTime, toast, loadStatus]);

  // 获取当前时间显示
  const getCurrentTimeLabel = () => {
    const option = TIME_OPTIONS.find(o => o.key === status?.schedule);
    return option?.label || status?.schedule || '未设置';
  };

  return (
    <div className="space-y-4">
      {/* 状态卡片 */}
      <Card>
        <CardHeader className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Icon icon="solar:document-text-bold-duotone" className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">每日日报</h3>
              <p className="text-xs text-foreground/50">AI 自动生成的每日活动总结</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoading ? (
              <Spinner size="sm" />
            ) : (
              <Chip
                size="sm"
                color={status?.isScheduled ? 'success' : 'default'}
                variant="flat"
                startContent={
                  <Icon 
                    icon={status?.isScheduled ? 'mdi:check-circle' : 'mdi:pause-circle'} 
                    className="w-3 h-3" 
                  />
                }
              >
                {status?.isScheduled ? '已启用' : '已停用'}
              </Chip>
            )}
          </div>
        </CardHeader>

        <Divider />

        <CardBody className="space-y-4">
          {/* 当前设置 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-default-100">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:clock-outline" className="w-5 h-5 text-foreground/60" />
              <span className="text-sm">生成时间</span>
            </div>
            <span className="text-sm font-medium">{getCurrentTimeLabel()}</span>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-2">
            <Button
              color="primary"
              onPress={handleGenerate}
              isLoading={isGenerating}
              startContent={!isGenerating && <Icon icon="mdi:file-document-plus-outline" className="w-4 h-4" />}
            >
              立即生成
            </Button>
            <Button
              variant="flat"
              onPress={() => setIsSettingsOpen(true)}
              startContent={<Icon icon="mdi:cog-outline" className="w-4 h-4" />}
            >
              设置
            </Button>
            <Button
              variant="flat"
              color={status?.isScheduled ? 'danger' : 'success'}
              onPress={handleToggleTask}
              startContent={
                <Icon 
                  icon={status?.isScheduled ? 'mdi:stop' : 'mdi:play'} 
                  className="w-4 h-4" 
                />
              }
            >
              {status?.isScheduled ? '停止' : '启动'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* 生成的日报内容 */}
      {generatedContent && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:file-document-check-outline" className="w-5 h-5 text-success" />
              <span className="font-medium">生成结果</span>
            </div>
          </CardHeader>
          <Divider />
          <CardBody>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownRender content={generatedContent} />
            </div>
          </CardBody>
        </Card>
      )}

      {/* 设置弹窗 */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Icon icon="mdi:cog-outline" className="w-5 h-5" />
            日报设置
          </ModalHeader>
          <ModalBody>
            <Select
              label="生成时间"
              placeholder="选择每日生成时间"
              selectedKeys={[selectedTime]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                if (selected) setSelectedTime(selected);
              }}
              description="日报将在每天指定时间自动生成"
            >
              {TIME_OPTIONS.map((option) => (
                <SelectItem key={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setIsSettingsOpen(false)}>
              取消
            </Button>
            <Button
              color="primary"
              onPress={handleSaveSettings}
              isLoading={isSaving}
            >
              保存
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

export default DailyReport;
