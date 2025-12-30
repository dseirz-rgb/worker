# Implementation Plan: Multi-Agent Investment Analysis System

## Overview

本实现计划将多 Agent 投资分析系统分解为可执行的编码任务。采用增量开发方式，先构建核心框架（支持多种编排模式），再添加增强功能（Personality、Memory、Extended Thinking），然后逐步添加各个 Agent 和数据源，最后集成到现有系统。

## Tasks

- [x] 1. Set up project structure and core interfaces ✅
  - Create `client/src/services/agents/` directory structure
  - Define TypeScript interfaces for Agent, AgentContext, AgentResult, HandoffMessage
  - Define AgentState interface for state persistence
  - Define AgentPersonality and AgentMemoryConfig interfaces
  - Set up fast-check testing framework
  - _Requirements: 1.1, 1.1.1, 1.2.1, 1.3.1, 6.1_
  - **Completed:** `types.ts` (1405 lines), `index.ts` (exports)

- [x] 2. Implement Agent Orchestrator with Multi-Mode Support ✅
  - [x] 2.1 Create AgentOrchestrator class with sequential execution ✅
    - Implement execute() method with context accumulation
    - Add progress event emission
    - Implement error handling with fallback results
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Add Selector mode to Orchestrator ✅
    - Implement selectNextAgent() using LLM
    - Add agent description support for LLM selection
    - Implement termination conditions
    - _Requirements: 1.6, 1.8_

  - [x] 2.3 Add Handoff mode to Orchestrator ✅
    - Implement HandoffMessage detection and routing
    - Add handoff trace logging
    - Support default progression when no handoff
    - _Requirements: 1.7, 1.9_

  - [x] 2.4 Add Respond Directly mode to Orchestrator (Inspired by Agno Team) ✅
    - Implement assessQueryComplexity() method with pattern matching
    - Implement executeRespondDirectly() for simple queries
    - Add fallback to sequential mode for complex queries
    - _Requirements: 1.5.1, 1.5.2, 1.5.3, 1.5.4, 1.5.5_

  - [x] 2.5 Implement State Persistence ✅
    - Add saveState() and loadState() to Orchestrator
    - Implement StateManager class
    - Support resuming from saved state
    - _Requirements: 1.1.4, 1.1.5_
    - **Completed:** `stateManager.ts`

  - [x] 2.6 Implement Context Management (TransformMessages) ✅
    - Create MessageTransform interface
    - Implement MessageHistoryLimiter class
    - Implement MessageTokenLimiter class with min_tokens threshold
    - Implement TransformChain for composing transforms
    - Integrate transforms into Selector mode LLM calls
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_
    - **Completed:** `transforms.ts`

  - [x] 2.7 Write property tests for Orchestrator
    - **Property 1: Sequential Context Accumulation**
    - **Property 3: Error Resilience**
    - **Property 4: Progress Event Emission**
    - **Property 17: Selector Mode Agent Selection**
    - **Property 18: Handoff Message Routing**
    - **Property 22: Orchestration Mode Configuration**
    - **Property 33: Respond Directly Mode Query Classification**
    - **Property 40: Orchestration Mode Configuration (Extended)**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.5.1-1.5.5**

  - [x] 2.8 Write property tests for TransformMessages ✅
    - **Property 23: MessageHistoryLimiter Correctness**
    - **Property 24: MessageTokenLimiter Correctness**
    - **Property 25: MessageTokenLimiter Min Threshold**
    - **Property 26: MessageTokenLimiter Per-Message Truncation**
    - **Property 27: Transform Chain Composition**
    - **Property 28: Selector Mode Transform Application**
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9**
    - **Completed:** `transforms.test.ts`

  - **Completed:** `orchestrator.ts` (1413 lines)

- [x] 3. Implement Agent Personality System (Inspired by Stockagent) ✅
  - [x] 3.1 Define AgentPersonality interface and types ✅
    - Create riskTolerance enum: conservative, moderate, aggressive
    - Create decisionStyle enum: data-driven, intuitive, balanced
    - Add optional traits array for custom personality
    - _Requirements: 1.2.1, 1.2.2, 1.2.3_

  - [x] 3.2 Integrate personality into Agent interface ✅
    - Add optional personality property to Agent interface
    - Create personality-aware prompt templates
    - Implement personality override in ExecutionOptions
    - _Requirements: 1.2.4, 1.2.5_

  - [x] 3.3 Write property tests for Personality System ✅
    - **Property 35: Agent Personality Influence**
    - **Validates: Requirements 1.2.2, 1.2.3, 1.2.4**
    - **Completed:** `personality.test.ts`

  - **Completed:** `personality.ts`

