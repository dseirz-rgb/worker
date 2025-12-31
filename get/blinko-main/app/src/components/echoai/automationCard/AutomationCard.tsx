/**
 * AutomationCard 组件
 * 显示单个自动化任务的卡片
 * 
 * 功能：
 * - 显示任务主题和查询内容
 * - 显示 Cron 表达式（转换为人类可读格式）
 * - 显示下次执行时间
 * - 提供运行、编辑、删除操作
 */

import { useState } from 'react';
import {
  Card,
  CardBody,
  Button,
  Chip,
  Tooltip,
  Divider,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { cronToHuman, formatNextRunTime } from './cronUtils';

// ============================================
// 类型定义
// ============================================

/**
 * Khoj 自动化任务类型
 */
export interface KhojAutomation {
  id: string;
  subject: string;
  query_to_run: string;
  scheduling_request: string;
  schedule: string;  // cron 表达式
  next_run_at: string;  // 下次执行时间
}

interface AutomationCardProps {
  automation: KhojAutomation;
  onRun?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isRunning?: boolean;
  isDeleting?: boolean;
}

// ============================================
// 主组件
// ============================================

export function AutomationCard({
  automation,
  onRun,
  onEdit,
  onDelete,
  isRunning = false,
  isDeleting = false,
}: AutomationCardProps) {
  const [isHovering, setIsHovering] = useState(false);

  // 解析 cron 表达式为人类可读格式
  const humanReadableSchedule = cronToHuman(automation.schedule);
  
  // 格式化下次执行时间
  const nextRunFormatted = formatNextRunTime(automation.next_run_at);

  // 判断任务是否即将执行（24小时内）
  const isUpcoming = () => {
    if (!automation.next_run_at) return false;
    const nextRun = new Date(automation.next_run_at);
    const now = new Date();
    const diff = nextRun.getTime() - now.getTime();
    return diff > 0 && diff < 24 * 60 * 60 * 1000;
  };

  return (
    <Card
      className="transition-all duration-200 hover:shadow-md"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <CardBody className="p-4">
        {/* 头部：主题和状态 */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* 图标 */}
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon icon="solar:clock-circle-bold-duotone" className="w-5 h-5 text-primary" />
            </div>
            
            {/* 主题 */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground truncate">
                {automation.subject || '未命名任务'}
              </h4>
              <p className="text-xs text-foreground/60">
                {humanReadableSchedule}
              </p>
            </div>
          </div>

          {/* 状态标签 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isUpcoming() && (
              <Chip
                size="sm"
                color="warning"
                variant="flat"
                startContent={<Icon icon="mdi:clock-alert-outline" className="w-3 h-3" />}
              >
                即将执行
              </Chip>
            )}
            <Chip
              size="sm"
              color="success"
              variant="flat"
              startContent={<Icon icon="mdi:check-circle-outline" className="w-3 h-3" />}
            >
              已启用
            </Chip>
          </div>
        </div>

        {/* 查询内容 */}
        <div className="bg-default-100 dark:bg-default-100/50 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="mdi:message-text-outline" className="w-4 h-4 text-foreground/50" />
            <span className="text-xs text-foreground/60">查询内容</span>
          </div>
          <p className="text-sm text-foreground line-clamp-3">
            {automation.query_to_run}
          </p>
        </div>

        {/* 调度信息 */}
        <div className="flex items-center gap-4 text-xs text-foreground/60 mb-3">
          {/* Cron 表达式 */}
          <Tooltip content={`Cron: ${automation.schedule}`}>
            <div className="flex items-center gap-1">
              <Icon icon="mdi:calendar-clock" className="w-4 h-4" />
              <span>{humanReadableSchedule}</span>
            </div>
          </Tooltip>

          {/* 下次执行时间 */}
          {automation.next_run_at && (
            <Tooltip content={`下次执行: ${new Date(automation.next_run_at).toLocaleString('zh-CN')}`}>
              <div className="flex items-center gap-1">
                <Icon icon="mdi:clock-outline" className="w-4 h-4" />
                <span>{nextRunFormatted}</span>
              </div>
            </Tooltip>
          )}
        </div>

        <Divider className="my-2" />

        {/* 操作按钮 */}
        <div className={`flex items-center justify-end gap-2 transition-opacity ${
          isHovering ? 'opacity-100' : 'opacity-60'
        }`}>
          {/* 立即运行 */}
          {onRun && (
            <Tooltip content="立即运行">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="primary"
                onPress={onRun}
                isLoading={isRunning}
                isDisabled={isDeleting}
              >
                <Icon icon="mdi:play" className="w-4 h-4" />
              </Button>
            </Tooltip>
          )}

          {/* 编辑 */}
          {onEdit && (
            <Tooltip content="编辑">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={onEdit}
                isDisabled={isRunning || isDeleting}
              >
                <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
              </Button>
            </Tooltip>
          )}

          {/* 删除 */}
          {onDelete && (
            <Tooltip content="删除">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="danger"
                onPress={onDelete}
                isLoading={isDeleting}
                isDisabled={isRunning}
              >
                <Icon icon="mdi:delete-outline" className="w-4 h-4" />
              </Button>
            </Tooltip>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

export default AutomationCard;
