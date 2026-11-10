import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { Snackbar } from '@core/snackbar/snackbar';
import { checkFiles } from '@shared/files/check-files';
import { SquarePhoto } from '@shared/files/square-photo';
import { Avatar } from '@shared/ui/avatar';
import { Busy } from '@shared/ui/busy';
import { IdentityApi } from '../data-access/identity-api';
import { Account } from '../data-access/identity.models';
import { T } from '../i18n/texts';

const AVATAR_POLICY = { extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] };

/**
 * The own photo as a tile (Мой аккаунт › Профиль and the first setup): the avatar, «Загрузить» / «Сменить»
 * and «Убрать фото». The picture is cut to a square and scaled down here, then saved at once; `changed`
 * gives the account back.
 */
@Component({
  selector: 'tb-profile-photo',
  imports: [Avatar, Button, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-tiles' },
  template: `
    <div class="tb-tile">
      <tb-avatar [name]="account().displayName" [photo]="account().avatar" size="2.5rem" />
      <span class="tb-tile__text">
        <b>{{ t.photo }}</b>
        <span>{{ account().avatar === null ? hint() || t.noPhoto : t.photoTypes }}</span>
      </span>
      <input
        #photoFile
        type="file"
        class="tb-sr-only"
        accept="image/jpeg,image/png,image/webp"
        [attr.aria-label]="t.photoFile"
        (change)="upload(photoFile)"
      />
      @if (account().avatar !== null) {
        <p-button
          icon="tb-i tb-i-delete"
          severity="danger"
          [text]="true"
          [rounded]="true"
          [pTooltip]="t.removePhoto"
          [ariaLabel]="t.removePhoto"
          [loading]="busy.is('remove-photo')"
          (onClick)="remove()"
        />
      }
      <p-button
        [label]="account().avatar === null ? t.uploadPhoto : t.changePhoto"
        icon="tb-i tb-i-photo_camera"
        severity="secondary"
        [loading]="busy.is('photo')"
        (onClick)="photoFile.click()"
      />
    </div>
  `,
})
export class ProfilePhoto {
  readonly account = input.required<Account>();
  /** Under «Фото» while there is none, instead of «Пока нет» (the first setup: «Можно позже»). */
  readonly hint = input('');
  readonly changed = output<Account>();

  protected readonly t = T.account;
  protected readonly busy = new Busy();
  private readonly api = inject(IdentityApi);
  private readonly squarePhoto = inject(SquarePhoto);
  private readonly snackbar = inject(Snackbar);

  async upload(input: HTMLInputElement): Promise<void> {
    const file = input.files?.item(0) ?? null;
    input.value = '';
    if (file === null) {
      return;
    }
    const { rejected } = await checkFiles([file], AVATAR_POLICY);
    if (rejected[0] !== undefined) {
      this.snackbar.error(rejected[0].message);
      return;
    }
    this.busy
      .guard(
        'photo',
        from(this.squarePhoto.from(file)).pipe(switchMap((photo) => this.api.changeAvatar(photo))),
      )
      .subscribe({
        next: (account) => {
          this.changed.emit(account);
          this.snackbar.success(T.account.photoSaved);
        },
        error: (error: unknown) => {
          // a failed request already shows its error; a picture the browser cannot open does not
          if (!(error instanceof HttpErrorResponse)) {
            this.snackbar.error(T.account.photoUnreadable);
          }
        },
      });
  }

  remove(): void {
    this.busy.guard('remove-photo', this.api.removeAvatar()).subscribe((account) => {
      this.changed.emit(account);
    });
  }
}
