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
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Tooltip } from 'primeng/tooltip';
import { describeError } from '@core/http/error-messages';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { BoardsApi } from '../data-access/boards-api';
import { BoardBackup } from '../data-access/boards.models';
import { BOARD_BACKUP_KIND_LABELS } from '../boards-labels';

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
  imports: [DatePipe, Button, Dialog, Message, Tooltip, EmptyState, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="'Резервные копии: ' + title()"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog tb-dialog--wide"
      [draggable]="false"
    >
      <p class="tb-muted">
        Портал копирует каждую изменённую доску раз в сутки. Сделайте свою копию перед большими
        изменениями.
      </p>
      <div class="tb-form-actions">
        <p-button
          label="Сделать копию"
          icon="pi pi-copy"
          severity="secondary"
          [loading]="busy() === 'create'"
          (onClick)="create()"
        />
      </div>
      @if (confirming(); as action) {
        <p-message
          [severity]="action.kind === 'delete' ? 'error' : 'warn'"
          styleClass="tb-form-message"
        >
          <span>
            @if (action.kind === 'restore') {
              Вернуть рисунок от {{ action.backup.createdAt | date: 'dd.MM.yyyy HH:mm' }}? Текущий
              рисунок сохранится копией — его тоже можно будет вернуть.
            } @else {
              Удалить копию от {{ action.backup.createdAt | date: 'dd.MM.yyyy HH:mm' }}?
            }
          </span>
          <span class="tb-inline">
            <p-button
              label="Отмена"
              severity="secondary"
              [text]="true"
              (onClick)="confirming.set(null)"
            />
            <p-button
              [label]="action.kind === 'restore' ? 'Восстановить' : 'Удалить'"
              [severity]="action.kind === 'restore' ? 'success' : 'danger'"
              [loading]="busy() === action.kind"
              (onClick)="confirm(action)"
            />
          </span>
        </p-message>
      }
      @if (error(); as message) {
        <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
      }
      <tb-load-state [state]="state" what="копии" (retry)="load()">
        @if (backups().length > 0) {
          <ul class="tb-list">
            @for (backup of backups(); track backup.id) {
              <li>
                <span class="tb-list__lead" aria-hidden="true"
                  ><i [class]="backup.kind === 'DAILY' ? 'pi pi-calendar' : 'pi pi-copy'"></i
                ></span>
                <div class="tb-list__text">
                  <span class="tb-list__title">{{
                    backup.createdAt | date: 'dd.MM.yyyy HH:mm'
                  }}</span>
                  <span class="tb-list__supporting">{{ kindLabels[backup.kind] }}</span>
                </div>
                <span class="tb-list__trail">
                  <p-button
                    label="Восстановить"
                    [text]="true"
                    [ariaLabel]="
                      'Восстановить копию от ' + (backup.createdAt | date: 'dd.MM.yyyy HH:mm')
                    "
                    (onClick)="ask('restore', backup)"
                  />
                  <p-button
                    icon="pi pi-trash"
                    [text]="true"
                    [rounded]="true"
                    severity="danger"
                    [pTooltip]="'Удалить копию от ' + (backup.createdAt | date: 'dd.MM.yyyy HH:mm')"
                    [ariaLabel]="
                      'Удалить копию от ' + (backup.createdAt | date: 'dd.MM.yyyy HH:mm')
                    "
                    (onClick)="ask('delete', backup)"
                  />
                </span>
              </li>
            }
          </ul>
        } @else {
          <tb-empty-state
            [compact]="true"
            icon="pi-history"
            title="Копий пока нет"
            hint="Ежедневная копия появится после первых изменений на доске."
          />
        }
      </tb-load-state>
      <ng-template #footer>
        <p-button
          label="Закрыть"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class BoardBackupsDialog {
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
        this.error.set(describeError(error, 'Не получилось. Попробуйте позже'));
      },
    });
  }
}
