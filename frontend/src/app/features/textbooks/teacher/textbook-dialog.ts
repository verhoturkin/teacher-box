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
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { throwError } from 'rxjs';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { MemberPicker, MemberSelection } from '@features/identity/parts';
import { SelectButton } from 'primeng/selectbutton';
import { checkFiles } from '@shared/files/check-files';
import { formatFileSize } from '@shared/files/file-size';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { TextbooksApi } from '../data-access/textbooks-api';
import { Textbook, TextbookInput, TextbookKind } from '../data-access/textbooks.models';
import {
  TEXTBOOK_FILES,
  TEXTBOOK_KIND_LABELS,
  TEXTBOOK_POLICY,
  isDocumentFile,
} from '../textbooks-labels';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

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
    TbDialog,
    InputNumber,
    InputText,
    MemberPicker,
    SelectButton,
    FieldErrors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="textbook() === null ? t.newTextbook : t.editTextbook"
      [confirmLabel]="textbook() === null ? t.add : c.save"
      formId="textbook-form"
      [pending]="submit.pending()"
      [error]="submit.error()"
      [dirty]="submit.dirty() || file() !== null"
    >
      <form tbFieldErrors id="textbook-form" class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        @if (textbook() === null) {
          <div class="tb-field tb-field--required">
            <span id="textbook-file-label">{{ t.file }}</span>
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
                [label]="file() === null ? t.chooseFile : t.otherFile"
                icon="tb-i tb-i-attach_file"
                severity="secondary"
                (onClick)="picker.click()"
              />
              @if (file(); as chosen) {
                <span class="tb-textbook-file__name">{{ chosen.name }}</span>
                <small class="tb-muted">{{ size(chosen.size) }}</small>
              }
            </div>
            <small class="tb-hint">{{ t.fileHint }}</small>
            @if (fileError(); as message) {
              <small class="tb-field__error" role="alert">{{ message }}</small>
            }
          </div>
        }
        <div class="tb-field tb-field__header">
          <span id="textbook-kind-label">{{ t.kind }}</span>
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
          <label for="textbook-title">{{ t.title }}</label>
          <input
            pInputText
            id="textbook-title"
            formControlName="title"
            [placeholder]="t.titlePlaceholder"
            autocomplete="off"
            aria-required="true"
          />
        </div>
        <div class="tb-field">
          <label for="textbook-course">{{ t.course }}</label>
          <input
            pInputText
            id="textbook-course"
            formControlName="course"
            [placeholder]="t.coursePlaceholder"
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
            <label for="textbook-pages">{{ t.pageCount }}</label>
            <p-inputnumber
              inputId="textbook-pages"
              formControlName="pageCount"
              [min]="1"
              [max]="10000"
              [useGrouping]="false"
            />
            <small class="tb-hint">{{ t.pageCountHint }}</small>
          </div>
        }
        <div class="tb-field">
          <label for="textbook-members">{{ t.members }}</label>
          <tb-member-picker
            inputId="textbook-members"
            formControlName="members"
            [students]="studentOptions()"
            [groups]="groupOptions()"
          />
        </div>
      </form>
    </tb-dialog>
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
  protected readonly c = SHARED_T.common;
  protected readonly t = T.dialog;
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
  readonly file = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);

  readonly form = inject(NonNullableFormBuilder).group({
    kind: new FormControl<TextbookKind>('TEXTBOOK', { nonNullable: true }),
    title: ['', [Validators.required, Validators.maxLength(200)]],
    course: ['', [Validators.maxLength(100)]],
    pageCount: new FormControl<number | null>(null, [Validators.min(1), Validators.max(10000)]),
    members: [[] as MemberSelection[]],
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

  protected async onPicked(element: HTMLInputElement): Promise<void> {
    const file = element.files?.[0] ?? null;
    element.value = '';
    if (file === null) {
      return;
    }
    const { rejected } = await checkFiles([file], TEXTBOOK_POLICY);
    this.file.set(file);
    this.fileError.set(rejected[0]?.message ?? null);
    if (this.form.controls.title.value.trim() === '') {
      this.form.controls.title.setValue(file.name.replace(/\.[^.]+$/, ''));
    }
  }

  protected size(bytes: number): string {
    return formatFileSize(bytes);
  }

  /** The file is checked here (a new textbook needs one); the rest by the form. */
  protected save(): void {
    if (this.textbook() === null && this.file() === null) {
      this.fileError.set(T.dialog.chooseFileError);
    }
    if (this.fileError() === null) {
      this.submit.run();
    } else {
      revealErrors(this.form);
    }
  }

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    form: this.form,
    failed: T.dialog.failed,
    reset: () => {
      const textbook = this.textbook();
      this.fileError.set(null);
      this.file.set(null);
      this.form.reset({
        kind: textbook?.kind ?? 'TEXTBOOK',
        title: textbook?.title ?? '',
        course: textbook?.course ?? '',
        pageCount: textbook?.format === 'DOCUMENT' ? textbook.pageCount : null,
        members: (textbook?.members ?? []).map((member) => ({
          kind: member.type,
          id: member.id,
        })),
      });
    },
    request: (value) => {
      const textbook = this.textbook();
      const input: TextbookInput = {
        kind: value.kind,
        title: value.title.trim(),
        course: value.course.trim() === '' ? null : value.course.trim(),
        pageCount: this.document() ? value.pageCount : null,
        studentIds: value.members
          .filter((member) => member.kind === 'STUDENT')
          .map((member) => member.id),
        groupIds: value.members
          .filter((member) => member.kind === 'GROUP')
          .map((member) => member.id),
      };
      const file = this.file();
      if (textbook !== null) {
        return this.api.change(textbook, input);
      }
      // save() has checked the file
      return file === null ? throwError(() => new Error('no file')) : this.api.create(input, file);
    },
    done: (saved) => {
      this.saved.emit(saved);
    },
  });

  private withMembers(options: readonly MemberOption[], type: 'STUDENT' | 'GROUP'): MemberOption[] {
    const missing = (this.textbook()?.members ?? [])
      .filter(
        (member) => member.type === type && !options.some((option) => option.id === member.id),
      )
      .map((member) => ({ id: member.id, name: member.name ?? T.dialog.notInList }));
    return [...options, ...missing];
  }
}
