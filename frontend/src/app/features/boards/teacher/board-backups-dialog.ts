import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { Observable } from 'rxjs';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { describeError } from '@core/http/error-messages';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { DialogConfirmStep } from '@shared/ui/dialog/dialog-confirm-step';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { BoardsApi } from '../data-access/boards-api';
import { BoardBackup } from '../data-access/boards.models';
import { BOARD_BACKUP_KIND_LABELS } from '../boards-labels';
import { T } from '../i18n/texts';

/** What the teacher is about to do with a copy: asked inside the dialog, never in a second one. */
interface PendingAction {
  readonly kind: 'restore' | 'delete';
  readonly backup: BoardBackup;
}

/**
 * Copies of an Excalidraw board (ADR-0028): the daily ones and the teacher's; make one, restore one
 * (the current drawing is kept as a copy first) or delete one.
 */
@Component({
  selector: 'tb-board-backups-dialog',
  imports: [DatePipe, Button, TbDialog, DialogConfirmStep, Tooltip, EmptyState, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="sheet"
      width="wide"
      [(visible)]="visible"
      [headline]="t.title(title())"
      [cancelLabel]="null"
      [error]="error()"
    >
      <div class="tb-form">
        <p class="tb-muted">{{ t.about }}</p>
        <div class="tb-form-actions">
          <p-button
            [label]="t.create"
            icon="tb-i tb-i-content_copy"
            severity="secondary"
            [loading]="busy() === 'create'"
            (onClick)="create()"
          />
        </div>
        @if (confirming(); as action) {
          <tb-dialog-confirm-step
            [message]="
              (action.kind === 'restore' ? t.restoreQuestion : t.deleteQuestion)(
                (action.backup.createdAt | date: 'dd.MM.yyyy HH:mm') ?? ''
              )
            "
            [confirmLabel]="action.kind === 'restore' ? t.restore : t.delete"
            [severity]="action.kind === 'restore' ? 'primary' : 'danger'"
            (confirmed)="confirm(action)"
            (cancelled)="confirming.set(null)"
          />
        }
        <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
          @if (backups().length > 0) {
            <ul class="tb-list">
              @for (backup of backups(); track backup.id) {
                <li>
                  <span class="tb-list__lead" aria-hidden="true"
                    ><i
                      [class]="
                        backup.kind === 'DAILY'
                          ? 'tb-i tb-i-calendar_month'
                          : 'tb-i tb-i-content_copy'
                      "
                    ></i
                  ></span>
                  <div class="tb-list__text">
                    <span class="tb-list__title">{{
                      backup.createdAt | date: 'dd.MM.yyyy HH:mm'
                    }}</span>
                    <span class="tb-list__supporting">{{ kindLabels[backup.kind] }}</span>
                  </div>
                  <span class="tb-list__trail">
                    <p-button
                      [label]="t.restore"
                      [text]="true"
                      [ariaLabel]="t.restoreOf((backup.createdAt | date: 'dd.MM.yyyy HH:mm') ?? '')"
                      (onClick)="ask('restore', backup)"
                    />
                    <p-button
                      icon="tb-i tb-i-delete"
                      [text]="true"
                      [rounded]="true"
                      severity="danger"
                      [pTooltip]="t.deleteOf((backup.createdAt | date: 'dd.MM.yyyy HH:mm') ?? '')"
                      [ariaLabel]="t.deleteOf((backup.createdAt | date: 'dd.MM.yyyy HH:mm') ?? '')"
                      (onClick)="ask('delete', backup)"
                    />
                  </span>
                </li>
              }
            </ul>
          } @else {
            <tb-empty-state
              [compact]="true"
              icon="tb-i-history"
              [title]="t.emptyTitle"
              [hint]="t.emptyHint"
            />
          }
        </tb-load-state>
      </div>
    </tb-dialog>
  `,
  styles: `
    /* the column's gap spaces the text, the button and the list */
    p {
      margin: 0;
    }
  `,
})
export class BoardBackupsDialog {
  protected readonly t = T.backups;
  private readonly api = inject(BoardsApi);

  readonly visible = model(false);
  readonly boardId = input<string | null>(null);
  readonly title = input('');
  /** A copy was restored: the drawing changed. */
  readonly restored = output();

  protected readonly kindLabels = BOARD_BACKUP_KIND_LABELS;
  protected readonly state = new LoadState();
  protected readonly backups = signal<BoardBackup[]>([]);
  protected readonly confirming = signal<PendingAction | null>(null);
  protected readonly busy = signal<'create' | 'restore' | 'delete' | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.visible() && this.boardId() !== null) {
        untracked(() => {
          this.confirming.set(null);
          this.error.set(null);
          this.load();
        });
      }
    });
  }

  load(): void {
    const boardId = this.boardId();
    if (boardId === null) return;
    this.api
      .backups(boardId)
      .pipe(this.state.track())
      .subscribe((backups) => {
        this.backups.set(backups);
      });
  }

  create(): void {
    const boardId = this.boardId();
    if (boardId === null) return;
    this.run('create', this.api.createBackup(boardId), () => {
      this.load();
    });
  }

  ask(kind: PendingAction['kind'], backup: BoardBackup): void {
    this.error.set(null);
    this.confirming.set({ kind, backup });
  }

  confirm(action: PendingAction): void {
    const boardId = this.boardId();
    if (boardId === null) return;
    const request: Observable<unknown> =
      action.kind === 'restore'
        ? this.api.restoreBackup(boardId, action.backup.id)
        : this.api.deleteBackup(boardId, action.backup.id);
    this.run(action.kind, request, () => {
      this.confirming.set(null);
      if (action.kind === 'restore') this.restored.emit();
      this.load();
    });
  }

  private run<T>(
    kind: 'create' | 'restore' | 'delete',
    request: Observable<T>,
    done: () => void,
  ): void {
    this.busy.set(kind);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(null);
        done();
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this.error.set(describeError(error, T.backups.failed));
      },
    });
  }
}
