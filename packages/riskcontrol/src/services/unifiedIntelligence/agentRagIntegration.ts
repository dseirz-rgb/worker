/**
 * Agent-RAG Integration
 *
 * 为 Multi-Agent 系统提供带质量控制的 RAG 检索接口。
 *
 * 主要功能：
 * 1. 为 Agent 提供检索接口，自动选择合适的数据源
 * 2. 文档评分 - 过滤低相关性文档
 * 3. 幻觉检测 - 验证 Agent 生成的回答是否基于文档
 *
 * @module unifiedIntelligence/agentRagIntegration
 * @see {@link .kiro/specs/unified-intelligence/design.md}
 */

import type { Document, Citation } from '../adaptiveRag/types';
import { DocumentGrader } from '../adaptiveRag/documentGrader';
import { HallucinationGrader } from '../adaptiveRag/hallucinationGrader';
import {
  EnhancedAdaptiveRAGService,
  type AgentRetrievalOptions,
} from './enhancedAdaptiveRag';
import type { RetrievalResult, ValidationResult } from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Quality control options
 */
export interface QualityControlOptions {
  /** Enable document grading (default: true) */
  enableDocumentGrading?: boolean;

  /** Minimum relevance score for documents (default: 0.5) */
  minRelevanceScore?: number;

  /** Enable hallucination detection (default: true) */
  enableHallucinationDetection?: boolean;

  /** Maximum regeneration attempts on hallucination (default: 2) */
  maxRegenerationAttempts?: number;
}

/**
 * Graded document with relevance score
 */
export interface GradedDocument extends Document {
  /** Relevance score from grading */
  gradeScore: number;

  /** Whether the document passed grading */
  isRelevant: boolean;
}

/**
 * Retrieval result with quality metrics
 */
export interface QualityControlledRetrievalResult extends RetrievalResult {
  /** Documents that passed grading */
  gradedDocuments: GradedDocument[];

  /** Number of documents filtered out */
  filteredCount: number;

  /** Average relevance score */
  averageRelevance: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_QUALITY_OPTIONS: Required<QualityControlOptions> = {
  enableDocumentGrading: true,
  minRelevanceScore: 0.5,
  enableHallucinationDetection: true,
  maxRegenerationAttempts: 2,
};

// =============================================================================
// AgentRAGIntegration Class
// =============================================================================

/**
 * Agent-RAG Integration
 *
 * 为 Agent 提供带质量控制的检索和验证功能。
 *
 * @example
 * ```typescript
 * const integration = new AgentRAGIntegration();
 *
 * // 带质量控制的检索
 * const result = await integration.retrieveWithQualityControl(
 *   'risk_analyst',
 *   '分析当前杠杆风险'
 * );
 *
 * // 验证 Agent 回答
 * const validation = await integration.validateAgentResponse(
 *   'Agent 生成的回答...',
 *   result.documents
 * );
 *
 * if (!validation.isGrounded) {
 *   // 需要重新生成
 * }
 * ```
 */
export class AgentRAGIntegration {
  private enhancedRag: EnhancedAdaptiveRAGService;
  private documentGrader: DocumentGrader;
  private hallucinationGrader: HallucinationGrader;
  private options: Required<QualityControlOptions>;

  constructor(options?: QualityControlOptions) {
    this.options = { ...DEFAULT_QUALITY_OPTIONS, ...options };
    this.enhancedRag = new EnhancedAdaptiveRAGService();
    this.documentGrader = new DocumentGrader();
    this.hallucinationGrader = new HallucinationGrader();
  }

  // ===========================================================================
  // Retrieval with Quality Control
  // ===========================================================================

  /**
   * 为 Agent 提供带质量控制的检索
   *
   * 流程：
   * 1. 使用 EnhancedAdaptiveRAG 检索文档
   * 2. 对文档进行相关性评分
   * 3. 过滤低相关性文档
   *
   * @param agentId - Agent 标识符
   * @param query - 检索查询
   * @param retrievalOptions - 检索选项
   * @param qualityOptions - 质量控制选项
   * @returns 带质量指标的检索结果
   */
  async retrieveWithQualityControl(
    agentId: string,
    query: string,
    retrievalOptions?: AgentRetrievalOptions,
    qualityOptions?: QualityControlOptions
  ): Promise<QualityControlledRetrievalResult> {
    const options = { ...this.options, ...qualityOptions };

    // 1. 检索文档
    const retrievalResult = await this.enhancedRag.retrieveForAgent(
      agentId,
      query,
      retrievalOptions
    );

    // 2. 如果禁用文档评分，直接返回
    if (!options.enableDocumentGrading) {
      return {
        ...retrievalResult,
        gradedDocuments: retrievalResult.documents.map((doc) => ({
          ...doc,
          gradeScore: doc.relevance_score || 0.5,
          isRelevant: true,
        })),
        filteredCount: 0,
        averageRelevance: this.calculateAverageRelevance(retrievalResult.documents),
      };
    }

    // 3. 对文档进行评分
    const gradedDocuments = await this.gradeDocuments(
      retrievalResult.documents,
      query
    );

    // 4. 过滤低相关性文档
    const relevantDocuments = gradedDocuments.filter(
      (doc) => doc.isRelevant && doc.gradeScore >= options.minRelevanceScore
    );

    const filteredCount = gradedDocuments.length - relevantDocuments.length;

    return {
      documents: relevantDocuments,
      citations: retrievalResult.citations,
      hasRelevantDocs: relevantDocuments.length > 0,
      gradedDocuments,
      filteredCount,
      averageRelevance: this.calculateAverageRelevance(relevantDocuments),
    };
  }