- [x] 4. Implement Agent Memory System (Inspired by Agno) ✅
  - [x] 4.1 Create AgentMemoryManager class ✅
    - Implement store() method for saving MemoryEntry
    - Implement retrieve() with three strategies (recency, relevance, hybrid)
    - Implement prune() for automatic cleanup
    - _Requirements: 1.3.1, 1.3.2, 1.3.3, 1.3.4, 1.3.5_

  - [x] 4.2 Implement MemoryStorage interface and LocalStorageMemory ✅
    - Define save, getByAgent, deleteMany methods
    - Implement localStorage-based storage for browser
    - Add memory state to OrchestratorState for persistence
    - _Requirements: 1.3.1, 1.3.5_

  - [x] 4.3 Integrate memory into Orchestrator ✅
    - Add memoryManager to AgentOrchestrator
    - Load relevant memories before agent execution
    - Store important insights after Advisor execution
    - _Requirements: 1.3.6_

  - [x] 4.4 Write property tests for Memory System ✅
    - **Property 36: Memory Storage Round-Trip**
    - **Property 37: Memory Retrieval Strategy Compliance**
    - **Property 38: Memory Pruning Limit Enforcement**
    - **Validates: Requirements 1.3.1, 1.3.3, 1.3.4, 1.3.5**
    - **Completed:** `memory.test.ts`

  - **Completed:** `memory.ts`

- [x] 5. Implement Extended Thinking Mode (Inspired by Agno + Claude) ✅
  - [x] 5.1 Define ExtendedThinkingConfig interface ✅
    - Add enabled, budgetTokens, triggers fields
    - Define trigger conditions: criticalRisk, complexDecision, userRequested
    - _Requirements: 1.4.1_

  - [x] 5.2 Implement extended thinking in Advisor Agent ✅
    - Add shouldUseExtendedThinking() method
    - Implement callLLMWithExtendedThinking() with structured prompting
    - Log when extended thinking is activated
    - _Requirements: 1.4.2, 1.4.3, 1.4.4, 1.4.5_

  - [x] 5.3 Write property tests for Extended Thinking ✅
    - **Property 34: Extended Thinking Trigger on Critical Risk**
    - **Property 39: Extended Thinking Budget Compliance**
    - **Validates: Requirements 1.4.2, 1.4.3, 1.4.4**
    - **Completed:** `extendedThinking.test.ts`

  - **Completed:** `extendedThinking.ts`

- [x] 6. Checkpoint - Enhanced Features Complete
  - Ensure all tests pass, ask the user if questions arise.


- [x] 7. Implement Position Analyst Agent ✅
  - [x] 7.1 Create PositionAnalystAgent class ✅
    - Implement concentration analysis (top 3, HHI index)
    - Implement correlation risk detection
    - Implement performance attribution
    - Add AI summary generation via Gemini
    - Add saveState/loadState methods
    - Add personality support for recommendation style
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 1.2.4_
    - **Completed:** `positionAnalyst.ts`

  - [x] 7.2 Write property tests for Position Analyst ✅
    - **Property 5: Position Analyst Output Schema**
    - **Property 6: High Concentration Detection**
    - **Property 19: State Persistence Round-Trip**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
    - **Completed:** `positionAnalyst.test.ts` (12 tests)

- [x] 8. Implement Risk Analyst Agent ✅
  - [x] 8.1 Create RiskAnalystAgent class ✅
    - Implement drawdown calculation
    - Implement stress test scenarios (-10%, -20%, -30%)
    - Implement leverage assessment
    - Add risk level determination logic
    - Add saveState/loadState methods
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
    - **Completed:** `riskAnalyst.ts`

  - [x] 8.2 Write property tests for Risk Analyst ✅
    - **Property 7: Risk Analyst Output Schema**
    - **Property 8: Critical Risk Level Threshold**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
    - **Completed:** `riskAnalyst.test.ts` (20 tests)

- [x] 9. Checkpoint - Core Agents Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Data Source Adapters ✅
  - [x] 10.1 Create DataSource interface and base class ✅
    - Define isAvailable, getCache, setCache methods
    - Implement CacheManager with TTL support
    - _Requirements: 6.1, 8.1, 8.2_
    - **Completed:** `dataSources.ts`

  - [x] 10.2 Implement SerperDataSource ✅
    - Implement searchNews() with rate limiting
    - Add response caching (1 hour TTL)
    - Handle API errors gracefully
    - _Requirements: 6.2, 4.1_

  - [x] 10.3 Implement SECDataSource ✅
    - Implement ticker-to-CIK mapping
    - Implement getLatestFilings() for 10-K/10-Q
    - Add response caching
    - _Requirements: 6.3, 4.4_

  - [x] 10.4 Implement JinaDataSource ✅
    - Implement fetchArticleContent()
    - Add response caching
    - Support SEC filing page extraction
    - _Requirements: 6.4, 4.1.3, 4.1.4_

  - [x] 10.5 Write property tests for Data Sources ✅
    - **Property 13: DataSource Interface Compliance**
    - **Property 14: Cache TTL Enforcement**
    - **Property 15: Cache Bypass with Force Refresh**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 8.1, 8.2, 8.4**
    - **Completed:** `dataSources.test.ts` (39 tests)

