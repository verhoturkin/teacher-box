import { injectWindowSize } from '@core/layout/mobile';
import { Pane, Panes, PaneHeader } from '@shared/ui/panes';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { Drawer } from 'primeng/drawer';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
  ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  concat,
  defer,
  last,
  map,
  of,
  switchMap,
  tap,
  toArray,
} from 'rxjs';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Menu } from 'primeng/menu';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { problemCode } from '@core/http/problem-detail';
import { CanLeave } from '@core/routing/can-leave.guard';
import { pageDetail } from '@core/routing/page-detail';
import { Snackbar } from '@core/snackbar/snackbar';
import {
  AiApi,
  AppliedDraft,
  AppliedQuestions,
  HomeworkAiPanel,
  HomeworkAiState,
  SourceOption,
} from '@features/ai/parts';
import { Placed, ToBoardDialog } from '@features/boards/parts';
import { HelpButton } from '@features/help/parts';
import {
  MemberSelection,
  StudentGroup,
  memberRecipients,
  IdentityApi,
} from '@features/identity/parts';
import { ScheduleApi, ScheduledLesson } from '@features/schedule/parts';
import { toIsoDate } from '@shared/dates/iso-date';
import { Confirm } from '@shared/ui/confirm';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MarkdownView } from '@shared/ui/markdown-view';
import { PageHeader } from '@shared/ui/page-header';
import { Avatar } from '@shared/ui/avatar';
import { InputChip } from '@shared/ui/input-chip';
import { SectionNav, SectionNavItem } from '@shared/ui/section-nav';
import { HomeworkApi } from '../data-access/homework-api';
import {
  AssignmentDetails,
  AssignmentInput,
  BoundTextbook,
  QuizReveal,
} from '../data-access/homework.models';
import { T } from '../i18n/texts';
import { Due, DueChips, dueAtOf } from '../ui/due-chips';
import { MaterialChips } from '../ui/material-chips';
import { RecipientsField } from '../ui/recipients-field';
import { TextbookList } from '../ui/textbook-list';
import { videoName } from '../ui/video-list';
import { AssignmentDraftHandover, titleOf } from './assignment-draft';
import { assignmentBoard } from './assignment-board';
import { AssignMoreDialog } from './assign-more-dialog';
import { BindTextbookDialog } from './bind-textbook-dialog';
import { MaterialOpener } from './material-opener';
import { NEXT_LESSON_DAYS, nextLessonStart } from './next-lesson';
import {
  MAX_QUESTIONS,
  QuestionDraft,
  QuestionSection,
  firstProblem,
  questionDraft,
  questionInputs,
} from './question-section';
import { MAX_VIDEOS, VideoDraft, VideoSection, videoDraft, videoInputs } from './video-section';

/** A student that can receive homework. */
export interface StudentOption {
  readonly id: string;
  readonly displayName: string;
}

/** Files the AI reads (ADR-0039). */
const AI_READABLE = /^(application\/pdf|image\/(png|jpeg|webp|gif))$/;

