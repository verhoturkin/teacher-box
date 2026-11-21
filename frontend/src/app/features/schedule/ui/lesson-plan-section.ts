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

/**
 * Teacher: «План урока» of the lesson card (roadmap 11 «Lesson card»). Empty — «Составить» opens the plan editor
 * for this lesson (`?lessonId=`, the course of the student or the group prefilled; the route puts the new plan on
 * the lesson) and «Из банка» picks a bank item in place: its working copy goes on the lesson. Filled — the
 * title, the textbook pages and the videos, «Открыть» (the editor) and «⋮» «Убрать из урока», which takes the
 * plan off and deletes the working copy (the original stays in the bank). A cancelled lesson takes no new plan.
 */
@Component({
  selector: 'tb-lesson-plan-section',
  imports: [FormsModule, Button, Menu, Select, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let planId = lesson().planId;
    @if (planId !== null || !cancelled()) {
      <section class="tb-lesson-plan" [attr.aria-label]="t.title">
        <div class="tb-lesson-plan__head">
          <h3 class="tb-lesson-plan__title">{{ t.title }}</h3>
          @if (planId !== null) {
            <p-button
              [label]="t.open"
              icon="tb-i tb-i-arrow_forward"
              iconPos="right"
              [text]="true"
              (onClick)="open(planId)"
            />
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
            <p-menu #menu [model]="menuItems" [popup]="true" appendTo="body" />
          }
        </div>
        @if (planId !== null) {
          <tb-load-state [state]="state" [what]="t.what" [compact]="true" (retry)="load()">
            @if (plan(); as item) {
              <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="t.title">
                <li>
                  <span class="tb-list__lead" aria-hidden="true"
                    ><i class="tb-i tb-i-list_alt"></i
                  ></span>
                  <div class="tb-list__text">
                    <span class="tb-list__title">{{ item.title }}</span>
                  </div>
                </li>
                @for (textbook of item.textbooks; track textbook.id) {
                  <li>
                    <span class="tb-list__lead" aria-hidden="true"
                      ><i [class]="icons[textbook.kind]"></i
                    ></span>
                    <div class="tb-list__text">
                      <span class="tb-list__title">{{ textbook.title }}</span>
                      <span class="tb-list__supporting">{{ pagesOf(textbook) }}</span>
                    </div>
                  </li>
                }
                @for (video of item.videos; track $index) {
                  <li>
                    <span class="tb-list__lead" aria-hidden="true"
                      ><i class="tb-i tb-i-smart_display"></i
                    ></span>
                    <div class="tb-list__text">
                      <span class="tb-list__title">{{ videoTitle(video, $index) }}</span>
                    </div>
                  </li>
                }
              </ul>
            }
          </tb-load-state>
        } @else if (picking()) {
          <div class="tb-lesson-plan__pick">
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
                <div class="tb-lesson-plan__choice">
                  <span>{{ choice.title }}</span>
                  <small class="tb-hint">{{ choice.course }}</small>
                </div>
              </ng-template>
            </p-select>
            <div class="tb-lesson-plan__actions">
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
        } @else {
          <p class="tb-muted tb-lesson-plan__empty">{{ t.empty }}</p>
          <div class="tb-lesson-plan__actions tb-lesson-plan__actions--start">
            <p-button
              [label]="t.compose"
              icon="tb-i tb-i-edit"
              severity="secondary"
              (onClick)="compose()"
            />
            <p-button
              [label]="t.fromBank"
              icon="tb-i tb-i-library_books"
              variant="outlined"
              (onClick)="pick()"
            />
          </div>
        }
      </section>
    }
  `,
  styles: `
    .tb-lesson-plan {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
    }

    .tb-lesson-plan__head {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
      margin-top: var(--tb-space-2);
    }

    .tb-lesson-plan__title {
      flex: 1;
      margin: 0;
      font: var(--tb-type-title-m);
      letter-spacing: var(--tb-tracking-title-m);
    }

    .tb-lesson-plan__empty {
      margin: 0;
    }

    .tb-lesson-plan__pick {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
    }

    .tb-lesson-plan__choice {
      display: flex;
      flex-direction: column;
    }

    .tb-lesson-plan__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--tb-space-2);
    }

    .tb-lesson-plan__actions--start {
      justify-content: flex-start;
    }
  `,
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

  readonly lesson = input.required<ScheduledLesson>();
  /** The plan was put on the lesson or taken off: the lesson as the server returned it. */
  readonly changed = output<ScheduledLesson>();

  protected readonly cancelled = computed(() => this.lesson().status === 'CANCELLED');
  protected readonly state = new LoadState();
  protected readonly plan = signal<LessonPlan | null>(null);
  protected readonly picking = signal(false);
  /** The bank items of the picker «Из банка». */
  readonly choices = signal<BankChoice[]>([]);
  protected readonly choicesLoaded = signal(false);
  /** The bank item chosen in the picker. */
  readonly chosen = signal<string | null>(null);
  protected readonly using = signal(false);
  protected readonly removing = signal(false);

  protected readonly menuItems: MenuItem[] = [
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
  protected compose(): void {
    const lesson = this.lesson();
    const owner =
      lesson.groupId === null ? { studentId: lesson.studentId } : { groupId: lesson.groupId };
    void this.router.navigate(['/teacher/materials/plans/new'], {
      queryParams: { lessonId: lesson.id, ...owner },
    });
  }

  protected open(planId: string): void {
    void this.router.navigate(['/teacher/materials/plans', planId], {
      queryParams: { lessonId: this.lesson().id },
    });
  }

  /** «Из банка»: the bank items by title, each with its course. */
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
        // a copy that cannot be deleted stays as a row no list shows (roadmap 11)
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
