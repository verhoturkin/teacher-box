import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { ExcalidrawInitialDataState } from '@excalidraw/excalidraw/types';
import { firstValueFrom } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { CanLeave } from '@core/routing/can-leave.guard';
import { ThemeChoice, ThemeMode } from '@core/theme/theme-mode';
import { readDeviceSetting, writeDeviceSetting } from '@shared/storage/device-settings';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { BoardsApi } from '../data-access/boards-api';
import { BoardContent } from '../data-access/boards.models';
import { BoardBackupsDialog } from '../teacher/board-backups-dialog';
import { BoardClipboard } from '../to-board/board-clipboard';
import { BoardInsert } from '../to-board/board-insert';
import { BoardCanvas, BoardCanvasChange, BoardCanvasReady, BoardWheel } from './board-canvas';
import { BoardSync, SaveStatus } from './board-sync';
import type { BoardLibrary, BoardMenuItem, BoardMenuSetting } from './excalidraw-loader';
import { elementsOf, libraryItemsOf, sharedAppState } from './excalidraw-data';
import { insertMaterial } from './material-insert';

/** Device setting: what the mouse wheel does on boards. */
export const WHEEL_KEY = 'tb.board.wheel';

const THEMES: readonly { readonly choice: ThemeChoice; readonly label: string }[] = [
  { choice: 'light', label: 'Светлая' },
  { choice: 'dark', label: 'Тёмная' },
  { choice: 'system', label: 'Как в системе' },
];

const WHEELS: readonly { readonly wheel: BoardWheel; readonly label: string }[] = [
  { wheel: 'zoom', label: 'Масштаб' },
  { wheel: 'scroll', label: 'Прокрутка (тачпад)' },
];

const STATUS_LABELS: Readonly<Record<SaveStatus, string>> = {
  saved: 'Сохранено',
  saving: 'Сохранение…',
  offline: 'Нет связи — повторим',
};

/**
 * A board full screen (ADR-0028): the teacher's (`/teacher/boards/:id`) or the student's
 * (`/cabinet/boards/:id`). Saves by itself, shows the others' changes, returns to the list without losing
 * anything; an external board only offers its link.
 */
