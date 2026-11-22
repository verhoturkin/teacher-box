import { type APIRequestContext, expect, test } from '@playwright/test';
import { courseId } from '../support/courses';
import { bearer, startSession } from '../support/session';

/**
 * Courses, lesson plans and the bank (roadmap 11, ADR-0071): a course on the student, a plan on a
 * lesson that the student reads, homework given at the lesson, both originals in the bank, and
 * «Использовать» makes copies while the bank stays as it is. An automatic YouTube transcript is
 * not here: YouTube is outside the test instance.
 */

const PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const STUDENT_PASSWORD = 'Plans-0600-student-pass';
const DAY_MS = 86_400_000;

interface Plan {
  id: string;
  title: string;
  body: string;
  courseId: string | null;
  bank: boolean;
  sourceId: string | null;
  uses: number;
}

interface Assignment {
  id: string;
  title: string;
  courseId: string | null;
  bank: boolean;
  sourceId: string | null;
  uses: number;
  draftStudentIds: string[];
}

interface Lesson {
  id: string;
  planId: string | null;
  assignmentIds: string[];
}

async function json<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(response.ok(), `${response.url()} → ${String(response.status())}`).toBe(true);
  return (await response.json()) as T;
}

/** A student who accepted the invitation, with their login. */
async function student(
  request: APIRequestContext,
  headers: Record<string, string>,
  name: string,
): Promise<{ id: string; login: string }> {
  const created = await json<{ student: { id: string }; invite: { token: string } }>(
    await request.post('/api/teacher/students', { headers, data: { displayName: name } }),
  );
  const login = `plans0600${String(Date.now())}`;
  const accepted = await request.post(`/api/auth/invites/${created.invite.token}/accept`, {
    data: { login, password: STUDENT_PASSWORD },
  });
  expect(accepted.ok()).toBe(true);
  return { id: created.student.id, login };
}

async function lesson(
  request: APIRequestContext,
  headers: Record<string, string>,
  studentId: string,
  days: number,
  title: string,
): Promise<Lesson> {
  return json<Lesson>(
    await request.post('/api/teacher/schedule/lessons', {
      headers,
      data: {
        studentId,
        startsAt: new Date(Date.now() + days * DAY_MS).toISOString(),
        durationMinutes: 60,
        repeatWeeks: 0,
        allowOverlap: true,
        title,
      },
    }),
  );
}

