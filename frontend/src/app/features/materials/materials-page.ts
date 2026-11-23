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
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Params, Router, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Tab, TabList, Tabs } from 'primeng/tabs';
import { quietContext } from '@core/http/api-error.interceptor';
import { injectMobile } from '@core/layout/mobile';
import { openOnCreate } from '@core/routing/create-param';
import { BoardsFeed, BoardsFilter } from '@features/boards/parts';
import { HelpButton } from '@features/help/parts';
import { HomeworkBankFeed } from '@features/homework/parts';
import { IdentityApi } from '@features/identity/parts';
import {
  Course,
  CourseFilter,
  CourseList,
  CoursesApi,
  LessonPlansFeed,
  TextbooksFeed,
  TextbooksFilter,
} from '@features/textbooks/parts';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { FabMenu, FabMenuItem } from '@shared/ui/fab-menu';
import { MaterialSort } from '@shared/ui/material-sort';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes, injectListDetail } from '@shared/ui/panes';
import { SearchField } from '@shared/ui/search-field';
import { TabIndicator } from '@shared/ui/tab-indicator';
import { T } from './i18n/texts';

/** The kinds of materials the page shows (`?tab=`): the boards are a row of the list of their own. */
export type MaterialsTab = 'boards' | 'textbooks' | 'plans' | 'assignments';

/** The tabs of a course (and of «Все материалы», «Без курса»). */
type CourseTab = Exclude<MaterialsTab, 'boards'>;

/** What «Создать» makes. */
type CreateKind = 'textbook' | 'plan' | 'assignment' | 'board';

/** An item of the menu of the list pane the page draws itself: «Все материалы», «Без курса», «Доски». */
interface PlaceRow {
  readonly key: 'all' | 'none' | 'boards';
  readonly label: string;
  readonly icon: string;
  readonly count: number;
  readonly queryParams: Params;
}

/** A choice of «Фильтр»: the kind of a board or of a textbook. */
type FilterValue = 'all' | 'portal' | 'external' | 'TEXTBOOK' | 'WORKBOOK' | 'OTHER';

/** A student or a group the create dialogs of the feeds offer. */
interface MemberOption {
  readonly id: string;
  readonly name: string;
}

const COURSE_TABS: readonly CourseTab[] = ['textbooks', 'plans', 'assignments'];

const CREATE_ICONS: Record<CreateKind, string> = {
  textbook: 'tb-i-menu_book',
  plan: 'tb-i-list_alt',
  assignment: 'tb-i-assignment',
  board: 'tb-i-co_present',
};

/**
 * Teacher: «Материалы» as a list-detail (M3 canonical layout; ADR-0071, decisions 9–12). The list pane is a
 * navigation menu (`tb-nav-menu`, 466.4): «Все материалы», the headline «Курсы» and the courses in their order (`CourseList`: drag, «⋮» rename / delete, «+ Новый курс»),
 * a divider, «Без курса» and «Доски», each with how many materials it holds. The detail pane: the chosen item's title,
 * the tabs «Учебники · Планы · Задания» (none for «Доски») and one toolbar row — search, the «Фильтр» menu
 * (the textbook kind, the board kind) and the sort. The address keeps the state: `?course=<id>|none` and
 * `?tab=…` (`?tab=boards` is the row «Доски»; old links `?tab=…` still open their kind). On a phone the list
 * and the detail are two screens: an item opens the detail, «back» leads to the list. One create action:
 * «Создать ▾» in the header (the FAB menu on a phone) — Учебник · План урока · Задание · Доска — with the
 * chosen course prefilled. The feeds belong to their modules and stay mounted so every count is known.
 */
