import { PaneHeader } from '@shared/ui/panes';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { Button } from 'primeng/button';
import { Placed, ToBoardDialog } from '@features/boards/parts';
import { injectMobile, injectWindowSize } from '@core/layout/mobile';
import { FileSaver } from '@shared/files/file-saver';
import { MarkdownView } from '@shared/ui/markdown-view';
import { Busy } from '@shared/ui/busy';
import { Segment, SegmentGroup } from '@shared/ui/segment-group';
import { HomeworkApi } from '../data-access/homework-api';
import { assignmentBoard } from './assignment-board';
import { MaterialOpener } from './material-opener';
import {
  AssignmentDetails,
  Attachment,
  QuizStats,
  TaskSummary,
} from '../data-access/homework.models';
import { AttachmentList } from '../ui/attachment-list';
import { TextbookList } from '../ui/textbook-list';
import { VideoList } from '../ui/video-list';
import { AssignMoreDialog } from './assign-more-dialog';
import { PageHeader } from '@shared/ui/page-header';
import { Confirm } from '@shared/ui/confirm';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { Snackbar } from '@core/snackbar/snackbar';
import { pageDetail } from '@core/routing/page-detail';
import { T } from '../i18n/texts';
import { AssignmentGroups, AssignmentTiles } from './assignment/assignment-students';
import { QuizMistakes } from './assignment/quiz-mistakes';
import { TaskLines } from './assignment/task-lines';

type Tab = 'students' | 'task' | 'errors';

/** The text of the assignment is folded to three lines once it is longer than this (or has more lines). */
const FOLD_LENGTH = 160;
const FOLD_LINES = 3;

/**
 * Teacher: one assignment. The header has «Изменить» (outlined, the secondary action beside the filled
 * one) and «Проверить N работ». From large (sketch 4) the task takes the main column — the whole text,
 * the materials, the test — and the students a narrow one, grouped by status with one action a row, the
 * mistakes by question under them. Narrower (sketch 18) the students are tiles with the answer preview
 * and the aside holds the folded text, the materials and the mistakes. On a phone the three become tabs
 * and the review button sticks to the bottom.
 */
