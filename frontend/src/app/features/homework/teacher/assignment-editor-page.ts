import { DatePipe } from '@angular/common';
import { injectWindowSize } from '@core/layout/mobile';
import { Pane, Panes, PaneHeader } from '@shared/ui/panes';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { Drawer } from 'primeng/drawer';
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
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { CanLeave } from '@core/routing/can-leave.guard';
import { pageDetail } from '@core/routing/page-detail';
import { Snackbar } from '@core/snackbar/snackbar';
import {
  AiApi,
  AppliedDraft,
  HomeworkAiPanel,
  HomeworkAiState,
  SourceOption,
} from '@features/ai/parts';
import { Placed, ToBoardDialog } from '@features/boards/parts';
import { HelpButton } from '@features/help/parts';
import {
  MemberPicker,
  MemberSelection,
  StudentGroup,
  memberRecipients,
  IdentityApi,
} from '@features/identity/parts';
import { ScheduleApi, ScheduledLesson } from '@features/schedule/parts';
import { toIsoDate } from '@shared/dates/iso-date';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MarkdownView } from '@shared/ui/markdown-view';
import { PageHeader } from '@shared/ui/page-header';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentDetails, AssignmentInput, BoundTextbook } from '../data-access/homework.models';
import { T } from '../i18n/texts';
import { FilePicker } from '../ui/file-picker';
import { TextbookList } from '../ui/textbook-list';
import { videoName } from '../ui/video-list';
import { assignmentBoard } from './assignment-board';
import { BindTextbookDialog } from './bind-textbook-dialog';
import { MaterialOpener } from './material-opener';
import { NEXT_LESSON_DAYS, nextLessonStart } from './next-lesson';
import { VideoDraft, VideoSection, videoDraft, videoInputs } from './video-section';

/** A student that can receive homework. */
export interface StudentOption {
  readonly id: string;
  readonly displayName: string;
}

/** Files the AI reads (ADR-0039). */
const AI_READABLE = /^(application\/pdf|image\/(png|jpeg|webp|gif))$/;

/**
 * Teacher: the page that creates an assignment or edits one. The Markdown text on the left with a «Текст / Просмотр»
 * switch; who gets it (students and groups), the due date (by default the next lesson of the chosen students),
 * textbooks and files of a new assignment below (a saved one has them on its page); the AI assistant on the right. A new assignment is created first, gets its materials,
 * and only then goes to the students — they are notified with everything in place. «…и поместить на доску» then puts
 * it on a board of its students and remembers that board (ADR-0041).
 */
