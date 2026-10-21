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
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Select } from 'primeng/select';
import { quietContext } from '@core/http/api-error.interceptor';
import { injectMobile } from '@core/layout/mobile';
import { openOnCreate } from '@core/routing/create-param';
import { BoardsFeed, BoardsFilter } from '@features/boards/parts';
import { HelpButton } from '@features/help/parts';
import { IdentityApi } from '@features/identity/parts';
import { TextbooksFeed, TextbooksFilter } from '@features/textbooks/parts';
import { FilterChip, FilterChips } from '@shared/ui/filter-chips';
import { MaterialSort } from '@shared/ui/material-sort';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes } from '@shared/ui/panes';
import { SearchField } from '@shared/ui/search-field';
import { Segment, SegmentGroup } from '@shared/ui/segment-group';
import { T } from './i18n/texts';

/** The two kinds of materials the page switches between (`?tab=`). */
export type MaterialsTab = 'boards' | 'textbooks';

/** The chip that asks for a student or a group; the others are the filters of the tab's feed. */
const MEMBER = 'member';

/** A student or a group of the member filter, with the `student:<id>` / `group:<id>` value of its option. */
interface MemberOption {
  readonly id: string;
  readonly name: string;
}

/**
 * Teacher: «Материалы» (redesign spec §10.1, ADR-0049) — boards and textbooks as one feed of cards with
 * previews. The connected button group «Доски N · Учебники N» switches the kind (`?tab=boards|textbooks`),
 * the chips filter it («Все · На портале · Внешние · Ученик или группа»; for textbooks — by kind), one
 * search field and the sort menu. A card opens the material, «⋮» keeps its actions. A student or a group
 * (`?student=`, `?group=`) shows the materials open to them. The feeds belong to their modules
 * (`@features/boards/parts`, `@features/textbooks/parts`); this page only composes them.
 */
