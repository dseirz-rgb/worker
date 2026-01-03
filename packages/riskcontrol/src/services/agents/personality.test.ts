/**
 * Property-Based Tests for Agent Personality System
 *
 * Tests the personality system using fast-check for property-based testing.
 *
 * @module agents/personality.test
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for design specification
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  AgentPersonality,
  RiskTolerance,
  DecisionStyle,
  PersonalityOverride,
  DEFAULT_PERSONALITIES,
  generatePersonalityPrompt,
  getActionPriorityMultiplier,
  getMaxPositionSize,
  getMinCashReserve,
  mergePersonality,
  validatePersonality,
  createPersonalityFromPreset,
  describePersonality,
} from './personality';

// =============================================================================
// Test Helpers and Generators
// =============================================================================

/**
 * Generate a random RiskTolerance
 */
const riskToleranceArb = fc.constantFrom('conservative', 'moderate', 'aggressive') as fc.Arbitrary<RiskTolerance>;

/**
 * Generate a random DecisionStyle
 */
const decisionStyleArb = fc.constantFrom('data-driven', 'intuitive', 'balanced') as fc.Arbitrary<DecisionStyle>;

/**
 * Generate a random AgentPersonality
 */
const personalityArb = fc.record({
  riskTolerance: riskToleranceArb,
  decisionStyle: decisionStyleArb,
  traits: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
});

/**
 * Generate a random PersonalityOverride
 */
const personalityOverrideArb = fc.record({
  riskTolerance: fc.option(riskToleranceArb, { nil: undefined }),
  decisionStyle: fc.option(decisionStyleArb, { nil: undefined }),
  traits: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
});

/**
 * Generate a random action type
 */
const actionTypeArb = fc.constantFrom('buy', 'sell', 'hold', 'reduce', 'increase') as fc.Arbitrary<'buy' | 'sell' | 'hold' | 'reduce' | 'increase'>;

// =============================================================================
// Property Tests for Personality System
// =============================================================================

