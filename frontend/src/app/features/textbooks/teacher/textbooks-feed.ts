import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Observable } from 'rxjs';
import { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { quietContext } from '@core/http/api-error.interceptor';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { checkFiles } from '@shared/files/check-files';
import { FileOpener } from '@shared/files/file-opener';
import { FileSaver } from '@shared/files/file-saver';
import { Confirm } from '@shared/ui/confirm';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MaterialCard } from '@shared/ui/material-card';
import { MaterialSort, sortMaterials } from '@shared/ui/material-sort';
import { TextbooksApi } from '../data-access/textbooks-api';
import { Textbook, TextbookKind } from '../data-access/textbooks.models';
import {
  TEXTBOOK_FILES,
  TEXTBOOK_KIND_ICONS,
  TEXTBOOK_POLICY,
  textbookDetails,
  textbookMembersText,
} from '../textbooks-labels';
import { MemberOption, TextbookDialog } from './textbook-dialog';
import { TextbookToBoardDialog } from './textbook-to-board-dialog';
import { T } from '../i18n/texts';

/** Which textbooks the feed shows: all or one kind of them. */
export type TextbooksFilter = 'all' | TextbookKind;

/**
 * Teacher: the textbooks of the Materials feed (ADR-0033, redesign spec §10.1) as cards — the cover is the
 * first page of the file (a Word file has none: the icon of its kind). The page of Materials gives the
 * search text, the filter, the sort and the student or the group; a card opens the file, «⋮» keeps
 * change, replace the file, download, «На доску» and delete.
 */
