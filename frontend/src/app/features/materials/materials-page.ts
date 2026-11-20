import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { quietContext } from '@core/http/api-error.interceptor';
import { injectMobile } from '@core/layout/mobile';
import { openOnCreate } from '@core/routing/create-param';
import { BoardsFeed, BoardsFilter } from '@features/boards/parts';
import { HelpButton } from '@features/help/parts';
import { IdentityApi } from '@features/identity/parts';
import {
  Course,
  CourseFilter,
  CoursesApi,
  CoursesDialog,
  LessonPlansFeed,
  TextbooksFeed,
  TextbooksFilter,
} from '@features/textbooks/parts';
import { FilterChip, FilterChips } from '@shared/ui/filter-chips';
import { MaterialSort } from '@shared/ui/material-sort';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes } from '@shared/ui/panes';
import { SearchField } from '@shared/ui/search-field';
import { Segment, SegmentGroup } from '@shared/ui/segment-group';
import { T } from './i18n/texts';

/** The kinds of materials the page switches between (`?tab=`). */
export type MaterialsTab = 'boards' | 'textbooks' | 'plans';

/** A student or a group the create dialogs of the feeds offer. */
interface MemberOption {
  readonly id: string;
  readonly name: string;
}

/**
 * Teacher: «Материалы» (redesign spec §10.1, ADR-0049) — boards and textbooks as one feed of cards with
 * previews. The connected button group «Доски N · Учебники N» switches the kind (`?tab=boards|textbooks`),
 * the chips filter it («Все · На портале · Внешние»; for textbooks — by kind), one search field and
 * the sort menu. Textbooks and the bank of lesson plans («Планы», roadmap 11) also have the course filter
 * (`?course=`, «Все · <курсы> · Без курса», ADR-0071), its «⋮» opens «Курсы». A card opens the material, «⋮» keeps its actions. The feeds belong to their modules
 * (`@features/boards/parts`, `@features/textbooks/parts`); this page only composes them.
 */
