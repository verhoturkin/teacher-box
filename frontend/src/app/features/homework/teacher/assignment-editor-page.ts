import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  LOCALE_ID,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, catchError, concat, defer, last, map, of, switchMap, toArray } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { CanLeave } from '@core/routing/can-leave.guard';
import { pageDetail } from '@core/routing/page-detail';
import { Snackbar } from '@core/snackbar/snackbar';
import { AiApi, HomeworkDraft, HomeworkDraftDialog } from '@features/ai/parts';
import { ToBoardDialog } from '@features/boards/parts';
import { HelpButton } from '@features/help/parts';
import { GroupPicker, IdentityApi } from '@features/identity/parts';
import { ScheduleApi, ScheduledLesson } from '@features/schedule/parts';
import { toIsoDate } from '@shared/dates/iso-date';
import { FileSaver } from '@shared/files/file-saver';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MarkdownView } from '@shared/ui/markdown-view';
import { PageHeader } from '@shared/ui/page-header';
import { HomeworkApi } from '../data-access/homework-api';
import {
  AssignmentDetails,
  AssignmentInput,
  AssignmentKind,
  Attachment,
  BoundTextbook,
} from '../data-access/homework.models';
import { ASSIGNMENT_KIND_LABELS } from '../homework-labels';
import { T } from '../i18n/texts';
import { AttachmentList } from '../ui/attachment-list';
import { FilePicker } from '../ui/file-picker';
import { InteractiveFrame } from '../ui/interactive-frame';
import { TextbookList } from '../ui/textbook-list';
import { BindTextbookDialog } from './bind-textbook-dialog';
import { NEXT_LESSON_DAYS, nextLessonStart } from './next-lesson';

/** A student that can receive homework. */
export interface StudentOption {
  readonly id: string;
  readonly displayName: string;
}

const KINDS: readonly AssignmentKind[] = ['WRITTEN', 'BOARD', 'INTERACTIVE'];

/**
 * Teacher: the page that creates an assignment or edits one (redesign variant B). The content by kind on the left —
 * a Markdown text, a description, or an HTML page with its preview; who gets it, the due date (by default the next
 * lesson of the chosen students), textbooks and files below; the AI assistant on the right. A new assignment is
 * created first, gets its materials, and only then goes to the students — they are notified with everything in place.
 */
