import {
  ChannelType,
  MessengerConnection,
  NotificationTopic,
} from './data-access/notifications.models';
import { T } from './i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

export const CHANNEL_NAMES: Record<ChannelType, string> = SHARED_T.messengers;

export const CHANNEL_ICONS: Record<ChannelType, string> = {
  TELEGRAM: 'tb-i tb-i-send',
  VK: 'tb-i tb-i-forum',
  MAX: 'tb-i tb-i-chat',
};

/** Whether the bot link already carries the code (otherwise the user sends the code manually). */
export const CHANNEL_HAS_START_LINK: Record<ChannelType, boolean> = {
  TELEGRAM: true,
  VK: false,
  MAX: true,
};

/** Topics a user can mute in messengers, in display order (`MESSAGES` from the teacher is always sent). */
export const MUTABLE_TOPICS: readonly {
  readonly topic: NotificationTopic;
  readonly label: string;
  readonly hint: string;
  readonly teacherOnly: boolean;
  /** Sent to students only (the teacher writes the summary, never receives it). */
  readonly studentOnly?: boolean;
}[] = [
  {
    topic: 'SCHEDULE',
    label: T.topics.SCHEDULE,
    hint: T.topics.SCHEDULE_HINT,
    teacherOnly: false,
  },
  {
    topic: 'REMINDERS',
    label: T.topics.REMINDERS,
    hint: T.topics.REMINDERS_HINT,
    teacherOnly: false,
  },
  {
    topic: 'HOMEWORK',
    label: T.topics.HOMEWORK,
    hint: T.topics.HOMEWORK_HINT,
    teacherOnly: false,
  },
  { topic: 'BILLING', label: T.topics.BILLING, hint: T.topics.BILLING_HINT, teacherOnly: false },
  {
    topic: 'LESSON_SUMMARY',
    label: T.topics.LESSON_SUMMARY,
    hint: T.topics.LESSON_SUMMARY_HINT,
    teacherOnly: false,
    studentOnly: true,
  },
  {
    topic: 'ACCOUNT',
    label: T.topics.ACCOUNT,
    hint: T.topics.ACCOUNT_HINT,
    teacherOnly: true,
  },
];

export const CONNECTION_TAGS: Record<
  MessengerConnection,
  { readonly value: string; readonly severity: 'success' | 'info' | 'danger' }
> = {
  OK: { value: T.connections.OK, severity: 'success' },
  PENDING: { value: T.connections.PENDING, severity: 'info' },
  ERROR: { value: T.connections.ERROR, severity: 'danger' },
};
