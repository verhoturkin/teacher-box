/**
 * Parts of the ai feature that other features embed: the homework draft dialog, data access and its types.
 * Pages are loaded lazily through index.ts; keeping them apart keeps them out of other features' bundles.
 */
export { AiApi } from './data-access/ai-api';
export type { HomeworkDraft, ReviewDraft } from './data-access/ai.models';
export { HomeworkDraftDialog } from './homework-draft-dialog';