@Component({
  selector: 'tb-assignment-editor-page',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    ConfirmDialog,
    DatePicker,
    InputText,
    Message,
    MultiSelect,
    Select,
    SelectButton,
    Textarea,
    GroupPicker,
    HomeworkDraftDialog,
    ToBoardDialog,
    HelpButton,
    MarkdownView,
    PageHeader,
    LoadStateView,
    FieldErrors,
    AttachmentList,
    FilePicker,
    InteractiveFrame,
    TextbookList,
    BindTextbookDialog,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ready()) {
      <tb-page-header [title]="heading()" [back]="backLink()" [backLabel]="backLabel()">
        <tb-help-button help topic="teacher/homework" />
        @if (!isNew()) {
          <span meta>{{ kindLabels[kindValue()] }}</span>
        }
        <p-button
          severity="success"
          [label]="isNew() ? t.assign : t.save"
          [icon]="isNew() ? 'pi pi-send' : 'pi pi-check'"
          [loading]="pending()"
          (onClick)="save()"
        />
      </tb-page-header>

      <div class="tb-editor" [class.tb-editor--aside]="aiEnabled()">
        <form tbFieldErrors class="tb-editor__main tb-form" [formGroup]="form" (ngSubmit)="save()">
          <p-card>
            <div class="tb-form">
              @if (isNew()) {
                <div class="tb-field">
                  <span id="editor-kind">{{ t.kind }}</span>
                  <p-selectbutton
                    class="tb-editor__kinds"
                    [options]="kinds"
                    [formControl]="kind"
                    optionLabel="label"
                    optionValue="value"
                    [allowEmpty]="false"
                    ariaLabelledBy="editor-kind"
                  />
                  <p-select
                    class="tb-editor__kinds-narrow"
                    [options]="kinds"
                    [formControl]="kind"
                    optionLabel="label"
                    optionValue="value"
                    ariaLabelledBy="editor-kind"
                    appendTo="body"
                    [fluid]="true"
                  />
                  <small class="tb-hint">{{ t.kindHints[kindValue()] }}</small>
                </div>
              }
              <div class="tb-field tb-field--required">
                <label for="editor-title">{{ t.title }}</label>
                <input pInputText id="editor-title" formControlName="title" autocomplete="off" />
              </div>

              @if (kindValue() === 'INTERACTIVE') {
                <div class="tb-field">
                  <label for="editor-description">{{ t.description }}</label>
                  <textarea
                    pTextarea
                    id="editor-description"
                    formControlName="description"
                    rows="2"
                  ></textarea>
                  <small class="tb-hint">{{ t.descriptionHint }}</small>
                </div>
                <div class="tb-field tb-field--required">
                  <div class="tb-field__header">
                    <label for="editor-html">{{ t.html }}</label>
                    <p-button
                      [label]="t.showPreview"
                      icon="pi pi-eye"
                      [text]="true"
                      [loading]="previewing()"
                      (onClick)="showPreview()"
                    />
                  </div>
                  <textarea
                    pTextarea
                    id="editor-html"
                    class="tb-code"
                    formControlName="interactiveHtml"
                    rows="16"
                    spellcheck="false"
                  ></textarea>
                  <small class="tb-hint">{{ t.htmlHint }}</small>
                </div>
                @if (previewUrl(); as url) {
                  <tb-interactive-frame [url]="url" [title]="t.previewTitle" />
                }
                @if (previewError(); as message) {
                  <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
                }
              } @else {
                <div class="tb-field">
                  <div class="tb-field__header">
                    <label for="editor-text">
                      {{ kindValue() === 'BOARD' ? t.description : t.text }}
                    </label>
                    <div class="tb-actions">
                      <p-button
                        [label]="t.toBoard"
                        icon="pi pi-th-large"
                        [text]="true"
                        [disabled]="textValue().trim() === ''"
                        (onClick)="boardVisible.set(true)"
                      />
                      <p-selectbutton
                        class="tb-md-editor__switch"
                        [options]="modes"
                        [formControl]="mode"
                        optionLabel="label"
                        optionValue="value"
                        [allowEmpty]="false"
                        [ariaLabel]="t.editorMode"
                      />
                    </div>
                  </div>
                  <div class="tb-md-editor" [attr.data-mode]="modeValue()">
                    <textarea
                      pTextarea
                      id="editor-text"
                      class="tb-md-editor__text"
                      formControlName="description"
                      rows="14"
                    ></textarea>
                    <div class="tb-preview tb-md-editor__preview">
                      <tb-markdown [text]="textValue()" />
                    </div>
                  </div>
                  <small class="tb-hint">{{ t.markdownHint }}</small>
                </div>
              }
            </div>
          </p-card>

          <p-card>
            <div class="tb-editor__settings">
              @if (isNew()) {
                <div class="tb-field">
                  <label for="editor-students">{{ t.students }}</label>
                  <p-multiselect
                    inputId="editor-students"
                    formControlName="studentIds"
                    [options]="students()"
                    optionLabel="displayName"
                    optionValue="id"
                    [placeholder]="t.studentsPlaceholder"
                    [filter]="true"
                    [filterPlaceHolder]="t.search"
                    [ariaFilterLabel]="t.search"
                    display="chip"
                    appendTo="body"
                    [fluid]="true"
                  />
                  <tb-group-picker inputId="editor-group" (picked)="addStudents($event)" />
                </div>
              }
              <div class="tb-field">
                <label for="editor-due">{{ t.due }}</label>
                <p-datepicker
                  inputId="editor-due"
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
                @if (dueHint(); as hint) {
                  <small class="tb-hint">{{ hint }}</small>
                }
              </div>
            </div>

            @if (kindValue() === 'WRITTEN') {
              <h3 class="tb-subtitle">{{ t.textbooks }}</h3>
              <tb-textbook-list
                [textbooks]="textbooks()"
                [editable]="true"
                (edit)="editTextbook($event)"
                (remove)="removeTextbook($event)"
              />
              <p-button
                [label]="t.bindTextbook"
                icon="pi pi-book"
                severity="secondary"
                (onClick)="bindTextbook()"
              />
              <h3 class="tb-subtitle">{{ t.files }}</h3>
              <tb-attachment-list
                [attachments]="attachments()"
                [removable]="true"
                (download)="download($event)"
                (remove)="confirmRemove($event)"
              />
              <tb-file-picker [(files)]="newFiles" [label]="t.addFiles" />
            }
            @if (error(); as message) {
              <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
            }
          </p-card>
        </form>

        @if (aiEnabled()) {
          <aside class="tb-editor__aside">
            <p-card [header]="t.ai">
              <p class="tb-muted">{{ t.aiHint }}</p>
              <p-button
                [label]="t.generate"
                icon="pi pi-sparkles"
                severity="secondary"
                (onClick)="draftVisible.set(true)"
              />
            </p-card>
          </aside>
        }
      </div>

      @if (aiEnabled()) {
        <tb-homework-draft-dialog
          [(visible)]="draftVisible"
          [topic]="titleValue()"
          (generated)="applyDraft($event)"
        />
      }
      <tb-to-board-dialog
        [(visible)]="boardVisible"
        [title]="titleValue()"
        [markdown]="textValue()"
        [students]="boardOwners()"
      />
      <tb-bind-textbook-dialog
        [(visible)]="bindVisible"
        [assignmentId]="assignment()?.id ?? null"
        [taken]="textbooks()"
        [bound]="binding()"
        (saved)="assignment.set($event)"
        (picked)="pickTextbook($event)"
      />
      <p-confirmdialog />
    } @else {
      <tb-page-header [title]="t.editAssignment" back="/teacher/homework" [backLabel]="t.back" />
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()" />
    }
  `,
  styles: `
    .tb-editor {
      display: grid;
      gap: var(--tb-space-4);
      align-items: start;
    }

    .tb-editor__main {
      min-width: 0;
    }

    .tb-editor__settings {
      display: grid;
      gap: var(--tb-space-4);
      grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    }

    .tb-md-editor__text {
      width: 100%;
    }

    /* Three kinds do not fit a phone in a row: a list there. */
    .tb-editor__kinds-narrow {
      display: none;
    }

    @media (width <= 48em) {
      .tb-editor__kinds {
        display: none;
      }

      .tb-editor__kinds-narrow {
        display: inline-flex;
      }
    }

    .tb-md-editor[data-mode='edit'] .tb-md-editor__preview,
    .tb-md-editor[data-mode='preview'] .tb-md-editor__text {
      display: none;
    }

    .tb-code {
      font-family: var(--tb-font-mono);
    }

    @media (width >= 75em) {
      .tb-editor--aside {
        grid-template-columns: minmax(0, 1fr) 22rem;
      }

      .tb-editor__aside {
        position: sticky;
        top: var(--tb-space-4);
      }

      /* Wide screens show the text and its preview side by side. */
      .tb-md-editor {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: var(--tb-space-3);
      }

      .tb-md-editor[data-mode] .tb-md-editor__preview,
      .tb-md-editor[data-mode] .tb-md-editor__text {
        display: block;
      }

      .tb-md-editor__switch {
        display: none;
      }
    }
  `,
})
export class AssignmentEditorPage implements OnInit, CanLeave {
  protected readonly t = T.editor;
  protected readonly kindLabels = ASSIGNMENT_KIND_LABELS;
  private readonly api = inject(HomeworkApi);
  private readonly ai = inject(AiApi);
  private readonly identity = inject(IdentityApi);
  private readonly schedule = inject(ScheduleApi);
  private readonly router = inject(Router);
  private readonly snackbar = inject(Snackbar);
  private readonly confirmation = inject(ConfirmationService);
  private readonly fileSaver = inject(FileSaver);
  private readonly dates = new DatePipe(inject(LOCALE_ID));

  /** Route parameter of `/teacher/homework/:assignmentId/edit`; none — a new assignment. */
  readonly assignmentId = input<string>();

  protected readonly isNew = computed(() => this.assignmentId() === undefined);
  protected readonly assignment = signal<AssignmentDetails | null>(null);
  protected readonly ready = computed(() => this.isNew() || this.assignment() !== null);
  protected readonly state = new LoadState();
  protected readonly kinds = KINDS.map((value) => ({
    value,
    label: ASSIGNMENT_KIND_LABELS[value],
  }));
  protected readonly modes = [
    { label: T.editor.write, value: 'edit' },
    { label: T.editor.preview, value: 'preview' },
  ];

  readonly kind = new FormControl<AssignmentKind>('WRITTEN', { nonNullable: true });
  readonly mode = new FormControl<'edit' | 'preview'>('edit', { nonNullable: true });
  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(20_000)],
    }),
    interactiveHtml: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(200_000)],
    }),
    dueAt: new FormControl<Date | null>(null),
    studentIds: new FormControl<string[]>([], { nonNullable: true }),
  });

  private readonly kindChoice = toSignal(this.kind.valueChanges, { initialValue: this.kind.value });
  protected readonly kindValue = computed(() => this.assignment()?.kind ?? this.kindChoice());
  protected readonly modeValue = toSignal(this.mode.valueChanges, {
    initialValue: this.mode.value,
  });
  protected readonly titleValue = toSignal(this.form.controls.title.valueChanges, {
    initialValue: '',
  });
  protected readonly textValue = toSignal(this.form.controls.description.valueChanges, {
    initialValue: '',
  });
  private readonly chosenStudents = toSignal(this.form.controls.studentIds.valueChanges, {
    initialValue: [],
  });
  protected readonly heading = computed(() =>
    this.isNew() ? T.editor.newAssignment : T.editor.editAssignment,
  );
  protected readonly backLink = computed(() => {
    const assignment = this.assignment();
    return assignment === null ? '/teacher/homework' : ['/teacher/homework', assignment.id];
  });
  protected readonly backLabel = computed(() => this.assignment()?.title ?? T.editor.back);

  protected readonly students = signal<StudentOption[]>([]);
  /** Lessons ahead, for the due date of a new assignment. */
  private readonly lessons = signal<readonly ScheduledLesson[] | null>(null);
  /** The next lesson the due date was set to; `null` when the teacher chose the date. */
  protected readonly dueLesson = signal<Date | null>(null);
  /** The teacher set the due date (or it is an existing assignment): it no longer follows the lessons. */
  private readonly dueTouched = signal(false);
  protected readonly dueHint = computed(() => {
    const lesson = this.dueLesson();
    if (lesson !== null) {
      return T.editor.untilLesson(this.dates.transform(lesson, 'dd.MM.yyyy HH:mm') ?? '');
    }
    return this.isNew() &&
      !this.dueTouched() &&
      this.chosenStudents().length > 0 &&
      this.lessons() !== null
      ? T.editor.noLesson
      : null;
  });

  /** Textbooks of a new assignment, bound after it is created. */
  private readonly pickedTextbooks = signal<readonly BoundTextbook[]>([]);
  protected readonly textbooks = computed(
    () => this.assignment()?.textbooks ?? this.pickedTextbooks(),
  );
  protected readonly attachments = computed(() => this.assignment()?.attachments ?? []);
  readonly newFiles = signal<File[]>([]);
  protected readonly bindVisible = signal(false);
  protected readonly binding = signal<BoundTextbook | null>(null);
  protected readonly boardVisible = signal(false);
  /** «На доску» offers the boards of the students of the assignment and of those being chosen. */
  protected readonly boardOwners = computed(() => [
    ...(this.assignment()?.tasks.map((task) => task.studentId) ?? []),
    ...this.chosenStudents(),
  ]);
  protected readonly aiEnabled = toSignal(this.ai.enabled$, { initialValue: false });
  protected readonly draftVisible = signal(false);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly previewing = signal(false);
  protected readonly previewError = signal<string | null>(null);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Set once the work is saved: leaving asks nothing then. */
  private saved = false;

  constructor() {
    pageDetail(() => this.assignment()?.title);
    effect(() => {
      const students = this.chosenStudents();
      const lessons = this.lessons();
      if (lessons !== null && this.isNew()) {
        untracked(() => {
          this.suggestDue(nextLessonStart(lessons, students, new Date()));
        });
      }
    });
    this.form.controls.dueAt.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const lesson = this.dueLesson();
      if (value?.getTime() !== lesson?.getTime()) {
        this.dueTouched.set(true);
        this.dueLesson.set(null);
      }
    });
  }

  ngOnInit(): void {
    if (this.isNew()) {
      this.loadStudents();
      const today = new Date();
      const until = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + NEXT_LESSON_DAYS,
      );
      this.schedule.lessons(toIsoDate(today), toIsoDate(until)).subscribe({
        next: (lessons) => {
          this.lessons.set(lessons);
        },
        error: () => {
          // without the schedule the due date stays for the teacher to set
        },
      });
    } else {
      this.load();
    }
  }

  protected load(): void {
    const id = this.assignmentId();
    if (id === undefined) {
      return;
    }
    this.api
      .assignment(id)
      .pipe(this.state.track())
      .subscribe((assignment) => {
        this.assignment.set(assignment);
        this.kind.setValue(assignment.kind);
        this.form.reset({
          title: assignment.title,
          description: assignment.description ?? '',
          interactiveHtml: assignment.interactiveHtml ?? '',
          dueAt: assignment.dueAt === null ? null : new Date(assignment.dueAt),
          studentIds: [],
        });
        this.dueTouched.set(true);
      });
  }

  private loadStudents(): void {
    this.identity.listStudents().subscribe((students) => {
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, displayName: student.displayName })),
      );
    });
  }

  /** The due date follows the next lesson of the chosen students until the teacher sets it. */
  private suggestDue(lesson: Date | null): void {
    if (this.dueTouched()) {
      return;
    }
    this.dueLesson.set(lesson);
    this.form.controls.dueAt.setValue(lesson);
  }

  /** Adds the students of a chosen group who can get the assignment. */
  addStudents(ids: readonly string[]): void {
    const control = this.form.controls.studentIds;
    const known = new Set(this.students().map((student) => student.id));
    control.setValue([...new Set([...control.value, ...ids.filter((id) => known.has(id))])]);
    control.markAsDirty();
  }

  /** Puts an AI draft into the editor; the teacher reviews it before saving. */
  applyDraft(draft: HomeworkDraft): void {
    this.form.patchValue({ title: draft.title, description: draft.description });
    this.form.markAsDirty();
    this.mode.setValue('preview');
  }

  protected showPreview(): void {
    const html = this.form.controls.interactiveHtml.value;
    if (html.trim() === '' || this.previewing()) {
      return;
    }
    this.previewing.set(true);
    this.previewError.set(null);
    this.api.interactivePreview(html).subscribe({
      next: (link) => {
        this.previewing.set(false);
        this.previewUrl.set(link.url);
      },
      error: (error: unknown) => {
        this.previewing.set(false);
        this.previewError.set(describeError(error, T.editor.previewFailed));
      },
    });
  }

  protected bindTextbook(): void {
    this.binding.set(null);
    this.bindVisible.set(true);
  }

  protected editTextbook(textbook: BoundTextbook): void {
    this.binding.set(textbook);
    this.bindVisible.set(true);
  }

  /** A textbook for a new assignment, or new pages of one already picked. */
  pickTextbook(textbook: BoundTextbook): void {
    this.pickedTextbooks.update((picked) => [
      ...picked.filter((candidate) => candidate.textbookId !== textbook.textbookId),
      textbook,
    ]);
  }

  protected removeTextbook(textbook: BoundTextbook): void {
    const assignment = this.assignment();
    if (assignment === null) {
      this.pickedTextbooks.update((picked) =>
        picked.filter((candidate) => candidate.textbookId !== textbook.textbookId),
      );
      return;
    }
    this.api.unbindTextbook(assignment.id, textbook.textbookId).subscribe((changed) => {
      this.assignment.set(changed);
    });
  }

  protected confirmRemove(file: Attachment): void {
    const assignment = this.assignment();
    if (assignment === null) {
      return;
    }
    this.confirmation.confirm(
      dangerConfirmation({
        header: T.page.deleteHeader,
        message: T.page.deleteMessage(file.filename),
        acceptLabel: T.page.delete,
        accept: () => {
          this.api.removeMaterial(assignment.id, file.id).subscribe(() => {
            this.assignment.set({
              ...assignment,
              attachments: assignment.attachments.filter((candidate) => candidate.id !== file.id),
            });
          });
        },
      }),
    );
  }

  protected download(file: Attachment): void {
    this.api.teacherFile(file.id).subscribe((blob) => {
      this.fileSaver.save(blob, file.filename);
    });
  }

  save(): void {
    if (!revealErrors(this.form) || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    const kind = this.kindValue();
    const input: AssignmentInput = {
      title: value.title.trim(),
      description: value.description.trim() === '' ? null : value.description,
      interactiveHtml: kind === 'INTERACTIVE' ? value.interactiveHtml : null,
      dueAt: value.dueAt === null ? null : value.dueAt.toISOString(),
    };
    const existing = this.assignment();
    this.pending.set(true);
    this.error.set(null);
    const saved =
      existing === null
        ? this.api
            .createAssignment(kind, input)
            .pipe(
              switchMap((created) =>
                this.addMaterials(created.id, kind).pipe(
                  switchMap((complete) =>
                    value.studentIds.length === 0
                      ? of({ assignment: created, complete })
                      : this.api
                          .assignStudents(created.id, value.studentIds)
                          .pipe(map((assignment) => ({ assignment, complete }))),
                  ),
                ),
              ),
            )
        : this.api
            .updateAssignment(existing.id, input, existing.version)
            .pipe(
              switchMap((updated) =>
                this.addMaterials(updated.id, kind).pipe(
                  map((complete) => ({ assignment: updated, complete })),
                ),
              ),
            );
    saved.subscribe({
      next: ({ assignment, complete }) => {
        this.pending.set(false);
        this.saved = true;
        if (complete) {
          this.snackbar.success(
            existing === null && value.studentIds.length > 0 ? T.editor.assigned : T.editor.saved,
          );
        } else {
          this.snackbar.error(T.editor.materialsFailed);
        }
        void this.router.navigate(['/teacher/homework', assignment.id]);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, T.editor.failed));
      },
    });
  }

  /**
   * The new files and the textbooks picked for a new assignment, one after another; `false` when some did not make
   * it (the assignment is saved anyway).
   */
  private addMaterials(id: string, kind: AssignmentKind): Observable<boolean> {
    const files = this.newFiles();
    const textbooks = this.assignment() === null ? this.pickedTextbooks() : [];
    if (kind !== 'WRITTEN' || (files.length === 0 && textbooks.length === 0)) {
      return of(true);
    }
    const steps: Observable<boolean>[] = [
      ...(files.length === 0 ? [] : [this.api.uploadMaterials(id, files).pipe(map(() => true))]),
      ...textbooks.map((textbook) =>
        defer(() => this.api.bindTextbook(id, textbook.textbookId, textbook.pages)).pipe(
          map(() => true),
        ),
      ),
    ].map((step) => step.pipe(catchError(() => of(false))));
    return concat(...steps).pipe(
      toArray(),
      map((results) => results.every(Boolean)),
      last(),
    );
  }

  /** Asks before leaving changes that are not saved. */
  canLeave(): boolean | Promise<boolean> {
    const dirty =
      this.form.dirty ||
      (this.isNew() && this.kind.dirty) ||
      this.newFiles().length > 0 ||
      this.pickedTextbooks().length > 0;
    if (this.saved || !dirty) {
      return true;
    }
    return new Promise((resolve) => {
      this.confirmation.confirm(
        dangerConfirmation({
          header: T.editor.leaveHeader,
          message: T.editor.leaveMessage,
          acceptLabel: T.editor.leave,
          accept: () => {
            resolve(true);
          },
          reject: () => {
            resolve(false);
          },
        }),
      );
    });
  }
}
