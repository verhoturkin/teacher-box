/** Mirrors the views of the boards module of the backend. */
export type BoardOwner = 'STUDENT' | 'GROUP';

/** Mirrors `BoardView`: a board of a student or a group. */
export interface Board {
  readonly id: string;
  readonly ownerType: BoardOwner;
  readonly ownerId: string;
  readonly ownerName: string | null;
  readonly title: string;
  readonly url: string;
  /** The link opens a Holst board. */
  readonly holst: boolean;
  readonly version: number;
}

/** Mirrors `MyBoardView`: a board of the student or of their group. */
export interface MyBoard {
  readonly id: string;
  readonly ownerType: BoardOwner;
  readonly groupName: string | null;
  readonly title: string;
  readonly url: string;
  readonly holst: boolean;
}

/** Whose boards: a student or a group. */
export interface BoardOwnerRef {
  readonly type: BoardOwner;
  readonly id: string;
  readonly name: string;
}
