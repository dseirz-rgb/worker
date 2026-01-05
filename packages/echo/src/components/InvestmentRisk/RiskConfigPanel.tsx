/**
 * RiskConfigPanel - 风控配置面板组件 (HeroUI 版本)
 * 
 * 支持配置风险偏好、最大回撤、通知渠道等。
 * 从 RiskControl 移植并转换为 HeroUI 组件。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, CardHeader, Button, Switch, Slider, Checkbox, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';

// ============ 类型定义 ============

export type RiskPreference = 'conservative' | 'balanced' | 'aggressive';
export type NotificationChannel = 'toast' | 'email' | 'push';

export interface UserRiskConfig {
  userId: number;
  riskPreference: RiskPreference;
  maxAcceptableDrawdown: number;
  notificationChannels: NotificationChannel[];
  cooldownDuration: number;
  autoStopLossEnabled: boolean;
  updatedAt: Date;
}

export interface RiskConfigPanelProps {
  userId?: number;
  onSave?: (config: UserRiskConfig) => void;
  onCancel?: () => void;
  className?: string;
}


// ============ 默认配置 ============

const DEFAULT_CONFIG: UserRiskConfig = {
  userId: 1,
  riskPreference: 'balanced',
  maxAcceptableDrawdown: 0.10,
  notificationChannels: ['toast', 'email'],
  cooldownDuration: 60,
  autoStopLossEnabled: true,
  updatedAt: new Date(),
};

// ============ 配置模板 ============

interface ConfigTemplate {
  name: string;
  description: string;
  config: Partial<UserRiskConfig>;
  icon: string;
  color: 'success' | 'warning' | 'danger';
}

const CONFIG_TEMPLATES: ConfigTemplate[] = [
  {
    name: '保守型',
    description: '适合风险厌恶型投资者',
    config: {
      riskPreference: 'conservative',
      maxAcceptableDrawdown: 0.05,
      cooldownDuration: 120,
      autoStopLossEnabled: true,
    },
    icon: 'mdi:shield-check',
    color: 'success',
  },
  {
    name: '平衡型',
    description: '适合大多数投资者',
    config: {
      riskPreference: 'balanced',
      maxAcceptableDrawdown: 0.10,
      cooldownDuration: 60,
      autoStopLossEnabled: true,
    },
    icon: 'mdi:scale-balance',
    color: 'warning',
  },
  {
    name: '激进型',
    description: '适合风险承受能力强的投资者',
    config: {
      riskPreference: 'aggressive',
      maxAcceptableDrawdown: 0.20,
      cooldownDuration: 30,
      autoStopLossEnabled: false,
    },
    icon: 'mdi:rocket-launch',
    color: 'danger',
  },
];

// ============ 辅助函数 ============

function getRiskPreferenceLabel(pref: RiskPreference): string {
  switch (pref) {
    case 'conservative': return '保守型';
    case 'balanced': return '平衡型';
    case 'aggressive': return '激进型';
  }
}

function getChannelLabel(channel: NotificationChannel): string {
  switch (channel) {
    case 'toast': return '应用内通知';
    case 'email': return '邮件通知';
    case 'push': return '推送通知';
  }
}


// ============ 子组件 ============

interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function Section({ title, description, children }: SectionProps) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium">{title}</h4>
        {description && <p className="text-xs text-foreground/60 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// ============ 主组件 ============

export function RiskConfigPanel({
  userId = 1,
  onSave,
  onCancel,
  className = '',
}: RiskConfigPanelProps) {
  const [config, setConfig] = useState<UserRiskConfig>({ ...DEFAULT_CONFIG, userId });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // 更新配置
  const updateConfig = useCallback((updates: Partial<UserRiskConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  // 应用模板
  const applyTemplate = useCallback((template: ConfigTemplate) => {
    updateConfig(template.config);
  }, [updateConfig]);

  // 切换通知渠道
  const toggleChannel = useCallback((channel: NotificationChannel) => {
    setConfig(prev => {
      const channels = prev.notificationChannels.includes(channel)
        ? prev.notificationChannels.filter(c => c !== channel)
        : [...prev.notificationChannels, channel];
      return { ...prev, notificationChannels: channels };
    });
    setHasChanges(true);
  }, []);

  // 保存配置
  const saveConfig = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      // 模拟保存
      await new Promise(resolve => setTimeout(resolve, 500));
      setHasChanges(false);
      onSave?.(config);
    } catch (err) {
      setError('保存配置失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className={`bg-content1/50 backdrop-blur-sm ${className}`}>
      <CardHeader className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:cog" className="text-xl text-primary" />
          <h3 className="font-semibold">风控配置</h3>
        </div>
        {hasChanges && <Chip size="sm" color="warning" variant="flat">有未保存的更改</Chip>}
      </CardHeader>
      <CardBody className="space-y-6">
        {/* 错误提示 */}
        {error && (
          <div className="p-3 rounded bg-danger/10 text-danger text-sm">{error}</div>
        )}

        {/* 配置模板 */}
        <Section title="快速配置" description="选择预设模板快速配置">
          <div className="grid grid-cols-3 gap-2">
            {CONFIG_TEMPLATES.map(template => (
              <button
                key={template.name}
                onClick={() => applyTemplate(template)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  config.riskPreference === template.config.riskPreference
                    ? 'border-primary bg-primary/10'
                    : 'border-divider hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon icon={template.icon} className={`text-${template.color}`} />
                  <span className="text-sm font-medium">{template.name}</span>
                </div>
                <p className="text-xs text-foreground/60">{template.description}</p>
              </button>
            ))}
          </div>
        </Section>

        {/* 最大可接受回撤 */}
        <Section title="最大可接受回撤" description="超过此阈值将触发高风险预警">
          <div className="px-2">
            <Slider
              size="sm"
              step={0.01}
              minValue={0.05}
              maxValue={0.30}
              value={config.maxAcceptableDrawdown}
              onChange={(value) => updateConfig({ maxAcceptableDrawdown: value as number })}
              className="max-w-full"
              label="回撤阈值"
              getValue={(value) => `${((value as number) * 100).toFixed(0)}%`}
            />
          </div>
        </Section>

        {/* 冷静期时长 */}
        <Section title="冷静期时长" description="检测到情绪化交易后的暂停时间">
          <div className="px-2">
            <Slider
              size="sm"
              step={15}
              minValue={15}
              maxValue={240}
              value={config.cooldownDuration}
              onChange={(value) => updateConfig({ cooldownDuration: value as number })}
              className="max-w-full"
              label="冷静期"
              getValue={(value) => `${value} 分钟`}
            />
          </div>
        </Section>

        {/* 通知渠道 */}
        <Section title="通知渠道" description="选择接收风险预警的方式">
          <div className="space-y-2">
            {(['toast', 'email', 'push'] as NotificationChannel[]).map(channel => (
              <Checkbox
                key={channel}
                isSelected={config.notificationChannels.includes(channel)}
                onValueChange={() => toggleChannel(channel)}
              >
                {getChannelLabel(channel)}
              </Checkbox>
            ))}
          </div>
        </Section>

        {/* 自动止损 */}
        <Section title="高级设置">
          <Switch
            isSelected={config.autoStopLossEnabled}
            onValueChange={(checked) => updateConfig({ autoStopLossEnabled: checked })}
          >
            启用自动止损
          </Switch>
        </Section>

        {/* 底部按钮 */}
        <div className="flex gap-3 pt-4 border-t border-divider">
          {onCancel && (
            <Button variant="flat" className="flex-1" onPress={onCancel}>取消</Button>
          )}
          <Button
            color="primary"
            className="flex-1"
            isLoading={isSaving}
            isDisabled={!hasChanges}
            onPress={saveConfig}
          >
            保存配置
          </Button>
        </div>

        {/* 更新时间 */}
        <div className="text-xs text-foreground/50 text-center">
          上次更新: {config.updatedAt.toLocaleString('zh-CN')}
        </div>
      </CardBody>
    </Card>
  );
}

export default RiskConfigPanel;