@Component({
  selector: 'tb-materials-page',
  imports: [
    BoardsFeed,
    CourseList,
    HomeworkBankFeed,
    LessonPlansFeed,
    TextbooksFeed,
    Button,
    ButtonAttributes,
    FabMenu,
    HelpButton,
    Menu,
    NgTemplateOutlet,
    PageHeader,
    Pane,
    Panes,
    ReactiveFormsModule,
    RouterLink,
    SearchField,
    Tab,
    TabIndicator,
    TabList,
    Tabs,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #createButton>
      <p-button
        [label]="t.create"
        icon="tb-i tb-i-arrow_drop_down"
        iconPos="right"
        [tbAttributes]="{ 'aria-haspopup': 'menu' }"
        (onClick)="createPopup.toggle($event)"
      />
    </ng-template>
    <tb-panes>
      @if (layout.list()) {
        <tb-pane kind="fixed" resizeKey="materials" [label]="t.title">
          <div tbPaneHeader>
            <tb-page-header [title]="t.title">
              <tb-help-button help [topic]="helpTopic()" />
              @if (!mobile()) {
                <ng-container [ngTemplateOutlet]="createButton" />
              }
            </tb-page-header>
          </div>
          <nav
            class="tb-nav-menu"
            [class.tb-nav-menu--touch]="layout.single()"
            [attr.aria-label]="t.places"
          >
            <ul class="tb-nav-menu__list">
              <ng-container
                [ngTemplateOutlet]="placeItem"
                [ngTemplateOutletContext]="{ $implicit: allRow() }"
              />
            </ul>
            <tb-course-list
              [(courses)]="courses"
              [current]="layout.single() ? null : currentCourse()"
              [counts]="courseCounts()"
              [queryParams]="courseParams"
              [touch]="layout.single()"
              (changed)="reload()"
            />
            <hr class="tb-nav-menu__divider" />
            <ul class="tb-nav-menu__list">
              @for (row of trailingRows(); track row.key) {
                <ng-container
                  [ngTemplateOutlet]="placeItem"
                  [ngTemplateOutletContext]="{ $implicit: row }"
                />
              }
            </ul>
          </nav>
        </tb-pane>
      }
      <!-- the detail stays mounted on the list screen of a phone: its feeds give the counts -->
      <tb-pane [label]="placeTitle()" [style.display]="layout.detail() ? null : 'none'">
        <div tbPaneHeader>
          @if (layout.single()) {
            <tb-page-header [title]="placeTitle()" back="/teacher/materials" [backLabel]="t.title">
              <tb-help-button help [topic]="helpTopic()" />
              @if (!mobile()) {
                <ng-container [ngTemplateOutlet]="createButton" />
              }
            </tb-page-header>
          } @else {
            <h2 class="tb-materials__title">{{ placeTitle() }}</h2>
          }
          @if (place() !== 'boards') {
            <p-tabs
              tbTabIndicator
              class="tb-tabs tb-materials__tabs"
              [class.tb-tabs--fixed]="mobile()"
              [value]="courseTab()"
              (valueChange)="selectTab($event)"
            >
              <p-tablist [attr.aria-label]="t.tabs">
                @for (tab of courseTabs; track tab) {
                  <p-tab [value]="tab"
                    ><span class="tb-tab-label">{{ t[tab] }}</span></p-tab
                  >
                }
              </p-tablist>
            </p-tabs>
          }
          <div class="tb-materials__bar">
            <tb-search-field [formControl]="search" [label]="searchLabel()" />
            @if (filterItems().length > 0) {
              <p-button
                icon="tb-i tb-i-filter_list"
                [label]="mobile() ? undefined : filterLabel()"
                [text]="true"
                severity="secondary"
                [ariaLabel]="t.filter.label + ': ' + filterLabel()"
                [tbAttributes]="{ 'aria-haspopup': 'menu' }"
                (onClick)="filterPopup.toggle($event)"
              />
            }
            <p-button
              class="tb-materials__sort"
              icon="tb-i tb-i-sort"
              [label]="mobile() ? undefined : sortLabels[sort()]"
              [text]="true"
              severity="secondary"
              [ariaLabel]="t.sort.label + ': ' + sortLabels[sort()]"
              [tbAttributes]="{ 'aria-haspopup': 'menu' }"
              (onClick)="sortPopup.toggle($event)"
            />
          </div>
        </div>
        <div [hidden]="kind() !== 'boards'">
          <tb-boards-feed
            #boards
            [query]="query()"
            [filter]="boardsFilter()"
            [sort]="sort()"
            [students]="students()"
            [groups]="groups()"
          />
        </div>
        <div [hidden]="kind() !== 'textbooks'">
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
        <div [hidden]="kind() !== 'plans'">
          <tb-lesson-plans-feed
            #plans
            [query]="query()"
            [course]="courseFilter()"
            [sort]="sort()"
            [courses]="courses()"
          />
        </div>
        <div [hidden]="kind() !== 'assignments'">
          <tb-homework-bank-feed
            #bank
            [query]="query()"
            [course]="courseFilter()"
            [sort]="sort()"
            [courses]="courses()"
          />
        </div>
      </tb-pane>
    </tb-panes>
    <ng-template #placeItem let-row>
      <li class="tb-nav-menu__item" [class.tb-nav-menu__item--current]="isCurrent(row.key)">
        <i class="tb-i" [class]="row.icon" aria-hidden="true"></i>
        <a
          class="tb-nav-menu__link"
          [routerLink]="[]"
          [queryParams]="row.queryParams"
          [attr.aria-current]="isCurrent(row.key) ? 'page' : null"
          >{{ row.label }}<span class="tb-sr-only">, {{ t.count(row.count) }}</span></a
        >
        <span class="tb-nav-menu__count" aria-hidden="true">{{ row.count }}</span>
      </li>
    </ng-template>
    <p-menu #createPopup [model]="createMenu" [popup]="true" appendTo="body" />
    <p-menu #filterPopup [model]="filterItems()" [popup]="true" appendTo="body" />
    <p-menu #sortPopup [model]="sortItems()" [popup]="true" appendTo="body" />
    <!-- on a phone the rail's «Создать» is not there: the page's own FAB menu (spec §1 principle 5) -->
    @if (mobile()) {
      <tb-fab-menu [items]="createFab" [label]="t.create" />
    }
  `,
  styles: `
    .tb-materials__title {
      margin: 0 0 var(--tb-gap-title);
      font: var(--tb-type-title-l);
      letter-spacing: var(--tb-tracking-title-l);
    }

    .tb-materials__tabs {
      display: block;
      margin-block-end: var(--tb-space-4);
    }

    .tb-materials__bar {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      margin-block-end: var(--tb-space-4);
    }

    .tb-materials__bar > tb-search-field {
      flex: 0 1 22.75rem;
      min-width: 0;
    }

    .tb-materials__sort {
      margin-inline-start: auto;
    }

    @media (width < 37.5em) {
      .tb-materials__bar > tb-search-field {
        flex: 1 1 auto;
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

  /** `?tab=` — the kind of materials: `boards` is the row «Доски», the others are the tabs. */
  readonly tab = input<string | undefined>();
  /** `?q=` — the search text to start with (the call's «Доска ученика» passes the student's name). */
  readonly q = input<string | undefined>();
  /** `?course=` — the row of the list: a course id or `none` (ADR-0071); none — «Все материалы». */
  readonly course = input<string | undefined>();

  protected readonly boards = viewChild<BoardsFeed>('boards');
  protected readonly textbooks = viewChild<TextbooksFeed>('textbooks');
  protected readonly plans = viewChild<LessonPlansFeed>('plans');
  protected readonly bank = viewChild<HomeworkBankFeed>('bank');

  /** A phone shows the detail once the address names a row or a tab (a link from elsewhere, a tap on a row). */
  protected readonly layout = injectListDetail(
    () => this.tab() !== undefined || this.course() !== undefined,
  );

  protected readonly courseTabs = COURSE_TABS;
  /** The tab of a course; textbooks by default and on «Доски». */
  protected readonly courseTab = computed<CourseTab>(() => {
    const tab = this.tab();
    return tab === 'plans' || tab === 'assignments' ? tab : 'textbooks';
  });
  /** The feed in sight. */
  protected readonly kind = computed<MaterialsTab>(() =>
    this.tab() === 'boards' ? 'boards' : this.courseTab(),
  );

  protected readonly students = signal<MemberOption[]>([]);
  protected readonly groups = signal<MemberOption[]>([]);
  /** The teacher's courses in their order; the list pane changes them. */
  protected readonly courses = signal<readonly Course[]>([]);
  /** A course of `?course=` that is gone (or not loaded yet) filters nothing. */
  protected readonly courseFilter = computed<CourseFilter>(() => {
    const course = this.course();
    if (course === 'none') return 'none';
    return this.courses().some((entry) => entry.id === course) ? (course ?? 'all') : 'all';
  });
  /** The chosen row: «Доски», a course, «Без курса» or «Все материалы». */
  protected readonly place = computed<string>(() =>
    this.kind() === 'boards' ? 'boards' : this.courseFilter(),
  );
  protected readonly currentCourse = computed(() => {
    const place = this.place();
    return place === 'boards' || place === 'all' || place === 'none' ? null : place;
  });
  protected readonly placeTitle = computed(() => {
    const place = this.place();
    if (place === 'boards') return T.boards;
    if (place === 'all') return T.all;
    if (place === 'none') return T.none;
    return this.courses().find((course) => course.id === place)?.name ?? T.all;
  });

  /** How many textbooks, plans and assignments each course has (`null` — without a course). */
  private readonly counts = computed(() => {
    const counts = new Map<string | null, number>();
    for (const feed of [this.textbooks(), this.plans(), this.bank()]) {
      for (const [course, count] of feed?.courseCounts() ?? []) {
        counts.set(course, (counts.get(course) ?? 0) + count);
      }
    }
    return counts;
  });
  protected readonly courseCounts = computed<ReadonlyMap<string, number>>(() => {
    const counts = new Map<string, number>();
    for (const [course, count] of this.counts()) {
      if (course !== null) counts.set(course, count);
    }
    return counts;
  });
  protected readonly allRow = computed<PlaceRow>(() => ({
    key: 'all',
    label: T.all,
    icon: 'tb-i-stacks',
    count:
      (this.textbooks()?.total() ?? 0) + (this.plans()?.total() ?? 0) + (this.bank()?.total() ?? 0),
    queryParams: { course: null, tab: this.courseTab() },
  }));
  protected readonly trailingRows = computed<readonly PlaceRow[]>(() => [
    {
      key: 'none',
      label: T.none,
      icon: 'tb-i-bookmark_remove',
      count: this.counts().get(null) ?? 0,
      queryParams: { course: 'none', tab: this.courseTab() },
    },
    {
      key: 'boards',
      label: T.boards,
      icon: 'tb-i-co_present',
      count: this.boards()?.total() ?? 0,
      queryParams: { course: null, tab: 'boards' },
    },
  ]);
  /** A course row keeps the tab in sight. */
  protected readonly courseParams = (courseId: string): Params => ({
    course: courseId,
    tab: this.courseTab(),
  });

  /** The bank of assignments is a part of the homework article; plans — of the textbooks one. */
  protected readonly helpTopic = computed(() => {
    const kind = this.kind();
    return kind === 'boards'
      ? 'teacher/boards'
      : kind === 'assignments'
        ? 'teacher/homework'
        : 'teacher/textbooks';
  });

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  /** Plans and assignments are found by title and course; boards and textbooks by people too. */
  protected readonly searchLabel = computed(() =>
    this.kind() === 'plans' || this.kind() === 'assignments' ? T.searchTemplates : T.search,
  );
  protected readonly sort = signal<MaterialSort>('changed');
  protected readonly sortLabels = T.sort;

  /** The filter the teacher chose; it resets to «Все» when the kind changes. */
  protected readonly filter = linkedSignal<MaterialsTab, FilterValue>({
    source: this.kind,
    computation: () => 'all',
  });
  protected readonly boardsFilter = computed<BoardsFilter>(() => {
    const filter = this.filter();
    return filter === 'portal' || filter === 'external' ? filter : 'all';
  });
  protected readonly textbooksFilter = computed<TextbooksFilter>(() => {
    const filter = this.filter();
    return filter === 'TEXTBOOK' || filter === 'WORKBOOK' || filter === 'OTHER' ? filter : 'all';
  });
  protected readonly filterLabel = computed(() => {
    const filter = this.filter();
    return filter === 'all' ? T.filter.label : T.filter[filter];
  });
  /** The kinds of the boards or the textbooks; plans and assignments have none. */
  protected readonly filterItems = computed<MenuItem[]>(() => {
    const kind = this.kind();
    const values =
      kind === 'boards'
        ? (['all', 'portal', 'external'] as const)
        : kind === 'textbooks'
          ? (['all', 'TEXTBOOK', 'WORKBOOK', 'OTHER'] as const)
          : [];
    return values.map((value) => ({
      label: T.filter[value],
      icon: value === this.filter() ? 'tb-i tb-i-check' : undefined,
      command: () => {
        this.filter.set(value);
      },
    }));
  });
  /**
   * A plan of the bank has no creation time in the list: «Сначала новые» is not offered; an assignment has no
   * change time: «Сначала изменённые» orders it by creation.
   */
  protected readonly sortItems = computed<MenuItem[]>(() =>
    (this.kind() === 'plans' || this.kind() === 'assignments'
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

  private readonly createKinds: readonly CreateKind[] = ['textbook', 'plan', 'assignment', 'board'];
  protected readonly createMenu: MenuItem[] = this.createKinds.map((kind) => ({
    label: T.createMenu[kind],
    icon: `tb-i ${CREATE_ICONS[kind]}`,
    command: () => {
      this.create(kind);
    },
  }));
  protected readonly createFab: readonly FabMenuItem[] = this.createKinds.map((kind) => ({
    label: T.createMenu[kind],
    icon: CREATE_ICONS[kind],
    run: () => {
      this.create(kind);
    },
  }));

  constructor() {
    // «Новая доска» / «Новый учебник» of the rail's «Создать»: the form of the feed (`?tab=` came with it)
    openOnCreate('board', () => {
      this.boards()?.openCreate();
    });
    openOnCreate('textbook', () => {
      this.textbooks()?.openCreate(this.currentCourse());
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

  protected isCurrent(key: PlaceRow['key']): boolean {
    return !this.layout.single() && this.place() === key;
  }

  protected selectTab(tab: string | number | undefined): void {
    void this.router.navigate([], {
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** A renamed or deleted course changes the course of textbooks, plans and assignments: they are read again. */
  protected reload(): void {
    this.textbooks()?.load();
    this.plans()?.load();
    this.bank()?.load();
  }

  /** «Создать»: the form or the editor of the kind, with the chosen course. */
  private create(kind: CreateKind): void {
    const course = this.currentCourse();
    if (kind === 'textbook') {
      this.textbooks()?.openCreate(course);
    } else if (kind === 'plan') {
      this.plans()?.openCreate(course);
    } else if (kind === 'assignment') {
      this.bank()?.openCreate(course);
    } else {
      this.boards()?.openCreate();
    }
  }
}
