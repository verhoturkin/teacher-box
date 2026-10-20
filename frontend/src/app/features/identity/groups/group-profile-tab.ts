import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { StudentPriceCard } from '@features/billing/parts';
import { RoomOwnerRef, RoomPanel } from '@features/meetings/parts';
import { describeError } from '@core/http/error-messages';
import { LabelColor } from '@core/theme/label-colors';
import { SHARED_T } from '@shared/i18n/texts';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { LabelColorField } from '../colors/label-color-field';
import { IdentityApi } from '../data-access/identity-api';
import { StudentGroup } from '../data-access/identity.models';
import { T } from '../i18n/texts';
import { groupInput } from './group-input';

/** The group's own fields as the form holds them: empty strings for missing values. */
interface DetailsValue {
  readonly name: string;
  readonly defaultTopic: string;
  readonly color: LabelColor | null;
}

function valueOf(group: StudentGroup): DetailsValue {
  return { name: group.name, defaultTopic: group.defaultTopic ?? '', color: group.color };
}

function trimmed(value: DetailsValue): {
  name: string;
  defaultTopic: string | null;
  color: LabelColor | null;
} {
  const topic = value.defaultTopic.trim();
  return { name: value.name.trim(), defaultTopic: topic === '' ? null : topic, color: value.color };
}

/**
 * The Профиль tab of a group's card (redesign spec §8), changed in place as a student's: «Данные группы» (the
 * name, the default topic, the colour; the tonal «Сохранить» under the fields), the lesson price of each
 * member and the video meeting of the group.
 */
@Component({
  selector: 'tb-group-profile-tab',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    InputText,
    Message,
    FieldErrors,
    LabelColorField,
    RoomPanel,
    StudentPriceCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-group-profile">
      <p-card [header]="t.details">
        <form tbFieldErrors class="tb-form" [formGroup]="form" (ngSubmit)="save()">
          <div class="tb-field tb-field--required">
            <label for="group-profile-name">{{ f.name }}</label>
            <input
              pInputText
              id="group-profile-name"
              formControlName="name"
              autocomplete="off"
              aria-required="true"
            />
          </div>
          <div class="tb-field">
            <label for="group-profile-topic">{{ f.defaultTopic }}</label>
            <input
              pInputText
              id="group-profile-topic"
              formControlName="defaultTopic"
              autocomplete="off"
              aria-describedby="group-profile-topic-hint"
            />
            <small id="group-profile-topic-hint" class="tb-hint">{{ f.defaultTopicHint }}</small>
          </div>
          <tb-label-color-field inputId="group-profile-color" [control]="form.controls.color" />
          @if (error(); as message) {
            <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
          }
          <div class="tb-form-actions">
            @if (changed()) {
              <p-button
                [label]="c.cancel"
                severity="secondary"
                [text]="true"
                (onClick)="cancel()"
              />
            }
            <p-button
              type="submit"
              severity="secondary"
              [label]="c.save"
              icon="tb-i tb-i-check"
              [disabled]="!changed()"
              [loading]="pending()"
            />
          </div>
        </form>
      </p-card>

      <tb-student-price-card [groupId]="group().id" />

      <tb-room-panel [owner]="roomOwner()" />
    </div>
  `,
  styles: `
    .tb-group-profile {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
    }
  `,
})
export class GroupProfileTab {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.groupProfile;
  protected readonly f = T.groupForm;
  private readonly api = inject(IdentityApi);

  readonly group = input.required<StudentGroup>();
  /** The fields were saved: the page puts the group in its list. */
  readonly saved = output<StudentGroup>();

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    defaultTopic: ['', [Validators.maxLength(500)]],
    color: new FormControl<LabelColor | null>(null),
  });
  private readonly value = toSignal(this.form.valueChanges);
  /** The fields differ from the saved group. */
  protected readonly changed = computed(() => {
    this.value();
    const saved = trimmed(valueOf(this.group()));
    const typed = trimmed(this.form.getRawValue());
    return (
      saved.name !== typed.name ||
      saved.defaultTopic !== typed.defaultTopic ||
      saved.color !== typed.color
    );
  });
  /** The saved group the form shows: another group or a newer version fills it again. */
  private readonly shown = computed(() => `${this.group().id}:${String(this.group().version)}`);

  /** The room is set up for a group that is not archived. */
  protected readonly roomOwner = computed<RoomOwnerRef | null>(
    () => {
      const group = this.group();
      return group.archivedAt === null ? { type: 'GROUP', id: group.id, name: group.name } : null;
    },
    // a saved group is a new object of the same group: the panel keeps its room
    { equal: (a, b) => a?.id === b?.id && a?.name === b?.name },
  );

  constructor() {
    // untracked: the colour select reads its own signals when written
    effect(() => {
      this.shown();
      untracked(() => {
        this.cancel();
      });
    });
  }

  protected cancel(): void {
    this.error.set(null);
    this.form.reset(valueOf(this.group()));
  }

  protected save(): void {
    if (!revealErrors(this.form) || !this.changed() || this.pending()) {
      return;
    }
    const group = this.group();
    this.pending.set(true);
    this.error.set(null);
    this.api
      .updateGroup(group.id, groupInput(group, trimmed(this.form.getRawValue())), group.version)
      .subscribe({
        next: (saved) => {
          this.pending.set(false);
          this.saved.emit(saved);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, this.f.failed));
        },
      });
  }
}
