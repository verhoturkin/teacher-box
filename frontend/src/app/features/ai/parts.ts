/**
 * Parts of the ai feature that other features embed: the AI panel of the assignment editor, data access and its types.
 * Pages are loaded lazily through index.ts; keeping them apart keeps them out of other features' bundles.
 */
export { AiApi } from './data-access/ai-api';
export { HomeworkAiPanel } from './homework-ai-panel';
export type { AppliedDraft } from './homework-ai-panel';
