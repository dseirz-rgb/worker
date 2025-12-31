/**
 * IngestStatus 组件
 * 显示文件处理队列和状态
 */

import { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Progress, Button, Chip, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { api } from '@/lib/trpc';
import { observer } from 'mobx-react-lite';

// 任务状态类型
type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

// 任务接口
interface IngestTask {
  task_id: string;
  file_path: string;
  file_type: string;
  status: TaskStatus;
  progress: number;
  chunks_count: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// 状态颜色映射
const statusColorMap: Record<TaskStatus, 'default' | 'primary' | 'success' | 'danger' | 'warning'> = {
  pending: 'default',
  processing: 'primary',
  completed: 'success',
  failed: 'danger',
};

// 状态图标映射
const statusIconMap: Record<TaskStatus, string> = {
  pending: 'mdi:clock-outline',
  processing: 'mdi:loading',
  completed: 'mdi:check-circle',
  failed: 'mdi:alert-circle',
};

// 状态文本映射
const statusTextMap: Record<TaskStatus, string> = {
  pending: '等待中',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
};

// 文件类型图标映射
const fileTypeIconMap: Record<string, string> = {
  video: 'mdi:video',
  ppt: 'mdi:file-powerpoint',
};

/**
 * 单个任务卡片
 */
const TaskCard = ({ 
  task, 
  onRetry 
}: { 
  task: IngestTask; 
  onRetry: (taskId: string) => void;
}) => {
  const fileName = task.file_path.split('/').pop() || task.file_path;
  
  return (
    <div className="flex items-center gap-3 p-3 bg-default-50 rounded-lg">
      {/* 文件类型图标 */}
      <div className="flex-shrink-0">
        <Icon 
          icon={fileTypeIconMap[task.file_type] || 'mdi:file'} 
          className="text-2xl text-default-500"
        />
      </div>
      
      {/* 任务信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium truncate" title={fileName}>
            {fileName}
          </span>
          <Chip 
            size="sm" 
            color={statusColorMap[task.status]}
            variant="flat"
            startContent={
              task.status === 'processing' ? (
                <Spinner size="sm" color="current" />
              ) : (
                <Icon icon={statusIconMap[task.status]} className="text-sm" />
              )
            }
          >
            {statusTextMap[task.status]}
          </Chip>
        </div>
        
        {/* 进度条 (处理中时显示) */}
        {task.status === 'processing' && (
          <Progress 
            size="sm" 
            value={task.progress} 
            color="primary"
            className="mb-1"
          />
        )}
        
        {/* 完成信息 */}
        {task.status === 'completed' && (
          <span className="text-xs text-default-400">
            生成 {task.chunks_count} 个块
          </span>
        )}
        
        {/* 错误信息 */}
        {task.status === 'failed' && task.error && (
          <span className="text-xs text-danger truncate" title={task.error}>
            {task.error}
          </span>
        )}
      </div>
      
      {/* 操作按钮 */}
      {task.status === 'failed' && (
        <Button
          size="sm"
          variant="flat"
          color="primary"
          isIconOnly
          onPress={() => onRetry(task.task_id)}
        >
          <Icon icon="mdi:refresh" />
        </Button>
      )}
    </div>
  );
};

/**
 * 队列状态概览
 */
const QueueOverview = ({ 
  status 
}: { 
  status: { pending: number; processing: number; completed: number; failed: number } | undefined;
}) => {
  if (!status) return null;
  
  return (
    <div className="flex gap-4 mb-4">
      <div className="flex items-center gap-1">
        <Icon icon="mdi:clock-outline" className="text-default-400" />
        <span className="text-sm">{status.pending} 等待</span>
      </div>
      <div className="flex items-center gap-1">
        <Icon icon="mdi:loading" className="text-primary animate-spin" />
        <span className="text-sm">{status.processing} 处理中</span>
      </div>
      <div className="flex items-center gap-1">
        <Icon icon="mdi:check-circle" className="text-success" />
        <span className="text-sm">{status.completed} 完成</span>
      </div>
      <div className="flex items-center gap-1">
        <Icon icon="mdi:alert-circle" className="text-danger" />
        <span className="text-sm">{status.failed} 失败</span>
      </div>
    </div>
  );
};

/**
 * IngestStatus 主组件
 */
export const IngestStatus = observer(() => {
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  
  // 获取队列状态
  const { data: queueStatus, refetch: refetchQueue } = api.ingest.getQueueStatus.useQuery(
    undefined,
    { refetchInterval: 5000 } // 每 5 秒刷新
  );
  
  // 获取任务列表
  const { data: taskList, refetch: refetchTasks, isLoading } = api.ingest.listTasks.useQuery(
    { 
      status: filter === 'all' ? undefined : filter,
      limit: 20 
    },
    { refetchInterval: 3000 } // 每 3 秒刷新
  );
  
  // 重试任务
  const retryMutation = api.ingest.retryTask.useMutation({
    onSuccess: () => {
      refetchTasks();
      refetchQueue();
    },
  });
  
  const handleRetry = (taskId: string) => {
    retryMutation.mutate({ taskId });
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:tray-arrow-down" className="text-xl" />
          <span className="font-semibold">文件处理队列</span>
        </div>
        <Button
          size="sm"
          variant="light"
          isIconOnly
          onPress={() => { refetchTasks(); refetchQueue(); }}
        >
          <Icon icon="mdi:refresh" />
        </Button>
      </CardHeader>
      
      <CardBody>
        {/* 队列概览 */}
        <QueueOverview status={queueStatus} />
        
        {/* 过滤器 */}
        <div className="flex gap-2 mb-4">
          {(['all', 'pending', 'processing', 'completed', 'failed'] as const).map((s) => (
            <Chip
              key={s}
              variant={filter === s ? 'solid' : 'flat'}
              color={s === 'all' ? 'default' : statusColorMap[s as TaskStatus]}
              className="cursor-pointer"
              onClick={() => setFilter(s)}
            >
              {s === 'all' ? '全部' : statusTextMap[s as TaskStatus]}
            </Chip>
          ))}
        </div>
        
        {/* 任务列表 */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : taskList?.tasks.length === 0 ? (
          <div className="text-center py-8 text-default-400">
            <Icon icon="mdi:inbox-outline" className="text-4xl mb-2" />
            <p>暂无处理任务</p>
          </div>
        ) : (
          <div className="space-y-2">
            {taskList?.tasks.map((task) => (
              <TaskCard 
                key={task.task_id} 
                task={task} 
                onRetry={handleRetry}
              />
            ))}
          </div>
        )}
        
        {/* 总数 */}
        {taskList && taskList.total > 0 && (
          <div className="text-center mt-4 text-sm text-default-400">
            共 {taskList.total} 个任务
          </div>
        )}
      </CardBody>
    </Card>
  );
});

export default IngestStatus;
