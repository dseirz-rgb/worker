/**
 * RiskConfigPanel - 风控配置面板组件
 * Feature: intelligent-risk-engine
 * 
 * 支持配置风险偏好、最大回撤、通知渠道等。
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { getSupabaseClient } from '../../services/supabase';

// ============ 类型定义 ============

export type RiskPreference = 'conservative' | 'balanced' | 'aggressive';
export type NotificationChannel = 'toast' | 'email' | 'push';

export interface UserRiskConfig {
  userId: number;
  riskPreference: RiskPreference;
  maxAcceptableDrawdown: number;
  notificationChannels: NotificationChannel[];
  cooldownDuration: number; // 分钟
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
}

const CONFIG_TEMPLATES: ConfigTemplate[] = [
  {
    name: '保守型',
    description: '适合风险厌恶型投资者，严格控制回撤',
    config: {
      riskPreference: 'conservative',
      maxAcceptableDrawdown: 0.05,
      cooldownDuration: 120,
      autoStopLossEnabled: true,
    },
  },
  {
    name: '平衡型',
    description: '适合大多数投资者，平衡风险与收益',
    config: {
      riskPreference: 'balanced',
      maxAcceptableDrawdown: 0.10,
      cooldownDuration: 60,
      autoStopLossEnabled: true,
    },
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
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue: (value: number) => string;
}

function Slider({ value, min, max, step, onChange, formatValue }: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{formatValue(min)}</span>
        <span className="font-medium">{formatValue(value)}</span>
        <span className="text-muted-foreground">{formatValue(max)}</span>
      </div>
      <div className="relative h-2 bg-muted rounded-full">
        <div 
          className="absolute h-full bg-primary rounded-full"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full border-2 border-background shadow"
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-10 h-6 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-muted'
        )}
      >
        <span
          className={cn(
            'absolute top-1 w-4 h-4 rounded-full bg-background transition-transform',
            checked ? 'translate-x-5' : 'translate-x-1'
          )}
        />
      </button>
    </label>
  );
}

interface CheckboxGroupProps {
  options: { value: NotificationChannel; label: string }[];
  selected: NotificationChannel[];
  onChange: (selected: NotificationChannel[]) => void;
}

function CheckboxGroup({ options, selected, onChange }: CheckboxGroupProps) {
  const toggle = (value: NotificationChannel) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };
  
  return (
    <div className="space-y-2">
      {options.map(option => (
        <label 
          key={option.value}
          className="flex items-center gap-2 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={() => toggle(option.value)}
            className="w-4 h-4 rounded border-muted"
          />
          <span className="text-sm">{option.label}</span>
        </label>
      ))}
    </div>
  );
}

// ============ 主组件 ============

export function RiskConfigPanel({
  userId = 1,
  onSave,
  onCancel,
  className,
}: RiskConfigPanelProps) {
  const [config, setConfig] = useState<UserRiskConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // 加载配置
  useEffect(() => {
    async function loadConfig() {
      setIsLoading(true);
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          setConfig({ ...DEFAULT_CONFIG, userId });
          return;
        }
        
        const { data, error } = await supabase
          .from('user_risk_config')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        
        if (data) {
          setConfig({
            userId: data.user_id,
            riskPreference: data.risk_preference,
            maxAcceptableDrawdown: data.max_acceptable_drawdown,
            notificationChannels: data.notification_channels,
            cooldownDuration: data.cooldown_duration,
            autoStopLossEnabled: data.auto_stop_loss_enabled,
            updatedAt: new Date(data.updated_at),
          });
        } else {
          setConfig({ ...DEFAULT_CONFIG, userId });
        }
      } catch (err) {
        console.error('Failed to load config:', err);
        setError('加载配置失败');
      } finally {
        setIsLoading(false);
      }
    }
    
    loadConfig();
  }, [userId]);

  // 更新配置
  const updateConfig = useCallback((updates: Partial<UserRiskConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  // 应用模板
  const applyTemplate = useCallback((template: ConfigTemplate) => {
    updateConfig(template.config);
  }, [updateConfig]);

  // 保存配置
  const saveConfig = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('数据库连接不可用');
      }
      
      const { error } = await supabase
        .from('user_risk_config')
        .upsert({
          user_id: config.userId,
          risk_preference: config.riskPreference,
          max_acceptable_drawdown: config.maxAcceptableDrawdown,
          notification_channels: config.notificationChannels,
          cooldown_duration: config.cooldownDuration,
          auto_stop_loss_enabled: config.autoStopLossEnabled,
          updated_at: new Date().toISOString(),
        });
      
      if (error) throw error;
      
      setHasChanges(false);
      onSave?.(config);
    } catch (err) {
      console.error('Failed to save config:', err);
      setError('保存配置失败');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('p-4 rounded-lg border bg-card', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-20 bg-muted rounded" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-4 rounded-lg border bg-card', className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold">风控配置</h3>
        {hasChanges && (
          <span className="text-xs text-yellow-500">有未保存的更改</span>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 rounded bg-red-500/10 text-red-500 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* 配置模板 */}
        <Section 
          title="快速配置" 
          description="选择预设模板快速配置"
        >
          <div className="grid grid-cols-3 gap-2">
            {CONFIG_TEMPLATES.map(template => (
              <button
                key={template.name}
                onClick={() => applyTemplate(template)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-colors',
                  config.riskPreference === template.config.riskPreference
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                )}
              >
                <div className="text-sm font-medium">{template.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {template.description}
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* 风险偏好 */}
        <Section 
          title="风险偏好" 
          description="影响杠杆限制和止损线的计算"
        >
          <div className="flex gap-2">
            {(['conservative', 'balanced', 'aggressive'] as RiskPreference[]).map(pref => (
              <button
                key={pref}
                onClick={() => updateConfig({ riskPreference: pref })}
                className={cn(
                  'flex-1 py-2 px-3 rounded text-sm transition-colors',
                  config.riskPreference === pref
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {getRiskPreferenceLabel(pref)}
              </button>
            ))}
          </div>
        </Section>

        {/* 最大可接受回撤 */}
        <Section 
          title="最大可接受回撤" 
          description="超过此阈值将触发高风险预警"
        >
          <Slider
            value={config.maxAcceptableDrawdown}
            min={0.05}
            max={0.30}
            step={0.01}
            onChange={(value) => updateConfig({ maxAcceptableDrawdown: value })}
            formatValue={(v) => `${(v * 100).toFixed(0)}%`}
          />
        </Section>

        {/* 冷静期时长 */}
        <Section 
          title="冷静期时长" 
          description="检测到情绪化交易后的暂停时间"
        >
          <Slider
            value={config.cooldownDuration}
            min={15}
            max={240}
            step={15}
            onChange={(value) => updateConfig({ cooldownDuration: value })}
            formatValue={(v) => `${v} 分钟`}
          />
        </Section>

        {/* 通知渠道 */}
        <Section 
          title="通知渠道" 
          description="选择接收风险预警的方式"
        >
          <CheckboxGroup
            options={[
              { value: 'toast', label: getChannelLabel('toast') },
              { value: 'email', label: getChannelLabel('email') },
              { value: 'push', label: getChannelLabel('push') },
            ]}
            selected={config.notificationChannels}
            onChange={(channels) => updateConfig({ notificationChannels: channels })}
          />
        </Section>

        {/* 自动止损 */}
        <Section title="高级设置">
          <Toggle
            checked={config.autoStopLossEnabled}
            onChange={(checked) => updateConfig({ autoStopLossEnabled: checked })}
            label="启用自动止损"
          />
        </Section>
      </div>

      {/* 底部按钮 */}
      <div className="flex gap-3 mt-6 pt-4 border-t">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-4 rounded bg-muted hover:bg-muted/80 text-sm"
          >
            取消
          </button>
        )}
        <button
          onClick={saveConfig}
          disabled={isSaving || !hasChanges}
          className={cn(
            'flex-1 py-2 px-4 rounded text-sm transition-colors',
            hasChanges
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {isSaving ? '保存中...' : '保存配置'}
        </button>
      </div>

      {/* 更新时间 */}
      <div className="text-xs text-muted-foreground mt-4 text-center">
        上次更新: {config.updatedAt.toLocaleString('zh-CN')}
      </div>
    </div>
  );
}

export default RiskConfigPanel;
