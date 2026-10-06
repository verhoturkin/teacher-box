/** `ADMIN` is a technical account without access to students' data (ADR-0010). */
export type Role = 'TEACHER' | 'STUDENT' | 'ADMIN';

/** The signed-in user as returned by the backend. */
export interface SessionUser {
  readonly id: string;
  readonly role: Role;
  /** The name the user sees: a student's own name, if set. */
  readonly displayName: string;
  /** Address of the student's photo; `null`: none. */
  readonly avatar: string | null;
  /** The password was generated on the first start and must be replaced (first setup). */
  readonly passwordChangeRequired: boolean;
}

/** Response of sign-in, refresh, invitation acceptance and password change. */
export interface AuthResponse {
  readonly accessToken: string;
  /** Access token lifetime in seconds. */
  readonly expiresIn: number;
  readonly user: SessionUser;
}
