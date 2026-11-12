import { signal } from '@angular/core';
import { Observable } from 'rxjs';
import { locale } from '@core/i18n/language';
import { AssignmentDetails } from '@features/homework/data-access/homework.models';

const AUTOSAVE_DELAY = 1500;
const TIME = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' });

/** A save of the editor: the assignment as the server has it, and whether all its materials made it. */
export interface EditorWrite {
  readonly assignment: AssignmentDetails;
  readonly complete: boolean;
}

/** What the autosave needs of the editor. */
export interface AutosavedDraft {
  /** The draft may save itself now: it has a title, a valid text and is not given out yet. */
  canSave(): boolean;
  /** What a save sends besides the files and textbooks. */
  snapshot(): string;
  /** Saves the draft as it is: nothing goes to students. */
  write(): Observable<EditorWrite>;
  saved(result: EditorWrite): void;
  failed(error: unknown): void;
}

/**
 * The draft saves itself a moment after each change; «Выдать» pressed meanwhile waits for it, and a change
 * that came during a save is saved once more after it.
 */
export class EditorAutosave {
  /** A save (of either kind) is running. */
  readonly pending = signal(false);
  readonly autosaving = signal(false);
  /** «сохранено · HH:mm» of the last autosave. */
  readonly savedAt = signal<string | null>(null);
  /** Milliseconds of quiet before a draft saves itself. */
  delay = AUTOSAVE_DELAY;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** What the server has; a draft differing from it saves itself. */
  private savedSnapshot = '';
  /** A change came while a save was running: save once more after it. */
  private again = false;
  /** «Выдать» pressed during an autosave: runs after it. */
  private queued: (() => void) | null = null;

  constructor(private readonly draft: AutosavedDraft) {}

  /** The server has this snapshot. */
  mark(snapshot: string): void {
    this.savedSnapshot = snapshot;
  }

  /** The snapshot is not what the server has. */
  differs(snapshot: string): boolean {
    return snapshot !== this.savedSnapshot;
  }

  schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.run();
    }, this.delay);
  }

  cancel(): void {
    clearTimeout(this.timer);
  }

  /** A save is running: an autosave runs `then` after it, a «Выдать» lets it go. */
  busy(then: () => void): boolean {
    if (!this.pending()) {
      return false;
    }
    if (this.autosaving()) {
      this.queued = then;
    }
    return true;
  }

  /** Saves the draft as it is now: no questions are checked, nothing goes to students; nothing without a title. */
  run(): void {
    clearTimeout(this.timer);
    if (!this.draft.canSave()) {
      return;
    }
    if (this.pending()) {
      this.again = true;
      return;
    }
    const snapshot = this.draft.snapshot();
    this.pending.set(true);
    this.autosaving.set(true);
    this.draft.write().subscribe({
      next: (result) => {
        this.savedSnapshot = snapshot;
        this.savedAt.set(TIME.format(new Date()));
        this.draft.saved(result);
        this.after();
      },
      error: (error: unknown) => {
        this.draft.failed(error);
        this.after();
      },
    });
  }

  private after(): void {
    this.pending.set(false);
    this.autosaving.set(false);
    const queued = this.queued;
    this.queued = null;
    if (queued !== null) {
      queued();
    } else if (this.again) {
      this.again = false;
      this.run();
    }
  }
}