@Component({
  selector: 'tb-assignment-editor-page',
  imports: [
    ReactiveFormsModule,
    Pane,
    Panes,
    PaneHeader,
    Drawer,
    ModalDrawer,
    Button,
    Card,
    ConfirmDialog,
    DatePicker,
    InputText,
    Message,
    MemberPicker,
    SelectButton,
    Textarea,
    HomeworkAiPanel,
    ToBoardDialog,
    HelpButton,
    MarkdownView,
    PageHeader,
    LoadStateView,
    FieldErrors,
    FilePicker,
    TextbookList,
    BindTextbookDialog,
    VideoSection,
  ],
  providers: [ConfirmationService, HomeworkAiState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ready()) {
      <tb-panes>
        <tb-pane [label]="heading()">
          <ng-template tbPaneHeader>
            <tb-page-header [title]="heading()" [back]="backLink()" [backLabel]="backLabel()">
              <tb-help-button help topic="teacher/homework" />
              @if (aiEnabled()) {
                <p-button
                  [label]="t.aiTitle"
                  icon="tb-i tb-i-auto_awesome"
                  severity="secondary"
                  [ariaExpanded]="single() ? modalAiOpen() : aiOpen()"
                  (onClick)="toggleAi()"
                />
              }
              <p-button
                severity="secondary"
                [label]="isNew() ? t.assignToBoard : t.saveToBoard"
                icon="tb-i tb-i-co_present"
                [disabled]="isNew() && chosenStudents().length === 0"
                [loading]="pending() && toBoard()"
                (onClick)="save(true)"
              />
              <p-button
                [label]="isNew() ? t.assign : t.save"
                [icon]="isNew() ? 'tb-i tb-i-send' : 'tb-i tb-i-check'"
                [loading]="pending() && !toBoard()"
                (onClick)="save()"
              />
            </tb-page-header>
          </ng-template>
          <form tbFieldErrors class="tb-editor tb-form" [formGroup]="form" (ngSubmit)="save()">
            <p-card>
              <div class="tb-form">
                <div class="tb-field tb-field--required">
                  <label for="editor-title">{{ t.title }}</label>
                  <input pInputText id="editor-title" formControlName="title" autocomplete="off" />
                </div>

                <div class="tb-editor__settings">
                  @if (isNew()) {
                    <div class="tb-field">
                      <label for="editor-students">{{ t.members }}</label>
                      <tb-member-picker
                        inputId="editor-students"
                        formControlName="members"
                        [students]="studentOptions()"
                        [groups]="groups()"
                      />
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

                <div class="tb-field">
                  <div class="tb-field__header">
                    <label for="editor-text">{{ t.text }}</label>
                    <p-selectbutton
                      [options]="modes"
                      [formControl]="mode"
                      optionLabel="label"
                      optionValue="value"
                      [allowEmpty]="false"
                      [ariaLabel]="t.editorMode"
                    />
                  </div>
                  @if (modeValue() === 'preview') {
                    <div class="tb-preview">
                      <tb-markdown [text]="textValue()" />
                    </div>
                  } @else {
                    <textarea
                      pTextarea
                      id="editor-text"
                      class="tb-editor__text"
                      formControlName="description"
                      rows="14"
                    ></textarea>
                  }
                  <small class="tb-hint">{{ t.markdownHint }}</small>
                </div>
              </div>
            </p-card>

            <p-card>
              @if (isNew()) {
                <h3 class="tb-subtitle">{{ t.textbooks }}</h3>
                <tb-textbook-list
                  [textbooks]="textbooks()"
                  [editable]="true"
                  (opened)="materials.textbook($event)"
                  (edit)="editTextbook($event)"
                  (remove)="removeTextbook($event)"
                />
                <p-button
                  [label]="t.bindTextbook"
                  icon="tb-i tb-i-menu_book"
                  severity="secondary"
                  (onClick)="bindTextbook()"
                />
                <h3 class="tb-subtitle">{{ t.files }}</h3>
                <tb-file-picker [(files)]="newFiles" [label]="t.addFiles" />
              }
              @if (error(); as message) {
                <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
              }
            </p-card>
            <p-card [header]="tv.title">
              <tb-video-section [videos]="videos()" (videosChange)="changeVideos($event)" />
            </p-card>
          </form>
        </tb-pane>
        @if (aiEnabled() && !single() && aiOpen()) {
          <tb-pane kind="sheet" [label]="t.aiTitle">
            <ng-template tbPaneHeader>
              <div class="tb-editor__ai-head">
                <h2 class="tb-subtitle">{{ t.aiTitle }}</h2>
                <p-button
                  [ariaLabel]="t.closeAi"
                  icon="tb-i tb-i-close"
                  [text]="true"
                  severity="secondary"
                  (onClick)="aiOpen.set(false)"
                />
              </div>
            </ng-template>
            <tb-homework-ai-panel
              [title]="titleValue()"
              [hasText]="textValue().trim() !== ''"
              [sources]="sourceOptions()"
              (applied)="applyDraft($event)"
            />
          </tb-pane>
        }
      </tb-panes>
      @if (aiEnabled() && single()) {
        <p-drawer
          tbModalDrawer
          [(visible)]="modalAiOpen"
          [header]="t.aiTitle"
          [ariaCloseLabel]="t.closeAi"
          position="right"
          [blockScroll]="true"
          styleClass="tb-editor-ai-drawer"
          [style]="{ width: 'min(100vw, 25rem)' }"
        >
          <tb-homework-ai-panel
            [title]="titleValue()"
            [hasText]="textValue().trim() !== ''"
            [sources]="sourceOptions()"
            (applied)="applyDraft($event)"
          />
        </p-drawer>
      }

      @if (placing(); as saved) {
        <tb-to-board-dialog
          [visible]="true"
          (visibleChange)="$event || leaveTo(saved)"
          [title]="saved.title"
          [markdown]="saved.description ?? ''"
          [students]="placingStudents()"
          [frame]="board()?.frame ?? null"
          [pictures]="board()?.pictures ?? []"
          (placed)="rememberBoard(saved, $event)"
        />
      }
      <tb-bind-textbook-dialog
        [(visible)]="bindVisible"
        [taken]="textbooks()"
        [bound]="binding()"
        (picked)="pickTextbook($event)"
      />
      <p-confirmdialog />
    } @else {
      <tb-page-header [title]="t.editAssignment" back="/teacher/homework" [backLabel]="t.back" />
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()" />
    }
  `,
  styles: `
    .tb-editor__ai-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-2);
    }

    .tb-editor {
      min-width: 0;
    }

    .tb-editor__settings {
      display: grid;
      gap: var(--tb-space-4);
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
    }

    .tb-editor__text {
      width: 100%;
    }
  `,
})
export class AssignmentEditorPage implements OnInit, CanLeave {
  protected readonly t = T.editor;
  private readonly size = injectWindowSize();
  protected readonly single = computed(() => this.size() === 'compact' || this.size() === 'medium');
  protected readonly aiOpen = signal(true);
  protected readonly modalAiOpen = signal(false);

  protected toggleAi(): void {
    if (this.single()) this.modalAiOpen.update((open) => !open);
    else this.aiOpen.update((open) => !open);
  }
  protected readonly tv = T.videos;
  private readonly api = inject(HomeworkApi);
  private readonly ai = inject(AiApi);
  private readonly identity = inject(IdentityApi);
  private readonly schedule = inject(ScheduleApi);
  private readonly router = inject(Router);
  private readonly snackbar = inject(Snackbar);
  private readonly confirmation = inject(ConfirmationService);
  protected readonly materials = inject(MaterialOpener);
  private readonly dates = new DatePipe(inject(LOCALE_ID));

  /** Route parameter of `/teacher/homework/:assignmentId/edit`; none — a new assignment. */
  readonly assignmentId = input<string>();

  protected readonly isNew = computed(() => this.assignmentId() === undefined);
  protected readonly assignment = signal<AssignmentDetails | null>(null);
  protected readonly ready = computed(() => this.isNew() || this.assignment() !== null);
  protected readonly state = new LoadState();
  protected readonly modes = [
    { label: T.editor.write, value: 'edit' },
    { label: T.editor.preview, value: 'preview' },
  ];

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
    dueAt: new FormControl<Date | null>(null),
    studentIds: new FormControl<string[]>([], { nonNullable: true }),
    members: new FormControl<MemberSelection[]>([], { nonNullable: true }),
  });

  protected readonly modeValue = toSignal(this.mode.valueChanges, {
    initialValue: this.mode.value,
  });
  protected readonly titleValue = toSignal(this.form.controls.title.valueChanges, {
    initialValue: '',
  });
  protected readonly textValue = toSignal(this.form.controls.description.valueChanges, {
    initialValue: '',
  });
  protected readonly chosenStudents = toSignal(this.form.controls.studentIds.valueChanges, {
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
  protected readonly groups = signal<StudentGroup[]>([]);
  protected readonly studentOptions = computed(() =>
    this.students().map((student) => ({ id: student.id, name: student.displayName })),
  );
  private readonly chosenMembers = toSignal(this.form.controls.members.valueChanges, {
    initialValue: [],
  });
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

  readonly newFiles = signal<File[]>([]);
  /** The videos by link (ADR-0047): saved with the assignment, the whole list. */
  readonly videos = signal<readonly VideoDraft[]>([]);
  /** The teacher changed the videos: leaving asks. */
  private readonly videosChanged = signal(false);
  /** Textbooks of a new assignment, bound after it is created. */
  private readonly pickedTextbooks = signal<readonly BoundTextbook[]>([]);
  protected readonly textbooks = computed(
    () => this.assignment()?.textbooks ?? this.pickedTextbooks(),
  );
  /**
   * What the AI may read for a draft: the bound textbooks (not Word files) and the PDF and picture files — saved ones by
   * reference (ADR-0039), picked ones of a new assignment with the request (ADR-0042).
   */
  readonly sourceOptions = computed<SourceOption[]>(() => {
    const assignment = this.assignment();
    const textbooks = this.textbooks()
      .filter((textbook) => textbook.format !== 'DOCUMENT')
      .map((textbook) => ({
        key: `textbook-${textbook.textbookId}`,
        label:
          textbook.pages === null
            ? textbook.title
            : `${textbook.title}, ${T.editor.pages(textbook.pages)}`,
        source: { type: 'TEXTBOOK' as const, id: textbook.textbookId, pages: textbook.pages },
      }));
    const files =
      assignment === null
        ? []
        : assignment.attachments
            .filter((file) => AI_READABLE.test(file.contentType))
            .map((file) => ({
              key: `file-${file.id}`,
              label: file.filename,
              source: { type: 'FILE' as const, id: file.id, assignmentId: assignment.id },
            }));
    const picked = this.newFiles()
      .filter((file) => AI_READABLE.test(file.type))
      .map((file) => ({
        key: `picked-${file.name}-${String(file.size)}-${String(file.lastModified)}`,
        label: file.name,
        source: file,
      }));
    const videos = this.videos()
      .filter((video) => video.url.trim() !== '' && video.transcript.trim() !== '')
      .map((video, index) => ({
        key: `video-${String(video.key)}`,
        label: T.videos.aiSource(videoName(video, index)),
        source: {
          type: 'VIDEO' as const,
          title: video.title.trim() === '' ? null : video.title.trim(),
          url: video.url.trim(),
          transcript: video.transcript,
        },
      }));
    return [...textbooks, ...files, ...picked, ...videos];
  });
  protected readonly bindVisible = signal(false);
  protected readonly binding = signal<BoundTextbook | null>(null);
  /** The saved assignment going on a board: «…и поместить на доску». */
  protected readonly placing = signal<AssignmentDetails | null>(null);
  /** «На доску» offers the boards of its students. */
  protected readonly placingStudents = computed(
    () => this.placing()?.tasks.map((task) => task.studentId) ?? [],
  );
  /** Its text, pictures and textbook pages in a dated frame. */
  protected readonly board = computed(() => {
    const saved = this.placing();
    return saved === null ? null : assignmentBoard(saved, new Date());
  });
  protected readonly aiEnabled = toSignal(this.ai.enabled$, { initialValue: false });
  protected readonly pending = signal(false);
  /** The save in progress also puts the assignment on a board. */
  protected readonly toBoard = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Set once the work is saved: leaving asks nothing then. */
  private saved = false;

  constructor() {
    pageDetail(() => this.assignment()?.title);
    effect(() => {
      const ids = memberRecipients(
        this.chosenMembers(),
        this.groups(),
        this.students().map((student) => student.id),
      );
      untracked(() => {
        this.form.controls.studentIds.setValue(ids);
      });
    });
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
      this.identity.listGroups().subscribe((groups) => {
        this.groups.set(groups.filter((group) => group.archivedAt === null));
      });
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
        this.form.reset({
          title: assignment.title,
          description: assignment.description ?? '',
          dueAt: assignment.dueAt === null ? null : new Date(assignment.dueAt),
          studentIds: [],
        });
        this.videos.set(assignment.videos.map((video) => videoDraft(video)));
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

  /**
   * Puts an AI draft into the editor; the teacher reviews it before saving. «Заменить» takes its title and text;
   * «Вставить» adds its text after the teacher's and keeps the title the teacher wrote.
   */
  applyDraft({ draft, mode }: AppliedDraft): void {
    const value = this.form.getRawValue();
    if (mode === 'insert') {
      this.form.patchValue({
        title: value.title.trim() === '' ? draft.title : value.title,
        description: `${value.description.trimEnd()}

${draft.description}`,
      });
    } else {
      this.form.patchValue({
        title: draft.title,
        description: draft.description,
      });
    }
    this.form.markAsDirty();
    this.mode.setValue('preview');
  }

  changeVideos(videos: readonly VideoDraft[]): void {
    this.videos.set(videos);
    this.videosChanged.set(true);
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
    this.pickedTextbooks.update((picked) =>
      picked.filter((candidate) => candidate.textbookId !== textbook.textbookId),
    );
  }

  /** Saves (a new assignment is given out); `toBoard` then puts it on a board of its students. */
  save(toBoard = false): void {
    if (!revealErrors(this.form) || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    const input: AssignmentInput = {
      title: value.title.trim(),
      description: value.description.trim() === '' ? null : value.description,
      dueAt: value.dueAt === null ? null : value.dueAt.toISOString(),
      videos: videoInputs(this.videos()),
    };
    const existing = this.assignment();
    this.pending.set(true);
    this.toBoard.set(toBoard);
    this.error.set(null);
    const saved =
      existing === null
        ? this.api
            .createAssignment(input)
            .pipe(
              switchMap((created) =>
                this.addMaterials(created.id).pipe(
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
                this.addMaterials(updated.id).pipe(
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
        if (toBoard) {
          this.assignment.set(assignment);
          this.placing.set(assignment);
        } else {
          this.leaveTo(assignment);
        }
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
  private addMaterials(id: string): Observable<boolean> {
    const files = this.newFiles();
    const textbooks = this.assignment() === null ? this.pickedTextbooks() : [];
    if (files.length === 0 && textbooks.length === 0) {
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

  /** The board the saved assignment went on: its students get «Перейти на доску». */
  rememberBoard(assignment: AssignmentDetails, placed: Placed): void {
    this.api.placeOnBoard(assignment.id, placed.board.id).subscribe({
      error: () => {
        this.snackbar.error(T.editor.boardFailed);
      },
    });
  }

  /** To the page of the saved assignment (after the board dialog, if any, is closed). */
  leaveTo(assignment: AssignmentDetails): void {
    this.placing.set(null);
    void this.router.navigate(['/teacher/homework', assignment.id]);
  }

  /** Asks before leaving changes that are not saved. */
  canLeave(): boolean | Promise<boolean> {
    const dirty =
      this.form.dirty ||
      this.newFiles().length > 0 ||
      this.pickedTextbooks().length > 0 ||
      this.videosChanged();
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
