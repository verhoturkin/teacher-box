import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import {
  MemberPicker,
  MemberSelection,
  StudentGroup,
  memberRecipients,
  IdentityApi,
} from '@features/identity/parts';
import { NotificationsApi } from '../data-access/notifications-api';
import { FieldErrors } from '@shared/ui/field-errors';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { T } from '../i18n/texts';

/** A student the teacher can write to. */
export interface Recipient {
  readonly id: string;
  readonly displayName: string;
}

/** A group the teacher writes to from its card: every member of it. */
export interface RecipientGroup {
  readonly name: string;
  readonly members: readonly Recipient[];
}

/** The teacher writes a message to chosen students or to everybody. */
@Component({
  selector: 'tb-broadcast-dialog',
  imports: [ReactiveFormsModule, MemberPicker, InputText, Textarea, FieldErrors, TbDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      width="wide"
      [(visible)]="visible"
      [headline]="t.title"
      [confirmLabel]="t.send"
      formId="broadcast-form"
      [pending]="submit.pending()"
      [error]="localError() ?? submit.error()"
      [dirty]="submit.dirty()"
    >
      <form
        tbFieldErrors
        id="broadcast-form"
        class="tb-form"
        [formGroup]="form"
        (ngSubmit)="send()"
      >
        @if (to(); as recipient) {
          <!-- the student's card writes to that student only -->
          <div class="tb-field">
            <label for="broadcast-to">{{ t.to }}</label>
            <input pInputText id="broadcast-to" [value]="recipient.displayName" readonly />
          </div>
        } @else if (toGroup(); as group) {
          <!-- the group's card writes to its members -->
          <div class="tb-field">
            <label for="broadcast-to">{{ t.to }}</label>
            <input
              pInputText
              id="broadcast-to"
              [value]="t.group(group.name)"
              readonly
              aria-describedby="broadcast-to-hint"
            />
            <small id="broadcast-to-hint" class="tb-hint">{{ memberNames() }}</small>
          </div>
        } @else {
          <div class="tb-field">
            <label for="broadcast-students">{{ t.to }}</label>
            <tb-member-picker
              inputId="broadcast-students"
              formControlName="members"
              [students]="studentOptions()"
              [groups]="groups()"
              [placeholder]="t.everyone"
            />
            <small class="tb-hint">{{ t.hint }}</small>
          </div>
        }
        <div class="tb-field">
          <label for="broadcast-title">{{ t.subject }}</label>
          <input pInputText id="broadcast-title" formControlName="title" autocomplete="off" />
        </div>
        <div class="tb-field">
          <label for="broadcast-body">{{ t.text }}</label>
          <textarea pTextarea id="broadcast-body" formControlName="body" rows="6"></textarea>
        </div>
      </form>
    </tb-dialog>
  `,
})
export class BroadcastDialog {
  protected readonly t = T.broadcast;
  private readonly api = inject(NotificationsApi);

  private readonly identity = inject(IdentityApi);
  protected readonly groups = signal<StudentGroup[]>([]);
  protected readonly studentOptions = computed(() =>
    this.students().map((student) => ({ id: student.id, name: student.displayName })),
  );
  readonly visible = model(false);
  readonly students = input<Recipient[]>([]);
  /** The one student to write to (their card): no choice of recipients. */
  readonly to = input<Recipient | null>(null);
  /** The group to write to (its card): its members, no choice of recipients. */
  readonly toGroup = input<RecipientGroup | null>(null);
  /** Emits the number of recipients. */
  readonly sent = output<number>();

  /** Chosen groups without members: the check that the server does not do. */
  protected readonly localError = signal<string | null>(null);

  readonly form = new FormGroup({
    members: new FormControl<MemberSelection[]>([], { nonNullable: true }),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(300)],
    }),
    body: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(4000)] }),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.localError.set(null);
        if (this.to() === null && this.toGroup() === null) {
          this.identity.listGroups().subscribe((groups) => {
            this.groups.set(groups.filter((group) => group.archivedAt === null));
          });
        }
      }
    });
  }

  protected readonly memberNames = computed(() =>
    (this.toGroup()?.members ?? []).map((member) => member.displayName).join(', '),
  );

  /** The chosen students, or those of the card (an empty list would mean everybody). */
  private recipientIds(chosen: string[]): string[] {
    const to = this.to();
    const group = this.toGroup();
    if (to !== null) {
      return [to.id];
    }
    return group === null ? chosen : group.members.map((member) => member.id);
  }

  send(): void {
    this.localError.set(null);
    if (this.recipients().length === 0 && this.hasChosen()) {
      this.localError.set(T.broadcast.noRecipients);
      return;
    }
    this.submit.run();
  }

  private hasChosen(): boolean {
    return this.form.getRawValue().members.length > 0 || this.toGroup() !== null;
  }

  private recipients(): string[] {
    return this.recipientIds(
      memberRecipients(
        this.form.getRawValue().members,
        this.groups(),
        this.students().map((student) => student.id),
      ),
    );
  }

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    form: this.form,
    failed: T.broadcast.failed,
    request: (value) =>
      this.api.broadcast({
        title: value.title.trim(),
        body: value.body.trim() === '' ? null : value.body.trim(),
        studentIds: this.recipients(),
      }),
    done: (recipients) => {
      this.sent.emit(recipients);
    },
  });
}