@Component({
  selector: 'tb-board-page',
  imports: [
    RouterLink,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    ConfirmDialog,
    Message,
    LoadStateView,
    BoardCanvas,
    BoardBackupsDialog,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-board-page">
      <header class="tb-board-page__bar">
        <a pButton [text]="true" severity="secondary" [routerLink]="backLink()">
          <i pButtonIcon class="pi pi-arrow-left"></i>
          <span pButtonLabel>{{ backLabel() }}</span>
        </a>
        <h1 class="tb-board-page__title">{{ content()?.title ?? 'Доска' }}</h1>
        @if (sync(); as board) {
          <span
            class="tb-board-page__status"
            [class.tb-board-page__status--offline]="board.status() === 'offline'"
            role="status"
            >{{ statusLabels[board.status()] }}</span
          >
        }
      </header>
      <main class="tb-board-page__body">
        <tb-load-state [state]="state" what="доску" (retry)="load()">
          @if (content(); as board) {
            @if (board.kind === 'EXCALIDRAW') {
              <tb-board-canvas
                class="tb-board-page__canvas"
                [scene]="initialScene()"
                [theme]="theme()"
                [menu]="menu()"
                [settings]="settings()"
                [wheel]="wheel()"
                [library]="library"
                (ready)="attach($event)"
                (sceneChange)="changed($event)"
              />
            } @else {
              <div class="tb-board-page__external">
                <p-message severity="info">
                  Это внешняя доска — она открывается в своём сервисе.
                </p-message>
                <a pButton [href]="externalUrl()" target="_blank" rel="noopener">
                  <i pButtonIcon class="pi pi-external-link"></i>
                  <span pButtonLabel>Открыть доску</span>
                </a>
              </div>
            }
          }
        </tb-load-state>
      </main>
    </div>
    @if (teacher()) {
      <tb-board-backups-dialog
        [(visible)]="backupsVisible"
        [boardId]="id()"
        [title]="content()?.title ?? ''"
        (restored)="restored()"
      />
    }
    <p-confirmdialog />
  `,
  styles: `
    :host {
      display: block;
      height: 100dvh;
    }

    .tb-board-page {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--p-md-surface);
    }

    .tb-board-page__bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-1) var(--tb-space-3);
      padding: var(--tb-space-1) var(--tb-space-2);
      border-bottom: 1px solid var(--p-md-outline-variant);
    }

    .tb-board-page__title {
      flex: 1 1 10rem;
      min-width: 0;
      margin: 0;
      overflow: hidden;
      font: var(--tb-type-title-l);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tb-board-page__status {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m, inherit);
    }

    .tb-board-page__status--offline {
      color: var(--p-md-error);
    }

    .tb-board-page__body {
      position: relative;
      flex: 1;
      min-height: 0;
    }

    .tb-board-page__canvas {
      position: absolute;
      inset: 0;
    }

    .tb-board-page__external {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--tb-space-3);
      max-width: 40rem;
      margin: var(--tb-space-6, 2rem) auto;
      padding: 0 var(--tb-space-4);
    }
  `,
})
export class BoardPage implements OnInit, CanLeave {
  private readonly api = inject(BoardsApi);
  private readonly router = inject(Router);
  private readonly themeMode = inject(ThemeMode);
  private readonly confirmation = inject(ConfirmationService);
  private readonly clipboard = inject(BoardClipboard);
  private readonly insert = inject(BoardInsert);
  private readonly document = inject(DOCUMENT);
  private editor: BoardCanvasReady['api'] | undefined;

  /** The board (route parameter). */
  readonly id = input.required<string>();
  /** The area of the portal (route data). */
  readonly area = input<'teacher' | 'cabinet'>('teacher');

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly state = new LoadState();
  protected readonly content = signal<BoardContent | null>(null);
  protected readonly sync = signal<BoardSync | null>(null);
  protected readonly backupsVisible = signal(false);
  protected readonly teacher = computed(() => this.area() === 'teacher');
  protected readonly backLink = computed(() =>
    this.teacher() ? '/teacher/boards' : '/cabinet/boards',
  );
  protected readonly backLabel = computed(() => (this.teacher() ? 'Доски' : 'Мои доски'));
  protected readonly theme = computed(() => (this.themeMode.dark() ? 'dark' : 'light'));
  protected readonly initialScene = computed<ExcalidrawInitialDataState | null>(() => {
    const content = this.content();
    return content === null
      ? null
      : {
          elements: elementsOf(content.elements),
          appState: sharedAppState(content.appState),
          scrollToContent: true,
        };
  });
  protected readonly externalUrl = computed(() => this.content()?.url ?? null);
  protected readonly menu = computed<BoardMenuItem[]>(() => [
    {
      label: 'Вернуться к доскам',
      onSelect: () => {
        void this.router.navigateByUrl(this.backLink());
      },
    },
    ...(this.teacher()
      ? [
          {
            label: 'Резервные копии',
            onSelect: () => {
              this.backupsVisible.set(true);
            },
          },
        ]
      : []),
  ]);

  /** Whether the board shows its grid (the board's own setting, shared with everyone on it). */
  protected readonly grid = signal(false);
  protected readonly wheel = signal<BoardWheel>(
    readDeviceSetting(WHEEL_KEY) === 'scroll' ? 'scroll' : 'zoom',
  );
  protected readonly settings = computed<BoardMenuSetting[]>(() => [
    {
      title: 'Тема',
      items: THEMES.map(({ choice, label }) => ({
        label,
        checked: this.themeMode.choice() === choice,
        onSelect: () => {
          this.themeMode.choose(choice);
        },
      })),
    },
    {
      label: 'Сетка',
      checked: this.grid(),
      onSelect: () => {
        this.editor?.updateScene({
          appState: { gridModeEnabled: !this.grid() },
          captureUpdate: 'EVENTUALLY',
        });
      },
    },
    {
      title: 'Колесо мыши',
      items: WHEELS.map(({ wheel, label }) => ({
        label,
        checked: this.wheel() === wheel,
        onSelect: () => {
          this.wheel.set(wheel);
          writeDeviceSetting(WHEEL_KEY, wheel);
        },
      })),
    },
  ]);

  /** The user's own library of shapes, kept on the server for all their boards. */
  protected readonly library: BoardLibrary = {
    load: async () => libraryItemsOf(await firstValueFrom(this.api.library())),
    save: (items) => firstValueFrom(this.api.saveLibrary(items)),
  };

  /** Leaving the tab saves at once; coming back asks for the others' changes. */
  private readonly visibility = (): void => {
    const sync = this.sync();
    if (this.document.visibilityState === 'hidden') void sync?.flush();
    else void sync?.poll();
  };

  constructor() {
    this.document.addEventListener('visibilitychange', this.visibility);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('visibilitychange', this.visibility);
      this.sync()?.stop();
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api
      .open(this.id())
      .pipe(this.state.track())
      .subscribe((content) => {
        this.sync()?.stop();
        this.sync.set(
          content.kind === 'EXCALIDRAW'
            ? new BoardSync(
                {
                  save: (elements, appState, baseVersion) =>
                    this.api.saveScene(this.id(), elements, appState, baseVersion),
                  changes: (since) => this.api.changes(this.id(), since),
                  upload: (fileId, blob) => this.api.uploadFile(this.id(), fileId, blob),
                  file: (fileId) => this.api.file(this.id(), fileId),
                },
                content,
              )
            : null,
        );
        this.content.set(content);
      });
  }

  /** Waits for the last save; asks before leaving changes the server did not get. */
  async canLeave(): Promise<boolean> {
    const sync = this.sync();
    if (sync === null || (await sync.flush())) return true;
    return new Promise((resolve) => {
      this.confirmation.confirm(
        dangerConfirmation({
          header: 'Уйти без сохранения?',
          message:
            'Нет связи с порталом: последние изменения доски не сохранены. Если уйти, они пропадут.',
          acceptLabel: 'Уйти',
          accept: () => {
            resolve(true);
          },
          reject: () => {
            resolve(false);
          },
        }),
      );
    });
  }

  protected attach(ready: BoardCanvasReady): void {
    const sync = this.sync();
    if (sync === null) return;
    this.editor = ready.api;
    sync.attach(ready.api, ready.modules);
    const material = this.insert.take(this.id());
    if (material !== null) {
      void insertMaterial(ready.api, ready.modules, material, this.clipboard).catch(
        () => undefined,
      );
    }
  }

  protected changed(change: BoardCanvasChange): void {
    this.grid.set(change.appState.gridModeEnabled);
    this.sync()?.changed(change.elements, change.appState);
  }

  protected restored(): void {
    void this.sync()?.poll();
  }
}
