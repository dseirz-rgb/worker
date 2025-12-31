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