/**
 * Teacher: the page that creates an assignment or edits one, in the order of the quick dialog: who gets it,
 * one Markdown text whose first line is the title, the due date as chips, and the materials — textbooks, files,
 * videos, a test with questions, a board — which appear once added from the assist chips. A new assignment is
 * created first, gets its materials, and only then goes to the students — they are notified with everything in
 * place; «Сохранить черновик» keeps it (and its students) unsent. The AI assistant opens beside the form.
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
    Menu,
    Message,
    DueChips,
    MaterialChips,
    RecipientsField,
    SectionNav,
    Avatar,
    InputChip,
    AssignMoreDialog,
    SelectButton,
    Textarea,
    HomeworkAiPanel,
    ToBoardDialog,
    HelpButton,
    MarkdownView,
    PageHeader,
    LoadStateView,
    FieldErrors,
    TextbookList,
    BindTextbookDialog,
    VideoSection,
    QuestionSection,
  ],
  providers: [HomeworkAiState],
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
              @if (isNew()) {
                <p-button
                  [label]="c.saveDraft"
                  severity="secondary"
                  [text]="true"
                  [loading]="pending() && draftOnly()"
                  (onClick)="saveDraft()"
                />
                <span class="tb-split" role="group" [attr.aria-label]="c.assign">
                  <p-button
                    styleClass="tb-split__main"
                    [label]="c.assign"
                    icon="tb-i tb-i-send"
                    [loading]="pending() && !draftOnly()"
                    (onClick)="save()"
                  />
                  <p-button
                    styleClass="tb-split__more"
                    icon="tb-i tb-i-expand_more"
                    [ariaLabel]="c.assignMenu"
                    (onClick)="menu.toggle($event)"
                  />
                  <p-menu #menu [model]="assignMenu" [popup]="true" appendTo="body" />
                </span>
              } @else {
                <p-button
                  [label]="t.save"
                  icon="tb-i tb-i-check"
                  [loading]="pending()"
                  (onClick)="save()"
                />
              }
            </tb-page-header>
          </ng-template>
          <div class="tb-editor__layout">
            @if (showNav()) {
              <tb-section-nav class="tb-editor__nav" [items]="navItems()" [label]="t.sections" />
            }
            <form
              tbFieldErrors
              class="tb-editor tb-editor__form tb-form"
              [formGroup]="form"
              (ngSubmit)="save()"
            >
              <p-card>
                <div class="tb-form">
                  @if (isNew() || isDraft()) {
                    <tb-recipients-field
                      inputId="editor-students"
                      [control]="form.controls.members"
                      [students]="studentOptions()"
                      [groups]="groups()"
                    />
                  } @else {
                    <div class="tb-field">
                      <span id="editor-given">{{ c.whom }}</span>
                      <div class="tb-editor__chips" role="group" aria-labelledby="editor-given">
                        @for (task of assignment()?.tasks ?? []; track task.taskId) {
                          <tb-input-chip [label]="task.studentName" [readonly]="true">
                            <tb-avatar lead [name]="task.studentName" size="1.5rem" />
                          </tb-input-chip>
                        }
                        <p-button
                          [label]="t.assignMore"
                          icon="tb-i tb-i-add"
                          severity="secondary"
                          (onClick)="giveMore()"
                        />
                      </div>
                    </div>
                  }

                  <div id="editor-task" class="tb-field">
                    <div class="tb-field__header">
                      <label for="editor-text">{{ c.task }}</label>
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
                      <div class="tb-preview" [style.min-height.px]="editorHeight()">
                        <tb-markdown [text]="textValue()" />
                      </div>
                    } @else {
                      <textarea
                        pTextarea
                        id="editor-text"
                        class="tb-editor__text"
                        #editor
                        [style.height.px]="editorHeight()"
                        formControlName="description"
                        rows="14"
                      ></textarea>
                    }
                    <small class="tb-hint">{{ c.firstLine }}. {{ t.markdownHint }}</small>
                  </div>

                  <tb-due-chips
                    [lesson]="nextLesson()"
                    [choice]="dueChoice()"
                    (choiceChange)="chooseDue($event)"
                    [date]="duePicked()"
                    (dateChange)="pickDue($event)"
                  />

                  <section
                    id="editor-materials"
                    class="tb-editor__materials"
                    [attr.aria-label]="c.materials"
                  >
                    <h3 class="tb-subtitle">{{ c.materials }}</h3>
                    @if (isNew() && textbooks().length > 0) {
                      <tb-textbook-list
                        [textbooks]="textbooks()"
                        [editable]="true"
                        (opened)="materials.textbook($event)"
                        (edit)="editTextbook($event)"
                        (remove)="removeTextbook($event)"
                      />
                    }
                    @if (videos().length > 0) {
                      <tb-video-section [videos]="videos()" (videosChange)="changeVideos($event)" />
                    }
                    @if (onBoard()) {
                      <div class="tb-editor__row">
                        <i class="tb-i tb-i-co_present" aria-hidden="true"></i>
                        <span class="tb-editor__grow">{{ c.onBoard }}</span>
                        <p-button
                          icon="tb-i tb-i-close"
                          severity="secondary"
                          [text]="true"
                          [rounded]="true"
                          [ariaLabel]="c.remove"
                          (onClick)="onBoard.set(false)"
                        />
                      </div>
                    }
                    <tb-material-chips
                      [(files)]="newFiles"
                      [compact]="compact()"
                      [withFiles]="isNew()"
                      [videosFull]="videos().length >= maxVideos"
                      [quizDisabled]="quizShown()"
                      [onBoard]="onBoard()"
                      (textbook)="bindTextbook()"
                      (video)="addVideo()"
                      (quiz)="quizOpen.set(true)"
                      (board)="onBoard.set(true)"
                    />
                  </section>
                </div>
                @if (error(); as message) {
                  <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
                }
              </p-card>
              @if (quizShown()) {
                <p-card id="editor-quiz" [header]="tq.title">
                  <tb-question-section
                    [questions]="questions()"
                    (questionsChange)="changeQuestions($event)"
                    [reveal]="quizReveal()"
                    (revealChange)="changeReveal($event)"
                    [attempts]="quizAttempts()"
                    (attemptsChange)="changeAttempts($event)"
                    [locked]="quizLocked()"
                    [error]="quizError()"
                    [showProblems]="quizChecked()"
                  />
                  @if (!quizLocked()) {
                    <p-button
                      [label]="c.remove"
                      icon="tb-i tb-i-delete"
                      severity="secondary"
                      [text]="true"
                      (onClick)="removeQuiz()"
                    />
                  }
                </p-card>
              }
            </form>
          </div>
        </tb-pane>
        @if (aiEnabled() && !single() && aiOpen()) {
          <tb-pane class="tb-editor__ai" [label]="t.aiTitle">
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
              [questionCount]="questions().length"
              [quizLocked]="quizLocked()"
              (applied)="applyDraft($event)"
              (questionsApplied)="applyQuestions($event)"
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
            [questionCount]="questions().length"
            [quizLocked]="quizLocked()"
            (applied)="applyDraft($event)"
            (questionsApplied)="applyQuestions($event)"
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
      @if (assignment(); as current) {
        <tb-assign-more-dialog
          [assignmentId]="current.id"
          [assigned]="givenTo()"
          (saved)="given($event)"
        />
      }
      <tb-bind-textbook-dialog
        [(visible)]="bindVisible"
        [taken]="textbooks()"
        [bound]="binding()"
        (picked)="pickTextbook($event)"
      />
    } @else {
      <tb-page-header [title]="t.editAssignment" back="/teacher/homework" [backLabel]="t.back" />
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()" />
    }
  `,
  styles: `
    .tb-editor__ai {
      background: var(--p-md-surface-container-low);
    }

    .tb-editor__ai-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-2);
    }

    .tb-editor {
      min-width: 0;
    }

    .tb-editor__layout {
      display: flex;
      align-items: flex-start;
      gap: var(--tb-space-6);
    }

    .tb-editor__nav {
      position: sticky;
      inset-block-start: var(--tb-space-4);
      flex: 0 0 12.5rem;
    }

    .tb-editor__form {
      flex: 1;
      min-width: 0;
    }

    .tb-editor__chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-editor__text {
      width: 100%;
    }

    .tb-editor__materials {
      display: grid;
      gap: var(--tb-space-2);
    }

    .tb-editor__row {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
    }

    .tb-editor__grow {
      flex: 1;
    }
  `,
})
export class AssignmentEditorPage implements OnInit, CanLeave {
  protected readonly t = T.editor;
  protected readonly c = T.create;
  protected readonly maxVideos = MAX_VIDEOS;
  private readonly size = injectWindowSize();
  protected readonly compact = computed(() => this.size() === 'compact');
  protected readonly single = computed(() => this.size() === 'compact' || this.size() === 'medium');
  protected readonly aiOpen = signal(false);
  protected readonly modalAiOpen = signal(false);

  protected toggleAi(): void {
    if (this.single()) this.modalAiOpen.update((open) => !open);
    else this.aiOpen.update((open) => !open);
  }
  protected readonly tq = T.quiz;
  private readonly api = inject(HomeworkApi);
  private readonly ai = inject(AiApi);
  private readonly identity = inject(IdentityApi);
  private readonly schedule = inject(ScheduleApi);
  private readonly router = inject(Router);
  private readonly snackbar = inject(Snackbar);
  private readonly confirm = inject(Confirm);
  private readonly handover = inject(AssignmentDraftHandover);
  protected readonly materials = inject(MaterialOpener);

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
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(20_000)],
    }),
    members: new FormControl<MemberSelection[]>([], { nonNullable: true }),
  });

  /** The height of the text field, kept while the preview is shown so switching never moves the page. */
  protected readonly editorHeight = signal<number | null>(null);
  private readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  protected readonly modeValue = toSignal(
    this.mode.valueChanges.pipe(
      tap(() => {
        const field = this.editor();
        if (field) {
          this.editorHeight.set(field.nativeElement.offsetHeight);
        }
      }),
    ),
    {
      initialValue: this.mode.value,
    },
  );
  protected readonly textValue = toSignal(this.form.controls.description.valueChanges, {
    initialValue: '',
  });
  /** The first line of the text, without Markdown marks. */
  protected readonly titleValue = computed(() => titleOf(this.textValue()));
  private readonly chosenMembers = toSignal(this.form.controls.members.valueChanges, {
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

  /** A saved assignment nobody has yet: its students are still a choice. */
  protected readonly isDraft = computed(() => this.assignment()?.tasks.length === 0);
  /** The students of an issued assignment; «Выдать ещё» adds more. */
  protected readonly givenTo = computed(
    () => this.assignment()?.tasks.map((task) => task.studentId) ?? [],
  );
  private readonly assignMore = viewChild(AssignMoreDialog);
  /** The student list is in: only then a draft's students are saved (an empty list must not wipe them). */
  private readonly studentsLoaded = signal(false);
  protected readonly showNav = computed(() => !this.single() && !this.aiOpen());
  protected readonly navItems = computed<SectionNavItem[]>(() => {
    const materials =
      (this.isNew() ? this.textbooks().length + this.newFiles().length : 0) +
      this.videos().length +
      (this.onBoard() ? 1 : 0);
    const questions = this.questions().length;
    return [
      { id: 'editor-task', icon: 'description', label: this.t.sectionTask },
      {
        id: 'editor-materials',
        icon: 'attach_file',
        label: materials === 0 ? this.c.materials : this.t.sectionMaterials(materials),
      },
      ...(this.quizShown()
        ? [
            {
              id: 'editor-quiz',
              icon: 'quiz',
              label: this.t.sectionQuestions(questions),
            },
            ...(questions > 0
              ? [{ id: 'quiz-settings', icon: 'tune', label: this.t.sectionSettings }]
              : []),
          ]
        : []),
    ];
  });

  protected readonly students = signal<StudentOption[]>([]);
  protected readonly groups = signal<StudentGroup[]>([]);
  protected readonly studentOptions = computed(() =>
    this.students().map((student) => ({ id: student.id, name: student.displayName })),
  );
  /** The students the assignment goes to: the chosen ones and the members of the chosen groups. */
  protected readonly recipients = computed(() =>
    memberRecipients(
      this.chosenMembers(),
      this.groups(),
      this.students().map((student) => student.id),
    ),
  );
  /** Lessons ahead, for the due date of a new assignment. */
  private readonly lessons = signal<readonly ScheduledLesson[]>([]);
  protected readonly nextLesson = computed(() =>
    this.isNew() ? nextLessonStart(this.lessons(), this.recipients(), new Date()) : null,
  );
  protected readonly dueChoice = signal<Due>('lesson');
  protected readonly duePicked = signal<Date | null>(null);
  /** The teacher changed the due date: leaving asks. */
  private readonly dueChanged = signal(false);
  private readonly dueAt = computed(() =>
    dueAtOf(this.dueChoice(), this.nextLesson(), this.duePicked()),
  );

  readonly newFiles = signal<File[]>([]);
  /** The videos by link (ADR-0047): saved with the assignment, the whole list. */
  readonly videos = signal<readonly VideoDraft[]>([]);
  /** The teacher changed the videos: leaving asks. */
  private readonly videosChanged = signal(false);
  /** The questions of the quiz (ADR-0052) and how it goes; saved with the assignment. */
  readonly questions = signal<readonly QuestionDraft[]>([]);
  protected readonly quizReveal = signal<QuizReveal>('AFTER_SUBMIT');
  /** 0 — unlimited. */
  protected readonly quizAttempts = signal(1);
  /** The teacher changed the quiz: leaving asks and the quiz is sent. */
  private readonly quizChanged = signal(false);
  /** A student started the quiz: the questions can no longer change. */
  protected readonly quizLocked = signal(false);
  protected readonly quizError = signal<string | null>(null);
  /** A save was tried: each question says what is wrong with it. */
  protected readonly quizChecked = signal(false);
  /** «Тест с вопросами» was added from the chips: the section shows although it has no questions yet. */
  protected readonly quizOpen = signal(false);
  protected readonly quizShown = computed(() => this.quizOpen() || this.questions().length > 0);
  /** The assignment goes on a board once saved: «Доска». */
  protected readonly onBoard = signal(false);
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
  /** The saved assignment going on a board: «Выдать и разместить на доске». */
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
  protected readonly assignMenu: MenuItem[] = [
    {
      label: T.create.assignToBoard,
      icon: 'tb-i tb-i-co_present',
      command: () => {
        this.save(true);
      },
    },
  ];
  protected readonly aiEnabled = toSignal(this.ai.enabled$, { initialValue: false });
  protected readonly pending = signal(false);
  /** The save in progress only keeps a draft. */
  protected readonly draftOnly = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Set once the work is saved: leaving asks nothing then. */
  private saved = false;

  constructor() {
    pageDetail(() => this.assignment()?.title);
  }

  ngOnInit(): void {
    if (this.isNew()) {
      this.takeDraft();
      this.loadStudents();
      this.loadGroups();
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

  /** What was entered in the quick dialog before «Открыть во весь экран». */
  private takeDraft(): void {
    const draft = this.handover.take();
    if (draft === null) {
      return;
    }
    this.form.patchValue({ description: draft.text, members: [...draft.members] });
    this.dueChoice.set(draft.dueAt === null ? 'none' : 'date');
    this.duePicked.set(draft.dueAt);
    this.newFiles.set([...draft.files]);
    this.pickedTextbooks.set(draft.textbooks);
    this.videos.set(draft.videos);
    this.videosChanged.set(draft.videos.length > 0);
    this.form.markAsDirty();
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
        const text = assignment.description ?? '';
        this.form.reset({
          // the title is the first line of the text: a text that does not start with it gets it on top
          description:
            titleOf(text) === assignment.title ? text : `${assignment.title}\n\n${text}`.trimEnd(),
        });
        this.dueChoice.set(assignment.dueAt === null ? 'none' : 'date');
        this.duePicked.set(assignment.dueAt === null ? null : new Date(assignment.dueAt));
        this.videos.set(assignment.videos.map((video) => videoDraft(video)));
        this.loadQuiz(assignment);
        if (assignment.tasks.length === 0) {
          this.loadStudents();
          this.loadGroups();
          this.form.controls.members.setValue(
            assignment.draftStudentIds.map((id) => ({ kind: 'STUDENT' as const, id })),
          );
        }
      });
  }

  private loadQuiz(assignment: AssignmentDetails): void {
    this.questions.set(
      assignment.questions.map((question) => questionDraft(question.type, question)),
    );
    this.quizReveal.set(assignment.quizReveal);
    this.quizAttempts.set(assignment.quizAttempts ?? 0);
  }

  private loadGroups(): void {
    this.identity.listGroups().subscribe((groups) => {
      this.groups.set(groups.filter((group) => group.archivedAt === null));
    });
  }

  private loadStudents(): void {
    this.identity.listStudents().subscribe((students) => {
      this.studentsLoaded.set(true);
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, displayName: student.displayName })),
      );
    });
  }

  protected giveMore(): void {
    this.assignMore()?.open(this.assignment()?.draftStudentIds ?? []);
  }

  /** «Выдать ещё» gave it to more students: the chips and the version follow, the text stays. */
  protected given(details: AssignmentDetails): void {
    this.assignment.set(details);
  }

  protected chooseDue(choice: Due): void {
    this.dueChoice.set(choice);
    this.dueChanged.set(true);
  }

  protected pickDue(date: Date | null): void {
    this.duePicked.set(date);
    this.dueChanged.set(true);
  }

  /**
   * Puts an AI draft into the editor; the teacher reviews it before saving. «Заменить» takes its title and text;
   * «Вставить» adds its text after the teacher's.
   */
  applyDraft({ draft, mode }: AppliedDraft): void {
    const text = this.form.controls.description.value;
    this.form.patchValue({
      description:
        mode === 'insert' && text.trim() !== ''
          ? `${text.trimEnd()}\n\n${draft.description}`
          : `${draft.title}\n\n${draft.description}`,
    });
    this.form.markAsDirty();
    this.mode.setValue('preview');
  }

  /** AI questions go into the quiz; the teacher reviews them in the questions card before saving. */
  applyQuestions({ questions, mode }: AppliedQuestions): void {
    const drafted = questions.map((question) => questionDraft(question.type, question));
    this.changeQuestions(
      (mode === 'replace' ? drafted : [...this.questions(), ...drafted]).slice(0, MAX_QUESTIONS),
    );
    this.form.markAsDirty();
  }

  changeVideos(videos: readonly VideoDraft[]): void {
    this.videos.set(videos);
    this.videosChanged.set(true);
  }

  protected addVideo(): void {
    this.changeVideos([...this.videos(), videoDraft()]);
  }

  changeQuestions(questions: readonly QuestionDraft[]): void {
    this.questions.set(questions);
    this.quizChanged.set(true);
  }

  /** Takes the whole test out of the assignment. */
  protected removeQuiz(): void {
    this.quizOpen.set(false);
    this.quizError.set(null);
    this.changeQuestions([]);
  }

  changeReveal(reveal: QuizReveal): void {
    this.quizReveal.set(reveal);
    this.quizChanged.set(true);
  }

  changeAttempts(attempts: number): void {
    this.quizAttempts.set(attempts);
    this.quizChanged.set(true);
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

  /** «Сохранить черновик»: creates the assignment and keeps its students, gives nothing out. */
  saveDraft(): void {
    this.persist(false, false);
  }

  /** Saves (a new assignment is given out); `toBoard` then puts it on a board of its students. */
  save(toBoard = false): void {
    this.persist(true, toBoard);
  }

  private persist(give: boolean, toBoard: boolean): void {
    if (!revealErrors(this.form) || this.pending()) {
      return;
    }
    const title = this.titleValue();
    if (title === '') {
      this.error.set(this.c.needText);
      return;
    }
    const students = this.recipients();
    const existing = this.assignment();
    if (give && existing === null && students.length === 0) {
      this.error.set(this.c.needWhom);
      return;
    }
    this.quizChecked.set(true);
    if (!this.quizLocked() && firstProblem(this.questions()) !== null) {
      this.quizError.set(T.quiz.failed);
      return;
    }
    this.quizError.set(null);
    const text = this.form.controls.description.value;
    const dueAt = this.dueAt();
    const input: AssignmentInput = {
      title,
      description: text.trim() === '' ? null : text,
      dueAt: dueAt === null ? null : dueAt.toISOString(),
      videos: videoInputs(this.videos()),
      ...(this.quizChanged()
        ? {
            ...(this.quizLocked() ? {} : { questions: questionInputs(this.questions()) }),
            quizReveal: this.quizReveal(),
            quizAttempts: this.quizAttempts(),
          }
        : {}),
    };
    this.pending.set(true);
    this.draftOnly.set(!give);
    this.error.set(null);
    const board = toBoard || this.onBoard();
    const saved =
      existing === null
        ? this.api.createAssignment(input).pipe(
            switchMap((created) =>
              this.addMaterials(created.id).pipe(
                switchMap((complete) => {
                  if (students.length === 0) {
                    return of({ assignment: created, complete });
                  }
                  const sent = give
                    ? this.api.assignStudents(created.id, students)
                    : this.api.saveDraftStudents(created.id, students);
                  return sent.pipe(map((assignment) => ({ assignment, complete })));
                }),
              ),
            ),
          )
        : this.api
            .updateAssignment(existing.id, input, existing.version)
            .pipe(
              switchMap((updated) =>
                this.addMaterials(updated.id).pipe(
                  switchMap((complete) =>
                    this.isDraft() && this.studentsLoaded()
                      ? this.api
                          .saveDraftStudents(updated.id, students)
                          .pipe(map((assignment) => ({ assignment, complete })))
                      : of({ assignment: updated, complete }),
                  ),
                ),
              ),
            );
    saved.subscribe({
      next: ({ assignment, complete }) => {
        this.pending.set(false);
        this.saved = true;
        if (complete) {
          this.snackbar.success(
            existing !== null ? T.editor.saved : give ? T.editor.assigned : this.c.drafted,
          );
        } else {
          this.snackbar.error(T.editor.materialsFailed);
        }
        if (board) {
          this.assignment.set(assignment);
          this.placing.set(assignment);
        } else {
          this.leaveTo(assignment);
        }
      },
      error: (error: unknown) => {
        this.pending.set(false);
        const code = problemCode(error);
        if (code?.startsWith('homework.quiz-') === true) {
          this.quizError.set(describeError(error, T.quiz.failed));
          if (code === 'homework.quiz-started') {
            this.lockQuiz();
          }
          return;
        }
        this.error.set(describeError(error, T.editor.failed));
      },
    });
  }

  /** The server has the questions as they were: show those, read-only. */
  private lockQuiz(): void {
    this.quizLocked.set(true);
    this.quizOpen.set(true);
    const saved = this.assignment();
    if (saved !== null) {
      this.questions.set(saved.questions.map((question) => questionDraft(question.type, question)));
    }
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
      this.videosChanged() ||
      this.quizChanged() ||
      this.dueChanged();
    if (this.saved || !dirty) {
      return true;
    }
    return this.confirm.danger({
      header: T.editor.leaveHeader,
      message: T.editor.leaveMessage,
      acceptLabel: T.editor.leave,
    });
  }
}
