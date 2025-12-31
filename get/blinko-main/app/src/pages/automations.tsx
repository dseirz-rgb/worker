/**
 * 自动化任务页面 - AI 服务统一迁移
 * 
 * 管理自动化任务：
 * - 查看任务列表
 * - 创建新任务
 * - 编辑/删除任务
 * - 手动运行任务
 * - 查看运行历史
 */

import { observer } from 'mobx-react-lite';
import { useState, useCallback, useEffect } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Spinner,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Select,
  SelectItem,
  Switch,
  Chip,
  Tooltip,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/trpc';
import { RootStore } from '@/store';
import { ToastPlugin } from '@/store/module/Toast/Toast';
import { ScrollArea } from '@/components/Common/ScrollArea';

// 自动化类型
interface Automation {
  id: number;
  name: string;
  query: string;
  schedule: string;
  naturalSchedule?: string;
  agentId?: number;
  resultStorage: 'note' | 'memory' | 'both';
  notificationChannels: string[];
  isEnabled: boolean;
  lastRun?: string;
  createdAt: string;
}

// 运行记录类型
interface AutomationRun {
  id: number;
  automationId: number;
  status: 'pending' | 'running' | 'success' | 'failed';
  result?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}


// 模板类型
interface AutomationTemplate {
  name: string;
  query: string;
  naturalSchedule: string;
  icon: string;
  color: string;
}

const TEMPLATES: AutomationTemplate[] = [
  {
    name: '每日笔记摘要',
    query: '总结我今天创建的所有笔记，提取关键信息和待办事项',
    naturalSchedule: '每天晚上 9 点',
    icon: 'solar:document-text-bold-duotone',
    color: 'primary',
  },
  {
    name: '周报生成',
    query: '根据本周的笔记和任务，生成一份周报摘要',
    naturalSchedule: '每周五下午 5 点',
    icon: 'solar:calendar-bold-duotone',
    color: 'secondary',
  },
  {
    name: '待办提醒',
    query: '检查我的笔记中所有未完成的待办事项，按优先级排序',
    naturalSchedule: '每天早上 9 点',
    icon: 'solar:checklist-bold-duotone',
    color: 'warning',
  },
];

