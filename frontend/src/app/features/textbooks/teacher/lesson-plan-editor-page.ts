import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Location } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, UrlTree } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Drawer } from 'primeng/drawer';
import { Menu } from 'primeng/menu';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { Observable, map, of, switchMap, tap } from 'rxjs';
import { quietContext } from '@core/http/api-error.interceptor';
import { describeError } from '@core/http/error-messages';
import { injectWindowSize } from '@core/layout/mobile';
import { CanLeave } from '@core/routing/can-leave.guard';
import { pageDetail } from '@core/routing/page-detail';
import { Snackbar } from '@core/snackbar/snackbar';
import { EditorAutosave, EditorWrite } from '@shared/forms/editor-autosave';
import { Confirm } from '@shared/ui/confirm';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MarkdownField } from '@shared/ui/markdown-field';
import { PageHeader } from '@shared/ui/page-header';
import {
  AiApi,
  AppliedPlan,
  LessonFacts,
  LessonPlanAiPanel,
  LessonPlanAiState,
} from '@features/ai/parts';
import { courseOptions } from '../course-options';
import { CoursesApi } from '../data-access/courses-api';
import { Course } from '../data-access/courses.models';
import { LessonPlansApi } from '../data-access/lesson-plans-api';
import { LessonPlan, LessonPlanInput } from '../data-access/lesson-plans.models';
import { PickedTextbook } from '../data-access/textbooks.models';
import { T } from '../i18n/texts';
import {
  MAX_VIDEOS,
  VideoDraft,
  VideoSection,
  videoDraft,
  videoInputs,
} from '../videos/video-section';
import { BindTextbookDialog } from './bind-textbook-dialog';
import { PlanTextbooks } from './plan-textbooks';
import { planAiSources } from './plan-ai-sources';

/**
 * Puts a working plan on a lesson. `schedule` owns the link and `textbooks` does not import it (ADR-0058): the
 * route passes the function (`app.routes.ts`).
 */
export type LinkToLesson = (lessonId: string, planId: string) => Observable<unknown>;

/** What a lesson tells the AI about its plan: the students, the topic and the previous lesson's summary. */
export interface PlanLesson {
  readonly studentIds: readonly string[];
  readonly facts: LessonFacts;
}

/** Reads the lesson of a plan; `schedule` owns it, the route passes the function (ADR-0058). */
export type LessonOfPlan = (lessonId: string) => Observable<PlanLesson>;

/** The most textbooks of one plan (the backend's limit). */
export const MAX_PLAN_TEXTBOOKS = 20;

/** The plan's textbooks as the editor lists them. */
function pickedOf(plan: LessonPlan): PickedTextbook[] {
  return plan.textbooks.map((textbook) => ({
    textbookId: textbook.id,
    kind: textbook.kind,
    title: textbook.title,
    courseName: null,
    format: textbook.format,
    pageCount: textbook.pageCount,
    pages: textbook.pages,
  }));
}

/**
 * Teacher: the lesson plan editor (roadmap 11, `/teacher/materials/plans/new`, `…/plans/:planId`) — the title,
 * «Курс», the Markdown plan, the textbook pages (of the course when one is set) and the videos with their
 * automatic transcripts. The plan saves itself a moment after each change, as a draft of an assignment does;
 * «Готово» saves what is left and finishes it (the first «Готово» of a lesson's plan puts its original into
 * the bank). A lesson's plan has «⋮» «Сохранить в банк» / «Обновить в банке». A plan made in «Материалы» is a
 * bank item from the start; one made from a lesson card (`?lessonId=`) is the lesson's working plan: its course is
 * the student's or the group's, the first save puts it on the lesson and the editor goes back to the schedule.
 */
