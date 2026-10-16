import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tooltip } from 'primeng/tooltip';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HelpButton } from '@features/help/parts';
import { FileOpener } from '@shared/files/file-opener';
import { FileSaver } from '@shared/files/file-saver';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { TextbooksApi } from '../data-access/textbooks-api';
import { MyTextbook } from '../data-access/textbooks.models';
import { TEXTBOOK_KIND_ICONS, textbookDetails } from '../textbooks-labels';
import { T } from '../i18n/texts';
import { SearchField } from '@shared/ui/search-field';

/**
 * Student: «Учебники» — their own textbooks and their groups', newest change first; a tap opens one, the
 * button saves it.
 */
@Component({
  selector: 'tb-my-textbooks-page',
  imports: [
    SearchField,
    Button,
    Card,
    ReactiveFormsModule,
    Tooltip,
    HelpButton,
    EmptyState,
    LoadStateView,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="cabinet/textbooks" />
    </tb-page-header>
    <p-card>
      <h2 class="tb-sr-only">{{ t.list }}</h2>
      @if (textbooks().length > 0) {
        <div class="tb-toolbar">
          <tb-search-field [formControl]="search" [label]="t.search" />
        </div>
      }
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
        @if (shown().length > 0) {
          <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="t.title">
            @for (textbook of shown(); track textbook.id) {
              <li>
                <span class="tb-list__lead" aria-hidden="true"
                  ><i [class]="icons[textbook.kind]"></i
                ></span>
                <div class="tb-list__text">
                  <button
                    type="button"
                    class="tb-list__title tb-link-button"
                    [attr.aria-label]="t.open(textbook.title)"
                    (click)="open(textbook)"
                  >
                    {{ textbook.title }}
                  </button>
                  <span class="tb-list__supporting">{{ details(textbook) }}</span>
                  @if (textbook.groupNames.length > 0) {
                    <span class="tb-list__supporting">{{
                      t.groups(textbook.groupNames.join(', '))
                    }}</span>
                  }
                </div>
                <div class="tb-list__trail tb-list__trail--icons">
                  <p-button
                    icon="tb-i tb-i-download"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [pTooltip]="t.download(textbook.title)"
                    [ariaLabel]="t.download(textbook.title)"
                    (onClick)="download(textbook)"
                  />
                </div>
              </li>
            }
          </ul>
        } @else if (textbooks().length > 0) {
          <tb-empty-state icon="tb-i-search" [title]="t.notFoundTitle" [hint]="t.notFoundHint" />
        } @else {
          <tb-empty-state icon="tb-i-menu_book" [title]="t.emptyTitle" [hint]="t.emptyHint" />
        }
      </tb-load-state>
    </p-card>
  `,
})
export class MyTextbooksPage implements OnInit {
  protected readonly t = T.mine;
  private readonly api = inject(TextbooksApi);
  private readonly fileSaver = inject(FileSaver);
  private readonly fileOpener = inject(FileOpener);

  protected readonly icons = TEXTBOOK_KIND_ICONS;
  protected readonly details = textbookDetails;
  protected readonly textbooks = signal<MyTextbook[]>([]);
  protected readonly state = new LoadState();
  protected readonly search = new FormControl('', { nonNullable: true });
  private readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  /** The textbooks whose title has the search text. */
  protected readonly shown = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('ru');
    return query === ''
      ? this.textbooks()
      : this.textbooks().filter((textbook) =>
          textbook.title.toLocaleLowerCase('ru').includes(query),
        );
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .myTextbooks()
      .pipe(this.state.track())
      .subscribe((textbooks) => {
        this.textbooks.set(textbooks);
      });
  }

  /** A PDF or a picture opens in a new tab; a Word file is saved. */
  protected open(textbook: MyTextbook): void {
    this.fileOpener.open(
      this.api.myFile(textbook.id),
      textbook.format !== 'DOCUMENT',
      () => textbook.filename,
    );
  }

  protected download(textbook: MyTextbook): void {
    this.api.myFile(textbook.id).subscribe((blob) => {
      this.fileSaver.save(blob, textbook.filename);
    });
  }
}
