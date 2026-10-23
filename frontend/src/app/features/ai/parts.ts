/**
 * Parts of the ai feature that other features embed: the AI panel of the assignment editor, the settings
 * category «ИИ-помощник», data access and its types. The feature has no pages of its own.
 */
export { AiApi } from './data-access/ai-api';
export { AiSettingsPanel } from './ai-settings-panel';
export { HomeworkAiPanel, HomeworkAiState } from './homework-ai-panel';
export type { AppliedDraft } from './homework-ai-panel';
export type { SourceOption } from './data-access/ai.models';
