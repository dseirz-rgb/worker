/**
 * Khoj 通知中心组件
 * 显示 Khoj 自动化任务的通知
 */

import * as React from 'react';
import { Bell, Check, Trash2, X, FileText, AlertCircle, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  khojAutomationService,
  type KhojNotification,
} from '../../services/khoj/automation';

interface NotificationCenterProps {
  /** 是否显示为弹出框 */
  asPopover?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

export function NotificationCenter({ asPopover, onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = React.useState<KhojNotification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);

  // 加载通知
  const loadNotifications = React.useCallback(() => {
    setNotifications(khojAutomationService.getNotifications());
    setUnreadCount(khojAutomationService.getUnreadCount());
  }, []);

  React.useEffect(() => {
    loadNotifications();
    // 定期刷新
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // 标记为已读
  const handleMarkAsRead = (id: string) => {
    khojAutomationService.markAsRead(id);
    loadNotifications();
  };

  // 标记全部已读
  const handleMarkAllAsRead = () => {
    khojAutomationService.markAllAsRead();
    loadNotifications();
  };

  // 删除通知
  const handleDelete = (id: string) => {
    khojAutomationService.deleteNotification(id);
    loadNotifications();
  };

  // 清空所有
  const handleClearAll = () => {
    if (window.confirm('确定要清空所有通知吗？')) {
      khojAutomationService.clearNotifications();
      loadNotifications();
    }
  };

  // 获取通知图标
  const getNotificationIcon = (type: KhojNotification['type']) => {
    switch (type) {
      case 'research':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'reminder':
        return <Bell className="h-4 w-4 text-yellow-500" />;
      case 'system':
        return <Info className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return date.toLocaleDateString();
  };

  const content = (
    <div className="space-y-2">
      {/* 头部 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">通知</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleMarkAllAsRead}
            >
              <Check className="h-3 w-3 mr-1" />
              全部已读
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={handleClearAll}
            >
              清空
            </Button>
          )}
          {asPopover && onClose && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 通知列表 */}
      <div className="max-h-80 overflow-y-auto space-y-1">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无通知</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 rounded-lg border transition-colors ${
                notification.read
                  ? 'bg-background'
                  : 'bg-accent/50 border-primary/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{notification.title}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTime(notification.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {notification.content}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!notification.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleMarkAsRead(notification.id)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                    onClick={() => handleDelete(notification.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (asPopover) {
    return (
      <div className="w-80 p-3 bg-background border rounded-lg shadow-lg">
        {content}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Bell className="h-4 w-4" />
          通知中心
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

/**
 * 通知铃铛按钮
 * 显示未读数量，点击打开通知中心
 */
export function NotificationBell() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const updateCount = () => {
      setUnreadCount(khojAutomationService.getUnreadCount());
    };

    updateCount();
    const interval = setInterval(updateCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 text-xs bg-red-500 text-white rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          {/* 弹出框 */}
          <div className="absolute right-0 top-full mt-2 z-50">
            <NotificationCenter asPopover onClose={() => setIsOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}

export default NotificationCenter;
