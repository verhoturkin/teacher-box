/**
 * Parts of the schedule feature that other features embed: widgets, the Google Calendar and calendar feed panels, data access and its types.
 * Pages are loaded lazily through index.ts; keeping them apart keeps them out of other features' bundles.
 */
export { ScheduleApi } from './data-access/schedule-api';
export type {
  MyScheduleSummary,
  ScheduleSummary,
  ScheduledLesson,
} from './data-access/schedule.models';
export { NextLessonWidget } from './home/next-lesson-widget';
export { UpcomingLessonWidget } from './home/upcoming-lesson-widget';
export { GoogleCalendarPanel } from './teacher/google-calendar-panel';
export { CalendarFeedPanel } from './ui/calendar-feed-panel';