test('a course plan on a lesson, homework at it, and the bank that «Использовать» keeps', async ({
  page,
  request,
}) => {
  const stamp = String(Date.now());
  const teacher = await bearer(request);
  const course = await courseId(request, teacher, 'Английский A2');
  const anna = await student(request, teacher, `Анна План ${stamp}`);
  const linked = await request.put(`/api/teacher/textbooks/students/${anna.id}/course`, {
    headers: teacher,
    data: { courseId: course },
  });
  expect(linked.ok()).toBe(true);
  const first = await lesson(request, teacher, anna.id, 2, `Урок с планом ${stamp}`);
  const second = await lesson(request, teacher, anna.id, 9, `Следующий урок ${stamp}`);

  // A working plan of the course on the first lesson; «Готово» saves its original in the bank.
  const title = `План Present Simple ${stamp}`;
  const draft = await json<Plan>(
    await request.post('/api/teacher/textbooks/plans', {
      headers: teacher,
      data: { title, body: 'Разминка и **правило**', courseId: course },
    }),
  );
  expect(draft.bank).toBe(false);
  expect(draft.sourceId).toBeNull();
  const planned = await json<Lesson>(
    await request.put(`/api/teacher/schedule/lessons/${first.id}/plan`, {
      headers: teacher,
      data: { planId: draft.id },
    }),
  );
  expect(planned.planId).toBe(draft.id);
  const finished = await json<Plan>(
    await request.post(`/api/teacher/textbooks/plans/${draft.id}/finish`, { headers: teacher }),
  );
  const planOriginalId = finished.sourceId;
  expect(planOriginalId).not.toBeNull();

  // The student reads the plan of their lesson.
  const studentHeaders = await bearer(request, anna.login, STUDENT_PASSWORD);
  const seen = await json<{ id: string; title: string; body: string }>(
    await request.get(`/api/me/schedule/lessons/${first.id}/plan`, { headers: studentHeaders }),
  );
  expect(seen).toMatchObject({ id: draft.id, title, body: 'Разминка и **правило**' });

  // Homework from the lesson: given to the lesson's student and linked to it; the first «Выдать»
  // saves the bank original.
  const homeworkTitle = `Задание Present Simple ${stamp}`;
  const given = await json<Assignment>(
    await request.post('/api/teacher/homework/assignments', {
      headers: teacher,
      data: {
        title: homeworkTitle,
        description: 'Упражнения 1–3',
        dueAt: new Date(Date.now() + 9 * DAY_MS).toISOString(),
        courseId: course,
        studentIds: [anna.id],
      },
    }),
  );
  expect(given.courseId).toBe(course);
  const withHomework = await json<Lesson>(
    await request.post(`/api/teacher/schedule/lessons/${first.id}/homework`, {
      headers: teacher,
      data: { assignmentId: given.id },
    }),
  );
  expect(withHomework.assignmentIds).toEqual([given.id]);
  const homeworkOriginalId = (
    await json<Assignment>(
      await request.get(`/api/teacher/homework/assignments/${given.id}`, { headers: teacher }),
    )
  ).sourceId;
  expect(homeworkOriginalId).not.toBeNull();

  // Both originals are in the bank.
  const planBank = async () =>
    json<Plan[]>(await request.get('/api/teacher/textbooks/plans?bank=true', { headers: teacher }));
  const homeworkBank = async () =>
    json<Assignment[]>(
      await request.get('/api/teacher/homework/assignments?bank=true', { headers: teacher }),
    );
  const plansBefore = await planBank();
  const homeworkBefore = await homeworkBank();
  const planOriginal = plansBefore.find((plan) => plan.id === planOriginalId);
  const homeworkOriginal = homeworkBefore.find((item) => item.id === homeworkOriginalId);
  expect(planOriginal).toMatchObject({ title, bank: true, courseId: course });
  expect(homeworkOriginal).toMatchObject({ title: homeworkTitle, bank: true, courseId: course });

  // «Использовать» makes working copies for the next lesson; the bank keeps the same items.
  const used = await json<{ lessonId: string; plan: Plan }>(
    await request.post(`/api/teacher/textbooks/plans/${String(planOriginalId)}/use`, {
      headers: teacher,
      data: { lessonId: second.id },
    }),
  );
  expect(used.plan).toMatchObject({ title, bank: false, sourceId: planOriginalId });
  expect(used.plan.id).not.toBe(planOriginalId);
  const secondPlanned = await json<Lesson>(
    await request.put(`/api/teacher/schedule/lessons/${second.id}/plan`, {
      headers: teacher,
      data: { planId: used.plan.id },
    }),
  );
  expect(secondPlanned.planId).toBe(used.plan.id);
  const copy = await json<Assignment>(
    await request.post(`/api/teacher/homework/assignments/${String(homeworkOriginalId)}/use`, {
      headers: teacher,
      data: { studentIds: [anna.id] },
    }),
  );
  expect(copy).toMatchObject({ title: homeworkTitle, bank: false, sourceId: homeworkOriginalId });
  expect(copy.draftStudentIds).toEqual([anna.id]);

  const plansAfter = await planBank();
  const homeworkAfter = await homeworkBank();
  expect(plansAfter.map((plan) => plan.id).sort()).toEqual(
    plansBefore.map((plan) => plan.id).sort(),
  );
  expect(homeworkAfter.map((item) => item.id).sort()).toEqual(
    homeworkBefore.map((item) => item.id).sort(),
  );
  const planAfter = plansAfter.find((plan) => plan.id === planOriginalId);
  const homeworkAfterOriginal = homeworkAfter.find((item) => item.id === homeworkOriginalId);
  expect(planAfter).toMatchObject({ title, uses: (planOriginal?.uses ?? 0) + 1 });
  expect(homeworkAfterOriginal).toMatchObject({
    title: homeworkTitle,
    uses: (homeworkOriginal?.uses ?? 0) + 1,
  });

  // The teacher sees both originals in the banks of «Материалы».
  await page.setViewportSize({ width: 1440, height: 900 });
  await startSession(page, 'teacher', PASSWORD);
  await page.goto('/teacher/materials?tab=plans');
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await page.goto('/teacher/materials?tab=assignments');
  await expect(page.getByText(homeworkTitle, { exact: true }).first()).toBeVisible();
});
