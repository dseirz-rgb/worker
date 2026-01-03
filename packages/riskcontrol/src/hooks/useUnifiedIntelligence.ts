/**
 * useUnifiedIntelligence Hook
 *
 * React Hook 封装统一智能服务，提供状态管理和便捷的 API。
 *
 * @module hooks/useUnifiedIntelligence
 * @see {@link .kiro/specs/unified-intelligence/design.md}
 */

import { useState, useCallback, useRef } from 'react';
import {
  unifiedIntelligenceService,
  type QueryResult,
  type AnalysisResult,
  type QueryContext,
  type QueryOptions,
  type DeepAnalyzeOptions,
  type ProcessingMode,
  type PortfolioState,
  type AgentResult,
  type AgentAlertEvent,
  type ProgressStatus,
} from '../services/unifiedIntelligence';

// =============================================================================
// Types
// =============================================================================

/**
 * Hook 配置选项
 */
export interface UseUnifiedIntelligenceOptions {
  /** 自动分类查询 (default: true) */
  autoClassify?: boolean;

  /** 显示进度 (default: true) */
  enableProgress?: boolean;

  /** Alert 回调 */
  onAlert?: (alert: AgentAlertEvent) => void;

  /** 错误回调 */
  onError?: (error: Error) => void;
}

/**
 * Hook 返回值
 */
export interface UseUnifiedIntelligenceReturn {
  // State
  /** 是否正在处理 */
  isProcessing: boolean;

  /** 当前处理模式 */
  mode: 'idle' | ProcessingMode;

  /** 进度状态 */
  progress: ProgressStatus | null;

  /** 查询结果 */
  result: QueryResult | AnalysisResult | null;

  /** 错误信息 */
  error: Error | null;

  // Actions
  /** 执行查询 */
  query: (question: string, context?: QueryContext) => Promise<void>;

  /** 深度分析 */
  deepAnalyze: (portfolio: PortfolioState, query?: string) => Promise<void>;

  /** 快速响应 */
  quickAnswer: (question: string) => Promise<void>;

  /** 取消当前操作 */
  cancel: () => void;

  /** 重置状态 */
  reset: () => void;

  // Agent State
  /** Agent 结果 */
  agentResults: Map<string, AgentResult>;

  /** 当前执行的 Agent */
  currentAgent: string | null;

