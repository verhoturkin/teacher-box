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

/** A student or a group the create dialogs of the feeds offer. */
interface MemberOption {
  readonly id: string;
  readonly name: string;
}

/**
 * Teacher: «Материалы» (redesign spec §10.1, ADR-0049) — boards and textbooks as one feed of cards with
 * previews. The connected button group «Доски N · Учебники N» switches the kind (`?tab=boards|textbooks`),
 * the chips filter it («Все · На портале · Внешние»; for textbooks — by kind), one search field and
 * the sort menu. A card opens the material, «⋮» keeps its actions. The feeds belong to their modules
 * (`@features/boards/parts`, `@features/textbooks/parts`); this page only composes them.
 */
@Component({
  selector: 'tb-materials-page',
  imports: [
    BoardsFeed,
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
              (valueChange)="chip.set($event)"
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
            [sort]="sort()"
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
      margin-block-end: var(--tb-space-4);
    }

    .tb-materials__bar > tb-search-field {
      flex: 0 1 22.75rem;
    }

    .tb-materials__sort {
      margin-inline-start: auto;
    }

    .tb-materials__tabs {
      margin-block-end: var(--tb-space-3);
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

  /** `?tab=` — boards (by default) or textbooks. */
  readonly tab = input<string | undefined>();

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
  protected readonly sortItems = computed<MenuItem[]>(() =>
    (['changed', 'title', 'created'] as const).map((value) => ({
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

  protected openCreate(): void {
    if (this.active() === 'boards') {
      this.boards()?.openCreate();
    } else {
      this.textbooks()?.openCreate();
    }
  }
}
