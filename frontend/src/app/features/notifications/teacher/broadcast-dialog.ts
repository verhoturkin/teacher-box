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
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import {
  MemberPicker,
  MemberSelection,
  StudentGroup,
  memberRecipients,
  IdentityApi,
} from '@features/identity/parts';
import { NotificationsApi } from '../data-access/notifications-api';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { SubmitFor } from '@shared/ui/submit-for';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

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
  imports: [
    ReactiveFormsModule,
    Button,
    Dialog,
    MemberPicker,
    InputText,
    Message,
    Textarea,
    FieldErrors,
    SubmitFor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="t.title"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog tb-dialog--wide"
      [draggable]="false"
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
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button
          [label]="c.cancel"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button
          [label]="t.send"
          icon="tb-i tb-i-send"
          [loading]="pending()"
          type="submit"
          tbSubmitFor="broadcast-form"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class BroadcastDialog {
  protected readonly c = SHARED_T.common;
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

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

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
        this.error.set(null);
        this.form.reset();
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
    if (!revealErrors(this.form) || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    const studentIds = this.recipientIds(
      memberRecipients(
        value.members,
        this.groups(),
        this.students().map((student) => student.id),
      ),
    );
    if (studentIds.length === 0 && (value.members.length > 0 || this.toGroup() !== null)) {
      this.error.set(T.broadcast.noRecipients);
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.api
      .broadcast({
        title: value.title.trim(),
        body: value.body.trim() === '' ? null : value.body.trim(),
        studentIds,
      })
      .subscribe({
        next: (recipients) => {
          this.pending.set(false);
          this.visible.set(false);
          this.sent.emit(recipients);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, T.broadcast.failed));
        },
      });
  }
}
