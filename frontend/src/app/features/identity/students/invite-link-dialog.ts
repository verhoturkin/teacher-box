import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { InputText } from 'primeng/inputtext';
import { Portal } from '@core/portal/portal';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { IssuedInvite } from '../data-access/identity.models';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/** Shows an invitation link for the teacher to send to a student. */
@Component({
  selector: 'tb-invite-link-dialog',
  imports: [DatePipe, TbDialog, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="alert"
      [(visible)]="visible"
      [headline]="heading()"
      [cancelLabel]="c.close"
      [confirmLabel]="invite() ? (copied() ? t.copied : t.copy) : null"
      (confirm)="copy()"
    >
      @if (invite(); as invite) {
        <p>
          {{ invite.purpose === 'ACTIVATION' ? t.activation : t.reset }}
          {{ t.validUntil((invite.expiresAt | date: 'dd.MM.yyyy HH:mm') ?? '') }}
        </p>
        <div class="tb-field">
          <label for="invite-link">{{ t.link }}</label>
          <input pInputText id="invite-link" readonly [value]="link()" />
        </div>
      }
    </tb-dialog>
  `,
})
export class InviteLinkDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.inviteLink;
  private readonly clipboard = inject(Clipboard);
  private readonly portal = inject(Portal);

  readonly visible = model(false);
  readonly invite = input<IssuedInvite | null>(null);
  readonly studentName = input('');

  protected readonly copied = signal(false);
  protected readonly heading = computed(() => T.inviteLink.heading(this.studentName()));
  protected readonly link = computed(() => {
    const invite = this.invite();
    return invite === null ? '' : this.portal.link(`/invite/${invite.token}`);
  });

  constructor() {
    // a new link is not copied yet
    effect(() => {
      if (this.visible()) {
        untracked(() => {
          this.copied.set(false);
        });
      }
    });
  }

  protected copy(): void {
    this.copied.set(this.clipboard.copy(this.link()));
  }
}
