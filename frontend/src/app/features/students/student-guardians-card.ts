import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Tooltip } from 'primeng/tooltip';
import { PaymentsVisibilitySwitch } from '@features/billing/parts';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { Avatar } from '@shared/ui/avatar';
import { Busy } from '@shared/ui/busy';
import { Confirm } from '@shared/ui/confirm';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { openedOnce } from '@shared/ui/dialog/opened-once';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { ListRow } from '@shared/ui/list-row';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { Guardian, IdentityApi, IssuedInvite, Student } from '@features/identity/parts';
import { InviteLinkDialog } from './invite-link-dialog';
import { T } from './i18n/texts';

/** A student has at most two parents (ADR-0069). */
const MAX_GUARDIANS = 2;

type InviteKind = 'NEW' | 'EXISTING';

/**
 * «Родители» on the Профиль tab of a student's card (ADR-0069): a segmented list of up to two parents with their
 * state (invited until…, signs in as…), «Новое приглашение» / «Сбросить пароль» and «Отвязать» at the end of a
 * row; «Пригласить родителя» opens a dialog — a new parent by name (then the link to send) or a parent already
 * on the portal (a sibling's, no link); «Оплаты видит только родитель» under the list while a parent is linked.
 */
@Component({
  selector: 'tb-student-guardians-card',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    Avatar,
    Button,
    Card,
    FieldErrors,
    InputText,
    InviteLinkDialog,
    ListRow,
    LoadStateView,
    PaymentsVisibilitySwitch,
    Select,
    SelectButton,
    TbDialog,
    Tooltip,
  ],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let row = student();
    <p-card [header]="t.title">
      <div class="tb-guardians">
        <p class="tb-muted">{{ t.hint }}</p>
        <tb-load-state [state]="state" [what]="t.what" [compact]="true" (retry)="load()">
          @if (guardians().length === 0) {
            <p class="tb-guardians__empty">{{ t.empty }}</p>
          } @else {
            <ul class="tb-list" [attr.aria-label]="t.list">
              @for (guardian of guardians(); track guardian.id) {
                <li tbListRow>
                  <span class="tb-list__lead"><tb-avatar [name]="guardian.displayName" /></span>
                  <div class="tb-list__text">
                    <span class="tb-list__title">{{ guardian.displayName }}</span>
                    <span class="tb-list__supporting">{{ stateOf(guardian) }}</span>
                  </div>
                  <div class="tb-list__trail tb-list__trail--icons">
                    @if (guardian.status !== 'DEACTIVATED') {
                      <p-button
                        icon="tb-i tb-i-link"
                        [text]="true"
                        [rounded]="true"
                        severity="secondary"
                        [pTooltip]="linkLabel(guardian)"
                        [ariaLabel]="linkLabel(guardian) + ': ' + guardian.displayName"
                        [loading]="busy.is('invite-' + guardian.id)"
                        (onClick)="reissue(guardian)"
                      />
                    }
                    <p-button
                      icon="tb-i tb-i-link_off"
                      [text]="true"
                      [rounded]="true"
                      severity="secondary"
                      [pTooltip]="t.unlink"
                      [ariaLabel]="t.unlink + ': ' + guardian.displayName"
                      [loading]="busy.is('unlink-' + guardian.id)"
                      (onClick)="unlink(guardian)"
                    />
                  </div>
                </li>
              }
            </ul>
          }
          @if (canInvite()) {
            <div class="tb-guardians__actions">
              <p-button
                [label]="t.invite"
                icon="tb-i tb-i-person_add"
                severity="secondary"
                (onClick)="openDialog()"
              />
            </div>
          }
        </tb-load-state>
        @if (state.ready()) {
          <tb-payments-visibility-switch [studentId]="row.id" [guardians]="guardians().length" />
        }
      </div>
    </p-card>

    @if (dialogBuilt()) {
      <tb-dialog
        kind="form"
        [(visible)]="dialog"
        [headline]="t.dialog"
        [confirmLabel]="kind() === 'NEW' ? t.send : t.link"
        formId="guardian-form"
        [pending]="busy.is('save')"
        [error]="error()"
        [dirty]="form.dirty"
      >
        <form
          tbFieldErrors
          id="guardian-form"
          class="tb-form"
          [formGroup]="form"
          (ngSubmit)="save()"
        >
          @if (candidates().length > 0) {
            <div class="tb-field">
              <span id="guardian-kind-label">{{ t.kind }}</span>
              <p-selectbutton
                [options]="kinds"
                optionLabel="label"
                optionValue="value"
                [allowEmpty]="false"
                ariaLabelledBy="guardian-kind-label"
                [ngModel]="kind()"
                [ngModelOptions]="{ standalone: true }"
                (ngModelChange)="kind.set($event)"
              />
            </div>
          }
          @if (kind() === 'NEW') {
            <div class="tb-field tb-field--required">
              <label for="guardian-name">{{ t.name }}</label>
              <input
                pInputText
                id="guardian-name"
                formControlName="displayName"
                autocomplete="off"
                placeholder=" "
                aria-required="true"
                aria-describedby="guardian-name-hint"
              />
              <small id="guardian-name-hint" class="tb-hint">{{ t.nameHint }}</small>
            </div>
          } @else {
            <div class="tb-field tb-field--required">
              <label for="guardian-existing">{{ t.existing }}</label>
              <p-select
                inputId="guardian-existing"
                formControlName="guardianId"
                [options]="candidates()"
                optionLabel="displayName"
                optionValue="id"
                appendTo="body"
                [fluid]="true"
                ariaLabelledBy="guardian-existing"
              />
              <small class="tb-hint">{{ t.existingHint }}</small>
            </div>
          }
        </form>
      </tb-dialog>
    }

    <tb-invite-link-dialog
      [(visible)]="inviteVisible"
      [invite]="invite()"
      [studentName]="inviteName()"
      [forGuardian]="true"
    />
  `,
  styles: `
    .tb-guardians {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
    }

    p {
      margin: 0;
    }

    .tb-guardians__empty {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-l);
    }

    .tb-guardians__actions {
      display: flex;
    }

    .tb-guardians tb-load-state {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
    }
  `,
})
export class StudentGuardiansCard {
  protected readonly t = T.guardians;
  protected readonly s = T.students;
  private readonly api = inject(IdentityApi);
  private readonly snackbar = inject(Snackbar);
  private readonly confirm = inject(Confirm);
  private readonly date = inject(DatePipe);

  readonly student = input.required<Student>();

  /** A newer version of the same student keeps the list; another student reads theirs. */
  private readonly studentId = computed(() => this.student().id);
  protected readonly state = new LoadState();
  protected readonly busy = new Busy();
  protected readonly guardians = signal<readonly Guardian[]>([]);
  /** Every parent of the portal not linked to this student: «Уже в портале» picks one of them. */
  private readonly everyone = signal<readonly Guardian[]>([]);
  protected readonly candidates = computed(() => {
    const linked = new Set(this.guardians().map((guardian) => guardian.id));
    return this.everyone().filter((guardian) => !linked.has(guardian.id));
  });
  protected readonly canInvite = computed(
    () => this.student().status !== 'DEACTIVATED' && this.guardians().length < MAX_GUARDIANS,
  );

  protected readonly dialog = signal(false);
  /** Built when first opened (`openedOnce`), not with the card. */
  protected readonly dialogBuilt = openedOnce(this.dialog);
  protected readonly kind = signal<InviteKind>('NEW');
  protected readonly kinds: { value: InviteKind; label: string }[] = [
    { value: 'NEW', label: T.guardians.kindNew },
    { value: 'EXISTING', label: T.guardians.kindExisting },
  ];
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    displayName: ['', [Validators.required, Validators.maxLength(100)]],
    guardianId: ['', [Validators.required]],
  });

  protected readonly inviteVisible = signal(false);
  protected readonly invite = signal<IssuedInvite | null>(null);
  protected readonly inviteName = signal('');

  constructor() {
    effect(() => {
      const id = this.studentId();
      untracked(() => {
        this.load(id);
      });
    });
  }

  protected load(studentId = this.student().id): void {
    this.api
      .guardians(studentId)
      .pipe(this.state.track())
      .subscribe((guardians) => {
        this.guardians.set(guardians);
      });
  }

  /** «Приглашение до …», «Входит как …»: what the teacher may need to do about the parent. */
  protected stateOf(guardian: Guardian): string {
    if (guardian.status === 'DEACTIVATED') {
      return this.t.deactivated;
    }
    const invite = guardian.pendingInvite;
    const until =
      invite === null ? '' : (this.date.transform(invite.expiresAt, 'dd.MM.yyyy') ?? '');
    if (guardian.status === 'INVITED') {
      return invite === null ? this.t.invitedNoLink : this.t.invited(until);
    }
    if (invite !== null) {
      return this.t.resetting(until);
    }
    return this.t.active(guardian.login ?? '');
  }

  protected linkLabel(guardian: Guardian): string {
    return guardian.status === 'ACTIVE' ? this.s.resetPassword : this.s.newInvite;
  }

  protected openDialog(): void {
    this.kind.set('NEW');
    this.error.set(null);
    this.form.reset();
    this.api.allGuardians().subscribe({
      next: (guardians) => {
        this.everyone.set(guardians);
      },
      error: () => {
        this.everyone.set([]);
      },
    });
    this.dialog.set(true);
  }

  protected save(): void {
    const control =
      this.kind() === 'NEW' ? this.form.controls.displayName : this.form.controls.guardianId;
    if (!revealErrors(control)) {
      return;
    }
    const studentId = this.student().id;
    this.error.set(null);
    if (this.kind() === 'NEW') {
      this.busy.guard('save', this.api.createGuardian(studentId, control.value.trim())).subscribe({
        next: (created) => {
          this.added(created.guardian);
          this.showInvite(created.guardian, created.invite);
        },
        error: (error: unknown) => {
          this.error.set(describeError(error, this.t.failed));
        },
      });
      return;
    }
    this.busy.guard('save', this.api.linkGuardian(studentId, control.value)).subscribe({
      next: (guardian) => {
        this.added(guardian);
        this.snackbar.success(this.t.linked);
      },
      error: (error: unknown) => {
        this.error.set(describeError(error, this.t.failed));
      },
    });
  }

  protected reissue(guardian: Guardian): void {
    this.busy
      .guard(
        'invite-' + guardian.id,
        this.api.reissueGuardianInvite(this.student().id, guardian.id),
      )
      .subscribe((invite) => {
        this.replace({
          ...guardian,
          pendingInvite: { purpose: invite.purpose, expiresAt: invite.expiresAt },
        });
        this.showInvite(guardian, invite);
      });
  }

  protected async unlink(guardian: Guardian): Promise<void> {
    const student = this.student();
    if (
      await this.confirm.danger({
        header: this.t.unlinkHeader,
        message: this.t.unlinkMessage(guardian.displayName, student.displayName),
        acceptLabel: this.t.unlink,
      })
    ) {
      this.busy
        .guard('unlink-' + guardian.id, this.api.unlinkGuardian(student.id, guardian.id))
        .subscribe(() => {
          this.guardians.update((list) => list.filter((other) => other.id !== guardian.id));
          this.snackbar.success(this.t.unlinked);
        });
    }
  }

  private added(guardian: Guardian): void {
    this.dialog.set(false);
    this.guardians.update((list) => [
      ...list.filter((other) => other.id !== guardian.id),
      guardian,
    ]);
  }

  private replace(guardian: Guardian): void {
    this.guardians.update((list) =>
      list.map((other) => (other.id === guardian.id ? guardian : other)),
    );
  }

  private showInvite(guardian: Guardian, invite: IssuedInvite): void {
    this.inviteName.set(guardian.displayName);
    this.invite.set(invite);
    this.inviteVisible.set(true);
  }
}