@Component({
  selector: 'tb-materials-page',
  imports: [
    BoardsFeed,
    CoursesDialog,
    LessonPlansFeed,
    TextbooksFeed,
    Button,
    FilterChips,
    HelpButton,
    Menu,
    PageHeader,
    Pane,
    Panes,
    ReactiveFormsModule,
    SearchField,
    SegmentGroup,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      <tb-pane [label]="t.title">
        <div tbPaneHeader>
          <tb-page-header [title]="t.title">
            <tb-help-button
              help
              [topic]="active() === 'boards' ? 'teacher/boards' : 'teacher/textbooks'"
            />
            @if (!mobile() && active() === 'plans') {
              <p-button [label]="t.newPlan" icon="tb-i tb-i-add" (onClick)="openCreate()" />
            }
            @if (!mobile()) {
              <tb-segment-group
                [label]="t.tabs"
                [segments]="segments()"
                [value]="active()"
                [outlined]="true"
                (valueChange)="selectTab($event)"
              />
            }
            <!-- on a phone the rail's «Создать» is not there: the page's own FAB (spec §1 principle 5) -->
            @if (mobile()) {
              <p-button
                class="tb-page-fab"
                [label]="createLabel()"
                icon="tb-i tb-i-add"
                (onClick)="openCreate()"
              />
            }
          </tb-page-header>

          @if (mobile()) {
            <tb-segment-group
              class="tb-materials__tabs"
              [label]="t.tabs"
              [segments]="segments()"
              [value]="active()"
              [outlined]="true"
              (valueChange)="selectTab($event)"
            />
          }

          <div class="tb-materials__bar">
            <tb-search-field [formControl]="search" [label]="t.search" />
            @if (active() !== 'plans') {
              <tb-filter-chips
                [label]="t.filters"
                [chips]="chips()"
                [value]="chip()"
                (valueChange)="chip.set($event)"
              />
            }
            <p-button
              class="tb-materials__sort"
              icon="tb-i tb-i-sort"
              [label]="mobile() ? undefined : sortLabels[sort()]"
              [text]="true"
              severity="secondary"
              [ariaLabel]="t.sort.label + ': ' + sortLabels[sort()]"
              (onClick)="sortPopup.toggle($event)"
            />
            <p-menu #sortPopup [model]="sortItems()" [popup]="true" appendTo="body" />
          </div>

          @if (active() !== 'boards') {
            <div class="tb-materials__courses">
              @if (courses().length > 0) {
                <tb-filter-chips
                  [label]="t.courses.filter"
                  [chips]="courseChips()"
                  [value]="courseFilter()"
                  [oneRow]="true"
                  (valueChange)="selectCourse($event)"
                />
                <p-button
                  icon="tb-i tb-i-more_vert"
                  severity="secondary"
                  [text]="true"
                  [rounded]="true"
                  [ariaLabel]="t.courses.menu"
                  (onClick)="coursesPopup.toggle($event)"
                />
              } @else {
                <p-button
                  icon="tb-i tb-i-school"
                  severity="secondary"
                  [text]="true"
                  [label]="t.courses.manage"
                  (onClick)="coursesOpen.set(true)"
                />
              }
              <p-menu #coursesPopup [model]="courseItems" [popup]="true" appendTo="body" />
            </div>
          }
        </div>
        <div [hidden]="active() !== 'boards'">
          <tb-boards-feed
            #boards
            [query]="query()"
            [filter]="boardsFilter()"
            [sort]="sort()"
            [students]="students()"
            [groups]="groups()"
          />
        </div>
        <div [hidden]="active() !== 'textbooks'">
          <tb-textbooks-feed
            #textbooks
            [query]="query()"
            [filter]="textbooksFilter()"
            [course]="courseFilter()"
            [sort]="sort()"
            [students]="students()"
            [groups]="groups()"
            [courses]="courses()"
          />
        </div>
        <div [hidden]="active() !== 'plans'">
          <tb-lesson-plans-feed
            #plans
            [query]="query()"
            [course]="courseFilter()"
            [sort]="sort()"
            [courses]="courses()"
          />
        </div>
      </tb-pane>
    </tb-panes>
    <tb-courses-dialog
      [visible]="coursesOpen()"
      (visibleChange)="coursesVisible($event)"
      [(courses)]="courses"
    />
  `,
  styles: `
    .tb-materials__bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-3);
      margin-block-end: var(--tb-space-4);
    }

    .tb-materials__bar > tb-search-field {
      flex: 0 1 22.75rem;
    }

    .tb-materials__courses {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
      margin-block-end: var(--tb-space-4);
    }

    .tb-materials__courses > tb-filter-chips {
      flex: 1 1 auto;
      min-width: 0;
    }

    .tb-materials__sort {
      margin-inline-start: auto;
    }

    @media (width < 37.5em) {
      .tb-materials__bar > tb-search-field {
        flex-basis: 100%;
      }

      .tb-materials__bar {
        gap: var(--tb-space-2);
      }
    }
  `,
})
export class MaterialsPage implements OnInit {
  protected readonly t = T;
  protected readonly mobile = injectMobile();
  private readonly router = inject(Router);
  private readonly identity = inject(IdentityApi);
  private readonly coursesApi = inject(CoursesApi);

  /** `?tab=` — boards (by default) or textbooks. */
  readonly tab = input<string | undefined>();
  /** `?q=` — the search text to start with (the call's «Доска ученика» passes the student's name). */
  readonly q = input<string | undefined>();
  /** `?course=` — the course filter of the textbooks: a course id or `none` (ADR-0071). */
  readonly course = input<string | undefined>();

  protected readonly boards = viewChild<BoardsFeed>('boards');
  protected readonly textbooks = viewChild<TextbooksFeed>('textbooks');
  protected readonly plans = viewChild<LessonPlansFeed>('plans');

  protected readonly active = computed<MaterialsTab>(() => {
    const tab = this.tab();
    return tab === 'textbooks' || tab === 'plans' ? tab : 'boards';
  });
  protected readonly createLabel = computed(() => {
    const tab = this.active();
    return tab === 'boards' ? T.newBoard : tab === 'textbooks' ? T.newTextbook : T.newPlan;
  });
  protected readonly students = signal<MemberOption[]>([]);
  protected readonly groups = signal<MemberOption[]>([]);
  /** The teacher's courses in their order; the dialog «Курсы» changes them. */
  protected readonly courses = signal<readonly Course[]>([]);
  protected readonly coursesOpen = signal(false);
  /** A course of `?course=` that is gone (or not loaded yet) filters nothing. */
  protected readonly courseFilter = computed<CourseFilter>(() => {
    const course = this.course();
    if (course === 'none') return 'none';
    return this.courses().some((entry) => entry.id === course) ? (course ?? 'all') : 'all';
  });
  protected readonly courseChips = computed<readonly FilterChip<string>[]>(() => [
    { value: 'all', label: T.courses.all },
    ...this.courses().map((course) => ({ value: course.id, label: course.name })),
    { value: 'none', label: T.courses.none },
  ]);
  protected readonly courseItems: MenuItem[] = [
    {
      label: T.courses.manage,
      icon: 'tb-i tb-i-school',
      command: () => {
        this.coursesOpen.set(true);
      },
    },
  ];

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  protected readonly sort = signal<MaterialSort>('changed');
  protected readonly sortLabels = T.sort;

  /** The chip the teacher chose; it resets to «Все» when the tab changes. */
  protected readonly chip = linkedSignal<MaterialsTab, string>({
    source: this.active,
    computation: () => 'all',
  });
  protected readonly boardsFilter = computed<BoardsFilter>(() => {
    const chip = this.chip();
    return chip === 'portal' || chip === 'external' ? chip : 'all';
  });
  protected readonly textbooksFilter = computed<TextbooksFilter>(() => {
    const chip = this.chip();
    return chip === 'TEXTBOOK' || chip === 'WORKBOOK' || chip === 'OTHER' ? chip : 'all';
  });

  protected readonly segments = computed<readonly Segment<MaterialsTab>[]>(() => [
    { value: 'boards', label: T.boards, count: this.boards()?.total() ?? 0 },
    { value: 'textbooks', label: T.textbooks, count: this.textbooks()?.total() ?? 0 },
    { value: 'plans', label: T.plans, count: this.plans()?.total() ?? 0 },
  ]);
  protected readonly chips = computed<readonly FilterChip<string>[]>(() => {
    const kinds: readonly FilterChip<string>[] =
      this.active() === 'boards'
        ? [
            { value: 'portal', label: T.chips.portal },
            { value: 'external', label: T.chips.external },
          ]
        : (['TEXTBOOK', 'WORKBOOK', 'OTHER'] as const).map((kind) => ({
            value: kind,
            label: T.chips[kind],
          }));
    return [{ value: 'all', label: T.chips.all }, ...kinds];
  });
  /** A plan of the bank has no creation time in the list: «Сначала новые» is not offered. */
  protected readonly sortItems = computed<MenuItem[]>(() =>
    (this.active() === 'plans'
      ? (['changed', 'title'] as const)
      : (['changed', 'title', 'created'] as const)
    ).map((value) => ({
      label: T.sort[value],
      icon: value === this.sort() ? 'tb-i tb-i-check' : undefined,
      command: () => {
        this.sort.set(value);
      },
    })),
  );
  constructor() {
    // «Новая доска» / «Новый учебник» of the rail's «Создать»: the form of the feed (`?tab=` came with it)
    openOnCreate('board', () => {
      this.boards()?.openCreate();
    });
    openOnCreate('textbook', () => {
      this.textbooks()?.openCreate();
    });
  }

  ngOnInit(): void {
    this.search.setValue(this.q() ?? '');
    this.identity.listStudents(quietContext()).subscribe((students) => {
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, name: student.displayName })),
      );
    });
    this.coursesApi.list(quietContext()).subscribe((courses) => {
      this.courses.set(courses);
    });
    this.identity.listGroups(quietContext()).subscribe((groups) => {
      this.groups.set(
        groups
          .filter((group) => group.archivedAt === null)
          .map((group) => ({ id: group.id, name: group.name })),
      );
    });
  }

  protected selectTab(tab: MaterialsTab): void {
    void this.router.navigate([], {
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected selectCourse(course: string): void {
    void this.router.navigate([], {
      queryParams: { course: course === 'all' ? null : course },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Renamed or deleted courses change the course of textbooks and plans: the feeds are read again. */
  protected coursesVisible(visible: boolean): void {
    this.coursesOpen.set(visible);
    if (!visible) {
      this.textbooks()?.load();
      this.plans()?.load();
    }
  }

  protected openCreate(): void {
    const tab = this.active();
    if (tab === 'boards') {
      this.boards()?.openCreate();
    } else if (tab === 'textbooks') {
      this.textbooks()?.openCreate();
    } else {
      this.plans()?.openCreate();
    }
  }
}
