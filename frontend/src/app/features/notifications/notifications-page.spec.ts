import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@core/auth/auth.models';
import { authResponse } from '@testing/auth';
import { hostElement, readableText } from '@testing/dom';
import { notification, notificationPage, preferences } from '@testing/notification-fixtures';
import { PAGE_SIZE } from './inbox/inbox-panel';
import { NotificationsPage } from './notifications-page';
import { testProviders } from '@testing/setup';

describe('NotificationsPage', () => {
  let fixture: ComponentFixture<NotificationsPage>;
  let backend: HttpTestingController;

  function render(role: Role): void {
    TestBed.configureTestingModule({
      imports: [NotificationsPage],
      providers: testProviders(),
    });
    TestBed.inject(AuthService).acceptSession(authResponse(role));
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();
  }

  function flushBroadcasts(): void {
    backend.expectOne('/api/teacher/notifications/broadcasts').flush([]);
  }

  function flushInbox(): void {
    backend
      .expectOne(`/api/me/notifications?page=0&size=${String(PAGE_SIZE)}&read=false`)
      .flush(notificationPage([notification()]));
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('shows a student the inbox, the messengers and what to send', async () => {
    render('STUDENT');
    flushInbox();
    backend.expectOne('/api/me/channels').flush([]);
    backend.expectOne('/api/me/notifications/preferences').flush(preferences());
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Дроби');
    expect(text).toContain('Мессенджеры');
    expect(text).toContain('Что присылать в мессенджеры');
    expect(text).not.toContain('Сообщения ученикам');
  });

  it('shows the teacher only the inbox and the messages', async () => {
    render('TEACHER');
    flushInbox();
    flushBroadcasts();
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Входящие 1');
    expect(text).toContain('Дроби');
    expect(text).toContain('Сообщения ученикам');
    expect(text).not.toContain('Мои мессенджеры');
    expect(text).not.toContain('Что присылать');
    expect(hostElement(fixture).querySelectorAll('tb-fold-card')).toHaveLength(2);
  });
});
