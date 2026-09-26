import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@core/auth/auth.models';
import { authResponse } from '@testing/auth';
import { hostElement, readableText } from '@testing/dom';
import { channelSetup, notification, notificationPage, preferences } from '@testing/notification-fixtures';
import { PAGE_SIZE } from './inbox/inbox-panel';
import { NotificationsPage } from './notifications-page';

describe('NotificationsPage', () => {
  let fixture: ComponentFixture<NotificationsPage>;
  let backend: HttpTestingController;

  function render(role: Role, tab?: string): void {
    TestBed.configureTestingModule({
      imports: [NotificationsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        providePrimeNG(),
        MessageService,
      ],
    });
    TestBed.inject(AuthService).acceptSession(authResponse(role));
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationsPage);
    if (tab !== undefined) {
      fixture.componentRef.setInput('tab', tab);
    }
    fixture.detectChanges();
  }

  function flushInbox(): void {
    backend
      .expectOne(`/api/me/notifications?page=0&size=${String(PAGE_SIZE)}`)
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

  it('opens the teacher inbox by default, with the unread count', async () => {
    render('TEACHER', 'unknown');
    flushInbox();
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Входящие 1');
    expect(text).toContain('Сообщения ученикам');
    expect(text).toContain('Дроби');
  });

  it('opens the section from the address and reloads own messengers after a bot change', async () => {
    render('TEACHER', 'messengers');
    backend.expectOne('/api/teacher/notifications/channels').flush([channelSetup()]);
    backend.expectOne('/api/me/channels').flush([]);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Мои мессенджеры');
    fixture.componentInstance.reloadChannels();
    backend.expectOne('/api/me/channels').flush([]);
    fixture.componentInstance.reloadBots();
    backend.expectOne('/api/teacher/notifications/channels').flush([channelSetup()]);
  });

  it('keeps the chosen section in the address', async () => {
    render('TEACHER');
    flushInbox();
    await fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture.componentInstance.select('students');
    fixture.componentInstance.select('inbox');
    fixture.componentInstance.select(7);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith([], { queryParams: { tab: 'students' }, replaceUrl: true });
  });
});
