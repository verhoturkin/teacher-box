import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
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
  MemberSelection,
  StudentGroup,
  memberRecipients,
} from '@features/identity/parts';
import { ScheduleApi, ScheduledLesson } from '@features/schedule/parts';
import { toIsoDate } from '@shared/dates/iso-date';
import { SHARED_T } from '@shared/i18n/texts';
import { TbDialog, DialogFooter, DialogHeaderActions } from '@shared/ui/dialog/dialog';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentDetails, BoundTextbook } from '../data-access/homework.models';
import { T } from '../i18n/texts';
import { DueChips, Due, dueAtOf } from '../ui/due-chips';
import { BoardPick, MaterialChips } from '../ui/material-chips';
import { RecipientsField } from '../ui/recipients-field';
import { TextbookList } from '../ui/textbook-list';
import { AssignmentDraftHandover, titleOf } from './assignment-draft';
import { assignmentBoard } from './assignment-board';
import { BindTextbookDialog } from './bind-textbook-dialog';
import { NEXT_LESSON_DAYS, nextLessonStart } from './next-lesson';
import { MAX_VIDEOS, VideoDraft, VideoSection, videoDraft, videoInputs } from './video-section';

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
    Drawer,
    Menu,
    Textarea,
    ModalDrawer,
    DueChips,
    MaterialChips,
    RecipientsField,
    HomeworkAiPanel,
    ToBoardDialog,
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
      width="xwide"
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
        <tb-recipients-field
          inputId="create-whom"
          [control]="members"
          [students]="studentOptions()"
          [groups]="groups()"
        />

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
              rows="3"
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

        <tb-due-chips [lesson]="nextLesson()" [(choice)]="dueChoice" [(date)]="picked" />

        @if (hasMaterials()) {
          <section class="tb-create__materials" [attr.aria-label]="t.materials">
            <h3 class="tb-subtitle">{{ t.materials }}</h3>
            <tb-textbook-list
              [textbooks]="textbooks()"
              [editable]="true"
              (edit)="editTextbook($event)"
              (remove)="removeTextbook($event)"
            />
            @if (videos().length > 0) {
              <tb-video-section [(videos)]="videos" />
            }
          </section>
        }
        <tb-material-chips
          [(files)]="files"
          [compact]="compact()"
          [videosFull]="videos().length >= maxVideos"
          [(board)]="pickedBoard"
          (textbook)="addTextbook()"
          (video)="addVideo()"
          (quiz)="openFullscreen()"
        />
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
        [preferred]="pickedBoard()?.id ?? null"
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
      gap: var(--tb-space-3);
      min-width: 0;
      /* the 48 dp target of the last chips reaches 8 dp below them: room for it, so no scroll appears */
      padding-block-end: var(--tb-space-2);
    }

    .tb-create__area {
      display: grid;
      border-radius: var(--tb-shape-md) var(--tb-shape-md) var(--tb-shape-xs) var(--tb-shape-xs);
      background: var(--p-md-surface-container-highest);
      border-bottom: 1px solid var(--p-md-outline);
      padding: var(--tb-space-3) var(--tb-space-4) var(--tb-space-1);

      /* the filled field's focus: a 2 dp primary indicator, the text itself shows no frame */
      &:focus-within {
        border-bottom: 2px solid var(--p-md-primary);
        padding-bottom: calc(var(--tb-space-1) - 1px);
      }
    }

    /* the area draws the field's frame: PrimeNG's border, focus ring and the resize grip stay out of it */
    .tb-create__text.tb-create__text {
      --p-textarea-border-color: transparent;
      --p-textarea-hover-border-color: transparent;
      --p-textarea-focus-border-color: transparent;
      --p-textarea-shadow: none;
      --p-textarea-focus-ring-shadow: none;
      --p-textarea-focus-ring-color: transparent;
      width: 100%;
      min-height: 5rem;
      max-height: 14rem;
      resize: none;
      /* autoResize sets overflow: hidden inline; past the maximum the text scrolls */
      overflow-y: auto !important;
      border: 0;
      outline: none;
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
  private readonly size = injectWindowSize();

  readonly visible = model(false);
  /** An assignment was created (a draft or given out): the list reads again. */
  readonly saved = output<AssignmentDetails>();

  protected readonly compact = computed(() => this.size() === 'compact');
  protected readonly aiEnabled = toSignal(this.aiApi.enabled$, { initialValue: false });
  protected readonly aiOpen = signal(false);

  readonly members = new FormControl<MemberSelection[]>([], { nonNullable: true });
  readonly text = new FormControl('', { nonNullable: true });
  protected readonly textValue = toSignal(this.text.valueChanges, { initialValue: '' });
  protected readonly titleValue = computed(() => titleOf(this.textValue()));
  protected readonly chosen = toSignal(this.members.valueChanges, { initialValue: [] });

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
  protected readonly nextLesson = computed(() =>
    nextLessonStart(this.lessons(), this.recipients(), new Date()),
  );

  protected readonly dueChoice = signal<Due>('lesson');
  protected readonly picked = signal<Date | null>(null);
  private readonly dueAt = computed(() =>
    dueAtOf(this.dueChoice(), this.nextLesson(), this.picked()),
  );

  protected readonly files = signal<File[]>([]);
  private readonly pickedTextbooks = signal<readonly BoundTextbook[]>([]);
  protected readonly textbooks = this.pickedTextbooks;
  protected readonly videos = signal<readonly VideoDraft[]>([]);
  protected readonly pickedBoard = signal<BoardPick | null>(null);
  protected readonly hasMaterials = computed(
    () => this.textbooks().length > 0 || this.videos().length > 0,
  );
  protected readonly bindVisible = signal(false);
  protected readonly binding = signal<BoundTextbook | null>(null);

  protected readonly pending = signal(false);
  protected readonly draftOnly = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dirty = computed(
    () =>
      this.textValue() !== '' ||
      this.chosen().length > 0 ||
      this.hasMaterials() ||
      this.files().length > 0 ||
      this.pickedBoard() !== null,
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
    this.picked.set(null);
    this.dueChoice.set('lesson');
    this.files.set([]);
    this.pickedTextbooks.set([]);
    this.videos.set([]);
    this.pickedBoard.set(null);
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
    this.save(true, toBoard || this.pickedBoard() !== null);
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
                : students.length === 0
                  ? of({ assignment: created, complete })
                  : this.api
                      .saveDraftStudents(created.id, students)
                      .pipe(map((assignment) => ({ assignment, complete }))),
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
