import { Injectable, inject } from '@angular/core';
import { MessageService, ToastMessageOptions } from 'primeng/api';

/** A result of an action (success), a note (info) or a failure (error). */
export type SnackbarSeverity = 'success' | 'info' | 'error';

/** How long a message stays on the screen (ADR-0024): time to read it, an error longer. */
export const SNACKBAR_LIFE = 5000;
export const SNACKBAR_ERROR_LIFE = 8000;
/** A result that can be taken back by «Отменить». */
export const SNACKBAR_UNDO_LIFE = 6000;

/**
 * The snackbar (M3, ADR-0024): a short message at the bottom of the screen. One cause — one message:
 * the same text is not shown again while it is on the screen.
 */
@Injectable({ providedIn: 'root' })
export class Snackbar {
  private readonly messages = inject(MessageService);
  /** Messages on the screen: key → until when. */
  private readonly shown = new Map<string, number>();

  success(detail: string): void {
    this.show('success', detail);
  }

  info(detail: string): void {
    this.show('info', detail);
  }

  error(detail: string): void {
    this.show('error', detail);
  }

  /** A note that stays until it is closed: a step left to do. */
  notice(detail: string): void {
    this.show('info', detail, true);
  }

  /** A result with «Отменить» for a while: the action needs no confirmation, it can be taken back. */
  undoable(detail: string, undo: () => void): void {
    this.shown.set(`success:${detail}`, Date.now() + SNACKBAR_UNDO_LIFE);
    this.messages.add({ severity: 'success', detail, life: SNACKBAR_UNDO_LIFE, data: { undo } });
  }

  /** A note that stays until it is closed, with a button of its own (e.g. «Обновить»). */
  action(detail: string, label: string, run: () => void): void {
    if (this.shown.has(`info:${detail}`)) {
      return;
    }
    this.shown.set(`info:${detail}`, Number.POSITIVE_INFINITY);
    this.messages.add({ severity: 'info', detail, sticky: true, data: { undo: run, label } });
  }

  show(severity: SnackbarSeverity, detail: string, sticky = false): void {
    const now = Date.now();
    const key = `${severity}:${detail}`;
    if ((this.shown.get(key) ?? 0) > now) {
      return;
    }
    const life = severity === 'error' ? SNACKBAR_ERROR_LIFE : SNACKBAR_LIFE;
    this.shown.set(key, sticky ? Number.POSITIVE_INFINITY : now + life);
    this.messages.add(sticky ? { severity, detail, sticky } : { severity, detail, life });
  }

  /** The message was closed (by its button or its time): the same text may be shown again. */
  closed(message: ToastMessageOptions): void {
    this.shown.delete(`${message.severity ?? ''}:${message.detail ?? ''}`);
  }
}
