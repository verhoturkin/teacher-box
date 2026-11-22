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
import { Confirm } from '@shared/ui/confirm';
import { EmptyState } from '@shared/ui/empty-state';
import { ListRow } from '@shared/ui/list-row';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MaterialCard } from '@shared/ui/material-card';
import { MaterialSort } from '@shared/ui/material-sort';
import { Course, CourseFilter, countByCourse } from '@features/textbooks/parts';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentSummary } from '../data-access/homework.models';
import { T } from '../i18n/texts';

/** Where a bank item opens: the homework editor, without students or a deadline. */
function itemLink(item: AssignmentSummary): string[] {
  return ['/teacher/homework', item.id, 'edit'];
}

/**
 * Teacher: the bank of assignments — the tab «Задания» of «Материалы» (roadmap 11 «Bank», 462.2). Cards of the
 * bank items with their course and «Использовано N раз»; the page gives the search text, the course filter and
 * the sort. A card opens the editor, «⋮» keeps «Изменить» and «Удалить…» (the working copies stay); «Создать»
 * opens the editor of a new bank item (`?bank=true`).
 */
@Component({
  selector: 'tb-homework-bank-feed',
  imports: [ListRow, MaterialCard, Menu, EmptyState, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
      @if (shown().length > 0) {
        <ul class="tb-material-grid" [attr.aria-label]="t.list">
          @for (item of shown(); track item.id) {
            <li tbListRow>
              <tb-material-card
                [title]="item.title"
                [supporting]="supportingOf(item)"
                [routerLink]="link(item)"
                [tonal]="true"
                icon="tb-i-assignment"
                [actionsLabel]="t.actions(item.title)"
                [menuOpen]="menuFor()?.id === item.id"
                (menu)="openMenu(item, $event)"
              />
            </li>
          }
        </ul>
      } @else if (items().length > 0) {
        <tb-empty-state icon="tb-i-search" [title]="t.notFoundTitle" [hint]="t.notFoundHint" />
      } @else {
        <tb-empty-state icon="tb-i-assignment" [title]="t.emptyTitle" [hint]="t.emptyHint" />
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
export class HomeworkBankFeed {
  protected readonly t = T.bank;
  private readonly api = inject(HomeworkApi);
  private readonly router = inject(Router);
  private readonly confirm = inject(Confirm);

  /** The search text of the page: the title or the course of an item. */
  readonly query = input('');
  readonly course = input<CourseFilter>('all');
  readonly sort = input<MaterialSort>('changed');
  /** The teacher's courses: the names on the cards. */
  readonly courses = input<readonly Course[]>([]);

  protected readonly state = new LoadState();
  protected readonly items = signal<AssignmentSummary[]>([]);
  /** How many bank items there are (before the search, the filter and the sort). */
  readonly total = computed(() => this.items().length);
  /** How many items each course has (`null` — without a course). */
  readonly courseCounts = computed(() => countByCourse(this.items()));
  private readonly courseNames = computed(
    () => new Map(this.courses().map((course) => [course.id, course.name])),
  );
  /** The items of the course filter and the search, in the order of the sort (no change time: newest first). */
  protected readonly shown = computed(() => {
    const course = this.course();
    const names = this.courseNames();
    const query = this.query().trim().toLocaleLowerCase('ru');
    const matching = this.items().filter(
      (item) =>
        (course === 'all' || item.courseId === (course === 'none' ? null : course)) &&
        (query === '' ||
          item.title.toLocaleLowerCase('ru').includes(query) ||
          (names
            .get(item.courseId ?? '')
            ?.toLocaleLowerCase('ru')
            .includes(query) ??
            false)),
    );
    return this.sort() === 'title'
      ? matching.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
      : matching.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
  protected readonly link = itemLink;
  private readonly menu = viewChild.required<Menu>('menu');
  /** The item whose «⋮» menu is open: one popup menu serves every card. */
  protected readonly menuFor = signal<AssignmentSummary | null>(null);
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const item = this.menuFor();
    return item === null ? [] : this.actionsOf(item);
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.api
      .assignments(true)
      .pipe(this.state.track())
      .subscribe((items) => {
        this.items.set(items);
      });
  }

  /** «Английский A2 · Использовано 3 раза» for a card. */
  protected supportingOf(item: AssignmentSummary): string {
    const course =
      item.courseId === null ? T.bank.noCourse : (this.courseNames().get(item.courseId) ?? null);
    return [course, T.bank.uses(item.uses)].filter((part) => part !== null).join(' · ');
  }

  protected openMenu(item: AssignmentSummary, event: Event): void {
    this.menuFor.set(item);
    this.menu().toggle(event);
  }

  /** «Создать» of the page: a new bank item, of the course given, if any. */
  openCreate(course: string | null = null): void {
    void this.router.navigate(['/teacher/homework/new'], {
      queryParams: course === null ? { bank: true } : { bank: true, course },
    });
  }

  protected async confirmRemove(item: AssignmentSummary): Promise<void> {
    if (
      await this.confirm.danger({
        header: T.bank.deleteHeader,
        message: T.bank.deleteMessage(item.title),
        acceptLabel: T.bank.delete,
      })
    ) {
      this.api.deleteAssignment(item.id).subscribe(() => {
        this.load();
      });
    }
  }

  private actionsOf(item: AssignmentSummary): MenuItem[] {
    return [
      {
        label: T.bank.edit,
        icon: 'tb-i tb-i-edit',
        command: () => {
          void this.router.navigate(itemLink(item));
        },
      },
      {
        label: T.bank.deleteItem,
        icon: 'tb-i tb-i-delete',
        styleClass: 'tb-menu-item--danger',
        command: () => {
          void this.confirmRemove(item);
        },
      },
    ];
  }
}
