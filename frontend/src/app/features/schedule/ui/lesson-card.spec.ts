import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { at, changeRequest, groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { aBoard } from '@testing/boards-fixtures';
import { ChangeRequest, ScheduledLesson } from '../data-access/schedule.models';
import { LessonCard, OutcomeChange } from './lesson-card';

const BEFORE = new Date(2026, 8, 30, 12);
const AFTER = new Date(2026, 9, 1, 19);

/** The option of the «Итог» toggle with this text. */
function toggle(root: ParentNode, text: string): HTMLElement {
  const option = Array.from(root.querySelectorAll<HTMLElement>('p-togglebutton')).find(
    (candidate) => candidate.textContent.includes(text),
  );
  if (option === undefined) {
    throw new Error(`Toggle "${text}" not found`);
  }
  return option;
}

describe('LessonCard', () => {
  let fixture: ComponentFixture<LessonCard>;
  let backend: HttpTestingController;
  let changes: OutcomeChange[];
  let answered: ChangeRequest[];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LessonCard], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LessonCard);
    changes = [];
    answered = [];
    fixture.componentInstance.outcomeChange.subscribe((change) => changes.push(change));
    fixture.componentInstance.answer.subscribe((request) => answered.push(request));
  });

  afterEach(() => {
    backend.verify();
  });

  async function show(
    lesson: ScheduledLesson,
    options: { role?: 'teacher' | 'student'; now?: Date } = {},
  ): Promise<HTMLElement> {
    fixture.componentRef.setInput('lesson', lesson);
    fixture.componentRef.setInput('role', options.role ?? 'teacher');
    fixture.componentRef.setInput('now', options.now ?? BEFORE);
    await fixture.whenStable();
    for (const request of backend.match((request) => request.url === '/api/teacher/boards')) {
      request.flush([]);
    }
    await fixture.whenStable();
    return hostElement(fixture);
  }

  function pressed(root: HTMLElement): string[] {
    return Array.from(root.querySelectorAll('.p-togglebutton-checked')).map((button) =>
      button.textContent.trim(),
    );
  }

  it('lists the time, the topic, the room and the boards of a lesson to come', async () => {
    const root = await show(
      scheduledLesson({
        topic: 'Дроби',
        joinUrl: 'https://zoom.us/j/1',
        originalStartsAt: at(2026, 9, 30, 17),
      }),
    );

    const text = root.textContent;
    expect(text).toContain('Дроби');
    expect(text).toContain('Начать урок');
    expect(text).toContain('Перенесено с');
    expect(text).not.toContain('Запланировано');
    expect(root.querySelector('.tb-list--no-phone-lead')).not.toBeNull();
    expect(root.querySelector('p-selectbutton')).toBeNull();
  });

  it('shows the boards of the student as chips', async () => {
    fixture.componentRef.setInput('lesson', scheduledLesson());
    await fixture.whenStable();
    backend
      .expectOne('/api/teacher/boards?studentId=s-1')
      .flush([aBoard({ title: 'Доска ученика' })]);
    await fixture.whenStable();

    expect(hostElement(fixture).textContent).toContain('Доска ученика');
  });

  it('gives a past lesson with one student the toggle «Итог», nothing chosen until marked', async () => {
    const root = await show(scheduledLesson(), { now: AFTER });

    expect(root.textContent).toContain('Итог');
    expect(root.textContent).toContain('Проведено');
    expect(root.textContent).toContain('Пропуск');
    expect(pressed(root)).toEqual([]);
  });

  it('saves the picked outcome at once and keeps it chosen', async () => {
    const root = await show(scheduledLesson(), { now: AFTER });

    toggle(root, 'Проведено').click();
    await fixture.whenStable();

    expect(changes.map((change) => change.outcome)).toEqual(['CONDUCTED']);
    expect(pressed(root)).toEqual(['Проведено']);
  });

  it('unmarks by pressing the chosen outcome again', async () => {
    const root = await show(scheduledLesson({ status: 'MISSED' }), { now: AFTER });
    expect(pressed(root)).toEqual(['Пропуск']);

    toggle(root, 'Пропуск').click();
    await fixture.whenStable();

    expect(changes.map((change) => change.outcome)).toEqual([null]);
  });

  it('puts the toggle back when saving failed', async () => {
    const root = await show(scheduledLesson({ status: 'MISSED' }), { now: AFTER });

    toggle(root, 'Проведено').click();
    await fixture.whenStable();
    expect(pressed(root)).toEqual(['Проведено']);
    changes[0]?.revert();
    await fixture.whenStable();

    expect(pressed(root)).toEqual(['Пропуск']);
  });

  it('blocks the toggle while the outcome is being saved', async () => {
    fixture.componentRef.setInput('busy', true);
    const root = await show(scheduledLesson(), { now: AFTER });

    expect(toggle(root, 'Проведено').getAttribute('data-p-disabled')).toBe('true');
  });

  it('shows a cancelled lesson with its status and reason, without «Итог»', async () => {
    const root = await show(scheduledLesson({ status: 'CANCELLED', cancelReason: 'Болезнь' }), {
      now: AFTER,
    });

    expect(root.textContent).toContain('Отменено');
    expect(root.textContent).toContain('Причина отмены: Болезнь');
    expect(root.textContent).not.toContain('Итог');
  });

  it('shows the participants of a group lesson and no «Итог»', async () => {
    const root = await show(groupLesson(), { now: AFTER });

    expect(root.textContent).toContain('Участники');
    expect(root.textContent).toContain('Иван Петров');
    expect(root.textContent).toContain('Предупредил');
    expect(root.textContent).not.toContain('Итог');
  });

  it('puts a request on a tertiary row and hands the answer to the host', async () => {
    const request = changeRequest({ comment: 'Можно позже?' });
    const root = await show(scheduledLesson({ pendingRequests: [request] }));

    expect(root.textContent).toContain('Запрос ученика: Перенос');
    expect(root.textContent).toContain('«Можно позже?»');
    expect(root.querySelector('.tb-lesson-card__request')).not.toBeNull();
    buttonByText(root, 'Ответить').click();
    expect(answered).toEqual([request]);
  });

  it('names the student of a request in a group', async () => {
    const root = await show(
      groupLesson({
        pendingRequests: [changeRequest({ kind: 'CANCEL', groupId: 'g-1', studentName: 'Мария' })],
      }),
    );

    expect(root.textContent).toContain('Мария: Не придёт');
  });

  describe('for the student', () => {
    it('shows the facts, the own pending request and no teacher’s controls', async () => {
      const root = await show(
        scheduledLesson({
          topic: 'Дроби',
          joinUrl: 'https://zoom.us/j/1',
          pendingRequests: [changeRequest()],
        }),
        { role: 'student', now: AFTER },
      );

      const text = root.textContent;
      expect(text).toContain('Дроби');
      expect(text).toContain('Войти в урок');
      expect(text).toContain('Запрос «Перенос» ждёт ответа учителя');
      expect(text).not.toContain('Итог');
      expect(text).not.toContain('Ответить');
      expect(root.querySelector('tb-board-links')).toBeNull();
    });

    it('does not list the participants of a group', async () => {
      const root = await show(groupLesson(), { role: 'student' });

      expect(root.textContent).not.toContain('Участники');
      expect(root.textContent).toContain('Вы предупредили, что не придёте');
    });
  });
});
