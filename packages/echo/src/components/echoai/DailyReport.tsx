/**
 * DailyReport 组件 - 日报显示和管理
 * 
 * 功能：
 * - 显示早报/晚报内容
 * - 手动触发生成日报
 * - 配置日报生成时间
 * - 显示历史日报列表
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Spinner,
  Divider,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Switch,
  Tabs,
  Tab,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { api } from '@/lib/trpc';
import { RootStore } from '@/store';
import { ToastPlugin } from '@/store/module/Toast/Toast';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// ============================================
// 类型定义
// ============================================

type ReportType = 'morning' | 'evening';

interface ReportContent {
  summary: string;
  tasks: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
    topPriority: Array<{ id: number; content: string; isTop: boolean }>;
  };
  notes: {
    count: number;
    tags: string[];
    highlights: string[];
  };
  suggestions: Array<{
    type: string;
    content: string;
    priority: string;
  }>;
  greeting?: string;
  activities?: {
    totalDuration: number;
    topDomains: Array<{ name: string; duration: number }>;
    productiveTime: number;
  };
}

interface TodayStatus {
  morning: { generated: boolean; generatedAt?: Date };
  evening: { generated: boolean; generatedAt?: Date };
}

interface ReportSettings {
  morningReportTime: string;
  eveningReportTime: string;
  morningReportEnabled: boolean;
  eveningReportEnabled: boolean;
  notificationEnabled: boolean;
}

// ============================================
// 组件
// ============================================

export function DailyReport() {
  const toast = RootStore.Get(ToastPlugin);

  // 状态
  const [activeTab, setActiveTab] = useState<ReportType>('morning');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  // 数据状态
  const [todayStatus, setTodayStatus] = useState<TodayStatus | null>(null);
  const [reportContent, setReportContent] = useState<ReportContent | null>(null);
  const [settings, setSettings] = useState<ReportSettings>({
    morningReportTime: '08:00',
    eveningReportTime: '21:00',
    morningReportEnabled: true,
    eveningReportEnabled: true,
    notificationEnabled: true,
  });

  // 设置表单状态
  const [morningTime, setMorningTime] = useState('08:00');
  const [eveningTime, setEveningTime] = useState('21:00');
  const [morningEnabled, setMorningEnabled] = useState(true);
  const [eveningEnabled, setEveningEnabled] = useState(true);

  // 加载今日状态
  const loadTodayStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const status = await api.dailyReport.getTodayStatus.query();
      setTodayStatus(status);
    } catch (error) {
      console.error('加载日报状态失败:', error);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  // 加载设置
  const loadSettings = useCallback(async () => {
    try {
      const data = await api.dailyReport.getSettings.query();
      setSettings(data);
      setMorningTime(data.morningReportTime);
      setEveningTime(data.eveningReportTime);
      setMorningEnabled(data.morningReportEnabled);
      setEveningEnabled(data.eveningReportEnabled);
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }, []);

  // 加载日报内容
  const loadReport = useCallback(async (type: ReportType) => {
    setIsLoadingReport(true);
    try {
      const report = await api.dailyReport.get.query({ type, date: new Date() });
      if (report) {
        setReportContent(report.content as ReportContent);
      } else {
        setReportContent(null);
      }
    } catch (error) {
      console.error('加载日报失败:', error);
      setReportContent(null);
    } finally {
      setIsLoadingReport(false);
    }
  }, []);

  // 初始化
  useEffect(() => {
    loadTodayStatus();
    loadSettings();
  }, [loadTodayStatus, loadSettings]);

  // 切换标签时加载对应日报
  useEffect(() => {
    loadReport(activeTab);
  }, [activeTab, loadReport]);

  // 手动生成日报
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const result = await api.dailyReport.generate.mutate({ type: activeTab });
      setReportContent(result.content as ReportContent);
      toast.success('日报生成成功');
      await loadTodayStatus();
    } catch (error) {
      toast.error('生成失败，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  }, [activeTab, toast, loadTodayStatus]);

  // 保存设置
  const handleSaveSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      await api.dailyReport.updateSettings.mutate({
        morningReportTime: morningTime,
        eveningReportTime: eveningTime,
        morningReportEnabled: morningEnabled,
        eveningReportEnabled: eveningEnabled,
      });
      toast.success('设置已保存');
      setIsSettingsOpen(false);
      await loadSettings();
    } catch (error) {
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  }, [morningTime, eveningTime, morningEnabled, eveningEnabled, toast, loadSettings]);

  // 获取当前状态
  const currentStatus = activeTab === 'morning' ? todayStatus?.morning : todayStatus?.evening;

  return (
    <div className="space-y-4">
      {/* 标签切换 */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as ReportType)}
        variant="bordered"
        classNames={{
          tabList: 'gap-2',
        }}
      >
        <Tab
          key="morning"
          title={
            <div className="flex items-center gap-2">
              <Icon icon="mdi:weather-sunny" className="w-4 h-4" />
              <span>早报</span>
              {todayStatus?.morning?.generated && (
                <Chip size="sm" color="success" variant="dot" />
              )}
            </div>
          }
        />
        <Tab
          key="evening"
          title={
            <div className="flex items-center gap-2">
              <Icon icon="mdi:weather-night" className="w-4 h-4" />
              <span>晚报</span>
              {todayStatus?.evening?.generated && (
                <Chip size="sm" color="success" variant="dot" />
              )}
            </div>
          }
        />
      </Tabs>

      {/* 状态卡片 */}
      <Card>
        <CardHeader className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              activeTab === 'morning' 
                ? 'bg-gradient-to-br from-amber-500 to-orange-500' 
                : 'bg-gradient-to-br from-indigo-500 to-purple-500'
            }`}>
              <Icon 
                icon={activeTab === 'morning' ? 'mdi:weather-sunny' : 'mdi:weather-night'} 
                className="w-6 h-6 text-white" 
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                {activeTab === 'morning' ? '今日早报' : '今日晚报'}
              </h3>
              <p className="text-xs text-foreground/50">
                {format(new Date(), 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoadingStatus ? (
              <Spinner size="sm" />
            ) : (
              <Chip
                size="sm"
                color={currentStatus?.generated ? 'success' : 'default'}
                variant="flat"
              >
                {currentStatus?.generated ? '已生成' : '未生成'}
              </Chip>
            )}
          </div>
        </CardHeader>

        <Divider />

        <CardBody className="space-y-4">
          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-2">
            <Button
              color="primary"
              onPress={handleGenerate}
              isLoading={isGenerating}
              startContent={!isGenerating && <Icon icon="mdi:file-document-plus-outline" className="w-4 h-4" />}
            >
              {currentStatus?.generated ? '重新生成' : '立即生成'}
            </Button>
            <Button
              variant="flat"
              onPress={() => setIsSettingsOpen(true)}
              startContent={<Icon icon="mdi:cog-outline" className="w-4 h-4" />}
            >
              设置
            </Button>
          </div>

          {/* 日报内容 */}
          {isLoadingReport ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : reportContent ? (
            <div className="space-y-4">
              {/* 问候语 */}
              {reportContent.greeting && (
                <p className="text-lg font-medium text-foreground/80">
                  {reportContent.greeting}
                </p>
              )}

              {/* AI 摘要 */}
              <div className="p-4 rounded-lg bg-default-100">
                <p className="text-sm">{reportContent.summary}</p>
              </div>

              {/* 任务统计 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  icon="mdi:clipboard-list"
                  label="总任务"
                  value={reportContent.tasks.total}
                  color="blue"
                />
                <StatCard
                  icon="mdi:check-circle"
                  label="已完成"
                  value={reportContent.tasks.completed}
                  color="green"
                />
                <StatCard
                  icon="mdi:clock-outline"
                  label="待处理"
                  value={reportContent.tasks.pending}
                  color="amber"
                />
                <StatCard
                  icon="mdi:alert-circle"
                  label="逾期"
                  value={reportContent.tasks.overdue}
                  color="red"
                />
              </div>

              {/* 笔记统计 */}
              {reportContent.notes.count > 0 && (
                <div className="p-3 rounded-lg bg-default-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon icon="mdi:note-text" className="w-4 h-4 text-foreground/60" />
                    <span className="text-sm font-medium">
                      今日笔记: {reportContent.notes.count} 条
                    </span>
                  </div>
                  {reportContent.notes.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {reportContent.notes.tags.map((tag) => (
                        <Chip key={tag} size="sm" variant="flat">
                          #{tag}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 建议列表 */}
              {reportContent.suggestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Icon icon="mdi:lightbulb-outline" className="w-4 h-4" />
                    建议
                  </h4>
                  {reportContent.suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border-l-4 ${
                        suggestion.priority === 'high'
                          ? 'border-l-danger bg-danger/5'
                          : suggestion.priority === 'medium'
                          ? 'border-l-warning bg-warning/5'
                          : 'border-l-default bg-default-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Chip size="sm" variant="flat" className="flex-shrink-0">
                          {suggestion.type}
                        </Chip>
                        <p className="text-sm">{suggestion.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 活动统计 (晚报) */}
              {reportContent.activities && (
                <div className="p-3 rounded-lg bg-default-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon icon="mdi:chart-timeline-variant" className="w-4 h-4 text-foreground/60" />
                    <span className="text-sm font-medium">
                      活动时长: {reportContent.activities.totalDuration} 分钟
                    </span>
                  </div>
                  {reportContent.activities.topDomains.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {reportContent.activities.topDomains.map((domain) => (
                        <Chip key={domain.name} size="sm" variant="flat">
                          {domain.name}: {domain.duration}分钟
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-foreground/50">
              <Icon icon="mdi:file-document-outline" className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无日报，点击"立即生成"创建</p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* 设置弹窗 */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Icon icon="mdi:cog-outline" className="w-5 h-5" />
            日报设置
          </ModalHeader>
          <ModalBody className="space-y-4">
            {/* 早报设置 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">早报</span>
                <Switch
                  size="sm"
                  isSelected={morningEnabled}
                  onValueChange={setMorningEnabled}
                />
              </div>
              <Input
                type="time"
                label="生成时间"
                value={morningTime}
                onValueChange={setMorningTime}
                isDisabled={!morningEnabled}
              />
            </div>

            <Divider />

            {/* 晚报设置 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">晚报</span>
                <Switch
                  size="sm"
                  isSelected={eveningEnabled}
                  onValueChange={setEveningEnabled}
                />
              </div>
              <Input
                type="time"
                label="生成时间"
                value={eveningTime}
                onValueChange={setEveningTime}
                isDisabled={!eveningEnabled}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setIsSettingsOpen(false)}>
              取消
            </Button>
            <Button
              color="primary"
              onPress={handleSaveSettings}
              isLoading={isSaving}
            >
              保存
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

// 统计卡片子组件
function StatCard({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: string; 
  label: string; 
  value: number; 
  color: 'blue' | 'green' | 'amber' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500',
  };

  return (
    <div className="p-3 rounded-lg bg-default-50 text-center">
      <div className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center ${colorClasses[color]}`}>
        <Icon icon={icon} className="w-4 h-4" />
      </div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-foreground/50">{label}</p>
    </div>
  );
}

export default DailyReport;
