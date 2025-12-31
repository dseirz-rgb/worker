/**
 * Janitor 历史记录组件
 * 显示文件整理历史和撤销功能
 */

import { observer } from 'mobx-react-lite';
import { useState, useEffect } from 'react';
import { Icon } from '@/components/Common/Iconify/icons';
import { 
  Button, 
  Card, 
  CardBody, 
  CardHeader,
  Divider,
  Chip,
  ScrollShadow,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@heroui/react';
import { api } from '@/lib/trpc';
import { RootStore } from '@/store';
import { ToastPlugin } from '@/store/module/Toast/Toast';

// 历史记录类型
interface HistoryRecord {
  timestamp: string;
  src_path: string;
  dst_path: string;
  original_name: string;
  new_name: string;
  category: string;
  confidence: number;
  reason: string;
}

export const JanitorHistory = observer(() => {
  const toast = RootStore.Get(ToastPlugin);
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isUndoing, setIsUndoing] = useState(false);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);

  // 加载历史记录
  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const result = await api.janitor.getHistory.query({ limit: 50 });
      setRecords(result.records);
    } catch (error) {
      console.error('Failed to load history:', error);
      // 服务不可用时显示空列表，不报错
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // 撤销单个操作
  const handleUndo = async (record: HistoryRecord) => {
    setSelectedRecord(record);
    onOpen();
  };

  // 确认撤销
  const confirmUndo = async () => {
    if (!selectedRecord) return;
    
    setIsUndoing(true);
    try {
      const result = await api.janitor.undo.mutate({ 
        since: selectedRecord.timestamp 
      });
      
      if (result.success > 0) {
        toast.success(`成功撤销 ${result.success} 个操作`);
        loadHistory(); // 刷新列表
      } else {
        toast.error('撤销失败');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '撤销失败');
    } finally {
      setIsUndoing(false);
      onClose();
    }
  };

  // 撤销最近一次
  const handleUndoLast = async () => {
    setIsUndoing(true);
    try {
      const result = await api.janitor.undo.mutate({ count: 1 });
      
      if (result.success > 0) {
        toast.success('已撤销最近一次操作');
        loadHistory();
      } else {
        toast.error('撤销失败');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '撤销失败');
    } finally {
      setIsUndoing(false);
    }
  };

  // 格式化时间
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <Card className="h-full">
        <CardHeader className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-default/10 flex items-center justify-center">
              <Icon icon="solar:history-bold-duotone" className="w-5 h-5 text-foreground/70" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">整理历史</h3>
              <p className="text-sm text-foreground/60">
                查看和撤销文件整理操作
              </p>
            </div>
          </div>
          
          {records.length > 0 && (
            <Button
              size="sm"
              variant="flat"
              color="danger"
              onPress={handleUndoLast}
              isLoading={isUndoing}
              startContent={!isUndoing && <Icon icon="solar:undo-left-linear" />}
            >
              撤销最近
            </Button>
          )}
        </CardHeader>
        
        <Divider />
        
        <CardBody>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Icon icon="solar:refresh-linear" className="w-8 h-8 animate-spin text-foreground/30" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-foreground/50">
              <Icon icon="solar:history-linear" className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">暂无整理记录</p>
            </div>
          ) : (
            <ScrollShadow className="max-h-[500px]">
              <div className="space-y-2">
                {records.map((record, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg border border-default-200 hover:border-default-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* 时间和分类 */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-foreground/50">
                            {formatTime(record.timestamp)}
                          </span>
                          <Chip size="sm" variant="flat" color="default">
                            {record.category}
                          </Chip>
                          <Chip 
                            size="sm" 
                            variant="flat" 
                            color={record.confidence >= 0.8 ? 'success' : 'warning'}
                          >
                            {Math.round(record.confidence * 100)}%
                          </Chip>
                        </div>
                        
                        {/* 原文件 */}
                        <div className="flex items-center gap-2 text-sm">
                          <Icon icon="solar:file-linear" className="w-4 h-4 text-foreground/50 flex-shrink-0" />
                          <span className="truncate text-foreground/70">{record.original_name}</span>
                        </div>
                        
                        {/* 箭头 */}
                        <div className="flex items-center gap-2 my-1 ml-6">
                          <Icon icon="solar:arrow-down-linear" className="w-3 h-3 text-foreground/30" />
                        </div>
                        
                        {/* 新位置 */}
                        <div className="flex items-center gap-2 text-sm">
                          <Icon icon="solar:folder-bold-duotone" className="w-4 h-4 text-warning flex-shrink-0" />
                          <span className="truncate font-medium">{record.new_name}</span>
                        </div>
                      </div>
                      
                      {/* 撤销按钮 */}
                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        isIconOnly
                        onPress={() => handleUndo(record)}
                      >
                        <Icon icon="solar:undo-left-linear" className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollShadow>
          )}
        </CardBody>
      </Card>

      {/* 确认撤销对话框 */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>确认撤销</ModalHeader>
          <ModalBody>
            <p>确定要撤销这次操作吗？文件将被移回原位置。</p>
            {selectedRecord && (
              <div className="mt-3 p-3 bg-default-50 rounded-lg text-sm">
                <p><strong>文件：</strong>{selectedRecord.original_name}</p>
                <p><strong>当前位置：</strong>{selectedRecord.dst_path}</p>
                <p><strong>原位置：</strong>{selectedRecord.src_path}</p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>
              取消
            </Button>
            <Button 
              color="danger" 
              onPress={confirmUndo}
              isLoading={isUndoing}
            >
              确认撤销
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
});
