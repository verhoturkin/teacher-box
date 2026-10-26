import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  HostListener,
  Injector,
  Renderer2,
  TemplateRef,
  afterNextRender,
  computed,
  contentChild,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Drawer } from 'primeng/drawer';
import { Message } from 'primeng/message';
import { ZIndexUtils } from 'primeng/utils';
import { injectWindowSize } from '@core/layout/mobile';
import { SHARED_T } from '@shared/i18n/texts';
import { Confirm } from '../confirm';
import { SubmitFor } from '../submit-for';
import { DialogConfirmStep } from './dialog-confirm-step';
import { FocusReturn } from './focus-return';

/** What the dialog is for (ADR-0050); the window size only changes its container. */
export type DialogKind = 'alert' | 'form' | 'sheet';

/** The extra buttons of the header (✎, ⋮): `<ng-template tbDialogHeaderActions>`. */
@Directive({ selector: 'ng-template[tbDialogHeaderActions]' })
export class DialogHeaderActions {
  readonly template = inject<TemplateRef<void>>(TemplateRef);
}

/** The footer that replaces the standard «Отмена · Действие» (rare): `<ng-template tbDialogFooter>`. */
@Directive({ selector: 'ng-template[tbDialogFooter]' })
export class DialogFooter {
  readonly template = inject<TemplateRef<void>>(TemplateRef);
}

const TEXT_FIELD =
  'input:not([type="radio"], [type="checkbox"], [type="hidden"]):not([disabled]), textarea:not([disabled])';
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let nextId = 0;

/**
 * The one dialog of the portal (ADR-0050). The author picks the **kind** by content — `alert` (one
 * decision, ≤ 1 field), `form` (≥ 2 fields), `sheet` (an object and its actions) — and the window
 * size picks the container: an `alert` is a basic dialog everywhere, a `form` is the full-screen
 * dialog on compact and a basic one from medium, a `sheet` the bottom sheet on compact and a basic
 * dialog from medium. The content is the same in all of them.
 *
 * ```html
 * <tb-dialog kind="form" [(visible)]="visible" [headline]="t.title" [confirmLabel]="c.save"
 *            formId="student-form" [pending]="submit.pending()" [error]="submit.error()">
 *   <form id="student-form" (ngSubmit)="submit.run()">…fields…</form>
 * </tb-dialog>
 * ```
 *
 * The confirm button submits the form `formId` (Enter in a field does too) or, without it, emits
 * `confirm`; it is never disabled for invalid fields. The dialog does not close itself on
 * `confirm`: `dialogSubmit()` or the page closes it.
 */