// 自动化卡片组件
const AutomationCard = ({
  automation,
  onRun,
  onEdit,
  onDelete,
  onToggle,
  isRunning,
}: {
  automation: Automation;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
  isRunning: boolean;
}) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardBody className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon icon="solar:clock-circle-bold-duotone" className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{automation.name}</h3>
              <p className="text-xs text-foreground/50">
                {automation.naturalSchedule || automation.schedule}
              </p>
            </div>
          </div>
          <Switch
            size="sm"
            isSelected={automation.isEnabled}
            onValueChange={onToggle}
          />
        </div>

        <p className="text-sm text-foreground/60 line-clamp-2 mb-3">
          {automation.query}
        </p>

        <div className="flex items-center gap-2 mb-3">
          <Chip size="sm" variant="flat">
            {automation.resultStorage === 'note' ? '保存到笔记' : 
             automation.resultStorage === 'memory' ? '保存到记忆' : '两者都保存'}
          </Chip>
          {automation.lastRun && (
            <Tooltip content={`上次运行: ${new Date(automation.lastRun).toLocaleString()}`}>
              <Chip size="sm" variant="flat" color="success">
                <Icon icon="solar:check-circle-linear" className="w-3 h-3 mr-1" />
                已运行
              </Chip>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            color="primary"
            variant="flat"
            onPress={onRun}
            isLoading={isRunning}
            startContent={!isRunning && <Icon icon="solar:play-linear" className="w-4 h-4" />}
          >
            运行
          </Button>
          <Button size="sm" variant="flat" isIconOnly onPress={onEdit}>
            <Icon icon="solar:pen-linear" className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="flat" color="danger" isIconOnly onPress={onDelete}>
            <Icon icon="solar:trash-bin-trash-linear" className="w-4 h-4" />
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};


// 表单 Modal
const AutomationFormModal = ({
  isOpen,
  onClose,
  automation,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  automation?: Automation;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}) => {
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [naturalSchedule, setNaturalSchedule] = useState('');
  const [resultStorage, setResultStorage] = useState<'note' | 'memory' | 'both'>('note');
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    if (automation) {
      setName(automation.name);
      setQuery(automation.query);
      setNaturalSchedule(automation.naturalSchedule || '');
      setResultStorage(automation.resultStorage);
      setIsEnabled(automation.isEnabled);
    } else {
      setName('');
      setQuery('');
      setNaturalSchedule('');
      setResultStorage('note');
      setIsEnabled(true);
    }
  }, [automation, isOpen]);

  const handleSubmit = () => {
    onSubmit({
      name,
      query,
      naturalSchedule,
      resultStorage,
      isEnabled,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader>{automation ? '编辑任务' : '创建任务'}</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Input
              label="任务名称"
              placeholder="例如：每日笔记摘要"
              value={name}
              onChange={(e) => setName(e.target.value)}
              isRequired
            />
            <Textarea
              label="查询内容"
              placeholder="AI 将执行的查询..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              minRows={3}
              isRequired
            />
            <Input
              label="调度时间"
              placeholder="例如：每天早上 9 点"
              value={naturalSchedule}
              onChange={(e) => setNaturalSchedule(e.target.value)}
              description="使用自然语言描述，如「每天早上 9 点」「每周一下午 3 点」"
              isRequired
            />
            <Select
              label="结果存储"
              selectedKeys={[resultStorage]}
              onSelectionChange={(keys) => setResultStorage(Array.from(keys)[0] as any)}
            >
              <SelectItem key="note">保存到笔记</SelectItem>
              <SelectItem key="memory">保存到记忆</SelectItem>
              <SelectItem key="both">两者都保存</SelectItem>
            </Select>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">启用任务</p>
                <p className="text-xs text-foreground/50">关闭后任务不会自动执行</p>
              </div>
              <Switch isSelected={isEnabled} onValueChange={setIsEnabled} />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>取消</Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isLoading={isSubmitting}
            isDisabled={!name.trim() || !query.trim() || !naturalSchedule.trim()}
          >
            {automation ? '保存' : '创建'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};


// 历史记录 Modal
const HistoryModal = ({
  isOpen,
  onClose,
  automation,
  history,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  automation: Automation | null;
  history: AutomationRun[];
  isLoading: boolean;
}) => {
  const statusColor = (status: string) => ({
    success: 'success',
    failed: 'danger',
    running: 'primary',
    pending: 'default',
  }[status] as 'success' | 'danger' | 'primary' | 'default');

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent>
        <ModalHeader>运行历史 - {automation?.name}</ModalHeader>
        <ModalBody>
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : history.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history.map((run) => (
                <Card key={run.id} className="bg-default-50">
                  <CardBody className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Chip size="sm" color={statusColor(run.status)} variant="flat">
                        {run.status}
                      </Chip>
                      <span className="text-xs text-foreground/50">
                        {new Date(run.startedAt).toLocaleString()}
                      </span>
                    </div>
                    {run.result && (
                      <p className="text-sm line-clamp-3">{run.result}</p>
                    )}
                    {run.error && (
                      <p className="text-sm text-danger">{run.error}</p>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-foreground/50">暂无运行记录</div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>关闭</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

// 主组件
const AutomationsPage = observer(() => {
  const toast = RootStore.Get(ToastPlugin);

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | undefined>();
  const [runningId, setRunningId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyAutomation, setHistoryAutomation] = useState<Automation | null>(null);
  const [history, setHistory] = useState<AutomationRun[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadAutomations = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.automation.getAutomations.query();
      setAutomations(result as unknown as Automation[]);
    } catch (err) {
      toast.error('加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAutomations();
  }, [loadAutomations]);

  const handleCreate = useCallback(() => {
    setEditingAutomation(undefined);
    setIsFormOpen(true);
  }, []);

  const handleUseTemplate = useCallback((template: AutomationTemplate) => {
    setEditingAutomation({
      id: 0,
      name: template.name,
      query: template.query,
      schedule: '',
      naturalSchedule: template.naturalSchedule,
      resultStorage: 'note',
      notificationChannels: [],
      isEnabled: true,
      createdAt: '',
    });
    setIsFormOpen(true);
  }, []);

  const handleSubmit = useCallback(async (data: any) => {
    setIsSubmitting(true);
    try {
      if (editingAutomation?.id) {
        await api.automation.updateAutomation.mutate({ id: editingAutomation.id, ...data });
        toast.success('任务已更新');
      } else {
        await api.automation.createAutomation.mutate(data);
        toast.success('任务已创建');
      }
      setIsFormOpen(false);
      loadAutomations();
    } catch (err) {
      toast.error('操作失败');
    } finally {
      setIsSubmitting(false);
    }
  }, [editingAutomation, loadAutomations, toast]);

  const handleRun = useCallback(async (id: number) => {
    setRunningId(id);
    try {
      await api.automation.runAutomation.mutate({ id });
      toast.success('任务执行完成');
      loadAutomations();
    } catch (err) {
      toast.error('执行失败');
    } finally {
      setRunningId(null);
    }
  }, [loadAutomations, toast]);

  const handleToggle = useCallback(async (id: number, enabled: boolean) => {
    try {
      await api.automation.toggleAutomation.mutate({ id, enabled });
      loadAutomations();
    } catch (err) {
      toast.error('操作失败');
    }
  }, [loadAutomations, toast]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await api.automation.deleteAutomation.mutate({ id });
      toast.success('任务已删除');
      loadAutomations();
    } catch (err) {
      toast.error('删除失败');
    }
  }, [loadAutomations, toast]);

  const handleViewHistory = useCallback(async (automation: Automation) => {
    setHistoryAutomation(automation);
    setIsLoadingHistory(true);
    try {
      const result = await api.automation.getRunHistory.query({ automationId: automation.id });
      setHistory(result as unknown as AutomationRun[]);
    } catch (err) {
      toast.error('加载历史失败');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [toast]);

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
            <p className="text-xs text-foreground/50">设置定时执行的 AI 查询任务</p>
          </div>
        </div>
        <Button color="primary" onPress={handleCreate} startContent={<Icon icon="mdi:plus" className="w-4 h-4" />}>
          创建任务
        </Button>
      </div>

      {/* Content */}
      <ScrollArea onBottom={() => {}} className="flex-1 p-4">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : (
          <div className="space-y-6">
            {/* 模板 */}
            {automations.length === 0 && (
              <div className="space-y-4">
                <h2 className="font-medium flex items-center gap-2">
                  <Icon icon="mdi:lightbulb-outline" className="w-5 h-5 text-warning" />
                  推荐模板
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {TEMPLATES.map((t, i) => (
                    <Card key={i} isPressable onPress={() => handleUseTemplate(t)}>
                      <CardBody className="p-4">
                        <div className={`w-10 h-10 rounded-lg bg-${t.color}/10 flex items-center justify-center mb-3`}>
                          <Icon icon={t.icon} className={`w-5 h-5 text-${t.color}`} />
                        </div>
                        <h4 className="font-medium">{t.name}</h4>
                        <p className="text-xs text-foreground/50 mt-1">{t.naturalSchedule}</p>
                      </CardBody>
                    </Card>
                  ))}
                </div>
                <Divider />
              </div>
            )}

            {/* 任务列表 */}
            {automations.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AnimatePresence>
                  {automations.map((a) => (
                    <motion.div key={a.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <AutomationCard
                        automation={a}
                        onRun={() => handleRun(a.id)}
                        onEdit={() => { setEditingAutomation(a); setIsFormOpen(true); }}
                        onDelete={() => handleDelete(a.id)}
                        onToggle={(enabled) => handleToggle(a.id, enabled)}
                        isRunning={runningId === a.id}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-default-100 flex items-center justify-center">
                  <Icon icon="solar:clock-circle-linear" className="w-10 h-10 text-default-400" />
                </div>
                <h3 className="text-lg font-medium mb-2">还没有自动化任务</h3>
                <p className="text-foreground/60 mb-4">创建自动化任务，让 AI 定时为你执行查询</p>
                <Button color="primary" onPress={handleCreate}>创建第一个任务</Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <AutomationFormModal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingAutomation(undefined); }}
        automation={editingAutomation}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />

      <HistoryModal
        isOpen={!!historyAutomation}
        onClose={() => setHistoryAutomation(null)}
        automation={historyAutomation}
        history={history}
        isLoading={isLoadingHistory}
      />
    </div>
  );
});

export default AutomationsPage;