- [x] 11. Implement Web Surfer Agent ✅
  - [x] 11.1 Create WebSurferAgent class ✅
    - Implement content extraction using Jina Reader
    - Add SEC filing parsing logic
    - Add news article parsing logic
    - Implement content caching (1 hour TTL)
    - Add saveState/loadState methods
    - _Requirements: 4.1.1, 4.1.2, 4.1.3, 4.1.4, 4.1.5, 4.1.6, 4.1.7_

  - [x] 11.2 Write property tests for Web Surfer Agent ✅
    - **Property 20: Web Surfer Content Extraction**
    - **Property 21: Web Surfer Cache Behavior**
    - **Validates: Requirements 4.1.1, 4.1.5, 4.1.6, 4.1.7**
    - **Completed:** `webSurfer.test.ts` (22 tests)

- [x] 12. Implement Market Analyst Agent ✅
  - [x] 12.1 Create MarketAnalystAgent class ✅
    - Integrate SerperDataSource for news fetching
    - Integrate SECDataSource for filings
    - Implement sentiment analysis
    - Implement market cycle detection
    - Add fallback to knowledge base on API failure
    - Add HandoffMessage support for web surfing
    - Add saveState/loadState methods
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
    - **Completed:** `marketAnalyst.ts`

  - [x] 12.2 Write property tests for Market Analyst ✅
    - **Property 9: Market Analyst Output Schema**
    - **Property 10: External API Fallback**
    - **Validates: Requirements 4.2, 4.3, 4.5, 4.6**
    - **Completed:** `marketAnalyst.test.ts` (25 tests)

- [x] 13. Implement Advisor Agent with Enhanced Features ✅
  - [x] 13.1 Create AdvisorAgent class ✅
    - Implement context gathering from previous agents (including Web Surfer)
    - Implement principle alignment check
    - Implement action plan generation
    - Generate final comprehensive report
    - Add HandoffMessage support for requesting additional analysis
    - Add saveState/loadState methods
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
    - **Completed:** `advisorAgent.ts`

  - [x] 13.2 Integrate Personality System into Advisor ✅
    - Add personality property with default moderate/data-driven
    - Adjust recommendation language based on riskTolerance
    - Adjust action priorities based on decisionStyle
    - _Requirements: 1.2.2, 1.2.3, 1.2.4_

  - [x] 13.3 Integrate Memory System into Advisor ✅
    - Retrieve relevant memories before generating recommendations
    - Store important insights to long-term memory after execution
    - Include memory context in action plan generation
    - _Requirements: 1.3.6_

  - [x] 13.4 Integrate Extended Thinking into Advisor ✅
    - Add shouldUseExtendedThinking() method
    - Implement callLLMWithExtendedThinking() with structured prompting
    - Enable extended thinking for CRITICAL risk scenarios
    - Log extended thinking activation
    - _Requirements: 1.4.2, 1.4.3, 1.4.4, 1.4.5_

  - [x] 13.5 Write property tests for Advisor Agent ✅
    - **Property 11: Advisor Agent Context Completeness**
    - **Property 12: Action Plan Structure**
    - **Property 34: Extended Thinking Trigger on Critical Risk**
    - **Property 35: Agent Personality Influence**
    - **Validates: Requirements 5.1, 5.3, 5.4, 1.2.2, 1.4.2**
    - **Completed:** `advisorAgent.test.ts` (32 tests)

- [x] 14. Checkpoint - All Agents Complete
  - Ensure all tests pass, ask the user if questions arise.


