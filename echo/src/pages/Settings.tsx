/**
 * 设置页面
 */

import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { getAIConfig, setAIConfig } from '../services/ai/config';
import { useSync } from '../hooks/useSync';
import { 
  Settings as SettingsIcon, 
  Key, 
  Moon, 
  Sun, 
  Bell, 
  Database,
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { KhojSettings } from '../components/khoj';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [notifications, setNotifications] = useState(true);
  
  // Supabase 配置状态
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 同步 Hook
  const {
    status: syncStatus,
    isConfigured: isSyncConfigured,
    sync,
    configureSupabase,
    testConnection,
    queueLength,
  } = useSync();

  // 加载配置
  useEffect(() => {
    const config = getAIConfig();
    if (config.apiKey) {
      setApiKey(config.apiKey.slice(0, 10) + '...');
    }

    // 加载主题设置
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }

    // 加载通知设置
    const savedNotifications = localStorage.getItem('notifications');
    if (savedNotifications !== null) {
      setNotifications(savedNotifications === 'true');
    }

    // 加载 Supabase 配置
    const savedSupabaseConfig = localStorage.getItem('echo_supabase_config');
    if (savedSupabaseConfig) {
      try {
        const config = JSON.parse(savedSupabaseConfig);
        if (config.url) setSupabaseUrl(config.url);
        if (config.anonKey) setSupabaseKey(config.anonKey.slice(0, 20) + '...');
      } catch {
        // 忽略解析错误
      }
    }
  }, []);

  // 保存 API Key
  const handleSaveApiKey = () => {
    if (apiKey && !apiKey.includes('...')) {
      setAIConfig({ apiKey });
      setApiKey(apiKey.slice(0, 10) + '...');
    }
  };

  // 切换主题
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    // 应用主题
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (newTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // system
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  // 切换通知
  const handleNotificationsChange = (enabled: boolean) => {
    setNotifications(enabled);
    localStorage.setItem('notifications', String(enabled));
  };

  // 测试 Supabase 连接
  const handleTestConnection = async () => {
    if (!supabaseUrl || !supabaseKey || supabaseKey.includes('...')) {
      setTestResult({ success: false, error: '请输入完整的 URL 和 API Key' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection(supabaseUrl, supabaseKey);
      setTestResult(result);
    } catch (error) {
      setTestResult({ 
        success: false, 
        error: error instanceof Error ? error.message : '连接测试失败' 
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 保存 Supabase 配置
  const handleSaveSupabase = async () => {
    if (!supabaseUrl || !supabaseKey || supabaseKey.includes('...')) {
      setTestResult({ success: false, error: '请输入完整的 URL 和 API Key' });
      return;
    }

    setIsSaving(true);
    try {
      const success = await configureSupabase({
        url: supabaseUrl,
        anonKey: supabaseKey,
        enabled: true,
      });

      if (success) {
        setSupabaseKey(supabaseKey.slice(0, 20) + '...');
        setTestResult({ success: true });
      } else {
        setTestResult({ success: false, error: '保存配置失败' });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        error: error instanceof Error ? error.message : '保存失败' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 禁用同步
  const handleDisableSync = async () => {
    await configureSupabase({
      url: supabaseUrl,
      anonKey: '',
      enabled: false,
    });
    setSupabaseKey('');
    setTestResult(null);
  };

  // 手动同步
  const handleManualSync = async () => {
    try {
      await sync();
    } catch (error) {
      console.error('同步失败:', error);
    }
  };

  // 获取同步状态图标
  const getSyncStatusIcon = () => {
    switch (syncStatus.status) {
      case 'syncing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'conflict':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'offline':
        return <CloudOff className="h-4 w-4 text-gray-400" />;
      default:
        return <Cloud className="h-4 w-4 text-gray-400" />;
    }
  };

  // 获取同步状态文本
  const getSyncStatusText = () => {
    switch (syncStatus.status) {
      case 'syncing':
        return '同步中...';
      case 'success':
        return '同步成功';
      case 'error':
        return syncStatus.error || '同步失败';
      case 'conflict':
        return `${syncStatus.conflicts} 个冲突`;
      case 'offline':
        return '离线';
      default:
        return '空闲';
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* 标题 */}
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <SettingsIcon className="h-5 w-5" />
        设置
      </h1>

      {/* 云同步配置 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            云同步 (Supabase)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 同步状态 */}
          {isSyncConfigured && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                {getSyncStatusIcon()}
                <span className="text-sm">{getSyncStatusText()}</span>
                {syncStatus.isOnline ? (
                  <Wifi className="h-3 w-3 text-green-500" />
                ) : (
                  <WifiOff className="h-3 w-3 text-gray-400" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {queueLength > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {queueLength} 待同步
                  </span>
                )}
                {syncStatus.lastSyncAt && (
                  <span className="text-xs text-muted-foreground">
                    上次: {new Date(syncStatus.lastSyncAt).toLocaleTimeString()}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualSync}
                  disabled={syncStatus.status === 'syncing' || !syncStatus.isOnline}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${syncStatus.status === 'syncing' ? 'animate-spin' : ''}`} />
                  同步
                </Button>
              </div>
            </div>
          )}

          {/* Supabase URL */}
          <div>
            <label className="text-xs text-muted-foreground">Supabase URL</label>
            <Input
              type="url"
              placeholder="https://xxx.supabase.co"
              value={supabaseUrl}
              onChange={(e) => {
                setSupabaseUrl(e.target.value);
                setTestResult(null);
              }}
              className="mt-1"
            />
          </div>

          {/* Supabase API Key */}
          <div>
            <label className="text-xs text-muted-foreground">Supabase Anon Key</label>
            <Input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseKey}
              onChange={(e) => {
                setSupabaseKey(e.target.value);
                setTestResult(null);
              }}
              className="mt-1"
            />
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {testResult.success ? '连接成功' : testResult.error}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isTesting || !supabaseUrl || !supabaseKey}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : null}
              测试连接
            </Button>
            <Button
              size="sm"
              onClick={handleSaveSupabase}
              disabled={isSaving || !supabaseUrl || !supabaseKey}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : null}
              保存配置
            </Button>
            {isSyncConfigured && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisableSync}
              >
                禁用同步
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            从 Supabase 控制台获取项目 URL 和 anon key。
            <a 
              href="https://supabase.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline ml-1"
            >
              打开 Supabase
            </a>
          </p>
        </CardContent>
      </Card>

      {/* Khoj 知识库配置 */}
      <KhojSettings />

      {/* AI 配置 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Key className="h-4 w-4" />
            AI 配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Gemini API Key</label>
            <div className="flex gap-2 mt-1">
              <Input
                type="password"
                placeholder="AIza..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <Button onClick={handleSaveApiKey}>保存</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              从 Google AI Studio 获取 API Key
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 外观 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            外观
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleThemeChange('light')}
            >
              <Sun className="h-4 w-4 mr-1" />
              浅色
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleThemeChange('dark')}
            >
              <Moon className="h-4 w-4 mr-1" />
              深色
            </Button>
            <Button
              variant={theme === 'system' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleThemeChange('system')}
            >
              跟随系统
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 通知 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bell className="h-4 w-4" />
            通知
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm">启用通知提醒</span>
            <Button
              variant={notifications ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleNotificationsChange(!notifications)}
            >
              {notifications ? '已开启' : '已关闭'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 数据 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4" />
            数据管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">导出数据</p>
              <p className="text-xs text-muted-foreground">导出所有笔记、任务和设置</p>
            </div>
            <Button variant="outline" size="sm">
              导出
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">导入数据</p>
              <p className="text-xs text-muted-foreground">从备份文件恢复数据</p>
            </div>
            <Button variant="outline" size="sm">
              导入
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-destructive">清除数据</p>
              <p className="text-xs text-muted-foreground">删除所有本地数据</p>
            </div>
            <Button variant="destructive" size="sm">
              清除
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 关于 */}
      <Card>
        <CardContent className="p-4 text-center">
          <p className="font-medium">Echo</p>
          <p className="text-xs text-muted-foreground">AI 个人助手 v0.1.0</p>
          <p className="text-xs text-muted-foreground mt-2">
            Powered by Tauri + React + Gemini
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
