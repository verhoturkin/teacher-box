import {
  ChannelState,
  LinkCode,
  NotificationItem,
  NotificationPage,
} from '@features/notifications/data-access/notifications.models';

export function notification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n-1',
    kind: 'HOMEWORK_ASSIGNED',
    title: 'Новое задание: «Дроби»',
    body: 'Срок сдачи: 25.09.2026 18:30',
    link: '/cabinet/homework/t-1',
    createdAt: '2026-09-24T10:00:00Z',
    read: false,
    ...overrides,
  };
}

export function notificationPage(items: NotificationItem[], total = items.length): NotificationPage {
  return { items, total, unread: items.filter((item) => !item.read).length };
}

export function channel(overrides: Partial<ChannelState> = {}): ChannelState {
  return {
    channel: 'TELEGRAM',
    linked: false,
    displayName: null,
    enabled: false,
    linkedAt: null,
    ...overrides,
  };
}

export function linkCode(overrides: Partial<LinkCode> = {}): LinkCode {
  return {
    channel: 'TELEGRAM',
    code: 'ABCD-2345',
    expiresAt: '2026-09-24T10:15:00Z',
    url: 'https://t.me/teacher_bot?start=ABCD2345',
    ...overrides,
  };
}
