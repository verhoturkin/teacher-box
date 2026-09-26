/**
 * Parts of the schedule feature that other features embed: widgets, the Google Calendar panel, data access and its types.
 * Pages are loaded lazily through index.ts; keeping them apart keeps them out of other features' bundles.
 */
export { ScheduleApi } from './data-access/schedule-api';
export type { MyScheduleSummary, ScheduleSummary } from './data-access/schedule.models';
export { NextLessonWidget } from './home/next-lesson-widget';
export { TodayLessonsWidget } from './home/today-lessons-widget';
export { GoogleCalendarPanel } from './teacher/google-calendar-panel';
