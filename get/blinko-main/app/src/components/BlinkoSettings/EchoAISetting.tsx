/**
 * EchoAI 设置组件
 * 配置 EchoAI 服务器连接和功能选项
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Input, 
  Button, 
  Card, 
  CardBody, 
  CardHeader, 
  Divider, 
  Switch,
  Select,
  SelectItem,
  Slider,
  Chip,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { api } from '@/lib/trpc';
import { 
  getEchoAIConfig, 
  saveEchoAIConfig, 
  resetEchoAIConfig,
} from '@/lib/echoaiService';
import { DailyReport } from '@/components/echoai';

// ============================================
// 类型定义
// ============================================

interface EchoAISettings {
  baseUrl: string;
  enabled: boolean;
  defaultAgent?: string;
  defaultMode?: 'normal' | 'research';
  voiceInputEnabled?: boolean;
  ttsEnabled?: boolean;
  ttsSpeed?: number;
}

// ============================================
// 组件
// ============================================

export function EchoAISetting() {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [defaultMode, setDefaultMode] = useState<'normal' | 'research'>('normal');
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saved, setSaved] = useState(false);
  const [serviceInfo, setServiceInfo] = useState<{
    version?: string;
    status?: string;
    indexedFiles?: number;
  } | null>(null);

  // 加载配置
  useEffect(() => {
    const config = getEchoAIConfig();
    setUrl(config.baseUrl);
    setEnabled(config.enabled);
    // 加载扩展配置
    const extConfig = localStorage.getItem('echoai_ext_config');
    if (extConfig) {
      try {
        const parsed = JSON.parse(extConfig);
        setDefaultMode(parsed.defaultMode || 'normal');
        setVoiceInputEnabled(parsed.voiceInputEnabled ?? true);
        setTtsEnabled(parsed.ttsEnabled ?? true);
        setTtsSpeed(parsed.ttsSpeed ?? 1.0);
      } catch (e) {
        console.error('解析扩展配置失败:', e);
      }
    }
  }, []);

  // 获取服务信息
  useEffect(() => {
    if (enabled && url) {
      fetchServiceInfo();
    }
  }, [enabled, url]);

  const fetchServiceInfo = async () => {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) {
        const data = await response.json();
        setServiceInfo({
          version: data.version || '未知',
          status: '运行中',
          indexedFiles: data.indexed_files,
        });
      }
    } catch {
      setServiceInfo({ status: '离线' });
    }
  };

  // 保存配置
  const handleSave = () => {
    saveEchoAIConfig({ baseUrl: url, enabled });
    // 保存扩展配置
    localStorage.setItem('echoai_ext_config', JSON.stringify({
      defaultMode,
      voiceInputEnabled,
      ttsEnabled,
      ttsSpeed,
    }));
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
      if (result.success) {
        fetchServiceInfo();
      }
    } catch {
      setTestResult('error');
    }
    setTesting(false);
  };

  // 重置配置
  const handleReset = () => {
    resetEchoAIConfig();
    localStorage.removeItem('echoai_ext_config');
    const config = getEchoAIConfig();
    setUrl(config.baseUrl);
    setEnabled(config.enabled);
    setDefaultMode('normal');
    setVoiceInputEnabled(true);
    setTtsEnabled(true);
    setTtsSpeed(1.0);
    setTestResult(null);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
          <Icon icon="mdi:robot-outline" className="w-6 h-6 text-white" />
        </div>
        <div className="flex flex-col">
          <p className="text-md font-semibold">{t('echoai-assistant')}</p>
          <p className="text-small text-default-500">{t('echoai-config-desc')}</p>
        </div>
      </CardHeader>
      
      <Divider />
      
      <CardBody className="space-y-4">
        {/* 启用开关 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t('enable')} EchoAI</p>
            <p className="text-xs text-default-500">{t('echoai-config-desc')}</p>
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
              description="EchoAI URL"
            />
          </div>
        </div>

        {/* 服务状态信息 */}
        {serviceInfo && (
          <div className="bg-default-100 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-default-600">服务状态</span>
              <Chip 
                size="sm" 
                color={serviceInfo.status === '运行中' ? 'success' : 'danger'}
                variant="flat"
              >
                {serviceInfo.status}
              </Chip>
            </div>
            {serviceInfo.version && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-default-600">版本</span>
                <span className="text-sm">{serviceInfo.version}</span>
              </div>
            )}
            {serviceInfo.indexedFiles !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-default-600">已索引文件</span>
                <span className="text-sm">{serviceInfo.indexedFiles} 个</span>
              </div>
            )}
          </div>
        )}

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

        <Divider />

        {/* 默认模式 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">默认对话模式</label>
          <Select
            selectedKeys={[defaultMode]}
            onSelectionChange={(keys) => setDefaultMode(Array.from(keys)[0] as 'normal' | 'research')}
            size="sm"
          >
            <SelectItem key="normal">普通模式</SelectItem>
            <SelectItem key="research">研究模式（深度分析）</SelectItem>
          </Select>
          <p className="text-xs text-default-500">
            研究模式会进行更深入的分析，但响应时间更长
          </p>
        </div>

        <Divider />

        {/* 语音设置 */}
        <div className="space-y-4">
          <p className="text-sm font-medium">语音功能</p>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">语音输入</p>
              <p className="text-xs text-default-500">使用麦克风输入消息</p>
            </div>
            <Switch
              isSelected={voiceInputEnabled}
              onValueChange={setVoiceInputEnabled}
              size="sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">文本转语音 (TTS)</p>
              <p className="text-xs text-default-500">朗读 AI 回复</p>
            </div>
            <Switch
              isSelected={ttsEnabled}
              onValueChange={setTtsEnabled}
              size="sm"
            />
          </div>

          {ttsEnabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">朗读速度</span>
                <span className="text-sm text-default-500">{ttsSpeed.toFixed(1)}x</span>
              </div>
              <Slider
                size="sm"
                step={0.1}
                minValue={0.5}
                maxValue={2.0}
                value={ttsSpeed}
                onChange={(value) => setTtsSpeed(value as number)}
                className="max-w-full"
              />
            </div>
          )}
        </div>

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
            {t('how-to-start-echoai')}
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

        <Divider />

        {/* 日报设置 */}
        <DailyReport />
      </CardBody>
    </Card>
  );
}

export default EchoAISetting;
