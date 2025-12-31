/**
 * Khoj AI 设置组件
 * 配置 Khoj 服务器连接
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Button, Card, CardBody, CardHeader, Divider, Switch } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { api } from '@/lib/trpc';
import { 
  getKhojConfig, 
  saveKhojConfig, 
  resetKhojConfig,
} from '@/lib/khojService';

export function KhojSetting() {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saved, setSaved] = useState(false);

  // 加载配置
  useEffect(() => {
    const config = getKhojConfig();
    setUrl(config.baseUrl);
    setEnabled(config.enabled);
  }, []);

  // 保存配置
  const handleSave = () => {
    saveKhojConfig({ baseUrl: url, enabled });
    setTestResult(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // 测试连接
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await api.khoj.testConnection.mutate({ baseUrl: url });
      setTestResult(result.success ? 'success' : 'error');
    } catch {
      setTestResult('error');
    }
    setTesting(false);
  };

  // 重置配置
  const handleReset = () => {
    resetKhojConfig();
    const config = getKhojConfig();
    setUrl(config.baseUrl);
    setEnabled(config.enabled);
    setTestResult(null);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
          <Icon icon="mdi:robot-outline" className="w-6 h-6 text-white" />
        </div>
        <div className="flex flex-col">
          <p className="text-md font-semibold">{t('khoj-ai-assistant')}</p>
          <p className="text-small text-default-500">{t('khoj-config-desc')}</p>
        </div>
      </CardHeader>
      
      <Divider />
      
      <CardBody className="space-y-4">
        {/* 启用开关 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t('enable')} Khoj</p>
            <p className="text-xs text-default-500">{t('khoj-config-desc')}</p>
          </div>
          <Switch
            isSelected={enabled}
            onValueChange={setEnabled}
            size="sm"
          />
        </div>

        <Divider />

        {/* 服务器地址 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('api-endpoint')}</label>
          <div className="flex gap-2">
            <Input
              value={url}
              onValueChange={setUrl}
              placeholder="http://localhost:42110"
              className="flex-1"
              startContent={
                <Icon icon="mdi:server-network" className="text-default-400" />
              }
              description="Khoj URL"
            />
          </div>
        </div>

        {/* 测试结果 */}
        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            testResult === 'success' 
              ? 'bg-success-50 text-success-600' 
              : 'bg-danger-50 text-danger-600'
          }`}>
            <Icon 
              icon={testResult === 'success' ? 'mdi:check-circle' : 'mdi:alert-circle'} 
              className="w-5 h-5"
            />
            <span className="text-sm">
              {testResult === 'success' 
                ? t('check-connect-success')
                : t('check-connect-error')}
            </span>
          </div>
        )}

        {/* 保存成功提示 */}
        {saved && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-success-50 text-success-600">
            <Icon icon="mdi:check-circle" className="w-5 h-5" />
            <span className="text-sm">{t('your-changes-have-been-saved')}</span>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="flat"
            onPress={handleTest}
            isLoading={testing}
            startContent={!testing && <Icon icon="mdi:connection" className="w-4 h-4" />}
          >
            {t('test-connection')}
          </Button>
          <Button
            color="primary"
            onPress={handleSave}
            startContent={<Icon icon="mdi:content-save" className="w-4 h-4" />}
          >
            {t('save')}
          </Button>
          <Button
            variant="light"
            onPress={handleReset}
            startContent={<Icon icon="mdi:refresh" className="w-4 h-4" />}
          >
            {t('reset')}
          </Button>
        </div>

        <Divider />

        {/* 帮助信息 */}
        <div className="bg-default-100 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <Icon icon="mdi:information-outline" className="w-4 h-4 text-primary" />
            {t('how-to-start-khoj')}
          </p>
          <div className="bg-default-200 rounded-lg p-3 font-mono text-xs overflow-x-auto">
            <code>docker-compose -f docker-compose.dev.yml up -d khoj</code>
          </div>
          <p className="text-xs text-default-500">
            {t('or')}: <code className="bg-default-200 px-1 rounded">./dev.sh docker</code>
          </p>
          <a 
            href="https://docs.khoj.dev" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Icon icon="mdi:open-in-new" className="w-3 h-3" />
            {t('documentation')}
          </a>
        </div>
      </CardBody>
    </Card>
  );
}

export default KhojSetting;
