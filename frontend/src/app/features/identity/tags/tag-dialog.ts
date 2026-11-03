import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Observable, map } from 'rxjs';
import { quietContext } from '@core/http/api-error.interceptor';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Confirm } from '@shared/ui/confirm';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { FieldErrors } from '@shared/ui/field-errors';
import { InputChip } from '@shared/ui/input-chip';
import { IdentityApi } from '../data-access/identity-api';
import { StudentTag, TagChanged, TagKind, TagValueInput } from '../data-access/identity.models';
import { T } from '../i18n/texts';

/** A list tag needs at least one value (the control is disabled for a text tag). */
function hasValues(control: AbstractControl<readonly TagValueInput[]>): ValidationErrors | null {
  return control.value.length > 0 ? null : { values: true };
}

/**
 * Creates or edits a tag (sketch Tags): the name, the kind «Список значений / Свободный текст» (locked once
 * the tag is set on a student), the values of a list tag as chips that the teacher drags into order and the
 * «Учитывать в ИИ» switch; an existing tag can be deleted after a confirmation.
 */
@Component({
  selector: 'tb-tag-dialog',
  imports: [
    ReactiveFormsModule,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    Button,
    InputText,
    SelectButton,
    ToggleSwitch,
    TbDialog,
    FieldErrors,
    InputChip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="tag() === null ? t.newTag : t.editTag"
      [confirmLabel]="tag() === null ? t.create : t.save"
      formId="tag-form"
      [pending]="submit.pending()"
      [error]="submit.error()"
      [dirty]="submit.dirty()"
    >
      <form
        tbFieldErrors
        id="tag-form"
        class="tb-form"
        [formGroup]="form"
        (ngSubmit)="submit.run()"
      >
        <div class="tb-field">
          <label for="tag-name">{{ t.name }}</label>
          <input
            pInputText
            id="tag-name"
            formControlName="name"
            autocomplete="off"
            [placeholder]="t.namePlaceholder"
          />
          <small class="tb-field__hint">{{ t.nameHint }}</small>
        </div>
        <div class="tb-field tb-field__header">
          <span id="tag-kind-label">{{ t.kind }}</span>
          <p-selectbutton
            formControlName="kind"
            [options]="kinds"
            optionLabel="label"
            optionValue="value"
            [allowEmpty]="false"
            ariaLabelledBy="tag-kind-label"
          />
          <small class="tb-hint">{{ kindHint() }}</small>
        </div>
        @if (kind() === 'LIST') {
          <div class="tb-field">
            <span class="tb-section-label">{{ t.valuesLabel }}</span>
            <div
              class="tb-tag-values"
              cdkDropList
              cdkDropListOrientation="mixed"
              (cdkDropListDropped)="drop($event)"
            >
              @for (value of values(); track $index; let index = $index) {
                <tb-input-chip
                  cdkDrag
                  [label]="value.label"
                  [removeLabel]="t.removeValue(value.label)"
                  (removed)="remove(index)"
                >
                  <button
                    lead
                    type="button"
                    class="tb-tag-handle"
                    cdkDragHandle
                    [attr.aria-label]="t.dragValue(value.label)"
                    (keydown)="keyMove($event, index)"
                  >
                    <i class="tb-i tb-i-drag_indicator" aria-hidden="true"></i>
                  </button>
                </tb-input-chip>
              }
            </div>
            @if (form.controls.values.touched && form.controls.values.invalid) {
              <small class="tb-field__error" role="alert">{{ t.valuesRequired }}</small>
            }
          </div>
          <div class="tb-field">
            <label for="tag-new-value">{{ t.newValue }}</label>
            <input
              pInputText
              id="tag-new-value"
              autocomplete="off"
              maxlength="40"
              #draft
              (keydown.enter)="add(draft); $event.preventDefault()"
            />
            <small class="tb-field__hint">{{ t.newValueHint }}</small>
          </div>
        }
        <label class="tb-tile tb-tag-ai" for="tag-use-in-ai">
          <i class="tb-i tb-i-auto_awesome tb-tile__icon tb-tag-ai__icon" aria-hidden="true"></i>
          <span class="tb-tile__text">
            <b>{{ t.useInAi }}</b>
            <span>{{ t.useInAiHint }}</span>
          </span>
          <p-toggleswitch inputId="tag-use-in-ai" formControlName="useInAi" />
        </label>
        @if (tag() !== null && kind() === 'LIST') {
          <p class="tb-tag-note">
            <i class="tb-i tb-i-info" aria-hidden="true"></i>{{ t.removeNote }}
          </p>
        }
        @if (tag() !== null) {
          <p-button
            class="tb-tag-delete"
            severity="danger"
            [text]="true"
            [label]="t.delete"
            (onClick)="askDelete()"
          />
        }
      </form>
    </tb-dialog>
  `,
  styles: `
    .tb-tag-values {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }

    .tb-tag-handle {
      display: inline-flex;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--p-md-outline);
      font-size: 1.125rem;
      cursor: grab;
    }

    .tb-tag-ai {
      border-radius: var(--tb-shape-lg);
    }

    .tb-tag-ai__icon {
      background: var(--p-md-tertiary-container);
      color: var(--p-md-on-tertiary-container);
    }

    .tb-tag-note {
      display: flex;
      align-items: flex-start;
      gap: var(--tb-space-2);
      margin: 0;
      padding: var(--tb-space-3) var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
      font: var(--tb-type-body-m);
    }

    .tb-tag-delete {
      align-self: flex-start;
    }
  `,
})
export class TagDialog {
  protected readonly t = T.tags;
  private readonly api = inject(IdentityApi);
  private readonly confirm = inject(Confirm);

  readonly visible = model(false);
  /** The tag to edit; none — a new one. */
  readonly tag = input<StudentTag | null>(null);
  readonly saved = output<TagChanged>();
  readonly deleted = output<TagChanged>();

  protected readonly kinds: { value: TagKind; label: string }[] = [
    { value: 'LIST', label: this.t.kindList },
    { value: 'TEXT', label: this.t.kindText },
  ];
  /** The tag is set on a student: its kind cannot change (`tag.kind-used`). */
  private readonly used = signal(false);

  readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    kind: new FormControl<TagKind>('LIST', { nonNullable: true }),
    useInAi: [true],
    values: [[] as readonly TagValueInput[], hasValues],
  });
  protected readonly values = toSignal(this.form.controls.values.valueChanges, {
    initialValue: this.form.controls.values.value,
  });
  protected readonly kind = toSignal(this.form.controls.kind.valueChanges, {
    initialValue: this.form.controls.kind.value,
  });
  protected readonly kindHint = computed(() =>
    this.used()
      ? this.t.kindLocked
      : this.kind() === 'LIST'
        ? this.t.kindListHint
        : this.t.kindTextHint,
  );

  constructor() {
    this.form.controls.kind.valueChanges.subscribe((kind) => {
      const values = this.form.controls.values;
      if (kind === 'LIST') {
        values.enable({ emitEvent: false });
      } else {
        values.disable({ emitEvent: false });
      }
    });
  }

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    form: this.form,
    failed: T.tags.failed,
    reset: () => {
      const tag = this.tag();
      this.form.controls.kind.enable();
      this.used.set(false);
      this.form.reset({
        name: tag?.name ?? '',
        kind: tag?.kind ?? 'LIST',
        useInAi: tag?.useInAi ?? true,
        values: tag?.values.map((value) => ({ id: value.id, label: value.label })) ?? [],
      });
      if (tag !== null) {
        this.lockUsedKind(tag.id);
      }
    },
    request: (value): Observable<TagChanged> => {
      const tag = this.tag();
      const name = value.name.trim();
      const values = value.kind === 'LIST' ? value.values : [];
      return tag === null
        ? this.api
            .createTag(
              name,
              value.useInAi,
              values.map((entry) => entry.label),
              value.kind,
            )
            .pipe(map((created) => ({ tag: created, clearedStudents: 0 })))
        : this.api.updateTag(
            tag.id,
            { name, kind: value.kind, useInAi: value.useInAi, values },
            tag.version,
          );
    },
    done: (changed) => {
      this.saved.emit(changed);
    },
  });

  protected add(field: HTMLInputElement): void {
    const label = field.value.trim();
    const list = this.values();
    if (label !== '' && !list.some((v) => v.label.toLowerCase() === label.toLowerCase())) {
      this.setValues([...list, { label }]);
    }
    field.value = '';
  }

  protected remove(index: number): void {
    this.setValues(this.values().filter((_, at) => at !== index));
  }

  protected drop(event: CdkDragDrop<unknown>): void {
    this.move(event.previousIndex, event.currentIndex);
  }

  /** The arrow keys on a handle move the chip (the focus stays on the handle). */
  protected keyMove(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (step !== 0) {
      event.preventDefault();
      this.move(index, index + step);
    }
  }

  protected askDelete(): void {
    const tag = this.tag();
    if (tag === null) {
      return;
    }
    void this.confirm
      .danger({
        header: this.t.deleteTitle(tag.name),
        message: this.t.deleteText,
        acceptLabel: this.t.delete,
      })
      .then((accepted) => {
        if (accepted) {
          this.api.deleteTag(tag.id).subscribe(({ clearedStudents }) => {
            this.visible.set(false);
            this.deleted.emit({ tag, clearedStudents });
          });
        }
      });
  }

  /** Locks the kind once a student has the tag; a failed read leaves it to the server's `tag.kind-used`. */
  private lockUsedKind(tagId: string): void {
    this.api.listStudents(quietContext()).subscribe({
      next: (students) => {
        if (students.some((student) => student.tags[tagId] !== undefined)) {
          this.used.set(true);
          this.form.controls.kind.disable({ emitEvent: false });
        }
      },
      error: () => {
        // the switch stays open
      },
    });
  }

  private move(from: number, to: number): void {
    if (to < 0 || to >= this.values().length || from === to) {
      return;
    }
    const list = [...this.values()];
    moveItemInArray(list, from, to);
    this.setValues(list);
  }

  private setValues(list: readonly TagValueInput[]): void {
    const control = this.form.controls.values;
    control.setValue(list);
    control.markAsDirty();
    control.markAsTouched();
  }
}
