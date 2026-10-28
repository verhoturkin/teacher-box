import { ChangeDetectionStrategy, Component, Provider, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Dialog } from 'primeng/dialog';
import { Drawer } from 'primeng/drawer';
import { bodyText, buttonByText, hostElement, requireElement } from '@testing/dom';
import { screenWidth, testProviders } from '@testing/setup';
import { Confirm } from '../confirm';
import { DialogFooter, DialogHeaderActions, DialogKind, TbDialog } from './dialog';

@Component({
  imports: [TbDialog, DialogHeaderActions, DialogFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="opener" (click)="open.set(true)">Открыть</button>
    <tb-dialog
      [kind]="kind()"
      [(visible)]="open"
      headline="Заголовок"
      [width]="wide() ? 'wide' : 'normal'"
      [confirmLabel]="confirmLabel()"
      [cancelLabel]="cancelLabel()"
      [formId]="formId()"
      [pending]="pending()"
      [error]="error()"
      [closable]="closable()"
      [dirty]="dirty()"
      (confirm)="confirmed.update((count) => count + 1)"
      (closed)="closedCount.update((count) => count + 1)"
    >
      @if (withSlots()) {
        <ng-template tbDialogHeaderActions>
          <button type="button" class="edit">Правка</button>
        </ng-template>
        <ng-template tbDialogFooter>
          <button type="button" class="own">Своя кнопка</button>
        </ng-template>
      }
      <form id="f" (submit)="$event.preventDefault(); submitted.update((count) => count + 1)">
        <input id="first" />
        <input id="second" />
      </form>
    </tb-dialog>
  `,
})
class Host {
  readonly open = signal(false);
  readonly kind = signal<DialogKind>('form');
  readonly confirmLabel = signal<string | null>('Сохранить');
  readonly cancelLabel = signal<string | null>('Отмена');
  readonly formId = signal<string | undefined>('f');
  readonly pending = signal(false);
  readonly error = signal<string | null>(null);
  readonly closable = signal(true);
  readonly dirty = signal(false);
  readonly withSlots = signal(false);
  readonly wide = signal(false);
  readonly submitted = signal(0);
  readonly confirmed = signal(0);
  readonly closedCount = signal(0);
}

const COMPACT = 400;
const EXPANDED = 1000;

describe('TbDialog', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  async function setup(width: number, kind: DialogKind, ...extra: Provider[]): Promise<void> {
    TestBed.configureTestingModule({ providers: testProviders(screenWidth(width), ...extra) });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    host.kind.set(kind);
    await fixture.whenStable();
  }

  /** Opens from the «Открыть» button and plays the `onShow` the animation would send. */
  async function show(): Promise<HTMLElement> {
    const opener = openerButton();
    opener.focus();
    opener.click();
    await fixture.whenStable();
    const [drawer] = fixture.debugElement.queryAll(By.directive(Drawer));
    if (drawer !== undefined) {
      const instance = drawer.injector.get(Drawer);
      instance.show();
      instance.onShow.emit({});
      await fixture.whenStable();
      return present(instance.container);
    }
    const dialog = fixture.debugElement.query(By.directive(Dialog)).injector.get(Dialog);
    dialog.onShow.emit({});
    await fixture.whenStable();
    return present(dialog.container());
  }

  function present<T>(value: T | null | undefined): T {
    if (value === null || value === undefined) {
      throw new Error('expected a value');
    }
    return value;
  }

  function openerButton(): HTMLButtonElement {
    return requireElement(hostElement(fixture), '.opener', HTMLButtonElement);
  }

  function footer(container: HTMLElement): HTMLElement {
    return requireElement(container, '.p-dialog-footer', HTMLElement);
  }

  function wrapper(): HTMLElement {
    return present(dialog().wrapper);
  }

  function dialog(): Dialog {
    return fixture.debugElement.query(By.directive(Dialog)).injector.get(Dialog);
  }

  function keydown(key: string): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }

  afterEach(() => {
    fixture.destroy();
  });

  describe('containers', () => {
    it('an alert is a basic dialog at every width, named by its headline, without ✕', async () => {
      for (const width of [COMPACT, EXPANDED]) {
        TestBed.resetTestingModule();
        await setup(width, 'alert');
        const container = await show();

        expect(container.classList).toContain('tb-d--alert');
        expect(container.classList).not.toContain('tb-d--full');
        expect(container.getAttribute('role')).toBe('alertdialog');
        const headline = requireElement(container, '.tb-d__headline', HTMLElement);
        expect(container.getAttribute('aria-labelledby')).toBe(headline.id);
        expect(container.querySelector('.tb-d__close')).toBeNull();
        expect(buttonByText(container, 'Отмена')).toBeTruthy();
        expect(buttonByText(container, 'Сохранить')).toBeTruthy();
        fixture.destroy();
      }
    });

    it('a form is a full-screen dialog on compact: ✕ first, the action in the header, no footer', async () => {
      await setup(COMPACT, 'form');
      const container = await show();

      expect(container.classList).toContain('tb-d--full');
      const head = requireElement(container, '.tb-d__head', HTMLElement);
      const kids = Array.from(head.children);
      expect(kids[0]?.classList).toContain('tb-d__close');
      expect(kids[kids.length - 1]?.textContent).toContain('Сохранить');
      expect(kids[kids.length - 1]?.querySelector('button')?.className).toContain('p-button-sm');
      expect(kids[kids.length - 1]?.querySelector('button')?.className).not.toContain(
        'p-button-text',
      );
      expect(container.querySelector('.p-dialog-footer button')).toBeNull();
      expect(
        Array.from(container.querySelectorAll('button')).map((b) => b.textContent),
      ).not.toContain('Отмена');
    });

    it('a form is a basic dialog from medium: «Отмена · Действие», no ✕', async () => {
      await setup(EXPANDED, 'form');
      const container = await show();

      expect(container.classList).not.toContain('tb-d--full');
      expect(container.querySelector('.tb-d__close')).toBeNull();
      const buttons = Array.from(container.querySelectorAll('.p-dialog-footer button'));
      expect(buttons.map((button) => button.textContent.trim())).toEqual(['Отмена', 'Сохранить']);
    });

    it('a wide form gets the wide class', async () => {
      await setup(EXPANDED, 'form');
      host.wide.set(true);
      const container = await show();
      expect(container.classList).toContain('tb-d--wide');
    });

    it('a sheet is a bottom sheet on compact, without ✕', async () => {
      await setup(COMPACT, 'sheet');
      await show();

      const drawer = fixture.debugElement.query(By.directive(Drawer)).injector.get(Drawer);
      expect(fixture.debugElement.query(By.directive(Dialog))).toBeNull();
      expect(drawer.container?.classList).toContain('tb-sheet');
      expect(drawer.container?.getAttribute('role')).toBe('dialog');
      expect(drawer.container?.querySelector('.tb-d__close')).toBeNull();
    });

    it('a sheet is a basic dialog from medium, with ✕', async () => {
      await setup(EXPANDED, 'sheet');
      const container = await show();

      expect(fixture.debugElement.query(By.directive(Drawer))).toBeNull();
      expect(container.classList).toContain('tb-d--sheet');
      requireElement(container, '.tb-d__close button', HTMLButtonElement).click();
      await fixture.whenStable();
      expect(host.open()).toBe(false);
    });

    it('puts the header actions into the header and a custom footer in place of the buttons', async () => {
      await setup(EXPANDED, 'sheet');
      host.withSlots.set(true);
      const container = await show();

      expect(container.querySelector('.tb-d__actions .edit')).not.toBeNull();
      expect(container.querySelector('.p-dialog-footer .own')).not.toBeNull();
      expect(buttonByText(footer(container), 'Своя кнопка')).toBeTruthy();
      expect(footer(container).textContent).not.toContain('Сохранить');
    });

    it('has no confirm button without a label (a sheet that only shows)', async () => {
      await setup(EXPANDED, 'sheet');
      host.confirmLabel.set(null);
      host.cancelLabel.set(null);
      const container = await show();

      expect(container.querySelectorAll('.p-dialog-footer button')).toHaveLength(0);
    });
  });

  describe('focus', () => {
    it('starts on the first field of a form', async () => {
      await setup(EXPANDED, 'form');
      await show();
      expect(document.activeElement?.id).toBe('first');
    });

    it('starts on the headline of an alert and of a sheet', async () => {
      await setup(EXPANDED, 'alert');
      await show();
      expect(document.activeElement?.textContent).toBe('Заголовок');
      expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');
      fixture.destroy();
      TestBed.resetTestingModule();

      await setup(COMPACT, 'sheet');
      await show();
      expect(document.activeElement?.textContent).toBe('Заголовок');
    });

    it('returns to the opener when it closes', async () => {
      await setup(EXPANDED, 'form');
      await show();
      const opener = openerButton();
      expect(document.activeElement).not.toBe(opener);

      host.open.set(false);
      await fixture.whenStable();
      dialog().onHide.emit({});
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(document.activeElement).toBe(opener);
    });
  });

  describe('closing', () => {
    it('closes an alert by the scrim, Esc and Cancel', async () => {
      await setup(EXPANDED, 'alert');
      await show();
      wrapper().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await fixture.whenStable();
      expect(host.open()).toBe(false);
      expect(host.closedCount()).toBe(1);

      await show();
      keydown('Escape');
      await fixture.whenStable();
      expect(host.open()).toBe(false);

      await show();
      buttonByText(document.body, 'Отмена').click();
      await fixture.whenStable();
      expect(host.open()).toBe(false);
    });

    it('does not close a form by a click beside it nor by a click inside the dialog', async () => {
      await setup(EXPANDED, 'form');
      const container = await show();

      wrapper().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await fixture.whenStable();
      expect(host.open()).toBe(true);

      keydown('Escape');
      await fixture.whenStable();
      expect(host.open()).toBe(false);
    });

    it('closes a sheet by the scrim', async () => {
      await setup(COMPACT, 'sheet');
      await show();
      const drawer = fixture.debugElement.query(By.directive(Drawer)).injector.get(Drawer);
      present(drawer.mask).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await fixture.whenStable();
      expect(host.open()).toBe(false);
    });

    it('cannot be closed while it is not closable', async () => {
      await setup(EXPANDED, 'alert');
      host.closable.set(false);
      const container = await show();

      expect(container.querySelectorAll('.p-dialog-footer button')).toHaveLength(1);
      keydown('Escape');
      wrapper().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await fixture.whenStable();
      expect(host.open()).toBe(true);
    });

    it('leaves Esc to a dialog above it', async () => {
      await setup(EXPANDED, 'alert');
      const container = await show();
      container.style.zIndex = '1';
      keydown('Escape');
      await fixture.whenStable();
      expect(host.open()).toBe(true);
    });
  });

  describe('dirty form', () => {
    it('asks inline from medium: «Не сохранять» closes, «Отмена» keeps editing', async () => {
      await setup(EXPANDED, 'form');
      host.dirty.set(true);
      const container = await show();

      buttonByText(container, 'Отмена').click();
      await fixture.whenStable();
      expect(host.open()).toBe(true);
      expect(bodyText()).toContain('Введённые данные не сохранятся.');
      expect(footer(container).textContent).not.toContain('Сохранить');

      const step = requireElement(container, 'tb-dialog-confirm-step', HTMLElement);
      buttonByText(step, 'Отмена').click();
      await fixture.whenStable();
      expect(host.open()).toBe(true);
      expect(container.querySelector('tb-dialog-confirm-step')).toBeNull();

      keydown('Escape');
      await fixture.whenStable();
      buttonByText(
        requireElement(container, 'tb-dialog-confirm-step', HTMLElement),
        'Не сохранять',
      ).click();
      await fixture.whenStable();
      expect(host.open()).toBe(false);
    });

    it('asks in a dialog over the full-screen form on compact', async () => {
      await setup(COMPACT, 'form');
      host.dirty.set(true);
      const container = await show();
      const ask = vi.spyOn(TestBed.inject(Confirm), 'danger');
      ask.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      requireElement(container, '.tb-d__close button', HTMLButtonElement).click();
      await fixture.whenStable();
      expect(ask).toHaveBeenCalledWith(
        expect.objectContaining({ header: 'Отменить изменения?', acceptLabel: 'Не сохранять' }),
      );
      expect(host.open()).toBe(true);

      requireElement(container, '.tb-d__close button', HTMLButtonElement).click();
      await fixture.whenStable();
      expect(host.open()).toBe(false);
    });

    it('does not ask about a clean form', async () => {
      await setup(EXPANDED, 'form');
      const container = await show();
      buttonByText(container, 'Отмена').click();
      await fixture.whenStable();
      expect(host.open()).toBe(false);
    });
  });

  describe('confirm, pending, error', () => {
    it('submits the form of formId by the confirm button', async () => {
      await setup(EXPANDED, 'form');
      const container = await show();

      buttonByText(container, 'Сохранить').click();
      expect(host.submitted()).toBe(1);
      expect(host.confirmed()).toBe(0);
      expect(buttonByText(container, 'Сохранить').type).toBe('submit');
    });

    it('submits from the header on compact', async () => {
      await setup(COMPACT, 'form');
      const container = await show();
      buttonByText(container, 'Сохранить').click();
      expect(host.submitted()).toBe(1);
    });

    it('emits confirm without a form, and does not close itself', async () => {
      await setup(EXPANDED, 'alert');
      host.formId.set(undefined);
      const container = await show();

      buttonByText(container, 'Сохранить').click();
      expect(host.confirmed()).toBe(1);
      expect(host.open()).toBe(true);
    });

    it('shows the pending button as loading', async () => {
      await setup(EXPANDED, 'form');
      host.pending.set(true);
      const container = await show();
      expect(container.querySelector('.p-dialog-footer .p-button-loading')).not.toBeNull();
    });

    it('shows the error above a form and below the text of an alert', async () => {
      await setup(EXPANDED, 'form');
      host.error.set('Не вышло');
      const container = await show();
      const message = requireElement(container, '.tb-d__error', HTMLElement);
      expect(message.textContent).toContain('Не вышло');
      expect(message.nextElementSibling?.classList).toContain('tb-d__content');
      fixture.destroy();
      TestBed.resetTestingModule();

      await setup(EXPANDED, 'alert');
      host.error.set('Не вышло');
      const alert = await show();
      expect(
        requireElement(alert, '.tb-d__error', HTMLElement).previousElementSibling?.classList,
      ).toContain('tb-d__content');
    });

    it('scrolls the error into view when it appears', async () => {
      await setup(EXPANDED, 'form');
      const container = await show();
      const scroll = vi.fn();
      Element.prototype.scrollIntoView = scroll;
      host.error.set('Не вышло');
      await fixture.whenStable();
      expect(scroll).toHaveBeenCalled();
      expect(container.querySelector('.tb-d__error')).not.toBeNull();
    });
  });
});
