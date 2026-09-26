/**
 * Parts of the homework feature that other features embed: widgets, data access and its types.
 * Pages are loaded lazily through index.ts; keeping them apart keeps them out of other features' bundles.
 */
export { HomeworkApi } from './data-access/homework-api';
export type { HomeworkSummary, MyHomeworkSummary } from './data-access/homework.models';
export { MyDeadlinesWidget } from './home/my-deadlines-widget';
