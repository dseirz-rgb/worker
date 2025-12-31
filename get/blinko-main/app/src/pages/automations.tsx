/**
 * 自动化任务页面
 * 
 * 管理 Khoj 自动化任务：
 * - 查看任务列表
 * - 创建新任务
 * - 编辑/删除任务
 * - 手动运行任务
 */

import { observer } from 'mobx-react-lite';
import { useState, useCallback, useEffect } from 'react';
import {
  Button,
  Card,
  CardBody,
  Spinner,
  Divider,
  ScrollShadow,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/trpc';
import { RootStore } from '@/store';
import { ToastPlugin } from '@/store/module/Toast/Toast';
import {
  AutomationCard,
  AutomationForm,
  type KhojAutomation,
  type AutomationFormData,
} from '@/components/khoj/automationCard';

// ============================================
// 建议模板
// ============================================

interface AutomationTemplate {
  subject: string;
  query_to_run: string;
  scheduling_request: string;
  icon: string;
  color: string;
}

const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    subject: '每日笔记摘要',
    query_to_run: '总结我今天创建的所有笔记，提取关键信息和待办事项',
    scheduling_request: '每天晚上 9 点',
    icon: 'solar:document-text-bold-duotone',
    color: 'bg-primary/10 text-primary',
  },
  {
    subject: '周报生成',
    query_to_run: '根据本周的笔记和任务，生成一份周报摘要，包括完成的工作、遇到的问题和下周计划',
    scheduling_request: '每周五下午 5 点',
    icon: 'solar:calendar-bold-duotone',
    color: 'bg-secondary/10 text-secondary',
  },
  {
    subject: '学习进度追踪',
    query_to_run: '分析我最近的学习笔记，总结学习进度和知识点掌握情况',
    scheduling_request: '每周日晚上 8 点',
    icon: 'solar:book-bold-duotone',
    color: 'bg-success/10 text-success',
  },
  {
    subject: '待办事项提醒',
    query_to_run: '检查我的笔记中所有未完成的待办事项，按优先级排序并提醒我',
    scheduling_request: '每天早上 9 点',
    icon: 'solar:checklist-bold-duotone',
    color: 'bg-warning/10 text-warning',
  },
];

// ============================================
// 主组件
// ============================================