@Component({
  selector: 'tb-lesson-plan-editor-page',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    InputText,
    Menu,
    Message,
    Drawer,
    ModalDrawer,
    LessonPlanAiPanel,
    Select,
    Tag,
    FieldErrors,
    LoadStateView,
    MarkdownField,
    PageHeader,
    BindTextbookDialog,
    PlanTextbooks,
    VideoSection,
  ],
  providers: [LessonPlanAiState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ready()) {
      <tb-page-header
        class="tb-page-header--one-line"
        [title]="heading()"
        [back]="back()"
        [backLabel]="lessonId() === undefined ? t.back : t.backToSchedule"
      >
        @if (plan()?.bank) {
          <p-tag meta [value]="t.bankItem" severity="secondary" />
        }
        @if (savedAt(); as at) {
          <span class="tb-plan-editor__saved" role="status">{{ t.savedAt(at) }}</span>
        }
        @if (aiEnabled()) {
          <p-button
            [label]="t.withAi"
            icon="tb-i tb-i-auto_awesome"
            severity="secondary"
            variant="outlined"
            [ariaLabel]="t.aiTitle"
            (onClick)="aiOpen.set(true)"
          />
        }
        @if (menuItems().length > 0) {
          <p-button
            icon="tb-i tb-i-more_vert"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [ariaLabel]="t.more"
            [loading]="banking()"
            (onClick)="menu.toggle($event)"
          />
          <p-menu #menu [model]="menuItems()" [popup]="true" appendTo="body" />
        }
        <p-button
          [label]="t.done"
          icon="tb-i tb-i-check"
          [loading]="finishing()"
          (onClick)="finish()"
        />
      </tb-page-header>

      <form tbFieldErrors class="tb-plan-editor tb-form" [formGroup]="form" (ngSubmit)="finish()">
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
        @if (plan()?.bank) {
          <p class="tb-hint">{{ t.bankItemHint }}</p>
        } @else if (lessonId() !== undefined) {
          <p class="tb-hint">{{ t.lessonPlanHint }}</p>
        }
        <p-card styleClass="tb-section-card">
          <div class="tb-plan-editor__fields">
            <div class="tb-field">
              <label for="plan-title">{{ t.title }}</label>
              <input pInputText id="plan-title" formControlName="title" autocomplete="off" />
            </div>
            @if (courses().length > 0) {
              <div class="tb-field">
                <label for="plan-course">{{ t.course }}</label>
                <p-select
                  inputId="plan-course"
                  formControlName="courseId"
                  [options]="courseChoices()"
                  optionLabel="label"
                  optionValue="value"
                  appendTo="body"
                  [fluid]="true"
                />
                <small class="tb-hint">{{ t.courseHint }}</small>
              </div>
            }
            <tb-markdown-field
              fieldId="plan-body"
              [control]="form.controls.body"
              [label]="t.body"
              [hint]="t.bodyHint"
            />
          </div>
        </p-card>

        <p-card styleClass="tb-section-card">
          <div class="tb-plan-editor__head">
            <h2 class="tb-subtitle">{{ t.textbooks }}</h2>
            <span class="tb-hint">{{ t.textbookCount(textbooks().length, maxTextbooks) }}</span>
          </div>
          <tb-plan-textbooks
            [textbooks]="textbooks()"
            (edit)="editTextbook($event)"
            (remove)="removeTextbook($event)"
          />
          @if (textbooks().length < maxTextbooks) {
            <p-button
              [label]="t.addTextbook"
              icon="tb-i tb-i-add"
              severity="secondary"
              [text]="true"
              (onClick)="addTextbook()"
            />
          }
        </p-card>

        <p-card styleClass="tb-section-card">
          <div class="tb-plan-editor__head">
            <h2 class="tb-subtitle">{{ t.videos }}</h2>
            <span class="tb-hint">{{ t.videoCount(videos().length, maxVideos) }}</span>
          </div>
          <tb-video-section [videos]="videos()" (videosChange)="videos.set($event)" />
        </p-card>
      </form>

      @if (aiEnabled()) {
        <p-drawer
          tbModalDrawer
          [(visible)]="aiOpen"
          [header]="t.aiTitle"
          [ariaCloseLabel]="t.closeAi"
          [position]="compact() ? 'bottom' : 'right'"
          [blockScroll]="true"
          [styleClass]="compact() ? 'tb-sheet tb-editor-ai-drawer' : 'tb-editor-ai-drawer'"
          [style]="compact() ? {} : { width: 'min(100vw, 25rem)' }"
        >
          <tb-lesson-plan-ai-panel
            [hasText]="bodyValue().trim() !== ''"
            [sources]="aiSources()"
            [students]="lesson()?.studentIds ?? []"
            [lesson]="lesson()?.facts ?? null"
            [courseName]="courseName()"
            [compact]="compact()"
            (applied)="applyDraft($event)"
          />
        </p-drawer>
      }

      <tb-bind-textbook-dialog
        [(visible)]="bindVisible"
        [headline]="t.bindTitle"
        [taken]="textbooks()"
        [bound]="binding()"
        [courseId]="courseId()"
        (picked)="pickTextbook($event)"
      />
    } @else {
      <tb-page-header
        [title]="t.newTitle"
        [back]="back()"
        [backLabel]="lessonId() === undefined ? t.back : t.backToSchedule"
      />
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()" />
    }
  `,
  styles: `
    .tb-plan-editor {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
      max-width: 52rem;
    }

    .tb-plan-editor__fields {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
    }

    .tb-plan-editor__head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--tb-space-2) var(--tb-space-4);
      margin-block-end: var(--tb-space-3);
    }

    .tb-plan-editor__saved {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
      letter-spacing: var(--tb-tracking-body-s);
    }
  `,
})
export class LessonPlanEditorPage implements OnInit, CanLeave {
  protected readonly t = T.planEditor;
  protected readonly maxTextbooks = MAX_PLAN_TEXTBOOKS;
  protected readonly maxVideos = MAX_VIDEOS;
  private readonly api = inject(LessonPlansApi);
  private readonly coursesApi = inject(CoursesApi);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly confirm = inject(Confirm);
  private readonly snackbar = inject(Snackbar);
  private readonly aiApi = inject(AiApi);
  private readonly size = injectWindowSize();
  protected readonly compact = computed(() => this.size() === 'compact');
  protected readonly aiEnabled = toSignal(this.aiApi.enabled$, { initialValue: false });
  protected readonly aiOpen = signal(false);
  /** The lesson of the plan as the AI knows it; `null` — none or not read. */
  protected readonly lesson = signal<PlanLesson | null>(null);

  /** Route parameter of `/teacher/materials/plans/:planId`; none — a new plan. */
  readonly planId = input<string>();
  /** Query `?lessonId=`: the plan of this lesson, a working plan, not a bank item. */
  readonly lessonId = input<string>();
  /** Query `?studentId=` / `?groupId=` of a new lesson plan: the course is prefilled with theirs. */
  readonly studentId = input<string>();
  readonly groupId = input<string>();
  /** Route data: puts a new lesson plan on its lesson. */
  readonly linkToLesson = input<LinkToLesson>();
  /** Route data: reads the lesson for the AI. */
  readonly lessonOf = input<LessonOfPlan>();
  /** Query `?ai=1` («С ИИ» of the lesson card): the assistant opens with the editor. */
  readonly ai = input<string>();

  /** «Материалы» on the tab «Планы»; a lesson's plan — the schedule. */
  protected readonly back = computed<UrlTree>(() =>
    this.lessonId() === undefined
      ? this.router.createUrlTree(['/teacher/materials'], { queryParams: { tab: 'plans' } })
      : this.router.createUrlTree(['/teacher/schedule']),
  );
  /** A plan opened by its id is on its lesson already; a new one is put there by its first save. */
  private linked = true;
  protected readonly state = new LoadState();
  protected readonly plan = signal<LessonPlan | null>(null);
  protected readonly ready = computed(() => this.planId() === undefined || this.plan() !== null);
  protected readonly courses = signal<readonly Course[]>([]);
  protected readonly courseChoices = computed(() => courseOptions(this.courses()));

  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    body: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20_000)] }),
    courseId: new FormControl<string | null>(null),
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.value });
  protected readonly courseId = computed(() => this.value().courseId ?? null);
  private readonly titleValue = computed(() => (this.value().title ?? '').trim());
  protected readonly bodyValue = computed(() => this.value().body ?? '');
  protected readonly courseName = computed(
    () => this.courses().find((course) => course.id === this.courseId())?.name ?? null,
  );
  protected readonly heading = computed(() => this.titleValue() || this.t.newTitle);

  protected readonly textbooks = signal<readonly PickedTextbook[]>([]);
  readonly videos = signal<readonly VideoDraft[]>([]);
  protected readonly aiSources = computed(() => planAiSources(this.textbooks(), this.videos()));
  protected readonly bindVisible = signal(false);
  /** The textbook whose pages change; `null` — a new one. */
  protected readonly binding = signal<PickedTextbook | null>(null);

  protected readonly error = signal<string | null>(null);
  protected readonly finishing = signal(false);
  protected readonly banking = signal(false);
  /** «Готово» went through: leaving saves nothing more. */
  private done = false;

  private readonly snapshot = computed(() =>
    JSON.stringify([
      this.titleValue(),
      this.value().body ?? '',
      this.courseId(),
      this.textbooks().map((textbook) => [textbook.textbookId, textbook.pages]),
      videoInputs(this.videos()),
    ]),
  );
  /** The plan saves itself a moment after each change. */
  private readonly drafts = new EditorAutosave<LessonPlan>({
    canSave: () => !this.done && !this.finishing() && !this.banking() && this.form.valid,
    snapshot: () => this.snapshot(),
    write: () => this.write().pipe(map((plan) => ({ assignment: plan, complete: true }))),
    saved: ({ assignment }: EditorWrite<LessonPlan>) => {
      this.error.set(null);
      this.remember(assignment);
    },
    failed: (error) => {
      this.refresh();
      this.error.set(describeError(error, T.planEditor.autosaveFailed));
    },
  });
  protected readonly savedAt = this.drafts.savedAt;
  /** Milliseconds of quiet before the plan saves itself. */
  get autosaveDelay(): number {
    return this.drafts.delay;
  }
  set autosaveDelay(delay: number) {
    this.drafts.delay = delay;
  }

  /** A lesson's plan goes into the bank, or updates its original there. */
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const plan = this.plan();
    if (plan === null || plan.bank) {
      return [];
    }
    const update = plan.sourceId !== null;
    return [
      {
        label: update ? T.planEditor.updateBank : T.planEditor.toBank,
        icon: 'tb-i tb-i-library_books',
        command: () => {
          void this.saveToBank(update);
        },
      },
    ];
  });

  constructor() {
    pageDetail(() => this.plan()?.title);
    effect(() => {
      const snapshot = this.snapshot();
      untracked(() => {
        if (this.ready() && this.drafts.differs(snapshot)) {
          this.drafts.schedule();
        }
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.drafts.cancel();
    });
  }

  ngOnInit(): void {
    // without the courses (a failed read) «Курс» is not offered and the plan keeps its own
    this.coursesApi.list(quietContext()).subscribe((courses) => {
      this.courses.set(courses);
    });
    this.readLesson();
    this.aiOpen.set(this.ai() === '1');
    this.linked = this.planId() !== undefined || this.lessonId() === undefined;
    if (this.planId() === undefined) {
      this.drafts.mark(this.snapshot());
      this.prefillCourse();
    } else {
      this.load();
    }
  }

  /** The lesson's facts for the AI; a failed read leaves the assistant without them. */
  private readLesson(): void {
    const lessonId = this.lessonId();
    const lessonOf = this.lessonOf();
    if (lessonId === undefined || lessonOf === undefined) {
      return;
    }
    lessonOf(lessonId).subscribe({
      next: (lesson) => {
        this.lesson.set(lesson);
      },
      error: () => {
        // the draft goes without the lesson
      },
    });
  }

  /**
   * The draft goes into the plan: the title when the plan has none, the text replaces or follows the old one, and
   * on a replace the pages the AI chose narrow the bound textbooks (it never binds a textbook of its own).
   */
  applyDraft({ draft, mode }: AppliedPlan): void {
    const { title, body } = this.form.controls;
    if (title.value.trim() === '') {
      title.setValue(draft.title);
    }
    const old = body.value.trimEnd();
    body.setValue(mode === 'insert' && old !== '' ? `${old}\n\n${draft.body}` : draft.body);
    body.markAsDirty();
    if (mode === 'replace') {
      const pages = new Map(draft.textbooks.map((entry) => [entry.textbookId, entry.pages]));
      this.textbooks.update((list) =>
        list.map((textbook) => ({
          ...textbook,
          pages: pages.get(textbook.textbookId) ?? textbook.pages,
        })),
      );
    }
    this.aiOpen.set(false);
  }

  /** A new lesson plan takes the current course of the lesson's student or group, unless one is chosen. */
  private prefillCourse(): void {
    const studentId = this.studentId();
    const groupId = this.groupId();
    if (this.lessonId() === undefined || (studentId === undefined && groupId === undefined)) {
      return;
    }
    this.coursesApi.links(quietContext()).subscribe((links) => {
      const courseId =
        groupId === undefined
          ? links.students.find((link) => link.studentId === studentId)?.courseId
          : links.groups.find((link) => link.groupId === groupId)?.courseId;
      const control = this.form.controls.courseId;
      if (courseId !== undefined && control.value === null && !control.dirty) {
        control.setValue(courseId);
      }
    });
  }

  protected load(): void {
    const id = this.planId();
    if (id === undefined) {
      return;
    }
    this.api
      .get(id, quietContext())
      .pipe(this.state.track())
      .subscribe((plan) => {
        this.plan.set(plan);
        this.form.reset({ title: plan.title, body: plan.body, courseId: plan.courseId });
        this.textbooks.set(pickedOf(plan));
        this.videos.set(plan.videos.map((video) => videoDraft(video)));
        this.drafts.mark(this.snapshot());
      });
  }

  protected addTextbook(): void {
    this.binding.set(null);
    this.bindVisible.set(true);
  }

  protected editTextbook(textbook: PickedTextbook): void {
    this.binding.set(textbook);
    this.bindVisible.set(true);
  }

  protected removeTextbook(textbook: PickedTextbook): void {
    this.textbooks.update((list) => list.filter((item) => item.textbookId !== textbook.textbookId));
  }

  /** A new textbook goes last; changed pages stay in place. */
  pickTextbook(textbook: PickedTextbook): void {
    this.textbooks.update((list) =>
      list.some((item) => item.textbookId === textbook.textbookId)
        ? list.map((item) => (item.textbookId === textbook.textbookId ? textbook : item))
        : [...list, textbook],
    );
  }

  /** «Готово»: what is left is saved, the plan is finished and the editor goes back to «Материалы». */
  finish(): void {
    if (this.finishing() || !revealErrors(this.form)) {
      return;
    }
    if (
      this.drafts.busy(() => {
        this.finish();
      })
    ) {
      return;
    }
    this.drafts.cancel();
    this.finishing.set(true);
    this.saved()
      .pipe(switchMap((plan) => this.api.finish(plan.id)))
      .subscribe({
        next: (plan) => {
          this.plan.set(plan);
          this.done = true;
          this.finishing.set(false);
          void this.router.navigateByUrl(this.back());
        },
        error: (error: unknown) => {
          this.finishing.set(false);
          this.refresh();
          this.error.set(describeError(error, T.planEditor.finishFailed));
        },
      });
  }

  /** «Сохранить в банк» / «Обновить в банке» (asked first: the original's content is replaced). */
  protected async saveToBank(update: boolean): Promise<void> {
    if (
      update &&
      !(await this.confirm.safe({
        header: T.planEditor.updateHeader,
        message: T.planEditor.updateMessage,
        acceptLabel: T.planEditor.update,
      }))
    ) {
      return;
    }
    this.sendToBank(update);
  }

  /** Once a running autosave is through: the changes saved, then the plan goes into the bank. */
  private sendToBank(update: boolean): void {
    if (this.banking() || !revealErrors(this.form)) {
      return;
    }
    if (
      this.drafts.busy(() => {
        this.sendToBank(update);
      })
    ) {
      return;
    }
    this.drafts.cancel();
    this.banking.set(true);
    this.saved()
      .pipe(switchMap((plan) => this.api.saveToBank(plan.id)))
      .subscribe({
        next: (plan) => {
          this.banking.set(false);
          this.plan.set(plan);
          this.snackbar.success(update ? T.planEditor.updatedInBank : T.planEditor.savedToBank);
          this.saveChanges();
        },
        error: (error: unknown) => {
          this.banking.set(false);
          this.refresh();
          this.saveChanges();
          this.snackbar.error(describeError(error, T.planEditor.bankFailed));
        },
      });
  }

  /** Changes made while the plan went into the bank save themselves now. */
  private saveChanges(): void {
    if (this.drafts.differs(this.snapshot())) {
      this.drafts.schedule();
    }
  }

  /** The plan as the server has it once the changes are saved. */
  private saved(): Observable<LessonPlan> {
    const plan = this.plan();
    if (plan !== null && !this.drafts.differs(this.snapshot())) {
      return of(plan);
    }
    const snapshot = this.snapshot();
    return this.write().pipe(
      map((written) => {
        this.drafts.mark(snapshot);
        this.remember(written);
        return written;
      }),
    );
  }

  /**
   * Saves the plan; a new lesson plan is remembered at once and then put on its lesson, so a failed link never
   * makes a second plan — the next save tries the link again.
   */
  private write(): Observable<LessonPlan> {
    const plan = this.plan();
    const input = this.input();
    const written =
      plan === null
        ? this.api.create(input, this.lessonId() === undefined).pipe(
            tap((created) => {
              this.remember(created);
            }),
          )
        : this.api.update(plan, input);
    return written.pipe(switchMap((saved) => this.link(saved)));
  }

  private link(plan: LessonPlan): Observable<LessonPlan> {
    const lessonId = this.lessonId();
    const link = this.linkToLesson();
    if (this.linked || lessonId === undefined || link === undefined) {
      return of(plan);
    }
    return link(lessonId, plan.id).pipe(
      map(() => {
        this.linked = true;
        return plan;
      }),
    );
  }

  private input(): LessonPlanInput {
    const value = this.form.getRawValue();
    return {
      title: value.title.trim(),
      body: value.body,
      courseId: value.courseId,
      textbooks: this.textbooks().map((textbook) => ({
        textbookId: textbook.textbookId,
        pages: textbook.pages,
      })),
      videos: videoInputs(this.videos()),
    };
  }

  /** The saved plan and, for one just created, its address (the page stays as it is). */
  private remember(plan: LessonPlan): void {
    const created = this.plan() === null;
    this.plan.set(plan);
    if (created) {
      const lessonId = this.lessonId();
      this.location.replaceState(
        this.router.serializeUrl(
          this.router.createUrlTree(['/teacher/materials/plans', plan.id], {
            queryParams: lessonId === undefined ? {} : { lessonId },
          }),
        ),
      );
    }
  }

  /** After a failed save the version may have moved on: take the plan as the server has it. */
  private refresh(): void {
    const plan = this.plan();
    if (plan !== null) {
      this.api.get(plan.id, quietContext()).subscribe({
        next: (current) => {
          this.plan.set(current);
        },
        error: () => {
          // the next save reports what is wrong
        },
      });
    }
  }

  /** The plan saves what is left and lets go. */
  canLeave(): boolean {
    if (!this.done && this.drafts.differs(this.snapshot())) {
      this.drafts.run();
    }
    return true;
  }
}
