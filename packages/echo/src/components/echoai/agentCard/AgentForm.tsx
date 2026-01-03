/**
 * AgentForm 组件 - Agent 创建/编辑表单
 * 
 * 提供 Agent 的创建和编辑功能，包含名称、人格描述、颜色、图标等字段
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Checkbox,
  CheckboxGroup,
  Divider,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { tailwindColors } from '../common/colorUtils';
import { getAvailableIcons, iconMap } from '../common/iconUtils';
import type { KhojAgent } from './AgentCard';

/**
 * Agent 表单数据类型
 */
export interface AgentFormData {
  name: string;
  personality: string;
  color?: string;
  icon?: string;
  chat_model?: string;
  tools?: string[];
  public?: boolean;
}

/**
 * AgentForm 组件属性
 */
export interface AgentFormProps {
  /** 编辑时传入的 Agent 数据 */
  agent?: KhojAgent;
  /** 是否打开 */
  isOpen: boolean;
  /** 提交回调 */
  onSubmit: (data: AgentFormData) => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 是否正在提交 */
  isSubmitting?: boolean;
}

/**
 * 可用的工具列表
 */
const AVAILABLE_TOOLS = [
  { key: 'online', label: '在线搜索', description: '搜索互联网获取最新信息' },
  { key: 'notes', label: '笔记搜索', description: '搜索你的个人笔记' },
  { key: 'webpage', label: '网页阅读', description: '阅读和分析网页内容' },
  { key: 'image', label: '图像生成', description: '生成图像' },
  { key: 'code', label: '代码执行', description: '执行代码片段' },
];

/**
 * 可用的模型列表
 */
