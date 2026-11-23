import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Select } from 'primeng/select';
import { Observable, catchError, of, switchMap, throwError } from 'rxjs';
import { quietContext } from '@core/http/api-error.interceptor';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { Confirm } from '@shared/ui/confirm';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MarkdownView } from '@shared/ui/markdown-view';
import { AssistChip } from '@shared/ui/assist-chip';
import { AiApi } from '@features/ai/parts';
import {
  CoursesApi,
  LessonPlan,
  LessonPlansApi,
  TEXTBOOK_KIND_ICONS,
  TEXTBOOK_KIND_LABELS,
  type PlanTextbook,
  videoName,
} from '@features/textbooks/parts';
import { ScheduleApi } from '../data-access/schedule-api';
import { ScheduledLesson } from '../data-access/schedule.models';
import { T } from '../i18n/texts';

/** A bank item as the picker offers it. */
interface BankChoice {
  readonly id: string;
  readonly title: string;
  readonly course: string;
}

let nextId = 0;

/**
 * Teacher: the plan of the lesson card (ADR-0071 decision 13). Filled — one row «План: <title>»
 * that opens in place (the text, the textbook pages, the videos); its «⋮» has «Открыть в редакторе» and «Убрать
 * из урока», which takes the plan off and deletes the working copy (the template stays). Empty — the chip
 * «+ План» with a menu: «Составить» / «С ИИ» open the plan editor for this lesson (`?lessonId=`, the course of
 * the student or the group prefilled; the route puts the new plan on the lesson), «Из шаблонов» picks a template
 * in place: its working copy goes on the lesson. A cancelled lesson takes no new plan.
 */
@Component({
  selector: 'tb-lesson-plan-section',
  imports: [FormsModule, Button, Menu, Select, AssistChip, LoadStateView, MarkdownView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.tb-lesson-prep--row]': 'lesson().planId !== null || picking()' },
  template: `
    @let planId = lesson().planId;
    @if (planId !== null) {
      <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="t.title">
        <li class="tb-lesson-prep__row" [class.tb-lesson-prep__row--open]="expanded()">
          <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-list_alt"></i></span>
          <div class="tb-list__text">
            <button
              type="button"
              class="tb-list__title tb-list__link tb-lesson-prep__toggle"
              [attr.aria-expanded]="expanded()"
              [attr.aria-controls]="bodyId"
              (click)="expanded.set(!expanded())"
            >
              {{ plan() === null ? t.rowLoading : t.row(plan()?.title ?? '') }}
            </button>
          </div>
          <div class="tb-list__trail tb-list__trail--icons">
            <i class="tb-i tb-i-expand_more tb-lesson-prep__chevron" aria-hidden="true"></i>
            <p-button
              icon="tb-i tb-i-more_vert"
              severity="secondary"
              [text]="true"
              [rounded]="true"
              [ariaLabel]="t.more"
              aria-haspopup="menu"
              [loading]="removing()"
              (onClick)="menu.toggle($event)"
            />
          </div>
        </li>
        @if (expanded()) {
          <li class="tb-lesson-prep__body" [id]="bodyId">
            <tb-load-state [state]="state" [what]="t.what" [compact]="true" (retry)="load()">
              @if (plan(); as item) {
                @if (item.body.trim() !== '') {
                  <tb-markdown [text]="item.body" />
                }
                @for (textbook of item.textbooks; track textbook.id) {
                  <p class="tb-lesson-prep__item">
                    <i [class]="icons[textbook.kind]" aria-hidden="true"></i>
                    <span>
                      {{ textbook.title }}
                      <span class="tb-muted">· {{ pagesOf(textbook) }}</span>
                    </span>
                  </p>
                }
                @for (video of item.videos; track $index) {
                  <p class="tb-lesson-prep__item">
                    <i class="tb-i tb-i-smart_display" aria-hidden="true"></i>
                    <span>{{ videoTitle(video, $index) }}</span>
                  </p>
                }
              }
            </tb-load-state>
          </li>
        }
      </ul>
      <p-menu #menu [model]="menuItems" [popup]="true" appendTo="body" />
    } @else if (picking()) {
      <div class="tb-lesson-prep__pick" [attr.aria-label]="t.title" role="group">
        <p-select
          [options]="choices()"
          optionLabel="title"
          optionValue="id"
          [(ngModel)]="chosen"
          [placeholder]="t.choosePlan"
          [filter]="true"
          filterBy="title,course"
          [loading]="!choicesLoaded()"
          [emptyMessage]="t.bankEmpty"
          [ariaLabel]="t.bankPlan"
          appendTo="body"
          [fluid]="true"
        >
          <ng-template #item let-choice>
            <div class="tb-lesson-prep__choice">
              <span>{{ choice.title }}</span>
              <small class="tb-hint">{{ choice.course }}</small>
            </div>
          </ng-template>
        </p-select>
        <div class="tb-lesson-prep__actions">
          <p-button
            [label]="t.cancel"
            [text]="true"
            [disabled]="using()"
            (onClick)="picking.set(false)"
          />
          <p-button
            [label]="t.use"
            [loading]="using()"
            [disabled]="chosen() === null"
            (onClick)="use()"
          />
        </div>
      </div>
    } @else if (!cancelled()) {
      <tb-assist-chip
        icon="add"
        [dashed]="true"
        [menu]="true"
        [ariaLabel]="t.addLabel"
        (click)="addMenu.toggle($event)"
        >{{ t.add }}</tb-assist-chip
      >
      <p-menu #addMenu [model]="addItems()" [popup]="true" appendTo="body" />
    }
  `,
  styleUrl: './lesson-prep.scss',
})
export class LessonPlanSection {
  protected readonly t = T.lessonPlan;
  protected readonly icons = TEXTBOOK_KIND_ICONS;
  private readonly plansApi = inject(LessonPlansApi);
  private readonly coursesApi = inject(CoursesApi);
  private readonly scheduleApi = inject(ScheduleApi);
  private readonly router = inject(Router);
  private readonly confirm = inject(Confirm);
  private readonly snackbar = inject(Snackbar);
  protected readonly aiEnabled = toSignal(inject(AiApi).enabled$, { initialValue: false });