  /** 触发的告警 */
  alerts: AgentAlertEvent[];
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * useUnifiedIntelligence Hook
 *
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const {
 *     query,
 *     isProcessing,
 *     mode,
 *     result,
 *     progress,
 *     agentResults,
 *   } = useUnifiedIntelligence({
 *     enableProgress: true,
 *     onAlert: (alert) => console.log('Alert:', alert),
 *   });
 *
 *   const handleSend = async (message: string) => {
 *     await query(message);
 *   };
 *
 *   return (
 *     <div>
 *       {isProcessing && <ProgressBar progress={progress} />}
 *       {result && <ResponseDisplay result={result} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useUnifiedIntelligence(
  options: UseUnifiedIntelligenceOptions = {}
): UseUnifiedIntelligenceReturn {
  const {
    autoClassify = true,
    enableProgress = true,
    onAlert,
    onError,
  } = options;

  // State
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<'idle' | ProcessingMode>('idle');
  const [progress, setProgress] = useState<ProgressStatus | null>(null);
  const [result, setResult] = useState<QueryResult | AnalysisResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [agentResults, setAgentResults] = useState<Map<string, AgentResult>>(
    new Map()
  );
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AgentAlertEvent[]>([]);

  // Refs for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef(false);

  // ===========================================================================
  // Helper Functions
  // ===========================================================================

  const resetState = useCallback(() => {
    setIsProcessing(false);
    setMode('idle');
    setProgress(null);
    setResult(null);
    setError(null);
    setAgentResults(new Map());
    setCurrentAgent(null);
    setAlerts([]);
    isCancelledRef.current = false;
  }, []);

  const handleProgress = useCallback((progressUpdate: ProgressStatus) => {
    if (isCancelledRef.current) return;

    setProgress(progressUpdate);
    setCurrentAgent(progressUpdate.currentAgent);

    if (progressUpdate.mode) {
      setMode(progressUpdate.mode as ProcessingMode);
    }
  }, []);

  const handleAlert = useCallback(
    (alert: AgentAlertEvent) => {
      if (isCancelledRef.current) return;

      setAlerts((prev) => [...prev, alert]);
      onAlert?.(alert);
    },
    [onAlert]
  );

  const handleError = useCallback(
    (err: Error) => {
      if (isCancelledRef.current) return;

      setError(err);
      setIsProcessing(false);
      onError?.(err);
    },
    [onError]
  );

  // ===========================================================================
  // Actions
  // ===========================================================================

  /**
   * 执行查询
   */
  const query = useCallback(
    async (question: string, context?: QueryContext) => {
      // Reset state
      resetState();
      setIsProcessing(true);

      // Create abort controller
      abortControllerRef.current = new AbortController();

      try {
        const queryOptions: QueryOptions = {};

        if (!autoClassify && context?.forceMode) {
          queryOptions.forceMode = context.forceMode;
        }

        const queryResult = await unifiedIntelligenceService.query(
          question,
          context,
          queryOptions
        );

        if (isCancelledRef.current) return;

        setResult(queryResult);
        setMode(queryResult.mode);

        // Update agent results if available
        if (queryResult.agentResults) {
          const newAgentResults = new Map<string, AgentResult>();
          queryResult.agentResults.forEach((r) => {
            newAgentResults.set(r.agentId, r);
          });
          setAgentResults(newAgentResults);
        }
      } catch (err) {
        handleError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!isCancelledRef.current) {
          setIsProcessing(false);
          setCurrentAgent(null);
        }
      }
    },
    [autoClassify, resetState, handleError]
  );

  /**
   * 深度分析
   */
  const deepAnalyze = useCallback(
    async (portfolio: PortfolioState, analysisQuery?: string) => {
      // Reset state
      resetState();
      setIsProcessing(true);
      setMode('full_agent');

      // Create abort controller
      abortControllerRef.current = new AbortController();

      try {
        const deepAnalyzeOptions: DeepAnalyzeOptions = {
          query: analysisQuery,
          onProgress: enableProgress ? handleProgress : undefined,
          onAlert: handleAlert,
        };

        const analysisResult = await unifiedIntelligenceService.deepAnalyze(
          portfolio,
          analysisQuery,
          deepAnalyzeOptions
        );

        if (isCancelledRef.current) return;

        setResult(analysisResult);

        // Update agent results
        if (analysisResult.agentResults) {
          const newAgentResults = new Map<string, AgentResult>();
          analysisResult.agentResults.forEach((r) => {
            newAgentResults.set(r.agentId, r);
          });
          setAgentResults(newAgentResults);
        }

        // Update alerts
        if ('alerts' in analysisResult && analysisResult.alerts) {
          setAlerts(analysisResult.alerts);
        }
      } catch (err) {
        handleError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!isCancelledRef.current) {
          setIsProcessing(false);
          setCurrentAgent(null);
        }
      }
    },
    [resetState, enableProgress, handleProgress, handleAlert, handleError]
  );

  /**
   * 快速响应
   */
  const quickAnswer = useCallback(
    async (question: string) => {
      // Reset state
      resetState();
      setIsProcessing(true);
      setMode('rag_only');

      // Create abort controller
      abortControllerRef.current = new AbortController();

      try {
        const quickResult = await unifiedIntelligenceService.quickAnswer(question);

        if (isCancelledRef.current) return;

        setResult(quickResult);
      } catch (err) {
        handleError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!isCancelledRef.current) {
          setIsProcessing(false);
        }
      }
    },
    [resetState, handleError]
  );

  /**
   * 取消当前操作
   */
  const cancel = useCallback(() => {
    isCancelledRef.current = true;
    abortControllerRef.current?.abort();
    setIsProcessing(false);
    setCurrentAgent(null);
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    cancel();
    resetState();
  }, [cancel, resetState]);

  // ===========================================================================
  // Return
  // ===========================================================================

  return {
    // State
    isProcessing,
    mode,
    progress,
    result,
    error,

    // Actions
    query,
    deepAnalyze,
    quickAnswer,
    cancel,
    reset,

    // Agent State
    agentResults,
    currentAgent,
    alerts,
  };
}

// =============================================================================
// Default Export
// =============================================================================

export default useUnifiedIntelligence;
