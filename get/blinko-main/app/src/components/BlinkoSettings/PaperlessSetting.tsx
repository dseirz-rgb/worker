/**
 * Paperless-ngx 设置组件
 * 配置文件管理服务连接
 */

import { observer } from 'mobx-react-lite';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Iconify/icons';
import { 
  Input, 
  Button, 
  Card, 
  CardBody, 
  CardHeader,
  Switch,
  Divider,
} from '@heroui/react';
import { api } from '@/lib/trpc';
import { RootStore } from '@/store';
import { ToastPlugin } from '@/store/module/Toast/Toast';

// 默认配置值
const DEFAULT_PAPERLESS_URL = 'http://localhost:8000';
const DEFAULT_API_TOKEN = '0bfa811ef133914142138eef53187fb6635a04b4';

export const PaperlessSetting = observer(() => {
  const { t } = useTranslation();
  const toast = RootStore.Get(ToastPlugin);
  
  const [baseUrl, setBaseUrl] = useState(DEFAULT_PAPERLESS_URL);
  const [apiToken, setApiToken] = useState(DEFAULT_API_TOKEN);
  const [enabled, setEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [existingToken, setExistingToken] = useState('');

  // 获取现有配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await api.paperless.getConfig.query();
        if (config) {
          // 如果有已保存的配置则使用，否则保持默认值
          setBaseUrl(config.baseUrl || DEFAULT_PAPERLESS_URL);
          setExistingToken(config.apiToken || '');
          setEnabled(config.enabled ?? true);
          // 如果没有已保存的 token，保持默认值显示
          if (!config.apiToken) {
            setApiToken(DEFAULT_API_TOKEN);
          }
        }
      } catch (error) {
        console.error('Failed to load paperless config:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  // 测试连接
  const handleTestConnection = async () => {
    if (!baseUrl || !apiToken) {
      toast.error(t('please-fill-all-fields') || '请填写所有字段');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await api.paperless.testConnection.mutate({
        baseUrl,
        apiToken,
      });
      setTestResult({
        success: result.success,
        error: result.error || undefined,
      });
      
      if (result.success) {
        toast.success(t('connection-successful') || '连接成功');
      } else {
        toast.error(result.error || t('connection-failed') || '连接失败');
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        error: error instanceof Error ? error.message : '连接测试失败' 
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 保存配置
  const handleSave = async () => {
    if (!baseUrl || !apiToken) {
      toast.error(t('please-fill-all-fields') || '请填写所有字段');
      return;
    }

    setIsSaving(true);
    try {
      await api.paperless.saveConfig.mutate({
        baseUrl,
        apiToken,
        enabled,
      });
      toast.success(t('settings-saved') || '设置已保存');
      setExistingToken(apiToken.slice(0, 8) + '...');
      setApiToken('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('save-failed') || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-2">
        <CardBody className="flex items-center justify-center h-40">
          <Icon icon="solar:refresh-linear" className="w-8 h-8 animate-spin text-primary" />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="p-2">
      <CardHeader className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon icon="solar:folder-with-files-bold-duotone" className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">{t('file-management') || '文件管理'}</h3>
          <p className="text-sm text-foreground/60">
            {t('paperless-description') || '配置 Paperless-ngx 连接以启用文件管理功能'}
          </p>
        </div>
      </CardHeader>
      
      <Divider />
      
      <CardBody className="space-y-6">
        {/* 启用开关 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{t('enable-file-management') || '启用文件管理'}</p>
            <p className="text-sm text-foreground/60">
              {t('enable-file-management-desc') || '开启后可在侧边栏访问文件管理功能'}
            </p>
          </div>
          <Switch
            isSelected={enabled}
            onValueChange={setEnabled}
            color="primary"
          />
        </div>

        <Divider />

        {/* Paperless URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Paperless-ngx URL
          </label>
          <Input
            placeholder="http://localhost:8000"
            value={baseUrl}
            onValueChange={setBaseUrl}
            startContent={<Icon icon="solar:link-linear" className="text-foreground/50" />}
            description={t('paperless-url-desc') || '输入 Paperless-ngx 服务的访问地址'}
          />
        </div>

        {/* API Token */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            API Token
          </label>
          <Input
            type="password"
            placeholder={existingToken || t('enter-api-token') || '输入 API Token'}
            value={apiToken}
            onValueChange={setApiToken}
            startContent={<Icon icon="solar:key-linear" className="text-foreground/50" />}
            description={
              <span>
                {t('api-token-desc') || '在 Paperless-ngx 管理界面获取 API Token'}
                <a 
                  href="https://docs.paperless-ngx.com/api/#authorization" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary ml-1 hover:underline"
                >
                  {t('learn-more') || '了解更多'}
                </a>
              </span>
            }
          />
        </div>

        {/* 测试结果 */}
        {testResult && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${
            testResult.success 
              ? 'bg-success/10 text-success' 
              : 'bg-danger/10 text-danger'
          }`}>
            <Icon 
              icon={testResult.success ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} 
              className="w-5 h-5" 
            />
            <span className="text-sm">
              {testResult.success 
                ? t('connection-successful') || '连接成功' 
                : testResult.error || t('connection-failed') || '连接失败'
              }
            </span>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="flat"
            onPress={handleTestConnection}
            isLoading={isTesting}
            startContent={!isTesting && <Icon icon="solar:plug-circle-linear" />}
          >
            {t('test-connection') || '测试连接'}
          </Button>
          <Button
            color="primary"
            onPress={handleSave}
            isLoading={isSaving}
            startContent={!isSaving && <Icon icon="solar:diskette-linear" />}
          >
            {t('save') || '保存'}
          </Button>
        </div>

        {/* 帮助信息 */}
        <div className="bg-default-50 rounded-lg p-4 space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Icon icon="solar:info-circle-linear" className="w-4 h-4" />
            {t('quick-start') || '快速开始'}
          </h4>
          <ol className="text-sm text-foreground/70 space-y-1 list-decimal list-inside">
            <li>{t('paperless-step-1') || '使用 Docker 部署 Paperless-ngx 服务'}</li>
            <li>{t('paperless-step-2') || '在 Paperless-ngx 管理界面创建 API Token'}</li>
            <li>{t('paperless-step-3') || '在上方填入服务地址和 Token'}</li>
            <li>{t('paperless-step-4') || '点击测试连接确认配置正确'}</li>
          </ol>
          <p className="text-xs text-foreground/50 mt-2">
            {t('paperless-docker-hint') || '提示: 项目已提供 Docker Compose 配置文件，位于 echo/docker-compose.paperless.yml'}
          </p>
        </div>
      </CardBody>
    </Card>
  );
});
