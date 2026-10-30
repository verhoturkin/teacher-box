import { PaneHeader } from '@shared/ui/panes';
import { DatePipe } from '@angular/common';
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
import { Router, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { Button, ButtonDirective, ButtonLabel } from 'primeng/button';
import { Placed, ToBoardDialog } from '@features/boards/parts';
import { injectMobile } from '@core/layout/mobile';
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
import { TaskStatusTag } from '../ui/task-status-tag';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { Confirm } from '@shared/ui/confirm';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { Snackbar } from '@core/snackbar/snackbar';
import { pageDetail } from '@core/routing/page-detail';
import { Avatar } from '@shared/ui/avatar';
import { TeacherColors } from '@features/identity/parts';
import { T } from '../i18n/texts';

type Tab = 'students' | 'task' | 'errors';

/** The text of the assignment is folded to three lines once it is longer than this (or has more lines). */
const FOLD_LENGTH = 160;
const FOLD_LINES = 3;

/**
 * Teacher: one assignment. The header has «Изменить» (outlined, the secondary action beside the filled
 * one) and «Проверить N работ»; the students are tiles with the answer preview, the aside holds the
 * folded text, the materials and the mistakes by question. On a phone the three become tabs and the
 * review button sticks to the bottom.
 */
@Component({
  selector: 'tb-assignment-page',
  imports: [
    PaneHeader,
    VideoList,
    Avatar,
    EmptyState,
    RouterLink,
    Button,
    ButtonDirective,
    ButtonLabel,
    MarkdownView,
    AttachmentList,
    AssignMoreDialog,
    TextbookList,
    TaskStatusTag,
    ToBoardDialog,
    PageHeader,
    LoadStateView,
    Menu,
    Tag,
    Tooltip,
    ButtonAttributes,
    SegmentGroup,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (details(); as assignment) {
      <ng-template tbPaneHeader
        ><tb-page-header
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
            @if (assignment.tasks.length > 0) {
              <ul class="tb-asg__tiles" [attr.aria-label]="t.students">
                @for (task of assignment.tasks; track task.taskId) {
                  <li class="tb-asg-tile">
                    <div class="tb-asg-tile__head">
                      <tb-avatar
                        [attr.data-tb-label]="colors.studentLabel(task.studentId)"
                        [name]="task.studentName"
                        [photo]="task.studentAvatar"
                      />
                      <div class="tb-asg-tile__who">
                        <span class="tb-asg-tile__name">{{ task.studentName }}</span>
                        <span class="tb-asg-tile__line">{{ statusLine(task) }}</span>
                      </div>
                      <tb-task-status [status]="task.status" [overdue]="task.overdue" />
                    </div>
                    @if (task.answerPreview; as preview) {
                      <p class="tb-asg-tile__preview">{{ preview }}</p>
                    }
                    <div class="tb-asg-tile__foot">
                      @if (task.quizScore !== null && task.quizMax !== null) {
                        <span class="tb-asg-tile__meta"
                          ><i class="tb-i tb-i-quiz" aria-hidden="true"></i
                          >{{ t.quiz(task.quizScore, task.quizMax) }}</span
                        >
                      }
                      @if (task.answerFiles > 0) {
                        <span class="tb-asg-tile__meta"
                          ><i class="tb-i tb-i-attach_file" aria-hidden="true"></i
                          >{{ t.files(task.answerFiles) }}</span
                        >
                      }
                      <span class="tb-asg__spacer"></span>
                      @if (task.status === 'ASSIGNED' || task.status === 'RETURNED') {
                        <p-button
                          severity="secondary"
                          [label]="t.remind"
                          [ariaLabel]="t.action(t.remind, task.studentName)"
                          [loading]="busy.is(task.studentId)"
                          (onClick)="remind(task)"
                        />
                      }
                      <a
                        pButton
                        severity="secondary"
                        [routerLink]="['/teacher/homework/tasks', task.taskId]"
                        [attr.aria-label]="
                          t.action(
                            task.status === 'SUBMITTED' ? t.review : t.open,
                            task.studentName
                          )
                        "
                      >
                        <span pButtonLabel>{{
                          task.status === 'SUBMITTED' ? t.review : t.open
                        }}</span>
                      </a>
                    </div>
                  </li>
                }
              </ul>
            } @else {
              <tb-empty-state icon="tb-i-send" [title]="t.notAssigned" />
            }
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
            @if (showErrors() && stats(); as quizStats) {
              <section class="tb-asg__side">
                <h2 class="tb-asg__label">{{ tq.stats }}</h2>
                @if (quizStats.students === 0) {
                  <p class="tb-muted">{{ tq.statsNone }}</p>
                } @else {
                  <ol class="tb-asg-stats">
                    @for (q of quizStats.questions; track q.questionId; let n = $index) {
                      <li class="tb-asg-stats__row" [attr.title]="plain(q.text)">
                        <span class="tb-asg-stats__n">{{ n + 1 }}</span>
                        <span class="tb-asg-stats__bar" aria-hidden="true"
                          ><span [style.inline-size.%]="(q.wrong / quizStats.students) * 100"></span
                        ></span>
                        <span class="tb-asg-stats__count">{{
                          tq.statsRow(q.wrong, quizStats.students)
                        }}</span>
                      </li>
                    }
                  </ol>
                }
              </section>
            }
          </aside>
        }
      </div>

      @if (mobile() && toReview().length > 0) {
        <div class="tb-asg__bottom">
          <p-button
            styleClass="tb-asg__bottom-button"
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

    /* the students and the aside side by side; one column when the window is narrow (compact: tabs) */
    .tb-asg {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem);
      gap: var(--tb-space-5);
      align-items: start;
    }

    @media (max-width: 62rem) {
      .tb-asg {
        grid-template-columns: minmax(0, 1fr);
      }
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

    .tb-asg__tiles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
      gap: var(--tb-space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    /* a student: a surface container tile (M3 filled card, 20 dp corners; our decision for the content) */
    .tb-asg-tile {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      padding: var(--tb-space-4);
      border-radius: 20px;
      background: var(--p-md-surface-container);
    }

    .tb-asg-tile__head {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
    }

    .tb-asg-tile__who {
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      min-width: 0;
    }

    .tb-asg-tile__name {
      font: var(--tb-type-title-s);
      overflow-wrap: anywhere;
    }

    .tb-asg-tile__line {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }

    .tb-asg-tile__preview {
      display: -webkit-box;
      margin: 0;
      padding: var(--tb-space-3);
      border-radius: 12px;
      background: var(--p-md-surface);
      font: var(--tb-type-body-m);
      overflow: hidden;
      overflow-wrap: anywhere;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
    }

    .tb-asg-tile__foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-3);
    }

    .tb-asg-tile__meta {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-1);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }

    .tb-asg__aside {
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

    /* the mistakes of a question: the number, a bar of the share of students and the count (our decision) */
    .tb-asg-stats {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-asg-stats__row {
      display: grid;
      grid-template-columns: 2rem minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--tb-space-3);
    }

    .tb-asg-stats__n,
    .tb-asg-stats__count {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      white-space: nowrap;
    }

    .tb-asg-stats__bar {
      block-size: 8px;
      border-radius: var(--tb-shape-full, 999px);
      background: var(--p-md-surface-container-highest);
      overflow: hidden;
    }

    .tb-asg-stats__bar > span {
      display: block;
      block-size: 100%;
      background: var(--p-md-error);
    }

    /* a phone: «Проверить N работ» sticks to the bottom of the page */
    .tb-asg__bottom {
      position: sticky;
      inset-block-end: 0;
      margin-block-start: var(--tb-space-4);
      padding-block: var(--tb-space-3);
      background: var(--p-md-surface);
    }

    :host ::ng-deep .tb-asg__bottom-button {
      inline-size: 100%;
    }
  `,
})
export class AssignmentPage {
  protected readonly t = T.page;
  protected readonly colors = inject(TeacherColors);
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
  private readonly dates = new DatePipe(inject(LOCALE_ID));
  protected readonly busy = new Busy();

  /** Route parameter. */
  readonly assignmentId = input.required<string>();
  /** One pane at a time: the header has «back» to the list. */
  readonly single = input(false);
  /** The assignment changed (given to more students, deleted): the list beside it changes. */
  readonly changed = output();

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

  /** A question's Markdown as one plain line for the stats. */
  protected plain(text: string): string {
    return text.replace(/[#*_`>-]/g, '').trim();
  }

  protected date(value: string): string {
    return this.dates.transform(value, 'dd.MM.yyyy HH:mm') ?? '';
  }

  /** «5 учеников · до 10.09.2026 15:00». */
  protected subtitle(assignment: AssignmentDetails): string {
    const due =
      assignment.dueAt === null
        ? this.t.noDueDate.toLocaleLowerCase()
        : this.t.until(this.date(assignment.dueAt));
    return `${this.t.recipients(assignment.tasks.length)} · ${due}`;
  }

  /** Whole days from the day of `value` to today (0: today, 1: yesterday). */
  private daysAgo(value: string): number {
    const day = (date: Date): number =>
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((day(new Date()) - day(new Date(value))) / 86_400_000);
  }

  private time(value: string): string {
    return this.dates.transform(value, 'HH:mm') ?? '';
  }

  private when(value: string): string {
    const days = this.daysAgo(value);
    return days === 0
      ? this.t.today
      : days === 1
        ? this.t.yesterday
        : (this.dates.transform(value, 'dd.MM') ?? '');
  }

  /** «Сдано сегодня, 09:12», «Принято вчера · оценка 4», «Отправлено на доработку 28.10». */
  protected statusLine(task: TaskSummary): string {
    if (task.status === 'ACCEPTED' && task.reviewedAt !== null) {
      const when = this.when(task.reviewedAt);
      return task.grade === null ? this.t.acceptedOn(when) : this.t.acceptedGrade(when, task.grade);
    }
    if (task.status === 'RETURNED' && task.reviewedAt !== null) {
      return this.t.returnedOn(this.dates.transform(task.reviewedAt, 'dd.MM') ?? '');
    }
    if (task.submittedAt === null) {
      return this.t.notSubmitted;
    }
    const days = this.daysAgo(task.submittedAt);
    return days === 0
      ? this.t.submittedToday(this.time(task.submittedAt))
      : days === 1
        ? this.t.submittedYesterday(this.time(task.submittedAt))
        : this.t.submittedAt(this.date(task.submittedAt));
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
      void this.router.navigate(['/teacher/homework/tasks', first.taskId]);
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