@Component({
  selector: 'tb-materials-page',
  imports: [
    BoardsFeed,
    TextbooksFeed,
    Button,
    FilterChips,
    FormsModule,
    HelpButton,
    Menu,
    PageHeader,
    Pane,
    Panes,
    ReactiveFormsModule,
    SearchField,
    SegmentGroup,
    Select,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      <tb-pane [label]="t.title">
        <tb-page-header [title]="t.title">
          <tb-help-button
            help
            [topic]="active() === 'boards' ? 'teacher/boards' : 'teacher/textbooks'"
          />
          @if (!mobile()) {
            <tb-segment-group
              [label]="t.tabs"
              [segments]="segments()"
              [value]="active()"
              (valueChange)="selectTab($event)"
            />
          }
          <!-- on a phone the rail's «Создать» is not there: the page's own FAB (spec §1 principle 5) -->
          @if (mobile()) {
            <p-button
              class="tb-page-fab"
              [label]="active() === 'boards' ? t.newBoard : t.newTextbook"
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
            (valueChange)="selectTab($event)"
          />
        }

        <div class="tb-materials__bar">
          <tb-search-field [formControl]="search" [label]="t.search" />
          <tb-filter-chips
            [label]="t.filters"
            [chips]="chips()"
            [value]="chip()"
            (valueChange)="selectChip($event)"
          />
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
        @if (chip() === 'member') {
          <p-select
            class="tb-materials__member"
            [options]="memberOptions()"
            [group]="true"
            optionLabel="label"
            optionValue="value"
            [ngModel]="memberValue()"
            (ngModelChange)="selectMember($event)"
            [placeholder]="t.member.placeholder"
            [ariaLabel]="t.member.label"
            [showClear]="true"
          />
        }

        <div [hidden]="active() !== 'boards'">
          <tb-boards-feed
            #boards
            [query]="query()"
            [filter]="boardsFilter()"
            [sort]="sort()"
            [student]="student()"
            [group]="group()"
            [students]="students()"
            [groups]="groups()"
          />
        </div>
        <div [hidden]="active() !== 'textbooks'">
          <tb-textbooks-feed
            #textbooks
            [query]="query()"
            [filter]="textbooksFilter()"
            [sort]="sort()"
            [member]="student() ?? group()"
            [students]="students()"
            [groups]="groups()"
          />
        </div>
      </tb-pane>
    </tb-panes>
  `,
  styles: `
    .tb-materials__bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-3);
      margin-block: var(--tb-space-4);
    }

    .tb-materials__sort {
      margin-inline-start: auto;
    }

    p-select.tb-materials__member {
      inline-size: min(22rem, 100%);
      margin-block-end: var(--tb-space-4);
    }

    .tb-materials__tabs {
      margin-block-end: var(--tb-space-3);
    }

    /* a phone: the search and the sort share a row, the chips wrap under them */
    @media (width < 37.5em) {
      .tb-materials__bar {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: var(--tb-space-2);
      }

      .tb-materials__bar > tb-search-field {
        inline-size: 100%;
      }

      .tb-materials__bar > tb-filter-chips {
        grid-row: 2;
        grid-column: 1 / -1;
      }

      .tb-materials__sort {
        margin-inline-start: 0;
      }
    }
  `,
})
export class MaterialsPage implements OnInit {
  protected readonly t = T;
  protected readonly mobile = injectMobile();
  private readonly router = inject(Router);
  private readonly identity = inject(IdentityApi);

  /** `?tab=` — boards (by default) or textbooks. */
  readonly tab = input<string | undefined>();
  /** `?student=<id>` — the materials open to a student (their groups' too). */
  readonly student = input<string | undefined>();
  /** `?group=<id>` — the materials open to a group. */
  readonly group = input<string | undefined>();

  protected readonly boards = viewChild<BoardsFeed>('boards');
  protected readonly textbooks = viewChild<TextbooksFeed>('textbooks');

  protected readonly active = computed<MaterialsTab>(() =>
    this.tab() === 'textbooks' ? 'textbooks' : 'boards',
  );
  protected readonly students = signal<MemberOption[]>([]);
  protected readonly groups = signal<MemberOption[]>([]);

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  protected readonly sort = signal<MaterialSort>('changed');
  protected readonly sortLabels = T.sort;

  /** The chip the teacher chose; a student or a group in the address always means the member chip. */
  private readonly picked = linkedSignal<MaterialsTab, string>({
    source: this.active,
    computation: () => 'all',
  });
  protected readonly chip = computed(() =>
    this.student() || this.group() ? MEMBER : this.picked(),
  );
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
    return [
      { value: 'all', label: T.chips.all },
      ...kinds,
      { value: MEMBER, label: T.chips.member },
    ];
  });
  protected readonly sortItems = computed<MenuItem[]>(() =>
    (['changed', 'title', 'created'] as const).map((value) => ({
      label: T.sort[value],
      icon: value === this.sort() ? 'tb-i tb-i-check' : undefined,
      command: () => {
        this.sort.set(value);
      },
    })),
  );
  protected readonly memberOptions = computed(() => [
    {
      label: T.member.students,
      items: this.students().map((student) => ({
        label: student.name,
        value: `student:${student.id}`,
      })),
    },
    {
      label: T.member.groups,
      items: this.groups().map((group) => ({ label: group.name, value: `group:${group.id}` })),
    },
  ]);
  protected readonly memberValue = computed(() => {
    const student = this.student();
    const group = this.group();
    return student ? `student:${student}` : group ? `group:${group}` : null;
  });

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
    this.identity.listStudents(quietContext()).subscribe((students) => {
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, name: student.displayName })),
      );
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

  protected selectChip(value: string): void {
    this.picked.set(value);
    if (value !== MEMBER && this.memberValue() !== null) {
      this.selectMember(null);
    }
  }

  /** The student or the group of the select, or none: the address keeps it (`?student=`, `?group=`). */
  selectMember(value: string | null): void {
    const [kind, id] = value?.split(':') ?? [];
    void this.router.navigate([], {
      queryParams: {
        student: kind === 'student' ? id : null,
        group: kind === 'group' ? id : null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected openCreate(): void {
    if (this.active() === 'boards') {
      this.boards()?.openCreate();
    } else {
      this.textbooks()?.openCreate();
    }
  }
}
