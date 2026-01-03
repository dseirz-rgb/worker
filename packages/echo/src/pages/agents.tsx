/**
 * AI Agents 管理页面 - AI 服务统一迁移
 * 
 * 提供 Agent 的列表展示、创建、编辑和删除功能
 * 使用新的 Mastra Agent 系统
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
  Card,
  CardBody,
  CardHeader,
  Input,
  Textarea,
  Select,
  SelectItem,
  Chip,
  Switch,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/trpc';
import { ScrollArea } from '@/components/Common/ScrollArea';
import { RootStore } from '@/store';
import { ToastPlugin } from '@/store/module/Toast/Toast';

// Agent 类型
interface Agent {
  id: number;
  slug: string;
  name: string;
  persona: string | null;
  systemPrompt: string;
  tools: string[];
  modelId: number | null;
  privacy: 'public' | 'private';
  accountId: number;
  createdAt: string;
  updatedAt: string;
}

// 可用工具类型
interface AvailableTool {
  name: string;
  description: string;
  category: string;
  permissions?: string[];
}

// Agent 卡片组件
const AgentCard = ({
  agent,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onChat,
}: {
  agent: Agent;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onChat: () => void;
}) => {
  return (
    <Card
      isPressable
      onPress={onSelect}
      className={`transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}
    >
      <CardBody className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Icon icon="mdi:robot-outline" className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">{agent.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Chip
                  size="sm"
                  variant="flat"
                  color={agent.privacy === 'public' ? 'success' : 'default'}
                >
                  {agent.privacy === 'public' ? '公开' : '私有'}
                </Chip>
                {agent.tools.length > 0 && (
                  <Chip size="sm" variant="flat">
                    {agent.tools.length} 工具
                  </Chip>
                )}
              </div>
            </div>
          </div>
        </div>

        {agent.persona && (
          <p className="text-sm text-foreground/60 line-clamp-2 mb-3">
            {agent.persona}
          </p>
        )}

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            color="primary"
            variant="flat"
            onPress={() => onChat()}
            startContent={<Icon icon="solar:chat-round-dots-linear" className="w-4 h-4" />}
          >
            对话
          </Button>
          <Button
            size="sm"
            variant="flat"
            isIconOnly
            onPress={() => onEdit()}
          >
            <Icon icon="solar:pen-linear" className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="flat"
            color="danger"
            isIconOnly
            onPress={() => onDelete()}
          >
            <Icon icon="solar:trash-bin-trash-linear" className="w-4 h-4" />
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};

// Agent 表单组件
const AgentFormModal = ({
  isOpen,
  onClose,
  agent,
  availableTools,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  agent?: Agent;
  availableTools: AvailableTool[];
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}) => {
  const [name, setName] = useState(agent?.name || '');
  const [persona, setPersona] = useState(agent?.persona || '');
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt || '');
  const [selectedTools, setSelectedTools] = useState<string[]>(agent?.tools || []);
  const [privacy, setPrivacy] = useState<'public' | 'private'>(agent?.privacy || 'private');

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setPersona(agent.persona || '');
      setSystemPrompt(agent.systemPrompt);
      setSelectedTools(agent.tools);
      setPrivacy(agent.privacy);
    } else {
      setName('');
      setPersona('');
      setSystemPrompt('');
      setSelectedTools([]);
      setPrivacy('private');
    }
  }, [agent, isOpen]);

  const handleSubmit = () => {
    onSubmit({
      name,
      persona: persona || undefined,
      systemPrompt,
      tools: selectedTools,
      privacy,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent>
        <ModalHeader>
          {agent ? '编辑 Agent' : '创建 Agent'}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Input
              label="名称"
              placeholder="例如：研究助手"
              value={name}
              onChange={(e) => setName(e.target.value)}
              isRequired
            />

            <Textarea
              label="人格描述"
              placeholder="描述这个 Agent 的性格和特点..."
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              minRows={2}
            />

            <Textarea
              label="系统提示"
              placeholder="定义 Agent 的行为和能力..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              minRows={4}
              isRequired
            />

            <div>
              <label className="text-sm font-medium mb-2 block">可用工具</label>
              <div className="flex flex-wrap gap-2">
                {availableTools.map((tool) => (
                  <Chip
                    key={tool.name}
                    variant={selectedTools.includes(tool.name) ? 'solid' : 'flat'}
                    color={selectedTools.includes(tool.name) ? 'primary' : 'default'}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedTools((prev) =>
                        prev.includes(tool.name)
                          ? prev.filter((t) => t !== tool.name)
                          : [...prev, tool.name]
                      );
                    }}
                  >
                    {tool.name}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">公开 Agent</p>
                <p className="text-xs text-foreground/50">公开后其他用户也可以使用</p>
              </div>
              <Switch
                isSelected={privacy === 'public'}
                onValueChange={(v) => setPrivacy(v ? 'public' : 'private')}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            取消
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isLoading={isSubmitting}
            isDisabled={!name.trim() || !systemPrompt.trim()}
          >
            {agent ? '保存' : '创建'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

// 对话 Modal
const ChatModal = ({
  isOpen,
  onClose,
  agent,
}: {
  isOpen: boolean;
  onClose: () => void;
  agent: Agent | null;
}) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setInput('');
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || !agent || isLoading) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.agent.chatWithAgent.mutate({
        agentId: agent.id,
        messages: [...messages, userMessage],
      });

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.text },
      ]);
    } catch (err) {
      console.error('Chat failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon icon="mdi:robot-outline" className="w-5 h-5" />
          与 {agent?.name} 对话
        </ModalHeader>
        <ModalBody>
          <div className="h-96 flex flex-col">
            <ScrollArea onBottom={() => {}} className="flex-1 p-4 bg-default-50 rounded-lg">
              {messages.length === 0 ? (
                <div className="text-center text-foreground/50 py-8">
                  开始与 {agent?.name} 对话吧
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-default-100'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-default-100 p-3 rounded-lg">
                        <Spinner size="sm" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
            <div className="flex gap-2 mt-4">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入消息..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                isDisabled={isLoading}
              />
              <Button
                color="primary"
                onPress={handleSend}
                isLoading={isLoading}
                isDisabled={!input.trim()}
              >
                发送
              </Button>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

// 主组件
const AgentsPage = observer(() => {
  const toast = RootStore.Get(ToastPlugin);

  // 状态
  const [agents, setAgents] = useState<Agent[]>([]);
  const [availableTools, setAvailableTools] = useState<AvailableTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | undefined>();
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [chatAgent, setChatAgent] = useState<Agent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 加载 Agent 列表
  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    try {
      const [agentsResult, toolsResult] = await Promise.all([
        api.agent.getAgents.query(),
        api.agent.getAvailableTools.query(),
      ]);
      setAgents(agentsResult as Agent[]);
      setAvailableTools(toolsResult as AvailableTool[]);
    } catch (err) {
      toast.error('加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // 打开创建表单
  const handleCreate = useCallback(() => {
    setEditingAgent(undefined);
    setIsFormOpen(true);
  }, []);

  // 打开编辑表单
  const handleEdit = useCallback((agent: Agent) => {
    setEditingAgent(agent);
    setIsFormOpen(true);
  }, []);

  // 确认删除
  const handleDeleteConfirm = useCallback((agent: Agent) => {
    setDeletingAgent(agent);
  }, []);

  // 执行删除
  const handleDelete = useCallback(async () => {
    if (!deletingAgent) return;
    
    setIsDeleting(true);
    try {
      await api.agent.deleteAgent.mutate({ id: deletingAgent.id });
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
  const handleSubmit = useCallback(async (data: any) => {
    setIsSubmitting(true);
    try {
      if (editingAgent) {
        await api.agent.updateAgent.mutate({
          id: editingAgent.id,
          ...data,
        });
        toast.success('Agent 已更新');
      } else {
        await api.agent.createAgent.mutate(data);
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

        <div className="flex items-center gap-2">
          <Button
            isIconOnly
            variant="light"
            size="sm"
            onPress={loadAgents}
            isLoading={isLoading}
          >
            <Icon icon="solar:refresh-linear" className="w-5 h-5" />
          </Button>
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
        {isLoading && agents.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" color="primary" />
          </div>
        )}

        {!isLoading && agents.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {agents.map((agent, index) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <AgentCard
                  agent={agent}
                  isSelected={selectedAgent?.id === agent.id}
                  onSelect={() => setSelectedAgent(agent)}
                  onEdit={() => handleEdit(agent)}
                  onDelete={() => handleDeleteConfirm(agent)}
                  onChat={() => setChatAgent(agent)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

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

      {/* 创建/编辑表单 */}
      <AgentFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingAgent(undefined);
        }}
        agent={editingAgent}
        availableTools={availableTools}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />

      {/* 对话 Modal */}
      <ChatModal
        isOpen={!!chatAgent}
        onClose={() => setChatAgent(null)}
        agent={chatAgent}
      />

      {/* 删除确认 */}
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
              此操作无法撤销。
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
