import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { injectMobile } from '@core/layout/mobile';
import { CallControls } from './call-controls';
import { gridSize, stageLayout } from './call-layout';
import { CallSelf } from './call-self';
import { CallSession } from './call-session';
import { CallTile } from './call-tile';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/**
 * The full call window over the portal: the stage (see `stageLayout`), the floating toolbar, the
 * states «Подключение…», «Переподключение…» and the end of the call. Esc minimizes it.
 */
@Component({
  selector: 'tb-call-window',
  imports: [Button, Message, CallControls, CallSelf, CallTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tb-call-window',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'tb-call-title',
    '(keydown.escape)': 'escape()',
  },
  template: `
    <header class="tb-call-window__header">
      <h2 id="tb-call-title" class="tb-call-window__title" tabindex="-1" #title>
        {{ session.target()?.title }}
      </h2>
      <span class="tb-call-window__meta">
        @switch (session.phase()) {
          @case ('connecting') {
            {{ t.connecting }}
          }
          @case ('reconnecting') {
            <span class="tb-call-window__warning">{{ t.reconnecting }}</span>
          }
          @case ('connected') {
            {{ elapsed() }} ·
            {{ t.participants(session.participants().length) }}
          }
        }
      </span>
    </header>

    @if (session.phase() === 'ended') {
      <div class="tb-call-window__end">
        <i class="pi pi-phone tb-call-window__end-icon" aria-hidden="true"></i>
        <p role="alert">{{ session.endText() }}</p>
        <div class="tb-actions">
          <p-button
            [label]="c.close"
            severity="secondary"
            [text]="true"
            (onClick)="session.close()"
          />
          <p-button [label]="t.retry" icon="pi pi-video" (onClick)="session.retry()" />
        </div>
      </div>
    } @else if (session.phase() === 'connecting') {
      <div class="tb-call-window__end" role="status">
        <span class="tb-call-spinner" aria-hidden="true"></span>
        <p>{{ t.joining }}</p>
      </div>
    } @else {
      @if (session.audioBlocked()) {
        <p-message severity="info" styleClass="tb-call-window__notice">
          <span>{{ t.audioBlocked }}</span>
          <p-button
            [label]="t.startAudio"
            severity="secondary"
            [text]="true"
            (onClick)="session.startAudio()"
          />
        </p-message>
      }
      <div class="tb-call-stage" [class]="'tb-call-stage tb-call-stage--' + layout().kind">
        @if (layout().main; as main) {
          <tb-call-tile
            class="tb-call-stage__main"
            [participant]="main.participant"
            [screen]="main.screen"
          />
        }
        @if (layout().inset; as inset) {
          <tb-call-self [participant]="inset" />
        }
        @if (layout().tiles.length > 0) {
          <div
            class="tb-call-stage__tiles"
            [style.--tb-call-columns]="grid().columns"
            [style.--tb-call-rows]="grid().rows"
          >
            @for (person of layout().tiles; track person.id) {
              <tb-call-tile [participant]="person" />
            }
          </div>
        }
        @if (layout().kind === 'alone') {
          <p class="tb-call-stage__waiting">{{ t.alone }}</p>
        }
      </div>
    }
    <tb-call-controls class="tb-call-window__controls" />
    <div class="tb-sr-only" aria-live="polite">{{ session.announcement() }}</div>
  `,
})
export class CallWindow implements AfterViewInit {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.window;
  protected readonly session = inject(CallSession);

  /** The time in the call, `m:ss`. */
  readonly elapsed = input('');

  protected readonly layout = computed(() => stageLayout(this.session.participants()));
  private readonly mobile = injectMobile();
  protected readonly grid = computed(() => gridSize(this.layout().tiles.length, this.mobile()));
  private readonly title = viewChild.required<ElementRef<HTMLElement>>('title');

  ngAfterViewInit(): void {
    this.title().nativeElement.focus();
  }

  protected escape(): void {
    if (this.session.phase() === 'ended') {
      this.session.close();
    } else {
      this.session.minimize();
    }
  }
}
