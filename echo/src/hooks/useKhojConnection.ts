/**
 * Khoj 连接管理 Hook
 * 管理 Khoj 服务的连接状态和健康检查
 */

import * as React from 'react';
import {
  getKhojClient,
  initKhojClient,
  isKhojClientInitialized,
} from '../services/khoj/khojClient';
import { loadKhojSettings, saveKhojSettings } from '../services/khoj/khojConfig';
import type { KhojSettings } from '../types/khoj';

/**
 * Khoj 连接状态
 */
export interface KhojConnectionState {
  /** 是否已初始化 */
  initialized: boolean;
  /** 是否已连接 */
  connected: boolean;
  /** 是否正在检查 */
  checking: boolean;
  /** 错误信息 */
  error: string | null;
  /** 服务器 URL */
  serverUrl: string;
  /** 最后检查时间 */
  lastCheckAt: string | null;
}

/**
 * Khoj 连接管理 Hook
 */
export function useKhojConnection() {
  const [state, setState] = React.useState<KhojConnectionState>({
    initialized: false,
    connected: false,
    checking: false,
    error: null,
    serverUrl: '',
    lastCheckAt: null,
  });

  const [settings, setSettings] = React.useState<KhojSettings | null>(null);

  // 初始化
  React.useEffect(() => {
    initializeKhoj();
  }, []);

  // 定期健康检查
  React.useEffect(() => {
    if (!state.initialized || !settings?.connection.enabled) return;

    const interval = setInterval(() => {
      checkConnection();
    }, 60000); // 每分钟检查一次

    return () => clearInterval(interval);
  }, [state.initialized, settings?.connection.enabled]);

  /**
   * 初始化 Khoj 客户端
   */
  const initializeKhoj = React.useCallback(async () => {
    try {
      const loadedSettings = loadKhojSettings();
      setSettings(loadedSettings);

      if (!loadedSettings.connection.enabled) {
        setState(prev => ({
          ...prev,
          initialized: true,
          connected: false,
          serverUrl: loadedSettings.connection.baseUrl,
        }));
        return;
      }

      // 初始化客户端
      if (!isKhojClientInitialized()) {
        initKhojClient({
          baseUrl: loadedSettings.connection.baseUrl,
          apiKey: loadedSettings.connection.apiKey,
          username: loadedSettings.connection.username,
        });
      }

      setState(prev => ({
        ...prev,
        initialized: true,
        serverUrl: loadedSettings.connection.baseUrl,
      }));

      // 检查连接
      await checkConnection();
    } catch (error) {
      setState(prev => ({
        ...prev,
        initialized: true,
        error: error instanceof Error ? error.message : '初始化失败',
      }));
    }
  }, []);

  /**
   * 检查连接状态
   */
  const checkConnection = React.useCallback(async () => {
    if (!isKhojClientInitialized()) {
      setState(prev => ({
        ...prev,
        connected: false,
        error: 'Khoj 客户端未初始化',
      }));
      return false;
    }

    setState(prev => ({ ...prev, checking: true, error: null }));

    try {
      const client = getKhojClient();
      const healthy = await client.healthCheck();

      setState(prev => ({
        ...prev,
        connected: healthy,
        checking: false,
        lastCheckAt: new Date().toISOString(),
        error: healthy ? null : '无法连接到 Khoj 服务',
      }));

      return healthy;
    } catch (error) {
      setState(prev => ({
        ...prev,
        connected: false,
        checking: false,
        lastCheckAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : '连接检查失败',
      }));
      return false;
    }
  }, []);

  /**
   * 更新设置
   */
  const updateSettings = React.useCallback(async (newSettings: Partial<KhojSettings>) => {
    if (!settings) return;

    const updatedSettings: KhojSettings = {
      ...settings,
      ...newSettings,
      connection: {
        ...settings.connection,
        ...(newSettings.connection || {}),
      },
      features: {
        ...settings.features,
        ...(newSettings.features || {}),
      },
    };

    // 保存设置
    saveKhojSettings(updatedSettings);
    setSettings(updatedSettings);

    // 如果启用状态或 URL 改变，重新初始化
    if (
      newSettings.connection?.enabled !== undefined ||
      newSettings.connection?.baseUrl !== undefined
    ) {
      // 重新初始化客户端
      if (updatedSettings.connection.enabled) {
        initKhojClient({
          baseUrl: updatedSettings.connection.baseUrl,
          apiKey: updatedSettings.connection.apiKey,
          username: updatedSettings.connection.username,
        });

        setState(prev => ({
          ...prev,
          serverUrl: updatedSettings.connection.baseUrl,
        }));

        // 检查新连接
        await checkConnection();
      } else {
        setState(prev => ({
          ...prev,
          connected: false,
          error: null,
        }));
      }
    }
  }, [settings, checkConnection]);

  /**
   * 测试连接
   */
  const testConnection = React.useCallback(async (url: string, apiKey?: string) => {
    setState(prev => ({ ...prev, checking: true, error: null }));

    try {
      // 创建临时客户端测试
      const testClient = new (await import('../services/khoj/khojClient')).KhojClient({
        baseUrl: url,
        apiKey,
      });

      const healthy = await testClient.healthCheck();

      setState(prev => ({
        ...prev,
        checking: false,
        error: healthy ? null : '无法连接到指定的 Khoj 服务',
      }));

      return healthy;
    } catch (error) {
      setState(prev => ({
        ...prev,
        checking: false,
        error: error instanceof Error ? error.message : '连接测试失败',
      }));
      return false;
    }
  }, []);

  return {
    ...state,
    settings,
    checkConnection,
    updateSettings,
    testConnection,
    reinitialize: initializeKhoj,
  };
}

export default useKhojConnection;
