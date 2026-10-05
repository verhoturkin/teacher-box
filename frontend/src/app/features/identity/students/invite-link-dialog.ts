import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Portal } from '@core/portal/portal';
import { IssuedInvite } from '../data-access/identity.models';

/** Shows an invitation link for the teacher to send to a student. */
@Component({
  selector: 'tb-invite-link-dialog',
  imports: [DatePipe, Button, Dialog, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog tb-dialog--short"
      [draggable]="false"
      [focusOnShow]="false"
      (onShow)="onShow()"
    >
      <ng-template #header let-labelledBy="ariaLabelledBy">
        <span #title class="p-dialog-title" tabindex="-1" [id]="labelledBy">{{ heading() }}</span>
      </ng-template>
      @if (invite(); as invite) {
        <p>
          @if (invite.purpose === 'ACTIVATION') {
            Отправьте ученику эту ссылку — по ней он придумает логин и пароль.
          } @else {
            Отправьте ученику эту ссылку — по ней он задаст новый пароль.
          }
          Ссылка одноразовая и действует до {{ invite.expiresAt | date: 'dd.MM.yyyy HH:mm' }}.
        </p>
        <div class="tb-field">
          <label for="invite-link">Ссылка-приглашение</label>
          <input pInputText id="invite-link" readonly [value]="link()" />
        </div>
      }
      <ng-template #footer>
        <p-button
          label="Закрыть"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        @if (invite()) {
          <p-button
            [icon]="copied() ? 'pi pi-check' : 'pi pi-copy'"
            [label]="copied() ? 'Скопировано' : 'Копировать ссылку'"
            severity="success"
            (onClick)="copy()"
          />
        }
      </ng-template>
    </p-dialog>
  `,
})
export class InviteLinkDialog {
  private readonly clipboard = inject(Clipboard);
  private readonly portal = inject(Portal);

  readonly visible = model(false);
  readonly invite = input<IssuedInvite | null>(null);
  readonly studentName = input('');

  protected readonly copied = signal(false);
  private readonly title = viewChild<ElementRef<HTMLElement>>('title');
  protected readonly heading = computed(() => `Ссылка для ученика: ${this.studentName()}`);
  protected readonly link = computed(() => {
    const invite = this.invite();
    return invite === null ? '' : this.portal.link(`/invite/${invite.token}`);
  });

  /** A new link is not copied yet; the focus starts on the title, not on a button (ADR-0026). */
  protected onShow(): void {
    this.copied.set(false);
    this.title()?.nativeElement.focus();
  }

  protected copy(): void {
    this.copied.set(this.clipboard.copy(this.link()));
  }
}
