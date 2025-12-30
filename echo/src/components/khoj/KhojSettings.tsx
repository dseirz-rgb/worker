/**
 * Khoj 设置组件
 * 用于配置 Khoj 服务连接
 */

import * as React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Brain,
  CheckCircle,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  Settings,
  RefreshCw,
} from 'lucide-react';
import {
  loadKhojSettings,
  saveKhojSettings,
  testKhojConnection,
  type ConnectionTestResult,
} from '../../services/khoj/khojConfig';
import {
  initKhojClient,
  isKhojClientInitialized,
  getKhojClient,
} from '../../services/khoj/khojClient';
import type { KhojSettings as KhojSettingsType } from '../../types/khoj';

export function KhojSettings() {
  // 配置状态
  const [settings, setSettings] = React.useState<KhojSettingsType | null>(null);
  const [baseUrl, setBaseUrl] = React.useState('');
  const [apiKey, setApiKey] = React.useState('');
  
  // UI 状态
  const [isTesting, setIsTesting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [testResult, setTestResult] = React.useState<ConnectionTestResult | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);

  // 加载配置
  React.useEffect(() => {
    const loaded = loadKhojSettings();
    setSettings(loaded);
    setBaseUrl(loaded.connection.baseUrl);
    if (loaded.connection.apiKey) {
      setApiKey(loaded.connection.apiKey.slice(0, 10) + '...');
    }
    
    // 检查连接状态
    if (loaded.connection.enabled && isKhojClientInitialized()) {
      checkConnection();
    }
  }, []);

  // 检查连接状态
  const checkConnection = async () => {
    if (!isKhojClientInitialized()) {
      setIsConnected(false);
      return;
    }
    
    try {
      const client = getKhojClient();
      const healthy = await client.healthCheck();
      setIsConnected(healthy);
    } catch {
      setIsConnected(false);
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!baseUrl) {
      setTestResult({ success: false, message: '请输入服务器 URL' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testKhojConnection({
        enabled: true,
        baseUrl,
        apiKey: apiKey.includes('...') ? settings?.connection.apiKey : apiKey,
        autoSync: settings?.connection.autoSync ?? true,
        syncInterval: settings?.connection.syncInterval ?? 30,
      });
      setTestResult(result);
      
      if (result.success) {
        setIsConnected(true);
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : '测试失败',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 保存配置
  const handleSave = async () => {
    if (!baseUrl) {
      setTestResult({ success: false, message: '请输入服务器 URL' });
      return;
    }

    setIsSaving(true);
    
    try {
      const newSettings: KhojSettingsType = {
        connection: {
          enabled: true,
          baseUrl,
          apiKey: apiKey.includes('...') ? settings?.connection.apiKey : apiKey,
          autoSync: settings?.connection.autoSync ?? true,
          syncInterval: settings?.connection.syncInterval ?? 30,
        },
        features: settings?.features ?? {
          search: true,
          chat: true,
          agents: true,
          automation: false,
          documentUpload: true,
        },
      };

      // 保存配置
      saveKhojSettings(newSettings);
      setSettings(newSettings);

      // 初始化客户端
      initKhojClient({
        baseUrl: newSettings.connection.baseUrl,
        apiKey: newSettings.connection.apiKey,
      });

      // 测试连接
      const client = getKhojClient();
      const healthy = await client.healthCheck();
      setIsConnected(healthy);

      if (healthy) {
        setTestResult({ success: true, message: '配置已保存，连接成功' });
      } else {
        setTestResult({ success: false, message: '配置已保存，但连接失败' });
      }

      // 隐藏 API Key
      if (newSettings.connection.apiKey) {
        setApiKey(newSettings.connection.apiKey.slice(0, 10) + '...');
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : '保存失败',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 禁用 Khoj
  const handleDisable = () => {
    if (!settings) return;

    const newSettings: KhojSettingsType = {
      ...settings,
      connection: {
        ...settings.connection,
        enabled: false,
      },
    };

    saveKhojSettings(newSettings);
    setSettings(newSettings);
    setIsConnected(false);
    setTestResult(null);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Khoj 知识库
          {settings?.connection.enabled && (
            <span className="ml-auto flex items-center gap-1 text-xs font-normal">
              {isConnected ? (
                <>
                  <Wifi className="h-3 w-3 text-green-500" />
                  <span className="text-green-600">已连接</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-gray-400" />
                  <span className="text-muted-foreground">未连接</span>
                </>
              )}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 服务器 URL */}
        <div>
          <label className="text-xs text-muted-foreground">服务器 URL</label>
          <Input
            type="url"
            placeholder="http://localhost:42110"
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              setTestResult(null);
            }}
            className="mt-1"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="text-xs text-muted-foreground">API Key (可选)</label>
          <Input
            type="password"
            placeholder="留空使用默认认证"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setTestResult(null);
            }}
            className="mt-1"
          />
        </div>

        {/* 测试结果 */}
        {testResult && (
          <div
            className={`flex items-center gap-2 text-sm ${
              testResult.success ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {testResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {testResult.message}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={isTesting || !baseUrl}
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            测试连接
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !baseUrl}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Settings className="h-4 w-4 mr-1" />
            )}
            保存配置
          </Button>
          {settings?.connection.enabled && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisable}
            >
              禁用
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Khoj 是开源的 AI 知识助手。
          <a
            href="https://khoj.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline ml-1"
          >
            了解更多
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
