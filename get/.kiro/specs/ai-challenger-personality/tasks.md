# Implementation Plan: AI Challenger Personality Enhancement

## Overview

恢复和强化 AI 系统的"严厉教练"风格，确保统一智能系统继承原有的 "Debate & Challenge" 设计，并在设置页面添加 "AI 调教公示"。

## Tasks

- [x] 1. Create core challenger components
  - [x] 1.1 Create challengerPromptBuilder.ts
    - Create `client/src/services/challengerPromptBuilder.ts`
    - Implement `CHALLENGER_INSTRUCTIONS` constant with all challenger directives
    - Implement `buildChallengerPrompt()` function
    - Implement `ChallengerConfig` interface and `DEFAULT_CHALLENGER_CONFIG`
    - _Requirements: 1.1, 1.2, 3.1, 3.2_

  - [x] 1.2 Add CHALLENGER_PERSONALITY to personality.ts
    - Add `CHALLENGER_PERSONALITY` preset to `client/src/services/agents/personality.ts`
    - Add `generateChallengerPersonalityPrompt()` function
    - Ensure traits include: critical, challenging, principle-enforcing, direct
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.3 Write unit tests for challenger components
    - Test `buildChallengerPrompt()` with various inputs
    - Test `CHALLENGER_PERSONALITY` configuration
    - Test prompt injection logic
    - _Requirements: 1.1, 2.1_

- [x] 2. Integrate challenger into existing systems
  - [x] 2.1 Update AdvisorAgent default personality
    - Modify `client/src/services/agents/advisorAgent.ts`
    - Change default personality from moderate to CHALLENGER_PERSONALITY
    - Ensure backward compatibility with config override
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 2.2 Integrate challenger into UnifiedIntelligenceService
    - Modify `client/src/services/unifiedIntelligence/unifiedIntelligenceService.ts`
    - Import and use `buildChallengerPrompt()` in query methods
    - Load user principles for principle checking
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.3 Verify aiService.ts challenger style is preserved
    - Review `client/src/services/aiService.ts`
    - Ensure "Debate & Challenge" instructions are not overwritten
    - Optionally enhance with additional challenger directives
    - _Requirements: 1.5, 8.1_

  - [ ] 2.4 Write property test for principle contradiction detection
    - **Property 1: Principle Contradiction Detection**
    - **Validates: Requirements 1.2, 1.3, 1.4**

  - [ ] 2.5 Write property test for response specificity
    - **Property 2: Response Specificity**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [ ] 3. Checkpoint - Ensure core integration works
  - Ensure all tests pass, ask the user if questions arise.


- [x] 4. Create AI personality config and display
  - [x] 4.1 Create aiPersonalityConfig.ts
    - Create `client/src/services/aiPersonalityConfig.ts`
    - Define `AIFeatureConfig` interface
    - Implement `AI_FEATURE_CONFIGS` array with all AI features
    - Implement `getAIFeatureConfigs()` and `getAIFeatureConfig()` functions
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 4.2 Create AIPersonalityDisplay component
    - Create `client/src/components/settings/AIPersonalityDisplay.tsx`
    - Implement card-based display for each AI feature
    - Show style, core instructions, and example comparisons
    - Ensure read-only display
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 4.3 Integrate AIPersonalityDisplay into settings page
    - Modify `client/src/pages/RiskSettings.tsx` or create new settings section
    - Add "AI 调教公示" section with AIPersonalityDisplay component
    - _Requirements: 7.1_

  - [ ] 4.4 Write property test for configuration sync
    - **Property 6: Configuration Sync**
    - **Validates: Requirements 7.5**

- [x] 5. Add environment variable toggle
  - [x] 5.1 Implement challenger mode toggle
    - Add `VITE_CHALLENGER_MODE` environment variable support
    - Modify `challengerPromptBuilder.ts` to check toggle
    - Add fallback to original behavior when disabled
    - _Requirements: 8.4_

  - [ ] 5.2 Write property test for backward compatibility
    - **Property 7: Backward Compatibility**
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [ ] 6. Final checkpoint - Ensure all features work
  - Ensure all tests pass, ask the user if questions arise.
  - Manually test AI responses to verify challenger style is active
  - Verify "AI 调教公示" displays correctly in settings

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
