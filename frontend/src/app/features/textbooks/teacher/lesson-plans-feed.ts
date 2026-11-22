import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { quietContext } from '@core/http/api-error.interceptor';
import { Confirm } from '@shared/ui/confirm';
import { EmptyState } from '@shared/ui/empty-state';
import { ListRow } from '@shared/ui/list-row';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MaterialCard } from '@shared/ui/material-card';
import { MaterialSort } from '@shared/ui/material-sort';
import { countByCourse } from '../course-options';
import { Course } from '../data-access/courses.models';
import { LessonPlansApi } from '../data-access/lesson-plans-api';
import { LessonPlanSummary } from '../data-access/lesson-plans.models';
import { T } from '../i18n/texts';
import { CourseFilter } from './textbooks-feed';

/** Where a plan opens in its editor. */
function planLink(plan: LessonPlanSummary): string[] {
  return ['/teacher/materials/plans', plan.id];
}

/**
 * Teacher: the bank of lesson plans — the tab «Планы» of «Материалы» (roadmap 11 «Bank»). Cards of the bank
 * items with their course and «Использовано N раз»; the page gives the search text, the course filter and the
 * sort (a plan has no creation time in the list: «Новые» orders by the last change). A card opens the editor,
 * «⋮» keeps «Изменить» and «Удалить…» (the lessons' copies stay).
 */
@Component({
  selector: 'tb-lesson-plans-feed',
  imports: [ListRow, MaterialCard, Menu, EmptyState, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
      @if (shown().length > 0) {
        <ul class="tb-material-grid" [attr.aria-label]="t.list">
          @for (plan of shown(); track plan.id) {
            <li tbListRow>
              <tb-material-card
                [title]="plan.title"
                [supporting]="supportingOf(plan)"
                [routerLink]="link(plan)"
                [tonal]="true"
                icon="tb-i-list_alt"
                [actionsLabel]="t.actions(plan.title)"
                [menuOpen]="menuFor()?.id === plan.id"
                (menu)="openMenu(plan, $event)"
              />
            </li>
          }
        </ul>
      } @else if (plans().length > 0) {
        <tb-empty-state icon="tb-i-search" [title]="t.notFoundTitle" [hint]="t.notFoundHint" />
      } @else {
        <tb-empty-state icon="tb-i-list_alt" [title]="t.emptyTitle" [hint]="t.emptyHint" />
      }
    </tb-load-state>
    <p-menu
      #menu
      [model]="menuItems()"
      [popup]="true"
      appendTo="body"
      (onHide)="menuFor.set(null)"
    />
  `,
})
export class LessonPlansFeed {
  protected readonly t = T.plans;
  private readonly api = inject(LessonPlansApi);
  private readonly router = inject(Router);
  private readonly confirm = inject(Confirm);

  /** The search text of the page: the title or the course of a plan. */
  readonly query = input('');
  readonly course = input<CourseFilter>('all');
  readonly sort = input<MaterialSort>('changed');
  /** The teacher's courses: the names on the cards. */
  readonly courses = input<readonly Course[]>([]);

  protected readonly state = new LoadState();
  protected readonly plans = signal<LessonPlanSummary[]>([]);
  /** How many bank items there are (before the search, the filter and the sort). */
  readonly total = computed(() => this.plans().length);
  /** How many plans each course has (`null` — without a course). */
  readonly courseCounts = computed(() => countByCourse(this.plans()));
  private readonly courseNames = computed(
    () => new Map(this.courses().map((course) => [course.id, course.name])),
  );
  /** The plans of the course filter and the search, in the order of the sort. */
  protected readonly shown = computed(() => {
    const course = this.course();
    const names = this.courseNames();
    const query = this.query().trim().toLocaleLowerCase('ru');
    const matching = this.plans().filter(
      (plan) =>
        (course === 'all' || plan.courseId === (course === 'none' ? null : course)) &&
        (query === '' ||
          plan.title.toLocaleLowerCase('ru').includes(query) ||
          (names
            .get(plan.courseId ?? '')
            ?.toLocaleLowerCase('ru')
            .includes(query) ??
            false)),
    );
    return this.sort() === 'title'
      ? matching.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
      : matching.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });
  protected readonly link = planLink;
  private readonly menu = viewChild.required<Menu>('menu');
  /** The plan whose «⋮» menu is open: one popup menu serves every card. */
  protected readonly menuFor = signal<LessonPlanSummary | null>(null);
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const plan = this.menuFor();
    return plan === null ? [] : this.actionsOf(plan);
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.api
      .list(true, quietContext())
      .pipe(this.state.track())
      .subscribe((plans) => {
        this.plans.set(plans);
      });
  }

  /** «Английский A2 · Использовано 3 раза» for a card. */
  protected supportingOf(plan: LessonPlanSummary): string {
    const course =
      plan.courseId === null ? T.plans.noCourse : (this.courseNames().get(plan.courseId) ?? null);
    return [course, T.plans.uses(plan.uses)].filter((part) => part !== null).join(' · ');
  }

  protected openMenu(plan: LessonPlanSummary, event: Event): void {
    this.menuFor.set(plan);
    this.menu().toggle(event);
  }

  /** «Создать» of the page: a new plan of the bank, of the course given, if any. */
  openCreate(course: string | null = null): void {
    void this.router.navigate(['/teacher/materials/plans/new'], {
      queryParams: course === null ? {} : { course },
    });
  }

  protected async confirmRemove(plan: LessonPlanSummary): Promise<void> {
    if (
      await this.confirm.danger({
        header: T.plans.deleteHeader,
        message: T.plans.deleteMessage(plan.title),
        acceptLabel: T.plans.delete,
      })
    ) {
      this.api.remove(plan.id).subscribe(() => {
        this.load();
      });
    }
  }

  private actionsOf(plan: LessonPlanSummary): MenuItem[] {
    return [
      {
        label: T.plans.edit,
        icon: 'tb-i tb-i-edit',
        command: () => {
          void this.router.navigate(planLink(plan));
        },
      },
      {
        label: T.plans.deleteItem,
        icon: 'tb-i tb-i-delete',
        styleClass: 'tb-menu-item--danger',
        command: () => {
          void this.confirmRemove(plan);
        },
      },
    ];
  }
}
