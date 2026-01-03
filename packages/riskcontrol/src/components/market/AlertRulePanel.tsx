/**
 * AlertRulePanel - 警报规则面板组件
 * Feature: realtime-market-platform
 * 
 * 实现警报规则列表展示、创建/编辑/删除警报规则
 * 
 * Requirements: 3.1, 3.3, 3.4
 */

import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Bell, Plus, Trash2, Edit2, BellOff } from 'lucide-react';
import {
  getRules,
  createRule,
  updateRule,
  deleteRule,
  type AlertRule,
  type AlertConditionType,
  type NotificationChannel,
  type CreateAlertRuleInput,
  type UpdateAlertRuleInput,
} from '../../services/priceAlertService';

// ============ 类型定义 ============

export interface AlertRulePanelProps {
  userId: string;
  ticker?: string;
  onRuleChange?: () => void;
  className?: string;
}

interface RuleFormData {
  ticker: string;
  conditionType: AlertConditionType;
  targetValue: string;
  notificationChannels: NotificationChannel[];
  enabled: boolean;
}

// ============ 常量 ============

const CONDITION_TYPES: { value: AlertConditionType; label: string }[] = [
  { value: 'price_above', label: '价格高于' },
  { value: 'price_below', label: '价格低于' },
  { value: 'change_above', label: '涨幅超过' },
  { value: 'change_below', label: '跌幅超过' },
  { value: 'break_ma', label: '突破均线' },
];

const NOTIFICATION_CHANNELS: { value: NotificationChannel; label: string }[] = [
  { value: 'toast', label: '应用内通知' },
  { value: 'browser', label: '浏览器通知' },
  { value: 'email', label: '邮件通知' },
];

const MA_PERIODS = [5, 10, 20];

// ============ 组件实现 ============

