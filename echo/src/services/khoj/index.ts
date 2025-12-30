/**
 * Khoj 服务模块
 * 导出 Khoj 客户端和相关功能
 */

export {
  KhojClient,
  KhojClientError,
  initKhojClient,
  getKhojClient,
  isKhojClientInitialized,
  resetKhojClient,
} from './khojClient';

export {
  loadKhojSettings,
  saveKhojSettings,
  testKhojConnection,
  getKhojSettings,
  updateKhojSettings,
  resetSettingsCache,
  clearKhojSettings,
  type ConnectionTestResult,
} from './khojConfig';

// 重新导出类型
export type {
  KhojConfig,
  KhojSearchResult,
  KhojSearchOptions,
  KhojChatMessage,
  KhojChatOptions,
  KhojAgent,
  KhojIndexStatus,
  KhojConversation,
  KhojIndexResult,
  KhojConnectionConfig,
  KhojFeatureFlags,
  KhojSettings,
} from '../../types/khoj';

export { DEFAULT_KHOJ_SETTINGS } from '../../types/khoj';
