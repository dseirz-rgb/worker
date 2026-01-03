/**
 * 风控设置页面 - Risk Settings (2026)
 * 配置风控阈值参数
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Shield,
  ArrowLeft,
  Save,
  RotateCcw,
  Activity,
  TrendingDown,
  Target,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui';
import { Slider } from '@/components/ui/slider';
import {
  getRiskThresholds,
  saveRiskThresholds,
  resetRiskThresholds,
  DEFAULT_RISK_THRESHOLDS,
  type RiskThresholds,
} from '@/services/riskDataService';
import { AIPersonalityDisplay } from '@/components/settings/AIPersonalityDisplay';

// ============ 配置项组件 ============

interface ConfigItemProps {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  icon: React.ReactNode;
}

function ConfigItem({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  icon,
}: ConfigItemProps) {
  return (
    <div className="flex items-start gap-4 p-4 bg-bg-tertiary/50 rounded-lg">
      <div className="p-2 bg-accent-cyan/10 rounded-lg text-accent-cyan">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-text-primary">{label}</span>
          <span className="font-mono text-accent-cyan text-lg">
            {value.toFixed(step < 1 ? 1 : 0)}{unit}
          </span>
        </div>
        <p className="text-xs text-text-muted mb-3">{description}</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted w-8">{min}{unit}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-bg-tertiary rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-accent-cyan
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:shadow-lg
              [&::-webkit-slider-thumb]:transition-transform
              [&::-webkit-slider-thumb]:hover:scale-110
              [&::-moz-range-thumb]:w-4
              [&::-moz-range-thumb]:h-4
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-accent-cyan
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:cursor-pointer"
          />
          <span className="text-xs text-text-muted w-8 text-right">{max}{unit}</span>
        </div>
      </div>
    </div>
  );
}

// ============ 配置分组组件 ============

interface ConfigSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function ConfigSection({ title, description, icon, children }: ConfigSectionProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-accent-cyan/20 rounded-lg text-accent-cyan">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-text-primary">{title}</h3>
          <p className="text-xs text-text-muted">{description}</p>
        </div>
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </Card>
  );
}

// ============ 主页面组件 ============

export default function RiskSettings() {
  const [, setLocation] = useLocation();
  const [thresholds, setThresholds] = useState<RiskThresholds | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 加载配置
  useEffect(() => {
    loadThresholds();
  }, []);

  const loadThresholds = async () => {
    setIsLoading(true);
    try {
      const data = await getRiskThresholds(1);
      setThresholds(data);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load thresholds:', error);
      toast.error('加载配置失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 更新单个配置项
  const updateThreshold = (key: keyof RiskThresholds, value: number) => {
    if (!thresholds) return;
    setThresholds({ ...thresholds, [key]: value });
    setHasChanges(true);
  };

  // 保存配置
  const handleSave = async () => {
    if (!thresholds) return;
    
    setIsSaving(true);
    try {
      const result = await saveRiskThresholds(1, {
        leverage_warning: thresholds.leverage_warning,
        leverage_critical: thresholds.leverage_critical,
        leverage_in_drawdown: thresholds.leverage_in_drawdown,
        monthly_drawdown_warning: thresholds.monthly_drawdown_warning,
        monthly_drawdown_critical: thresholds.monthly_drawdown_critical,
        trailing_stop_percent: thresholds.trailing_stop_percent,
        losing_streak_warning: thresholds.losing_streak_warning,
        losing_streak_critical: thresholds.losing_streak_critical,
      });
      
      if (result) {
        toast.success('配置已保存');
        setHasChanges(false);
      } else {
        toast.error('保存失败');
      }
    } catch (error) {
      console.error('Failed to save thresholds:', error);
      toast.error('保存配置失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 恢复默认值
  const handleReset = async () => {
    setIsSaving(true);
    try {
      const result = await resetRiskThresholds(1);
      if (result) {
        setThresholds(result);
        setHasChanges(false);
        toast.success('已恢复默认配置');
      } else {
        toast.error('恢复失败');
      }
    } catch (error) {
      console.error('Failed to reset thresholds:', error);
      toast.error('恢复默认配置失败');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">加载风控配置...</p>
        </div>
      </div>
    );
  }

  if (!thresholds) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-red-500">
          <p>加载配置失败</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation('/risk-center')}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="text-accent-cyan" />
              风控设置
            </h1>
            <p className="text-sm text-muted-foreground">配置风控阈值参数</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="warning" className="mr-2">
              有未保存的更改
            </Badge>
          )}
          <button
            onClick={handleReset}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors disabled:opacity-50"
          >
            <RotateCcw size={16} />
            恢复默认值
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2 bg-accent-cyan/20 hover:bg-accent-cyan/30 text-accent-cyan rounded-lg transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {isSaving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      {/* 配置区域 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 杠杆阈值配置 */}
        <ConfigSection
          title="杠杆阈值"
          description="控制杠杆率的警告和危险阈值"
          icon={<Activity size={20} />}
        >
          <ConfigItem
            label="杠杆警告阈值"
            description="超过此值时触发警告提醒"
            value={thresholds.leverage_warning}
            onChange={(v) => updateThreshold('leverage_warning', v)}
            min={1.0}
            max={2.0}
            step={0.1}
            unit="x"
            icon={<Activity size={16} />}
          />
          <ConfigItem
            label="杠杆危险阈值"
            description="超过此值时触发危险警报，建议立即减仓"
            value={thresholds.leverage_critical}
            onChange={(v) => updateThreshold('leverage_critical', v)}
            min={1.5}
            max={3.0}
            step={0.1}
            unit="x"
            icon={<Activity size={16} />}
          />
          <ConfigItem
            label="回撤期杠杆限制"
            description="当处于回撤状态时，杠杆上限降低到此值"
            value={thresholds.leverage_in_drawdown}
            onChange={(v) => updateThreshold('leverage_in_drawdown', v)}
            min={1.0}
            max={1.5}
            step={0.1}
            unit="x"
            icon={<Activity size={16} />}
          />
        </ConfigSection>

        {/* 回撤阈值配置 */}
        <ConfigSection
          title="月度回撤阈值"
          description="控制月度最大回撤的警告和止损线"
          icon={<TrendingDown size={20} />}
        >
          <ConfigItem
            label="月度回撤警告"
            description="月度回撤达到此百分比时触发警告"
            value={thresholds.monthly_drawdown_warning}
            onChange={(v) => updateThreshold('monthly_drawdown_warning', v)}
            min={5}
            max={15}
            step={1}
            unit="%"
            icon={<TrendingDown size={16} />}
          />
          <ConfigItem
            label="月度回撤止损"
            description="月度回撤达到此百分比时触发强制止损"
            value={thresholds.monthly_drawdown_critical}
            onChange={(v) => updateThreshold('monthly_drawdown_critical', v)}
            min={10}
            max={25}
            step={1}
            unit="%"
            icon={<TrendingDown size={16} />}
          />
        </ConfigSection>

        {/* 移动止盈配置 */}
        <ConfigSection
          title="移动止盈"
          description="基于高水位的移动止盈策略"
          icon={<Target size={20} />}
        >
          <ConfigItem
            label="移动止盈百分比"
            description="当净值从高水位回撤超过此百分比时触发止盈"
            value={thresholds.trailing_stop_percent}
            onChange={(v) => updateThreshold('trailing_stop_percent', v)}
            min={10}
            max={25}
            step={1}
            unit="%"
            icon={<Target size={16} />}
          />
          <div className="p-3 bg-accent-cyan/5 border border-accent-cyan/20 rounded-lg">
            <p className="text-xs text-text-muted">
              💡 <strong>移动止盈说明：</strong>系统会记录历史最高净值（HWM），
              当当前净值低于 HWM × (1 - 止盈百分比) 时触发止盈警报。
              建议设置在 15%-20% 之间。
            </p>
          </div>
        </ConfigSection>

        {/* 连败阈值配置 */}
        <ConfigSection
          title="连败阈值"
          description="控制连续亏损天数的警告阈值"
          icon={<Calendar size={20} />}
        >
          <ConfigItem
            label="连败警告天数"
            description="连续亏损达到此天数时触发警告"
            value={thresholds.losing_streak_warning}
            onChange={(v) => updateThreshold('losing_streak_warning', Math.round(v))}
            min={2}
            max={5}
            step={1}
            unit="天"
            icon={<Calendar size={16} />}
          />
          <ConfigItem
            label="连败危险天数"
            description="连续亏损达到此天数时触发危险警报"
            value={thresholds.losing_streak_critical}
            onChange={(v) => updateThreshold('losing_streak_critical', Math.round(v))}
            min={3}
            max={10}
            step={1}
            unit="天"
            icon={<Calendar size={16} />}
          />
          <div className="p-3 bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg">
            <p className="text-xs text-text-muted">
              ⚠️ <strong>连败提醒：</strong>连续亏损可能表明市场环境不适合当前策略，
              建议在连败期间减少交易频率，等待市场回暖。
            </p>
          </div>
        </ConfigSection>
      </div>

      {/* 当前配置摘要 */}
      <Card className="p-5">
        <h3 className="font-semibold text-text-primary mb-4">当前配置摘要</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-bg-tertiary/50 rounded-lg">
            <div className="text-xs text-text-muted mb-1">杠杆警告/危险</div>
            <div className="font-mono text-lg">
              <span className="text-yellow-500">{thresholds.leverage_warning}x</span>
              <span className="text-text-muted mx-1">/</span>
              <span className="text-red-500">{thresholds.leverage_critical}x</span>
            </div>
          </div>
          <div className="p-3 bg-bg-tertiary/50 rounded-lg">
            <div className="text-xs text-text-muted mb-1">回撤期杠杆限制</div>
            <div className="font-mono text-lg text-accent-cyan">
              {thresholds.leverage_in_drawdown}x
            </div>
          </div>
          <div className="p-3 bg-bg-tertiary/50 rounded-lg">
            <div className="text-xs text-text-muted mb-1">月度回撤警告/止损</div>
            <div className="font-mono text-lg">
              <span className="text-yellow-500">{thresholds.monthly_drawdown_warning}%</span>
              <span className="text-text-muted mx-1">/</span>
              <span className="text-red-500">{thresholds.monthly_drawdown_critical}%</span>
            </div>
          </div>
          <div className="p-3 bg-bg-tertiary/50 rounded-lg">
            <div className="text-xs text-text-muted mb-1">移动止盈</div>
            <div className="font-mono text-lg text-accent-cyan">
              {thresholds.trailing_stop_percent}%
            </div>
          </div>
          <div className="p-3 bg-bg-tertiary/50 rounded-lg">
            <div className="text-xs text-text-muted mb-1">连败警告/危险</div>
            <div className="font-mono text-lg">
              <span className="text-yellow-500">{thresholds.losing_streak_warning}天</span>
              <span className="text-text-muted mx-1">/</span>
              <span className="text-red-500">{thresholds.losing_streak_critical}天</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 默认值参考 */}
      <Card className="p-5 border-dashed">
        <h3 className="font-semibold text-text-muted mb-3">默认值参考</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-text-muted">杠杆警告：</span>
            <span className="font-mono">{DEFAULT_RISK_THRESHOLDS.leverage_warning}x</span>
          </div>
          <div>
            <span className="text-text-muted">杠杆危险：</span>
            <span className="font-mono">{DEFAULT_RISK_THRESHOLDS.leverage_critical}x</span>
          </div>
          <div>
            <span className="text-text-muted">回撤期杠杆：</span>
            <span className="font-mono">{DEFAULT_RISK_THRESHOLDS.leverage_in_drawdown}x</span>
          </div>
          <div>
            <span className="text-text-muted">月度回撤警告：</span>
            <span className="font-mono">{DEFAULT_RISK_THRESHOLDS.monthly_drawdown_warning}%</span>
          </div>
          <div>
            <span className="text-text-muted">月度回撤止损：</span>
            <span className="font-mono">{DEFAULT_RISK_THRESHOLDS.monthly_drawdown_critical}%</span>
          </div>
          <div>
            <span className="text-text-muted">移动止盈：</span>
            <span className="font-mono">{DEFAULT_RISK_THRESHOLDS.trailing_stop_percent}%</span>
          </div>
          <div>
            <span className="text-text-muted">连败警告：</span>
            <span className="font-mono">{DEFAULT_RISK_THRESHOLDS.losing_streak_warning}天</span>
          </div>
          <div>
            <span className="text-text-muted">连败危险：</span>
            <span className="font-mono">{DEFAULT_RISK_THRESHOLDS.losing_streak_critical}天</span>
          </div>
        </div>
      </Card>

      {/* AI 调教公示 */}
      <Card className="p-5">
        <AIPersonalityDisplay />
      </Card>
    </div>
  );
}
