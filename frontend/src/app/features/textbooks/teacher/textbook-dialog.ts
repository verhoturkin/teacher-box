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
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MultiSelect } from 'primeng/multiselect';
import { SelectButton } from 'primeng/selectbutton';
import { describeError } from '@core/http/error-messages';
import { formatFileSize } from '@shared/files/file-size';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { SubmitFor } from '@shared/ui/submit-for';
import { TextbooksApi } from '../data-access/textbooks-api';
import { Textbook, TextbookInput, TextbookKind } from '../data-access/textbooks.models';
import {
  TEXTBOOK_FILES,
  TEXTBOOK_KIND_LABELS,
  TEXTBOOK_MAX_SIZE,
  isDocumentFile,
} from '../textbooks-labels';

/** A student or a group the teacher can share a textbook with. */
export interface MemberOption {
  readonly id: string;
  readonly name: string;
}

/**
 * Adds a textbook with its file (when `textbook` is null) or changes one: kind, title, course, pages of a Word
 * file, students and groups. The file of an existing textbook is replaced from the list.
 */
@Component({
  selector: 'tb-textbook-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    Dialog,
    InputNumber,
    InputText,
    Message,
    MultiSelect,
    SelectButton,
    FieldErrors,
    SubmitFor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="textbook() === null ? 'Новый учебник' : 'Изменить учебник'"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog"
      [draggable]="false"
    >
      <form tbFieldErrors id="textbook-form" class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        @if (textbook() === null) {
          <div class="tb-field tb-field--required">
            <span id="textbook-file-label">Файл</span>
            <input
              #picker
              type="file"
              class="tb-sr-only"
              [accept]="accept"
              aria-labelledby="textbook-file-label"
              (change)="onPicked(picker)"
            />
            <div class="tb-textbook-file">
              <p-button
                [label]="file() === null ? 'Выбрать файл' : 'Другой файл'"
                icon="pi pi-paperclip"
                severity="secondary"
                (onClick)="picker.click()"
              />
              @if (file(); as chosen) {
                <span class="tb-textbook-file__name">{{ chosen.name }}</span>
                <small class="tb-muted">{{ size(chosen.size) }}</small>
              }
            </div>
            <small class="tb-hint">PDF, Word (DOC, DOCX) или картинка — до 100 МБ.</small>
            @if (fileError(); as message) {
              <small class="tb-field__error" role="alert">{{ message }}</small>
            }
          </div>
        }
        <div class="tb-field tb-field__header">
          <span id="textbook-kind-label">Вид</span>
          <p-selectbutton
            formControlName="kind"
            [options]="kinds"
            optionLabel="label"
            optionValue="value"
            [allowEmpty]="false"
            ariaLabelledBy="textbook-kind-label"
          />
        </div>
        <div class="tb-field tb-field--required">
          <label for="textbook-title">Название</label>
          <input
            pInputText
            id="textbook-title"
            formControlName="title"
            placeholder="Например, Spotlight 5"
            autocomplete="off"
            aria-required="true"
          />
        </div>
        <div class="tb-field">
          <label for="textbook-course">Курс</label>
          <input
            pInputText
            id="textbook-course"
            formControlName="course"
            placeholder="Например, Английский, 5 класс"
            autocomplete="off"
            list="textbook-courses"
          />
          <datalist id="textbook-courses">
            @for (course of courses(); track course) {
              <option [value]="course"></option>
            }
          </datalist>
        </div>
        @if (document()) {
          <div class="tb-field">
            <label for="textbook-pages">Число страниц</label>
            <p-inputnumber
              inputId="textbook-pages"
              formControlName="pageCount"
              [min]="1"
              [max]="10000"
              [useGrouping]="false"
            />
            <small class="tb-hint">У PDF портал считает страницы сам, у Word — укажите.</small>
          </div>
        }
        <div class="tb-field">
          <label for="textbook-students">Ученики</label>
          <p-multiselect
            inputId="textbook-students"
            formControlName="studentIds"
            [options]="studentOptions()"
            optionLabel="name"
            optionValue="id"
            placeholder="Кому открыт учебник"
            [filter]="true"
            filterPlaceHolder="Поиск"
            ariaFilterLabel="Поиск"
            display="chip"
            appendTo="body"
            [fluid]="true"
          />
        </div>
        <div class="tb-field">
          <label for="textbook-groups">Группы</label>
          <p-multiselect
            inputId="textbook-groups"
            formControlName="groupIds"
            [options]="groupOptions()"
            optionLabel="name"
            optionValue="id"
            placeholder="Все ученики группы"
            [filter]="true"
            filterPlaceHolder="Поиск"
            ariaFilterLabel="Поиск"
            display="chip"
            appendTo="body"
            [fluid]="true"
          />
        </div>
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button
          label="Отмена"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button
          severity="success"
          [label]="textbook() === null ? 'Добавить' : 'Сохранить'"
          [loading]="pending()"
          type="submit"
          tbSubmitFor="textbook-form"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .tb-textbook-file {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-textbook-file__name {
      min-width: 0;
      overflow-wrap: anywhere;
    }
  `,
})
export class TextbookDialog {
  private readonly api = inject(TextbooksApi);

  readonly visible = model(false);
  /** The textbook to change; `null` adds a new one. */
  readonly textbook = input<Textbook | null>(null);
  /** Current students and active groups. */
  readonly students = input<readonly MemberOption[]>([]);
  readonly groups = input<readonly MemberOption[]>([]);
  /** Courses of the other textbooks, offered while typing. */
  readonly courses = input<readonly string[]>([]);
  readonly saved = output<Textbook>();

  protected readonly accept = TEXTBOOK_FILES;
  protected readonly kinds = (['TEXTBOOK', 'WORKBOOK', 'OTHER'] as const).map((value) => ({
    value,
    label: TEXTBOOK_KIND_LABELS[value],
  }));
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  readonly file = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);

  readonly form = inject(NonNullableFormBuilder).group({
    kind: new FormControl<TextbookKind>('TEXTBOOK', { nonNullable: true }),
    title: ['', [Validators.required, Validators.maxLength(200)]],
    course: ['', [Validators.maxLength(100)]],
    pageCount: new FormControl<number | null>(null, [Validators.min(1), Validators.max(10000)]),
    studentIds: [[] as string[]],
    groupIds: [[] as string[]],
  });

  /** A Word file: its pages are the teacher's number. */
  protected readonly document = computed(() => {
    const textbook = this.textbook();
    if (textbook !== null) return textbook.format === 'DOCUMENT';
    const file = this.file();
    return file !== null && isDocumentFile(file.name);
  });
  /** Members the textbook already has stay choosable even when they left. */
  readonly studentOptions = computed(() => this.withMembers(this.students(), 'STUDENT'));
  readonly groupOptions = computed(() => this.withMembers(this.groups(), 'GROUP'));

  constructor() {
    effect(() => {
      if (this.visible()) {
        const textbook = this.textbook();
        this.error.set(null);
        this.fileError.set(null);
        this.file.set(null);
        this.form.reset({
          kind: textbook?.kind ?? 'TEXTBOOK',
          title: textbook?.title ?? '',
          course: textbook?.course ?? '',
          pageCount: textbook?.format === 'DOCUMENT' ? textbook.pageCount : null,
          studentIds: textbook ? this.memberIds(textbook, 'STUDENT') : [],
          groupIds: textbook ? this.memberIds(textbook, 'GROUP') : [],
        });
      }
    });
  }

  protected onPicked(element: HTMLInputElement): void {
    const file = element.files?.[0] ?? null;
    element.value = '';
    if (file === null) {
      return;
    }
    this.file.set(file);
    this.fileError.set(
      file.size > TEXTBOOK_MAX_SIZE ? 'Файл больше 100 МБ — портал его не примет.' : null,
    );
    if (this.form.controls.title.value.trim() === '') {
      this.form.controls.title.setValue(file.name.replace(/\.[^.]+$/, ''));
    }
  }

  protected size(bytes: number): string {
    return formatFileSize(bytes);
  }

  save(): void {
    const textbook = this.textbook();
    const file = this.file();
    if (textbook === null && file === null) {
      this.fileError.set('Выберите файл.');
    }
    if (!revealErrors(this.form) || this.pending() || this.fileError() !== null) {
      return;
    }
    const value = this.form.getRawValue();
    const input: TextbookInput = {
      kind: value.kind,
      title: value.title.trim(),
      course: value.course.trim() === '' ? null : value.course.trim(),
      pageCount: this.document() ? value.pageCount : null,
      studentIds: value.studentIds,
      groupIds: value.groupIds,
    };
    let request = textbook === null ? null : this.api.change(textbook, input);
    if (request === null && file !== null) {
      request = this.api.create(input, file);
    }
    if (request === null) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    request.subscribe({
      next: (saved) => {
        this.pending.set(false);
        this.visible.set(false);
        this.saved.emit(saved);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, 'Не удалось сохранить. Попробуйте позже'));
      },
    });
  }

  private memberIds(textbook: Textbook, type: 'STUDENT' | 'GROUP'): string[] {
    return textbook.members.filter((member) => member.type === type).map((member) => member.id);
  }

  private withMembers(options: readonly MemberOption[], type: 'STUDENT' | 'GROUP'): MemberOption[] {
    const missing = (this.textbook()?.members ?? [])
      .filter(
        (member) => member.type === type && !options.some((option) => option.id === member.id),
      )
      .map((member) => ({ id: member.id, name: member.name ?? 'Нет в списке' }));
    return [...options, ...missing];
  }
}
