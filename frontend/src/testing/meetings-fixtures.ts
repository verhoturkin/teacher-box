import { MeetingRoom } from '@features/meetings/data-access/meetings.models';

/** The room of a student, with overridable fields. */
export function aRoom(overrides: Partial<MeetingRoom> = {}): MeetingRoom {
  return {
    ownerId: 'student-1',
    ownerType: 'STUDENT',
    ownerName: 'Мария',
    joinUrl: 'https://telemost.yandex.ru/j/12345678901234',
    telemost: true,
    updatedAt: '2026-09-27T10:00:00Z',
    ...overrides,
  };
}
