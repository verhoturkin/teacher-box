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
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MultiSelect } from 'primeng/multiselect';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { AiApi, HomeworkDraft, HomeworkDraftDialog } from '@features/ai';
import { MarkdownView } from '@shared/ui/markdown-view';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentDetails, AssignmentInput } from '../data-access/homework.models';

/** A student that can receive homework. */
export interface StudentOption {
  readonly id: string;
  readonly displayName: string;
}

/** Creates an assignment (and gives it to students) or edits an existing one. */
@Component({
  selector: 'tb-assignment-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    DatePicker,
    Dialog,
    InputText,
    Message,
    MultiSelect,
    SelectButton,
    Textarea,
    HomeworkDraftDialog,
    MarkdownView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [header]="title()" [(visible)]="visible" [modal]="true" [style]="{ width: '44rem' }" [draggable]="false">
      <form class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="tb-field">
          <label for="assignment-title">Название</label>
          <input pInputText id="assignment-title" formControlName="title" autocomplete="off" />
        </div>
        <div class="tb-field">
          <div class="tb-field__header">
            <label for="assignment-description">Задание</label>
            <div class="tb-actions">
              @if (aiEnabled()) {
                <p-button label="Сгенерировать с ИИ" icon="pi pi-sparkles" size="small" [text]="true" (onClick)="draftVisible.set(true)" />
              }
              <p-selectbutton [options]="modes" [formControl]="mode" optionLabel="label" optionValue="value" size="small" ariaLabel="Режим редактора" />
            </div>
          </div>
          @if (modeValue() === 'edit') {
            <textarea pTextarea id="assignment-description" formControlName="description" rows="10"></textarea>
            <small class="tb-hint">Поддерживается Markdown: **жирный**, *курсив*, списки, ссылки.</small>
          } @else {
            <div class="tb-preview">
              <tb-markdown [text]="descriptionValue()" />
            </div>
          }
        </div>
        <div class="tb-field">
          <label for="assignment-due">Срок сдачи</label>
          <p-datepicker
            inputId="assignment-due"
            formControlName="dueAt"
            [showTime]="true"
            hourFormat="24"
            dateFormat="dd.mm.yy"
            [showIcon]="true"
            [showOnFocus]="false"
            [showClear]="true"
            appendTo="body"
            [fluid]="true"
          />
        </div>
        @if (assignment() === null) {
          <div class="tb-field">
            <label for="assignment-students">Ученики</label>
            <p-multiselect
              inputId="assignment-students"
              formControlName="studentIds"
              [options]="students()"
              optionLabel="displayName"
              optionValue="id"
              placeholder="Кому выдать"
              [filter]="true"
              display="chip"
              appendTo="body"
              [fluid]="true"
            />
          </div>
        }
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Отмена" severity="secondary" [text]="true" (onClick)="visible.set(false)" />
        <p-button [label]="assignment() === null ? 'Выдать' : 'Сохранить'" [loading]="pending()" [disabled]="form.invalid" (onClick)="save()" />
      </ng-template>
    </p-dialog>
    @if (aiEnabled()) {
      <tb-homework-draft-dialog [(visible)]="draftVisible" [topic]="titleValue()" (generated)="applyDraft($event)" />
    }
  `,
})
export class AssignmentDialog {
  private readonly api = inject(HomeworkApi);
  private readonly ai = inject(AiApi);

  readonly visible = model(false);
  /** Assignment to edit; `null` creates a new one. */
  readonly assignment = input<AssignmentDetails | null>(null);
  readonly students = input<StudentOption[]>([]);
  readonly saved = output<AssignmentDetails>();

  protected readonly title = computed(() => (this.assignment() === null ? 'Новое задание' : 'Редактирование задания'));
  protected readonly modes = [
    { label: 'Текст', value: 'edit' },
    { label: 'Просмотр', value: 'preview' },
  ];
  readonly mode = new FormControl<'edit' | 'preview'>('edit', { nonNullable: true });
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20_000)] }),
    dueAt: new FormControl<Date | null>(null),
    studentIds: new FormControl<string[]>([], { nonNullable: true }),
  });
  protected readonly descriptionValue = toSignal(this.form.controls.description.valueChanges, { initialValue: '' });
  protected readonly modeValue = toSignal(this.mode.valueChanges, { initialValue: this.mode.value });
  protected readonly titleValue = toSignal(this.form.controls.title.valueChanges, { initialValue: '' });
  protected readonly aiEnabled = toSignal(this.ai.enabled$, { initialValue: false });
  protected readonly draftVisible = signal(false);

  constructor() {
    effect(() => {
      if (this.visible()) {
        const assignment = this.assignment();
        this.error.set(null);
        this.mode.setValue('edit');
        this.form.reset({
          title: assignment?.title ?? '',
          description: assignment?.description ?? '',
          dueAt: assignment?.dueAt ? new Date(assignment.dueAt) : null,
          studentIds: [],
        });
      }
    });
  }

  /** Puts an AI draft into the editor; the teacher reviews it before saving. */
  applyDraft(draft: HomeworkDraft): void {
    this.form.patchValue({ title: draft.title, description: draft.description });
    this.mode.setValue('preview');
  }

  save(): void {
    if (this.form.invalid || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    const input: AssignmentInput = {
      title: value.title.trim(),
      description: value.description.trim() === '' ? null : value.description,
      dueAt: value.dueAt === null ? null : value.dueAt.toISOString(),
    };
    const assignment = this.assignment();
    const request =
      assignment === null
        ? this.api.createAssignment(input, value.studentIds)
        : this.api.updateAssignment(assignment.id, input, assignment.version);
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
        this.error.set(describeError(error, 'Не удалось сохранить задание'));
      },
    });
  }
}
