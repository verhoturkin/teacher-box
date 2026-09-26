import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { hostElement, readableText } from '@testing/dom';
import { homeworkSummary } from '@testing/homework-fixtures';
import { teacherNotificationsSummary } from '@testing/notification-fixtures';
import { scheduleSummary } from '@testing/schedule-fixtures';
import { AttentionCard } from './attention-card';

describe('AttentionCard', () => {
  let fixture: ComponentFixture<AttentionCard>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AttentionCard], providers: [provideRouter([]), providePrimeNG()] });
    fixture = TestBed.createComponent(AttentionCard);
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('says when nothing is waiting', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Срочных дел нет');
  });

  it('lists what is waiting with links', async () => {
    fixture.componentRef.setInput('schedule', scheduleSummary({ unmarked: 2, pendingRequests: 1 }));
    fixture.componentRef.setInput('homework', homeworkSummary({ toReview: 3, overdue: 4 }));
    fixture.componentRef.setInput('notifications', teacherNotificationsSummary({ failedDeliveries: 5 }));
    fixture.detectChanges();
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Отметьте прошедшие занятия 2');
    expect(text).toContain('Запросы на перенос и отмену 1');
    expect(text).toContain('Работы на проверку 3');
    expect(text).toContain('Просроченные задания 4');
    expect(text).toContain('Недоставленные уведомления 5');
    const links = Array.from(hostElement(fixture).querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toEqual([
      '/teacher/schedule',
      '/teacher/schedule',
      '/teacher/homework/review',
      '/teacher/homework',
      '/teacher/notifications?tab=students',
    ]);
  });
});
