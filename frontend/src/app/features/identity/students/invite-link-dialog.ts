import { Clipboard } from '@angular/cdk/clipboard';
import { DOCUMENT, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { IssuedInvite } from '../data-access/identity.models';

/** Shows an invitation link for the teacher to send to a student. */
@Component({
  selector: 'tb-invite-link-dialog',
  imports: [DatePipe, Button, Dialog, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="header()"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '36rem' }"
      [draggable]="false"
      (onShow)="copied.set(false)"
    >
      @if (invite(); as invite) {
        <p>
          @if (invite.purpose === 'ACTIVATION') {
            Отправьте ученику эту ссылку — по ней он придумает логин и пароль.
          } @else {
            Отправьте ученику эту ссылку — по ней он задаст новый пароль.
          }
          Ссылка одноразовая и действует до {{ invite.expiresAt | date: 'dd.MM.yyyy HH:mm' }}.
        </p>
        <div class="tb-copy-row">
          <input pInputText readonly [value]="link()" aria-label="Ссылка-приглашение" class="tb-grow" />
          <p-button
            [icon]="copied() ? 'pi pi-check' : 'pi pi-copy'"
            [label]="copied() ? 'Скопировано' : 'Копировать'"
            (onClick)="copy()"
          />
        </div>
      }
    </p-dialog>
  `,
})
export class InviteLinkDialog {
  private readonly clipboard = inject(Clipboard);
  private readonly origin = inject(DOCUMENT).location.origin;

  readonly visible = model(false);
  readonly invite = input<IssuedInvite | null>(null);
  readonly studentName = input('');

  protected readonly copied = signal(false);
  protected readonly header = computed(() => `Ссылка для ученика: ${this.studentName()}`);
  protected readonly link = computed(() => {
    const invite = this.invite();
    return invite === null ? '' : `${this.origin}/invite/${invite.token}`;
  });

  protected copy(): void {
    this.copied.set(this.clipboard.copy(this.link()));
  }
}
