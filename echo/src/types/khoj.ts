/**
 * Khoj 类型定义
 * 定义与 Khoj 服务交互所需的所有类型
 */

/**
 * Khoj 连接配置
 */
export interface KhojConfig {
  /** Khoj 服务器 URL */
  baseUrl: string;
  /** API 密钥（可选） */
  apiKey?: string;
  /** 用户名（可选） */
  username?: string;
  /** 请求超时时间（毫秒） */
  timeout?: number;
}

/**
 * Khoj 搜索结果
 */
export interface KhojSearchResult {
  /** 搜索到的内容条目 */
  entry: string;
  /** 相关性分数 */
  score: number;
  /** 来源文件路径 */
  file: string;
  /** 编译后的内容 */
  compiled: string;
  /** 附加信息 */
  additional: {
    /** 文件路径 */
    file: string;
    /** 标题（可选） */
    heading?: string;
  };
}

/**
 * Khoj 对话消息
 */
export interface KhojChatMessage {
  /** 消息角色 */
  role: 'user' | 'assistant' | 'khoj';
  /** 消息内容 */
  message: string;
  /** 上下文引用 */
  context?: string[];
  /** 在线上下文 */
  onlineContext?: Record<string, unknown>;
  /** 创建时间 */
  created: string;
}

/**
 * Khoj Agent
 */
export interface KhojAgent {
  /** Agent 唯一标识 */
  slug: string;
  /** Agent 名称 */
  name: string;
  /** Agent 人格描述 */
  personality: string;
  /** Agent 头像 URL */
  avatar?: string;
  /** 可用工具列表 */
  tools: string[];
  /** 是否公开 */
  public: boolean;
}

/**
 * 搜索选项
 */
export interface KhojSearchOptions {
  /** 文档类型过滤 */
  type?: 'all' | 'org' | 'markdown' | 'pdf';
  /** 返回结果数量限制 */
  limit?: number;
  /** 是否重新排序 */
  rerank?: boolean;
}

/**
 * 对话选项
 */
export interface KhojChatOptions {
  /** 对话 ID */
  conversationId?: string;
  /** 使用的 Agent */
  agent?: string;
  /** 是否流式响应 */
  stream?: boolean;
}

/**
 * 索引状态
 */
export interface KhojIndexStatus {
  /** 已索引文件数量 */
  indexed_files: number;
  /** 最后更新时间 */
  last_updated: string;
}

/**
 * 已索引文档信息
 */
export interface KhojIndexedDocument {
  /** 文件名 */
  filename: string;
  /** 文件路径 */
  path: string;
  /** 文件类型 */
  type: 'markdown' | 'pdf' | 'org' | 'text' | 'unknown';
  /** 文件大小（字节） */
  size?: number;
  /** 索引时间 */
  indexed_at?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 对话历史项
 */
export interface KhojConversation {
  /** 对话 ID */
  id: string;
  /** 对话标题 */
  title: string;
  /** 创建时间 */
  created: string;
}

/**
 * 文档索引结果
 */
export interface KhojIndexResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * Khoj 连接配置（用于设置页面）
 */
export interface KhojConnectionConfig {
  /** 是否启用 Khoj */
  enabled: boolean;
  /** 服务器 URL */
  baseUrl: string;
  /** API 密钥 */
  apiKey?: string;
  /** 用户名 */
  username?: string;
  /** 是否自动同步 */
  autoSync: boolean;
  /** 同步间隔（分钟） */
  syncInterval: number;
}

/**
 * Khoj 功能开关
 */
export interface KhojFeatureFlags {
  /** 搜索功能 */
  search: boolean;
  /** 对话功能 */
  chat: boolean;
  /** Agent 功能 */
  agents: boolean;
  /** 自动化功能 */
  automation: boolean;
  /** 文档上传功能 */
  documentUpload: boolean;
}

/**
 * 完整 Khoj 设置
 */
export interface KhojSettings {
  /** 连接配置 */
  connection: KhojConnectionConfig;
  /** 功能开关 */
  features: KhojFeatureFlags;
}

/**
 * 默认 Khoj 设置
 */
export const DEFAULT_KHOJ_SETTINGS: KhojSettings = {
  connection: {
    enabled: false,
    baseUrl: 'http://localhost:42110',
    autoSync: true,
    syncInterval: 30,
  },
  features: {
    search: true,
    chat: true,
    agents: true,
    automation: false,
    documentUpload: true,
  },
};
