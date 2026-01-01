/**
 * 文档服务路由器
 * 根据 Feature Flag 选择使用 Paperless 或原生文档服务
 */

import { prisma } from '../prisma';
import { PaperlessClient, createPaperlessClient, PaperlessError } from './paperlessClient';
import { DocumentService, createDocumentService } from './documentService';

// 统一的文档服务接口类型
export type DocumentServiceInterface = PaperlessClient | DocumentService;

/**
 * 检查是否启用原生文档服务
 */
async function isNativeDocumentsEnabled(accountId: number): Promise<boolean> {
  // 先查用户设置
  const userFlag = await prisma.featureFlag.findFirst({
    where: {
      key: 'use_native_documents',
      accountId,
    },
  });

  if (userFlag) {
    return userFlag.value;
  }

  // 再查全局设置
  const globalFlag = await prisma.featureFlag.findFirst({
    where: {
      key: 'use_native_documents',
      accountId: null,
    },
  });

  if (globalFlag) {
    return globalFlag.value;
  }

  // 默认使用 Paperless
  return false;
}

/**
 * 获取文档服务实例
 * 根据 Feature Flag 自动选择 Paperless 或原生服务
 */
export async function getDocumentService(accountId: number): Promise<DocumentServiceInterface> {
  const useNative = await isNativeDocumentsEnabled(accountId);

  if (useNative) {
    return createDocumentService(accountId);
  }

  // 尝试创建 Paperless 客户端
  try {
    const config = await prisma.config.findFirst({
      where: { userId: accountId, key: 'paperless' },
    });

    if (!config?.config) {
      throw new PaperlessError('Paperless-ngx 未配置');
    }

    const { baseUrl, apiToken } = config.config as { baseUrl: string; apiToken: string };
    
    if (!baseUrl || !apiToken) {
      throw new PaperlessError('Paperless-ngx 配置不完整');
    }

    return new PaperlessClient({ baseUrl, apiToken });
  } catch (error) {
    // 如果 Paperless 配置失败，回退到原生服务
    console.warn('Paperless 配置失败，回退到原生文档服务:', error);
    return createDocumentService(accountId);
  }
}

/**
 * 获取当前使用的文档服务类型
 */
export async function getDocumentServiceType(accountId: number): Promise<'paperless' | 'native'> {
  const useNative = await isNativeDocumentsEnabled(accountId);
  
  if (useNative) {
    return 'native';
  }

  // 检查 Paperless 是否已配置
  const config = await prisma.config.findFirst({
    where: { userId: accountId, key: 'paperless' },
  });

  if (config?.config) {
    const { baseUrl, apiToken } = config.config as { baseUrl: string; apiToken: string };
    if (baseUrl && apiToken) {
      return 'paperless';
    }
  }

  return 'native';
}

/**
 * 检查文档服务是否可用
 */
export async function isDocumentServiceAvailable(accountId: number): Promise<{
  available: boolean;
  type: 'paperless' | 'native';
  error?: string;
}> {
  const serviceType = await getDocumentServiceType(accountId);

  if (serviceType === 'native') {
    return {
      available: true,
      type: 'native',
    };
  }

  // 测试 Paperless 连接
  try {
    const service = await getDocumentService(accountId);
    if ('testConnection' in service) {
      const connected = await service.testConnection();
      return {
        available: connected,
        type: 'paperless',
        error: connected ? undefined : '无法连接到 Paperless-ngx',
      };
    }
    return {
      available: true,
      type: 'paperless',
    };
  } catch (error) {
    return {
      available: false,
      type: 'paperless',
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}
