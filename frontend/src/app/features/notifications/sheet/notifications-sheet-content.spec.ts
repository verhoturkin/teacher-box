import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@core/auth/auth.models';
import { NotificationsSheetState } from '@core/notifications/notifications-sheet-state';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { authResponse } from '@testing/auth';
import { hostElement, readableText } from '@testing/dom';
import { notification, notificationPage } from '@testing/notification-fixtures';
import { testProviders } from '@testing/setup';
import { PAGE_SIZE } from '../inbox/inbox-panel';
import { NotificationsSheetContent } from './notifications-sheet-content';

describe('NotificationsSheetContent', () => {
  let fixture: ComponentFixture<NotificationsSheetContent>;
  let backend: HttpTestingController;
  let state: NotificationsSheetState;

  async function render(role: Role, tab?: 'sent'): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [NotificationsSheetContent],
      providers: testProviders(),
    });
    TestBed.inject(AuthService).acceptSession(authResponse(role));
    backend = TestBed.inject(HttpTestingController);
    state = TestBed.inject(NotificationsSheetState);
    if (tab !== undefined) {
      state.show(tab);
    }
    fixture = TestBed.createComponent(NotificationsSheetContent);
    fixture.detectChanges();
    backend
      .expectOne(`/api/me/notifications?page=0&size=${String(PAGE_SIZE)}&read=false`)
      .flush(notificationPage([notification()]));
    if (role === 'TEACHER') {
      backend.expectOne('/api/teacher/notifications/broadcasts').flush([]);
    }
    await fixture.whenStable();
    return hostElement(fixture);
  }

  function tabs(host: HTMLElement): HTMLElement[] {
    return Array.from(host.querySelectorAll<HTMLElement>('[role="tab"]'));
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('gives the teacher the tabs «Входящие N» and «Отправленные»', async () => {
    const host = await render('TEACHER');
    TestBed.inject(UnreadNotifications).set(3);
    await fixture.whenStable();

    expect(tabs(host).map((tab) => readableText(tab))).toEqual(['Входящие 3', 'Отправленные']);
    expect(tabs(host)[0]?.getAttribute('aria-selected')).toBe('true');
    expect(readableText(host)).toContain('Дроби');
  });

  it('shows at most four characters in the badge', async () => {
    const host = await render('TEACHER');
    TestBed.inject(UnreadNotifications).set(1500);
    await fixture.whenStable();

    expect(readableText(tabs(host)[0] ?? host)).toBe('Входящие 999+');

    TestBed.inject(UnreadNotifications).set(0);
    await fixture.whenStable();
    expect(readableText(tabs(host)[0] ?? host)).toBe('Входящие');
  });

  it('switches the tab and remembers it', async () => {
    const host = await render('TEACHER');

    tabs(host)[1]?.click();
    await fixture.whenStable();

    expect(state.tab()).toBe('sent');
    expect(tabs(host)[1]?.getAttribute('aria-selected')).toBe('true');
    expect(readableText(host)).toContain('Написать ученикам');

    state.tab.set('inbox');
    await fixture.whenStable();
    expect(tabs(host)[0]?.getAttribute('aria-selected')).toBe('true');
  });

  it('opens on the tab the sheet was asked for', async () => {
    const host = await render('TEACHER', 'sent');

    expect(tabs(host)[1]?.getAttribute('aria-selected')).toBe('true');
  });

  it('gives the student only the inbox, without tabs', async () => {
    const host = await render('STUDENT');

    expect(tabs(host)).toHaveLength(0);
    expect(host.querySelector('tb-inbox-panel')).not.toBeNull();
    expect(host.querySelector('tb-broadcasts-panel')).toBeNull();
  });
});
