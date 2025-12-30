# Requirements Document

## Introduction

本功能旨在升级现有的 RAG 系统，引入 LangGraph Adaptive RAG 架构和 AutoGen TransformMessages 的消息管理能力。通过智能路由、文档相关性评分、幻觉检测、答案质量评估和自适应重试机制，显著提升 AI 对话的准确性和可靠性。同时加入消息历史管理，避免长对话超出 token 限制。

## Glossary

- **Adaptive_RAG_Service**: 自适应检索增强生成服务，负责智能路由和质量控制
- **Query_Router**: 查询路由器，使用 LLM 判断问题应该走向量库、结构化数据还是 Web 搜索
- **Document_Grader**: 文档评分器，评估检索到的文档是否与问题相关
- **Hallucination_Grader**: 幻觉检测器，验证生成内容是否基于检索文档
- **Answer_Grader**: 答案评估器，判断答案是否真正回答了用户问题
- **Message_Transformer**: 消息转换器，负责限制消息历史和 token 数量
- **LightRAG**: 现有的知识图谱检索服务
- **Supabase**: 现有的结构化数据存储

## Requirements

### Requirement 1: 智能查询路由

**User Story:** As a user, I want the system to intelligently route my questions to the most appropriate data source, so that I get more accurate and relevant answers.

#### Acceptance Criteria

1. WHEN a user submits a query, THE Query_Router SHALL analyze the query using LLM and return a routing decision (vectorstore, structured_data, or websearch)
2. WHEN the query is about portfolio positions, transactions, or market data, THE Query_Router SHALL route to structured_data
3. WHEN the query is about investment strategies, principles, or knowledge, THE Query_Router SHALL route to vectorstore (LightRAG)
4. WHEN the query is about current events or real-time information, THE Query_Router SHALL route to websearch
5. THE Query_Router SHALL return a JSON response with datasource field and confidence score

### Requirement 2: 文档相关性评分

**User Story:** As a user, I want the system to filter out irrelevant documents, so that the AI only uses relevant information to answer my questions.

#### Acceptance Criteria

1. WHEN documents are retrieved from vectorstore, THE Document_Grader SHALL evaluate each document's relevance to the query
2. THE Document_Grader SHALL return a binary score (yes/no) for each document
3. WHEN all retrieved documents are marked as not relevant, THE Adaptive_RAG_Service SHALL trigger a fallback to websearch
4. WHEN at least one document is relevant, THE Adaptive_RAG_Service SHALL proceed to generation with filtered documents
5. THE Document_Grader SHALL complete evaluation within 2 seconds per document

### Requirement 3: 幻觉检测

**User Story:** As a user, I want the system to verify that AI responses are grounded in retrieved documents, so that I can trust the information provided.

#### Acceptance Criteria

1. WHEN a response is generated, THE Hallucination_Grader SHALL evaluate whether the response is grounded in the provided documents
2. THE Hallucination_Grader SHALL return a binary score (yes = grounded, no = hallucination)
3. IF the response is detected as hallucination, THEN THE Adaptive_RAG_Service SHALL trigger regeneration or fallback
4. THE Hallucination_Grader SHALL provide a brief explanation of its assessment
5. THE system SHALL limit regeneration attempts to a maximum of 3 retries

### Requirement 4: 答案质量评估

**User Story:** As a user, I want the system to verify that the AI actually answered my question, so that I don't receive irrelevant responses.

#### Acceptance Criteria

1. WHEN a response passes hallucination check, THE Answer_Grader SHALL evaluate whether it addresses the user's question
2. THE Answer_Grader SHALL return a binary score (yes = useful, no = not useful)
3. IF the answer is not useful, THEN THE Adaptive_RAG_Service SHALL trigger websearch fallback
4. WHEN the answer is useful, THE Adaptive_RAG_Service SHALL return the response to the user
5. THE Answer_Grader SHALL complete evaluation within 1 second

### Requirement 5: 自适应重试机制

**User Story:** As a user, I want the system to automatically try alternative strategies when initial retrieval fails, so that I get the best possible answer.

#### Acceptance Criteria

1. WHEN document grading fails (no relevant documents), THE Adaptive_RAG_Service SHALL fallback to websearch
2. WHEN hallucination is detected, THE Adaptive_RAG_Service SHALL regenerate with the same documents (up to 3 times)
3. WHEN answer is not useful after max retries, THE Adaptive_RAG_Service SHALL return the best available response with a disclaimer
4. THE Adaptive_RAG_Service SHALL track the current loop_step and enforce max_retries limit
5. THE Adaptive_RAG_Service SHALL log all retry decisions for debugging

### Requirement 6: 消息历史管理

**User Story:** As a user, I want the system to handle long conversations without errors, so that I can have extended discussions without hitting token limits.

#### Acceptance Criteria

1. WHEN the conversation history exceeds the configured message limit, THE Message_Transformer SHALL truncate older messages
2. WHEN the total token count exceeds the configured limit, THE Message_Transformer SHALL truncate message content
3. THE Message_Transformer SHALL preserve the most recent messages (configurable, default 10)
4. THE Message_Transformer SHALL preserve a minimum token threshold before applying truncation (configurable, default 500)
5. THE Message_Transformer SHALL log the number of messages and tokens removed

### Requirement 7: 状态管理与流程控制

**User Story:** As a developer, I want a clear state machine for the RAG workflow, so that the system behavior is predictable and debuggable.

#### Acceptance Criteria

1. THE Adaptive_RAG_Service SHALL maintain a GraphState with: question, documents, generation, web_search flag, loop_step
2. WHEN transitioning between nodes, THE Adaptive_RAG_Service SHALL update the state accordingly
3. THE Adaptive_RAG_Service SHALL support conditional edges based on grading results
4. THE Adaptive_RAG_Service SHALL emit events for each state transition (for debugging/logging)
5. THE Adaptive_RAG_Service SHALL handle errors gracefully and return to a safe state

### Requirement 8: 与现有系统集成

**User Story:** As a developer, I want the new Adaptive RAG to integrate seamlessly with existing LightRAG and Supabase services, so that we don't lose existing functionality.

#### Acceptance Criteria

1. THE Adaptive_RAG_Service SHALL use existing LightRAG service for vectorstore queries
2. THE Adaptive_RAG_Service SHALL use existing Supabase service for structured data queries
3. THE Adaptive_RAG_Service SHALL maintain backward compatibility with existing ragService API
4. WHEN LightRAG is unavailable, THE Adaptive_RAG_Service SHALL fallback to Supabase vector search
5. THE Adaptive_RAG_Service SHALL preserve existing citation generation functionality
