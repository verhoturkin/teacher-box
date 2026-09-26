import {
  BroadcastItem,
  ChannelSetup,
  ChannelState,
  LinkCode,
  NotificationItem,
  NotificationPage,
  NotificationPreferences,
  StudentMessengers,
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

export function channelSetup(overrides: Partial<ChannelSetup> = {}): ChannelSetup {
  const channel = overrides.channel ?? 'TELEGRAM';
  return {
    channel,
    configured: false,
    fromEnvironment: false,
    botName: null,
    groupId: null,
    connection: { channel, connection: 'PENDING', error: null, checkedAt: null },
    teacherLinked: false,
    ...overrides,
  };
}

export function studentMessengers(overrides: Partial<StudentMessengers> = {}): StudentMessengers {
  return {
    studentId: 's-1',
    displayName: 'Мария',
    channels: [],
    failedDeliveries: 0,
    ...overrides,
  };
}

export function broadcastItem(overrides: Partial<BroadcastItem> = {}): BroadcastItem {
  return {
    id: 'b-1',
    title: 'Каникулы',
    body: 'Занятий не будет до 10 января',
    recipients: 3,
    createdAt: '2026-09-24T10:00:00Z',
    ...overrides,
  };
}

export function preferences(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return { mutedTopics: [], quietFrom: null, quietTo: null, ...overrides };
}
