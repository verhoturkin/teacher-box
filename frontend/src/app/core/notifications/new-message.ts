import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  InjectionToken,
  Type,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';

/**
 * Loads the dialog of a new message to students (of the notifications feature). The application provides it:
 * the frame in core/ does not import features (AGENTS.md §4.2 rule 6).
 */
export const NEW_MESSAGE_DIALOG = new InjectionToken<() => Promise<Type<unknown>>>(
  'NEW_MESSAGE_DIALOG',
);

/**
 * The teacher's new message to students: «Создать › Сообщение» from any page and «Написать ученикам» of the
 * sent tab of the bell's sheet open the same dialog; `sent` counts the messages sent, so the sent tab
 * refreshes.
 */
@Injectable({ providedIn: 'root' })
export class NewMessageState {
  private readonly openState = signal(false);
  private readonly sentState = signal(0);

  readonly open = this.openState.asReadonly();
  readonly sent = this.sentState.asReadonly();

  show(): void {
    this.openState.set(true);
  }

  close(): void {
    this.openState.set(false);
  }

  /** A message has been sent (the dialog closes itself). */
  markSent(): void {
    this.sentState.update((count) => count + 1);
  }
}

/** The place of the dialog of a new message in the frame: the feature's dialog, loaded when first asked for. */
@Component({
  selector: 'tb-new-message',
  imports: [NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (dialog(); as dialog) {
      <ng-container *ngComponentOutlet="dialog" />
    }
  `,
})
export class NewMessage {
  private readonly state = inject(NewMessageState);
  private readonly load = inject(NEW_MESSAGE_DIALOG, { optional: true });

  protected readonly dialog = signal<Type<unknown> | null>(null);

  constructor() {
    effect(() => {
      if (this.state.open() && untracked(this.dialog) === null && this.load !== null) {
        void this.load().then((type) => {
          this.dialog.set(type);
        });
      }
    });
  }
}
