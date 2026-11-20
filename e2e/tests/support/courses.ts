import { type APIRequestContext, expect } from '@playwright/test';

/** The id of the teacher's course with this name (ADR-0071): an existing one or a new one. */
export async function courseId(
  request: APIRequestContext,
  headers: Record<string, string>,
  name: string,
): Promise<string> {
  const created = await request.post('/api/teacher/textbooks/courses', { headers, data: { name } });
  if (created.ok()) return ((await created.json()) as { id: string }).id;
  expect(created.status()).toBe(409);
  const courses = await request.get('/api/teacher/textbooks/courses', { headers });
  const found = ((await courses.json()) as { id: string; name: string }[]).find(
    (course) => course.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
  );
  if (found === undefined) throw new Error(`No course ${name}`);
  return found.id;
}