describe('AgentPersonality', () => {
  describe('Property 35: Agent Personality Influence', () => {
    /**
     * Property 35: Agent Personality Influence
     * *For any* valid personality configuration, the generated prompt
     * should contain guidance consistent with the personality settings.
     *
     * **Validates: Requirements 1.2.2, 1.2.3, 1.2.4**
     */
    it('should generate prompts reflecting risk tolerance', async () => {
      await fc.assert(
        fc.asyncProperty(personalityArb, async (personality) => {
          const prompt = generatePersonalityPrompt(personality as AgentPersonality);

          // Property: Prompt should contain risk-related guidance
          expect(prompt.length).toBeGreaterThan(0);
          expect(prompt.toLowerCase()).toContain('risk');

          // Property: Prompt should reflect the specific risk tolerance
          switch (personality.riskTolerance) {
            case 'conservative':
              expect(prompt.toLowerCase()).toContain('conservative');
              expect(prompt.toLowerCase()).toContain('preservation');
              break;
            case 'moderate':
              expect(prompt.toLowerCase()).toContain('moderate');
              expect(prompt.toLowerCase()).toContain('balanced');
              break;
            case 'aggressive':
              expect(prompt.toLowerCase()).toContain('aggressive');
              expect(prompt.toLowerCase()).toContain('growth');
              break;
          }

          return true;
        }),
        { numRuns: 30 }
      );
    });

    it('should generate prompts reflecting decision style', async () => {
      await fc.assert(
        fc.asyncProperty(personalityArb, async (personality) => {
          const prompt = generatePersonalityPrompt(personality as AgentPersonality);

          // Property: Prompt should contain decision style guidance
          switch (personality.decisionStyle) {
            case 'data-driven':
              expect(prompt.toLowerCase()).toContain('data');
              expect(prompt.toLowerCase()).toContain('quantitative');
              break;
            case 'intuitive':
              expect(prompt.toLowerCase()).toContain('intuitive');
              expect(prompt.toLowerCase()).toContain('sentiment');
              break;
            case 'balanced':
              expect(prompt.toLowerCase()).toContain('balanced');
              expect(prompt.toLowerCase()).toContain('combine');
              break;
          }

          return true;
        }),
        { numRuns: 30 }
      );
    });

    it('should include custom traits in prompt when provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          riskToleranceArb,
          decisionStyleArb,
          fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 3 }),
          async (riskTolerance, decisionStyle, traits) => {
            const personality: AgentPersonality = {
              riskTolerance,
              decisionStyle,
              traits,
            };

            const prompt = generatePersonalityPrompt(personality);

            // Property: Each trait should appear in the prompt
            for (const trait of traits) {
              expect(prompt).toContain(trait);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property: Action Priority Multiplier Consistency', () => {
    /**
     * Property: Action priority multipliers should be consistent with risk tolerance.
     * Conservative should prioritize selling/reducing, aggressive should prioritize buying/increasing.
     */
    it('should return consistent multipliers for risk tolerance', async () => {
      await fc.assert(
        fc.asyncProperty(personalityArb, actionTypeArb, async (personality, actionType) => {
          const multiplier = getActionPriorityMultiplier(personality as AgentPersonality, actionType);

          // Property: Multiplier should be a positive number
          expect(multiplier).toBeGreaterThan(0);

          // Property: Conservative should have lower buy multiplier than aggressive
          if (actionType === 'buy') {
            const conservativeMultiplier = getActionPriorityMultiplier(
              { ...personality, riskTolerance: 'conservative' } as AgentPersonality,
              'buy'
            );
            const aggressiveMultiplier = getActionPriorityMultiplier(
              { ...personality, riskTolerance: 'aggressive' } as AgentPersonality,
              'buy'
            );
            expect(conservativeMultiplier).toBeLessThan(aggressiveMultiplier);
          }

          // Property: Conservative should have higher sell multiplier than aggressive
          if (actionType === 'sell') {
            const conservativeMultiplier = getActionPriorityMultiplier(
              { ...personality, riskTolerance: 'conservative' } as AgentPersonality,
              'sell'
            );
            const aggressiveMultiplier = getActionPriorityMultiplier(
              { ...personality, riskTolerance: 'aggressive' } as AgentPersonality,
              'sell'
            );
            expect(conservativeMultiplier).toBeGreaterThan(aggressiveMultiplier);
          }

          return true;
        }),
        { numRuns: 30 }
      );
    });
  });

  describe('Property: Position Size Limits', () => {
    /**
     * Property: Position size limits should be inversely related to risk aversion.
     */
    it('should return appropriate position size limits', async () => {
      await fc.assert(
        fc.asyncProperty(personalityArb, async (personality) => {
          const maxSize = getMaxPositionSize(personality as AgentPersonality);

          // Property: Max position size should be between 0 and 1
          expect(maxSize).toBeGreaterThan(0);
          expect(maxSize).toBeLessThanOrEqual(1);

          // Property: Conservative should have smaller max position than aggressive
          const conservativeMax = getMaxPositionSize({ ...personality, riskTolerance: 'conservative' } as AgentPersonality);
          const aggressiveMax = getMaxPositionSize({ ...personality, riskTolerance: 'aggressive' } as AgentPersonality);
          expect(conservativeMax).toBeLessThan(aggressiveMax);

          return true;
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Property: Cash Reserve Requirements', () => {
    /**
     * Property: Cash reserve requirements should be directly related to risk aversion.
     */
    it('should return appropriate cash reserve requirements', async () => {
      await fc.assert(
        fc.asyncProperty(personalityArb, async (personality) => {
          const minCash = getMinCashReserve(personality as AgentPersonality);

          // Property: Min cash reserve should be between 0 and 1
          expect(minCash).toBeGreaterThan(0);
          expect(minCash).toBeLessThanOrEqual(1);

          // Property: Conservative should have higher cash reserve than aggressive
          const conservativeCash = getMinCashReserve({ ...personality, riskTolerance: 'conservative' } as AgentPersonality);
          const aggressiveCash = getMinCashReserve({ ...personality, riskTolerance: 'aggressive' } as AgentPersonality);
          expect(conservativeCash).toBeGreaterThan(aggressiveCash);

          return true;
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Property: Personality Merge', () => {
    /**
     * Property: Merging personalities should correctly apply overrides.
     */
    it('should correctly merge personality with override', async () => {
      await fc.assert(
        fc.asyncProperty(personalityArb, personalityOverrideArb, async (base, override) => {
          const merged = mergePersonality(base as AgentPersonality, override as PersonalityOverride);

          // Property: Override values should take precedence
          if (override.riskTolerance !== undefined) {
            expect(merged.riskTolerance).toBe(override.riskTolerance);
          } else {
            expect(merged.riskTolerance).toBe(base.riskTolerance);
          }

          if (override.decisionStyle !== undefined) {
            expect(merged.decisionStyle).toBe(override.decisionStyle);
          } else {
            expect(merged.decisionStyle).toBe(base.decisionStyle);
          }

          if (override.traits !== undefined) {
            expect(merged.traits).toEqual(override.traits);
          } else {
            expect(merged.traits).toEqual(base.traits);
          }

          return true;
        }),
        { numRuns: 30 }
      );
    });

    it('should return base personality when override is undefined', async () => {
      await fc.assert(
        fc.asyncProperty(personalityArb, async (base) => {
          const merged = mergePersonality(base as AgentPersonality, undefined);

          expect(merged.riskTolerance).toBe(base.riskTolerance);
          expect(merged.decisionStyle).toBe(base.decisionStyle);
          expect(merged.traits).toEqual(base.traits);

          return true;
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Property: Personality Validation', () => {
    /**
     * Property: Valid personalities should pass validation.
     */
    it('should validate correct personalities', async () => {
      await fc.assert(
        fc.asyncProperty(personalityArb, async (personality) => {
          // Property: Valid personality should not throw
          expect(() => validatePersonality(personality as AgentPersonality)).not.toThrow();
          expect(validatePersonality(personality as AgentPersonality)).toBe(true);

          return true;
        }),
        { numRuns: 30 }
      );
    });

    it('should reject invalid risk tolerance', () => {
      const invalidPersonality = {
        riskTolerance: 'invalid' as RiskTolerance,
        decisionStyle: 'balanced' as DecisionStyle,
      };
      expect(() => validatePersonality(invalidPersonality)).toThrow();
    });

    it('should reject invalid decision style', () => {
      const invalidPersonality = {
        riskTolerance: 'moderate' as RiskTolerance,
        decisionStyle: 'invalid' as DecisionStyle,
      };
      expect(() => validatePersonality(invalidPersonality)).toThrow();
    });
  });
});

// =============================================================================
// Unit Tests for Utility Functions
// =============================================================================

describe('createPersonalityFromPreset', () => {
  it('should create personality from valid preset', () => {
    const presets = Object.keys(DEFAULT_PERSONALITIES) as Array<keyof typeof DEFAULT_PERSONALITIES>;
    for (const preset of presets) {
      const personality = createPersonalityFromPreset(preset);
      expect(personality.riskTolerance).toBeDefined();
      expect(personality.decisionStyle).toBeDefined();
    }
  });

  it('should throw for invalid preset', () => {
    expect(() => createPersonalityFromPreset('invalid' as keyof typeof DEFAULT_PERSONALITIES)).toThrow();
  });
});

describe('describePersonality', () => {
  it('should return non-empty description', () => {
    const personality: AgentPersonality = {
      riskTolerance: 'moderate',
      decisionStyle: 'balanced',
    };
    const description = describePersonality(personality);
    expect(description.length).toBeGreaterThan(0);
  });

  it('should include traits in description when provided', () => {
    const personality: AgentPersonality = {
      riskTolerance: 'conservative',
      decisionStyle: 'data-driven',
      traits: ['cautious', 'analytical'],
    };
    const description = describePersonality(personality);
    expect(description).toContain('cautious');
    expect(description).toContain('analytical');
  });
});

describe('DEFAULT_PERSONALITIES', () => {
  it('should have valid presets', () => {
    for (const [name, personality] of Object.entries(DEFAULT_PERSONALITIES)) {
      expect(() => validatePersonality(personality)).not.toThrow();
    }
  });
});