  /**
   * 简化的检索接口（不带质量控制）
   */
  async retrieve(
    agentId: string,
    query: string,
    options?: AgentRetrievalOptions
  ): Promise<RetrievalResult> {
    return this.enhancedRag.retrieveForAgent(agentId, query, options);
  }

  // ===========================================================================
  // Response Validation
  // ===========================================================================

  /**
   * 验证 Agent 生成的回答
   *
   * 使用 HallucinationGrader 检查回答是否基于检索到的文档。
   *
   * @param response - Agent 生成的回答
   * @param documents - 检索到的文档
   * @returns 验证结果
   */
  async validateAgentResponse(
    response: string,
    documents: Document[]
  ): Promise<ValidationResult> {
    // 如果禁用幻觉检测，直接返回通过
    if (!this.options.enableHallucinationDetection) {
      return {
        isGrounded: true,
        explanation: 'Hallucination detection disabled',
        needsRegeneration: false,
      };
    }

    // 如果没有文档，无法验证
    if (documents.length === 0) {
      return {
        isGrounded: false,
        explanation: 'No documents available for validation',
        needsRegeneration: true,
      };
    }

    try {
      // 提取文档内容
      const documentContents = documents.map((doc) => doc.content);

      // 调用幻觉检测
      const result = await this.hallucinationGrader.grade(response, documentContents);

      return {
        isGrounded: result.binary_score === 'yes',
        explanation: result.explanation,
        needsRegeneration: result.binary_score === 'no',
      };
    } catch (error) {
      console.error('[AgentRAGIntegration] Validation error:', error);
      // 出错时保守处理，标记需要重新生成
      return {
        isGrounded: false,
        explanation: 'Validation failed due to error',
        needsRegeneration: true,
      };
    }
  }

  /**
   * 验证并可能触发重新生成
   *
   * @param response - Agent 生成的回答
   * @param documents - 检索到的文档
   * @param regenerateCallback - 重新生成回调函数
   * @returns 最终验证通过的回答
   */
  async validateWithRegeneration(
    response: string,
    documents: Document[],
    regenerateCallback: () => Promise<string>
  ): Promise<{ response: string; validation: ValidationResult; attempts: number }> {
    let currentResponse = response;
    let attempts = 0;

    while (attempts < this.options.maxRegenerationAttempts) {
      const validation = await this.validateAgentResponse(currentResponse, documents);

      if (validation.isGrounded) {
        return { response: currentResponse, validation, attempts };
      }

      // 需要重新生成
      attempts++;
      console.log(
        `[AgentRAGIntegration] Regeneration attempt ${attempts}/${this.options.maxRegenerationAttempts}`
      );

      try {
        currentResponse = await regenerateCallback();
      } catch (error) {
        console.error('[AgentRAGIntegration] Regeneration failed:', error);
        break;
      }
    }

    // 达到最大重试次数，返回最后的结果
    const finalValidation = await this.validateAgentResponse(currentResponse, documents);
    return {
      response: currentResponse,
      validation: finalValidation,
      attempts,
    };
  }

  // ===========================================================================
  // Document Grading
  // ===========================================================================

  /**
   * 对文档进行相关性评分
   */
  private async gradeDocuments(
    documents: Document[],
    query: string
  ): Promise<GradedDocument[]> {
    const gradedDocuments: GradedDocument[] = [];

    for (const doc of documents) {
      try {
        const result = await this.documentGrader.grade(doc.content, query);

        gradedDocuments.push({
          ...doc,
          gradeScore: result.confidence,
          isRelevant: result.binary_score === 'yes',
        });
      } catch (error) {
        console.warn('[AgentRAGIntegration] Document grading error:', error);
        // 出错时保守处理，保留文档
        gradedDocuments.push({
          ...doc,
          gradeScore: doc.relevance_score || 0.5,
          isRelevant: true,
        });
      }
    }

    return gradedDocuments;
  }

  /**
   * 计算平均相关性分数
   */
  private calculateAverageRelevance(documents: Document[]): number {
    if (documents.length === 0) {
      return 0;
    }

    const sum = documents.reduce(
      (acc, doc) => acc + (doc.relevance_score || 0.5),
      0
    );
    return sum / documents.length;
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * 更新质量控制选项
   */
  updateOptions(options: Partial<QualityControlOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * 获取当前选项
   */
  getOptions(): Required<QualityControlOptions> {
    return { ...this.options };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/** 默认单例实例 */
export const agentRagIntegration = new AgentRAGIntegration();

/**
 * 便捷函数：带质量控制的检索
 */
export async function retrieveWithQualityControl(
  agentId: string,
  query: string,
  options?: AgentRetrievalOptions
): Promise<QualityControlledRetrievalResult> {
  return agentRagIntegration.retrieveWithQualityControl(agentId, query, options);
}

/**
 * 便捷函数：验证 Agent 回答
 */
export async function validateAgentResponse(
  response: string,
  documents: Document[]
): Promise<ValidationResult> {
  return agentRagIntegration.validateAgentResponse(response, documents);
}
