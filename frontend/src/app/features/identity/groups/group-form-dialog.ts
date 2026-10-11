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
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, map, of, switchMap } from 'rxjs';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MultiSelect } from 'primeng/multiselect';
import { describeError } from '@core/http/error-messages';
import { BillingApi } from '@features/billing/parts';
import { RoomOwnerRef, RoomPanel } from '@features/meetings/parts';
import { toMajorUnits, toMinorUnits } from '@shared/money/money';
import { IdentityApi } from '../data-access/identity-api';
import { Student, StudentGroup } from '../data-access/identity.models';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { SubmitFor } from '@shared/ui/submit-for';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';
import { locale } from '@core/i18n/language';

/** A saved group with its lesson price (minor units). */
export interface SavedGroup {
  readonly group: StudentGroup;
  readonly lessonPrice: number | null;
}

/** Creates a group (when `group` is null) or edits one: name, members and lesson price. */
@Component({
  selector: 'tb-group-form-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    Dialog,
    InputNumber,
    InputText,
    Message,
    MultiSelect,
    FieldErrors,
    SubmitFor,
    RoomPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="title()"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog"
      [draggable]="false"
    >
      <form tbFieldErrors id="group-form" class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="tb-field">
          <label for="group-name">{{ t.name }}</label>
          <input
            pInputText
            id="group-name"
            formControlName="name"
            autocomplete="off"
            [placeholder]="t.namePlaceholder"
          />
        </div>
        <div class="tb-field">
          <label for="group-members">{{ t.members }}</label>
          <p-multiselect
            inputId="group-members"
            formControlName="memberIds"
            [options]="memberOptions()"
            optionLabel="displayName"
            optionValue="id"
            [placeholder]="t.membersPlaceholder"
            [filter]="true"
            [filterPlaceHolder]="t.search"
            [ariaFilterLabel]="t.search"
            display="chip"
            appendTo="body"
            [fluid]="true"
          />
        </div>
        <div class="tb-field">
          <label for="group-price">{{ t.price }}</label>
          <p-inputnumber
            inputId="group-price"
            formControlName="price"
            mode="currency"
            currencyDisplay="narrowSymbol"
            [currency]="currency()"
            [locale]="locale"
            [min]="0"
            [fluid]="true"
          />
          <small class="tb-hint">{{ t.priceHint }}</small>
        </div>
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      </form>
      <tb-room-panel [owner]="roomOwner()" />
      <ng-template #footer>
        <p-button
          [label]="c.cancel"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button
          severity="success"
          [label]="c.save"
          [loading]="pending()"
          type="submit"
          tbSubmitFor="group-form"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class GroupFormDialog {
  protected readonly locale = locale();
  protected readonly c = SHARED_T.common;
  protected readonly t = T.groupForm;
  private readonly api = inject(IdentityApi);
  private readonly billing = inject(BillingApi);

  readonly visible = model(false);
  /** Group to edit; `null` creates a new one. */
  readonly group = input<StudentGroup | null>(null);
  /** Students that can join (deactivated ones are skipped). */
  readonly students = input<readonly Student[]>([]);
  /** Current lesson price of the edited group, minor units. */
  readonly lessonPrice = input<number | null>(null);
  readonly currency = input('RUB');
  readonly saved = output<SavedGroup>();

  protected readonly title = computed(() =>
    this.group() === null ? T.groupForm.newGroup : T.groupForm.group,
  );
  /** The room is set up for a saved group that is not archived. */
  protected readonly roomOwner = computed<RoomOwnerRef | null>(() => {
    const group = this.group();
    if (group === null || !this.visible()) {
      return null;
    }
    return group.archivedAt === null ? { type: 'GROUP', id: group.id, name: group.name } : null;
  });
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  readonly memberOptions = computed(() => {
    const members = this.group()?.members ?? [];
    const current = this.students().filter((student) => student.status !== 'DEACTIVATED');
    const missing = members.filter(
      (member) => !current.some((student) => student.id === member.id),
    );
    return [...current, ...missing];
  });

  readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    memberIds: [[] as string[]],
    price: [null as number | null, [Validators.min(0)]],
  });

  constructor() {
    // Fill the form whenever the dialog opens.
    effect(() => {
      if (this.visible()) {
        const group = this.group();
        const price = this.lessonPrice();
        this.error.set(null);
        this.form.reset({
          name: group?.name ?? '',
          memberIds: group?.members.map((member) => member.id) ?? [],
          price: price === null ? null : toMajorUnits(price, this.currency()),
        });
      }
    });
  }

  save(): void {
    if (!revealErrors(this.form) || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    const input = { name: value.name, memberIds: value.memberIds };
    const group = this.group();
    const request =
      group === null
        ? this.api.createGroup(input)
        : this.api.updateGroup(group.id, input, group.version);
    this.pending.set(true);
    this.error.set(null);
    request.pipe(switchMap((saved) => this.savePrice(saved, value.price))).subscribe({
      next: (result) => {
        this.pending.set(false);
        this.visible.set(false);
        this.saved.emit(result);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, T.groupForm.failed));
      },
    });
  }

  private savePrice(group: StudentGroup, price: number | null): Observable<SavedGroup> {
    const minor = price === null ? null : toMinorUnits(price, this.currency());
    if (minor === null || minor === this.lessonPrice()) {
      return of({ group, lessonPrice: this.lessonPrice() });
    }
    return this.billing
      .changeGroupPrice(group.id, minor)
      .pipe(map((lessonPrice) => ({ group, lessonPrice })));
  }
}
