import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { describeError } from '@core/http/error-messages';
import { MeetingsApi } from '../data-access/meetings-api';
import { MeetingRoom, RoomOwnerRef } from '../data-access/meetings.models';

/** An http(s) address; spaces around it are trimmed when it is saved. */
export const ROOM_LINK_PATTERN = /^\s*https?:\/\/\S+\s*$/;

/**
 * The permanent room of a student or a group: create a Telemost meeting (with Yandex connected)
 * or paste a link, copy it, send it to the students, remove it.
 */
@Component({
  selector: 'tb-room-dialog',
  imports: [ReactiveFormsModule, Button, Dialog, InputText, Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="title()"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '34rem' }"
      [draggable]="false"
    >
      @if (owner(); as owner) {
        <div class="tb-form">
          @if (room(); as room) {
            <div class="tb-room-link">
              <a [href]="room.joinUrl" target="_blank" rel="noopener">{{ room.joinUrl }}</a>
              <p-button
                icon="pi pi-copy"
                [text]="true"
                size="small"
                ariaLabel="Копировать ссылку"
                (onClick)="copy(room.joinUrl)"
              />
            </div>
            <div class="tb-actions">
              <p-button
                [label]="owner.type === 'GROUP' ? 'Отправить группе' : 'Отправить ученику'"
                icon="pi pi-send"
                [outlined]="true"
                [loading]="pending()"
                (onClick)="share(room)"
              />
              <p-button
                label="Удалить"
                icon="pi pi-trash"
                severity="danger"
                [text]="true"
                [loading]="pending()"
                (onClick)="remove(room)"
              />
            </div>
          } @else {
            <p class="tb-muted">
              Постоянная ссылка на видеовстречу: по ней
              {{ owner.type === 'GROUP' ? 'группа приходит' : 'ученик приходит' }}
              на все уроки. Ссылка попадёт в напоминания, календарь и кнопку «Войти в урок».
            </p>
          }
          @if (canCreate()) {
            <p-button
              [label]="
                room() === null ? 'Создать встречу в Телемосте' : 'Новая встреча в Телемосте'
              "
              icon="pi pi-video"
              [loading]="pending()"
              (onClick)="create()"
            />
            <small class="tb-hint">Или вставьте ссылку сами:</small>
          }
          <div class="tb-field">
            <label for="room-link">Ссылка на встречу</label>
            <div class="tb-inline">
              <input
                pInputText
                id="room-link"
                [formControl]="link"
                placeholder="https://telemost.yandex.ru/j/..."
                autocomplete="off"
                class="tb-grow"
              />
              <p-button
                label="Сохранить"
                [disabled]="link.invalid || link.value.trim() === ''"
                [loading]="pending()"
                (onClick)="save()"
              />
            </div>
            @if (link.invalid) {
              <small class="tb-error">Ссылка должна начинаться с http:// или https://</small>
            }
          </div>
          @if (error(); as message) {
            <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
          }
        </div>
      }
    </p-dialog>
  `,
  styles: `
    .tb-room-link {
      display: flex;
      align-items: center;
      gap: 0.25rem;

      a {
        overflow-wrap: anywhere;
      }
    }
  `,
})
export class RoomDialog {
  private readonly api = inject(MeetingsApi);
  private readonly clipboard = inject(Clipboard);
  private readonly messages = inject(MessageService);

  readonly visible = model(false);
  readonly owner = input<RoomOwnerRef | null>(null);
  readonly room = input<MeetingRoom | null>(null);
  /** Yandex is connected: meetings can be created through the API. */
  readonly canCreate = input(false);
  /** The room was created, changed (the new room) or removed (`null`). */
  readonly changed = output<MeetingRoom | null>();

  protected readonly title = computed(() => `Видеовстреча: ${this.owner()?.name ?? ''}`);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  readonly link = new FormControl('', {
    nonNullable: true,
    validators: [Validators.pattern(ROOM_LINK_PATTERN)],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.error.set(null);
        this.link.reset('');
      }
    });
  }

  create(): void {
    const owner = this.owner();
    if (owner !== null) {
      this.run(this.api.createRoom(owner), (room) => {
        this.changed.emit(room);
      });
    }
  }

  save(): void {
    const owner = this.owner();
    const value = this.link.value.trim();
    if (owner !== null && value !== '' && this.link.valid) {
      this.run(this.api.enterLink(owner, value), (room) => {
        this.changed.emit(room);
      });
    }
  }

  remove(room: MeetingRoom): void {
    this.run(this.api.removeRoom(room.ownerId), () => {
      this.changed.emit(null);
    });
  }

  share(room: MeetingRoom): void {
    this.run(
      this.api.share(room.ownerId),
      (recipients) => {
        this.messages.add({
          severity: 'success',
          summary: 'Ссылка отправлена',
          detail: `Получателей: ${String(recipients)}`,
        });
      },
      false,
    );
  }

  copy(text: string): void {
    if (this.clipboard.copy(text)) {
      this.messages.add({
        severity: 'success',
        summary: 'Скопировано',
        detail: 'Ссылка в буфере обмена',
      });
    }
  }

  private run<T>(request: Observable<T>, done: (value: T) => void, close = true): void {
    if (this.pending()) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    request.subscribe({
      next: (value) => {
        this.pending.set(false);
        if (close) {
          this.visible.set(false);
        }
        done(value);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, 'Не получилось. Попробуйте позже'));
      },
    });
  }
}
