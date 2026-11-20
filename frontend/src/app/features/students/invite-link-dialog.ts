import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { CopyField } from '@shared/ui/copy-field';
import { Portal } from '@core/portal/portal';
import { openedOnce } from '@shared/ui/dialog/opened-once';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { IssuedInvite } from '@features/identity/parts';
import { T } from './i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/** Shows an invitation link for the teacher to send to a student or a parent. */
@Component({
  selector: 'tb-invite-link-dialog',
  imports: [DatePipe, TbDialog, CopyField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (built()) {
      <tb-dialog kind="alert" [(visible)]="visible" [headline]="heading()" [cancelLabel]="c.close">
        @if (invite(); as invite) {
          <p>
            {{ explanation() }}
            {{ t.validUntil((invite.expiresAt | date: 'dd.MM.yyyy HH:mm') ?? '') }}
          </p>
          <div class="tb-field">
            <label for="invite-link">{{ t.link }}</label>
            <tb-copy-field
              inputId="invite-link"
              [value]="link()"
              [copyLabel]="t.copy"
              [copiedText]="t.copied"
            />
          </div>
        }
      </tb-dialog>
    }
  `,
})
export class InviteLinkDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.inviteLink;
  private readonly portal = inject(Portal);

  readonly visible = model(false);
  /** Built when first opened (`openedOnce`): hidden, its form is not built with the page. */
  protected readonly built = openedOnce(this.visible);
  readonly invite = input<IssuedInvite | null>(null);
  /** The name of whom the link is for: the student or a parent. */
  readonly studentName = input('');
  /** The link is a parent's (ADR-0069): the texts speak of the parent. */
  readonly forGuardian = input(false);

  protected readonly heading = computed(() =>
    this.forGuardian()
      ? T.inviteLink.headingGuardian(this.studentName())
      : T.inviteLink.heading(this.studentName()),
  );
  protected readonly explanation = computed(() => {
    const activation = this.invite()?.purpose === 'ACTIVATION';
    if (this.forGuardian()) {
      return activation ? this.t.activationGuardian : this.t.resetGuardian;
    }
    return activation ? this.t.activation : this.t.reset;
  });
  protected readonly link = computed(() => {
    const invite = this.invite();
    return invite === null ? '' : this.portal.link(`/invite/${invite.token}`);
  });
}