@Component({
  selector: 'tb-assignment-page',
  imports: [
    PaneHeader,
    VideoList,
    AssignmentGroups,
    AssignmentTiles,
    Button,
    MarkdownView,
    AttachmentList,
    AssignMoreDialog,
    TextbookList,
    QuizMistakes,
    ToBoardDialog,
    PageHeader,
    LoadStateView,
    Menu,
    Tag,
    Tooltip,
    ButtonAttributes,
    SegmentGroup,
    NgTemplateOutlet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (details(); as assignment) {
      <ng-template tbPaneHeader
        ><tb-page-header
          [class.tb-page-header--one-line]="oneLine()"
          [title]="assignment.title"
          [back]="single() ? '/teacher/homework' : null"
          [backLabel]="t.back"
        >
          <span meta>{{ subtitle(assignment) }}</span>
          <p-button
            variant="outlined"
            [label]="t.edit"
            icon="tb-i tb-i-edit"
            (onClick)="edit(assignment)"
          />
          @if (toReview().length > 0 && !mobile()) {
            <p-button
              [label]="t.reviewWorks(toReview().length)"
              icon="tb-i tb-i-rate_review"
              (onClick)="review()"
            />
          }
          <p-button
            icon="tb-i tb-i-more_vert"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [pTooltip]="m.actions"
            [ariaLabel]="m.actions"
            [tbAttributes]="{ 'aria-haspopup': 'menu' }"
            (onClick)="menu.toggle($event)"
          />
          <p-menu
            #menu
            [model]="menuItems(assignment)"
            [popup]="true"
            appendTo="body"
          /> </tb-page-header
      ></ng-template>

      @if (mobile()) {
        <tb-segment-group
          class="tb-asg__tabs"
          [label]="t.tabs"
          [segments]="tabs()"
          [(value)]="tab"
        />
      }

      @if (wide()) {
        <!-- a wide window (sketch 4): the task in the main column, the students by status in a narrow one -->
        <div class="tb-asg tb-asg--wide">
          <section class="tb-asg__task" [attr.aria-label]="t.assignment">
            @if (assignment.description; as description) {
              <tb-markdown class="tb-asg__body" [text]="description" />
            } @else {
              <p class="tb-muted">{{ t.noText }}</p>
            }
            @if (assignment.attachments.length > 0 || assignment.textbooks.length > 0) {
              <h2 class="tb-asg__label">{{ t.materials }}</h2>
              <div class="tb-list-group tb-asg__block">
                <tb-textbook-list
                  [textbooks]="assignment.textbooks"
                  (opened)="materials.textbook($event)"
                />
                <tb-attachment-list
                  [attachments]="assignment.attachments"
                  [openable]="true"
                  (opened)="materials.file($event)"
                  (download)="download($event)"
                />
              </div>
            }
            @if (assignment.videos.length > 0) {
              <h2 class="tb-asg__label">{{ tv.title }}</h2>
              <tb-video-list class="tb-asg__block" [videos]="assignment.videos" [teacher]="true" />
            }
            @if (assignment.questions.length > 0) {
              <p class="tb-asg__quiz tb-asg__block">
                <i class="tb-i tb-i-quiz" aria-hidden="true"></i>
                {{ te.quizTitle }} · {{ quizSummary(assignment) }}
              </p>
            }
          </section>

          <aside class="tb-asg__students" [attr.aria-label]="t.students">
            <div class="tb-asg__head">
              <h2 class="tb-asg__label tb-asg__spacer">
                {{ t.studentsCount(assignment.tasks.length) }}
              </h2>
              <p-button
                icon="tb-i tb-i-person_add"
                [text]="true"
                [rounded]="true"
                severity="secondary"
                [pTooltip]="t.assignMoreShort"
                [ariaLabel]="t.assignMoreShort"
                (onClick)="assignMore.open(assignment.draftStudentIds)"
              />
            </div>
            <tb-assignment-groups
              [tasks]="assignment.tasks"
              [dueAt]="assignment.dueAt"
              [busy]="busy"
              (open)="reviewWork.emit($event)"
              (remind)="remind($event)"
            />
            <ng-container [ngTemplateOutlet]="errors" />
          </aside>
        </div>
      } @else {
        <div class="tb-asg">
          @if (showStudents()) {
            <section class="tb-asg__main">
              <div class="tb-asg__head">
                <h2 class="tb-asg__label">{{ t.students }}</h2>
                @if (counts().accepted > 0) {
                  <p-tag [value]="t.tagAccepted(counts().accepted)" severity="success" />
                }
                @if (toReview().length > 0) {
                  <p-tag [value]="t.tagToReview(toReview().length)" severity="warn" />
                }
                @if (counts().returned > 0) {
                  <p-tag [value]="t.tagReturned(counts().returned)" severity="danger" />
                }
                <span class="tb-asg__spacer"></span>
                <p-button
                  [label]="t.assignMoreShort"
                  icon="tb-i tb-i-person_add"
                  [text]="true"
                  (onClick)="assignMore.open(assignment.draftStudentIds)"
                />
              </div>
              <tb-assignment-tiles
                [tasks]="assignment.tasks"
                [dueAt]="assignment.dueAt"
                [busy]="busy"
                (open)="reviewWork.emit($event)"
                (remind)="remind($event)"
              />
            </section>
          }

          @if (showTask() || showErrors()) {
            <aside class="tb-asg__aside">
              @if (showTask()) {
                <section class="tb-asg__side">
                  <h2 class="tb-asg__label">{{ t.assignment }}</h2>
                  @if (assignment.description; as description) {
                    <div class="tb-asg__text" [class.tb-asg__text--folded]="folded(description)">
                      <tb-markdown [text]="description" />
                    </div>
                    @if (isLong(description)) {
                      <p-button
                        class="tb-asg__fold"
                        [label]="expanded() ? t.fold : t.showAll"
                        [text]="true"
                        (onClick)="expanded.set(!expanded())"
                      />
                    }
                  } @else {
                    <p class="tb-muted">{{ t.noText }}</p>
                  }
                  @if (assignment.videos.length > 0) {
                    <h3 class="tb-subtitle">{{ tv.title }}</h3>
                    <tb-video-list [videos]="assignment.videos" [teacher]="true" />
                  }
                  @if (assignment.attachments.length > 0 || assignment.textbooks.length > 0) {
                    <h3 class="tb-subtitle">{{ t.materials }}</h3>
                  }
                  <tb-attachment-list
                    [attachments]="assignment.attachments"
                    [openable]="true"
                    (opened)="materials.file($event)"
                    (download)="download($event)"
                  />
                  <tb-textbook-list
                    [textbooks]="assignment.textbooks"
                    (opened)="materials.textbook($event)"
                  />
                </section>
              }
              @if (showErrors()) {
                <ng-container [ngTemplateOutlet]="errors" />
              }
            </aside>
          }
        </div>
      }

      <ng-template #errors>
        @if (hasQuiz() && stats(); as quizStats) {
          <tb-quiz-mistakes [stats]="quizStats" />
        }
      </ng-template>

      @if (mobile() && toReview().length > 0) {
        <div class="tb-bottom-actions">
          <p-button
            [label]="t.reviewWorks(toReview().length)"
            icon="tb-i tb-i-rate_review"
            (onClick)="review()"
          />
        </div>
      }

      <tb-assign-more-dialog
        #assignMore
        [assignmentId]="assignment.id"
        [assigned]="taskStudents()"
        (saved)="assigned($event)"
      />
      <tb-to-board-dialog
        [(visible)]="boardVisible"
        [title]="assignment.title"
        [markdown]="assignment.description ?? ''"
        [students]="taskStudents()"
        [frame]="board()?.frame ?? null"
        [pictures]="board()?.pictures ?? []"
        (placed)="rememberBoard(assignment.id, $event)"
      />
    } @else {
      <ng-template tbPaneHeader
        ><tb-page-header
          [title]="t.assignment"
          [back]="single() ? '/teacher/homework' : null"
          [backLabel]="t.back"
      /></ng-template>
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()" />
    }
  `,
  styles: `
    /* a label over a block on the pane's surface (M3 label medium, as «Ждут сдачи» in the list) */
    .tb-asg__label {
      margin: 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    /* the students and the aside side by side; the aside wraps under the students when they would be narrower than 560px (as the sketch) */
    .tb-asg {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-5);
      align-items: flex-start;
    }

    /* sketch 4: the task takes the main column, the students a narrow one (320–380 px, our decision) */
    .tb-asg--wide {
      flex-wrap: nowrap;
      gap: var(--tb-space-6);
    }

    /* the task column stops at a readable measure and the students follow it, so a very wide window
       leaves the free space at the end rather than between the two (our decision) */
    .tb-asg__task {
      flex: 0 1 48rem;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
    }

    /* the text keeps a readable measure; the materials and the test line stay as wide as a list */
    .tb-asg__body {
      max-inline-size: 72ch;
      font: var(--tb-type-body-l);
    }

    .tb-asg__block {
      max-inline-size: 40rem;
    }

    /* the test line: a tonal row with the quiz icon (sketch 4) */
    .tb-asg__quiz {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      margin: 0;
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg-plus);
      background: var(--p-md-surface-container-low);
      font: var(--tb-type-body-m);

      .tb-i {
        color: var(--p-md-primary);
      }
    }

    .tb-asg__students {
      flex: 0 1 23.75rem;
      min-width: 20rem;
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
    }

    .tb-asg__main {
      flex: 999 1 560px;
      min-width: 0;
      container-type: inline-size;
    }

    .tb-asg__head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
      margin-block-end: var(--tb-space-3);
    }

    .tb-asg__spacer {
      flex: 1 1 0;
    }

    .tb-asg__tabs {
      margin-block-end: var(--tb-space-4);
    }

    .tb-asg__aside {
      flex: 1 1 340px;
      max-inline-size: 420px;
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
    }

    .tb-asg__side {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      padding: var(--tb-space-4);
      border-radius: 20px;
      background: var(--p-md-surface-container-low);
    }

    /* the text folded to three lines until «Показать полностью» */
    .tb-asg__text--folded {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
    }

    .tb-asg__fold {
      align-self: flex-start;
    }
  `,
})
export class AssignmentPage {
  protected readonly t = T.page;
  protected readonly tv = T.videos;
  protected readonly r = T.remove;
  protected readonly m = T.menu;
  private readonly api = inject(HomeworkApi);
  private readonly router = inject(Router);
  private readonly confirm = inject(Confirm);
  private readonly snackbar = inject(Snackbar);
  private readonly fileSaver = inject(FileSaver);
  protected readonly materials = inject(MaterialOpener);
  protected readonly mobile = injectMobile();
  private readonly size = injectWindowSize();
  /** From expanded the title is one line with the actions on its right (sketch 4); narrower it wraps (18). */
  protected readonly oneLine = computed(
    () => this.size() !== 'compact' && this.size() !== 'medium',
  );
  private readonly lines = new TaskLines(new DatePipe(inject(LOCALE_ID)));
  protected readonly busy = new Busy();

  /** Route parameter. */
  readonly assignmentId = input.required<string>();
  /** One pane at a time: the header has «back» to the list. */
  readonly single = input(false);
  /** The assignment changed (given to more students, deleted): the list beside it changes. */
  readonly changed = output();
  /** «Проверить»: a work of this assignment opens, the queue is its works. */
  readonly reviewWork = output<string>();

  protected readonly details = signal<AssignmentDetails | null>(null);
  /** The students of the assignment: «На доску» offers only their boards. */
  protected readonly taskStudents = computed(
    () => this.details()?.tasks.map((task) => task.studentId) ?? [],
  );
  /** The works to review, in the order of the students. */
  protected readonly toReview = computed(
    () => this.details()?.tasks.filter((task) => task.status === 'SUBMITTED') ?? [],
  );
  protected readonly counts = computed(() => {
    const tasks = this.details()?.tasks ?? [];
    return {
      accepted: tasks.filter((task) => task.status === 'ACCEPTED').length,
      returned: tasks.filter((task) => task.status === 'RETURNED').length,
    };
  });

  /** A phone shows one of the tabs at a time; the wide window shows everything. */
  protected readonly tab = signal<Tab>('students');
  protected readonly tabs = computed<Segment<Tab>[]>(() => [
    { value: 'students', label: T.page.tabStudents, count: this.details()?.tasks.length },
    { value: 'task', label: T.page.tabTask },
    ...(this.hasQuiz() ? [{ value: 'errors' as const, label: T.page.tabErrors }] : []),
  ]);
  protected readonly hasQuiz = computed(() => (this.details()?.questions.length ?? 0) > 0);
  protected readonly showStudents = computed(() => !this.mobile() || this.tab() === 'students');
  protected readonly showTask = computed(() => !this.mobile() || this.tab() === 'task');
  protected readonly showErrors = computed(
    () => this.hasQuiz() && (!this.mobile() || this.tab() === 'errors'),
  );
  /** From large the task and the students stand side by side (sketch 4); narrower — the tiles of sketch 18. */
  protected readonly wide = computed(
    () => this.size() === 'large' || this.size() === 'extra-large',
  );
  protected readonly te = T.editor;
  /** The text of the assignment is shown whole. */
  protected readonly expanded = signal(false);

  constructor() {
    pageDetail(() => this.details()?.title);
    // the page stays when the list opens another assignment
    effect(() => {
      this.assignmentId();
      untracked(() => {
        this.details.set(null);
        this.expanded.set(false);
        this.tab.set('students');
        this.load();
      });
    });
  }
  protected readonly boardVisible = signal(false);
  /** A text, a picture or a textbook page to put on a board. */
  protected readonly hasBoardMaterial = computed(() => {
    const assignment = this.details();
    return (
      assignment !== null &&
      (!!assignment.description || assignmentBoard(assignment, new Date()).pictures.length > 0)
    );
  });
  /** «На доску» puts the text, the pictures and the textbook pages of the assignment in a dated frame. */
  protected readonly board = computed(() => {
    const assignment = this.details();
    return assignment === null || !this.boardVisible()
      ? null
      : assignmentBoard(assignment, new Date());
  });
  protected readonly tq = T.quizReview;
  protected readonly stats = signal<QuizStats | null>(null);

  protected readonly state = new LoadState();

  protected load(): void {
    this.stats.set(null);
    this.api
      .assignment(this.assignmentId())
      .pipe(this.state.track())
      .subscribe((assignment) => {
        this.details.set(assignment);
        if (assignment.questions.length > 0) {
          this.api.quizStats(assignment.id).subscribe((stats) => {
            this.stats.set(stats);
          });
        }
      });
  }

  /** «5 учеников · до 10.09.2026 15:00». */
  protected subtitle(assignment: AssignmentDetails): string {
    const due =
      assignment.dueAt === null
        ? this.t.noDueDate.toLocaleLowerCase()
        : this.t.until(this.lines.date(assignment.dueAt));
    return `${this.t.recipients(assignment.tasks.length)} · ${due}`;
  }

  protected quizSummary(assignment: AssignmentDetails): string {
    return T.editor.quizSummary(
      assignment.questions.length,
      assignment.questions.reduce((sum, question) => sum + question.points, 0),
      assignment.quizAttempts ?? 0,
    );
  }

  protected isLong(text: string): boolean {
    return text.length > FOLD_LENGTH || text.split('\n').length > FOLD_LINES;
  }

  protected folded(text: string): boolean {
    return this.isLong(text) && !this.expanded();
  }

  /** The first work to review opens in the review sheet; its «Дальше» goes to the next one. */
  protected review(): void {
    const first = this.toReview()[0];
    if (first !== undefined) {
      this.reviewWork.emit(first.taskId);
    }
  }

  protected edit(assignment: AssignmentDetails): void {
    void this.router.navigate(['/teacher/homework', assignment.id, 'edit']);
  }

  /** «Напомнить»: the student gets a notification; a repeat within the hour is refused by the server. */
  protected remind(task: TaskSummary): void {
    this.busy
      .guard(task.studentId, this.api.remindStudent(this.assignmentId(), task.studentId))
      .subscribe(() => {
        this.snackbar.success(this.t.reminded(task.studentName));
      });
  }

  protected download(file: Attachment): void {
    this.api.teacherFile(file.id).subscribe((blob) => {
      this.fileSaver.save(blob, file.filename);
    });
  }

  protected menuItems(assignment: AssignmentDetails): MenuItem[] {
    return [
      {
        label: T.copy.action,
        icon: 'tb-i tb-i-content_copy',
        command: () => {
          this.copy(assignment);
        },
      },
      {
        label: this.t.toBoard,
        icon: 'tb-i tb-i-co_present',
        disabled: !this.hasBoardMaterial(),
        command: () => {
          this.boardVisible.set(true);
        },
      },
      ...(assignment.boardId === null
        ? []
        : [
            {
              label: this.t.openBoard,
              icon: 'tb-i tb-i-arrow_outward',
              routerLink: ['/teacher/boards', assignment.boardId],
            },
          ]),
      {
        label: this.r.action,
        icon: 'tb-i tb-i-delete',
        command: () => {
          void this.confirmDelete(assignment);
        },
      },
    ];
  }

  /** A draft copy: the list beside reads itself again and the editor of the copy opens. */
  private copy(assignment: AssignmentDetails): void {
    this.api.copyAssignment(assignment.id).subscribe((copy) => {
      this.snackbar.success(T.copy.copied(copy.title));
      this.changed.emit();
      void this.router.navigate(['/teacher/homework', copy.id, 'edit']);
    });
  }

  /** Deletes the assignment with the answers and the files, then back to the list. */
  protected async confirmDelete(assignment: AssignmentDetails): Promise<void> {
    if (
      await this.confirm.danger({
        header: T.remove.header,
        message: T.remove.message(assignment.title),
        acceptLabel: T.remove.confirm,
      })
    ) {
      this.api.deleteAssignment(assignment.id).subscribe(() => {
        this.snackbar.success(T.remove.deleted(assignment.title));
        this.changed.emit();
        void this.router.navigate(['/teacher/homework']);
      });
    }
  }

  /** The board the assignment went on: its students get «Перейти на доску». */
  protected rememberBoard(assignmentId: string, placed: Placed): void {
    this.api.placeOnBoard(assignmentId, placed.board.id).subscribe((updated) => {
      this.details.set(updated);
    });
  }

  protected assigned(updated: AssignmentDetails): void {
    this.details.set(updated);
    this.changed.emit();
    this.snackbar.success(T.page.assigned);
  }
}
