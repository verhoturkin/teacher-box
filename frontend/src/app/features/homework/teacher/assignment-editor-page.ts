import { injectWindowSize } from '@core/layout/mobile';
import { Pane, Panes, PaneHeader } from '@shared/ui/panes';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { Drawer } from 'primeng/drawer';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  OnInit,
  SimpleChanges,
  computed,
  inject,
  input,
  signal,
  viewChild,
  Injector,
  DestroyRef,
  effect,
  untracked,
} from '@angular/core';
import { Location, NgTemplateOutlet } from '@angular/common';
import { SHARED_T } from '@shared/i18n/texts';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, map, of, switchMap, tap } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Menu } from 'primeng/menu';
import { Message } from 'primeng/message';
import { describeError } from '@core/http/error-messages';
import { problemCode } from '@core/http/problem-detail';
import { CanLeave } from '@core/routing/can-leave.guard';
import { pageDetail } from '@core/routing/page-detail';
import { Snackbar } from '@core/snackbar/snackbar';
import {
  AiApi,
  AppliedDraft,
  AppliedQuestions,
  HomeworkAiState,
  SourceOption,
} from '@features/ai/parts';
import { Placed, ToBoardDialog } from '@features/boards/parts';
import { MemberSelection } from '@features/identity/parts';
import { Confirm } from '@shared/ui/confirm';
import { revealErrors } from '@shared/ui/field-errors';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { HomeworkApi } from '../data-access/homework-api';
import {
  AssignmentDetails,
  AssignmentInput,
  Attachment,
  BoundTextbook,
  QuizReveal,
} from '../data-access/homework.models';
import { T } from '../i18n/texts';
import { titleOf } from './assignment-draft';
import { assignmentBoard } from './assignment-board';
import { AssignMoreDialog } from './assign-more-dialog';
import { BindTextbookDialog } from './bind-textbook-dialog';
import { UpcomingLessons } from './next-lesson';
import { QuestionDraft, questionInputs } from './question-drafts';
import { aiSources } from './editor/ai-sources';
import { EditorAi } from './editor/editor-ai';
import { EditorAutosave, EditorWrite } from './editor/editor-autosave';
import { EditorHeader } from './editor/editor-header';
import { EditorQuiz } from './editor/editor-quiz';
import { EditorMaterialsState } from './editor/editor-materials-state';
import { EditorQuizState } from './editor/editor-quiz-state';
import { EditorRecipientsState } from './editor/editor-recipients-state';
import { brokenQuestions, withoutCreate } from './editor/editor-sections';
import { EditorTab, EditorTabs } from './editor/editor-tabs';
import { EditorTask } from './editor/editor-task';
import { QuizSettings } from './quiz-settings';
import { VideoDraft, videoDraft, videoInputs } from './video-section';

/**
 * Teacher: the page that creates an assignment or edits one, on two tabs (sketches 11, 28): «Задание» in the
 * order who gets it, one Markdown text whose first line is the title, the due date as chips,
 * the materials (textbooks, files, videos, a board) and the test as a summary card — and «Тест» with the questions
 * and how the test goes (on a phone «Вопросы» and «Настройки»). A draft saves itself a moment after each change
 * and is given out with «Выдать»: created first, it gets its materials, and only then goes to the students — they
 * are notified with everything in place. An issued assignment has «Сохранить». The AI assistant opens beside.
 * Its parts are in `editor/`: the header, the tabs and the cards, and the state of the quiz, the recipients
 * and the materials.
 */