const AVAILABLE_MODELS = [
  { key: 'default', label: '默认模型' },
  { key: 'gpt-4', label: 'GPT-4' },
  { key: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { key: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { key: 'claude-3-opus', label: 'Claude 3 Opus' },
  { key: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
  { key: 'gemini-pro', label: 'Gemini Pro' },
];

/**
 * AgentForm 组件
 * 用于创建和编辑 Agent
 */
export function AgentForm({
  agent,
  isOpen,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: AgentFormProps) {
  // 表单状态
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState('');
  const [color, setColor] = useState<string>('blue');
  const [icon, setIcon] = useState<string>('Robot');
  const [chatModel, setChatModel] = useState<string>('default');
  const [tools, setTools] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);

  // 表单验证
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 初始化表单数据
  useEffect(() => {
    if (agent) {
      setName(agent.name || '');
      setPersonality(agent.personality || '');
      setColor(agent.color || 'blue');
      setIcon(agent.icon || 'Robot');
      setChatModel(agent.chat_model || 'default');
      setTools(agent.tools || []);
      setIsPublic(agent.public || false);
    } else {
      // 重置表单
      setName('');
      setPersonality('');
      setColor('blue');
      setIcon('Robot');
      setChatModel('default');
      setTools([]);
      setIsPublic(false);
    }
    setErrors({});
  }, [agent, isOpen]);

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = '请输入 Agent 名称';
    } else if (name.length > 50) {
      newErrors.name = '名称不能超过 50 个字符';
    }

    if (!personality.trim()) {
      newErrors.personality = '请输入人格描述';
    } else if (personality.length > 2000) {
      newErrors.personality = '描述不能超过 2000 个字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = () => {
    if (!validateForm()) return;

    onSubmit({
      name: name.trim(),
      personality: personality.trim(),
      color,
      icon,
      chat_model: chatModel !== 'default' ? chatModel : undefined,
      tools: tools.length > 0 ? tools : undefined,
      public: isPublic,
    });
  };

  const isEditing = !!agent;
  const availableIcons = getAvailableIcons();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      size="2xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon 
            icon={isEditing ? 'mdi:pencil-outline' : 'mdi:plus'} 
            className="w-5 h-5" 
          />
          {isEditing ? '编辑 Agent' : '创建 Agent'}
        </ModalHeader>

        <ModalBody className="gap-4">
          {/* 基本信息 */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground/70">基本信息</h4>
            
            {/* 名称 */}
            <Input
              label="名称"
              placeholder="输入 Agent 名称"
              value={name}
              onValueChange={setName}
              isInvalid={!!errors.name}
              errorMessage={errors.name}
              isRequired
              maxLength={50}
              description={`${name.length}/50`}
            />

            {/* 人格描述 */}
            <Textarea
              label="人格描述"
              placeholder="描述这个 Agent 的角色、能力和行为方式..."
              value={personality}
              onValueChange={setPersonality}
              isInvalid={!!errors.personality}
              errorMessage={errors.personality}
              isRequired
              minRows={3}
              maxRows={8}
              maxLength={2000}
              description={`${personality.length}/2000`}
            />
          </div>

          <Divider />

          {/* 外观设置 */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground/70">外观设置</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 颜色选择 */}
              <Select
                label="颜色"
                placeholder="选择颜色"
                selectedKeys={[color]}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  if (selected) setColor(selected);
                }}
              >
                {tailwindColors.map((c) => (
                  <SelectItem
                    key={c}
                    startContent={
                      <div 
                        className={`w-4 h-4 rounded-full bg-${c}-500`}
                        style={{ backgroundColor: `var(--color-${c}-500, ${getColorHex(c)})` }}
                      />
                    }
                  >
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </SelectItem>
                ))}
              </Select>

              {/* 图标选择 */}
              <Select
                label="图标"
                placeholder="选择图标"
                selectedKeys={[icon]}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  if (selected) setIcon(selected);
                }}
              >
                {availableIcons.map((iconName) => (
                  <SelectItem
                    key={iconName}
                    startContent={
                      <Icon icon={iconMap[iconName]} className="w-4 h-4" />
                    }
                  >
                    {iconName}
                  </SelectItem>
                ))}
              </Select>
            </div>

            {/* 预览 */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-default-100">
              <div 
                className={`w-12 h-12 rounded-xl flex items-center justify-center`}
                style={{ backgroundColor: `${getColorHex(color)}20` }}
              >
                <Icon 
                  icon={iconMap[icon] || 'mdi:robot-outline'} 
                  className="w-7 h-7"
                  style={{ color: getColorHex(color) }}
                />
              </div>
              <div>
                <p className="font-medium">{name || '未命名 Agent'}</p>
                <p className="text-xs text-foreground/50">预览效果</p>
              </div>
            </div>
          </div>

          <Divider />

          {/* 高级设置 */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground/70">高级设置</h4>
            
            {/* 模型选择 */}
            <Select
              label="聊天模型"
              placeholder="选择模型"
              selectedKeys={[chatModel]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                if (selected) setChatModel(selected);
              }}
              description="留空使用默认模型"
            >
              {AVAILABLE_MODELS.map((model) => (
                <SelectItem key={model.key}>
                  {model.label}
                </SelectItem>
              ))}
            </Select>

            {/* 工具选择 */}
            <div className="space-y-2">
              <label className="text-sm">可用工具</label>
              <CheckboxGroup
                value={tools}
                onValueChange={setTools}
                className="gap-2"
              >
                {AVAILABLE_TOOLS.map((tool) => (
                  <Checkbox
                    key={tool.key}
                    value={tool.key}
                    classNames={{
                      base: 'max-w-full',
                      label: 'w-full',
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm">{tool.label}</span>
                      <span className="text-xs text-foreground/50">{tool.description}</span>
                    </div>
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </div>

            {/* 公开设置 */}
            <Checkbox
              isSelected={isPublic}
              onValueChange={setIsPublic}
            >
              <div className="flex flex-col">
                <span className="text-sm">公开 Agent</span>
                <span className="text-xs text-foreground/50">
                  公开后其他用户可以使用这个 Agent
                </span>
              </div>
            </Checkbox>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button
            variant="flat"
            onPress={onCancel}
            isDisabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isLoading={isSubmitting}
            startContent={!isSubmitting && <Icon icon="mdi:check" className="w-4 h-4" />}
          >
            {isEditing ? '保存' : '创建'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/**
 * 获取颜色的十六进制值
 */
function getColorHex(color: string): string {
  const colorHexMap: Record<string, string> = {
    red: '#ef4444',
    yellow: '#eab308',
    green: '#22c55e',
    blue: '#3b82f6',
    orange: '#f97316',
    purple: '#a855f7',
    pink: '#ec4899',
    teal: '#14b8a6',
    cyan: '#06b6d4',
    lime: '#84cc16',
    indigo: '#6366f1',
    fuchsia: '#d946ef',
    rose: '#f43f5e',
    sky: '#0ea5e9',
    amber: '#f59e0b',
    emerald: '#10b981',
  };
  return colorHexMap[color] || '#6b7280';
}

export default AgentForm;
