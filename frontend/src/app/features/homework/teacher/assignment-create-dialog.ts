import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  LOCALE_ID,
  computed,
  effect,
  inject,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, catchError, concat, last, map, of, switchMap, toArray } from 'rxjs';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Drawer } from 'primeng/drawer';
import { Menu } from 'primeng/menu';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { injectWindowSize } from '@core/layout/mobile';
import { Snackbar } from '@core/snackbar/snackbar';
import { AiApi, AppliedDraft, HomeworkAiPanel, HomeworkAiState } from '@features/ai/parts';
import { Placed, ToBoardDialog } from '@features/boards/parts';
import {
  IdentityApi,
  MemberPicker,
  MemberSelection,
  StudentGroup,
  memberRecipients,
} from '@features/identity/parts';
import { ScheduleApi, ScheduledLesson } from '@features/schedule/parts';
import { toIsoDate } from '@shared/dates/iso-date';
import { SHARED_T } from '@shared/i18n/texts';
import { TbDialog, DialogFooter, DialogHeaderActions } from '@shared/ui/dialog/dialog';
import { FilterChip, FilterChips } from '@shared/ui/filter-chips';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentDetails, BoundTextbook } from '../data-access/homework.models';
import { T } from '../i18n/texts';
import { FilePicker } from '../ui/file-picker';
import { TextbookList } from '../ui/textbook-list';
import { AssignmentDraftHandover, titleOf } from './assignment-draft';
import { assignmentBoard } from './assignment-board';
import { BindTextbookDialog } from './bind-textbook-dialog';
import { NEXT_LESSON_DAYS, nextLessonStart } from './next-lesson';
import { MAX_VIDEOS, VideoDraft, VideoSection, videoDraft, videoInputs } from './video-section';

type Due = 'lesson' | 'week' | 'none' | 'date';

const WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * «Новое задание» over the list: who gets it, one Markdown text whose first line is the title, the due date
 * as chips, and the materials that appear once added. «Выдать» creates the assignment, adds the materials
 * and gives it out; «Сохранить черновик» only creates it. A test with questions is too big for the dialog:
 * it opens the full editor, as does «Открыть во весь экран» (the entered state goes along).
 */