@Component({
  selector: 'tb-assignment-editor-page',
  imports: [
    ReactiveFormsModule,
    NgTemplateOutlet,
    Pane,
    Panes,
    PaneHeader,
    Drawer,
    ModalDrawer,
    Card,
    Button,
    Menu,
    Message,
    AssignMoreDialog,
    ToBoardDialog,
    PageHeader,
    LoadStateView,
    BindTextbookDialog,
    EditorAi,
    EditorHeader,
    EditorQuiz,
    EditorTabs,
    EditorTask,
    QuizSettings,
  ],
  providers: [HomeworkAiState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ready()) {
      <tb-panes>
        <tb-pane [label]="heading()">
          <ng-template tbPaneHeader>
            <tb-editor-header
              [title]="heading()"
              [back]="backLink()"
              [backLabel]="backLabel()"
              [studentView]="activeTab() === 'quiz' && questions().length > 0"
              [aiEnabled]="aiEnabled()"
              [aiExpanded]="single() ? modalAiOpen() : aiOpen()"
              [draft]="draft()"
              [compact]="compact()"
              [savedAt]="savedAt()"
              [pending]="pending()"
              [autosaving]="autosaving()"
              (openStudentView)="openStudentView()"
              (toggleAi)="toggleAi()"
              (save)="save($event)"
            />
          </ng-template>
          <tb-editor-tabs
            [value]="activeTab()"
            [compact]="compact()"
            [questions]="questions().length"
            (chosen)="choose($event)"
          />
          @if (activeTab() === 'task') {
            <tb-editor-task
              [form]="form"
              [mode]="mode"
              [text]="textValue()"
              [(editorHeight)]="editorHeight"
              [draft]="draft()"
              [compact]="compact()"
              [nav]="!single() && !aiOpen()"
              [tasks]="assignment()?.tasks ?? []"
              [savedFiles]="savedFiles()"
              [videos]="videos()"
              [videoField]="videoField()"
              [questions]="questions()"
              [attempts]="quiz.attempts()"
              [error]="error()"
              [who]="who"
              [materials]="materials"
              (submitted)="save()"
              (videosChange)="changeVideos($event)"
              (openQuiz)="choose('quiz')"
              (more)="giveMore()"
              (removeTextbook)="removeTextbook($event)"
              (removeFile)="removeFile($event)"
              (addVideo)="addVideo()"
              (chooseBoard)="chooseBoard($event)"
            />
          } @else {
            <div class="tb-editor tb-form">
              @if (error(); as message) {
                <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
              }
              @if (activeTab() === 'quiz') {
                <tb-editor-quiz
                  [questions]="questions()"
                  (questionsChange)="changeQuestions($event)"
                  [reveal]="quiz.reveal()"
                  (revealChange)="changeReveal($event)"
                  [attempts]="quiz.attempts()"
                  (attemptsChange)="changeAttempts($event)"
                  [locked]="quiz.locked()"
                  [error]="quiz.error()"
                  [showProblems]="quiz.checked()"
                  [compact]="compact()"
                  [single]="single()"
                  [status]="savedStatus()"
                  [title]="titleValue()"
                  (ai)="openAi()"
                  (copyQuiz)="copyForEdits()"
                />
              }
              @if (activeTab() === 'settings') {
                <p-card id="quiz-settings" styleClass="tb-section-card" [header]="tq.settings">
                  <tb-quiz-settings
                    [reveal]="quiz.reveal()"
                    (revealChange)="changeReveal($event)"
                    [attempts]="quiz.attempts()"
                    (attemptsChange)="changeAttempts($event)"
                  />
                </p-card>
              }
            </div>
          }
        </tb-pane>
        @if (aiEnabled() && !single() && aiOpen()) {
          <tb-pane class="tb-editor__ai" kind="fixed" [label]="t.aiTitle">
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
            <ng-container *ngTemplateOutlet="assistant" />
          </tb-pane>
        }
      </tb-panes>
      @if (aiEnabled() && single()) {
        <p-drawer
          tbModalDrawer
          [(visible)]="modalAiOpen"
          [header]="t.aiTitle"
          [ariaCloseLabel]="t.closeAi"
          [position]="compact() ? 'bottom' : 'right'"
          [blockScroll]="true"
          [styleClass]="compact() ? 'tb-sheet tb-editor-ai-drawer' : 'tb-editor-ai-drawer'"
          [style]="compact() ? {} : { width: 'min(100vw, 25rem)' }"
        >
          <ng-container *ngTemplateOutlet="assistant" />
        </p-drawer>
      }
      <ng-template #assistant>
        <tb-editor-ai
          [students]="aiStudents()"
          [compact]="compact()"
          (sourceAdd)="materials.bind()"
          [title]="titleValue()"
          [hasText]="textValue().trim() !== ''"
          [sources]="sourceOptions()"
          [questionCount]="questions().length"
          [quizLocked]="quiz.locked()"
          (applied)="applyDraft($event)"
          (questionsApplied)="applyQuestions($event)"
        />
      </ng-template>

      @if (placing(); as saved) {
        <tb-to-board-dialog
          [visible]="true"
          (visibleChange)="$event || leaveTo(saved)"
          [title]="saved.title"
          [markdown]="saved.description ?? ''"
          [students]="placingStudents()"
          [preferred]="materials.pickedBoard()?.id ?? null"
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
      <p-menu #boardMenu [model]="materials.boardItems()" [popup]="true" appendTo="body" />
      <tb-bind-textbook-dialog
        [(visible)]="materials.bindVisible"
        [taken]="materials.textbooks()"
        [bound]="materials.binding()"
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
  `,
})
export class AssignmentEditorPage implements OnInit, OnChanges, CanLeave {
  protected readonly t = T.editor;
  protected readonly c = T.create;
  protected readonly tq = T.quiz;
  private readonly size = injectWindowSize();
  protected readonly compact = computed(() => this.size() === 'compact');
  protected readonly single = computed(() => this.size() === 'compact' || this.size() === 'medium');
  protected readonly aiOpen = signal(false);
  protected readonly modalAiOpen = signal(false);

  private readonly api = inject(HomeworkApi);
  private readonly ai = inject(AiApi);
  private readonly router = inject(Router);
  private readonly snackbar = inject(Snackbar);
  private readonly confirm = inject(Confirm);
  private readonly aiState = inject(HomeworkAiState);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);

  /** Route parameter of `/teacher/homework/:assignmentId/edit`; none — a new assignment. */
  readonly assignmentId = input<string>();
  /** The schedule's lessons for «к следующему уроку», resolved by the route; none — no hint. */
  readonly upcomingLessons = input<UpcomingLessons>();
  /** The open tab: `?tab=`, then the teacher's choice; «Настройки» is a tab of its own on a phone only. */
  readonly tab = input<string>();

  protected readonly isNew = computed(() => this.assignmentId() === undefined);
  protected readonly assignment = signal<AssignmentDetails | null>(null);
  protected readonly ready = computed(() => this.isNew() || this.assignment() !== null);
  protected readonly state = new LoadState();

  readonly mode = new FormControl<'edit' | 'preview'>('edit', { nonNullable: true });
  readonly form = new FormGroup({
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(20_000)],
    }),
    members: new FormControl<MemberSelection[]>([], { nonNullable: true }),
  });

  protected readonly textValue = toSignal(this.form.controls.description.valueChanges, {
    initialValue: '',
  });
  /** The first line of the text, without Markdown marks. */
  protected readonly titleValue = computed(() => titleOf(this.textValue()));
  /** The height of the text field, kept across the tabs so switching never moves the page. */
  protected readonly editorHeight = signal<number | null>(null);
  private readonly chosenMembers = toSignal(this.form.controls.members.valueChanges, {
    initialValue: [],
  });
  /** The assignment's title as it is typed (sketch 11); before the first line — «Новое задание». */
  protected readonly heading = computed(
    () => this.titleValue() || (this.isNew() ? T.editor.newAssignment : T.editor.editAssignment),
  );
  /** The page the editor was opened from (the list with its filters, the assignment, a student): «Назад» leads there. */
  private readonly origin = withoutCreate(
    (this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation())?.previousNavigation
      ?.finalUrl ?? null,
  );
  protected readonly backLink = computed(() => {
    if (this.origin !== null) {
      return this.origin;
    }
    const assignment = this.assignment();
    return assignment === null || this.isNew()
      ? '/teacher/homework'
      : ['/teacher/homework', assignment.id];
  });
  protected readonly backLabel = computed(() =>
    this.origin !== null ? SHARED_T.common.back : (this.assignment()?.title ?? T.editor.back),
  );

  /** A saved assignment nobody has yet: its students are still a choice. */
  protected readonly isDraft = computed(() => this.assignment()?.tasks.length === 0);
  /** A new assignment or a saved draft: it saves itself and is given out with «Выдать». */
  protected readonly draft = computed(() => this.isNew() || this.isDraft());

  /** The quiz (ADR-0052) and how it goes; saved with the assignment. */
  protected readonly quiz = new EditorQuizState();
  readonly questions = this.quiz.questions;
  /** «Кому · Срок»: the students, the groups and the due date. */
  protected readonly who = new EditorRecipientsState(this.chosenMembers, this.isNew);
  /** The files, textbooks and board added on a save. */
  protected readonly materials = new EditorMaterialsState(this.assignment, this.draft);
  readonly newFiles = this.materials.newFiles;

  private readonly chosenTab = signal<string | null>(null);
  protected readonly activeTab = computed<EditorTab>(() => {
    const tab = this.chosenTab() ?? this.tab();
    if (tab === 'settings') {
      return this.compact() ? 'settings' : 'quiz';
    }
    return tab === 'quiz' ? 'quiz' : 'task';
  });
  /** Files saved with a draft: removed here, an issued assignment has them on its page. */
  protected readonly savedFiles = computed(() =>
    this.isDraft() ? (this.assignment()?.attachments ?? []) : [],
  );
  /** The draft saves itself a moment after each change. */
  private readonly drafts = new EditorAutosave({
    canSave: () => !this.saved && this.titleValue() !== '' && !this.form.invalid,
    snapshot: () => this.snapshot(),
    write: () => this.write(false),
    saved: ({ assignment, complete }) => {
      this.assignment.set(assignment);
      this.error.set(complete ? null : T.editor.materialsFailed);
    },
    failed: (error) => {
      this.refresh();
      this.error.set(describeError(error, T.editor.autosaveFailed));
    },
  });
  /** «сохранено · HH:mm» of the last autosave. */
  protected readonly savedAt = this.drafts.savedAt;
  /** Milliseconds of quiet before a draft saves itself. */
  get autosaveDelay(): number {
    return this.drafts.delay;
  }
  set autosaveDelay(delay: number) {
    this.drafts.delay = delay;
  }
  /** «сохранено · HH:mm» under a question full screen on a phone. */
  protected readonly savedStatus = computed(() => {
    const at = this.savedAt();
    return at === null ? null : this.t.savedAt(at);
  });
  /** The students of an issued assignment; «Выдать ещё» adds more. */
  protected readonly givenTo = computed(
    () => this.assignment()?.tasks.map((task) => task.studentId) ?? [],
  );
  private readonly assignMore = viewChild(AssignMoreDialog);
  private readonly quizView = viewChild(EditorQuiz);
  private readonly boardMenu = viewChild<Menu>('boardMenu');

  /** Whose AI tags the assistant takes: the students it is given to and the ones being chosen. */
  protected readonly aiStudents = computed(() => [
    ...new Set([...this.givenTo(), ...this.who.recipients()]),
  ]);

  /** The videos by link (ADR-0047): saved with the assignment, the whole list. */
  readonly videos = signal<readonly VideoDraft[]>([]);
  /** The teacher changed the videos: leaving asks. */
  private readonly videosChanged = signal(false);
  /** The chip «Видео» shows the link field even before the first video. */
  protected readonly videoField = signal(false);
  private readonly taskView = viewChild(EditorTask);
  /** What the AI may read for a draft (see {@link aiSources}). */
  readonly sourceOptions = computed<SourceOption[]>(() =>
    aiSources(this.assignment(), this.materials.textbooks(), this.newFiles(), this.videos()),
  );
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
  protected readonly aiEnabled = toSignal(this.ai.enabled$, { initialValue: false });
  protected readonly autosaving = this.drafts.autosaving;
  protected readonly pending = this.drafts.pending;
  protected readonly error = signal<string | null>(null);
  /** Set once the work is given out or saved: leaving asks nothing then. */
  private saved = false;
  /** The save gave a draft out: the editor goes back where it was opened from. */
  private issued = false;

  /** What a save sends besides the files and textbooks; a draft whose snapshot differs from the saved one saves itself. */
  private readonly snapshot = computed(() =>
    JSON.stringify([
      this.textValue(),
      this.chosenMembers(),
      this.who.dueAt()?.toISOString() ?? null,
      videoInputs(this.videos()),
      questionInputs(this.questions()),
      this.quiz.reveal(),
      this.quiz.attempts(),
    ]),
  );

  constructor() {
    pageDetail(() => this.assignment()?.title);
    effect(() => {
      const snapshot = this.snapshot();
      const picked = this.materials.waiting();
      untracked(() => {
        if (this.ready() && this.draft() && (picked || this.drafts.differs(snapshot))) {
          this.drafts.schedule();
        }
      });
    });
    // the assistant drafts text on «Задание» and questions on «Тест»
    effect(() => {
      const tab = this.activeTab();
      untracked(() => {
        this.aiState.mode.set(tab === 'task' ? 'TASK' : 'QUESTIONS');
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.drafts.cancel();
    });
  }

  protected toggleAi(): void {
    if (this.single()) this.modalAiOpen.update((open) => !open);
    else this.aiOpen.update((open) => !open);
  }

  /** «С ИИ» of the quiz: the assistant opens on drafting questions. */
  protected openAi(): void {
    if (this.single()) this.modalAiOpen.set(true);
    else this.aiOpen.set(true);
  }

  /** «Как увидит ученик» of the header: the test as the student sees it. */
  protected openStudentView(): void {
    this.quizView()?.openStudentView();
  }

  /** «Создать копию для правок» opens the copy in this same page: it starts over with the copy. */
  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['assignmentId'];
    if (change !== undefined && !change.firstChange) {
      this.quiz.reset();
      this.videosChanged.set(false);
      this.who.dueChanged.set(false);
      this.error.set(null);
      this.load();
    }
  }

  ngOnInit(): void {
    if (this.isNew()) {
      this.drafts.mark(this.snapshot());
      this.who.load();
      this.who.loadLessons(this.upcomingLessons());
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
        const text = assignment.description ?? '';
        this.form.reset({
          // the title is the first line of the text: a text that does not start with it gets it on top
          description:
            titleOf(text) === assignment.title ? text : `${assignment.title}\n\n${text}`.trimEnd(),
        });
        this.who.showDue(assignment.dueAt);
        this.videos.set(assignment.videos.map((video) => videoDraft(video)));
        this.quiz.load(assignment);
        if (assignment.tasks.length === 0) {
          this.who.load();
          this.form.controls.members.setValue(
            assignment.draftStudentIds.map((id) => ({ kind: 'STUDENT' as const, id })),
          );
        }
        this.drafts.mark(this.snapshot());
      });
  }

  /** A locked quiz is changed in a copy of the assignment, opened on «Тест». */
  protected copyForEdits(): void {
    const id = this.assignmentId();
    if (id === undefined) {
      return;
    }
    this.api.copyAssignment(id).subscribe({
      next: (copy) => {
        this.snackbar.success(T.copy.copied(copy.title));
        void this.router.navigate(['/teacher/homework', copy.id, 'edit'], {
          queryParams: { tab: 'quiz' },
        });
      },
      error: (error: unknown) => {
        this.error.set(describeError(error, T.editor.failed));
      },
    });
  }

  protected giveMore(): void {
    this.assignMore()?.open(this.assignment()?.draftStudentIds ?? []);
  }

  /** «Выдать ещё» gave it to more students: the chips and the version follow, the text stays. */
  protected given(details: AssignmentDetails): void {
    this.assignment.set(details);
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
  applyQuestions(applied: AppliedQuestions): void {
    this.quiz.apply(applied);
    this.form.markAsDirty();
  }

  changeVideos(videos: readonly VideoDraft[]): void {
    this.videos.set(videos);
    this.videosChanged.set(true);
  }

  /** The teacher's boards are read when the menu opens. */
  protected chooseBoard(event: Event): void {
    this.boardMenu()?.toggle(event);
    this.materials.loadBoards();
  }

  protected addVideo(): void {
    this.videoField.set(true);
    afterNextRender(
      () => {
        this.taskView()?.focusLink();
      },
      { injector: this.injector },
    );
  }

  changeQuestions(questions: readonly QuestionDraft[]): void {
    this.quiz.changeQuestions(questions);
  }

  changeReveal(reveal: QuizReveal): void {
    this.quiz.changeReveal(reveal);
  }

  changeAttempts(attempts: number): void {
    this.quiz.changeAttempts(attempts);
  }

  /** A textbook for a new assignment, or new pages of one already picked. */
  pickTextbook(textbook: BoundTextbook): void {
    this.materials.pick(textbook);
  }

  /** A picked textbook goes from the list; a saved one of a draft is unbound at once. */
  protected removeTextbook(textbook: BoundTextbook): void {
    this.materials.remove(textbook, this.failed);
  }

  /** A file saved with a draft is removed at once. */
  protected removeFile(file: Attachment): void {
    this.materials.removeFile(file, this.failed);
  }

  private readonly failed = (error: unknown): void => {
    this.error.set(describeError(error, T.editor.failed));
  };

  /** «Задание», «Тест» (or on a phone «Вопросы», «Настройки»): kept in the address as `?tab=`. */
  choose(value: string | number | undefined): void {
    const tab: EditorTab = value === 'quiz' || value === 'settings' ? value : 'task';
    this.chosenTab.set(tab);
    const [path = '', query = ''] = this.location.path().split('?');
    const params = new URLSearchParams(query);
    if (tab === 'task') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    this.location.replaceState(path === '' ? '/' : path, params.toString());
  }

  /** «Выдать» of a draft, «Сохранить» of an issued assignment; `toBoard` then puts it on a board of its students. */
  save(toBoard = false): void {
    if (!revealErrors(this.form)) {
      return;
    }
    if (
      this.drafts.busy(() => {
        this.save(toBoard);
      })
    ) {
      return;
    }
    this.drafts.cancel();
    if (this.titleValue() === '') {
      this.error.set(this.c.needText);
      return;
    }
    const draft = this.draft();
    if (draft && this.who.recipients().length === 0) {
      this.error.set(this.c.needWhom);
      return;
    }
    this.quiz.checked.set(true);
    this.quiz.error.set(null);
    if (this.quiz.hasProblems()) {
      // the «Тест» tab lists the questions to fix
      this.choose('quiz');
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    const board = toBoard || this.materials.pickedBoard() !== null;
    this.write(true).subscribe({
      next: ({ assignment, complete }) => {
        this.pending.set(false);
        this.saved = true;
        this.issued = draft;
        if (!complete) {
          this.snackbar.error(T.editor.materialsFailed);
        } else if (draft) {
          this.snackbar.link(T.editor.assigned, this.c.open, () => {
            void this.router.navigate(['/teacher/homework', assignment.id]);
          });
        } else {
          this.snackbar.success(T.editor.saved);
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
        this.refresh();
        const code = problemCode(error);
        if (code === 'homework.quiz-incomplete') {
          const broken = brokenQuestions(error);
          this.quiz.error.set(T.editor.incomplete(broken.length, broken.join(', ')));
          this.choose('quiz');
          return;
        }
        if (code?.startsWith('homework.quiz-') === true) {
          this.quiz.error.set(describeError(error, T.quiz.failed));
          if (code === 'homework.quiz-started') {
            this.quiz.lock(this.assignment());
          }
          return;
        }
        this.error.set(describeError(error, T.editor.failed));
      },
    });
  }

  /**
   * Creates or updates the assignment, adds the picked files and textbooks, then for a draft gives it out
   * (`give`) or keeps its students. A new assignment is remembered as soon as it exists, so a later step
   * that fails never makes a second one.
   */
  private write(give: boolean): Observable<EditorWrite> {
    const existing = this.assignment();
    const draft = this.draft();
    const students = this.who.recipients();
    const files = this.newFiles();
    const textbooks = this.materials.picked();
    const text = this.form.controls.description.value;
    const dueAt = this.who.dueAt();
    const input: AssignmentInput = {
      title: this.titleValue(),
      description: text.trim() === '' ? null : text,
      dueAt: dueAt === null ? null : dueAt.toISOString(),
      videos: videoInputs(this.videos()),
      ...this.quiz.input(),
    };
    const saved =
      existing === null
        ? this.api.createAssignment(input)
        : this.api.updateAssignment(existing.id, input, existing.version);
    return saved.pipe(
      tap((first) => {
        this.remember(first, existing === null);
      }),
      switchMap((first) =>
        this.materials.send(first.id, files, textbooks).pipe(
          switchMap((complete) => {
            const next = !draft
              ? of(first)
              : give
                ? this.api.assignStudents(first.id, students)
                : (existing === null ? students.length > 0 : this.who.loaded())
                  ? this.api.saveDraftStudents(first.id, students)
                  : files.length + textbooks.length > 0
                    ? this.api.assignment(first.id)
                    : of(first);
            return next.pipe(map((assignment) => ({ assignment, complete })));
          }),
        ),
      ),
    );
  }

  /** The saved assignment and, for one just created, its address (the page stays as it is). */
  private remember(saved: AssignmentDetails, created: boolean): void {
    this.assignment.set(saved);
    if (created) {
      const [, query = ''] = this.location.path().split('?');
      this.location.replaceState(`/teacher/homework/${saved.id}/edit`, query);
    }
  }

  /** After a failed step the version may have moved on: take the assignment as the server has it. */
  private refresh(): void {
    const saved = this.assignment();
    if (saved !== null) {
      this.api.assignment(saved.id).subscribe({
        next: (details) => {
          this.assignment.set(details);
        },
        error: () => {
          // the next save reports what is wrong
        },
      });
    }
  }

  /** The board the saved assignment went on: its students get «Перейти на доску». */
  rememberBoard(assignment: AssignmentDetails, placed: Placed): void {
    this.api.placeOnBoard(assignment.id, placed.board.id).subscribe({
      error: () => {
        this.snackbar.error(T.editor.boardFailed);
      },
    });
  }

  /**
   * After the board dialog, if any, is closed: a given-out draft returns to where the editor was opened (the
   * list, the assignment), a saved assignment to its page.
   */
  leaveTo(assignment: AssignmentDetails): void {
    this.placing.set(null);
    const back = this.issued ? this.backLink() : ['/teacher/homework', assignment.id];
    void (Array.isArray(back) ? this.router.navigate(back) : this.router.navigateByUrl(back));
  }

  /** A draft saves what is left and lets go; an issued assignment asks before leaving changes. */
  canLeave(): boolean | Promise<boolean> {
    if (this.saved) {
      return true;
    }
    if (this.draft()) {
      if (this.unsaved()) {
        this.drafts.run();
      }
      return true;
    }
    const dirty =
      this.form.dirty || this.videosChanged() || this.quiz.changed() || this.who.dueChanged();
    if (!dirty) {
      return true;
    }
    return this.confirm.danger({
      header: T.editor.leaveHeader,
      message: T.editor.leaveMessage,
      acceptLabel: T.editor.leave,
    });
  }

  private unsaved(): boolean {
    return this.materials.waiting() || this.drafts.differs(this.snapshot());
  }
}
