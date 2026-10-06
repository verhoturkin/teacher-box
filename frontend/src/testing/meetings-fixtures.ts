import { CallParticipant, MediaRef } from '@features/meetings/call/call-engine';
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

/** A participant of a call: this user (the teacher) unless overridden. */
export function aParticipant(overrides: Partial<CallParticipant> = {}): CallParticipant {
  return {
    id: 't-1',
    name: 'Ольга',
    local: true,
    speaking: false,
    microphone: true,
    camera: null,
    screen: null,
    quality: 'excellent',
    ...overrides,
  };
}

/** A video track that records what it was attached to. */
export function aMediaRef(id = 'TR_1'): MediaRef & { readonly attached: HTMLMediaElement[] } {
  const attached: HTMLMediaElement[] = [];
  return {
    id,
    attached,
    attach: (element) => {
      attached.push(element);
    },
    detach: (element) => {
      attached.splice(attached.indexOf(element), 1);
    },
  };
}
