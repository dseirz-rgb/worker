import { observer } from "mobx-react-lite";
import { Button, Chip, Spinner, Tooltip } from "@heroui/react";
import { RootStore } from "@/store";
import { PromiseCall } from "@/store/standard/PromiseState";
import { Icon } from '@/components/Common/Iconify/icons';
import { api } from "@/lib/trpc";
import { Item } from "./Item";
import { useTranslation } from "react-i18next";
import { useEffect, useState, useCallback } from "react";
import { CollapsibleCard } from "@/components/Common/CollapsibleCard";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");

// 备份文件类型
interface BackupFile {
  name: string;
  database: "investment" | "echo";
  size: string;
  sizeBytes: number;
  date: string;
  timestamp: number;
  location: "local" | "gdrive";
}

// 数据库备份状态
interface BackupStatus {
  database: string;
  lastBackup: string | null;
  lastBackupTime: number | null;
  backupCount: number;
  totalSize: string;
  files: BackupFile[];
}

// 完整备份状态
interface FullBackupStatus {
  investment: BackupStatus;
  echo: BackupStatus;
  localDir: string;
  gdriveDir: string;
  localExists: boolean;
  gdriveExists: boolean;
}

// 定时任务状态
interface ScheduleStatus {
  isScheduled: boolean;
  schedule: string | null;
}

// 数据库备份卡片组件
const DatabaseBackupCard = observer(({ 
  status, 
  icon, 
  color 
}: { 
  status: BackupStatus; 
  icon: string; 
  color: string;
}) => {
  const getTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return "从未备份";
    return dayjs(dateStr).fromNow();
  };

  const getStatusColor = (lastBackupTime: number | null) => {
    if (!lastBackupTime) return "danger";
    const hoursSince = (Date.now() - lastBackupTime) / (1000 * 60 * 60);
    if (hoursSince < 24) return "success";
    if (hoursSince < 48) return "warning";
    return "danger";
  };

  return (
    <div className="p-4 rounded-xl bg-default-100/50 border border-default-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon icon={icon} width="20" height="20" className="text-white" />
          </div>
          <span className="font-semibold">{status.database}</span>
        </div>
        <Chip 
          size="sm" 
          color={getStatusColor(status.lastBackupTime)}
          variant="flat"
        >
          {status.lastBackup ? "正常" : "未备份"}
        </Chip>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-default-600">
          <span>最近备份</span>
          <span className="font-medium">
            {status.lastBackup 
              ? getTimeAgo(status.lastBackup)
              : "从未备份"}
          </span>
        </div>
        <div className="flex justify-between text-default-600">
          <span>备份数量</span>
          <span className="font-medium">{status.backupCount} 个</span>
        </div>
        <div className="flex justify-between text-default-600">
          <span>总大小</span>
          <span className="font-medium">{status.totalSize}</span>
        </div>
      </div>

      {status.files.length > 0 && (
        <div className="mt-3 pt-3 border-t border-default-200">
          <div className="text-xs text-default-500 mb-2">最近备份文件</div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {status.files.slice(0, 3).map((file) => (
              <div 
                key={file.name} 
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-1 truncate">
                  <Icon 
                    icon={file.location === "gdrive" ? "mdi:google-drive" : "mdi:folder"} 
                    width="12" 
                    className="text-default-400 flex-shrink-0"
                  />
                  <span className="truncate text-default-600">{file.name}</span>
                </div>
                <span className="text-default-400 flex-shrink-0 ml-2">{file.size}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export const BackupSetting = observer(() => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<FullBackupStatus | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // 加载备份状态
  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const [backupStatus, schedule] = await Promise.all([
        api.backup.getStatus.query(),
        api.backup.getScheduleStatus.query(),
      ]);
      setStatus(backupStatus);
      setScheduleStatus(schedule);
    } catch (error) {
      console.error("加载备份状态失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // 手动备份
  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      await PromiseCall(
        api.backup.triggerBackup.mutate({ database: "all" }),
        { autoAlert: true }
      );
      await loadStatus();
    } finally {
      setIsBackingUp(false);
    }
  };

  if (isLoading) {
    return (
      <CollapsibleCard icon="mdi:backup-restore" title="数据库备份">
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" />
        </div>
      </CollapsibleCard>
    );
  }

  return (
    <CollapsibleCard icon="mdi:backup-restore" title="数据库备份">
      {/* 定时任务状态 */}
      <Item
        leftContent={
          <div className="flex items-center gap-2">
            <span>自动备份</span>
            {scheduleStatus?.isScheduled && (
              <Chip size="sm" color="success" variant="flat">
                已启用
              </Chip>
            )}
          </div>
        }
        rightContent={
          <div className="flex items-center gap-2">
            {scheduleStatus?.schedule && (
              <span className="text-sm text-default-500">
                {scheduleStatus.schedule}
              </span>
            )}
            <Tooltip content="刷新状态">
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                onPress={loadStatus}
              >
                <Icon icon="mdi:refresh" width="18" />
              </Button>
            </Tooltip>
          </div>
        }
      />

      {/* 数据库备份状态卡片 */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <DatabaseBackupCard
            status={status.investment}
            icon="mdi:chart-line"
            color="bg-blue-500"
          />
          <DatabaseBackupCard
            status={status.echo}
            icon="mdi:note-text"
            color="bg-green-500"
          />
        </div>
      )}

      {/* 存储位置 */}
      <div className="mt-4 p-3 rounded-lg bg-default-50 border border-default-200">
        <div className="text-sm font-medium mb-2">存储位置</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <Icon 
              icon={status?.localExists ? "mdi:check-circle" : "mdi:alert-circle"} 
              className={status?.localExists ? "text-success" : "text-danger"}
              width="14"
            />
            <span className="text-default-600">本地: {status?.localDir}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon 
              icon={status?.gdriveExists ? "mdi:check-circle" : "mdi:alert-circle"} 
              className={status?.gdriveExists ? "text-success" : "text-danger"}
              width="14"
            />
            <span className="text-default-600">Google Drive: {status?.gdriveDir}</span>
          </div>
        </div>
      </div>

      {/* 手动备份按钮 */}
      <div className="mt-4 flex justify-end">
        <Button
          color="primary"
          startContent={
            isBackingUp 
              ? <Spinner size="sm" color="white" /> 
              : <Icon icon="mdi:backup-restore" width="18" />
          }
          onPress={handleBackup}
          isDisabled={isBackingUp}
        >
          {isBackingUp ? "备份中..." : "立即备份"}
        </Button>
      </div>
    </CollapsibleCard>
  );
});