  readonly lesson = input.required<ScheduledLesson>();
  /** The plan was put on the lesson or taken off: the lesson as the server returned it. */
  readonly changed = output<ScheduledLesson>();

  protected readonly cancelled = computed(() => this.lesson().status === 'CANCELLED');
  protected readonly state = new LoadState();
  protected readonly plan = signal<LessonPlan | null>(null);
  protected readonly picking = signal(false);
  /** The templates of the picker «Из шаблонов». */
  readonly choices = signal<BankChoice[]>([]);
  protected readonly choicesLoaded = signal(false);
  /** The bank item chosen in the picker. */
  readonly chosen = signal<string | null>(null);
  protected readonly using = signal(false);
  protected readonly removing = signal(false);
  /** The row is open. */
  readonly expanded = signal(false);
  protected readonly bodyId = `tb-lesson-plan-${String(++nextId)}`;

  /** The menu of «+ План». */
  protected readonly addItems = computed<MenuItem[]>(() => [
    {
      label: T.lessonPlan.compose,
      icon: 'tb-i tb-i-edit',
      command: () => {
        this.compose();
      },
    },
    ...(this.aiEnabled()
      ? [
          {
            label: T.lessonPlan.composeWithAi,
            icon: 'tb-i tb-i-auto_awesome',
            command: () => {
              this.compose(true);
            },
          },
        ]
      : []),
    {
      label: T.lessonPlan.fromBank,
      icon: 'tb-i tb-i-library_books',
      command: () => {
        this.pick();
      },
    },
  ]);

  protected readonly menuItems: MenuItem[] = [
    {
      label: T.lessonPlan.open,
      icon: 'tb-i tb-i-edit',
      command: () => {
        this.open();
      },
    },
    {
      label: T.lessonPlan.remove,
      icon: 'tb-i tb-i-link_off',
      command: () => {
        void this.remove();
      },
    },
  ];

  constructor() {
    effect(() => {
      const planId = this.lesson().planId;
      untracked(() => {
        if (planId === null) {
          this.plan.set(null);
          this.expanded.set(false);
        } else if (this.plan()?.id !== planId) {
          this.load();
        }
      });
    });
  }

  protected load(): void {
    const planId = this.lesson().planId;
    if (planId === null) {
      return;
    }
    this.plansApi
      .get(planId, quietContext())
      .pipe(this.state.track())
      .subscribe((plan) => {
        this.plan.set(plan);
      });
  }

