/**
 * Khoj AI 助手页面
 * 使用 iframe 嵌入 Khoj Web UI
 */

import { observer } from 'mobx-react-lite';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Iconify/icons';
import { Button, Spinner } from '@heroui/react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/trpc';

const KhojPage = observer(() => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [khojUrl, setKhojUrl] = useState('http://localhost:42110');

  // 检查 Khoj 服务状态
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await api.khoj.getStatus.query();
        setIsAvailable(status.success);
        if (status.url) {
          setKhojUrl(status.url);
        }
      } catch (err) {
        setIsAvailable(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkStatus();
  }, []);

  // 加载中
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  // 服务不可用
  if (!isAvailable) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md p-8">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-danger/10 flex items-center justify-center">
            <Icon icon="mdi:robot-dead-outline" className="w-12 h-12 text-danger/70" />
          </div>
          <h2 className="text-xl font-semibold mb-2">
            {t('khoj-service-disconnected') || 'Khoj 服务未连接'}
          </h2>
          <p className="text-foreground/60 mb-4">
            {t('khoj-not-connected') || '无法连接到 Khoj 服务'}
          </p>
          
          <div className="bg-default-100 rounded-xl p-4 text-left mb-6">
            <p className="text-sm font-medium mb-3 flex items-center gap-2">
              <Icon icon="solar:info-circle-linear" className="w-4 h-4 text-primary" />
              启动 Khoj 服务
            </p>
            <div className="bg-default-200 rounded-lg p-3 font-mono text-xs overflow-x-auto">
              <code>docker-compose -f docker-compose.khoj.yml up -d</code>
            </div>
          </div>
          
          <div className="flex gap-3 justify-center">
            <Button
              color="primary"
              onPress={() => window.location.reload()}
              startContent={<Icon icon="solar:refresh-linear" className="w-4 h-4" />}
            >
              重试连接
            </Button>
            <Link to="/settings">
              <Button variant="flat">前往设置</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 正常显示 iframe
  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-divider bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Icon icon="mdi:robot-outline" className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Khoj AI 助手</h1>
            <p className="text-xs text-foreground/50">智能知识检索</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-default-100">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-foreground/70">已连接</span>
          </div>
          <Button
            isIconOnly
            variant="light"
            size="sm"
            onPress={() => window.open(khojUrl, '_blank')}
          >
            <Icon icon="solar:square-arrow-right-up-linear" className="w-5 h-5" />
          </Button>
        </div>
      </div>
      
      {/* iframe */}
      <iframe
        src={khojUrl}
        className="flex-1 w-full border-0"
        title="Khoj AI"
      />
    </div>
  );
});

export default KhojPage;
