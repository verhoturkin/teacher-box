import { request } from '@playwright/test';

/**
 * The existing scenarios start on the teacher's home page, so the first setup (ADR-0014) is marked
 * as done before them; the wizard itself is covered by the version 1.3 scenario after a full reset.
 */
export default async function globalSetup(): Promise<void> {
  const api = await request.newContext({
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:8091',
  });
  const password = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
  const signedIn = await api.post('/api/auth/login', { data: { login: 'teacher', password } });
  if (!signedIn.ok()) {
    throw new Error(`The teacher cannot sign in: ${String(signedIn.status())}`);
  }
  const { accessToken } = (await signedIn.json()) as { accessToken: string };
  const setup = await api.post('/api/teacher/portal/setup', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!setup.ok()) {
    throw new Error(`The first setup cannot be completed: ${String(setup.status())}`);
  }
  await api.dispose();
}
