/**
 * AgentCard 组件 - Agent 信息卡片
 * 
 * 显示 Khoj Agent 的基本信息，包括头像、名称、描述和操作按钮
 */

import React from 'react';
import { Card, CardBody, Button, Chip, Tooltip } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { cn } from '@heroui/react';
import { 
  convertColorToTextClass, 
  convertToBGGradientClass,
  convertColorToBorderClass,
  tailwindColors 
} from '../common/colorUtils';
import { getIconFromIconName, iconMap } from '../common/iconUtils';

/**
 * Khoj Agent 类型定义
 */
export interface KhojAgent {
  slug: string;
  name: string;
  personality: string;
  avatar?: string;
  color?: string;
  icon?: string;
  privacy_level?: string;
  chat_model?: string;
  tools?: string[];
  public?: boolean;
}

/**
 * AgentCard 组件属性
 */
export interface AgentCardProps {
  /** Agent 数据 */
  agent: KhojAgent;
  /** 选择回调 */
  onSelect?: () => void;
  /** 编辑回调 */
  onEdit?: () => void;
  /** 删除回调 */
  onDelete?: () => void;
  /** 是否选中 */
  isSelected?: boolean;
  /** 是否显示操作按钮 */
  showActions?: boolean;
}

/**
 * 获取 Agent 的显示颜色
 */
function getAgentColor(agent: KhojAgent): string {
  if (agent.color && tailwindColors.includes(agent.color)) {
    return agent.color;
  }
  // 根据名称生成一个稳定的颜色
  const hash = agent.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return tailwindColors[hash % tailwindColors.length];
}

/**
 * 获取 Agent 的图标
 */
function getAgentIcon(agent: KhojAgent): string {
  if (agent.icon && iconMap[agent.icon]) {
    return iconMap[agent.icon];
  }
  return 'mdi:robot-outline';
}

/**
 * AgentCard 组件
 * 显示 Agent 信息卡片，支持选择、编辑、删除操作
 */
export function AgentCard({
  agent,
  onSelect,
  onEdit,
  onDelete,
  isSelected = false,
  showActions = true,
}: AgentCardProps) {
  const color = getAgentColor(agent);
  const iconName = getAgentIcon(agent);
  const colorClass = convertColorToTextClass(color);
  const borderClass = convertColorToBorderClass(color);
  const bgGradientClass = convertToBGGradientClass(color);

  return (
    <Card
      isPressable={!!onSelect}
      onPress={onSelect}
      className={cn(
        'transition-all duration-200',
        'hover:scale-[1.02] hover:shadow-lg',
        isSelected && `ring-2 ring-offset-2 ${borderClass}`,
        bgGradientClass
      )}
    >
      <CardBody className="p-4">
        <div className="flex flex-col gap-3">
          {/* 头部：头像和操作按钮 */}
          <div className="flex items-start justify-between">
            {/* 头像 */}
            <div 
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                'bg-default-100 dark:bg-default-100/50'
              )}
              style={{
                backgroundColor: `hsl(var(--heroui-${color}-100))`,
              }}
            >
              <Icon 
                icon={iconName} 
                className={cn('w-7 h-7', colorClass)} 
              />
            </div>

            {/* 操作按钮 */}
            {showActions && (
              <div className="flex items-center gap-1">
                {/* 公开/私有标识 */}
                {agent.public !== undefined && (
                  <Tooltip content={agent.public ? '公开' : '私有'}>
                    <Chip
                      size="sm"
                      variant="flat"
                      color={agent.public ? 'success' : 'default'}
                      startContent={
                        <Icon 
                          icon={agent.public ? 'mdi:earth' : 'mdi:lock-outline'} 
                          className="w-3 h-3" 
                        />
                      }
                    >
                      {agent.public ? '公开' : '私有'}
                    </Chip>
                  </Tooltip>
                )}

                {/* 编辑按钮 */}
                {onEdit && (
                  <Tooltip content="编辑">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      onPress={(e) => {
                        e.stopPropagation?.();
                        onEdit();
                      }}
                    >
                      <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
                    </Button>
                  </Tooltip>
                )}

                {/* 删除按钮 */}
                {onDelete && (
                  <Tooltip content="删除" color="danger">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={(e) => {
                        e.stopPropagation?.();
                        onDelete();
                      }}
                    >
                      <Icon icon="mdi:delete-outline" className="w-4 h-4" />
                    </Button>
                  </Tooltip>
                )}
              </div>
            )}
          </div>

          {/* 名称 */}
          <h3 className="text-lg font-semibold line-clamp-1">{agent.name}</h3>

          {/* 描述 */}
          <p className="text-sm text-foreground/60 line-clamp-2 min-h-[2.5rem]">
            {agent.personality || '暂无描述'}
          </p>

          {/* 工具标签 */}
          {agent.tools && agent.tools.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {agent.tools.slice(0, 3).map((tool) => (
                <Chip
                  key={tool}
                  size="sm"
                  variant="flat"
                  className="text-xs"
                >
                  {tool}
                </Chip>
              ))}
              {agent.tools.length > 3 && (
                <Chip size="sm" variant="flat" className="text-xs">
                  +{agent.tools.length - 3}
                </Chip>
              )}
            </div>
          )}

          {/* 底部提示 */}
          {onSelect && (
            <div className="flex items-center gap-1 text-xs text-foreground/40 mt-2">
              <Icon icon="mdi:arrow-right" className="w-4 h-4" />
              <span>点击选择</span>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

export default AgentCard;
