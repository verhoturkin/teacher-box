import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject, input, model, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Observable, map } from 'rxjs';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Confirm } from '@shared/ui/confirm';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { FieldErrors } from '@shared/ui/field-errors';
import { InputChip } from '@shared/ui/input-chip';
import { IdentityApi } from '../data-access/identity-api';
import { StudentTag, TagChanged, TagValueInput } from '../data-access/identity.models';
import { T } from '../i18n/texts';

/** A tag needs at least one value. */
function hasValues(control: AbstractControl<readonly TagValueInput[]>): ValidationErrors | null {
  return control.value.length > 0 ? null : { values: true };
}

/**
 * Creates or edits a tag (sketch Tags): the name, the values as chips that the teacher drags into order
 * and the «Учитывать в ИИ» switch; an existing tag can be deleted after a confirmation.
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
          <input
            pInputText
            id="tag-new-value"
            [attr.aria-label]="t.newValue"
            [placeholder]="t.newValue"
            autocomplete="off"
            maxlength="40"
            #draft
            (keydown.enter)="add(draft); $event.preventDefault()"
          />
          <small class="tb-field__hint">{{ t.newValueHint }}</small>
        </div>
        <label class="tb-tile tb-tag-ai" for="tag-use-in-ai">
          <i class="tb-i tb-i-auto_awesome tb-tile__icon tb-tag-ai__icon" aria-hidden="true"></i>
          <span class="tb-tile__text">
            <b>{{ t.useInAi }}</b>
            <span>{{ t.useInAiHint }}</span>
          </span>
          <p-toggleswitch inputId="tag-use-in-ai" formControlName="useInAi" />
        </label>
        @if (tag() !== null) {
          <p class="tb-tag-note">
            <i class="tb-i tb-i-info" aria-hidden="true"></i>{{ t.removeNote }}
          </p>
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

  readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    useInAi: [true],
    values: [[] as readonly TagValueInput[], hasValues],
  });
  protected readonly values = toSignal(this.form.controls.values.valueChanges, {
    initialValue: this.form.controls.values.value,
  });

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    form: this.form,
    failed: T.tags.failed,
    reset: () => {
      const tag = this.tag();
      this.form.reset({
        name: tag?.name ?? '',
        useInAi: tag?.useInAi ?? true,
        values: tag?.values.map((value) => ({ id: value.id, label: value.label })) ?? [],
      });
    },
    request: (value): Observable<TagChanged> => {
      const tag = this.tag();
      const name = value.name.trim();
      return tag === null
        ? this.api
            .createTag(
              name,
              value.useInAi,
              value.values.map((entry) => entry.label),
            )
            .pipe(map((created) => ({ tag: created, clearedStudents: 0 })))
        : this.api.updateTag(
            tag.id,
            { name, useInAi: value.useInAi, values: value.values },
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
