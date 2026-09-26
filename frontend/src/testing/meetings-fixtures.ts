import { MeetingRoom, YandexStatus } from '@features/meetings/data-access/meetings.models';

/** The room of a student, with overridable fields. */
export function aRoom(overrides: Partial<MeetingRoom> = {}): MeetingRoom {
  return {
    ownerId: 'student-1',
    ownerType: 'STUDENT',
    ownerName: 'Мария',
    joinUrl: 'https://telemost.yandex.ru/j/12345678901234',
    source: 'API',
    telemost: true,
    updatedAt: '2026-09-27T10:00:00Z',
    ...overrides,
  };
}

/** The Yandex connection, not connected unless overridden. */
export function yandexStatus(overrides: Partial<YandexStatus> = {}): YandexStatus {
  return {
    clientConfigured: false,
    clientFromEnvironment: false,
    tokenFromEnvironment: false,
    clientId: null,
    status: 'NOT_CONNECTED',
    waitingRoom: false,
    lastError: null,
    connectedAt: null,
    callbackPath: '/api/public/meetings/yandex/callback',
    ...overrides,
  };
}
