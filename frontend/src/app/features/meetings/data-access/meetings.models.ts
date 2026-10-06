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

/** Whose room it is: a student or a group. */
export interface RoomOwnerRef {
  readonly type: RoomOwner;
  readonly id: string;
  readonly name: string;
}
