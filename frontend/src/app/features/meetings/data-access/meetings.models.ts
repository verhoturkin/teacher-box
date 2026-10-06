/** Mirrors the views of the meetings module of the backend. */
export type RoomOwner = 'STUDENT' | 'GROUP';

/** Mirrors `RoomView`: the external call link of a student or a group. */
export interface MeetingRoom {
  readonly ownerId: string;
  readonly ownerType: RoomOwner;
  readonly ownerName: string | null;
  readonly joinUrl: string;
  /** The link opens Telemost (and so its desktop application). */
  readonly telemost: boolean;
  readonly updatedAt: string;
}

/** Mirrors `MyRoomView`: a student's own room or the room of their group. */
export interface MyRoom {
  readonly ownerType: RoomOwner;
  readonly groupName: string | null;
  readonly joinUrl: string;
  readonly telemost: boolean;
}

/** Mirrors `JoinView`: what the browser needs to join a built-in call (ADR-0030). */
export interface CallJoin {
  readonly token: string;
  readonly room: string;
  /** The student or the group for the teacher; the group or «Урок» for a student. */
  readonly title: string;
}

/** Whether the occupancy of the rooms is known. */
export type CallsStatus = 'OK' | 'UNREACHABLE' | 'OFF';

/** Mirrors `CallCard`: the built-in room of a current student or an active group. */
export interface CallCard {
  readonly ownerId: string;
  readonly ownerType: RoomOwner;
  readonly name: string;
  readonly members: number;
  /** Names of the students in the room. */
  readonly waiting: readonly string[];
  readonly teacherPresent: boolean;
  /** An external link wins over the room in lessons. */
  readonly externalLink: boolean;
  /** Address of the student's photo; `null`: the initials, or a group. */
  readonly avatar: string | null;
}

/** Mirrors `CallsView`. */
export interface CallsOverview {
  readonly status: CallsStatus;
  readonly rooms: readonly CallCard[];
}

/** Mirrors `MyCallView`: the own room of a student or the room of their group. */
export interface MyCall {
  readonly ownerId: string;
  readonly ownerType: RoomOwner;
  readonly title: string;
  readonly teacherPresent: boolean;
}

/** Whose room it is: a student or a group. */
export interface RoomOwnerRef {
  readonly type: RoomOwner;
  readonly id: string;
  readonly name: string;
}
