/**
 * 活动统计页面 - Echo on Blinko 扩展
 * 
 * 显示用户的应用使用时间统计和时间线
 */

import React, { useState, useEffect, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { 
  Button, 
  Card,
  CardBody,
  CardHeader,
  Divider,
  Spinner,
  Chip,
  Progress,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Switch
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { ScrollArea } from '@/components/Common/ScrollArea';
import { api } from '@/lib/trpc';
import { isDesktop } from '@/lib/tauriHelper';
import { createActivityMonitor, ActivityRecord } from '@/lib/activity';
import dayjs from 'dayjs';

interface AppStats {
  appName: string;
  totalDuration: number;
  count: number;
}

interface DomainStats {
  domainName: string;
  totalDuration: number;
  count: number;
}

interface TimelineItem {
  id: number;
  appName: string;
  windowTitle: string;
  duration: number;
  startTime: Date;
  endTime: Date;
  domain?: { name: string; color: string } | null;
}

// 格式化时长
const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
};

// 获取应用图标
const getAppIcon = (appName: string): string => {
  const name = appName.toLowerCase();
  if (name.includes('chrome') || name.includes('浏览器')) return 'mdi:google-chrome';
  if (name.includes('safari')) return 'mdi:apple-safari';
  if (name.includes('firefox')) return 'mdi:firefox';
  if (name.includes('edge')) return 'mdi:microsoft-edge';
  if (name.includes('code') || name.includes('vscode')) return 'mdi:microsoft-visual-studio-code';
  if (name.includes('terminal') || name.includes('iterm')) return 'mdi:console';
  if (name.includes('slack')) return 'mdi:slack';
  if (name.includes('discord')) return 'mdi:discord';
  if (name.includes('wechat') || name.includes('微信')) return 'mdi:wechat';
  if (name.includes('notion')) return 'mdi:notion';
  if (name.includes('figma')) return 'mdi:drawing';
  if (name.includes('spotify')) return 'mdi:spotify';
  if (name.includes('music') || name.includes('音乐')) return 'mdi:music';
  return 'mdi:application';
};

const ActivityPage = observer(() => {
  const { t } = useTranslation();
  
  // 状态
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [appStats, setAppStats] = useState<AppStats[]>([]);
  const [domainStats, setDomainStats] = useState<DomainStats[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [todaySummary, setTodaySummary] = useState({ totalDuration: 0, activityCount: 0, uniqueApps: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitor, setMonitor] = useState<ReturnType<typeof createActivityMonitor> | null>(null);

  // 加载数据
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const startDate = dayjs(selectedDate).startOf('day').toISOString();
      const endDate = dayjs(selectedDate).endOf('day').toISOString();

      const [appStatsResult, domainStatsResult, timelineResult, summaryResult] = await Promise.all([
        api.activity.statsByApp.query({ startDate, endDate }),
        api.activity.statsByDomain.query({ startDate, endDate }),
        selectedDate === dayjs().format('YYYY-MM-DD') 
          ? api.activity.todayTimeline.query()
          : api.activity.getByDateRange.query({ startDate, endDate }),
        selectedDate === dayjs().format('YYYY-MM-DD')
          ? api.activity.todaySummary.query()
          : Promise.resolve({ totalDuration: 0, activityCount: 0, uniqueApps: 0 }),
      ]);

      setAppStats(appStatsResult);
      setDomainStats(domainStatsResult);
      setTimeline(timelineResult as TimelineItem[]);
      setTodaySummary(summaryResult);
    } catch (err) {
      console.error('加载活动数据失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 活动监控回调
  const handleActivityChange = useCallback(async (record: ActivityRecord) => {
    try {
      await api.activity.record.mutate(record);
      // 如果是今天，刷新数据
      if (selectedDate === dayjs().format('YYYY-MM-DD')) {
        loadData();
      }
    } catch (err) {
      console.error('记录活动失败:', err);
    }
  }, [selectedDate, loadData]);

  // 切换监控状态
  const toggleMonitoring = async () => {
    if (!isDesktop()) return;

    if (isMonitoring && monitor) {
      await monitor.stop();
      setMonitor(null);
      setIsMonitoring(false);
    } else {
      const newMonitor = createActivityMonitor({
        pollInterval: 5000,
        onActivityChange: handleActivityChange,
      });
      await newMonitor.start();
      setMonitor(newMonitor);
      setIsMonitoring(true);
    }
  };

  // 日期选择
  const last7Days = Array.from({ length: 7 }, (_, i) => 
    dayjs().subtract(i, 'day').format('YYYY-MM-DD')
  );

  // 计算总时长
  const totalDuration = appStats.reduce((sum, app) => sum + app.totalDuration, 0);

  return (
    <ScrollArea className="px-4 py-4 md:px-6 md:py-6 mx-auto max-w-6xl">
      <div className="space-y-6">
        {/* 标题和控制 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:chart-timeline-variant" className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold">活动统计</h1>
          </div>
          <div className="flex items-center gap-4">
            {/* 日期选择 */}
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="flat"
                  size="sm"
                  startContent={<Icon icon="mdi:calendar" className="w-4 h-4" />}
                  endContent={<Icon icon="mdi:chevron-down" className="w-4 h-4" />}
                >
                  {selectedDate === dayjs().format('YYYY-MM-DD') ? '今天' : selectedDate}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                selectionMode="single"
                selectedKeys={[selectedDate]}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;
                  if (value) setSelectedDate(value);
                }}
              >
                {last7Days.map((date, i) => (
                  <DropdownItem key={date}>
                    {i === 0 ? '今天' : i === 1 ? '昨天' : date}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>

            {/* 监控开关 (仅桌面端) */}
            {isDesktop() && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-default-500">监控</span>
                <Switch
                  size="sm"
                  isSelected={isMonitoring}
                  onValueChange={toggleMonitoring}
                  color="success"
                />
              </div>
            )}

            {/* 刷新按钮 */}
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              onPress={loadData}
              isLoading={isLoading}
            >
              <Icon icon="mdi:refresh" className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 今日概览 */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardBody className="text-center py-4">
              <div className="text-2xl font-bold text-primary">
                {formatDuration(todaySummary.totalDuration)}
              </div>
              <div className="text-sm text-default-500">总时长</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <div className="text-2xl font-bold text-success">
                {todaySummary.uniqueApps}
              </div>
              <div className="text-sm text-default-500">应用数</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <div className="text-2xl font-bold text-warning">
                {todaySummary.activityCount}
              </div>
              <div className="text-sm text-default-500">活动数</div>
            </CardBody>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 应用统计 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon icon="mdi:apps" className="w-5 h-5" />
                  <span className="font-medium">应用使用时长</span>
                </div>
              </CardHeader>
              <Divider />
              <CardBody>
                {appStats.length === 0 ? (
                  <div className="text-center text-default-400 py-8">
                    暂无数据
                  </div>
                ) : (
                  <div className="space-y-4">
                    {appStats.slice(0, 10).map((app, index) => (
                      <div key={app.appName} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon icon={getAppIcon(app.appName)} className="w-5 h-5" />
                            <span className="text-sm font-medium truncate max-w-[150px]">
                              {app.appName}
                            </span>
                          </div>
                          <span className="text-sm text-default-500">
                            {formatDuration(app.totalDuration)}
                          </span>
                        </div>
                        <Progress
                          size="sm"
                          value={(app.totalDuration / totalDuration) * 100}
                          color={index === 0 ? 'primary' : index === 1 ? 'secondary' : 'default'}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* 领域统计 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon icon="mdi:folder-multiple" className="w-5 h-5" />
                  <span className="font-medium">领域分布</span>
                </div>
              </CardHeader>
              <Divider />
              <CardBody>
                {domainStats.length === 0 ? (
                  <div className="text-center text-default-400 py-8">
                    暂无数据
                  </div>
                ) : (
                  <div className="space-y-4">
                    {domainStats.map((domain, index) => (
                      <div key={domain.domainName} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Chip size="sm" variant="flat">
                              {domain.domainName}
                            </Chip>
                          </div>
                          <span className="text-sm text-default-500">
                            {formatDuration(domain.totalDuration)}
                          </span>
                        </div>
                        <Progress
                          size="sm"
                          value={(domain.totalDuration / totalDuration) * 100}
                          color={index === 0 ? 'success' : index === 1 ? 'warning' : 'default'}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        )}

        <Divider />

        {/* 时间线 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Icon icon="mdi:timeline-clock" className="w-5 h-5" />
              <span className="font-medium">活动时间线</span>
            </div>
          </CardHeader>
          <Divider />
          <CardBody>
            {timeline.length === 0 ? (
              <div className="text-center text-default-400 py-8">
                暂无活动记录
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {timeline.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-default-50 transition-colors"
                  >
                    <Icon icon={getAppIcon(item.appName)} className="w-5 h-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.appName}</span>
                        {item.domain && (
                          <Chip size="sm" variant="flat" style={{ backgroundColor: item.domain.color + '20' }}>
                            {item.domain.name}
                          </Chip>
                        )}
                      </div>
                      <p className="text-xs text-default-400 truncate">
                        {item.windowTitle}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm">{formatDuration(item.duration)}</div>
                      <div className="text-xs text-default-400">
                        {dayjs(item.startTime).format('HH:mm')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </ScrollArea>
  );
});

export default ActivityPage;
