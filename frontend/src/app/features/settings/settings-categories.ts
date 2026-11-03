import type { AiStatus } from '@features/ai/parts';
import { locale } from '@core/i18n/language';
import { toIsoDate } from '@shared/dates/iso-date';
import { SHARED_T } from '@shared/i18n/texts';
import { BackupInfo, MessengerStatus, NotificationsStatus } from './data-access/settings.models';
import { T } from './i18n/texts';

/**
 * The categories of the settings in the order of the list (sketch `Changes`: 8 → 6 → 7); the address is
 * `/teacher/settings/<category>`.
 */
export const CATEGORIES = [
  'account',
  'portal',
  'lessons',
  'students',
  'messengers',
  'ai',
  'data',
] as const;
export type SettingsCategory = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is SettingsCategory {
  return CATEGORIES.some((category) => category === value);
}

/** The categories before 357.1 merged into «Занятия»: their old addresses lead there. */
const MERGED: Readonly<Record<string, SettingsCategory>> = {
  calendar: 'lessons',
  calls: 'lessons',
  payments: 'lessons',
};

/** The category an old address names now, or none. */
export function mergedCategory(value: string): SettingsCategory | null {
  return MERGED[value] ?? null;
}

/** An item of the list: its icon, name and what it holds (until its state loads). */
export interface CategoryItem {
  readonly id: SettingsCategory;
  readonly icon: string;
  readonly title: string;
  readonly summary: string;
}

const t = T.page;
const TIME = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' });
const DAY = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long' });

/** The first category: the detail of `/teacher/settings` beside the list. */
export const FIRST_CATEGORY: CategoryItem = {
  id: 'account',
  icon: 'tb-i-badge',
  title: t.account,
  summary: t.accountSummary,
};

export const CATEGORY_ITEMS: readonly CategoryItem[] = [
  FIRST_CATEGORY,
  { id: 'portal', icon: 'tb-i-palette', title: t.portal, summary: t.portalSummary },
  { id: 'lessons', icon: 'tb-i-event', title: t.lessons, summary: t.lessonsSummary },
  { id: 'students', icon: 'tb-i-sell', title: t.students, summary: t.studentsSummary },
  { id: 'messengers', icon: 'tb-i-forum', title: t.messengers, summary: t.messengersSummary },
  { id: 'ai', icon: 'tb-i-auto_awesome', title: t.ai, summary: t.aiSummary },
  { id: 'data', icon: 'tb-i-database', title: t.data, summary: t.dataSummary },
];

/** The fold cards of the old page (`?open=portal,data`) → their category. */
const FOLDS: Readonly<Record<string, SettingsCategory>> = {
  portal: 'portal',
  calendar: 'lessons',
  meetings: 'lessons',
  deliveries: 'messengers',
  ai: 'ai',
  data: 'data',
};

/** The category an old address of the settings opened: its first known fold card, or none. */
export function categoryOfFolds(open: string): SettingsCategory | null {
  for (const fold of open.split(',')) {
    const category = FOLDS[fold];
    if (category !== undefined) {
      return category;
    }
  }
  return null;
}

/** The state of «Мессенджеры» under its name: a failing bot first, then the working ones. */
export function messengersState(status: NotificationsStatus): string {
  const name = (channel: MessengerStatus): string => SHARED_T.messengers[channel.channel];
  const failing = status.channels.find((channel) => channel.connection === 'ERROR');
  if (failing !== undefined) {
    return t.messengerFails(name(failing));
  }
  const working = status.channels.filter((channel) => channel.connection === 'OK').map(name);
  if (working.length > 0) {
    return t.messengersWork(working.join(', '), working.length);
  }
  return status.channels.length > 0 ? t.messengersChecking : t.noMessengers;
}

/** The state of «ИИ-помощник»: connected and the share of the monthly limit used. */
export function aiState(status: AiStatus): string {
  if (!status.enabled) {
    return t.aiOff;
  }
  if (status.limitReached) {
    return t.aiLimit;
  }
  return status.monthlyTokenLimit > 0
    ? t.aiUsed(Math.round((status.usedThisMonth * 100) / status.monthlyTokenLimit))
    : t.aiOn;
}

/** The state of «Данные»: when the newest backup was made (the device's time, as the backups list). */
export function dataState(backups: readonly BackupInfo[], now = new Date()): string {
  const newest = backups
    .map((backup) => new Date(backup.createdAt))
    .reduce<Date | null>(
      (latest, date) => (latest === null || date > latest ? date : latest),
      null,
    );
  if (newest === null) {
    return t.noBackups;
  }
  const time = TIME.format(newest);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  switch (toIsoDate(newest)) {
    case toIsoDate(now):
      return t.backupToday(time);
    case toIsoDate(yesterday):
      return t.backupYesterday(time);
    default:
      return t.backupOn(DAY.format(newest));
  }
}
