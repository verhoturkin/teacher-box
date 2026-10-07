import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Card } from 'primeng/card';
import { HelpButton } from '@features/help/parts';
import { FileSaver } from '@shared/files/file-saver';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { TextbooksApi } from '../data-access/textbooks-api';
import { MyTextbook } from '../data-access/textbooks.models';
import { TEXTBOOK_KIND_ICONS, textbookDetails } from '../textbooks-labels';

/** Student: «Учебники» — their own textbooks and their groups', newest change first; a tap downloads. */
@Component({
  selector: 'tb-my-textbooks-page',
  imports: [Card, HelpButton, EmptyState, LoadStateView, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Учебники">
      <tb-help-button help topic="cabinet/textbooks" />
    </tb-page-header>
    <p-card>
      <h2 class="tb-sr-only">Список учебников</h2>
      <tb-load-state [state]="state" what="учебники" (retry)="load()">
        @if (textbooks().length > 0) {
          <ul class="tb-list" aria-label="Учебники">
            @for (textbook of textbooks(); track textbook.id) {
              <li>
                <span class="tb-list__lead" aria-hidden="true"
                  ><i [class]="icons[textbook.kind]"></i
                ></span>
                <div class="tb-list__text">
                  <button
                    type="button"
                    class="tb-list__title tb-link-button"
                    [attr.aria-label]="'Скачать ' + textbook.title"
                    (click)="download(textbook)"
                  >
                    {{ textbook.title }}
                  </button>
                  <span class="tb-list__supporting">{{ details(textbook) }}</span>
                  @if (textbook.groupNames.length > 0) {
                    <span class="tb-list__supporting"
                      >Группа: {{ textbook.groupNames.join(', ') }}</span
                    >
                  }
                </div>
              </li>
            }
          </ul>
        } @else {
          <tb-empty-state
            icon="pi-book"
            title="Учебников пока нет"
            hint="Когда учитель откроет вам учебник, он появится здесь."
          />
        }
      </tb-load-state>
    </p-card>
  `,
})
export class MyTextbooksPage implements OnInit {
  private readonly api = inject(TextbooksApi);
  private readonly fileSaver = inject(FileSaver);

  protected readonly icons = TEXTBOOK_KIND_ICONS;
  protected readonly details = textbookDetails;
  protected readonly textbooks = signal<MyTextbook[]>([]);
  protected readonly state = new LoadState();

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

  protected download(textbook: MyTextbook): void {
    this.api.myFile(textbook.id).subscribe((blob) => {
      this.fileSaver.save(blob, textbook.filename);
    });
  }
}