@Component({
  selector: 'tb-assignment-create-dialog',
  imports: [
    ReactiveFormsModule,
    TbDialog,
    DialogFooter,
    DialogHeaderActions,
    Button,
    DatePicker,
    Drawer,
    Menu,
    Textarea,
    ModalDrawer,
    FilterChips,
    MemberPicker,
    HomeworkAiPanel,
    ToBoardDialog,
    FilePicker,
    TextbookList,
    BindTextbookDialog,
    VideoSection,
  ],
  providers: [HomeworkAiState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      #dialog
      kind="form"
      width="wide"
      [(visible)]="visible"
      [headline]="t.title"
      [confirmLabel]="t.assign"
      [pending]="pending() && !draftOnly()"
      [error]="error()"
      [dirty]="dirty()"
      (confirm)="issue(false)"
    >
      <ng-template tbDialogHeaderActions>
        <p-button
          icon="tb-i tb-i-open_in_full"
          severity="secondary"
          [text]="true"
          [rounded]="true"
          [ariaLabel]="t.fullscreen"
          (onClick)="openFullscreen()"
        />
        @if (!compact()) {
          <p-button
            icon="tb-i tb-i-close"
            severity="secondary"
            [text]="true"
            [rounded]="true"
            [ariaLabel]="close"
            (onClick)="dialog.requestClose()"
          />
        }
      </ng-template>

      <div class="tb-create">
        <div class="tb-field">
          <label for="create-whom">{{ t.whom }}</label>
          <tb-member-picker
            inputId="create-whom"
            [formControl]="members"
            [placeholder]="t.whomPlaceholder"
            [students]="studentOptions()"
            [groups]="groups()"
          />
        </div>

        <div class="tb-field">
          <label for="create-text">{{ t.task }}</label>
          <div class="tb-create__area">
            <textarea
              pTextarea
              id="create-text"
              #field
              class="tb-create__text"
              [formControl]="text"
              [autoResize]="true"
              rows="6"
            ></textarea>
            <div class="tb-create__tools">
              <p-button
                icon="tb-i tb-i-format_bold"
                severity="secondary"
                [text]="true"
                [rounded]="true"
                [ariaLabel]="t.bold"
                (onClick)="format('**', '**')"
              />
              <p-button
                icon="tb-i tb-i-format_list_bulleted"
                severity="secondary"
                [text]="true"
                [rounded]="true"
                [ariaLabel]="t.list"
                (onClick)="format('- ', '')"
              />
              <p-button
                icon="tb-i tb-i-link"
                severity="secondary"
                [text]="true"
                [rounded]="true"
                [ariaLabel]="t.link"
                (onClick)="format('[', '](https://)')"
              />
              <span class="tb-create__grow"></span>
              @if (aiEnabled()) {
                <p-button
                  [label]="compact() ? t.aiShort : t.ai"
                  icon="tb-i tb-i-auto_awesome"
                  severity="secondary"
                  [ariaLabel]="t.ai"
                  [ariaExpanded]="aiOpen()"
                  (onClick)="aiOpen.set(!aiOpen())"
                />
              }
            </div>
          </div>
          <small class="tb-hint">{{ t.firstLine }}</small>
        </div>

        <tb-filter-chips
          [label]="t.due"
          [chips]="dueChips()"
          [value]="dueValue()"
          (valueChange)="chooseDue($event)"
        />
        @if (dueChoice() === 'date') {
          <p-datepicker
            [formControl]="dueDate"
            [ariaLabel]="t.dueAt"
            [showTime]="true"
            hourFormat="24"
            dateFormat="dd.mm.yy"
            [showIcon]="true"
            appendTo="body"
            [fluid]="true"
          />
        }

        @if (hasMaterials()) {
          <section class="tb-create__materials" [attr.aria-label]="t.materials">
            <h3 class="tb-subtitle">{{ t.materials }}</h3>
            <tb-textbook-list
              [textbooks]="textbooks()"
              [editable]="true"
              (edit)="editTextbook($event)"
              (remove)="removeTextbook($event)"
            />
            <tb-video-section [(videos)]="videos" />
            @if (onBoard()) {
              <div class="tb-create__row">
                <i class="tb-i tb-i-co_present" aria-hidden="true"></i>
                <span class="tb-create__grow">{{ t.onBoard }}</span>
                <p-button
                  icon="tb-i tb-i-close"
                  severity="secondary"
                  [text]="true"
                  [rounded]="true"
                  [ariaLabel]="t.remove"
                  (onClick)="onBoard.set(false)"
                />
              </div>
            }
          </section>
        }
        <tb-file-picker #filePicker [(files)]="files" [button]="false" />
        <tb-file-picker
          #photoPicker
          [(files)]="files"
          [button]="false"
          [list]="false"
          [capture]="true"
        />
        <div class="tb-create__assist" role="group" [attr.aria-label]="t.materials">
          @if (compact()) {
            <p-button
              [label]="t.photo"
              icon="tb-i tb-i-photo_camera"
              severity="secondary"
              variant="outlined"
              (onClick)="photoPicker.choose()"
            />
          }
          <p-button
            [label]="t.file"
            icon="tb-i tb-i-attach_file"
            severity="secondary"
            variant="outlined"
            (onClick)="filePicker.choose()"
          />
          <p-button
            [label]="t.textbook"
            icon="tb-i tb-i-menu_book"
            severity="secondary"
            variant="outlined"
            (onClick)="addTextbook()"
          />
          @if (!compact()) {
            <p-button
              [label]="t.video"
              icon="tb-i tb-i-smart_display"
              severity="secondary"
              variant="outlined"
              [disabled]="videos().length >= maxVideos"
              (onClick)="addVideo()"
            />
          }
          <p-button
            [label]="compact() ? t.quizShort : t.quiz"
            icon="tb-i tb-i-quiz"
            severity="secondary"
            variant="outlined"
            (onClick)="openFullscreen()"
          />
          @if (!compact()) {
            <p-button
              [label]="t.board"
              icon="tb-i tb-i-co_present"
              severity="secondary"
              variant="outlined"
              [disabled]="onBoard()"
              (onClick)="onBoard.set(true)"
            />
          }
        </div>
      </div>

      <ng-template tbDialogFooter>
        <p-button
          [label]="t.saveDraft"
          severity="secondary"
          [text]="true"
          [loading]="pending() && draftOnly()"
          (onClick)="saveDraft()"
        />
        @if (!compact()) {
          <span class="tb-create__grow"></span>
          <span class="tb-split" role="group" [attr.aria-label]="t.assign">
            <p-button
              styleClass="tb-split__main"
              [label]="t.assign"
              icon="tb-i tb-i-send"
              [loading]="pending() && !draftOnly()"
              (onClick)="issue(false)"
            />
            <p-button
              styleClass="tb-split__more"
              icon="tb-i tb-i-expand_more"
              [ariaLabel]="t.assignMenu"
              (onClick)="menu.toggle($event)"
            />
            <p-menu #menu [model]="assignMenu" [popup]="true" appendTo="body" />
          </span>
        }
      </ng-template>
    </tb-dialog>

    @if (aiEnabled()) {
      <p-drawer
        tbModalDrawer
        [(visible)]="aiOpen"
        [header]="t.ai"
        position="right"
        [blockScroll]="true"
        [style]="{ width: 'min(100vw, 25rem)' }"
      >
        <tb-homework-ai-panel
          [title]="titleValue()"
          [hasText]="textValue().trim() !== ''"
          [sources]="[]"
          [quizLocked]="true"
          (applied)="applyDraft($event)"
        />
      </p-drawer>
    }

    @if (placing(); as saved) {
      <tb-to-board-dialog
        [visible]="true"
        (visibleChange)="$event || finish(saved)"
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
  `,
  styles: `
    .tb-create {
      display: grid;
      gap: var(--tb-space-4);
      min-width: 0;
    }

    .tb-create__area {
      display: grid;
      border-radius: var(--tb-shape-md) var(--tb-shape-md) var(--tb-shape-xs) var(--tb-shape-xs);
      background: var(--p-md-surface-container-highest);
      border-bottom: 2px solid var(--p-md-primary);
      padding: var(--tb-space-3) var(--tb-space-4) var(--tb-space-1);
    }

    .tb-create__text {
      width: 100%;
      min-height: 9rem;
      border: 0;
      background: transparent;
      box-shadow: none;
      padding: 0;
    }

    .tb-create__tools {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
      border-top: 1px solid var(--p-md-outline-variant);
      padding-top: var(--tb-space-1);
    }

    .tb-create__grow {
      flex: 1;
    }

    .tb-create__materials {
      display: grid;
      gap: var(--tb-space-2);
    }

    .tb-create__row {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
    }

    .tb-create__assist {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }
  `,
})
export class AssignmentCreateDialog {
  protected readonly t = T.create;
  protected readonly close = SHARED_T.common.close;
  protected readonly maxVideos = MAX_VIDEOS;
  private readonly api = inject(HomeworkApi);
  private readonly identity = inject(IdentityApi);
  private readonly schedule = inject(ScheduleApi);
  private readonly aiApi = inject(AiApi);
  private readonly router = inject(Router);
  private readonly snackbar = inject(Snackbar);
  private readonly handover = inject(AssignmentDraftHandover);
  private readonly dates = new DatePipe(inject(LOCALE_ID));
  private readonly size = injectWindowSize();

  readonly visible = model(false);
  /** An assignment was created (a draft or given out): the list reads again. */
  readonly saved = output<AssignmentDetails>();

  protected readonly compact = computed(() => this.size() === 'compact');
  protected readonly aiEnabled = toSignal(this.aiApi.enabled$, { initialValue: false });
  protected readonly aiOpen = signal(false);

  readonly members = new FormControl<MemberSelection[]>([], { nonNullable: true });
  readonly text = new FormControl('', { nonNullable: true });
  protected readonly dueDate = new FormControl<Date | null>(null);
  protected readonly textValue = toSignal(this.text.valueChanges, { initialValue: '' });
  protected readonly titleValue = computed(() => titleOf(this.textValue()));
  private readonly chosen = toSignal(this.members.valueChanges, { initialValue: [] });
  private readonly picked = toSignal(this.dueDate.valueChanges, { initialValue: null });

  private readonly students = signal<readonly { id: string; name: string }[]>([]);
  protected readonly studentOptions = this.students;
  protected readonly groups = signal<StudentGroup[]>([]);
  private readonly lessons = signal<readonly ScheduledLesson[]>([]);
  private loaded = false;

  protected readonly recipients = computed(() =>
    memberRecipients(
      this.chosen(),
      this.groups(),
      this.students().map((student) => student.id),
    ),
  );
  private readonly nextLesson = computed(() =>
    nextLessonStart(this.lessons(), this.recipients(), new Date()),
  );

  protected readonly dueChoice = signal<Due>('lesson');
  /** «К следующему занятию» stays only while the chosen students have a lesson ahead. */
  private readonly effectiveDue = computed<Due>(() =>
    this.dueChoice() === 'lesson' && this.nextLesson() === null ? 'none' : this.dueChoice(),
  );
  protected readonly dueChips = computed<FilterChip<Due>[]>(() => {
    const lesson = this.nextLesson();
    return [
      ...(lesson === null
        ? []
        : [
            {
              value: 'lesson' as const,
              label: T.create.nextLesson(this.dates.transform(lesson, 'EEE dd.MM, HH:mm') ?? ''),
            },
          ]),
      { value: 'week', label: T.create.inWeek },
      { value: 'none', label: T.create.noDue },
      { value: 'date', label: T.create.pickDate },
    ];
  });
  /** The chip shown as chosen: the effective one (the lesson chip is hidden without a lesson). */
  protected readonly dueValue = this.effectiveDue;
  private readonly dueAt = computed<Date | null>(() => {
    switch (this.effectiveDue()) {
      case 'lesson':
        return this.nextLesson();
      case 'week':
        return new Date(Date.now() + WEEK);
      case 'date':
        return this.picked();
      case 'none':
        return null;
    }
  });

  protected readonly files = signal<File[]>([]);
  private readonly pickedTextbooks = signal<readonly BoundTextbook[]>([]);
  protected readonly textbooks = this.pickedTextbooks;
  protected readonly videos = signal<readonly VideoDraft[]>([]);
  protected readonly onBoard = signal(false);
  protected readonly hasMaterials = computed(
    () =>
      this.textbooks().length > 0 ||
      this.videos().length > 0 ||
      this.files().length > 0 ||
      this.onBoard(),
  );
  protected readonly bindVisible = signal(false);
  protected readonly binding = signal<BoundTextbook | null>(null);

  protected readonly pending = signal(false);
  protected readonly draftOnly = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dirty = computed(
    () => this.textValue() !== '' || this.chosen().length > 0 || this.hasMaterials(),
  );
  protected readonly placing = signal<AssignmentDetails | null>(null);
  protected readonly placingStudents = computed(
    () => this.placing()?.tasks.map((task) => task.studentId) ?? [],
  );
  protected readonly board = computed(() => {
    const saved = this.placing();
    return saved === null ? null : assignmentBoard(saved, new Date());
  });
  protected readonly assignMenu: MenuItem[] = [
    {
      label: T.create.assignToBoard,
      icon: 'tb-i tb-i-co_present',
      command: () => {
        this.issue(true);
      },
    },
  ];

  private readonly field = viewChild<ElementRef<HTMLTextAreaElement>>('field');

  constructor() {
    effect(() => {
      if (this.visible()) {
        untracked(() => {
          this.reset();
        });
      }
    });
  }

  private reset(): void {
    this.members.reset([]);
    this.text.reset('');
    this.dueDate.reset(null);
    this.dueChoice.set('lesson');
    this.files.set([]);
    this.pickedTextbooks.set([]);
    this.videos.set([]);
    this.onBoard.set(false);
    this.error.set(null);
    this.pending.set(false);
    this.aiOpen.set(false);
    this.load();
  }

  /** Students, groups and the lessons ahead, once. */
  private load(): void {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    this.identity.listStudents().subscribe((students) => {
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, name: student.displayName })),
      );
    });
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
  }

  protected chooseDue(choice: Due): void {
    this.dueChoice.set(choice);
  }

  /** Wraps the selection (or the caret) of the text in Markdown marks. */
  protected format(before: string, after: string): void {
    const element = this.field()?.nativeElement;
    const value = this.text.value;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    this.text.setValue(
      value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end),
    );
    element?.focus();
  }

  /** «Заменить» takes the AI's title and text, «Вставить» adds its text after the teacher's. */
  protected applyDraft({ draft, mode }: AppliedDraft): void {
    this.text.setValue(
      mode === 'insert' && this.text.value.trim() !== ''
        ? `${this.text.value.trimEnd()}\n\n${draft.description}`
        : `${draft.title}\n\n${draft.description}`,
    );
    this.aiOpen.set(false);
  }

  protected addTextbook(): void {
    this.binding.set(null);
    this.bindVisible.set(true);
  }

  protected editTextbook(textbook: BoundTextbook): void {
    this.binding.set(textbook);
    this.bindVisible.set(true);
  }

  protected pickTextbook(textbook: BoundTextbook): void {
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

  protected addVideo(): void {
    this.videos.update((videos) => [...videos, videoDraft()]);
  }

  /** The full editor with everything entered so far. */
  protected openFullscreen(): void {
    this.handover.put({
      text: this.text.value,
      members: this.members.value,
      dueAt: this.dueAt(),
      files: this.files(),
      textbooks: this.pickedTextbooks(),
      videos: this.videos(),
    });
    this.visible.set(false);
    void this.router.navigate(['/teacher/homework/new']);
  }

  protected saveDraft(): void {
    this.save(false, false);
  }

  protected issue(toBoard: boolean): void {
    if (this.recipients().length === 0) {
      this.error.set(this.t.needWhom);
      return;
    }
    this.save(true, toBoard || this.onBoard());
  }

  private save(give: boolean, toBoard: boolean): void {
    if (this.pending()) {
      return;
    }
    const title = this.titleValue();
    if (title === '') {
      this.error.set(this.t.needText);
      return;
    }
    const value = this.text.value;
    const students = this.recipients();
    const dueAt = this.dueAt();
    this.error.set(null);
    this.pending.set(true);
    this.draftOnly.set(!give);
    this.api
      .createAssignment({
        title,
        description: value,
        dueAt: dueAt === null ? null : dueAt.toISOString(),
        videos: videoInputs(this.videos()),
      })
      .pipe(
        switchMap((created) =>
          this.addMaterials(created.id).pipe(
            switchMap((complete) =>
              give
                ? this.api
                    .assignStudents(created.id, students)
                    .pipe(map((assignment) => ({ assignment, complete })))
                : of({ assignment: created, complete }),
            ),
          ),
        ),
      )
      .subscribe({
        next: ({ assignment, complete }) => {
          this.pending.set(false);
          if (complete) {
            this.snackbar.success(give ? T.editor.assigned : this.t.drafted);
          } else {
            this.snackbar.error(T.editor.materialsFailed);
          }
          if (toBoard) {
            this.placing.set(assignment);
          } else {
            this.finish(assignment);
          }
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, T.editor.failed));
        },
      });
  }

  /** The files, then the textbooks; `false` when some did not make it (the assignment is saved anyway). */
  private addMaterials(id: string): Observable<boolean> {
    const files = this.files();
    const textbooks = this.pickedTextbooks();
    const steps: Observable<boolean>[] = [
      ...(files.length === 0 ? [] : [this.api.uploadMaterials(id, files).pipe(map(() => true))]),
      ...textbooks.map((textbook) =>
        this.api.bindTextbook(id, textbook.textbookId, textbook.pages).pipe(map(() => true)),
      ),
    ].map((step) => step.pipe(catchError(() => of(false))));
    return steps.length === 0
      ? of(true)
      : concat(...steps).pipe(
          toArray(),
          map((results) => results.every(Boolean)),
          last(),
        );
  }

  protected rememberBoard(assignment: AssignmentDetails, placed: Placed): void {
    this.api.placeOnBoard(assignment.id, placed.board.id).subscribe({
      error: () => {
        this.snackbar.error(T.editor.boardFailed);
      },
    });
  }

  /** The assignment is in place: the dialog closes and the list reads again. */
  protected finish(assignment: AssignmentDetails): void {
    this.placing.set(null);
    this.visible.set(false);
    this.saved.emit(assignment);
  }
}
