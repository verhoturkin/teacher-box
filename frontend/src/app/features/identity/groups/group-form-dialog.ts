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
import { toMajorUnits, toMinorUnits } from '@shared/money/money';
import { IdentityApi } from '../data-access/identity-api';
import { Student, StudentGroup } from '../data-access/identity.models';

/** A saved group with its lesson price (minor units). */
export interface SavedGroup {
  readonly group: StudentGroup;
  readonly lessonPrice: number | null;
}

/** Creates a group (when `group` is null) or edits one: name, members and lesson price. */
@Component({
  selector: 'tb-group-form-dialog',
  imports: [ReactiveFormsModule, Button, Dialog, InputNumber, InputText, Message, MultiSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [header]="title()" [(visible)]="visible" [modal]="true" [style]="{ width: '34rem' }" [draggable]="false">
      <form class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="tb-field">
          <label for="group-name">Название</label>
          <input pInputText id="group-name" formControlName="name" autocomplete="off" placeholder="Например, ОГЭ 9 класс" />
        </div>
        <div class="tb-field">
          <label for="group-members">Ученики</label>
          <p-multiselect
            inputId="group-members"
            formControlName="memberIds"
            [options]="memberOptions()"
            optionLabel="displayName"
            optionValue="id"
            placeholder="Кто занимается в группе"
            [filter]="true"
            display="chip"
            appendTo="body"
            [fluid]="true"
          />
        </div>
        <div class="tb-field">
          <label for="group-price">Цена занятия для каждого ученика</label>
          <p-inputnumber
            inputId="group-price"
            formControlName="price"
            mode="currency"
            [currency]="currency()"
            locale="ru-RU"
            [min]="0"
            [fluid]="true"
          />
          <small class="tb-hint">Спишется с каждого, кто был на занятии или пропустил его без предупреждения.</small>
        </div>
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Отмена" severity="secondary" [text]="true" (onClick)="visible.set(false)" />
        <p-button label="Сохранить" [loading]="pending()" [disabled]="form.invalid" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
})
export class GroupFormDialog {
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

  protected readonly title = computed(() => (this.group() === null ? 'Новая группа' : 'Группа'));
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  readonly memberOptions = computed(() => {
    const members = this.group()?.members ?? [];
    const current = this.students().filter((student) => student.status !== 'DEACTIVATED');
    const missing = members.filter((member) => !current.some((student) => student.id === member.id));
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
    if (this.form.invalid || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    const input = { name: value.name, memberIds: value.memberIds };
    const group = this.group();
    const request =
      group === null ? this.api.createGroup(input) : this.api.updateGroup(group.id, input, group.version);
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
        this.error.set(describeError(error, 'Не удалось сохранить. Попробуйте позже'));
      },
    });
  }

  private savePrice(group: StudentGroup, price: number | null): Observable<SavedGroup> {
    const minor = price === null ? null : toMinorUnits(price, this.currency());
    if (minor === null || minor === this.lessonPrice()) {
      return of({ group, lessonPrice: this.lessonPrice() });
    }
    return this.billing.changeGroupPrice(group.id, minor).pipe(map((lessonPrice) => ({ group, lessonPrice })));
  }
}
