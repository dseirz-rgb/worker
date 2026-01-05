/**
 * Investment AI 模块入口
 * 
 * 导出投资 AI 功能的所有组件：
 * - 类型定义
 * - Context Builder
 * - (后续) Adaptive RAG Service
 * - (后续) Investment Agent
 * - (后续) Multi-Agent Orchestrator
 * 
 * @module services/echo-server/aiServer/investment
 */

// 类型导出
export * from './types';

// Context Builder
export {
  buildContext,
  buildStructuredContext,
  buildKnowledgeContext,
  mergeContexts,
  getPositions,
  getOptions,
  getTransactions,
  getPortfolioSummary,
  convertToPositionDetail,
  convertToOptionDetail,
  convertToTransactionDetail,
  clearContextCache,
  extractJSON,
} from './contextBuilder';

// Adaptive RAG Service
export {
  adaptiveRagService,
  AdaptiveRagService,
  getInvestmentContext,
  classifyQuery,
  isLightRAGAvailable,
  queryLightRAG,
} from './adaptiveRagService';

// Investment Agent
export {
  investmentAgent,
  InvestmentAgent,
  chat,
  streamChat,
  generateDailyInsight,
} from './investmentAgent';
