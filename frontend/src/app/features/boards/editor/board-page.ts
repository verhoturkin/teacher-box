import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Location } from '@angular/common';
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
import { SHARED_T } from '@shared/i18n/texts';
import { BoardsApi } from '../data-access/boards-api';
import { BoardContent } from '../data-access/boards.models';
import { BoardBackupsDialog } from '../teacher/board-backups-dialog';
import { BoardClipboard } from '../to-board/board-clipboard';
import { BoardInsert } from '../to-board/board-insert';
import { BoardCanvas, BoardCanvasChange, BoardCanvasReady, BoardWheel } from './board-canvas';
import { BoardLive, LIVE_SOCKET } from './board-live';
import { collaborators } from './board-presence';
import { BoardSync, SaveStatus } from './board-sync';
import type { BoardLibrary, BoardMenuItem, BoardMenuSetting } from './excalidraw-loader';
import { elementsOf, libraryItemsOf, sharedAppState } from './excalidraw-data';
import { insertMaterial } from './material-insert';
import { T } from '../i18n/texts';

/** Device setting: what the mouse wheel does on boards. */
export const WHEEL_KEY = 'tb.board.wheel';

const THEMES: readonly { readonly choice: ThemeChoice; readonly label: string }[] = [
  { choice: 'light', label: T.editor.light },
  { choice: 'dark', label: T.editor.dark },
  { choice: 'system', label: T.editor.system },
];

const WHEELS: readonly { readonly wheel: BoardWheel; readonly label: string }[] = [
  { wheel: 'zoom', label: T.editor.zoom },
  { wheel: 'scroll', label: T.editor.scroll },
];

const STATUS_LABELS: Readonly<Record<SaveStatus, string>> = {
  saved: T.editor.saved,
  saving: T.editor.saving,
  offline: T.editor.offline,
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
        @if (returnable) {
          <button pButton type="button" [text]="true" severity="secondary" (click)="back()">
            <i pButtonIcon class="pi pi-arrow-left" aria-hidden="true"></i>
            <span pButtonLabel>{{ backLabel() }}</span>
          </button>
        } @else {
          <a pButton [text]="true" severity="secondary" [routerLink]="backLink()">
            <i pButtonIcon class="pi pi-arrow-left" aria-hidden="true"></i>
            <span pButtonLabel>{{ backLabel() }}</span>
          </a>
        }
        <h1 class="tb-board-page__title">{{ content()?.title ?? t.board }}</h1>
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
        <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
          @if (content(); as board) {
            @if (board.kind === 'EXCALIDRAW') {
              <tb-board-canvas
                class="tb-board-page__canvas"
                [scene]="initialScene()"
                [theme]="theme()"
                [menu]="menu()"
                [settings]="settings()"
                [wheel]="wheel()"
                [collaborating]="live()?.connected() ?? false"
                (pointerMove)="live()?.pointer($event)"
                [library]="library"
                (ready)="attach($event)"
                (sceneChange)="changed($event)"
              />
            } @else {
              <div class="tb-board-page__external">
                <p-message severity="info">{{ t.external }}</p-message>
                <a pButton [href]="externalUrl()" target="_blank" rel="noopener">
                  <i pButtonIcon class="pi pi-external-link"></i>
                  <span pButtonLabel>{{ t.openBoard }}</span>
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
  protected readonly t = T.editor;
  private readonly api = inject(BoardsApi);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  /**
   * The board was opened from another page of the portal (the home page, a lesson, a task): «Назад»
   * returns there. Opened by a link from outside, it leads to the list of boards.
   */
  protected readonly returnable =
    (this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation())
      ?.previousNavigation != null;
  private readonly themeMode = inject(ThemeMode);
  private readonly confirmation = inject(ConfirmationService);
  private readonly clipboard = inject(BoardClipboard);
  private readonly insert = inject(BoardInsert);
  private readonly document = inject(DOCUMENT);
  private readonly openSocket = inject(LIVE_SOCKET);
  private editor: BoardCanvasReady['api'] | undefined;

  /** The board (route parameter). */
  readonly id = input.required<string>();
  /** The area of the portal (route data). */
  readonly area = input<'teacher' | 'cabinet'>('teacher');

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly state = new LoadState();
  protected readonly content = signal<BoardContent | null>(null);
  protected readonly sync = signal<BoardSync | null>(null);
  /** The live channel of the open board (ADR-0029). */
  protected readonly live = signal<BoardLive | null>(null);
  protected readonly backupsVisible = signal(false);
  protected readonly teacher = computed(() => this.area() === 'teacher');
  protected readonly backLink = computed(() =>
    this.teacher() ? '/teacher/boards' : '/cabinet/boards',
  );
  protected readonly backLabel = computed(() => {
    if (this.returnable) {
      return SHARED_T.common.back;
    }
    return this.teacher() ? T.editor.boards : T.editor.myBoards;
  });
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
      label: this.returnable ? SHARED_T.common.back : T.editor.back,
      onSelect: () => {
        this.back();
      },
    },
    ...(this.teacher()
      ? [
          {
            label: T.editor.backups,
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
      title: T.editor.theme,
      items: THEMES.map(({ choice, label }) => ({
        label,
        checked: this.themeMode.choice() === choice,
        onSelect: () => {
          this.themeMode.choose(choice);
        },
      })),
    },
    {
      label: T.editor.grid,
      checked: this.grid(),
      onSelect: () => {
        this.editor?.updateScene({
          appState: { gridModeEnabled: !this.grid() },
          captureUpdate: 'EVENTUALLY',
        });
      },
    },
    {
      title: T.editor.wheel,
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

  /** Back where the board was opened from, or to the list of boards. */
  protected back(): void {
    if (this.returnable) {
      this.location.back();
    } else {
      void this.router.navigateByUrl(this.backLink());
    }
  }

  constructor() {
    this.document.addEventListener('visibilitychange', this.visibility);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('visibilitychange', this.visibility);
      this.sync()?.stop();
      this.live()?.stop();
    });
    // The others on the board and their cursors.
    effect(() => {
      const peers = this.live()?.peerList() ?? [];
      untracked(() => {
        this.editor?.updateScene({ collaborators: collaborators(peers) });
      });
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
        this.live()?.stop();
        this.live.set(null);
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
          header: T.editor.leaveHeader,
          message: T.editor.leaveMessage,
          acceptLabel: T.editor.leave,
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
    const live = new BoardLive(
      {
        ticket: () => firstValueFrom(this.api.liveTicket(this.id())),
        open: this.openSocket,
      },
      {
        elements: (elements) => {
          sync.received(elements);
        },
        saved: (sceneVersion) => {
          sync.saved(sceneVersion);
        },
      },
    );
    sync.useLive(live);
    this.live.set(live);
    live.start();
    const material = this.insert.take(this.id());
    if (material !== null) {
      void insertMaterial(ready.api, ready.modules, material, this.clipboard, (url) =>
        firstValueFrom(this.api.picture(url)),
      ).catch(() => undefined);
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