- [x] 15. Implement AI-Triggered Alert System ✅
  - [x] 15.1 Create AgentAlertManager class ✅
    - Define AgentAlertEvent interface
    - Define AlertTriggerConfig with configurable thresholds
    - Implement checkAndEmitAlerts() method
    - Implement cooldown mechanism (30 minutes)
    - _Requirements: 10.1, 10.2, 10.3, 10.6_

  - [x] 15.2 Implement alert checks for each agent type ✅
    - Add checkRiskAnalystAlerts() for drawdown/leverage thresholds
    - Add checkMarketAnalystAlerts() for sentiment threshold
    - Add checkAdvisorAlerts() for CRITICAL risk level
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 15.3 Integrate with existing riskAlertService ✅
    - Create sendAgentAlert() function to convert AgentAlertEvent to RiskAlert
    - Call triggerRiskAlerts() with appropriate options
    - Send email for CRITICAL severity alerts
    - _Requirements: 10.4, 10.5, 10.9_

  - [x] 15.4 Add alert event emission to Orchestrator ✅
    - Add onAlert callback to ExecutionOptions
    - Emit alert events after each agent execution
    - Include agent analysis summary in alert data
    - _Requirements: 10.7, 10.8_

  - [x] 15.5 Write property tests for Alert System ✅
    - **Property 29: Alert Trigger Thresholds**
    - **Property 30: Alert Content Completeness**
    - **Property 31: Alert Cooldown Enforcement**
    - **Property 32: Orchestrator Alert Event Emission**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.5, 10.6, 10.7, 10.8**
    - **Completed:** `alertManager.test.ts` (56 tests)

  - **Completed:** `alertManager.ts`

- [x] 16. Integrate with Existing System ✅
  - [x] 16.1 Create multiAgentService.ts ✅
    - Export generateMultiAgentReport() function
    - Wire up all agents in correct sequence
    - Add environment variable configuration
    - Support mode selection (sequential/selector/handoff/respond_directly)
    - Integrate AgentAlertManager for automatic alerts
    - Integrate AgentMemoryManager for cross-session learning
    - _Requirements: 7.1, 10.4, 1.3.6_
    - **Completed:** `multiAgentService.ts`

  - [x] 16.2 Refactor aiService.generateRiskReport() ✅
    - Replace single API call with multi-agent orchestrator
    - Maintain backward compatible output format
    - Add progress callback support
    - Add alert callback support
    - _Requirements: 7.1, 7.2, 7.3, 10.8_

  - [x] 16.3 Update database schema for execution trace
    - Add execution_trace column to ai_analyses table
    - Add orchestrator_state column for state persistence
    - Add agent_memories table for long-term memory storage
    - Store full agent trace for debugging
    - _Requirements: 7.4, 1.1.4, 1.3.1_

  - [x] 16.4 Write property tests for integration ✅
    - **Property 16: Backward Compatible Report Format**
    - **Validates: Requirements 7.2**
    - **Completed:** `multiAgentService.test.ts` (27 tests)

- [x] 17. Add Environment Configuration ✅
  - [x] 17.1 Update .env.example with new API keys and settings ✅
    - Add SERPER_API_KEY
    - Add SEC_API_KEY (optional)
    - Add ORCHESTRATION_MODE (default: sequential)
    - Add ALERT_DRAWDOWN_THRESHOLD (default: 15)
    - Add ALERT_LEVERAGE_THRESHOLD (default: 2.5)
    - Add ALERT_SENTIMENT_THRESHOLD (default: -0.5)
    - Add EXTENDED_THINKING_ENABLED (default: true)
    - Add EXTENDED_THINKING_BUDGET_TOKENS (default: 1024)
    - Add AGENT_MEMORY_ENABLED (default: true)
    - Add AGENT_MEMORY_MAX_ENTRIES (default: 100)
    - Document configuration in README
    - _Requirements: 6.6, 10.1, 10.2, 10.3, 1.4.1, 1.3.1_

- [x] 18. Final Checkpoint ✅
  - All 318 tests pass
  - Run full integration test with real portfolio data
  - Test all four orchestration modes (sequential/selector/handoff/respond_directly)
  - Test alert triggering with mock high-risk data
  - Test extended thinking activation with CRITICAL risk scenario
  - Test memory persistence across sessions
  - Verify report generation completes within 60 seconds
  - _Requirements: 7.5, 10.1, 10.2, 10.3, 1.4.2, 1.3.6_

## Notes

- All tasks including property-based tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- External API tests should use mocks to avoid rate limiting during CI

### New Features from Stockagent and Agno Analysis:
- **Agent Personality System** (Stockagent): Configurable risk tolerance and decision style
- **Agent Memory System** (Agno): Long-term memory with recency/relevance/hybrid retrieval
- **Extended Thinking Mode** (Agno + Claude): Deep reasoning for complex scenarios
- **Respond Directly Mode** (Agno Team): Fast response for simple queries
- **Selector mode**: LLM dynamically chooses next agent
- **Handoff mode**: Agents explicitly transfer control
- **State persistence**: Resume interrupted analyses
- **Web Surfer Agent**: Deep web content extraction
- **TransformMessages**: Automatic long context handling
- **AI-Triggered Alerts**: Automatic risk notifications
