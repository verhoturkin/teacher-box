import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Menu } from 'primeng/menu';
import { Tooltip } from 'primeng/tooltip';
import { quietContext } from '@core/http/api-error.interceptor';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { HelpButton } from '@features/help/parts';
import { IdentityApi } from '@features/identity/parts';
import { FileSaver } from '@shared/files/file-saver';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { TextbooksApi } from '../data-access/textbooks-api';
import { Textbook } from '../data-access/textbooks.models';
import {
  TEXTBOOK_FILES,
  TEXTBOOK_KIND_ICONS,
  TEXTBOOK_MAX_SIZE,
  textbookDetails,
  textbookMembersText,
} from '../textbooks-labels';
import { MemberOption, TextbookDialog } from './textbook-dialog';

/**
 * Teacher: «Учебники» (ADR-0033) — textbooks, workbooks and other materials, one per row: add, change,
 * replace the file, download, delete.
 */
@Component({
  selector: 'tb-textbooks-page',
  imports: [
    Button,
    Card,
    ConfirmDialog,
    Menu,
    Tooltip,
    ButtonAttributes,
    HelpButton,
    EmptyState,
    LoadStateView,
    PageHeader,
    TextbookDialog,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Учебники">
      <tb-help-button help topic="teacher/textbooks" />
      <p-button
        class="tb-page-fab"
        label="Новый учебник"
        icon="pi pi-plus"
        (onClick)="openCreate()"
      />
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
                  <span class="tb-list__supporting">{{ membersText(textbook) }}</span>
                </div>
                <div class="tb-list__trail tb-list__trail--icons">
                  <p-button
                    icon="pi pi-ellipsis-v"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [pTooltip]="'Действия: ' + textbook.title"
                    [ariaLabel]="'Действия: ' + textbook.title"
                    [tbAttributes]="{
                      'aria-haspopup': 'menu',
                      'aria-expanded': menuFor()?.id === textbook.id ? 'true' : 'false',
                    }"
                    [loading]="replacing() === textbook.id"
                    (onClick)="openMenu(textbook, $event)"
                  />
                </div>
              </li>
            }
          </ul>
        } @else {
          <tb-empty-state
            icon="pi-book"
            title="Учебников пока нет"
            hint="Нажмите «Новый учебник» и выберите файл: PDF, Word или картинку. Учебник можно открыть ученикам и группам, привязать к заданию и показать на доске."
          />
        }
      </tb-load-state>
    </p-card>

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
    <tb-textbook-dialog
      [(visible)]="dialogVisible"
      [textbook]="editing()"
      [students]="students()"
      [groups]="groups()"
      [courses]="courses()"
      (saved)="load()"
    />
    <p-confirmdialog />
  `,
})
export class TextbooksPage implements OnInit {
  private readonly api = inject(TextbooksApi);
  private readonly identity = inject(IdentityApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly fileSaver = inject(FileSaver);
  private readonly snackbar = inject(Snackbar);

  protected readonly icons = TEXTBOOK_KIND_ICONS;
  protected readonly accept = TEXTBOOK_FILES;
  protected readonly details = textbookDetails;
  protected readonly membersText = textbookMembersText;
  protected readonly state = new LoadState();
  protected readonly textbooks = signal<Textbook[]>([]);
  protected readonly students = signal<MemberOption[]>([]);
  protected readonly groups = signal<MemberOption[]>([]);
  protected readonly editing = signal<Textbook | null>(null);
  protected readonly dialogVisible = signal(false);
  /** The textbook whose file is being replaced. */
  protected readonly replacing = signal<string | null>(null);
  private replaceTarget: Textbook | null = null;
  private readonly menu = viewChild.required<Menu>('menu');
  private readonly replacement = viewChild.required<ElementRef<HTMLInputElement>>('replacement');

  /** The textbook whose «⋮» menu is open: one popup menu serves every row. */
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

  ngOnInit(): void {
    this.load();
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

  load(): void {
    this.api
      .list(quietContext())
      .pipe(this.state.track())
      .subscribe((textbooks) => {
        this.textbooks.set(textbooks);
      });
  }

  protected openMenu(textbook: Textbook, event: Event): void {
    this.menuFor.set(textbook);
    this.menu().toggle(event);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.dialogVisible.set(true);
  }

  protected openEdit(textbook: Textbook): void {
    this.editing.set(textbook);
    this.dialogVisible.set(true);
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

  protected onReplacement(element: HTMLInputElement): void {
    const file = element.files?.[0] ?? null;
    const textbook = this.replaceTarget;
    element.value = '';
    this.replaceTarget = null;
    if (file === null || textbook === null) {
      return;
    }
    if (file.size > TEXTBOOK_MAX_SIZE) {
      this.snackbar.error('Файл больше 100 МБ — портал его не примет.');
      return;
    }
    this.replacing.set(textbook.id);
    this.api.replaceFile(textbook, file).subscribe({
      next: () => {
        this.replacing.set(null);
        this.snackbar.success(`Файл учебника «${textbook.title}» заменён`);
        this.load();
      },
      error: (error: unknown) => {
        this.replacing.set(null);
        this.snackbar.error(describeError(error, 'Не удалось заменить файл'));
      },
    });
  }

  protected confirmRemove(textbook: Textbook): void {
    this.confirmation.confirm(
      dangerConfirmation({
        header: 'Удалить учебник?',
        message: `Учебник «${textbook.title}» удалится вместе с файлом и пропадёт из заданий. Вернуть его можно только из резервной копии портала.`,
        acceptLabel: 'Удалить',
        accept: () => {
          this.api.remove(textbook.id).subscribe(() => {
            this.load();
          });
        },
      }),
    );
  }

  private actionsOf(textbook: Textbook): MenuItem[] {
    return [
      {
        label: 'Скачать',
        icon: 'pi pi-download',
        command: () => {
          this.download(textbook);
        },
      },
      {
        label: 'Изменить',
        icon: 'pi pi-pencil',
        command: () => {
          this.openEdit(textbook);
        },
      },
      {
        label: 'Заменить файл',
        icon: 'pi pi-upload',
        command: () => {
          this.pickReplacement(textbook);
        },
      },
      {
        label: 'Удалить…',
        icon: 'pi pi-trash',
        styleClass: 'tb-menu-item--danger',
        command: () => {
          this.confirmRemove(textbook);
        },
      },
    ];
  }
}
