/**
 * EchoAI 助手页面
 * 原生 React 组件实现，替代 iframe 方案
 */

import { observer } from 'mobx-react-lite';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Iconify/icons';
import { Button, Spinner } from '@heroui/react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/trpc';
import { ChatPage } from '@/components/echoai/ChatPage';

const EchoAIPage = observer(() => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  // 检查 EchoAI 服务状态
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await api.khoj.getStatus.query();
        setIsAvailable(status.success);
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
            {t('echoai-service-disconnected')}
          </h2>
          <p className="text-foreground/60 mb-4">
            {t('echoai-not-connected')}
          </p>
          
          <div className="bg-default-100 rounded-xl p-4 text-left mb-6">
            <p className="text-sm font-medium mb-3 flex items-center gap-2">
              <Icon icon="solar:info-circle-linear" className="w-4 h-4 text-primary" />
              {t('start-echoai-service')}
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
              {t('retry-connection')}
            </Button>
            <Link to="/settings">
              <Button variant="flat">{t('go-to-settings')}</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 正常显示原生对话页面
  return <ChatPage showSidebar={true} />;
});

export default EchoAIPage;