@Component({
  selector: 'tb-dialog',
  imports: [NgTemplateOutlet, Button, Dialog, Drawer, Message, SubmitFor, DialogConfirmStep],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #confirmButton let-text="text">
      @if (formId(); as id) {
        <p-button
          [label]="confirmLabel() ?? undefined"
          [text]="text"
          [severity]="confirmSeverity() === 'danger' ? 'danger' : 'primary'"
          [loading]="pending()"
          type="submit"
          [tbSubmitFor]="id"
        />
      } @else {
        <p-button
          [label]="confirmLabel() ?? undefined"
          [text]="text"
          [severity]="confirmSeverity() === 'danger' ? 'danger' : 'primary'"
          [loading]="pending()"
          (onClick)="confirm.emit()"
        />
      }
    </ng-template>

    <ng-template #closeButton>
      <p-button
        class="tb-d__close"
        icon="tb-i tb-i-close"
        severity="secondary"
        [text]="true"
        [rounded]="true"
        [ariaLabel]="c.close"
        (onClick)="requestClose()"
      />
    </ng-template>

    <ng-template #head>
      <div class="tb-d__head">
        @if (closeInHeader() && mode() === 'full') {
          <ng-container *ngTemplateOutlet="closeButton" />
        }
        <span
          [class]="mode() === 'sheet' ? 'p-drawer-title' : 'p-dialog-title'"
          class="tb-d__headline"
          tabindex="-1"
          [id]="titleId"
          >{{ headline() }}</span
        >
        @if (headerActions(); as actions) {
          <span class="tb-d__actions">
            <ng-container *ngTemplateOutlet="actions.template" />
          </span>
        }
        @if (mode() === 'full' && confirmLabel() !== null) {
          <ng-container *ngTemplateOutlet="confirmButton; context: { text: true }" />
        }
        @if (closeInHeader() && mode() === 'basic') {
          <ng-container *ngTemplateOutlet="closeButton" />
        }
      </div>
    </ng-template>

    <ng-template #body>
      @if (error() !== null && kind() !== 'alert') {
        <p-message [id]="errorId" severity="error" styleClass="tb-d__error">{{
          error()
        }}</p-message>
      }
      <div class="tb-d__content">
        <ng-content />
      </div>
      @if (error() !== null && kind() === 'alert') {
        <p-message [id]="errorId" severity="error" styleClass="tb-d__error">{{
          error()
        }}</p-message>
      }
    </ng-template>

    <ng-template #foot>
      @if (discarding()) {
        <tb-dialog-confirm-step
          [message]="discardText"
          [confirmLabel]="discardLabel"
          (confirmed)="close()"
          (cancelled)="discarding.set(false)"
        />
      } @else if (customFooter(); as custom) {
        <ng-container *ngTemplateOutlet="custom.template" />
      } @else {
        @if (cancelLabel() !== null && closable() && mode() !== 'full') {
          <p-button
            [label]="cancelLabel() ?? undefined"
            severity="secondary"
            [text]="true"
            (onClick)="requestClose()"
          />
        }
        @if (confirmLabel() !== null && mode() !== 'full') {
          <ng-container *ngTemplateOutlet="confirmButton; context: { text: false }" />
        }
      }
    </ng-template>

    @if (mode() === 'sheet') {
      <p-drawer
        [visible]="visible()"
        (visibleChange)="visible.set($event)"
        position="bottom"
        [modal]="true"
        appendTo="body"
        [blockScroll]="true"
        [closeOnEscape]="false"
        [dismissible]="false"
        [showCloseIcon]="false"
        styleClass="tb-sheet tb-d tb-d--sheet"
        (onShow)="opened()"
        (onHide)="hidden()"
      >
        <ng-template #header>
          <ng-container *ngTemplateOutlet="head" />
        </ng-template>
        <ng-container *ngTemplateOutlet="body" />
        <div class="tb-d__foot">
          <ng-container *ngTemplateOutlet="foot" />
        </div>
      </p-drawer>
    } @else {
      <p-dialog
        [visible]="visible()"
        (visibleChange)="visible.set($event)"
        [modal]="true"
        [draggable]="false"
        appendTo="body"
        [blockScroll]="true"
        [closable]="false"
        [closeOnEscape]="false"
        [dismissableMask]="false"
        [focusOnShow]="false"
        [role]="kind() === 'alert' ? 'alertdialog' : 'dialog'"
        [styleClass]="dialogClass()"
        (onShow)="opened()"
        (onHide)="hidden()"
      >
        <ng-template #header>
          <ng-container *ngTemplateOutlet="head" />
        </ng-template>
        <ng-container *ngTemplateOutlet="body" />
        <ng-template #footer>
          <ng-container *ngTemplateOutlet="foot" />
        </ng-template>
      </p-dialog>
    }
  `,
})
export class TbDialog {
  protected readonly c = SHARED_T.common;
  protected readonly discardText = SHARED_T.dialog.discardText;
  protected readonly discardLabel = SHARED_T.dialog.discard;
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);
  private readonly injector = inject(Injector);
  private readonly windowSize = injectWindowSize();
  private readonly focusReturn = new FocusReturn(this.document);
  private readonly dialog = viewChild(Dialog);
  private readonly drawer = viewChild(Drawer);
  private stopScrim: (() => void) | null = null;

  protected readonly titleId = `tb-d-title-${String(nextId)}`;
  protected readonly errorId = `tb-d-error-${String(nextId++)}`;

  readonly kind = input.required<DialogKind>();
  /** `normal` 32 rem, `wide` 40 rem (the M3 maximum of a basic dialog). */
  readonly width = input<'normal' | 'wide'>('normal');
  readonly visible = model(false);
  readonly headline = input.required<string>();
  /** The confirming action; `null` — no action (a sheet that only shows). */
  readonly confirmLabel = input<string | null>(null);
  readonly confirmSeverity = input<'primary' | 'danger'>('primary');
  /** The dismissing button; `null` — none (an acknowledgement). */
  readonly cancelLabel = input<string | null>(SHARED_T.common.cancel);
  readonly pending = input(false);
  readonly error = input<string | null>(null);
  /** `false` while a stage must not be interrupted (a restart): no ✕, Cancel, Esc or scrim. */
  readonly closable = input(true);
  /** The form has unsaved changes: closing it asks «Отменить изменения?». */
  readonly dirty = input(false);
  /** The `id` of the `<form>` in the content that the confirm button submits. */
  readonly formId = input<string>();

  /** The confirm button of a dialog without `formId`. */
  readonly confirm = output();
  /** The dialog went away (by any means). */
  readonly closed = output();

  protected readonly headerActions = contentChild(DialogHeaderActions);
  protected readonly customFooter = contentChild(DialogFooter);
  protected readonly discarding = signal(false);

  protected readonly mode = computed<'basic' | 'full' | 'sheet'>(() => {
    const compact = this.windowSize() === 'compact';
    switch (this.kind()) {
      case 'alert':
        return 'basic';
      case 'form':
        return compact ? 'full' : 'basic';
      case 'sheet':
        return compact ? 'sheet' : 'basic';
    }
  });

  /** ✕ stands in the full-screen form and in the sheet's dialog; an alert and a basic form have Cancel. */
  protected readonly closeInHeader = computed(
    () =>
      this.closable() &&
      (this.mode() === 'full' || (this.kind() === 'sheet' && this.mode() === 'basic')),
  );

  protected readonly dialogClass = computed(() => {
    const width = this.mode() === 'full' ? 'tb-d--full' : `tb-d--${this.width()}`;
    return `tb-d tb-d--${this.kind()} ${width}`;
  });

  constructor() {
    let wasVisible = false;
    effect(() => {
      const visible = this.visible();
      untracked(() => {
        this.discarding.set(false);
        if (wasVisible && !visible) {
          this.closed.emit();
        }
        wasVisible = visible;
      });
    });
    effect(() => {
      if (this.error() !== null) {
        afterNextRender(
          () => {
            this.document.getElementById(this.errorId)?.scrollIntoView({ block: 'nearest' });
          },
          { injector: this.injector },
        );
      }
    });
  }

  /** Esc closes the topmost dialog only, and never a stage that must not be interrupted. */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    const container = this.container();
    if (!this.visible() || container === null || container === undefined) {
      return;
    }
    const zIndex = container.style.zIndex || container.parentElement?.style.zIndex;
    if (Number.parseInt(zIndex ?? '') === ZIndexUtils.getCurrent()) {
      this.requestClose();
    }
  }

  /** The way out of the dialog: asks first when a form has changes. */
  requestClose(): void {
    if (!this.closable()) {
      return;
    }
    if (this.kind() === 'form' && this.dirty()) {
      if (this.mode() === 'full') {
        void this.injector
          .get(Confirm)
          .danger({
            header: SHARED_T.dialog.discardTitle,
            message: SHARED_T.dialog.discardText,
            acceptLabel: SHARED_T.dialog.discard,
          })
          .then((discard) => {
            if (discard) {
              this.close();
            }
          });
      } else {
        this.discarding.set(true);
      }
      return;
    }
    this.close();
  }

  /** Closes without asking. */
  close(): void {
    this.discarding.set(false);
    this.visible.set(false);
  }

  private container(): HTMLElement | null | undefined {
    return this.dialog()?.container() ?? this.drawer()?.container;
  }

  /** The focus: the first field of a form, the headline of the rest; the scrim of an alert and a sheet. */
  protected opened(): void {
    const container = this.container();
    if (container === null || container === undefined) {
      return;
    }
    this.focusReturn.remember(container);
    container.setAttribute('aria-modal', 'true');
    container.setAttribute('aria-labelledby', this.titleId);
    if (this.mode() === 'sheet') {
      container.setAttribute('role', 'dialog');
    }
    const field =
      this.kind() === 'form'
        ? (container.querySelector<HTMLElement>(`.tb-d__content :is(${TEXT_FIELD})`) ??
          container.querySelector<HTMLElement>(`.tb-d__content :is(${FOCUSABLE})`))
        : null;
    (field ?? container.querySelector<HTMLElement>(`#${this.titleId}`))?.focus();

    this.stopScrim?.();
    const scrim = this.dialog()?.wrapper ?? this.drawer()?.mask;
    if (this.kind() !== 'form' && scrim !== null && scrim !== undefined) {
      this.stopScrim = this.renderer.listen(scrim, 'mousedown', (event: Event) => {
        if (event.target === scrim) {
          this.requestClose();
        }
      });
    }
  }

  protected hidden(): void {
    this.stopScrim?.();
    this.stopScrim = null;
    this.focusReturn.restore(this.container());
  }
}
