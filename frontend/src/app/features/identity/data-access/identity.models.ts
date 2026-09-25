import { Role } from '@core/auth/auth.models';

export type AccountStatus = 'INVITED' | 'ACTIVE' | 'DEACTIVATED';
export type InvitePurpose = 'ACTIVATION' | 'PASSWORD_RESET';

/** Mirrors `StudentView` of the backend. */
export interface Student {
  readonly id: string;
  readonly displayName: string;
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
  readonly displayName: string;
  readonly login: string | null;
  readonly email: string | null;
  readonly phone: string | null;
}
