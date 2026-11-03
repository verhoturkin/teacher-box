import { Role } from '@core/auth/auth.models';
import { LabelColor } from '@core/theme/label-colors';

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
  /** Topic of a new lesson with the student unless the teacher types another. */
  readonly defaultTopic: string | null;
  /** The colour in the teacher's lists; `null`: none. */
  readonly color: LabelColor | null;
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
  readonly defaultTopic: string | null;
  /** The colour in the teacher's lists; `null`: none. */
  readonly color: LabelColor | null;
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
  /** The language of the interface kept in the account (ADR-0036). */
  readonly language: string;
}

/** Mirrors `GroupView` of the backend. */
export interface StudentGroup {
  readonly id: string;
  readonly name: string;
  readonly members: readonly GroupMember[];
  /** Topic of a new lesson with the group unless the teacher types another. */
  readonly defaultTopic: string | null;
  /** The colour in the teacher's lists; `null`: none. */
  readonly color: LabelColor | null;
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
  readonly defaultTopic: string | null;
  /** The colour in the teacher's lists; `null`: none. */
  readonly color: LabelColor | null;
}

/** Mirrors `Tag` of the backend (ADR-0055): a teacher's student tag with its ordered values. */
export interface StudentTag {
  readonly id: string;
  readonly name: string;
  /** The tag shapes the AI drafts for the student. */
  readonly useInAi: boolean;
  readonly values: readonly TagValue[];
  readonly version: number;
}

export interface TagValue {
  readonly id: string;
  readonly label: string;
}

/** A value on save: a kept one has its `id`, a new one only the label. */
export interface TagValueInput {
  readonly id?: string;
  readonly label: string;
}

/** Answer of a tag change: how many students lost a removed value. */
export interface TagChanged {
  readonly tag: StudentTag;
  readonly clearedStudents: number;
}