  protected pagesOf(textbook: PlanTextbook): string {
    return [
      TEXTBOOK_KIND_LABELS[textbook.kind],
      textbook.pages === null ? this.t.whole : this.t.pages(textbook.pages),
    ].join(' · ');
  }

  protected videoTitle(video: { readonly title: string | null }, index: number): string {
    return videoName(video, index);
  }

  /** The editor of a new working plan for this lesson; the course comes from the student or the group. */
  protected compose(withAi = false): void {
    const lesson = this.lesson();
    const owner =
      lesson.groupId === null ? { studentId: lesson.studentId } : { groupId: lesson.groupId };
    void this.router.navigate(['/teacher/materials/plans/new'], {
      queryParams: { lessonId: lesson.id, ...owner, ...(withAi ? { ai: '1' } : {}) },
    });
  }

  protected open(): void {
    const planId = this.lesson().planId;
    if (planId === null) {
      return;
    }
    void this.router.navigate(['/teacher/materials/plans', planId], {
      queryParams: { lessonId: this.lesson().id },
    });
  }

  /** «Из шаблонов»: the templates by title, each with its course. */
  protected pick(): void {
    this.chosen.set(null);
    this.picking.set(true);
    this.choicesLoaded.set(false);
    this.coursesApi
      .list(quietContext())
      .pipe(
        catchError(() => of([])),
        switchMap((courses) => {
          const names = new Map(courses.map((course) => [course.id, course.name]));
          return this.plansApi.list(true, quietContext()).pipe(
            catchError((error: unknown) => {
              this.snackbar.error(describeError(error, T.lessonPlan.useFailed));
              return of([]);
            }),
            switchMap((plans) =>
              of(
                plans
                  .map((plan) => ({
                    id: plan.id,
                    title: plan.title,
                    course: names.get(plan.courseId ?? '') ?? T.lessonPlan.noCourse,
                  }))
                  .sort((a, b) => a.title.localeCompare(b.title, 'ru')),
              ),
            ),
          );
        }),
      )
      .subscribe((choices) => {
        this.choices.set(choices);
        this.choicesLoaded.set(true);
      });
  }

  /** A working copy of the chosen bank item goes on the lesson; a copy that could not go there is deleted. */
  protected use(): void {
    const bankId = this.chosen();
    if (bankId === null || this.using()) {
      return;
    }
    const lessonId = this.lesson().id;
    // a failed «use» is reported by the error interceptor, a failed link (quiet) here
    let copied = false;
    this.using.set(true);
    this.plansApi
      .use(bankId, lessonId)
      .pipe(
        switchMap(({ plan }) => {
          copied = true;
          return this.scheduleApi
            .linkPlan(lessonId, plan.id)
            .pipe(catchError((error: unknown) => this.dropCopy(plan.id, error)));
        }),
      )
      .subscribe({
        next: (lesson) => {
          this.using.set(false);
          this.picking.set(false);
          this.snackbar.success(T.lessonPlan.used);
          this.changed.emit(lesson);
        },
        error: (error: unknown) => {
          this.using.set(false);
          if (copied) {
            this.snackbar.error(describeError(error, T.lessonPlan.useFailed));
          }
        },
      });
  }

  /** «Убрать из урока» (asked first): the plan comes off the lesson, then its working copy is deleted. */
  protected async remove(): Promise<void> {
    const planId = this.lesson().planId;
    if (
      planId === null ||
      this.removing() ||
      !(await this.confirm.danger({
        header: T.lessonPlan.removeHeader,
        message: T.lessonPlan.removeMessage,
        acceptLabel: T.lessonPlan.removeAccept,
      }))
    ) {
      return;
    }
    this.removing.set(true);
    this.scheduleApi.linkPlan(this.lesson().id, null).subscribe({
      next: (lesson) => {
        this.removing.set(false);
        this.snackbar.success(T.lessonPlan.removed);
        this.changed.emit(lesson);
        // a copy that cannot be deleted stays as a row no list shows (ADR-0071)
        this.plansApi.remove(planId, quietContext()).subscribe({ error: () => undefined });
      },
      error: (error: unknown) => {
        this.removing.set(false);
        this.snackbar.error(describeError(error, T.lessonPlan.removeFailed));
      },
    });
  }

  private dropCopy(planId: string, error: unknown): Observable<never> {
    this.plansApi.remove(planId, quietContext()).subscribe({ error: () => undefined });
    return throwError(() => error);
  }
}
