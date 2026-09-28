import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { bodyText, hostElement, readableText, requireElement } from '@testing/dom';
import { calendarFeed, scheduleSettings, scheduledLesson } from '@testing/schedule-fixtures';
import { phoneScreen, testProviders } from '@testing/setup';
import { SchedulePage } from './schedule-page';

describe('SchedulePage on a phone', () => {
  let fixture: ComponentFixture<SchedulePage>;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SchedulePage],
      providers: testProviders(phoneScreen()),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SchedulePage);
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('shows the lessons as a list by days and plans a lesson with «+»', async () => {
    fixture.detectChanges();
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
    backend.expectOne('/api/teacher/students').flush([]);
    backend.expectOne('/api/teacher/groups').flush([]);
    backend.expectOne('/api/teacher/schedule/requests').flush([]);
    backend.expectOne('/api/teacher/schedule/unmarked').flush([]);
    backend.expectOne('/api/teacher/schedule/series').flush([]);
    backend.expectOne('/api/me/schedule/feed').flush(calendarFeed());
    backend
      .expectOne('/api/teacher/schedule/google')
      .flush({ status: 'NOT_CONNECTED', busyEnabled: false });
    await fixture.whenStable();
    backend
      .expectOne((request) => request.url === '/api/teacher/schedule/lessons')
      .flush([scheduledLesson()]);
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(readableText(host)).toContain('Список');
    expect(host.querySelector('.tb-calendar-title')).not.toBeNull();
    expect(
      Array.from(host.querySelectorAll('.tb-page-header .tb-actions button')).map((b) =>
        b.textContent.trim(),
      ),
    ).toEqual(['Регулярные занятия']);

    requireElement(host, '.tb-fab button', HTMLButtonElement).click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Новое занятие');
  });
});
