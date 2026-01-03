/**
 * EchoAI 对话侧边栏组件
 * 显示对话列表，支持新建、切换、删除对话
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Button, 
  ScrollShadow, 
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Spinner,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { Conversation } from '@/hooks/useEchoAIChat';

// ============================================
// 类型定义
// ============================================

interface ChatSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoading: boolean;
  onNewConversation: () => void;
  onSwitchConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// ============================================
// 组件
// ============================================

export function ChatSidebar({
  conversations,
  currentConversationId,
  isLoading,
  onNewConversation,
  onSwitchConversation,
  onDeleteConversation,
  isCollapsed = false,
  onToggleCollapse,
}: ChatSidebarProps) {
  const { t } = useTranslation();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // 格式化时间
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return t('today');
    if (days === 1) return t('yesterday');
    if (days < 7) return `${days} ${t('days-ago')}`;
    return date.toLocaleDateString();
  };

  // 折叠状态
  if (isCollapsed) {
    return (
      <div className="w-12 h-full flex flex-col items-center py-4 border-r border-divider bg-background/50">
        <Tooltip content={t('new-conversation')} placement="right">
          <Button
            isIconOnly
            variant="light"
            className="mb-4"
            onPress={onNewConversation}
          >
            <Icon icon="mdi:plus" className="w-5 h-5" />
          </Button>
        </Tooltip>
        
        <Tooltip content={t('expand-sidebar')} placement="right">
          <Button
            isIconOnly
            variant="light"
            onPress={onToggleCollapse}
          >
            <Icon icon="mdi:chevron-right" className="w-5 h-5" />
          </Button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="w-64 h-full flex flex-col border-r border-divider bg-background/50">
      {/* 头部 */}
      <div className="flex items-center justify-between p-3 border-b border-divider">
        <h2 className="font-medium text-sm">{t('conversations')}</h2>
        <div className="flex items-center gap-1">
          <Tooltip content={t('new-conversation')}>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={onNewConversation}
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
            </Button>
          </Tooltip>
          {onToggleCollapse && (
            <Tooltip content={t('collapse-sidebar')}>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={onToggleCollapse}
              >
                <Icon icon="mdi:chevron-left" className="w-4 h-4" />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* 对话列表 */}
      <ScrollShadow className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <Icon icon="mdi:chat-outline" className="w-12 h-12 text-default-300 mb-2" />
            <p className="text-sm text-default-400">{t('no-conversations')}</p>
            <Button
              size="sm"
              color="primary"
              variant="flat"
              className="mt-3"
              onPress={onNewConversation}
            >
              {t('start-new-conversation')}
            </Button>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            <AnimatePresence>
              {conversations.map((conv) => (
                <motion.div
                  key={conv.conversation_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`
                    group relative flex items-center gap-2 p-2 rounded-lg cursor-pointer
                    transition-colors duration-150
                    ${currentConversationId === conv.conversation_id 
                      ? 'bg-primary/10 text-primary' 
                      : 'hover:bg-default-100'
                    }
                  `}
                  onClick={() => onSwitchConversation(conv.conversation_id)}
                  onMouseEnter={() => setHoveredId(conv.conversation_id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* 图标 */}
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                    ${currentConversationId === conv.conversation_id 
                      ? 'bg-primary/20' 
                      : 'bg-default-100'
                    }
                  `}>
                    <Icon 
                      icon="mdi:chat-outline" 
                      className={`w-4 h-4 ${
                        currentConversationId === conv.conversation_id 
                          ? 'text-primary' 
                          : 'text-default-500'
                      }`} 
                    />
                  </div>

                  {/* 标题和时间 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {conv.slug || t('new-conversation')}
                    </p>
                    <p className="text-xs text-default-400">
                      {formatTime(conv.updated_at || conv.created_at)}
                    </p>
                  </div>

                  {/* 操作按钮 */}
                  {hoveredId === conv.conversation_id && (
                    <Dropdown>
                      <DropdownTrigger>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Icon icon="mdi:dots-vertical" className="w-4 h-4" />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="对话操作">
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          color="danger"
                          startContent={<Icon icon="mdi:delete-outline" className="w-4 h-4" />}
                          onPress={() => onDeleteConversation(conv.conversation_id)}
                        >
                          {t('delete')}
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollShadow>
    </div>
  );
}

export default ChatSidebar;
