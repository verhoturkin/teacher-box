import { AuthResponse, Role } from '@core/auth/auth.models';

export const TEACHER_ID = '018f0000-0000-7000-8000-000000000001';
export const STUDENT_ID = '018f0000-0000-7000-8000-000000000002';

/** A backend session response for tests. */
export function authResponse(role: Role, expiresIn = 900, accessToken = `token-${role}`): AuthResponse {
  return {
    accessToken,
    expiresIn,
    user: {
      id: role === 'TEACHER' ? TEACHER_ID : STUDENT_ID,
      role,
      displayName: role === 'TEACHER' ? 'Анна Сергеевна' : 'Иван Петров',
    },
  };
}
