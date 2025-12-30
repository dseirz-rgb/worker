# Implementation Plan: Multi-Agent System Deep Integration

## Overview

本实现计划将多 Agent 系统深度集成到现有 UI 组件和服务中，分为三个阶段执行。

## Tasks

### Phase 1: Core Integration (P0)

- [ ] 1. Create useMultiAgent Hook
  - [ ] 1.1 Create `client/src/hooks/useMultiAgent.ts`
    - Define hook interface with state and actions
    - Implement analyze() with progress tracking
    - Implement quickAnalyze() for fast responses
    - Add cancel() and clearCache() methods
    - _Requirements: REQ-1.1, REQ-2.1_

  - [ ] 1.2 Write tests for useMultiAgent
    - Test progress state updates
    - Test error handling and fallback
    - Test cancel functionality
    - _Requirements: REQ-7.2_

- [ ] 2. Integrate RiskCenter AI Panel
  - [ ] 2.1 Refactor AIAnalysisPanel to use useMultiAgent
    - Replace direct API calls with hook
    - Add progress bar component
    - Display agent results in accordion
    - _Requirements: REQ-1.1.1, REQ-1.1.2, REQ-1.1.3_

  - [ ] 2.2 Create AgentProgressBar component
    - Show overall progress percentage
    - Highlight current agent
    - Display phase description
    - _Requirements: REQ-7.1.1_

  - [ ] 2.3 Create AgentResultsAccordion component
    - Expandable sections for each agent
    - Show summary and key findings
    - Status indicators (success/error)
    - _Requirements: REQ-1.1.3_

  - [ ] 2.4 Integrate Alert System with RiskCenter logs
    - Subscribe to agent alerts
    - Add alerts to risk log list
    - Include agent name in alert
    - _Requirements: REQ-1.2.1, REQ-1.2.2_

- [ ] 3. Integrate DecisionCenter Chat
  - [ ] 3.1 Create chatQueryRouter service
    - Implement query classification logic
    - Define patterns for simple/complex queries
    - Return suggested orchestration mode
    - _Requirements: REQ-2.1.1, REQ-2.1.2_

  - [ ] 3.2 Modify InvestmentMirror to use multi-agent
    - Route queries through chatQueryRouter
    - Use respond_directly for simple queries
    - Use sequential for complex analysis
    - _Requirements: REQ-2.1.1, REQ-2.1.2_

  - [ ] 3.3 Add agent thinking display
    - Collapsible section showing agent progress
    - Display current agent and phase
    - Show intermediate results
    - _Requirements: REQ-2.1.3_

  - [ ] 3.4 Preserve RAG citation functionality
    - Merge agent results with RAG citations
    - Display unified citation list
    - _Requirements: REQ-2.1.4_

- [ ] 4. Checkpoint - Phase 1 Complete
  - Verify RiskCenter AI Panel uses multi-agent
  - Verify Chat routes queries correctly
  - Verify progress display works
  - Run all tests

### Phase 2: Enhancement (P1)

- [ ] 5. Enhance Daily Briefing
  - [ ] 5.1 Create generateDailyInsightWithAgents method
    - Use quickAnalyze with daily insight query
    - Extract insights from each agent
    - Format as DailyInsight structure
    - _Requirements: REQ-3.1.1, REQ-3.1.2, REQ-3.1.3, REQ-3.1.4_

  - [ ] 5.2 Update DailyBriefingModal to show agent insights
    - Display agent-specific sections
    - Add expandable details
    - Show analysis timestamp
    - _Requirements: REQ-3.2.1, REQ-3.2.2_

- [ ] 6. Enhance AgentDemo Page
  - [ ] 6.1 Add mode selector UI
    - Dropdown for all 4 orchestration modes
    - Description for each mode
    - _Requirements: REQ-5.1.1_

  - [ ] 6.2 Add execution flow visualization
    - Show agent sequence diagram
    - Highlight active agent
    - Display handoff messages
    - _Requirements: REQ-5.1.2_

  - [ ] 6.3 Add Memory and Alert status panels
    - Show memory entries count
    - Display recent alerts
    - Clear buttons
    - _Requirements: REQ-5.1.3_

  - [ ] 6.4 Add Personality configuration
    - Risk tolerance selector
    - Decision style selector
    - Preview personality effect
    - _Requirements: REQ-5.1.4_

