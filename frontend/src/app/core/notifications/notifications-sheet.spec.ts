import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { hostElement, requireElement } from '@testing/dom';
import { NotificationsSheet } from './notifications-sheet';
import {
  NOTIFICATIONS_SHEET_CONTENT,
  NotificationsSheetState,
  notificationsTab,
  openOnNotificationsParam,
} from './notifications-sheet-state';

@Component({
  selector: 'tb-test-sheet-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button type="button">Входящие</button>`,
})
class SheetContent {}

@Component({
  selector: 'tb-test-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class Page {}

@Component({
  selector: 'tb-test-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class Frame {
  constructor() {
    openOnNotificationsParam();
  }
}

describe('NotificationsSheetState', () => {
  it('opens on a tab, toggles and closes', () => {
    const state = TestBed.inject(NotificationsSheetState);
    expect(state.open()).toBe(false);
    expect(state.tab()).toBe('inbox');

    state.show('sent');
    expect(state.open()).toBe(true);
    expect(state.tab()).toBe('sent');
    state.toggle();
    expect(state.open()).toBe(false);
    state.toggle();
    expect(state.tab()).toBe('sent');
    state.close();
    expect(state.open()).toBe(false);
  });

  it.each([
    ['sent', 'sent'],
    ['inbox', 'inbox'],
    ['', 'inbox'],
    ['other', 'inbox'],
  ])('reads «%s» as the %s tab', (value, tab) => {
    expect(notificationsTab(value)).toBe(tab);
  });
});

describe('openOnNotificationsParam', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: Page }])],
    });
  });

  it('opens the sheet on arrival and drops only its parameter', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/teacher?notifications=sent&create=lesson');
    const fixture = TestBed.createComponent(Frame);
    await fixture.whenStable();

    const state = TestBed.inject(NotificationsSheetState);
    expect(state.open()).toBe(true);
    expect(state.tab()).toBe('sent');
    await vi.waitFor(() => {
      expect(router.url).toBe('/teacher?create=lesson');
    });
    fixture.destroy();
  });

  it('opens the sheet when a later address asks for it', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/teacher/schedule');
    const fixture = TestBed.createComponent(Frame);
    const state = TestBed.inject(NotificationsSheetState);
    expect(state.open()).toBe(false);

    await router.navigateByUrl('/teacher?notifications=inbox');
    await vi.waitFor(() => {
      expect(router.url).toBe('/teacher');
    });
    expect(state.open()).toBe(true);
    expect(state.tab()).toBe('inbox');

    // after the frame is gone the parameter is not its business
    fixture.destroy();
    state.close();
    await router.navigateByUrl('/teacher?notifications=sent');
    expect(state.open()).toBe(false);
  });
});

describe('NotificationsSheet', () => {
  let fixture: ComponentFixture<NotificationsSheet>;
  let state: NotificationsSheetState;
  let router: Router;

  async function render(docked: boolean, content = true): Promise<void> {
    TestBed.configureTestingModule({
      imports: [NotificationsSheet],
      providers: [
        provideRouter([{ path: '**', component: Page }]),
        providePrimeNG(),
        ...(content
          ? [
              {
                provide: NOTIFICATIONS_SHEET_CONTENT,
                useValue: () => Promise.resolve(SheetContent),
              },
            ]
          : []),
      ],
    });
    state = TestBed.inject(NotificationsSheetState);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/teacher');
    fixture = TestBed.createComponent(NotificationsSheet);
    fixture.componentRef.setInput('docked', docked);
    await fixture.whenStable();
  }

  async function open(): Promise<void> {
    state.show();
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Входящие');
    });
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture.destroy();
  });

  describe('modal (below extra-large)', () => {
    beforeEach(async () => {
      await render(false);
    });

    it('is the modal side sheet of 400 dp with the content of the feature', async () => {
      expect(document.body.querySelector('.tb-side-sheet')).toBeNull();

      await open();

      const sheet = requireElement(document.body, '.p-drawer.tb-side-sheet', HTMLElement);
      expect(sheet.classList).toContain('tb-side-sheet--narrow');
      expect(sheet.getAttribute('aria-modal')).toBe('true');
      expect(sheet.querySelector('.p-drawer-title')?.textContent).toContain('Уведомления');
      expect(sheet.querySelector('tb-test-sheet-content')).not.toBeNull();
      expect(document.body.querySelector('.p-drawer-mask')).not.toBeNull();
      expect(hostElement(fixture).querySelector('aside')).toBeNull();
    });

    it('closes with «×»', async () => {
      await open();

      requireElement(document.body, '.p-drawer button[aria-label="Закрыть"]', HTMLElement).click();
      await fixture.whenStable();

      expect(state.open()).toBe(false);
    });

    it('closes when a notification leads to another page, not when only the query changes', async () => {
      await open();

      await router.navigateByUrl('/teacher?create=lesson');
      expect(state.open()).toBe(true);

      await router.navigateByUrl('/teacher/homework');
      expect(state.open()).toBe(false);
    });
  });

  describe('docked (extra-large)', () => {
    beforeEach(async () => {
      await render(true);
    });

    it('is the third pane beside the page, without a scrim, and takes the focus', async () => {
      const opener = document.createElement('button');
      document.body.append(opener);
      opener.focus();

      await open();
      await fixture.whenStable();

      const pane = requireElement(hostElement(fixture), 'aside', HTMLElement);
      expect(pane.id).toBe('tb-notifications-sheet');
      expect(pane.getAttribute('aria-labelledby')).toBe('tb-notifications-sheet-title');
      expect(pane.querySelector('h2')?.textContent).toContain('Уведомления');
      expect(pane.querySelector('tb-test-sheet-content')).not.toBeNull();
      expect(document.activeElement).toBe(pane);
      expect(document.body.querySelector('.p-drawer-mask')).toBeNull();

      requireElement(pane, 'button[aria-label="Закрыть"]', HTMLButtonElement).click();
      await fixture.whenStable();

      expect(state.open()).toBe(false);
      expect(hostElement(fixture).querySelector('aside')).toBeNull();
      expect(document.activeElement).toBe(opener);
      opener.remove();
    });

    it('closes with Esc and stays open across the pages', async () => {
      await open();

      await router.navigateByUrl('/teacher/homework');
      expect(state.open()).toBe(true);

      requireElement(hostElement(fixture), 'aside', HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape' }),
      );
      await fixture.whenStable();
      expect(state.open()).toBe(false);
    });
  });

  it('stays empty when the application gives no content', async () => {
    await render(true, false);

    state.show();
    await fixture.whenStable();

    const pane = requireElement(hostElement(fixture), 'aside', HTMLElement);
    expect(pane.querySelector('tb-test-sheet-content')).toBeNull();
  });
});
