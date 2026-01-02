/**
 * AI 上下文管理系统
 * 
 * 提供 Kiro IDE 中 AI 助手的上下文管理能力
 */

// 核心类型
export * from './types';

// 文件引用解析器
export {
  parseFileReferences,
  buildFileReferenceSyntax,
  isValidFileReferenceSyntax,
  extractPathFromSyntax,
  replaceFileReferences,
  normalizePath,
  getUniqueFilePaths,
} from './fileReferenceParser';

// Steering 文件加载器
export {
  parseFrontMatter,
  matchesPattern,
  shouldLoadSteeringFile,
  resolveConflicts,
  steeringFileToContextItem,
  loadSteeringFiles,
  getSteeringFileReferences,
  type SteeringFrontMatter,
  type SteeringFile,
  type LoadOptions,
} from './steeringLoader';

// Spec 文档加载器
export {
  isTaskExecutionMode,
  extractFeatureName,
  buildSpecDocPath,
  parseSpecDocument,
  getRequiredSpecDocs,
  specDocToContextItem,
  loadSpecDocuments,
  getAllReferencedFiles,
  isValidSpecDirectory,
  getActiveSpecDocs,
  type SpecDocType,
  type SpecDocument,
  type SpecDirectory,
} from './specLoader';

// Budget 分配器
export {
  BudgetAllocator,
  createDefaultBudgetAllocator,
  createBudgetAllocatorFromJson,
} from './budgetAllocator';

// 压缩引擎
export {
  CompressionEngine,
  createCompressionEngine,
  estimateTokenCount,
  type CompressionOptions,
} from './compressionEngine';

// 缓存管理器
export {
  CacheManager,
  createCacheManager,
  type CacheConfig,
} from './cacheManager';

// 输出摘要器
export {
  OutputSummarizer,
  createOutputSummarizer,
  needsSummarization,
  type SummarizationOptions,
  type SummarizationCheckResult,
  type SummarizationResult,
} from './outputSummarizer';

// 上下文序列化器
export {
  ContextSerializer,
  createContextSerializer,
  createEmptyContextState,
  isEquivalentState,
} from './contextSerializer';

// 上下文管理器
export {
  ContextManager,
  createContextManager,
  type ContextManagerConfig,
  type AssembleOptions,
  type ContextStats,
} from './contextManager';
