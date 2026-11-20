import { AuthResponse, Role } from '@core/auth/auth.models';

export const TEACHER_ID = '018f0000-0000-7000-8000-000000000001';
export const STUDENT_ID = '018f0000-0000-7000-8000-000000000002';
export const ADMIN_ID = '018f0000-0000-7000-8000-000000000003';
const GUARDIAN_ID = '018f0000-0000-7000-8000-000000000004';

const USERS: Record<Role, { readonly id: string; readonly displayName: string }> = {
  TEACHER: { id: TEACHER_ID, displayName: 'Анна Сергеевна' },
  STUDENT: { id: STUDENT_ID, displayName: 'Иван Петров' },
  GUARDIAN: { id: GUARDIAN_ID, displayName: 'Ольга Петрова' },
  ADMIN: { id: ADMIN_ID, displayName: 'Администратор' },
};

/** A backend session response for tests. */
export function authResponse(
  role: Role,
  expiresIn = 900,
  accessToken = `token-${role}`,
): AuthResponse {
  return {
    accessToken,
    expiresIn,
    user: {
      id: USERS[role].id,
      role,
      displayName: USERS[role].displayName,
      avatar: null,
      passwordChangeRequired: false,
      language: 'ru',
    },
  };
}
