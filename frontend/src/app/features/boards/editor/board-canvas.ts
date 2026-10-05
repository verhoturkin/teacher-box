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
  ExcalidrawInitialDataState,
  ExcalidrawProps,
} from '@excalidraw/excalidraw/types';
import { defer } from 'rxjs';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { ExcalidrawHost } from './excalidraw-host';
import { ExcalidrawLoader } from './excalidraw-loader';

/** The portal theme the canvas follows. */
export type BoardTheme = 'light' | 'dark';

/** What Excalidraw reports on every change of the scene. */
export interface BoardCanvasChange {
  readonly elements: readonly OrderedExcalidrawElement[];
  readonly appState: AppState;
  readonly files: BinaryFiles;
}

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
  readonly sceneChange = output<BoardCanvasChange>();

  protected readonly state = new LoadState();
  private readonly loader = inject(ExcalidrawLoader);
  private readonly destroyRef = inject(DestroyRef);
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private host: ExcalidrawHost | undefined;
  private initialData: ExcalidrawInitialDataState | null = null;

  constructor() {
    afterNextRender(() => {
      this.load();
    });
    effect(() => {
      this.theme();
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
        this.host = new ExcalidrawHost(modules, this.surface().nativeElement, this.destroyRef);
        this.render();
      });
  }

  private render(): void {
    this.host?.render(this.props());
  }

  private props(): ExcalidrawProps {
    return {
      initialData: this.initialData,
      theme: this.theme(),
      langCode: 'ru-RU',
      onChange: (elements, appState, files) => {
        this.sceneChange.emit({ elements, appState, files });
      },
    };
  }
}
