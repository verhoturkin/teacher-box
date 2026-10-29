import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { bodyText, buttonByText, hostElement, readableText } from '@testing/dom';
import {
  at,
  changeRequest,
  groupLesson,
  myScheduleSummary,
  scheduleSettings,
  scheduledLesson,
} from '@testing/schedule-fixtures';
import { aMyBoard } from '@testing/boards-fixtures';
import { MyScheduleSummary } from '../data-access/schedule.models';
import { NextLessonWidget } from './next-lesson-widget';
import { testProviders } from '@testing/setup';

describe('NextLessonWidget', () => {
  let fixture: ComponentFixture<NextLessonWidget>;
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(at(2026, 10, 1, 12)));
  });

  async function render(
    summary: MyScheduleSummary,
    boards: readonly ReturnType<typeof aMyBoard>[] = [],
  ): Promise<void> {
    TestBed.configureTestingModule({
      imports: [NextLessonWidget],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NextLessonWidget);
    fixture.componentRef.setInput('summary', summary);
    fixture.detectChanges();
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
    if (summary.next !== null) {
      backend.expectOne('/api/me/boards').flush(boards);
      fixture.detectChanges();
    }
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    vi.useRealTimers();
  });

  it('says when nothing is planned', async () => {
    await render(myScheduleSummary({ weekLessons: 0 }));

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Ближайших занятий нет');
    expect(text).toContain('Занятий на неделе: 0');
  });

  it('shows the lesson with its link and asks to move it', async () => {
    await render(
      myScheduleSummary({
        next: scheduledLesson({ title: 'Дроби', joinUrl: 'https://meet.example.com/1' }),
        weekLessons: 2,
      }),
    );
    const text = readableText(hostElement(fixture));
    expect(text).toContain('Сегодня 18:00 60 мин Занятие Дроби Занятий на неделе: 2');
    // the title is for screen readers only, as on the teacher's card
    expect(hostElement(fixture).querySelector('h2.tb-sr-only')?.textContent).toBe(
      'Ближайшее занятие',
    );
    expect(text).not.toContain('Расписание');
    expect(text).toContain('Войти в урок');
    expect(
      hostElement(fixture).querySelector('tb-join-lesson-button a')?.getAttribute('href'),
    ).toBe('https://meet.example.com/1');
    // the one large button of the portal (ADR-0045); the requests stay small
    expect(hostElement(fixture).querySelectorAll('.tb-button-m')).toHaveLength(1);
    expect(
      hostElement(fixture).querySelector('tb-join-lesson-button a.tb-button-m'),
    ).not.toBeNull();

    buttonByText(hostElement(fixture), 'Перенести').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(bodyText()).toContain('Перенести занятие');
  });

  it('shows the boards of an own lesson as chips, as on the card of the teacher', async () => {
    await render(myScheduleSummary({ next: scheduledLesson() }), [
      aMyBoard({ title: 'Алгебра' }),
      aMyBoard({
        id: 'board-2',
        kind: 'LINK',
        title: 'Холст',
        url: 'https://app.holst.so/board/1',
        groupNames: ['ОГЭ'],
      }),
    ]);

    const chips = Array.from(
      hostElement(fixture).querySelectorAll<HTMLAnchorElement>('a.tb-board-chip'),
    );
    expect(chips.map((chip) => chip.textContent.trim())).toEqual(['Алгебра', 'Холст']);
    expect(chips[0]?.getAttribute('href')).toBe('/cabinet/boards/board-1');
    expect(chips[1]?.getAttribute('href')).toBe('https://app.holst.so/board/1');
    expect(chips[1]?.getAttribute('target')).toBe('_blank');
  });

  it('shows only the boards of the group of a group lesson', async () => {
    await render(myScheduleSummary({ next: groupLesson() }), [
      aMyBoard({ title: 'Алгебра' }),
      aMyBoard({ id: 'board-2', title: 'Группа', groupNames: [groupLesson().groupName ?? ''] }),
    ]);

    expect(
      Array.from(hostElement(fixture).querySelectorAll('a.tb-board-chip'), (chip) =>
        chip.textContent.trim(),
      ),
    ).toEqual(['Группа']);
  });

  it('asks to cancel the lesson', async () => {
    await render(myScheduleSummary({ next: scheduledLesson() }));

    buttonByText(hostElement(fixture), 'Отменить').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(bodyText()).toContain('Отменить занятие');
  });

  it('shows a pending request instead of the buttons', async () => {
    const lesson = scheduledLesson({ pendingRequests: [changeRequest({ kind: 'CANCEL' })] });
    await render(myScheduleSummary({ next: lesson, pendingRequests: 1 }));

    expect(readableText(hostElement(fixture))).toContain(
      'Отмена: запрос отправлен, ждём ответа учителя',
    );
    expect(() => buttonByText(hostElement(fixture), 'Перенести')).toThrow();
    fixture.componentInstance.ask(lesson, 'RESCHEDULE');
    fixture.detectChanges();
    expect(bodyText()).not.toContain('Перенести занятие');
  });

  it('lets a group member say they will not come', async () => {
    // days ahead: not a late warning
    await render(
      myScheduleSummary({
        next: groupLesson({ startsAt: at(2026, 10, 4, 18), endsAt: at(2026, 10, 4, 19, 30) }),
      }),
    );

    expect(readableText(hostElement(fixture))).toContain('Группа «ОГЭ»');
    buttonByText(hostElement(fixture), 'Не приду').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(bodyText()).toContain('Не приду на занятие');
    expect(bodyText()).toContain('пройдёт без вас');
    expect(bodyText()).toContain('Предупредить учителя');
  });

  it('offers only the lesson link while it runs and reloads when it ends', async () => {
    await render(
      myScheduleSummary({
        next: scheduledLesson({ joinUrl: 'https://meet.example.com/1' }),
      }),
    );
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    vi.setSystemTime(new Date(at(2026, 10, 1, 18, 5)));
    vi.advanceTimersByTime(15_000);
    fixture.detectChanges();
    const text = readableText(hostElement(fixture));
    expect(text).toContain('Идёт сейчас 18:00 ещё 55 мин');
    expect(text).toContain('Войти в урок');
    expect(() => buttonByText(hostElement(fixture), 'Перенести')).toThrow();

    vi.setSystemTime(new Date(at(2026, 10, 1, 19, 1)));
    vi.advanceTimersByTime(15_000);
    fixture.detectChanges();
    expect(changed).toHaveBeenCalledTimes(1);
  });
});
