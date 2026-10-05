import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  ExcalidrawProps,
} from '@excalidraw/excalidraw/types';
import { defer } from 'rxjs';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { ExcalidrawHost } from './excalidraw-host';
import {
  BoardEditorProps,
  BoardLibrary,
  BoardMenuItem,
  ExcalidrawLoader,
  ExcalidrawModules,
} from './excalidraw-loader';

/** The portal theme the canvas follows. */
export type BoardTheme = 'light' | 'dark';

/** What Excalidraw reports on every change of the scene. */
export interface BoardCanvasChange {
  readonly elements: readonly OrderedExcalidrawElement[];
  readonly appState: AppState;
  readonly files: BinaryFiles;
}

/** The mounted editor: its imperative API and the island's functions (merge, new elements). */
export interface BoardCanvasReady {
  readonly api: ExcalidrawImperativeAPI;
  readonly modules: ExcalidrawModules;
}

/** Excalidraw's own actions the portal does not use: files on disk and its theme switch. */
const UI_OPTIONS: ExcalidrawProps['UIOptions'] = {
  canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: null },
};

/**
 * Excalidraw as an Angular component: the border of the React island (ADR-0028). The scene is read once,
 * when the editor mounts; later changes come out of `sceneChange`. The theme follows the input.
 */
@Component({
  selector: 'tb-board-canvas',
  imports: [LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #surface class="tb-board-canvas__surface" [attr.aria-busy]="!state.ready()"></div>
    @if (!state.ready()) {
      <tb-load-state class="tb-board-canvas__state" [state]="state" what="доску" (retry)="load()" />
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      height: 100%;
      min-height: 20rem;
    }

    .tb-board-canvas__surface {
      position: absolute;
      inset: 0;
    }

    .tb-board-canvas__state {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      background: var(--p-md-surface);
    }
  `,
})
export class BoardCanvas {
  /** The scene to start with; read when the editor mounts. */
  readonly scene = input<ExcalidrawInitialDataState | null>(null);
  readonly theme = input<BoardTheme>('light');
  /** The portal's items of the main menu (e.g. «Вернуться к доскам»). */
  readonly menu = input<readonly BoardMenuItem[]>([]);
  /** The user's Excalidraw library; read when the editor mounts. */
  readonly library = input<BoardLibrary | null>(null);
  readonly sceneChange = output<BoardCanvasChange>();
  /** The editor is mounted: its API arrives once. */
  readonly ready = output<BoardCanvasReady>();

  protected readonly state = new LoadState();
  private readonly loader = inject(ExcalidrawLoader);
  private readonly destroyRef = inject(DestroyRef);
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private host: ExcalidrawHost | undefined;
  private modules: ExcalidrawModules | undefined;
  private initialData: ExcalidrawInitialDataState | null = null;

  constructor() {
    afterNextRender(() => {
      this.load();
    });
    effect(() => {
      this.theme();
      this.menu();
      untracked(() => {
        this.render();
      });
    });
  }

  protected load(): void {
    defer(() => this.loader.load())
      .pipe(this.state.track(), takeUntilDestroyed(this.destroyRef))
      .subscribe((modules) => {
        this.initialData = this.scene();
        this.modules = modules;
        this.host = new ExcalidrawHost(modules, this.surface().nativeElement, this.destroyRef);
        this.render();
      });
  }

  private render(): void {
    this.host?.render(this.props());
  }

  private props(): BoardEditorProps {
    const modules = this.modules;
    return {
      initialData: this.initialData,
      theme: this.theme(),
      langCode: 'ru-RU',
      UIOptions: UI_OPTIONS,
      // No embedded web pages on a board: a link stays a link.
      validateEmbeddable: () => false,
      onChange: (elements, appState, files) => {
        this.sceneChange.emit({ elements, appState, files });
      },
      excalidrawAPI: (api) => {
        if (modules) this.ready.emit({ api, modules });
      },
      children: modules?.mainMenu(this.menu()),
      library: this.library() ?? undefined,
    };
  }
}
