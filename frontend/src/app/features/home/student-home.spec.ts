import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { hostElement, readableText } from '@testing/dom';
import { myBillingSummary } from '@testing/billing-fixtures';
import { myHomeworkSummary, myTask } from '@testing/homework-fixtures';
import { channel, notificationPage } from '@testing/notification-fixtures';
import { myScheduleSummary, scheduleSettings, scheduledLesson } from '@testing/schedule-fixtures';
import { StudentHome } from './student-home';

describe('StudentHome', () => {
  let fixture: ComponentFixture<StudentHome>;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StudentHome],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentHome);
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    localStorage.clear();
  });

  it('collects the widgets of the modules', async () => {
    fixture.detectChanges();
    backend.expectOne('/api/me/channels').flush([channel()]);
    backend.expectOne('/api/me/schedule/summary').flush(myScheduleSummary({ next: scheduledLesson({ topic: 'Дроби' }) }));
    backend.expectOne('/api/me/homework/summary').flush(myHomeworkSummary({ open: 1, upcoming: [myTask()] }));
    backend.expectOne('/api/me/billing/summary').flush(myBillingSummary({ balance: 150_000 }));
    fixture.detectChanges();
    backend.expectOne('/api/me/notifications?page=0&size=5').flush(notificationPage([]));
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
    fixture.detectChanges();
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Получайте уведомления в мессенджере');
    expect(text).toContain('Дроби');
    expect(text).toContain('аванс 1 500 ₽');
    expect(text).toContain('Уведомлений пока нет');

    fixture.componentInstance.loadSchedule();
    backend.expectOne('/api/me/schedule/summary').flush(myScheduleSummary());
    fixture.detectChanges();
    await fixture.whenStable();
    expect(readableText(hostElement(fixture))).toContain('Ближайших занятий нет');
  });
});
