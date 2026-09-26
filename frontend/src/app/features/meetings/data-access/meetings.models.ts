/** Mirrors the views of the meetings module of the backend. */
export type YandexConnectionStatus = 'NOT_CONNECTED' | 'CONNECTED' | 'NEEDS_RECONNECT';
export type RoomOwner = 'STUDENT' | 'GROUP';
export type RoomSource = 'API' | 'MANUAL';

/** Mirrors `YandexStatusView`. */
export interface YandexStatus {
  readonly clientConfigured: boolean;
  /** The OAuth client is set by environment variables and cannot be changed in the UI. */
  readonly clientFromEnvironment: boolean;
  /** A ready token comes from `TEACHERBOX_MEETINGS_TELEMOST_TOKEN`. */
  readonly tokenFromEnvironment: boolean;
  readonly clientId: string | null;
  readonly status: YandexConnectionStatus;
  /** Students wait until the teacher lets them in. */
  readonly waitingRoom: boolean;
  readonly lastError: string | null;
  readonly connectedAt: string | null;
  /** Path of the redirect address to register in Yandex ID. */
  readonly callbackPath: string;
}

/** Mirrors `RoomView`: the permanent room of a student or a group. */
export interface MeetingRoom {
  readonly ownerId: string;
  readonly ownerType: RoomOwner;
  readonly ownerName: string | null;
  readonly joinUrl: string;
  readonly source: RoomSource;
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
