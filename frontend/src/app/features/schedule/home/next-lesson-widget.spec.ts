import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { bodyText, buttonByText, hostElement, readableText } from '@testing/dom';
import {
  changeRequest,
  groupLesson,
  myScheduleSummary,
  scheduleSettings,
  scheduledLesson,
} from '@testing/schedule-fixtures';
import { MyScheduleSummary } from '../data-access/schedule.models';
import { NextLessonWidget } from './next-lesson-widget';
import { testProviders } from '@testing/setup';

describe('NextLessonWidget', () => {
  let fixture: ComponentFixture<NextLessonWidget>;
  let backend: HttpTestingController;

  async function render(summary: MyScheduleSummary): Promise<void> {
    TestBed.configureTestingModule({
      imports: [NextLessonWidget],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NextLessonWidget);
    fixture.componentRef.setInput('summary', summary);
    fixture.detectChanges();
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
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
        next: scheduledLesson({ topic: 'Дроби', joinUrl: 'https://meet.example.com/1' }),
        weekLessons: 2,
      }),
    );
    const text = readableText(hostElement(fixture));
    expect(text).toContain('18:00–19:00 Дроби');
    expect(text).toContain('Войти в урок');
    expect(
      hostElement(fixture).querySelector('tb-join-lesson-button a')?.getAttribute('href'),
    ).toBe('https://meet.example.com/1');

    buttonByText(hostElement(fixture), 'Перенести').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(bodyText()).toContain('Перенести занятие');
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
    // days ahead: not a late warning, whatever today is
    const start = new Date(Date.now() + 3 * 86_400_000);
    const end = new Date(start.getTime() + 90 * 60_000);
    await render(
      myScheduleSummary({
        next: groupLesson({ startsAt: start.toISOString(), endsAt: end.toISOString() }),
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
});
