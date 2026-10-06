import { Role } from '@core/auth/auth.models';

export type AccountStatus = 'INVITED' | 'ACTIVE' | 'DEACTIVATED';
export type InvitePurpose = 'ACTIVATION' | 'PASSWORD_RESET';

/** Mirrors `StudentView` of the backend. */
export interface Student {
  readonly id: string;
  /** The name the teacher gave (the student's own name is not shown to the teacher). */
  readonly displayName: string;
  /** Address of the student's photo; `null`: none. */
  readonly avatar: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly note: string | null;
  readonly status: AccountStatus;
  readonly login: string | null;
  readonly createdAt: string;
  readonly version: number;
  readonly pendingInvite: PendingInvite | null;
}

export interface PendingInvite {
  readonly purpose: InvitePurpose;
  readonly expiresAt: string;
}

export interface IssuedInvite {
  readonly token: string;
  readonly purpose: InvitePurpose;
  readonly expiresAt: string;
}

export interface CreatedStudent {
  readonly student: Student;
  readonly invite: IssuedInvite;
}

export interface StudentProfileInput {
  readonly displayName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly note: string | null;
}

export interface InviteInfo {
  readonly purpose: InvitePurpose;
  readonly displayName: string;
  readonly login: string | null;
  readonly expiresAt: string;
}

export interface Account {
  readonly id: string;
  readonly role: Role;
  /** The name the user sees: a student's own name, if set. */
  readonly displayName: string;
  /** The name from the profile: for a student — the one the teacher gave. */
  readonly profileName: string;
  /** Address of the student's photo; `null`: none. */
  readonly avatar: string | null;
  readonly login: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  /** The password was generated on the first start and must be replaced. */
  readonly passwordChangeRequired: boolean;
}

/** Mirrors `GroupView` of the backend. */
export interface StudentGroup {
  readonly id: string;
  readonly name: string;
  readonly members: readonly GroupMember[];
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly version: number;
}

export interface GroupMember {
  readonly id: string;
  readonly displayName: string;
  readonly status: AccountStatus;
}

export interface GroupInput {
  readonly name: string;
  readonly memberIds: readonly string[];
}
