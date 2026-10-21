import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Observable } from 'rxjs';
import { FileOpener } from '@shared/files/file-opener';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MaterialCard } from '@shared/ui/material-card';
import { TextbooksApi } from '../data-access/textbooks-api';
import { MyTextbook } from '../data-access/textbooks.models';
import { TEXTBOOK_KIND_ICONS, textbookDetails } from '../textbooks-labels';
import { TextbooksFilter } from '../teacher/textbooks-feed';
import { T } from '../i18n/texts';

/**
 * Student: the textbooks of the Materials feed — their own and their groups', newest change first, as cards
 * with covers (no actions); a tap opens the file. The page of Materials gives the search text and the filter.
 */
@Component({
  selector: 'tb-my-textbooks-feed',
  imports: [MaterialCard, EmptyState, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-load-state [state]="state" [what]="t.what" [compact]="limit() > 0" (retry)="load()">
      @if (shown().length > 0) {
        <ul class="tb-material-grid" [attr.aria-label]="t.list">
          @for (textbook of visible(); track textbook.id) {
            <li>
              <tb-material-card
                [title]="textbook.title"
                [supporting]="supportingOf(textbook)"
                [openLabel]="t.open(textbook.title)"
                [loader]="loadCover"
                [ref]="textbook.hasCover ? textbook.id : null"
                [version]="textbook.updatedAt"
                [icon]="icons[textbook.kind]"
                (open)="open(textbook)"
              />
            </li>
          }
        </ul>
      } @else if (limit() > 0) {
        <!-- the home page: a place without textbooks stays empty -->
      } @else if (textbooks().length > 0) {
        <tb-empty-state icon="tb-i-search" [title]="t.notFoundTitle" [hint]="t.notFoundHint" />
      } @else {
        <tb-empty-state icon="tb-i-menu_book" [title]="t.emptyTitle" [hint]="t.emptyHint" />
      }
    </tb-load-state>
  `,
})
export class MyTextbooksFeed implements OnInit {
  protected readonly t = T.mine;
  private readonly api = inject(TextbooksApi);
  private readonly fileOpener = inject(FileOpener);

  /** The search text of the page. */
  readonly query = input('');
  readonly filter = input<TextbooksFilter>('all');
  /** The home page shows only the newest textbooks and no empty state; 0 — all of them. */
  readonly limit = input(0);

  protected readonly icons = TEXTBOOK_KIND_ICONS;
  protected readonly state = new LoadState();
  protected readonly textbooks = signal<MyTextbook[]>([]);
  /** How many textbooks the student has (before the search and the filter). */
  readonly total = computed(() => this.textbooks().length);
  protected readonly shown = computed(() => {
    const filter = this.filter();
    const query = this.query().trim().toLocaleLowerCase('ru');
    return this.textbooks().filter(
      (textbook) =>
        (filter === 'all' || textbook.kind === filter) &&
        (query === '' ||
          textbook.title.toLocaleLowerCase('ru').includes(query) ||
          (textbook.course?.toLocaleLowerCase('ru').includes(query) ?? false)),
    );
  });

  protected readonly visible = computed(() => {
    const limit = this.limit();
    return limit > 0 ? this.shown().slice(0, limit) : this.shown();
  });

  /** The cover of a textbook (a stable function for `tb-blob-image`). */
  protected readonly loadCover = (id: string): Observable<Blob> => this.api.myCover(id);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api
      .myTextbooks()
      .pipe(this.state.track())
      .subscribe((textbooks) => {
        this.textbooks.set(textbooks);
      });
  }

  /** «Учебник · Английский · PDF, 120 с., 4,2 МБ · Группа: ОГЭ» for a card. */
  protected supportingOf(textbook: MyTextbook): string {
    const groups =
      textbook.groupNames.length > 0 ? this.t.groups(textbook.groupNames.join(', ')) : null;
    return [textbookDetails(textbook), groups].filter((part) => part !== null).join(' · ');
  }

  /** A PDF or a picture opens in a new tab; a Word file is saved. */
  protected open(textbook: MyTextbook): void {
    this.fileOpener.open(
      this.api.myFile(textbook.id),
      textbook.format !== 'DOCUMENT',
      () => textbook.filename,
    );
  }
}