const AutomationsPage = observer(() => {
  const toast = RootStore.Get(ToastPlugin);

  // 状态
  const [automations, setAutomations] = useState<KhojAutomation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<KhojAutomation | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 加载自动化任务列表
  const loadAutomations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.khoj.getAutomations.query();
      setAutomations(result || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    loadAutomations();
    // 每分钟刷新一次
    const interval = setInterval(loadAutomations, 60000);
    return () => clearInterval(interval);
  }, [loadAutomations]);

  // 打开创建表单
  const handleCreate = useCallback(() => {
    setEditingAutomation(undefined);
    setIsFormOpen(true);
  }, []);

  // 使用模板创建
  const handleUseTemplate = useCallback((template: AutomationTemplate) => {
    setEditingAutomation({
      id: '',
      subject: template.subject,
      query_to_run: template.query_to_run,
      scheduling_request: template.scheduling_request,
      schedule: '',
      next_run_at: '',
    });
    setIsFormOpen(true);
  }, []);

  // 编辑任务
  const handleEdit = useCallback((automation: KhojAutomation) => {
    setEditingAutomation(automation);
    setIsFormOpen(true);
  }, []);

  // 删除任务
  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      await api.khoj.deleteAutomation.mutate({ id });
      toast.success('自动化任务已删除');
      loadAutomations();
    } catch (err) {
      toast.error('删除失败');
    } finally {
      setDeletingId(null);
    }
  }, [loadAutomations, toast]);

  // 运行任务（通过聊天 API 发送查询）
  const handleRun = useCallback(async (automation: KhojAutomation) => {
    setRunningId(automation.id);
    try {
      await api.khoj.chat.mutate({
        message: automation.query_to_run,
      });
      toast.success(`任务 "${automation.subject}" 已执行`);
    } catch (err) {
      toast.error('执行失败');
    } finally {
      setRunningId(null);
    }
  }, [toast]);

  // 提交表单
  const handleSubmit = useCallback(async (data: AutomationFormData) => {
    setIsSubmitting(true);
    try {
      await api.khoj.createAutomation.mutate(data);
      toast.success('自动化任务创建成功');
      setIsFormOpen(false);
      loadAutomations();
    } catch (err) {
      toast.error('创建失败');
    } finally {
      setIsSubmitting(false);
    }
  }, [loadAutomations, toast]);

  // 关闭表单
  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingAutomation(undefined);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-divider bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Icon icon="solar:clock-circle-bold-duotone" className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">自动化任务</h1>
            <p className="text-xs text-foreground/50">
              设置定时执行的 AI 查询任务
            </p>
          </div>
        </div>

        {/* 创建按钮 */}
        <Button
          color="primary"
          onPress={handleCreate}
          startContent={<Icon icon="mdi:plus" className="w-4 h-4" />}
        >
          创建任务
        </Button>
      </div>

      {/* Content */}
      <ScrollShadow className="flex-1 overflow-y-auto p-4">
        {/* 加载状态 */}
        {isLoading && automations.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" color="primary" />
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <Card className="bg-danger/10 border-danger/20">
            <CardBody className="flex flex-row items-center gap-3">
              <Icon icon="mdi:alert-circle" className="w-6 h-6 text-danger" />
              <div className="flex-1">
                <p className="font-medium text-danger">加载失败</p>
                <p className="text-sm text-foreground/60">{error.message}</p>
              </div>
              <Button
                size="sm"
                variant="flat"
                color="danger"
                onPress={loadAutomations}
              >
                重试
              </Button>
            </CardBody>
          </Card>
        )}

        {/* 任务列表 */}
        {!isLoading && !error && (
          <div className="space-y-6">
            {/* 建议模板区域 */}
            {automations.length === 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Icon icon="mdi:lightbulb-outline" className="w-5 h-5 text-warning" />
                  <h2 className="font-medium">推荐模板</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {AUTOMATION_TEMPLATES.map((template, index) => (
                    <Card
                      key={index}
                      isPressable
                      onPress={() => handleUseTemplate(template)}
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardBody className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${template.color.split(' ')[0]}`}>
                            <Icon icon={template.icon} className={`w-5 h-5 ${template.color.split(' ')[1]}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{template.subject}</h4>
                            <p className="text-xs text-foreground/60 line-clamp-2 mt-1">
                              {template.query_to_run}
                            </p>
                            <p className="text-xs text-primary mt-2">
                              {template.scheduling_request}
                            </p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
                <Divider className="my-4" />
              </div>
            )}

            {/* 任务列表 */}
            {automations.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium">
                    我的任务 ({automations.length})
                  </h2>
                  <Button
                    size="sm"
                    variant="light"
                    onPress={loadAutomations}
                    startContent={<Icon icon="mdi:refresh" className="w-4 h-4" />}
                  >
                    刷新
                  </Button>
                </div>

                <AnimatePresence mode="popLayout">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {automations.map((automation) => (
                      <motion.div
                        key={automation.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <AutomationCard
                          automation={automation}
                          onRun={() => handleRun(automation)}
                          onEdit={() => handleEdit(automation)}
                          onDelete={() => handleDelete(automation.id)}
                          isRunning={runningId === automation.id}
                          isDeleting={deletingId === automation.id}
                        />
                      </motion.div>
                    ))}
                  </div>
                </AnimatePresence>
              </div>
            ) : (
              /* 空状态 */
              !isLoading && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-default-100 flex items-center justify-center">
                    <Icon icon="solar:clock-circle-linear" className="w-10 h-10 text-default-400" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">还没有自动化任务</h3>
                  <p className="text-foreground/60 mb-4">
                    创建自动化任务，让 AI 定时为你执行查询
                  </p>
                  <Button
                    color="primary"
                    onPress={handleCreate}
                    startContent={<Icon icon="mdi:plus" className="w-4 h-4" />}
                  >
                    创建第一个任务
                  </Button>
                </div>
              )
            )}
          </div>
        )}
      </ScrollShadow>

      {/* 创建/编辑表单 */}
      <AutomationForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        automation={editingAutomation}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
});

export default AutomationsPage;
