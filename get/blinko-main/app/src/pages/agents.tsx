/**
 * AI Agents 管理页面
 * 
 * 提供 Khoj Agent 的列表展示、创建、编辑和删除功能
 */

import { observer } from 'mobx-react-lite';
import { useState, useCallback, useEffect } from 'react';
import { 
  Button, 
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { api } from '@/lib/trpc';
import { AgentCard, AgentForm } from '@/components/khoj';
import type { KhojAgent, AgentFormData } from '@/components/khoj';
import { ScrollArea } from '@/components/Common/ScrollArea';
import { RootStore } from '@/store';
import { ToastPlugin } from '@/store/module/Toast/Toast';

/**
 * Agents 页面组件
 */
const AgentsPage = observer(() => {
  const toast = RootStore.Get(ToastPlugin);

  // 状态
  const [agents, setAgents] = useState<KhojAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<KhojAgent | undefined>();
  const [deletingAgent, setDeletingAgent] = useState<KhojAgent | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 加载 Agent 列表
  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.khoj.getAgents.query();
      setAgents(result || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // 打开创建表单
  const handleCreate = useCallback(() => {
    setEditingAgent(undefined);
    setIsFormOpen(true);
  }, []);

  // 打开编辑表单
  const handleEdit = useCallback((agent: KhojAgent) => {
    setEditingAgent(agent);
    setIsFormOpen(true);
  }, []);

  // 确认删除
  const handleDeleteConfirm = useCallback((agent: KhojAgent) => {
    setDeletingAgent(agent);
  }, []);

  // 执行删除
  const handleDelete = useCallback(async () => {
    if (!deletingAgent) return;
    
    setIsDeleting(true);
    try {
      await api.khoj.deleteAgent.mutate({ slug: deletingAgent.slug });
      toast.success('Agent 已删除');
      setDeletingAgent(null);
      loadAgents();
    } catch (err) {
      toast.error('删除失败');
    } finally {
      setIsDeleting(false);
    }
  }, [deletingAgent, loadAgents, toast]);

  // 提交表单
  const handleSubmit = useCallback(async (data: AgentFormData) => {
    setIsSubmitting(true);
    try {
      if (editingAgent) {
        // 更新
        await api.khoj.updateAgent.mutate({
          slug: editingAgent.slug,
          name: data.name,
          personality: data.personality,
          tools: data.tools,
          public: data.public,
        });
        toast.success('Agent 已更新');
      } else {
        // 创建
        await api.khoj.createAgent.mutate({
          name: data.name,
          personality: data.personality,
          tools: data.tools,
          public: data.public,
        });
        toast.success('Agent 已创建');
      }
      setIsFormOpen(false);
      setEditingAgent(undefined);
      loadAgents();
    } catch (err) {
      toast.error(editingAgent ? '更新失败' : '创建失败');
    } finally {
      setIsSubmitting(false);
    }
  }, [editingAgent, loadAgents, toast]);

  // 选择 Agent
  const handleSelect = useCallback((agent: KhojAgent) => {
    setSelectedAgent(agent.slug);
  }, []);

  // 关闭表单
  const handleFormCancel = useCallback(() => {
    setIsFormOpen(false);
    setEditingAgent(undefined);
  }, []);

  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-danger/10 flex items-center justify-center">
            <Icon icon="mdi:robot-dead-outline" className="w-12 h-12 text-danger/70" />
          </div>
          <h2 className="text-2xl font-bold mb-3">无法连接 Khoj 服务</h2>
          <p className="text-foreground/60 mb-6">
            请确保 Khoj 服务已启动并正确配置。
          </p>
          
          {/* 启动指引 */}
          <div className="w-full bg-default-100 dark:bg-default-100/50 rounded-xl p-4 text-left mb-6">
            <p className="text-sm font-medium mb-3 flex items-center gap-2">
              <Icon icon="solar:info-circle-linear" className="w-4 h-4 text-primary" />
              启动 Khoj 服务
            </p>
            <div className="bg-default-200 dark:bg-default-200/50 rounded-lg p-3 font-mono text-xs overflow-x-auto">
              <code>docker-compose -f docker-compose.khoj.yml up -d</code>
            </div>
          </div>
          
          <div className="flex gap-3 justify-center">
            <Button
              color="primary"
              onPress={loadAgents}
              startContent={<Icon icon="solar:refresh-linear" className="w-4 h-4" />}
            >
              重试连接
            </Button>
            <Link to="/settings">
              <Button
                variant="flat"
                startContent={<Icon icon="hugeicons:settings-01" className="w-4 h-4" />}
              >
                前往设置
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-divider bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <Icon icon="mdi:robot-outline" className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">AI Agents</h1>
            <p className="text-xs text-foreground/50">管理你的 AI 助手</p>
          </div>
        </div>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-2">
          {/* 刷新按钮 */}
          <Button
            isIconOnly
            variant="light"
            size="sm"
            onPress={loadAgents}
            isLoading={isLoading}
          >
            <Icon icon="solar:refresh-linear" className="w-5 h-5" />
          </Button>

          {/* 创建按钮 */}
          <Button
            color="primary"
            size="sm"
            onPress={handleCreate}
            startContent={<Icon icon="mdi:plus" className="w-4 h-4" />}
          >
            创建 Agent
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea onBottom={() => {}} className="flex-1 p-4">
        {/* 加载状态 */}
        {isLoading && agents.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" color="primary" />
          </div>
        )}

        {/* Agent 网格 */}
        {!isLoading && agents.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {agents.map((agent, index) => (
              <motion.div
                key={agent.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <AgentCard
                  agent={agent}
                  isSelected={selectedAgent === agent.slug}
                  onSelect={() => handleSelect(agent)}
                  onEdit={() => handleEdit(agent)}
                  onDelete={() => handleDeleteConfirm(agent)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* 空状态引导 */}
        {!isLoading && agents.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <div className="w-32 h-32 mb-6 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center">
              <Icon icon="mdi:robot-happy-outline" className="w-16 h-16 text-indigo-500/50" />
            </div>
            <h3 className="text-xl font-semibold mb-2">创建你的第一个 Agent</h3>
            <p className="text-foreground/60 text-center max-w-md mb-6">
              Agent 是具有特定人格和能力的 AI 助手。你可以创建不同的 Agent 来处理不同类型的任务。
            </p>
            <Button
              color="primary"
              size="lg"
              onPress={handleCreate}
              startContent={<Icon icon="mdi:plus" className="w-5 h-5" />}
            >
              创建 Agent
            </Button>
          </motion.div>
        )}
      </ScrollArea>

      {/* 创建/编辑表单 Modal */}
      <AgentForm
        agent={editingAgent}
        isOpen={isFormOpen}
        onSubmit={handleSubmit}
        onCancel={handleFormCancel}
        isSubmitting={isSubmitting}
      />

      {/* 删除确认 Modal */}
      <Modal
        isOpen={!!deletingAgent}
        onClose={() => setDeletingAgent(null)}
        size="sm"
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Icon icon="mdi:alert-circle-outline" className="w-5 h-5 text-danger" />
            确认删除
          </ModalHeader>
          <ModalBody>
            <p>
              确定要删除 Agent <strong>"{deletingAgent?.name}"</strong> 吗？
            </p>
            <p className="text-sm text-foreground/60 mt-2">
              此操作无法撤销，与该 Agent 相关的对话历史可能会受到影响。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => setDeletingAgent(null)}
              isDisabled={isDeleting}
            >
              取消
            </Button>
            <Button
              color="danger"
              onPress={handleDelete}
              isLoading={isDeleting}
              startContent={!isDeleting && <Icon icon="mdi:delete-outline" className="w-4 h-4" />}
            >
              删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
});

export default AgentsPage;
