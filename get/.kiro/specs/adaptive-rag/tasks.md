# Implementation Plan: Adaptive RAG

## Overview

本实现计划将 Adaptive RAG 系统分解为可增量实现的任务。采用 TypeScript 实现，集成到现有的 `client/src/services/` 目录结构中，保持与现有 ragService 的 API 兼容性。

## Tasks

- [x] 1. 创建核心类型定义和状态管理
  - [x] 1.1 创建 GraphState 和相关类型定义
    - 在 `client/src/services/adaptiveRag/types.ts` 中定义 GraphState, RouteDecision, GradeResult 等接口
    - _Requirements: 7.1_
  - [x] 1.2 编写 GraphState 类型属性测试
    - **Property 10: GraphState Consistency**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 2. 实现 Message Transformer
  - [x] 2.1 创建 MessageTransformer 类
    - 在 `client/src/services/adaptiveRag/messageTransformer.ts` 中实现
    - 实现 applyMessageLimit, applyTokenLimit, transform 方法
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 2.2 编写 Message Transformer 属性测试
    - **Property 9: Message Transformation Invariants**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 3. 实现 Query Router
  - [x] 3.1 创建 QueryRouter 类
    - 在 `client/src/services/adaptiveRag/queryRouter.ts` 中实现
    - 使用 Gemini API 进行 LLM 路由决策
    - 实现 ROUTER_SYSTEM_PROMPT
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 3.2 编写 Query Router 属性测试
    - **Property 1: Query Router Output Validity**
    - **Property 2: Query Routing Consistency**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

- [x] 4. 实现 Document Grader
  - [x] 4.1 创建 DocumentGrader 类
    - 在 `client/src/services/adaptiveRag/documentGrader.ts` 中实现
    - 使用 LLM 评估文档相关性
    - 实现 DOC_GRADER_PROMPT
    - _Requirements: 2.1, 2.2_
  - [x] 4.2 编写 Document Grader 属性测试
    - **Property 3: Document Grader Output Validity**
    - **Property 4: Document Grading Fallback Behavior**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 5. 实现 Hallucination Grader
  - [x] 5.1 创建 HallucinationGrader 类
    - 在 `client/src/services/adaptiveRag/hallucinationGrader.ts` 中实现
    - 使用 LLM 检测幻觉
    - 实现 HALLUCINATION_GRADER_PROMPT
    - _Requirements: 3.1, 3.2, 3.4_
  - [x] 5.2 编写 Hallucination Grader 属性测试
    - **Property 5: Hallucination Grader Output Validity**
    - **Validates: Requirements 3.1, 3.2, 3.4**

- [x] 6. 实现 Answer Grader
  - [x] 6.1 创建 AnswerGrader 类
    - 在 `client/src/services/adaptiveRag/answerGrader.ts` 中实现
    - 使用 LLM 评估答案质量
    - 实现 ANSWER_GRADER_PROMPT
    - _Requirements: 4.1, 4.2_
  - [x] 6.2 编写 Answer Grader 属性测试
    - **Property 7: Answer Grader Output Validity**
    - **Property 8: Answer Grading Behavior**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 7. Checkpoint - 验证所有 Grader 组件
  - 所有 Grader 测试通过 (20 tests passed)

- [x] 8. 实现 Adaptive RAG Service 主流程
  - [x] 8.1 创建 AdaptiveRAGService 类框架
    - 在 `client/src/services/adaptiveRag/adaptiveRagService.ts` 中实现
    - 定义状态转换逻辑
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 8.2 实现 routeQuestion 节点
    - 调用 QueryRouter 进行路由决策
    - 更新 GraphState
    - _Requirements: 1.1_
  - [x] 8.3 实现 retrieve 节点
    - 集成现有 LightRAG 服务
    - 集成 Supabase 结构化数据查询
    - _Requirements: 8.1, 8.2_
  - [x] 8.4 实现 gradeDocuments 节点
    - 调用 DocumentGrader 评估文档
    - 过滤不相关文档
    - 设置 web_search 标志
    - _Requirements: 2.3, 2.4_
  - [x] 8.5 实现 generate 节点
    - 使用过滤后的文档生成回答
    - 生成 citations
    - _Requirements: 8.5_
  - [x] 8.6 实现 gradeGeneration 节点
    - 调用 HallucinationGrader 和 AnswerGrader
    - 返回路由决策 (useful, not_useful, not_supported, max_retries)
    - _Requirements: 3.3, 4.3, 4.4_
  - [x] 8.7 实现 webSearch 节点
    - 实现 Web 搜索降级逻辑
    - _Requirements: 5.1_
  - [x] 8.8 实现重试机制
    - 跟踪 loop_step
    - 强制 max_retries 限制
    - _Requirements: 5.2, 5.3, 5.4_
  - [x] 8.9 编写重试机制属性测试
    - **Property 6: Retry Mechanism Enforcement**
    - **Validates: Requirements 3.3, 3.5, 5.2, 5.4**

- [x] 9. 实现 API 兼容层
  - [x] 9.1 创建兼容 ragService 的 API 包装
    - 实现 getInvestmentContext 方法
    - 保持返回值格式一致
    - _Requirements: 8.3_
  - [x] 9.2 编写向后兼容性属性测试
    - **Property 11: Backward Compatibility**
    - **Validates: Requirements 8.3, 8.5**

- [x] 10. 实现降级和错误处理
  - [x] 10.1 实现 LightRAG 降级到 Supabase
    - 检测 LightRAG 可用性
    - 自动切换到 Supabase 向量搜索
    - _Requirements: 8.4_
  - [x] 10.2 编写降级链属性测试
    - **Property 12: Fallback Chain**
    - **Validates: Requirements 8.4**
  - [x] 10.3 实现错误恢复逻辑
    - 处理 LLM API 超时
    - 处理检索失败
    - 添加免责声明
    - _Requirements: 7.5_

- [x] 11. Checkpoint - 验证完整流程
  - 所有测试通过 (31 adaptiveRag tests + 12 ragService tests)

- [x] 12. 集成到现有系统
  - [x] 12.1 更新 ragService.ts 使用 AdaptiveRAGService
    - 替换现有的 classifyQuery 逻辑
    - 保持 API 不变
    - _Requirements: 8.3_
  - [x] 12.2 创建 index.ts 导出模块
    - 导出所有公共接口
    - _Requirements: 8.3_
  - [x] 12.3 编写集成测试
    - 测试端到端流程
    - 测试与 LightRAG 的集成
    - 测试与 Supabase 的集成

- [x] 13. Final Checkpoint - 确保所有测试通过
  - 所有 43 个测试通过

## Notes

- 所有任务都是必做的，包括属性测试
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- 实现使用 TypeScript，与现有代码风格保持一致
- 所有 LLM 调用使用 Gemini API (gemini-2.0-flash)
