import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { HelpButton } from '@features/help/parts';
import { describeError } from '@core/http/error-messages';
import { BoardsApi } from '../data-access/boards-api';
import { Board, BoardOwnerRef } from '../data-access/boards.models';

export const BOARD_LINK_PATTERN = /^\s*https?:\/\/\S+\s*$/;

/** Boards of a student or a group: add a link, rename, change or remove. */
@Component({
  selector: 'tb-boards-dialog',
  imports: [HelpButton, ReactiveFormsModule, Button, Dialog, InputText, Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [header]="title()" [(visible)]="visible" [modal]="true" [style]="{ width: '36rem' }" [draggable]="false">
      <tb-help-button topic="teacher/boards" label="Подробнее" />
      @if (boards().length > 0) {
        <ul class="tb-boards">
          @for (board of boards(); track board.id) {
            <li>
              <a [href]="board.url" target="_blank" rel="noopener">{{ board.title }}</a>
              <span class="tb-actions">
                <p-button icon="pi pi-pencil" [text]="true" size="small" [ariaLabel]="'Изменить доску: ' + board.title" (onClick)="edit(board)" />
                <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" [ariaLabel]="'Удалить доску: ' + board.title" (onClick)="remove(board)" />
              </span>
            </li>
          }
        </ul>
      } @else {
        <p class="tb-muted">
          Создайте доску в Холсте (app.holst.so), откройте к ней доступ по ссылке и вставьте ссылку сюда — ученик
          увидит доску в своём кабинете.
        </p>
      }
      <form class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="tb-field">
          <label for="board-title">Название</label>
          <input pInputText id="board-title" formControlName="title" placeholder="Например, Алгебра" autocomplete="off" />
        </div>
        <div class="tb-field">
          <label for="board-url">Ссылка на доску</label>
          <input pInputText id="board-url" formControlName="url" placeholder="https://app.holst.so/..." autocomplete="off" />
          @if (form.controls.url.invalid && form.controls.url.value !== '') {
            <small class="tb-error">Ссылка должна начинаться с http:// или https://</small>
          }
        </div>
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
        <div class="tb-actions">
          <p-button type="submit" [label]="editing() === null ? 'Добавить доску' : 'Сохранить'" [disabled]="form.invalid" [loading]="pending()" />
          @if (editing() !== null) {
            <p-button label="Отмена" severity="secondary" [text]="true" (onClick)="cancelEdit()" />
          }
        </div>
      </form>
    </p-dialog>
  `,
  styles: `
    .tb-boards {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin: 0 0 1rem;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }
    }
  `,
})
export class BoardsDialog {
  private readonly api = inject(BoardsApi);

  readonly visible = model(false);
  readonly owner = input<BoardOwnerRef | null>(null);
  readonly boards = input<readonly Board[]>([]);
  /** A board was added or changed. */
  readonly saved = output<Board>();
  /** A board was removed. */
  readonly removed = output<Board>();

  protected readonly title = computed(() => `Доски: ${this.owner()?.name ?? ''}`);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly editing = signal<Board | null>(null);
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(1000), Validators.pattern(BOARD_LINK_PATTERN)],
    }),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.cancelEdit();
      }
    });
  }

  edit(board: Board): void {
    this.editing.set(board);
    this.error.set(null);
    this.form.reset({ title: board.title, url: board.url });
  }

  cancelEdit(): void {
    this.editing.set(null);
    this.error.set(null);
    this.form.reset({ title: '', url: '' });
  }

  save(): void {
    const owner = this.owner();
    if (owner === null || this.form.invalid || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    const title = value.title.trim();
    const url = value.url.trim();
    const board = this.editing();
    this.run(
      board === null
        ? this.api.add(owner, title === '' ? null : title, url)
        : this.api.change(board, title === '' ? board.title : title, url),
      (saved) => {
        this.saved.emit(saved);
        this.cancelEdit();
      },
    );
  }

  remove(board: Board): void {
    this.run(this.api.remove(board.id), () => {
      this.removed.emit(board);
    });
  }

  private run<T>(request: Observable<T>, done: (value: T) => void): void {
    this.pending.set(true);
    this.error.set(null);
    request.subscribe({
      next: (value) => {
        this.pending.set(false);
        done(value);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, 'Не получилось. Попробуйте позже'));
      },
    });
  }
}
