import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { injectMobile } from '@core/layout/mobile';
import { BoardsFilter, MyBoardsFeed } from '@features/boards/parts';
import { HelpButton } from '@features/help/parts';
import { MyTextbooksFeed, TextbooksFilter } from '@features/textbooks/parts';
import { FilterChip, FilterChips } from '@shared/ui/filter-chips';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes } from '@shared/ui/panes';
import { SearchField } from '@shared/ui/search-field';
import { Segment, SegmentGroup } from '@shared/ui/segment-group';
import { MaterialsTab } from './materials-page';
import { T } from './i18n/texts';

/**
 * Student: «Материалы» (redesign spec §10.1) — the boards and the textbooks open to them as the teacher's feed
 * of cards with previews, without the actions: the connected button group «Доски N · Учебники N»
 * (`?tab=boards|textbooks`), the chips («Все · На портале · Внешние»; for textbooks — by kind) and one search.
 */
@Component({
  selector: 'tb-my-materials-page',
  imports: [
    MyBoardsFeed,
    MyTextbooksFeed,
    FilterChips,
    HelpButton,
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
              [topic]="active() === 'boards' ? 'cabinet/lesson' : 'cabinet/textbooks'"
            />
            @if (!mobile()) {
              <tb-segment-group
                [label]="t.tabs"
                [segments]="segments()"
                [value]="active()"
                (valueChange)="selectTab($event)"
              />
            }
          </tb-page-header>

          @if (mobile()) {
            <tb-segment-group
              class="tb-my-materials__tabs"
              [label]="t.tabs"
              [segments]="segments()"
              [value]="active()"
              (valueChange)="selectTab($event)"
            />
          }

          <div class="tb-my-materials__bar">
            <tb-search-field [formControl]="search" [label]="t.searchMine" />
            <tb-filter-chips
              [label]="t.filters"
              [chips]="chips()"
              [value]="chip()"
              (valueChange)="picked.set($event)"
            />
          </div>
        </div>
        <div [hidden]="active() !== 'boards'">
          <tb-my-boards-feed #boards [query]="query()" [filter]="boardsFilter()" />
        </div>
        <div [hidden]="active() !== 'textbooks'">
          <tb-my-textbooks-feed #textbooks [query]="query()" [filter]="textbooksFilter()" />
        </div>
      </tb-pane>
    </tb-panes>
  `,
  styles: `
    .tb-my-materials__bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-3);
      margin-block: var(--tb-space-4);
    }

    .tb-my-materials__tabs {
      margin-block-end: var(--tb-space-3);
    }

    /* a phone: the search is on its own row, the chips wrap under it */
    @media (width < 37.5em) {
      .tb-my-materials__bar {
        display: grid;
        gap: var(--tb-space-2);
      }
    }
  `,
})
export class MyMaterialsPage {
  protected readonly t = T;
  protected readonly mobile = injectMobile();
  private readonly router = inject(Router);

  /** `?tab=` — boards (by default) or textbooks. */
  readonly tab = input<string | undefined>();

  protected readonly boards = viewChild<MyBoardsFeed>('boards');
  protected readonly textbooks = viewChild<MyTextbooksFeed>('textbooks');

  protected readonly active = computed<MaterialsTab>(() =>
    this.tab() === 'textbooks' ? 'textbooks' : 'boards',
  );
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly query = toSignal(this.search.valueChanges, { initialValue: '' });

  /** The chip the student chose; another tab starts again with «Все». */
  protected readonly picked = linkedSignal<MaterialsTab, string>({
    source: this.active,
    computation: () => 'all',
  });
  protected readonly chip = this.picked;
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

  protected selectTab(tab: MaterialsTab): void {
    void this.router.navigate([], {
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
