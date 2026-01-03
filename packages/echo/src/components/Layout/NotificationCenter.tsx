/**
 * Echo v3.2: 通知中心组件
 * 显示通知列表和未读数量，支持标记已读和删除
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
  Spinner,
  Divider,
  ScrollShadow,
  Chip,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { api } from '@/lib/trpc';
import { RootStore } from '@/store';
import { ToastPlugin } from '@/store/module/Toast/Toast';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

// ============================================
// 类型定义
// ============================================

interface Notification {
  id: number;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  actionUrl?: string | null;
  createdAt: Date;
}

// 通知类型图标映射
const TYPE_ICONS: Record<string, string> = {
  report: 'mdi:file-document-outline',
  suggestion: 'mdi:lightbulb-outline',
  task: 'mdi:clipboard-check-outline',
  system: 'mdi:information-outline',
  follow: 'mdi:account-plus-outline',
  comment: 'mdi:comment-outline',
  mention: 'mdi:at',
};

// 通知类型颜色映射
const TYPE_COLORS: Record<string, string> = {
  report: 'text-amber-500',
  suggestion: 'text-violet-500',
  task: 'text-blue-500',
  system: 'text-gray-500',
  follow: 'text-green-500',
  comment: 'text-cyan-500',
  mention: 'text-pink-500',
};

// ============================================
// 组件
// ============================================

export function NotificationCenter() {
  const toast = RootStore.Get(ToastPlugin);
  const navigate = useNavigate();
  
  // 状态
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // 加载未读数量
  const loadUnreadCount = useCallback(async () => {
    try {
      const data = await api.notifications.getUnreadCount.query();
      setUnreadCount(data.count);
    } catch (error) {
      console.error('加载未读数量失败:', error);
    }
  }, []);

  // 加载通知列表
  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.notifications.list.query({ limit: 20 });
      setNotifications(data.notifications as Notification[]);
    } catch (error) {
      console.error('加载通知失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化加载未读数量
  useEffect(() => {
    loadUnreadCount();
    // 每 30 秒刷新一次
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  // 打开时加载通知列表
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  // 标记已读
  const handleMarkRead = async (notificationId: number) => {
    try {
      await api.notifications.markRead.mutate({ notificationIds: [notificationId] });
      await loadNotifications();
      await loadUnreadCount();
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  // 标记全部已读
  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      await api.notifications.markAllRead.mutate();
      toast.success('已全部标记为已读');
      await loadNotifications();
      await loadUnreadCount();
    } catch (error) {
      toast.error('操作失败');
    } finally {
      setIsMarkingAll(false);
    }
  };

  // 删除通知
  const handleDelete = async (e: React.MouseEvent, notificationId: number) => {
    e.stopPropagation();
    try {
      await api.notifications.delete.mutate({ notificationIds: [notificationId] });
      await loadNotifications();
      await loadUnreadCount();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  // 处理通知点击
  const handleNotificationClick = (notification: Notification) => {
    // 标记为已读
    if (!notification.isRead) {
      handleMarkRead(notification.id);
    }

    // 跳转到目标页面
    if (notification.actionUrl) {
      setIsOpen(false);
      navigate(notification.actionUrl);
    }
  };

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="bottom-end"
      offset={10}
    >
      <PopoverTrigger>
        <Button
          isIconOnly
          variant="light"
          className="relative"
          aria-label="通知"
        >
          <Icon icon="mdi:bell-outline" className="w-5 h-5" />
          {unreadCount > 0 && (
            <Chip
              size="sm"
              color="danger"
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] text-[10px] p-0"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Chip>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0">
        {/* 头部 */}
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">通知</h3>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="light"
              onPress={handleMarkAllRead}
              isLoading={isMarkingAll}
            >
              全部已读
            </Button>
          )}
        </div>

        {/* 通知列表 */}
        <ScrollShadow className="max-h-96">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                  onDelete={(e) => handleDelete(e, notification.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-foreground/50">
              <Icon icon="mdi:bell-off-outline" className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无通知</p>
            </div>
          )}
        </ScrollShadow>

        {/* 底部 */}
        {notifications.length > 0 && (
          <>
            <Divider />
            <div className="p-2">
              <Button
                size="sm"
                variant="light"
                className="w-full"
                onPress={() => {
                  setIsOpen(false);
                  navigate('/notifications');
                }}
              >
                查看全部通知
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// 通知项子组件
function NotificationItem({
  notification,
  onClick,
  onDelete,
}: {
  notification: Notification;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const icon = TYPE_ICONS[notification.type] || TYPE_ICONS.system;
  const iconColor = TYPE_COLORS[notification.type] || TYPE_COLORS.system;

  return (
    <div
      className={`p-3 cursor-pointer hover:bg-default-100 transition-colors group ${
        !notification.isRead ? 'bg-primary/5' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex gap-3">
        {/* 图标 */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-default-100 flex-shrink-0">
          <Icon icon={icon} className={`w-4 h-4 ${iconColor}`} />
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium truncate ${!notification.isRead ? 'text-foreground' : 'text-foreground/70'}`}>
              {notification.title}
            </p>
            {/* 未读标记 */}
            {!notification.isRead && (
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
            )}
          </div>
          <p className="text-xs text-foreground/50 line-clamp-2 mt-0.5">
            {notification.content}
          </p>
          <p className="text-xs text-foreground/40 mt-1">
            {formatDistanceToNow(new Date(notification.createdAt), {
              addSuffix: true,
              locale: zhCN,
            })}
          </p>
        </div>

        {/* 删除按钮 */}
        <Button
          isIconOnly
          size="sm"
          variant="light"
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onPress={onDelete as any}
        >
          <Icon icon="mdi:close" className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default NotificationCenter;
