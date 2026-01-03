/**
 * EchoAI 建议组件导出
 */

export {
  StepOneSuggestionCard,
  StepTwoSuggestionCard,
  StepOneSuggestionRevertCard,
} from './SuggestionCard';

export {
  SuggestionType,
  stepOneSuggestions,
  stepTwoSuggestion,
  getStepTwoSuggestions,
  convertSuggestionTitleToIconClass,
} from './suggestionsData';

export type {
  StepOneSuggestion,
  StepTwoSuggestion,
} from './suggestionsData';

// Echo v3.2: 智能建议系统组件
export { SuggestionList } from './SuggestionList';
export { SuggestionResponseCard } from './SuggestionResponseCard';
export type { Suggestion } from './SuggestionResponseCard';