export function AlertRulePanel({
  userId,
  ticker,
  onRuleChange,
  className,
}: AlertRulePanelProps) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [formData, setFormData] = useState<RuleFormData>({
    ticker: ticker || '',
    conditionType: 'price_above',
    targetValue: '',
    notificationChannels: ['toast'],
    enabled: true,
  });

  // 加载规则
  useEffect(() => {
    loadRules();
  }, [userId]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const userRules = await getRules(userId);
      // 如果指定了 ticker，只显示该股票的规则
      const filteredRules = ticker
        ? userRules.filter(r => r.ticker === ticker.toUpperCase())
        : userRules;
      setRules(filteredRules);
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  };

  // 打开创建对话框
  const handleCreate = () => {
    setEditingRule(null);
    setFormData({
      ticker: ticker || '',
      conditionType: 'price_above',
      targetValue: '',
      notificationChannels: ['toast'],
      enabled: true,
    });
    setIsDialogOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setFormData({
      ticker: rule.ticker,
      conditionType: rule.conditionType,
      targetValue: rule.targetValue.toString(),
      notificationChannels: rule.notificationChannels,
      enabled: rule.enabled,
    });
    setIsDialogOpen(true);
  };

  // 删除规则
  const handleDelete = async (ruleId: string) => {
    if (!confirm('确定要删除这条警报规则吗？')) return;
    
    const success = await deleteRule(ruleId, userId);
    if (success) {
      await loadRules();
      onRuleChange?.();
    }
  };

  // 切换启用状态
  const handleToggleEnabled = async (rule: AlertRule) => {
    const updated = await updateRule(rule.id, userId, { enabled: !rule.enabled });
    if (updated) {
      await loadRules();
      onRuleChange?.();
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    const targetValue = parseFloat(formData.targetValue);
    if (isNaN(targetValue)) {
      alert('请输入有效的目标值');
      return;
    }

    if (!formData.ticker) {
      alert('请输入股票代码');
      return;
    }

    if (formData.notificationChannels.length === 0) {
      alert('请至少选择一种通知方式');
      return;
    }

    if (editingRule) {
      // 更新规则
      const input: UpdateAlertRuleInput = {
        conditionType: formData.conditionType,
        targetValue,
        notificationChannels: formData.notificationChannels,
        enabled: formData.enabled,
      };
      const updated = await updateRule(editingRule.id, userId, input);
      if (updated) {
        setIsDialogOpen(false);
        await loadRules();
        onRuleChange?.();
      }
    } else {
      // 创建规则
      const input: CreateAlertRuleInput = {
        ticker: formData.ticker.toUpperCase(),
        conditionType: formData.conditionType,
        targetValue,
        notificationChannels: formData.notificationChannels,
        enabled: formData.enabled,
      };
      const created = await createRule(userId, input);
      if (created) {
        setIsDialogOpen(false);
        await loadRules();
        onRuleChange?.();
      }
    }
  };

  // 获取条件描述
  const getConditionDescription = (rule: AlertRule) => {
    const conditionLabel = CONDITION_TYPES.find(c => c.value === rule.conditionType)?.label || '';
    if (rule.conditionType === 'break_ma') {
      return `${conditionLabel} MA${rule.targetValue}`;
    }
    if (rule.conditionType === 'change_above' || rule.conditionType === 'change_below') {
      return `${conditionLabel} ${rule.targetValue}%`;
    }
    return `${conditionLabel} ${rule.targetValue}`;
  };

  // 渲染通知渠道标签
  const renderChannelBadges = (channels: NotificationChannel[]) => {
    return channels.map(channel => {
      const label = NOTIFICATION_CHANNELS.find(c => c.value === channel)?.label || channel;
      return (
        <span
          key={channel}
          className="text-xs bg-muted px-1.5 py-0.5 rounded"
        >
          {label}
        </span>
      );
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          价格警报
        </h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1" />
              添加警报
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRule ? '编辑警报规则' : '创建警报规则'}
              </DialogTitle>
              <DialogDescription>
                设置价格警报，当条件满足时会收到通知
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* 股票代码 */}
              <div className="space-y-2">
                <Label>股票代码</Label>
                <Input
                  value={formData.ticker}
                  onChange={e => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                  placeholder="如 AAPL, 600519"
                  disabled={!!ticker}
                />
              </div>

              {/* 条件类型 */}
              <div className="space-y-2">
                <Label>条件类型</Label>
                <Select
                  value={formData.conditionType}
                  onValueChange={(value: AlertConditionType) => 
                    setFormData({ ...formData, conditionType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 目标值 */}
              <div className="space-y-2">
                <Label>
                  {formData.conditionType === 'break_ma' ? '均线周期' : '目标值'}
                </Label>
                {formData.conditionType === 'break_ma' ? (
                  <Select
                    value={formData.targetValue}
                    onValueChange={value => setFormData({ ...formData, targetValue: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择均线" />
                    </SelectTrigger>
                    <SelectContent>
                      {MA_PERIODS.map(period => (
                        <SelectItem key={period} value={period.toString()}>
                          MA{period}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="number"
                    value={formData.targetValue}
                    onChange={e => setFormData({ ...formData, targetValue: e.target.value })}
                    placeholder={
                      formData.conditionType.includes('change') ? '如 5 (表示5%)' : '如 150.00'
                    }
                  />
                )}
              </div>

              {/* 通知方式 */}
              <div className="space-y-2">
                <Label>通知方式</Label>
                <div className="flex flex-wrap gap-2">
                  {NOTIFICATION_CHANNELS.map(channel => (
                    <label
                      key={channel.value}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                        formData.notificationChannels.includes(channel.value)
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={formData.notificationChannels.includes(channel.value)}
                        onChange={e => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              notificationChannels: [...formData.notificationChannels, channel.value],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              notificationChannels: formData.notificationChannels.filter(
                                c => c !== channel.value
                              ),
                            });
                          }
                        }}
                        className="sr-only"
                      />
                      <span className="text-sm">{channel.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 启用状态 */}
              <div className="flex items-center justify-between">
                <Label>启用警报</Label>
                <Switch
                  checked={formData.enabled}
                  onCheckedChange={checked => setFormData({ ...formData, enabled: checked })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSubmit}>
                {editingRule ? '保存' : '创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 规则列表 */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          加载中...
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <BellOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>暂无警报规则</p>
          <p className="text-sm">点击上方按钮添加新的价格警报</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg border',
                rule.enabled ? 'bg-card' : 'bg-muted/50 opacity-60'
              )}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{rule.ticker}</span>
                  <span className="text-sm text-muted-foreground">
                    {getConditionDescription(rule)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {renderChannelBadges(rule.notificationChannels)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={() => handleToggleEnabled(rule)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(rule)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(rule.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AlertRulePanel;
