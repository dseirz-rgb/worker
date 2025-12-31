/**
 * Janitor 设置组件
 * 配置 AI 文件整理服务连接
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
  Tabs,
  Tab,
} from '@heroui/react';
import { api } from '@/lib/trpc';
import { RootStore } from '@/store';
import { ToastPlugin } from '@/store/module/Toast/Toast';
import { JanitorConfigPanel } from './JanitorConfigPanel';

// 默认配置值
const DEFAULT_JANITOR_URL = 'http://localhost:8766';

export const JanitorSetting = observer(() => {
  const { t } = useTranslation();
  const toast = RootStore.Get(ToastPlugin);
  
  const [baseUrl, setBaseUrl] = useState(DEFAULT_JANITOR_URL);
  const [enabled, setEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [serviceInfo, setServiceInfo] = useState<{ version: string; status: string } | null>(null);
  const [activeTab, setActiveTab] = useState('connection');

  // 获取现有配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // 先尝试获取基本配置
        try {
          const config = await api.janitor.getConfig.query();
          if (config) {
            setBaseUrl(config.baseUrl || DEFAULT_JANITOR_URL);
            setEnabled(config.enabled ?? true);
          }
        } catch (configError) {
          console.warn('Failed to load janitor config, using defaults:', configError);
          // 使用默认值，不阻塞加载
        }
        
        // 尝试获取服务状态（独立的 try-catch）
        try {
          const health = await api.janitor.getHealth.query();
          setServiceInfo({ version: health.version, status: health.status });
        } catch {
          // 服务不可用是正常情况，不需要报错
          setServiceInfo(null);
        }
      } catch (error) {
        console.error('Failed to load janitor settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  // 测试连接
  const handleTestConnection = async () => {
    if (!baseUrl) {
      toast.error('请填写 Janitor 服务地址');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await api.janitor.testConnection.mutate({ baseUrl });
      setTestResult({
        success: result.success,
        error: result.error || undefined,
      });
      
      if (result.success) {
        toast.success('连接成功');
        // 刷新服务状态
        try {
          const health = await api.janitor.getHealth.query();
          setServiceInfo({ version: health.version, status: health.status });
        } catch {
          setServiceInfo(null);
        }
      } else {
        toast.error(result.error || '连接失败');
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
    <div className="space-y-4">
      {/* 标签页切换 */}
      <Tabs 
        selectedKey={activeTab} 
        onSelectionChange={(key) => setActiveTab(key as string)}
        color="warning"
        variant="underlined"
        classNames={{
          tabList: "gap-6",
        }}
      >
        <Tab 
          key="connection" 
          title={
            <div className="flex items-center gap-2">
              <Icon icon="solar:plug-circle-linear" className="w-4 h-4" />
              <span>服务连接</span>
            </div>
          }
        />
        <Tab 
          key="config" 
          title={
            <div className="flex items-center gap-2">
              <Icon icon="solar:settings-linear" className="w-4 h-4" />
              <span>目录配置</span>
            </div>
          }
        />
      </Tabs>

      {/* 连接设置 */}
      {activeTab === 'connection' && (
        <Card className="p-2">
          <CardHeader className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Icon icon="solar:magic-stick-3-bold-duotone" className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">AI 文件整理 (Janitor)</h3>
              <p className="text-sm text-foreground/60">
                使用 AI 自动分类和重命名文件
              </p>
            </div>
            {serviceInfo && (
              <div className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${
                  serviceInfo.status === 'healthy' ? 'bg-success' : 'bg-warning'
                }`} />
                <span className="text-foreground/60">v{serviceInfo.version}</span>
              </div>
            )}
          </CardHeader>
          
          <Divider />
          
          <CardBody className="space-y-6">
            {/* 启用开关 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">启用 AI 整理</p>
                <p className="text-sm text-foreground/60">
                  开启后可在文件页面使用 AI 整理功能
                </p>
              </div>
              <Switch
                isSelected={enabled}
                onValueChange={setEnabled}
                color="warning"
              />
            </div>

            <Divider />

            {/* Janitor URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Janitor 服务地址
              </label>
              <Input
                placeholder="http://localhost:8000"
                value={baseUrl}
                onValueChange={setBaseUrl}
                startContent={<Icon icon="solar:link-linear" className="text-foreground/50" />}
                description="Echo Janitor 服务的访问地址"
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
                    ? '连接成功' 
                    : testResult.error || '连接失败'
                  }
                </span>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="flat"
                color="warning"
                onPress={handleTestConnection}
                isLoading={isTesting}
                startContent={!isTesting && <Icon icon="solar:plug-circle-linear" />}
              >
                测试连接
              </Button>
              <Button
                variant="flat"
                onPress={() => setActiveTab('config')}
                startContent={<Icon icon="solar:settings-linear" />}
              >
                配置目录
              </Button>
            </div>

            {/* 功能说明 */}
            <div className="bg-warning/5 border border-warning/20 rounded-lg p-4 space-y-3">
              <h4 className="font-medium flex items-center gap-2 text-warning">
                <Icon icon="solar:lightbulb-bolt-linear" className="w-4 h-4" />
                功能说明
              </h4>
              <div className="text-sm text-foreground/70 space-y-2">
                <p><strong>AI 分类：</strong>自动识别文件内容并分类到合适的目录</p>
                <p><strong>智能重命名：</strong>根据文件内容生成有意义的文件名</p>
                <p><strong>批量处理：</strong>一次性处理整个目录的文件</p>
                <p><strong>撤销功能：</strong>支持回滚最近的整理操作</p>
              </div>
            </div>

            {/* 启动说明 */}
            <div className="bg-default-50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Icon icon="solar:info-circle-linear" className="w-4 h-4" />
                启动服务
              </h4>
              <div className="text-sm text-foreground/70 space-y-1">
                <p>1. 确保已配置 Groq API Key（用于 AI 分析）</p>
                <p>2. 进入 <code className="bg-default-100 px-1 rounded">echo/sidecar/janitor</code> 目录</p>
                <p>3. 运行 <code className="bg-default-100 px-1 rounded">python server.py</code></p>
              </div>
              <p className="text-xs text-foreground/50 mt-2">
                提示: 也可以使用 Docker Compose 启动，配置文件位于 echo/sidecar/docker-compose.janitor.yml
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 目录配置 */}
      {activeTab === 'config' && <JanitorConfigPanel />}
    </div>
  );
});
