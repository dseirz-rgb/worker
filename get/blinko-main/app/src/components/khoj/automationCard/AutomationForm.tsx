/**
 * AutomationForm 组件
 * 创建/编辑自动化任务的表单
 * 
 * 功能：
 * - 输入任务主题
 * - 输入查询内容
 * - 选择调度时间（预设或自定义 Cron）
 */

import { useState, useEffect } from 'react';
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
  Divider,
  Chip,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { CRON_PRESET_OPTIONS, isValidCron, cronToHuman } from './cronUtils';
import type { KhojAutomation } from './AutomationCard';

// ============================================
// 类型定义
// ============================================

export interface AutomationFormData {
  subject: string;
  query_to_run: string;
  scheduling_request: string;
}

interface AutomationFormProps {
  isOpen: boolean;
  onClose: () => void;
  automation?: KhojAutomation;  // 编辑时传入
  onSubmit: (data: AutomationFormData) => void;
  isSubmitting?: boolean;
}

// ============================================
// 主组件
// ============================================

export function AutomationForm({
  isOpen,
  onClose,
  automation,
  onSubmit,
  isSubmitting = false,
}: AutomationFormProps) {
  // 表单状态
  const [subject, setSubject] = useState('');
  const [queryToRun, setQueryToRun] = useState('');
  const [scheduleType, setScheduleType] = useState<'preset' | 'custom'>('preset');
  const [selectedPreset, setSelectedPreset] = useState(CRON_PRESET_OPTIONS[0].value);
  const [customCron, setCustomCron] = useState('');
  const [schedulingRequest, setSchedulingRequest] = useState('');
  
  // 验证状态
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 编辑模式时初始化表单
  useEffect(() => {
    if (automation) {
      setSubject(automation.subject || '');
      setQueryToRun(automation.query_to_run || '');
      setSchedulingRequest(automation.scheduling_request || '');
      
      // 检查是否匹配预设
      const matchedPreset = CRON_PRESET_OPTIONS.find(p => p.value === automation.schedule);
      if (matchedPreset) {
        setScheduleType('preset');
        setSelectedPreset(matchedPreset.value);
      } else {
        setScheduleType('custom');
        setCustomCron(automation.schedule || '');
      }
    } else {
      // 重置表单
      resetForm();
    }
  }, [automation, isOpen]);

  // 重置表单
  const resetForm = () => {
    setSubject('');
    setQueryToRun('');
    setScheduleType('preset');
    setSelectedPreset(CRON_PRESET_OPTIONS[0].value);
    setCustomCron('');
    setSchedulingRequest('');
    setErrors({});
  };

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!subject.trim()) {
      newErrors.subject = '请输入任务主题';
    }
    
    if (!queryToRun.trim()) {
      newErrors.queryToRun = '请输入查询内容';
    }
    
    if (scheduleType === 'custom') {
      if (!customCron.trim()) {
        newErrors.customCron = '请输入 Cron 表达式';
      } else if (!isValidCron(customCron)) {
        newErrors.customCron = 'Cron 表达式格式无效';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = () => {
    if (!validateForm()) return;
    
    // 构建调度请求描述
    const schedule = scheduleType === 'preset' ? selectedPreset : customCron;
    const scheduleDescription = cronToHuman(schedule);
    
    onSubmit({
      subject: subject.trim(),
      query_to_run: queryToRun.trim(),
      scheduling_request: schedulingRequest.trim() || scheduleDescription,
    });
  };

  // 关闭时重置
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // 获取当前选择的调度描述
  const getCurrentScheduleDescription = () => {
    if (scheduleType === 'preset') {
      const preset = CRON_PRESET_OPTIONS.find(p => p.value === selectedPreset);
      return preset?.description || '';
    }
    if (customCron && isValidCron(customCron)) {
      return cronToHuman(customCron);
    }
    return '';
  };

  const isEditMode = !!automation;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose}
      size="lg"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon 
              icon={isEditMode ? 'mdi:pencil' : 'mdi:plus'} 
              className="w-5 h-5 text-primary" 
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {isEditMode ? '编辑自动化任务' : '创建自动化任务'}
            </h3>
            <p className="text-sm text-foreground/60">
              设置定时执行的 AI 查询任务
            </p>
          </div>
        </ModalHeader>

        <Divider />

        <ModalBody className="py-4">
          <div className="space-y-4">
            {/* 任务主题 */}
            <Input
              label="任务主题"
              placeholder="例如：每日新闻摘要、周报生成..."
              value={subject}
              onValueChange={setSubject}
              isInvalid={!!errors.subject}
              errorMessage={errors.subject}
              startContent={
                <Icon icon="mdi:tag-outline" className="text-foreground/50" />
              }
              isRequired
            />

            {/* 查询内容 */}
            <Textarea
              label="查询内容"
              placeholder="输入要执行的 AI 查询，例如：总结今天的重要笔记..."
              value={queryToRun}
              onValueChange={setQueryToRun}
              isInvalid={!!errors.queryToRun}
              errorMessage={errors.queryToRun}
              minRows={3}
              maxRows={6}
              isRequired
            />

            <Divider />

            {/* 调度设置 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:clock-outline" className="text-foreground/50" />
                <span className="text-sm font-medium">调度设置</span>
              </div>

              {/* 调度类型选择 */}
              <div className="flex gap-2">
                <Chip
                  variant={scheduleType === 'preset' ? 'solid' : 'bordered'}
                  color={scheduleType === 'preset' ? 'primary' : 'default'}
                  className="cursor-pointer"
                  onClick={() => setScheduleType('preset')}
                >
                  常用时间
                </Chip>
                <Chip
                  variant={scheduleType === 'custom' ? 'solid' : 'bordered'}
                  color={scheduleType === 'custom' ? 'primary' : 'default'}
                  className="cursor-pointer"
                  onClick={() => setScheduleType('custom')}
                >
                  自定义 Cron
                </Chip>
              </div>

              {/* 预设选择 */}
              {scheduleType === 'preset' && (
                <Select
                  label="选择执行时间"
                  selectedKeys={[selectedPreset]}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    if (selected) setSelectedPreset(selected);
                  }}
                >
                  {CRON_PRESET_OPTIONS.map((option) => (
                    <SelectItem key={option.value} textValue={option.label}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-foreground/50">
                          {option.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </Select>
              )}

              {/* 自定义 Cron */}
              {scheduleType === 'custom' && (
                <div className="space-y-2">
                  <Input
                    label="Cron 表达式"
                    placeholder="分 时 日 月 周 (例如: 0 9 * * *)"
                    value={customCron}
                    onValueChange={setCustomCron}
                    isInvalid={!!errors.customCron}
                    errorMessage={errors.customCron}
                    description="格式: 分钟(0-59) 小时(0-23) 日(1-31) 月(1-12) 周(0-7)"
                  />
                  {customCron && isValidCron(customCron) && (
                    <div className="flex items-center gap-2 text-sm text-success">
                      <Icon icon="mdi:check-circle" className="w-4 h-4" />
                      <span>解析结果: {cronToHuman(customCron)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 调度描述预览 */}
              {getCurrentScheduleDescription() && (
                <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg">
                  <Icon icon="mdi:information-outline" className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground/70">
                    {getCurrentScheduleDescription()}
                  </span>
                </div>
              )}
            </div>

            {/* 调度请求描述（可选） */}
            <Input
              label="调度描述（可选）"
              placeholder="自然语言描述，例如：每天早上 9 点执行"
              value={schedulingRequest}
              onValueChange={setSchedulingRequest}
              description="用于 Khoj 理解调度意图，留空将自动生成"
            />
          </div>
        </ModalBody>

        <Divider />

        <ModalFooter>
          <Button
            variant="light"
            onPress={handleClose}
            isDisabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isLoading={isSubmitting}
            startContent={!isSubmitting && (
              <Icon icon={isEditMode ? 'mdi:check' : 'mdi:plus'} className="w-4 h-4" />
            )}
          >
            {isEditMode ? '保存修改' : '创建任务'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default AutomationForm;
