import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText, hostElement, readableText } from '@testing/dom';
import { changeRequest, myScheduleSummary, scheduleSettings, scheduledLesson } from '@testing/schedule-fixtures';
import { MyScheduleSummary } from '../data-access/schedule.models';
import { NextLessonWidget } from './next-lesson-widget';

describe('NextLessonWidget', () => {
  let fixture: ComponentFixture<NextLessonWidget>;
  let backend: HttpTestingController;

  async function render(summary: MyScheduleSummary): Promise<void> {
    TestBed.configureTestingModule({
      imports: [NextLessonWidget],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
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
        next: scheduledLesson({ topic: 'Дроби', meetingUrl: 'https://meet.example.com/1' }),
        weekLessons: 2,
      }),
    );
    const text = readableText(hostElement(fixture));
    expect(text).toContain('18:00–19:00 Дроби');
    expect(text).toContain('Войти в урок');
    expect(hostElement(fixture).querySelector('a.tb-next__join')?.getAttribute('href')).toBe(
      'https://meet.example.com/1',
    );

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
    const lesson = scheduledLesson({ pendingRequest: changeRequest({ kind: 'CANCEL' }) });
    await render(myScheduleSummary({ next: lesson, pendingRequests: 1 }));

    expect(readableText(hostElement(fixture))).toContain('Отмена: запрос отправлен, ждём ответа учителя');
    expect(() => buttonByText(hostElement(fixture), 'Перенести')).toThrow();
    fixture.componentInstance.ask(lesson, 'RESCHEDULE');
    fixture.detectChanges();
    expect(bodyText()).not.toContain('Перенести занятие');
  });
});