- [ ] 7. Implement Agent Analysis Cache
  - [ ] 7.1 Create agentAnalysisStore with Zustand
    - Store latest result
    - Track staleness
    - Persist to localStorage
    - _Requirements: REQ-6.2.1_

  - [ ] 7.2 Integrate cache with useMultiAgent
    - Check cache before analysis
    - Update cache after analysis
    - Invalidate on portfolio change
    - _Requirements: REQ-6.2.1, REQ-6.2.2_

- [ ] 8. Checkpoint - Phase 2 Complete
  - Verify Daily Briefing shows agent insights
  - Verify AgentDemo has all features
  - Verify caching works correctly
  - Run all tests

### Phase 3: Voice Integration (P2)

- [ ] 9. Create Agent Analysis API
  - [ ] 9.1 Create `/api/agent-analysis/latest` endpoint
    - Return latest analysis result
    - Include agent summaries
    - Format for voice context
    - _Requirements: REQ-4.1.1_

  - [ ] 9.2 Create `/api/agent-analysis/trigger` endpoint
    - Trigger new analysis
    - Return analysis ID
    - Support async polling
    - _Requirements: REQ-4.1.2_

- [ ] 10. Integrate Voice Service
  - [ ] 10.1 Create AgentContextFetcher in voice-service
    - Fetch latest analysis from API
    - Cache results with TTL
    - Build voice context string
    - _Requirements: REQ-4.1.1_

  - [ ] 10.2 Integrate with voice_handler.py
    - Include agent context in system prompt
    - Detect analysis trigger phrases
    - Call trigger API when requested
    - _Requirements: REQ-4.1.2, REQ-4.1.3_

  - [ ] 10.3 Write integration tests
    - Test context fetching
    - Test trigger detection
    - Test voice response quality
    - _Requirements: REQ-4.1_

- [ ] 11. Final Checkpoint
  - All integration points working
  - Performance requirements met
  - Backward compatibility verified
  - All tests passing

## File Changes Summary

### New Files
- `client/src/hooks/useMultiAgent.ts`
- `client/src/hooks/useMultiAgent.test.ts`
- `client/src/components/agents/AgentProgressBar.tsx`
- `client/src/components/agents/AgentResultsAccordion.tsx`
- `client/src/services/chatQueryRouter.ts`
- `client/src/stores/agentAnalysisStore.ts`
- `api/agent-analysis/latest.ts`
- `api/agent-analysis/trigger.ts`
- `voice-service/agent_context.py`

### Modified Files
- `client/src/pages/RiskCenter.tsx` - AIAnalysisPanel refactor
- `client/src/pages/InvestmentMirror.tsx` - Multi-agent integration
- `client/src/components/dashboard/DailyBriefingModal.tsx` - Agent insights
- `client/src/pages/AgentDemo.tsx` - Enhanced features
- `client/src/services/aiService.ts` - generateDailyInsightWithAgents
- `voice-service/voice_handler.py` - Agent context integration
- `voice-service/context_fetcher.py` - Agent context support

## Dependencies

- Phase 2 depends on Phase 1 completion
- Phase 3 depends on Phase 1 completion (can run parallel with Phase 2)
- Task 7 (Cache) can be done independently after Task 1

## Estimated Effort

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | 1-4 | 2-3 days |
| Phase 2 | 5-8 | 1-2 days |
| Phase 3 | 9-11 | 1-2 days |
| **Total** | | **4-7 days** |

## Notes

- 优先完成 Phase 1，确保核心功能可用
- Phase 2 和 Phase 3 可以并行开发
- 每个 Checkpoint 后进行用户测试
- 保持向后兼容，可通过环境变量禁用新功能
