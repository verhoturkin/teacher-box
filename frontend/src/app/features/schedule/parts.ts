/**
 * Parts of the schedule feature that other features embed: widgets, the Google Calendar and calendar feed panels, data access and its types.
 * Pages are loaded lazily through index.ts; keeping them apart keeps them out of other features' bundles.
 */
export { ScheduleApi } from './data-access/schedule-api';
export { STATUS_LABELS, formatLessonStart, lessonWith, requestKindLabel } from './schedule-labels';
export type {
  ChangeRequest,
  MyScheduleSummary,
  ScheduleSummary,
  ScheduledLesson,
} from './data-access/schedule.models';
export { NextLessonWidget } from './home/next-lesson-widget';
export { UpcomingLessonWidget } from './home/upcoming-lesson-widget';
export { LessonDialog } from './teacher/lesson-dialog';
export { AttendanceDialog } from './teacher/attendance-dialog';
export { StudentLessonsCard } from './teacher/student-lessons-card';
export { StudentLessonsTab } from './teacher/student-lessons-tab';
export { GoogleCalendarPanel } from './teacher/google-calendar-panel';
export { CalendarFeedPanel } from './ui/calendar-feed-panel';
