import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@core/auth/auth.models';
import { authResponse } from '@testing/auth';
import { hostElement, readableText, requireElement } from '@testing/dom';
import {
  channelSetup,
  notification,
  notificationPage,
  preferences,
} from '@testing/notification-fixtures';
import { PAGE_SIZE } from './inbox/inbox-panel';
import { NotificationsPage } from './notifications-page';
import { testProviders } from '@testing/setup';

describe('NotificationsPage', () => {
  let fixture: ComponentFixture<NotificationsPage>;
  let backend: HttpTestingController;

  function render(role: Role, inputs: { open?: string; tab?: string } = {}): void {
    TestBed.configureTestingModule({
      imports: [NotificationsPage],
      providers: testProviders(),
    });
    TestBed.inject(AuthService).acceptSession(authResponse(role));
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationsPage);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  function toggle(section: string): HTMLButtonElement {
    return requireElement(
      hostElement(fixture),
      `#notifications-${section} .tb-fold-card__toggle`,
      HTMLButtonElement,
    );
  }

  function flushBroadcasts(): void {
    backend.expectOne('/api/teacher/notifications/broadcasts').flush([]);
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

  it('shows the teacher the inbox and the messages, the settings folded', async () => {
    render('TEACHER', { open: 'unknown' });
    flushInbox();
    flushBroadcasts();
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Входящие 1');
    expect(text).toContain('Дроби');
    expect(text).toContain('Сообщения ученикам');
    expect(hostElement(fixture).querySelector('p-tabs')).toBeNull();
    for (const section of ['messengers', 'students', 'preferences']) {
      expect(toggle(section).getAttribute('aria-expanded')).toBe('false');
    }
    expect(text).toContain('Что присылать');
    expect(text).not.toContain('Мои мессенджеры');
  });

  it('opens a section of the former tabs, shows it and reloads own messengers after a bot change', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render('TEACHER', { tab: 'messengers' });
    flushInbox();
    flushBroadcasts();
    backend.expectOne('/api/teacher/notifications/channels').flush([channelSetup()]);
    backend.expectOne('/api/me/channels').flush([]);
    backend
      .expectOne('/api/teacher/notifications/bot')
      .flush({ teacherActions: true, teacherMenu: [], studentMenu: [] });
    await fixture.whenStable();

    expect(toggle('messengers').getAttribute('aria-expanded')).toBe('true');
    expect(readableText(hostElement(fixture))).toContain('Мои мессенджеры');
    expect(readableText(hostElement(fixture))).toContain('Что умеет бот');
    expect(scroll).toHaveBeenCalledWith({ block: 'start' });
    fixture.componentInstance.reloadChannels();
    backend.expectOne('/api/me/channels').flush([]);
    fixture.componentInstance.reloadBots();
    backend.expectOne('/api/teacher/notifications/channels').flush([channelSetup()]);
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });

  it('keeps the open sections in the address', async () => {
    render('TEACHER', { open: 'preferences', tab: 'inbox' });
    flushInbox();
    flushBroadcasts();
    backend.expectOne('/api/me/notifications/preferences').flush(preferences());
    await fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    toggle('students').click();
    expect(navigate).toHaveBeenLastCalledWith([], {
      queryParams: { open: 'students,preferences', tab: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    fixture.componentInstance.fold('preferences', false);
    expect(navigate).toHaveBeenLastCalledWith([], {
      queryParams: { open: null, tab: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    backend.match(() => true);
  });
});