@Component({
  selector: 'tb-textbooks-feed',
  imports: [MaterialCard, Menu, EmptyState, LoadStateView, TextbookDialog, TextbookToBoardDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
      @if (shown().length > 0) {
        <ul class="tb-material-grid" [attr.aria-label]="t.list">
          @for (textbook of shown(); track textbook.id) {
            <li>
              <tb-material-card
                [title]="textbook.title"
                [supporting]="supportingOf(textbook)"
                [openLabel]="t.open(textbook.title)"
                [loader]="loadCover"
                [ref]="textbook.hasCover ? textbook.id : null"
                [version]="textbook.updatedAt"
                [icon]="icons[textbook.kind]"
                [actionsLabel]="t.actions(textbook.title)"
                [menuOpen]="menuFor()?.id === textbook.id"
                [busy]="replacing() === textbook.id"
                (open)="open(textbook)"
                (menu)="openMenu(textbook, $event)"
              />
            </li>
          }
        </ul>
      } @else if (textbooks().length > 0) {
        <tb-empty-state icon="tb-i-search" [title]="t.notFoundTitle" [hint]="t.notFoundHint" />
      } @else {
        <tb-empty-state icon="tb-i-menu_book" [title]="t.emptyTitle" [hint]="t.emptyHint" />
      }
    </tb-load-state>

    <input
      #replacement
      type="file"
      class="tb-sr-only"
      tabindex="-1"
      aria-hidden="true"
      [accept]="accept"
      (change)="onReplacement(replacement)"
    />
    <p-menu
      #menu
      [model]="menuItems()"
      [popup]="true"
      appendTo="body"
      (onHide)="menuFor.set(null)"
    />
    <tb-textbook-to-board-dialog [(visible)]="boardVisible" [textbook]="boardTextbook()" />
    <tb-textbook-dialog
      [(visible)]="dialogVisible"
      [textbook]="editing()"
      [students]="students()"
      [groups]="groups()"
      [courses]="courses()"
      (saved)="load()"
    />
  `,
})
export class TextbooksFeed {
  protected readonly t = T.list;
  private readonly api = inject(TextbooksApi);
  private readonly confirm = inject(Confirm);
  private readonly fileSaver = inject(FileSaver);
  private readonly fileOpener = inject(FileOpener);
  private readonly snackbar = inject(Snackbar);

  /** The search text of the page: the title, the course, a student's or a group's name. */
  readonly query = input('');
  readonly filter = input<TextbooksFilter>('all');
  readonly sort = input<MaterialSort>('changed');
  /** Only the textbooks open to this student or group (the id of a member); none — all. */
  readonly member = input<string | undefined>();
  /** The students and the groups the dialog offers. */
  readonly students = input<readonly MemberOption[]>([]);
  readonly groups = input<readonly MemberOption[]>([]);

  protected readonly icons = TEXTBOOK_KIND_ICONS;
  protected readonly accept = TEXTBOOK_FILES;
  protected readonly state = new LoadState();
  protected readonly textbooks = signal<Textbook[]>([]);
  /** How many textbooks there are (before the search, the filter and the sort). */
  readonly total = computed(() => this.textbooks().length);
  /** The textbooks of the filter, the member and the search, in the order of the sort. */
  protected readonly shown = computed(() => {
    const filter = this.filter();
    const member = this.member();
    const query = this.query().trim().toLocaleLowerCase('ru');
    const matching = this.textbooks().filter(
      (textbook) =>
        (filter === 'all' || textbook.kind === filter) &&
        (member === undefined || textbook.members.some((item) => item.id === member)) &&
        (query === '' ||
          textbook.title.toLocaleLowerCase('ru').includes(query) ||
          (textbook.course?.toLocaleLowerCase('ru').includes(query) ?? false) ||
          textbook.members.some((item) => item.name?.toLocaleLowerCase('ru').includes(query))),
    );
    return sortMaterials(matching, this.sort());
  });
  protected readonly editing = signal<Textbook | null>(null);
  protected readonly dialogVisible = signal(false);
  protected readonly boardTextbook = signal<Textbook | null>(null);
  protected readonly boardVisible = signal(false);
  /** The textbook whose file is being replaced. */
  protected readonly replacing = signal<string | null>(null);
  private replaceTarget: Textbook | null = null;
  private readonly menu = viewChild.required<Menu>('menu');
  private readonly replacement = viewChild.required<ElementRef<HTMLInputElement>>('replacement');

  /** The textbook whose «⋮» menu is open: one popup menu serves every card. */
  protected readonly menuFor = signal<Textbook | null>(null);
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const textbook = this.menuFor();
    return textbook === null ? [] : this.actionsOf(textbook);
  });
  /** Courses already used, offered in the dialog. */
  protected readonly courses = computed(() =>
    [...new Set(this.textbooks().flatMap((textbook) => textbook.course ?? []))].sort((a, b) =>
      a.localeCompare(b, 'ru'),
    ),
  );

  /** The cover of a textbook (a stable function for `tb-blob-image`). */
  protected readonly loadCover = (id: string): Observable<Blob> => this.api.cover(id);

  constructor() {
    this.load();
  }

  load(): void {
    this.api
      .list(quietContext())
      .pipe(this.state.track())
      .subscribe((textbooks) => {
        this.textbooks.set(textbooks);
      });
  }

  /** «Учебник · Английский · PDF, 120 с., 4,2 МБ · Мария» for a card. */
  protected supportingOf(textbook: Textbook): string {
    return [textbookDetails(textbook), textbookMembersText(textbook)].join(' · ');
  }

  protected openMenu(textbook: Textbook, event: Event): void {
    this.menuFor.set(textbook);
    this.menu().toggle(event);
  }

  /** The form of a new textbook («Создать» in the rail, the FAB of a phone). */
  openCreate(): void {
    this.editing.set(null);
    this.dialogVisible.set(true);
  }

  protected openEdit(textbook: Textbook): void {
    this.editing.set(textbook);
    this.dialogVisible.set(true);
  }

  /** A PDF or a picture opens in a new tab; a Word file is saved. */
  protected open(textbook: Textbook): void {
    this.fileOpener.open(
      this.api.file(textbook.id),
      textbook.format !== 'DOCUMENT',
      () => textbook.filename,
    );
  }

  protected download(textbook: Textbook): void {
    this.api.file(textbook.id).subscribe((blob) => {
      this.fileSaver.save(blob, textbook.filename);
    });
  }

  /** Still within the menu click: the browser opens the file chooser only then. */
  protected pickReplacement(textbook: Textbook): void {
    this.replaceTarget = textbook;
    this.replacement().nativeElement.click();
  }

  protected async onReplacement(element: HTMLInputElement): Promise<void> {
    const file = element.files?.[0] ?? null;
    const textbook = this.replaceTarget;
    element.value = '';
    this.replaceTarget = null;
    if (file === null || textbook === null) {
      return;
    }
    const { rejected } = await checkFiles([file], TEXTBOOK_POLICY);
    if (rejected[0] !== undefined) {
      this.snackbar.error(rejected[0].message);
      return;
    }
    this.replacing.set(textbook.id);
    this.api.replaceFile(textbook, file).subscribe({
      next: () => {
        this.replacing.set(null);
        this.snackbar.success(T.list.replaced(textbook.title));
        this.load();
      },
      error: (error: unknown) => {
        this.replacing.set(null);
        this.snackbar.error(describeError(error, T.list.replaceFailed));
      },
    });
  }

  protected async confirmRemove(textbook: Textbook): Promise<void> {
    if (
      await this.confirm.danger({
        header: T.list.deleteHeader,
        message: T.list.deleteMessage(textbook.title),
        acceptLabel: T.list.delete,
      })
    ) {
      this.api.remove(textbook.id).subscribe(() => {
        this.load();
      });
    }
  }

  protected openBoard(textbook: Textbook): void {
    this.boardTextbook.set(textbook);
    this.boardVisible.set(true);
  }

  private actionsOf(textbook: Textbook): MenuItem[] {
    return [
      {
        label: T.list.download,
        icon: 'tb-i tb-i-download',
        command: () => {
          this.download(textbook);
        },
      },
      ...(textbook.format === 'DOCUMENT'
        ? []
        : [
            {
              label: T.list.toBoard,
              icon: 'tb-i tb-i-co_present',
              command: () => {
                this.openBoard(textbook);
              },
            },
          ]),
      {
        label: T.list.edit,
        icon: 'tb-i tb-i-edit',
        command: () => {
          this.openEdit(textbook);
        },
      },
      {
        label: T.list.replace,
        icon: 'tb-i tb-i-upload',
        command: () => {
          this.pickReplacement(textbook);
        },
      },
      {
        label: T.list.deleteItem,
        icon: 'tb-i tb-i-delete',
        styleClass: 'tb-menu-item--danger',
        command: () => {
          void this.confirmRemove(textbook);
        },
      },
    ];
  }
}
